/* Mounted twice: /api/v1/interventions/:id and /api/v1/projects/:id/interventions
   (the project-scoped routes live here and are re-exported for clarity). */
const router = require('express').Router();
const { z } = require('zod');
const prisma = require('../lib/prisma');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const audit = require('../lib/audit');

router.use(requireAuth);

const TYPES = ['Land Acquisition Review', 'Clearance Escalation', 'Contractor Performance Review',
  'Funding Review', 'Milestone Review Meeting', 'Field Inspection', 'Request Revised Completion Plan'];

const createSchema = z.object({
  projectId: z.string(),
  type: z.enum(TYPES),
  description: z.string().min(5),
  assignedAuthority: z.string().min(2),
  dueDate: z.coerce.date().optional()
});
const patchSchema = z.object({
  status: z.enum(['Open', 'InProgress', 'Completed', 'Cancelled']).optional(),
  outcomeNotes: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  assignedAuthority: z.string().optional()
});

router.get('/', async (req, res) => {
  const where = {};
  if (req.query.projectId) where.projectId = req.query.projectId;
  if (req.query.status) where.status = req.query.status;
  res.json(await prisma.intervention.findMany({ where, orderBy: { createdAt: 'desc' },
    include: { project: { select: { projectCode: true, projectName: true } } } }));
});

router.post('/', requireRole('ADMIN', 'MOSPI_OFFICER', 'MINISTRY_OFFICER'),
  validate({ body: createSchema }), async (req, res) => {
    const iv = await prisma.intervention.create({ data: { ...req.body, createdById: req.user.id } });
    await audit(req, 'INTERVENTION_CREATED', 'Intervention', iv.id, { type: iv.type });
    res.status(201).json(iv);
  });

router.patch('/:id', requireRole('ADMIN', 'MOSPI_OFFICER', 'MINISTRY_OFFICER'),
  validate({ body: patchSchema }), async (req, res) => {
    const iv = await prisma.intervention.update({ where: { id: req.params.id }, data: req.body });
    await audit(req, 'INTERVENTION_UPDATED', 'Intervention', iv.id, { changed: Object.keys(req.body) });
    res.json(iv);
  });

router.get('/types', (_req, res) => res.json(TYPES));

module.exports = router;
