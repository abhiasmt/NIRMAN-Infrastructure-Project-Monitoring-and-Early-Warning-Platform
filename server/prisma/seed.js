/* NIRMAN seed — loads data/synthetic_projects.csv into PostgreSQL,
   creates demo users, milestones, update history, and an initial prediction
   (plus the alerts those predictions trigger) for every project.

   Run:  npm run seed          (after `npx prisma migrate dev`)
*/
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { parse } = require('csv-parse/sync');
const { PrismaClient } = require('@prisma/client');
const { localPredict } = require('../src/lib/riskService');

const prisma = new PrismaClient();
const CSV = path.resolve(__dirname, '../../data/synthetic_projects.csv');

const DEMO_USERS = [
  { email: 'admin@nirman.demo',    name: 'R. Anand',     role: 'ADMIN' },
  { email: 'mospi@nirman.demo',    name: 'S. Venkatesh', role: 'MOSPI_OFFICER' },
  { email: 'ministry@morth.demo',  name: 'K. Deshmukh',  role: 'MINISTRY_OFFICER',
    ministry: 'Ministry of Road Transport & Highways' },
  { email: 'agency@nhai.demo',     name: 'P. Barua',     role: 'AGENCY_OFFICER', agency: 'NHAI' },
  { email: 'analyst@nirman.demo',  name: 'M. Iyer',      role: 'ANALYST' }
];
const DEMO_PASSWORD = 'Demo@123';

const d = v => (v ? new Date(v) : null);
const n = v => (v === '' || v == null ? null : Number(v));

function milestonesFor(p) {
  const names = ['Award of contract', 'Land handover', 'Foundation / substructure',
    'Mid-stage execution', 'Commissioning & handover'];
  const start = new Date(p.actualStartDate || p.originalStartDate);
  const end = new Date(p.revisedCompletionDate || p.originalCompletionDate);
  const span = Math.max(1, (end - start) / (1000 * 60 * 60 * 24 * 30.44));
  return names.map((name, i) => {
    const planned = new Date(start); planned.setMonth(planned.getMonth() + Math.round(span * (i + 1) / 5));
    const share = (i + 1) / 5 * 100;
    let status = 'Planned';
    if (p.physicalProgressPct >= share) status = 'Completed';
    else if (planned < new Date()) status = p.expectedProgressPct - p.physicalProgressPct > 12 ? 'Delayed' : 'InProgress';
    return { name, plannedDate: planned, status,
      actualDate: status === 'Completed' ? planned : null };
  });
}

