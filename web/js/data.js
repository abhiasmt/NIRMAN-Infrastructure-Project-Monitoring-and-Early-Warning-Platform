/* NIRMAN — synthetic dataset generation, alert rules, users, app state.
   Depends on core.js. */

/* ------------------------------------------------- synthetic dataset */
const rnd = mulberry32(20260103);
const pick = a => a[Math.floor(rnd()*a.length)];
const between = (a,b) => a + rnd()*(b-a);
const iBetween = (a,b) => Math.round(between(a,b));

function makeMilestones(p, seedRatio){
  const names = ['Award of contract','Land handover','Foundation / substructure','Mid-stage execution',
    'Commissioning & handover'];
  const start = new Date(p.actualStartDate), end = new Date(p.revisedCompletionDate||p.originalCompletionDate);
  const span = Math.max(1, monthsBetween(start, end));
  return names.map((name,i)=>{
    const planned = addMonths(start, Math.round(span*(i+1)/5));
    const share = (i+1)/5*100;
    let status;
    if (p.physicalProgressPct >= share) status = 'Completed';
    else if (planned < TODAY) status = rnd() < seedRatio ? 'Delayed' : 'In Progress';
    else status = 'Planned';
    if (planned < TODAY && p.physicalProgressPct < share && seedRatio > .6) status = 'Delayed';
    return {id:p.id+'-M'+(i+1), name, plannedDate:iso(planned), status,
      actualDate: status==='Completed' ? iso(addMonths(planned, iBetween(-1,2))) : null};
  });
}
function makeUpdates(p){
  const out=[]; let prog = p.physicalProgressPct;
  for (let i=0;i<5;i++){
    const d = addMonths(TODAY, -(i*3) - Math.round(daysAgo(p.lastUpdatedDate)/30));
    out.push({date:iso(d), physicalProgressPct:Math.max(0, Math.round(prog*10)/10),
      expenditureIncurredCr:Math.round(p.expenditureIncurredCr*(prog/Math.max(1,p.physicalProgressPct))),
      remark:i===0?'Latest periodic progress return received from the implementing agency.'
        :pick(['Quarterly progress return filed.','Progress reviewed in ministry meeting.',
               'Revised work programme submitted.','Site inspection report incorporated.'])});
    prog = Math.max(0, prog - between(3, 9));
  }
  return out;
}
function buildProject(i, over){
  const sector = over?.sector || pick(SECTORS);
  const state = over?.state || pick(STATES);
  const sanctioned = over?.sanctionedCostCr ?? Math.round(between(80, 4200));
  // risk archetype: 60% healthy, 22% watch, 18% stressed
  const r = rnd(); const arch = over?.arch || (r<0.60?'healthy':r<0.78?'watch':'stressed');
  const P = {healthy:{gap:[-4,5],cost:[0,.05],land:[92,100],cl:['Approved','Approved','Partial'],dly:[0,2]},
             watch:  {gap:[5,14],cost:[.04,.12],land:[80,96],cl:['Approved','Partial','Partial'],dly:[4,11]},
             stressed:{gap:[16,30],cost:[.12,.30],land:[55,82],cl:['Partial','Pending','Pending'],dly:[8,24]}}[arch];
  const startYear = iBetween(2017, 2023);
  const originalStart = new Date(Date.UTC(startYear, iBetween(0,11), 5));
  const actualStart = addMonths(originalStart, arch==='healthy'?iBetween(0,2):iBetween(1,7));
  const durationMonths = iBetween(28, 72);
  const originalCompletion = addMonths(actualStart, durationMonths);
  const monthsOfDelay = iBetween(P.dly[0], P.dly[1]);
  const revisedCompletion = monthsOfDelay ? addMonths(originalCompletion, monthsOfDelay) : null;
  const elapsed = monthsBetween(actualStart, TODAY);
  let expected = clamp(Math.round((elapsed/durationMonths)*100), 5, 99);
  let physical = clamp(Math.round((expected - between(P.gap[0],P.gap[1]))*10)/10, 2, 100);
  const costRatio = between(P.cost[0], P.cost[1]);
  const revised = Math.round(sanctioned*(1+costRatio));
  const p = {
    id:'P'+String(i).padStart(4,'0'),
    projectCode: over?.projectCode || (sector.slice(0,2).toUpperCase().replace(/[^A-Z]/g,'')+'-'+String(2000+i)),
    projectName: over?.projectName || `${pick(SUBSECTORS[sector])} ${pick(['Package','Phase','Section','Unit'])}-${iBetween(1,9)}, ${pick(DISTRICTS[state])}`,
    ministry: MINISTRY_OF[sector], agency: over?.agency || pick(AGENCY_OF[sector]),
    sector, subSector: pick(SUBSECTORS[sector]), state, district: pick(DISTRICTS[state]),
    sanctionedCostCr: sanctioned, revisedCostCr: revised,
    expenditureIncurredCr: Math.round(revised*clamp(physical/100 + between(-.06,.08),0.02,0.99)),
    fundingType: pick(FUNDING),
    originalStartDate: iso(originalStart), actualStartDate: iso(actualStart),
    originalCompletionDate: iso(originalCompletion),
    revisedCompletionDate: revisedCompletion ? iso(revisedCompletion) : null,
    actualCompletionDate: null,
    physicalProgressPct: physical, expectedProgressPct: expected,
    landAcquisitionPct: over?.landAcquisitionPct ?? iBetween(P.land[0], P.land[1]),
    clearanceStatus: over?.clearanceStatus || pick(P.cl),
    contractType: pick(CONTRACT_TYPES), contractorName: pick(CONTRACTORS),
    delayReasonPrimary: arch==='healthy'?null:pick(DELAY_REASONS),
    delayReasonSecondary: arch==='stressed'?pick(DELAY_REASONS):null,
    monthsOfDelay, dataSource:'Synthetic CUF-like seed',
    lastUpdatedDate: iso(new Date(TODAY - iBetween(2, arch==='stressed'?58:32)*86400000)),
    arch
  };
  Object.assign(p, over||{});
  p.currentStatus = p.physicalProgressPct>=100?'Completed':
    monthsOfDelay>12?'Severely Delayed':monthsOfDelay>5?'Delayed':monthsOfDelay>1?'Slight Delay':'On Schedule';
  p.milestones = makeMilestones(p, arch==='stressed'?.85:arch==='watch'?.45:.12);
  p.updates = makeUpdates(p);
  return p;
}
/* Named demo scenarios (Section 16 of the brief) */
const SCENARIOS = [
  {projectCode:'NH-3001', projectName:'NH Corridor Package-3', sector:'Roads & Highways', state:'Assam',
   district:'Kamrup', agency:'NHAI', sanctionedCostCr:520, revisedCostCr:645, expenditureIncurredCr:238,
   physicalProgressPct:38.5, expectedProgressPct:65, landAcquisitionPct:72, clearanceStatus:'Partial',
   monthsOfDelay:6, arch:'stressed', actualStartDate:'2022-03-15', originalCompletionDate:'2026-03-15',
   revisedCompletionDate:'2026-09-15', originalStartDate:'2022-01-10', contractorName:'Garuda Infratech',
   contractType:'EPC', delayReasonPrimary:'Land acquisition', delayReasonSecondary:'Utility shifting',
   lastUpdatedDate:'2026-08-30'},
  {projectCode:'PW-3002', projectName:'Thermal Plant Unit-2', sector:'Power', state:'Odisha', district:'Angul',
   agency:'NTPC', sanctionedCostCr:950, revisedCostCr:1020, expenditureIncurredCr:596,
   physicalProgressPct:58, expectedProgressPct:65, landAcquisitionPct:90, clearanceStatus:'Approved',
   monthsOfDelay:18, arch:'watch', actualStartDate:'2021-06-01', originalCompletionDate:'2025-12-01',
   revisedCompletionDate:'2027-06-01', originalStartDate:'2021-04-01', contractorName:'Bharat Constructions',
   contractType:'Turnkey', delayReasonPrimary:'Material supply', lastUpdatedDate:'2026-09-05'},
  {projectCode:'RA-3003', projectName:'Railway Electrification Phase-4', sector:'Railways', state:'Maharashtra',
   district:'Nagpur', agency:'IRCON', sanctionedCostCr:410, revisedCostCr:420, expenditureIncurredCr:332,
   physicalProgressPct:82, expectedProgressPct:80, landAcquisitionPct:100, clearanceStatus:'Approved',
   monthsOfDelay:0, arch:'healthy', actualStartDate:'2023-01-20', originalCompletionDate:'2027-01-20',
   revisedCompletionDate:null, originalStartDate:'2023-01-10', contractorName:'Indus Civil Works',
   contractType:'Item Rate', delayReasonPrimary:null, lastUpdatedDate:'2026-09-12'}
];

