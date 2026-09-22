const router = require('express').Router();
const prisma = require('../lib/prisma');
const { requireAuth, requireRole, projectScope } = require('../middleware/auth');
const audit = require('../lib/audit');

router.use(requireAuth);

router.get('/', async (req, res) => {
  const { severity, type, status, ministry, from, to, page = '1', pageSize = '100' } = req.query;
  const where = { project: projectScope(req.user) };
  if (severity) where.severity = severity;
  if (type) where.type = type;
  if (status) where.status = status;
  if (ministry) where.project = { ...where.project, ministry: { name: ministry } };
  if (from || to) where.createdAt = { gte: from ? new Date(from) : undefined,
    lte: to ? new Date(to) : undefined };
  const p = Number(page), size = Math.min(Number(pageSize), 200);
  const [total, data] = await Promise.all([
    prisma.alert.count({ where }),
    prisma.alert.findMany({ where, orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
      skip: (p - 1) * size, take: size,
      include: { project: { select: { projectCode: true, projectName: true } },
        assignedTo: { select: { name: true } } } })
  ]);
  res.json({ total, page: p, pageSize: size, data });
});

router.get('/summary', async (req, res) => {
  const rows = await prisma.alert.groupBy({
    by: ['type', 'status'], _count: true, where: { project: projectScope(req.user) } });
  res.json(rows.map(r => ({ type: r.type, status: r.status, count: r._count })));
});

router.get('/:id', async (req, res) => {
  const a = await prisma.alert.findUnique({ where: { id: req.params.id }, include: { project: true } });
  if (!a) return res.status(404).json({ error: 'Alert not found' });
  res.json(a);
});

router.patch('/:id/acknowledge', requireRole('ADMIN', 'MOSPI_OFFICER', 'MINISTRY_OFFICER'), async (req, res) => {
  const a = await prisma.alert.update({ where: { id: req.params.id },
    data: { status: 'Acknowledged', assignedToId: req.user.id, acknowledgedAt: new Date() } });
  await audit(req, 'ALERT_ACKNOWLEDGED', 'Alert', a.id);
  res.json(a);
});

router.patch('/:id/resolve', requireRole('ADMIN', 'MOSPI_OFFICER', 'MINISTRY_OFFICER'), async (req, res) => {
  const a = await prisma.alert.update({ where: { id: req.params.id },
    data: { status: 'Resolved', resolvedAt: new Date() } });
  await audit(req, 'ALERT_RESOLVED', 'Alert', a.id, { note: req.body?.note });
  res.json(a);
});

module.exports = router;
