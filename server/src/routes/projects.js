const router = require('express').Router();
const { z } = require('zod');
const prisma = require('../lib/prisma');
const validate = require('../middleware/validate');
const { requireAuth, requireRole, projectScope } = require('../middleware/auth');
const audit = require('../lib/audit');
const { scoreProject, savePrediction } = require('../lib/riskService');

router.use(requireAuth);

const latestPrediction = { predictions: { orderBy: { predictionDate: 'desc' }, take: 1 } };

/* GET /projects — filter, sort, paginate. Scoped to the caller's role. */
router.get('/', async (req, res) => {
  const { ministry, sector, state, agency, riskLevel, status, minCost, stale, q,
          sortBy = 'risk', order = 'desc', page = '1', pageSize = '50' } = req.query;
  const where = { ...projectScope(req.user) };
  if (sector) where.sector = sector;
  if (state) where.state = state;
  if (status) where.currentStatus = status;
  if (minCost) where.sanctionedCostCr = { gte: Number(minCost) };
  if (ministry) where.ministry = { name: ministry };
  if (agency) where.agency = { name: agency };
  if (stale === 'true') {
    const cutoff = new Date(Date.now() - Number(process.env.STALE_DAYS || 30) * 86400000);
    where.lastUpdatedDate = { lt: cutoff };
  }
  if (q) where.OR = [
    { projectName: { contains: q, mode: 'insensitive' } },
    { projectCode: { contains: q, mode: 'insensitive' } }
  ];

  let rows = await prisma.project.findMany({
    where, include: { ministry: true, agency: true, ...latestPrediction }
  });
  if (riskLevel) rows = rows.filter(p => p.predictions[0]?.riskLevel === riskLevel);

  const key = p => ({
    risk: p.predictions[0]?.overallRiskScore ?? -1, cost: p.sanctionedCostCr,
    progress: p.physicalProgressPct, name: p.projectName, updated: new Date(p.lastUpdatedDate).getTime()
  }[sortBy] ?? (p.predictions[0]?.overallRiskScore ?? -1));
  rows.sort((a, b) => {
    const x = key(a), y = key(b);
    const c = typeof x === 'string' ? x.localeCompare(y) : x - y;
    return order === 'desc' ? -c : c;
  });

  const p = Number(page), size = Math.min(Number(pageSize), 200);
  res.json({ total: rows.length, page: p, pageSize: size,
    data: rows.slice((p - 1) * size, p * size).map(shape) });
});

const shape = p => ({
  id: p.id, projectCode: p.projectCode, projectName: p.projectName,
  ministry: p.ministry?.name, agency: p.agency?.name, sector: p.sector, subSector: p.subSector,
  state: p.state, district: p.district, sanctionedCostCr: p.sanctionedCostCr,
  revisedCostCr: p.revisedCostCr, expenditureIncurredCr: p.expenditureIncurredCr,
  physicalProgressPct: p.physicalProgressPct, expectedProgressPct: p.expectedProgressPct,
  landAcquisitionPct: p.landAcquisitionPct, clearanceStatus: p.clearanceStatus,
  currentStatus: p.currentStatus, monthsOfDelay: p.monthsOfDelay,
  originalCompletionDate: p.originalCompletionDate, revisedCompletionDate: p.revisedCompletionDate,
  lastUpdatedDate: p.lastUpdatedDate, prediction: p.predictions?.[0] || null
});

router.get('/:id', async (req, res) => {
  const p = await prisma.project.findFirst({
    where: { id: req.params.id, ...projectScope(req.user) },
    include: { ministry: true, agency: true, milestones: { orderBy: { plannedDate: 'asc' } },
      updates: { orderBy: { reportingDate: 'desc' }, take: 12 },
      predictions: { orderBy: { predictionDate: 'desc' }, take: 1 },
      alerts: { orderBy: { createdAt: 'desc' } },
      interventions: { orderBy: { createdAt: 'desc' } } }
  });
  if (!p) return res.status(404).json({ error: 'Project not found' });
  res.json({ ...shape(p), milestones: p.milestones, updates: p.updates,
    alerts: p.alerts, interventions: p.interventions });
});