function buildDataset(){
  const list = SCENARIOS.map((s,i)=>buildProject(i+1, s));
  for (let i=4;i<=400;i++) list.push(buildProject(i));
  list.forEach(p=>{
    p.prediction = predict(p);
    p.riskHistory = riskHistory(p);
  });
  return list;
}
function riskHistory(p){
  const g = mulberry32(parseInt(p.id.slice(1))*77+5);
  const now = p.prediction.overallRiskScore;
  const out=[]; let v = now;
  for (let i=0;i<6;i++){
    out.unshift({period:'Q'+((i%4)+1)+' FY'+(26-Math.floor(i/4)), score:Math.round(clamp(v,3,99))});
    v = v - (p.arch==='stressed'? 7.0 : p.arch==='watch'? 3.0 : -0.8) - (g()-0.5)*5;
  }
  return out;
}

/* ------------------------------------------------------------- alerts */
const ALERT_META = {
  HIGH_RISK:{label:'High risk', sev:'High'}, CRITICAL_RISK:{label:'Critical risk', sev:'Critical'},
  RISK_INCREASE:{label:'Risk increase', sev:'High'}, PROGRESS_SLIPPAGE:{label:'Progress slippage', sev:'High'},
  COST_OVERRUN_RISK:{label:'Cost overrun risk', sev:'Medium'},
  CLEARANCE_PENDING:{label:'Clearance pending', sev:'Medium'},
  MILESTONE_DELAY:{label:'Milestone delay', sev:'Medium'}, STALE_DATA:{label:'Stale data', sev:'Low'}
};
function buildAlerts(projects){
  const out = [];
  const add = (p,type,message) => out.push({
    id:'A'+(out.length+1).toString().padStart(4,'0'), projectId:p.id, projectCode:p.projectCode,
    projectName:p.projectName, ministry:p.ministry, type, severity:ALERT_META[type].sev, message,
    status:'Open', assignedTo:null, createdAt:p.lastUpdatedDate});
  projects.forEach(p=>{
    const pr = p.prediction, f = pr.features;
    if (pr.overallRiskScore >= SETTINGS.tCrit)
      add(p,'CRITICAL_RISK',`Overall risk score is ${pr.overallRiskScore}/100 — critical band.`);
    else if (pr.overallRiskScore >= SETTINGS.tHigh)
      add(p,'HIGH_RISK',`Overall risk score is ${pr.overallRiskScore}/100 — high band.`);
    const prev = p.riskHistory[p.riskHistory.length-2];
    if (prev && pr.overallRiskScore - prev.score >= 8)
      add(p,'RISK_INCREASE',`Risk score rose from ${prev.score} to ${pr.overallRiskScore} since the last reporting period.`);
    if (f.progressGap > 20)
      add(p,'PROGRESS_SLIPPAGE',`Physical progress trails expected progress by ${Math.round(f.progressGap)} percentage points.`);
    if (p.revisedCostCr > p.sanctionedCostCr*1.10)
      add(p,'COST_OVERRUN_RISK',`Revised cost exceeds sanctioned cost by ${Math.round(f.costOverrunRatio*100)}%.`);
    if (p.clearanceStatus === 'Pending')
      add(p,'CLEARANCE_PENDING','Statutory clearance is still pending with the competent authority.');
    if (f.delayedMilestones >= 2)
      add(p,'MILESTONE_DELAY',`${f.delayedMilestones} milestones are behind their planned dates.`);
    if (daysAgo(p.lastUpdatedDate) > SETTINGS.staleDays)
      add(p,'STALE_DATA',`No progress update received for ${daysAgo(p.lastUpdatedDate)} days.`);
  });
  return out;
}
const INTERVENTION_TYPES = ['Land Acquisition Review','Clearance Escalation','Contractor Performance Review',
  'Funding Review','Milestone Review Meeting','Field Inspection','Request Revised Completion Plan'];
