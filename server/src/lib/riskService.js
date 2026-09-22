/* Bridge between the API and the Python ML service.
   If the ML service is unreachable, a deterministic local fallback keeps the
   demo alive — the same feature weights the service uses, computed in Node. */
const axios = require('axios');
const prisma = require('./prisma');

const ML = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const THRESHOLDS = { low: 40, high: 70, critical: 85 };
const WEIGHTS = { delay: 0.55, cost: 0.45 };

const sig = z => 1 / (1 + Math.exp(-z));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const months = (a, b) => (new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24 * 30.44);

function buildFeatures(p) {
  const revised = p.revisedCostCr || p.sanctionedCostCr;
  const total = p.milestones?.length || 1;
  const delayed = (p.milestones || []).filter(m => m.status === 'Delayed').length;
  const planned = Math.max(1, months(p.actualStartDate || p.originalStartDate, p.originalCompletionDate));
  const elapsed = Math.max(0, months(p.actualStartDate || p.originalStartDate, new Date()));
  const slippage = elapsed / planned;
  return {
    cost_overrun_ratio: (revised - p.sanctionedCostCr) / p.sanctionedCostCr,
    progress_gap: p.expectedProgressPct - p.physicalProgressPct,
    progress_vs_time_ratio: p.expectedProgressPct ? p.physicalProgressPct / p.expectedProgressPct : 1,
    planned_duration_months: planned,
    elapsed_months: elapsed,
    schedule_slippage_ratio: slippage,
    slip_excess: Math.max(0, slippage - 0.9) * (1 - 0.55 * clamp(p.physicalProgressPct, 0, 100) / 100),
    expenditure_ratio: revised ? p.expenditureIncurredCr / revised : 0,
    milestone_delay_ratio: delayed / total,
    delayed_milestones: delayed,
    total_milestones: total,
    land_gap: (100 - p.landAcquisitionPct) / 100,
    clearance_penalty: p.clearanceStatus === 'Pending' ? 1 : p.clearanceStatus === 'Partial' ? 0.5 : 0,
    months_of_delay: p.monthsOfDelay || 0
  };
}

const DELAY_W = { bias: -2.35, gap: 0.055, slip: 2.0, land: 1.5, clear: 1.0, milestone: 0.9, cost: 0.8, months: 0.05 };
const COST_W  = { bias: -1.75, cost: 4.5, gap: 0.028, land: 1.0, clear: 0.6, slip: 1.0, months: 0.03 };

function localPredict(p) {
  const f = buildFeatures(p);
  const gap = Math.max(0, f.progress_gap);
  const dz = DELAY_W.bias + DELAY_W.gap * gap + DELAY_W.slip * f.slip_excess + DELAY_W.land * f.land_gap
    + DELAY_W.clear * f.clearance_penalty + DELAY_W.milestone * f.milestone_delay_ratio
    + DELAY_W.cost * Math.max(0, f.cost_overrun_ratio) + DELAY_W.months * f.months_of_delay;
  const cz = COST_W.bias + COST_W.cost * Math.max(0, f.cost_overrun_ratio) + COST_W.gap * gap
    + COST_W.land * f.land_gap + COST_W.clear * f.clearance_penalty + COST_W.slip * f.slip_excess
    + COST_W.months * f.months_of_delay;
  const delay = clamp(sig(dz), 0.01, 0.98), cost = clamp(sig(cz), 0.01, 0.98);
  const score = Math.round(100 * (WEIGHTS.delay * delay + WEIGHTS.cost * cost));
  return {
    model_version: 'local-fallback-v1',
    delay_probability: delay, cost_overrun_probability: cost,
    overall_risk_score: score, risk_level: levelOf(score),
    estimated_delay_months_min: Math.round(10 * delay), estimated_delay_months_max: Math.round(15 * delay),
    estimated_cost_overrun_pct_min: Math.round(27 * cost), estimated_cost_overrun_pct_max: Math.round(38 * cost),
    top_risk_drivers: driversFrom(f, p), suggested_review_focus: focusFrom(f)
  };
}

function levelOf(score) {
  if (score >= THRESHOLDS.critical) return 'Critical';
  if (score >= THRESHOLDS.high) return 'High';
  if (score >= THRESHOLDS.low) return 'Medium';
  return 'Low';
}
function driversFrom(f, p) {
  const out = [];
  if (f.progress_gap > 5) out.push({ factor: 'Physical Progress Gap',
    detail: `Actual progress is ${p.physicalProgressPct}% while expected progress is ${p.expectedProgressPct}%.`,
    impact: f.progress_gap > 18 ? 'High' : 'Medium' });
  if (f.cost_overrun_ratio > 0.05) out.push({ factor: 'Cost Revision',
    detail: `Revised cost is ${Math.round(f.cost_overrun_ratio * 100)}% above sanctioned cost.`,
    impact: f.cost_overrun_ratio > 0.15 ? 'High' : 'Medium' });
  if (f.land_gap > 0.08) out.push({ factor: 'Land Acquisition',
    detail: `Land acquisition is ${p.landAcquisitionPct}% complete.`,
    impact: f.land_gap > 0.25 ? 'High' : 'Medium' });
  if (f.clearance_penalty > 0) out.push({ factor: 'Clearance Status',
    detail: `Statutory clearance status is ${p.clearanceStatus.toLowerCase()}.`,
    impact: f.clearance_penalty === 1 ? 'High' : 'Medium' });
  if (f.delayed_milestones > 0) out.push({ factor: 'Milestone Delay',
    detail: `${f.delayed_milestones} of ${f.total_milestones} milestones are behind their planned dates.`,
    impact: f.milestone_delay_ratio > 0.4 ? 'High' : 'Medium' });
  return out.slice(0, 4);
}
function focusFrom(f) {
  const out = [];
  if (f.land_gap > 0.08) out.push('Expedite land acquisition coordination with the district administration.');
  if (f.clearance_penalty > 0) out.push('Escalate pending statutory clearances to the nodal ministry.');
  if (f.progress_gap > 10) out.push('Review contractor mobilisation and the execution plan.');
  if (f.cost_overrun_ratio > 0.1) out.push('Verify the revised cost estimate and additional funding requirement.');
  if (f.milestone_delay_ratio > 0.2) out.push('Convene a milestone review meeting with the implementing agency.');
  return out.length ? out : ['Continue routine quarterly monitoring.'];
}

