const router = require('express').Router();
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');
const { scoreProject, scoreBatch, savePrediction, refreshAllPredictions } = require('../lib/riskService');
const audit = require('../lib/audit');

router.use(requireAuth);

router.post('/project/:id', requireRole('ADMIN', 'MOSPI_OFFICER', 'ANALYST', 'MINISTRY_OFFICER'), async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id }, include: { milestones: true } });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const prediction = await savePrediction(project.id, await scoreProject(project));
  await audit(req, 'PREDICTION_REFRESHED', 'Project', project.id);
  res.status(201).json(prediction);
});

router.get('/project/:id/latest', async (req, res) => {
  const p = await prisma.riskPrediction.findFirst({
    where: { projectId: req.params.id }, orderBy: { predictionDate: 'desc' } });
  if (!p) return res.status(404).json({ error: 'No prediction recorded for this project yet' });
  res.json(p);
});

router.get('/project/:id/history', async (req, res) =>
  res.json(await prisma.riskPrediction.findMany({
    where: { projectId: req.params.id }, orderBy: { predictionDate: 'asc' } })));

router.post('/batch', requireRole('ADMIN', 'ANALYST', 'MOSPI_OFFICER'), async (req, res) => {
  const ids = req.body.projectIds || [];
  const projects = await prisma.project.findMany({
    where: { id: { in: ids } }, include: { milestones: true } });
  const preds = await scoreBatch(projects);
  const saved = [];
  for (let i = 0; i < projects.length; i++) saved.push(await savePrediction(projects[i].id, preds[i]));
  res.json({ scored: saved.length, predictions: saved });
});

router.post('/refresh-all', requireRole('ADMIN', 'ANALYST'), async (req, res) => {
  const count = await refreshAllPredictions();
  await audit(req, 'PREDICTIONS_REFRESHED_ALL', 'Project', null, { count });
  res.json({ message: `Refreshed ${count} projects`, count });
});

module.exports = router;