function seedInterventions(projects){
  const risky = projects.filter(p=>p.prediction.overallRiskScore>=70).slice(0,14);
  return risky.map((p,i)=>({
    id:'IV'+String(i+1).padStart(3,'0'), projectId:p.id, projectCode:p.projectCode, projectName:p.projectName,
    type:INTERVENTION_TYPES[i%INTERVENTION_TYPES.length],
    description:'Review initiated by IPMD following the latest early-warning alert.',
    assignedAuthority:p.agency, dueDate:iso(addMonths(TODAY, 1+(i%3))),
    status:['Open','In Progress','Completed'][i%3], outcomeNotes:i%3===2?'Action points recorded and closed.':'',
    createdAt:iso(addMonths(TODAY,-1)), createdBy:'MoSPI Officer'}));
}

/* -------------------------------------------------------------- users */
const ROLE_NAV = {
  ADMIN:['overview','projects','alerts','interventions','upload','analytics','model','admin'],
  MOSPI_OFFICER:['overview','projects','alerts','interventions','analytics'],
  MINISTRY_OFFICER:['overview','projects','alerts','interventions'],
  AGENCY_OFFICER:['projects','alerts','upload'],
  ANALYST:['overview','analytics','model'],
  VIEWER:['overview','projects']
};
const ROLE_LABEL = {ADMIN:'Administrator',MOSPI_OFFICER:'MoSPI Officer',MINISTRY_OFFICER:'Ministry Officer',
  AGENCY_OFFICER:'Agency Officer',ANALYST:'Analyst',VIEWER:'Viewer'};