const projectSchema = z.object({
  projectCode: z.string().min(3), projectName: z.string().min(3),
  ministryId: z.string(), agencyId: z.string(), sector: z.string(), state: z.string(),
  sanctionedCostCr: z.number().positive(), revisedCostCr: z.number().positive().optional(),
  expenditureIncurredCr: z.number().min(0).optional(),
  physicalProgressPct: z.number().min(0).max(100).optional(),
  expectedProgressPct: z.number().min(0).max(100).optional(),
  landAcquisitionPct: z.number().min(0).max(100).optional(),
  clearanceStatus: z.enum(['Approved', 'Partial', 'Pending']).optional(),
  monthsOfDelay: z.number().int().min(0).optional()
}).passthrough();

router.post('/', requireRole('ADMIN', 'MOSPI_OFFICER'), validate({ body: projectSchema }), async (req, res) => {
  const project = await prisma.project.create({ data: req.body });
  await audit(req, 'PROJECT_CREATED', 'Project', project.id);
  res.status(201).json(project);
});

router.patch('/:id', requireRole('ADMIN', 'MOSPI_OFFICER', 'MINISTRY_OFFICER'),
  validate({ body: projectSchema.partial() }), async (req, res) => {
    const before = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ error: 'Project not found' });
    const project = await prisma.project.update({ where: { id: req.params.id }, data: req.body });
    await audit(req, 'PROJECT_UPDATED', 'Project', project.id, { changed: Object.keys(req.body) });
    res.json(project);
  });

router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  await prisma.project.delete({ where: { id: req.params.id } });
  await audit(req, 'PROJECT_DELETED', 'Project', req.params.id);
  res.status(204).end();
});

router.get('/:id/history', async (req, res) => {
  res.json(await prisma.riskPrediction.findMany({
    where: { projectId: req.params.id }, orderBy: { predictionDate: 'asc' } }));
});

/* A periodic return: store it, move the project forward, rescore. */
const updateSchema = z.object({
  reportingDate: z.coerce.date().optional(),
  physicalProgressPct: z.number().min(0).max(100),
  expenditureIncurredCr: z.number().min(0).optional(),
  landAcquisitionPct: z.number().min(0).max(100).optional(),
  clearanceStatus: z.enum(['Approved', 'Partial', 'Pending']).optional(),
  remark: z.string().optional()
});
router.post('/:id/updates', requireRole('ADMIN', 'AGENCY_OFFICER', 'MINISTRY_OFFICER'),
  validate({ body: updateSchema }), async (req, res) => {
    const id = req.params.id;
    const update = await prisma.projectUpdate.create({
      data: { projectId: id, reportingDate: req.body.reportingDate || new Date(),
        physicalProgressPct: req.body.physicalProgressPct,
        expenditureIncurredCr: req.body.expenditureIncurredCr, remark: req.body.remark,
        submittedBy: req.user.name }
    });
    await prisma.project.update({ where: { id }, data: {
      physicalProgressPct: req.body.physicalProgressPct,
      expenditureIncurredCr: req.body.expenditureIncurredCr ?? undefined,
      landAcquisitionPct: req.body.landAcquisitionPct ?? undefined,
      clearanceStatus: req.body.clearanceStatus ?? undefined,
      lastUpdatedDate: new Date() } });
    const project = await prisma.project.findUnique({ where: { id }, include: { milestones: true } });
    const prediction = await savePrediction(id, await scoreProject(project));
    await audit(req, 'PROJECT_UPDATE_FILED', 'Project', id);
    res.status(201).json({ update, prediction });
  });

router.get('/:id/milestones', async (req, res) =>
  res.json(await prisma.milestone.findMany({
    where: { projectId: req.params.id }, orderBy: { plannedDate: 'asc' } })));

router.post('/:id/milestones', requireRole('ADMIN', 'AGENCY_OFFICER'), async (req, res) => {
  const m = await prisma.milestone.create({ data: { ...req.body, projectId: req.params.id } });
  res.status(201).json(m);
});

/* Project-scoped intervention routes (mirrors /api/v1/interventions). */
router.get('/:id/interventions', async (req, res) =>
  res.json(await prisma.intervention.findMany({
    where: { projectId: req.params.id }, orderBy: { createdAt: 'desc' } })));

router.post('/:id/interventions', requireRole('ADMIN', 'MOSPI_OFFICER', 'MINISTRY_OFFICER'), async (req, res) => {
  const iv = await prisma.intervention.create({
    data: { ...req.body, projectId: req.params.id, createdById: req.user.id } });
  await audit(req, 'INTERVENTION_CREATED', 'Intervention', iv.id, { type: iv.type });
  res.status(201).json(iv);
});

module.exports = router;
