const router = require('express').Router();
const prisma = require('../lib/prisma');
const { requireAuth, projectScope } = require('../middleware/auth');

router.use(requireAuth);

/* Latest prediction per project, scoped to the caller. */
async function scoped(user) {
  const projects = await prisma.project.findMany({
    where: projectScope(user),
    include: { ministry: true, agency: true,
      predictions: { orderBy: { predictionDate: 'desc' }, take: 1 } }
  });
  return projects.map(p => ({ ...p, pred: p.predictions[0] || null }));
}
const countWhere = (rows, key, test) => {
  const m = new Map();
  rows.forEach(r => { if (test && !test(r)) return;
    const k = typeof key === 'function' ? key(r) : r[key];
    m.set(k, (m.get(k) || 0) + 1); });
  return [...m].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
};
const isHigh = r => (r.pred?.overallRiskScore ?? 0) >= 70;

router.get('/summary', async (req, res) => {
  const rows = await scoped(req.user);
  const lv = l => rows.filter(r => r.pred?.riskLevel === l).length;
  const scored = rows.filter(r => r.pred);
  const staleDays = Number(process.env.STALE_DAYS || 30);
  res.json({
    totalProjects: rows.length, highRisk: lv('High'), criticalRisk: lv('Critical'),
    mediumRisk: lv('Medium'), lowRisk: lv('Low'),
    averageRiskScore: scored.length
      ? Math.round(scored.reduce((a, r) => a + r.pred.overallRiskScore, 0) / scored.length) : 0,
    staleProjects: rows.filter(r =>
      (Date.now() - new Date(r.lastUpdatedDate)) / 86400000 > staleDays).length
  });
});
router.get('/risk-by-sector', async (req, res) =>
  res.json(countWhere(await scoped(req.user), 'sector', isHigh)));
router.get('/risk-by-ministry', async (req, res) =>
  res.json(countWhere(await scoped(req.user), r => r.ministry?.name, isHigh)));
router.get('/risk-by-state', async (req, res) =>
  res.json(countWhere(await scoped(req.user), 'state', isHigh)));
router.get('/top-risk-projects', async (req, res) => {
  const rows = (await scoped(req.user)).filter(r => r.pred)
    .sort((a, b) => b.pred.overallRiskScore - a.pred.overallRiskScore)
    .slice(0, Number(req.query.limit) || 10);
  res.json(rows.map(r => ({ id: r.id, projectCode: r.projectCode, projectName: r.projectName,
    ministry: r.ministry?.name, sector: r.sector, state: r.state,
    overallRiskScore: r.pred.overallRiskScore, riskLevel: r.pred.riskLevel,
    delayProbability: r.pred.delayProbability, costOverrunProbability: r.pred.costOverrunProbability })));
});
router.get('/risk-trends', async (req, res) => {
  const ids = (await scoped(req.user)).map(r => r.id);
  const preds = await prisma.riskPrediction.findMany({
    where: { projectId: { in: ids } }, orderBy: { predictionDate: 'asc' } });
  const buckets = new Map();
  preds.forEach(p => {
    const k = new Date(p.predictionDate).toISOString().slice(0, 7);   // YYYY-MM
    const b = buckets.get(k) || { sum: 0, n: 0 };
    b.sum += p.overallRiskScore; b.n++; buckets.set(k, b);
  });
  res.json([...buckets].map(([period, b]) => ({ period, averageRiskScore: Math.round(b.sum / b.n) })));
});

module.exports = router;