async function main() {
  if (!fs.existsSync(CSV)) throw new Error(`Dataset not found at ${CSV}`);
  console.log('Clearing existing data…');
  await prisma.$transaction([
    prisma.auditLog.deleteMany(), prisma.uploadLog.deleteMany(), prisma.alert.deleteMany(),
    prisma.intervention.deleteMany(), prisma.riskPrediction.deleteMany(),
    prisma.projectUpdate.deleteMany(), prisma.milestone.deleteMany(),
    prisma.project.deleteMany(), prisma.user.deleteMany(),
    prisma.implementingAgency.deleteMany(), prisma.ministry.deleteMany(),
    prisma.modelRegistry.deleteMany()
  ]);

  const rows = parse(fs.readFileSync(CSV), { columns: true, skip_empty_lines: true, trim: true });
  console.log(`Read ${rows.length} synthetic projects.`);

  // Ministries and agencies
  const ministryIds = {}, agencyIds = {};
  for (const name of [...new Set(rows.map(r => r.ministry))]) {
    const m = await prisma.ministry.create({ data: { name, shortName: name.replace('Ministry of ', '') } });
    ministryIds[name] = m.id;
  }
  for (const r of rows) {
    if (agencyIds[r.implementing_agency]) continue;
    const a = await prisma.implementingAgency.create({
      data: { name: r.implementing_agency, ministryId: ministryIds[r.ministry] } });
    agencyIds[r.implementing_agency] = a.id;
  }
  console.log(`Created ${Object.keys(ministryIds).length} ministries, ${Object.keys(agencyIds).length} agencies.`);

  // Users
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  for (const u of DEMO_USERS) {
    await prisma.user.create({ data: {
      email: u.email, name: u.name, role: u.role, passwordHash,
      ministryId: u.ministry ? ministryIds[u.ministry] : null,
      agencyId: u.agency ? agencyIds[u.agency] : null } });
  }
  console.log(`Created ${DEMO_USERS.length} demo users (password ${DEMO_PASSWORD}).`);

  // Model registry entry
  await prisma.modelRegistry.create({ data: {
    version: 'v1.3.0-demo', algorithm: 'XGBoost (RandomForest fallback)', isActive: true,
    metricsJson: { delay_roc_auc: 0.89, cost_roc_auc: 0.84, precision: 0.82, recall: 0.79 },
    featureImportanceJson: { progress_gap: 0.24, cost_overrun_ratio: 0.21, schedule_slippage: 0.16,
      land_acquisition: 0.13, milestone_delay_ratio: 0.11, clearance_status: 0.09, months_of_delay: 0.06 } } });

  // Projects
  let count = 0;
  for (const r of rows) {
    const project = await prisma.project.create({ data: {
      projectCode: r.project_code, projectName: r.project_name,
      ministryId: ministryIds[r.ministry], agencyId: agencyIds[r.implementing_agency],
      sector: r.sector, subSector: r.sub_sector, state: r.state, district: r.district,
      sanctionedCostCr: n(r.sanctioned_cost_cr), revisedCostCr: n(r.revised_cost_cr),
      expenditureIncurredCr: n(r.expenditure_incurred_cr) || 0, fundingType: r.funding_type,
      originalStartDate: d(r.original_start_date), actualStartDate: d(r.actual_start_date),
      originalCompletionDate: d(r.original_completion_date),
      revisedCompletionDate: d(r.revised_completion_date),
      actualCompletionDate: d(r.actual_completion_date),
      physicalProgressPct: n(r.physical_progress_pct), expectedProgressPct: n(r.expected_progress_pct),
      currentStatus: r.current_status, landAcquisitionPct: n(r.land_acquisition_pct),
      clearanceStatus: r.clearance_status || 'Approved', contractType: r.contract_type,
      contractorName: r.contractor_name, delayReasonPrimary: r.delay_reason_primary || null,
      delayReasonSecondary: r.delay_reason_secondary || null,
      monthsOfDelay: Number(r.months_of_delay) || 0, lastUpdatedDate: d(r.last_updated_date) } });

    await prisma.milestone.createMany({
      data: milestonesFor(project).map(m => ({ ...m, projectId: project.id })) });

    // Five quarterly returns working backwards from the current progress
    let prog = project.physicalProgressPct;
    for (let i = 0; i < 5; i++) {
      const date = new Date(project.lastUpdatedDate);
      date.setMonth(date.getMonth() - i * 3);
      await prisma.projectUpdate.create({ data: {
        projectId: project.id, reportingDate: date,
        physicalProgressPct: Math.max(0, Math.round(prog * 10) / 10),
        expenditureIncurredCr: Math.round(project.expenditureIncurredCr * (prog / Math.max(1, project.physicalProgressPct))),
        remark: i === 0 ? 'Latest periodic return from the implementing agency.' : 'Quarterly progress return.',
        submittedBy: 'Seed' } });
      prog = Math.max(0, prog - 6);
    }

    // Initial prediction + alerts, using the local scorer (no ML service needed to seed)
    const withMilestones = await prisma.project.findUnique({
      where: { id: project.id }, include: { milestones: true } });
    const pred = localPredict(withMilestones);
    await prisma.riskPrediction.create({ data: {
      projectId: project.id, modelVersion: 'v1.3.0-demo',
      delayProbability: pred.delay_probability, costOverrunProbability: pred.cost_overrun_probability,
      estimatedDelayMonthsMin: pred.estimated_delay_months_min,
      estimatedDelayMonthsMax: pred.estimated_delay_months_max,
      estimatedCostOverrunPctMin: pred.estimated_cost_overrun_pct_min,
      estimatedCostOverrunPctMax: pred.estimated_cost_overrun_pct_max,
      overallRiskScore: pred.overall_risk_score, riskLevel: pred.risk_level,
      topRiskDriversJson: pred.top_risk_drivers, suggestedReviewFocusJson: pred.suggested_review_focus } });

    const alerts = [];
    if (pred.overall_risk_score >= 85) alerts.push(['CRITICAL_RISK', 'Critical', `Overall risk score is ${pred.overall_risk_score}/100.`]);
    else if (pred.overall_risk_score >= 70) alerts.push(['HIGH_RISK', 'High', `Overall risk score is ${pred.overall_risk_score}/100.`]);
    if (project.expectedProgressPct - project.physicalProgressPct > 20)
      alerts.push(['PROGRESS_SLIPPAGE', 'High', 'Physical progress trails expectation by over 20 points.']);
    if (project.revisedCostCr > project.sanctionedCostCr * 1.1)
      alerts.push(['COST_OVERRUN_RISK', 'Medium', 'Revised cost exceeds sanctioned cost by more than 10%.']);
    if (project.clearanceStatus === 'Pending')
      alerts.push(['CLEARANCE_PENDING', 'Medium', 'Statutory clearance is pending.']);
    if ((Date.now() - project.lastUpdatedDate) / 86400000 > 30)
      alerts.push(['STALE_DATA', 'Low', 'No progress update in over 30 days.']);
    if (alerts.length) await prisma.alert.createMany({
      data: alerts.map(([type, severity, message]) => ({ projectId: project.id, type, severity, message })) });

    if (++count % 50 === 0) console.log(`  …${count} projects seeded`);
  }

  // A few interventions on the riskiest projects
  const risky = await prisma.riskPrediction.findMany({
    orderBy: { overallRiskScore: 'desc' }, take: 12, include: { project: true } });
  const officer = await prisma.user.findUnique({ where: { email: 'mospi@nirman.demo' } });
  const types = ['Land Acquisition Review', 'Clearance Escalation', 'Contractor Performance Review',
    'Funding Review', 'Milestone Review Meeting', 'Field Inspection'];
  for (let i = 0; i < risky.length; i++) {
    const due = new Date(); due.setMonth(due.getMonth() + 1 + (i % 3));
    await prisma.intervention.create({ data: {
      projectId: risky[i].projectId, type: types[i % types.length],
      description: 'Review initiated by IPMD following the latest early-warning alert.',
      assignedAuthority: risky[i].project.contractorName || 'Implementing agency',
      dueDate: due, status: ['Open', 'InProgress', 'Completed'][i % 3], createdById: officer.id } });
  }

  const summary = await prisma.riskPrediction.groupBy({ by: ['riskLevel'], _count: true });
  console.log('\nSeed complete.');
  console.log('Risk distribution:', summary.map(s => `${s.riskLevel} ${s._count}`).join(', '));
  console.log(`\nDemo login: any of ${DEMO_USERS.map(u => u.email).join(', ')} / ${DEMO_PASSWORD}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