/* Call the FastAPI model service; fall back locally on any failure. */
async function scoreProject(project) {
  try {
    const { data } = await axios.post(`${ML}/predict`, { project: serialise(project) }, { timeout: 5000 });
    return data;
  } catch (e) {
    console.warn(`[ml] service unavailable (${e.message}) — using local fallback`);
    return localPredict(project);
  }
}
async function scoreBatch(projects) {
  try {
    const { data } = await axios.post(`${ML}/predict/batch`,
      { projects: projects.map(serialise) }, { timeout: 30000 });
    return data.predictions;
  } catch (e) {
    console.warn(`[ml] batch unavailable (${e.message}) — using local fallback`);
    return projects.map(localPredict);
  }
}
const serialise = p => ({
  project_code: p.projectCode, sanctioned_cost_cr: p.sanctionedCostCr, revised_cost_cr: p.revisedCostCr,
  expenditure_incurred_cr: p.expenditureIncurredCr, physical_progress_pct: p.physicalProgressPct,
  expected_progress_pct: p.expectedProgressPct, land_acquisition_pct: p.landAcquisitionPct,
  clearance_status: p.clearanceStatus, months_of_delay: p.monthsOfDelay,
  actual_start_date: p.actualStartDate, original_completion_date: p.originalCompletionDate,
  milestones: (p.milestones || []).map(m => ({ status: m.status }))
});

/* Persist a prediction and raise any alerts its rules trigger. */
async function savePrediction(projectId, pred) {
  const row = await prisma.riskPrediction.create({
    data: {
      projectId, modelVersion: pred.model_version, delayProbability: pred.delay_probability,
      costOverrunProbability: pred.cost_overrun_probability,
      estimatedDelayMonthsMin: pred.estimated_delay_months_min,
      estimatedDelayMonthsMax: pred.estimated_delay_months_max,
      estimatedCostOverrunPctMin: pred.estimated_cost_overrun_pct_min,
      estimatedCostOverrunPctMax: pred.estimated_cost_overrun_pct_max,
      overallRiskScore: pred.overall_risk_score, riskLevel: pred.risk_level,
      topRiskDriversJson: pred.top_risk_drivers, suggestedReviewFocusJson: pred.suggested_review_focus
    }
  });
  await generateAlerts(projectId, pred);
  return row;
}

/* Section 13 alert rules. */
async function generateAlerts(projectId, pred) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { milestones: true } });
  const f = buildFeatures(project);
  const previous = await prisma.riskPrediction.findMany({
    where: { projectId }, orderBy: { predictionDate: 'desc' }, take: 2
  });
  const prior = previous[1];
  const staleDays = Number(process.env.STALE_DAYS || 30);
  const daysSince = (Date.now() - new Date(project.lastUpdatedDate)) / 86400000;

  const rules = [];
  if (pred.overall_risk_score >= THRESHOLDS.critical)
    rules.push(['CRITICAL_RISK', 'Critical', `Overall risk score is ${pred.overall_risk_score}/100.`]);
  else if (pred.overall_risk_score >= THRESHOLDS.high)
    rules.push(['HIGH_RISK', 'High', `Overall risk score is ${pred.overall_risk_score}/100.`]);
  if (prior && pred.delay_probability - prior.delayProbability >= 0.15)
    rules.push(['RISK_INCREASE', 'High', 'Delay probability rose by more than 15 percentage points.']);
  if (f.progress_gap > 20)
    rules.push(['PROGRESS_SLIPPAGE', 'High', `Progress trails expectation by ${Math.round(f.progress_gap)} points.`]);
  if (project.revisedCostCr > project.sanctionedCostCr * 1.1)
    rules.push(['COST_OVERRUN_RISK', 'Medium', `Revised cost exceeds sanctioned cost by ${Math.round(f.cost_overrun_ratio * 100)}%.`]);
  if (project.clearanceStatus === 'Pending')
    rules.push(['CLEARANCE_PENDING', 'Medium', 'Statutory clearance is pending.']);
  if (f.delayed_milestones >= 2)
    rules.push(['MILESTONE_DELAY', 'Medium', `${f.delayed_milestones} milestones are delayed.`]);
  if (daysSince > staleDays)
    rules.push(['STALE_DATA', 'Low', `No progress update for ${Math.round(daysSince)} days.`]);

  for (const [type, severity, message] of rules) {
    // Don't duplicate an alert of the same type that is still open.
    const open = await prisma.alert.findFirst({ where: { projectId, type, status: 'Open' } });
    if (open) continue;
    await prisma.alert.create({ data: { projectId, type, severity, message } });
  }
}

async function refreshAllPredictions() {
  const projects = await prisma.project.findMany({ include: { milestones: true } });
  const preds = await scoreBatch(projects);
  for (let i = 0; i < projects.length; i++) await savePrediction(projects[i].id, preds[i]);
  return projects.length;
}

module.exports = { scoreProject, scoreBatch, savePrediction, refreshAllPredictions,
  generateAlerts, buildFeatures, localPredict, levelOf, THRESHOLDS, WEIGHTS };
