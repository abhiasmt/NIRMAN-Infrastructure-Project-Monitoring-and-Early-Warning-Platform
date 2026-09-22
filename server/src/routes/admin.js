/* Admin-only: thresholds, model registry, users, audit trail.
   Thresholds live in the ModelRegistry-adjacent settings table in a fuller build;
   here they are process-level and returned so the UI can render them. */
const router = require('express').Router();
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');
const { THRESHOLDS, WEIGHTS } = require('../lib/riskService');
const audit = require('../lib/audit');

router.use(requireAuth, requireRole('ADMIN', 'ANALYST'));

router.get('/settings', (_req, res) => res.json({
  thresholds: THRESHOLDS, weights: WEIGHTS,
  staleDays: Number(process.env.STALE_DAYS || 30)
}));

router.patch('/settings', requireRole('ADMIN'), async (req, res) => {
  const { low, high, critical, delayWeight, costWeight, staleDays } = req.body;
  if (low != null) THRESHOLDS.low = low;
  if (high != null) THRESHOLDS.high = high;
  if (critical != null) THRESHOLDS.critical = critical;
  if (delayWeight != null) { WEIGHTS.delay = delayWeight; WEIGHTS.cost = 1 - delayWeight; }
  if (costWeight != null) { WEIGHTS.cost = costWeight; WEIGHTS.delay = 1 - costWeight; }
  if (staleDays != null) process.env.STALE_DAYS = String(staleDays);
  await audit(req, 'SETTINGS_UPDATED', 'Settings', null, req.body);
  res.json({ thresholds: THRESHOLDS, weights: WEIGHTS, staleDays: Number(process.env.STALE_DAYS || 30) });
});

router.get('/users', async (_req, res) => res.json(await prisma.user.findMany({
  select: { id: true, email: true, name: true, role: true, isActive: true,
    ministry: { select: { name: true } }, agency: { select: { name: true } } },
  orderBy: { createdAt: 'asc' } })));

router.get('/models', async (_req, res) =>
  res.json(await prisma.modelRegistry.findMany({ orderBy: { trainedAt: 'desc' } })));

router.get('/audit', async (req, res) => res.json(await prisma.auditLog.findMany({
  orderBy: { createdAt: 'desc' }, take: Number(req.query.limit) || 100,
  include: { user: { select: { name: true, role: true } } } })));

module.exports = router;