const USERS = [
  {email:'admin@nirman.demo', name:'R. Anand', role:'ADMIN', org:'MoSPI — IPMD'},
  {email:'mospi@nirman.demo', name:'S. Venkatesh', role:'MOSPI_OFFICER', org:'MoSPI — IPMD'},
  {email:'ministry@morth.demo', name:'K. Deshmukh', role:'MINISTRY_OFFICER', org:'Ministry of Road Transport & Highways',
   ministry:'Ministry of Road Transport & Highways'},
  {email:'agency@nhai.demo', name:'P. Barua', role:'AGENCY_OFFICER', org:'NHAI', agency:'NHAI'},
  {email:'analyst@nirman.demo', name:'M. Iyer', role:'ANALYST', org:'MoSPI — Data Unit'}
];
const NAV_META = {
  overview:{label:'Overview', icon:'overview'}, projects:{label:'Projects', icon:'projects'},
  alerts:{label:'Risk Alerts', icon:'alerts'}, interventions:{label:'Interventions', icon:'interventions'},
  upload:{label:'Data Upload', icon:'upload'}, analytics:{label:'Analytics', icon:'analytics'},
  model:{label:'Model Insights', icon:'model'}, admin:{label:'Admin Settings', icon:'admin'}
};

/* --------------------------------------------------------------- state */
const S = {
  user:null, route:'overview', projectId:null, tab:'overview',
  projects:[], alerts:[], interventions:[], uploads:[],
  collapsed:false, drawer:false, menu:false, modal:null, toast:null,
  filters:{q:'',ministry:'',sector:'',state:'',agency:'',level:'',status:'',stale:'',minCost:''},
  sort:{key:'risk', dir:'desc'},
  alertFilters:{severity:'',type:'',status:'',ministry:''},
  upload:null
};
function recomputeAll(){
  S.projects.forEach(p=>{ p.prediction = predict(p); });
  const prevState = {};
  S.alerts.forEach(a=>{ prevState[a.projectId+'|'+a.type] = {status:a.status, assignedTo:a.assignedTo}; });
  S.alerts = buildAlerts(S.projects).map(a=>{
    const k = prevState[a.projectId+'|'+a.type];
    return k ? Object.assign(a, k) : a;
  });
}
function initData(){
  S.projects = buildDataset();
  S.alerts = buildAlerts(S.projects);
  S.interventions = store.get('interventions', null) || seedInterventions(S.projects);
  S.uploads = store.get('uploads', []);
  const savedAlerts = store.get('alertStates', {});
  S.alerts.forEach(a=>{ const k = savedAlerts[a.projectId+'|'+a.type]; if(k) Object.assign(a,k); });
}
function persist(){
  store.set('interventions', S.interventions);
  store.set('uploads', S.uploads);
  const m={}; S.alerts.forEach(a=>{ if(a.status!=='Open'||a.assignedTo) m[a.projectId+'|'+a.type]={status:a.status,assignedTo:a.assignedTo}; });
  store.set('alertStates', m);
  store.set('settings', SETTINGS);
}
/* Scope data to the signed-in role */
function visibleProjects(){
  const u = S.user;
  if (!u) return [];
  if (u.role==='MINISTRY_OFFICER') return S.projects.filter(p=>p.ministry===u.ministry);
  if (u.role==='AGENCY_OFFICER') return S.projects.filter(p=>p.agency===u.agency);
  return S.projects;
}
function visibleAlerts(){
  const ids = new Set(visibleProjects().map(p=>p.id));
  return S.alerts.filter(a=>ids.has(a.projectId));
}
const can = what => {
  const r = S.user?.role;
  if (what==='intervene') return ['ADMIN','MOSPI_OFFICER','MINISTRY_OFFICER'].includes(r);
  if (what==='alertAction') return ['ADMIN','MOSPI_OFFICER','MINISTRY_OFFICER'].includes(r);
  if (what==='upload') return ['ADMIN','AGENCY_OFFICER'].includes(r);
  if (what==='settings') return r==='ADMIN';
  return false;
};
