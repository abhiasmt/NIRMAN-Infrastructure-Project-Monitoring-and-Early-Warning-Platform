/* NIRMAN — utilities, icons, reference data, settings, risk engine.
   Loaded first; everything else depends on these globals. */

/* ---------------------------------------------------------------- utils */
const $ = (s, r=document) => r.querySelector(s);
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const sig = z => 1/(1+Math.exp(-z));
const pct = v => (v==null?'—':(Math.round(v*10)/10)+'%');
const cr = v => v==null?'—':'₹'+v.toLocaleString('en-IN',{maximumFractionDigits:0})+' Cr';
const fdate = d => d? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const iso = d => new Date(d).toISOString().slice(0,10);
const monthsBetween = (a,b) => (new Date(b)-new Date(a))/(1000*60*60*24*30.44);
const addMonths = (d,m) => { const x=new Date(d); x.setMonth(x.getMonth()+m); return x; };
const initials = n => n.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
const daysAgo = d => Math.round((TODAY - new Date(d))/86400000);
const TODAY = new Date('2026-09-21T00:00:00Z');

function mulberry32(a){ return function(){ a|=0;a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const store = {
  get(k,f){ try{ const v=localStorage.getItem('nirman:'+k); return v?JSON.parse(v):f; }catch(e){ return f; } },
  set(k,v){ try{ localStorage.setItem('nirman:'+k, JSON.stringify(v)); }catch(e){} }
};

/* --------------------------------------------------------------- icons */
const I = {
  overview:'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  projects:'<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-5h6v5"/><path d="M9 10h.01"/><path d="M15 10h.01"/>',
  alerts:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  interventions:'<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  upload:'<path d="M12 13v8"/><path d="m8 17 4-4 4 4"/><path d="M20 16.6A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.2"/>',
  analytics:'<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="4" width="3" height="14"/>',
  model:'<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v2"/><path d="M15 2v2"/><path d="M9 20v2"/><path d="M15 20v2"/><path d="M2 9h2"/><path d="M2 15h2"/><path d="M20 9h2"/><path d="M20 15h2"/>',
  admin:'<path d="M12.2 2h-.4a2 2 0 0 0-2 2 2 2 0 0 1-3 1.7l-.3-.2a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7 2 2 0 0 1 0 3.4 2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.3-.2a2 2 0 0 1 3 1.7 2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2 2 2 0 0 1 3-1.7l.3.2a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7 2 2 0 0 1 0-3.4 2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.3.2a2 2 0 0 1-3-1.7 2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/>',
  logo:'<path d="M3 22h18"/><path d="M6 18V9"/><path d="M10 18V9"/><path d="M14 18V9"/><path d="M18 18V9"/><path d="m2 9 10-6 10 6"/>',
  menu:'<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
  panel:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
  chev:'<path d="m9 18 6-6-6-6"/>',
  chevDown:'<path d="m6 9 6 6 6-6"/>',
  back:'<path d="m15 18-6-6 6-6"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m21 21-3.9-3.9"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1"/>',
  x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  refresh:'<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
  download:'<path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  plus:'<path d="M12 5v14"/><path d="M5 12h14"/>',
  file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/>',
  trend:'<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'
};
const ic = (n,s=18) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]||''}</svg>`;

/* ----------------------------------------------------------- reference */
const SECTORS = ['Roads & Highways','Railways','Power','Petroleum & Natural Gas','Urban Development',
  'Water Resources','Ports & Shipping','Civil Aviation','Telecom'];
const SUBSECTORS = {
  'Roads & Highways':['National Highway','Expressway','Bridge','Bypass'],
  'Railways':['New Line','Electrification','Doubling','Terminal'],
  'Power':['Thermal','Hydro','Transmission','Solar Park'],
  'Petroleum & Natural Gas':['Pipeline','Refinery Unit','City Gas','Terminal'],
  'Urban Development':['Metro Rail','Water Supply','Sewerage','Smart City'],
  'Water Resources':['Irrigation','Dam','Canal Network','Flood Control'],
  'Ports & Shipping':['Berth','Dredging','Port Connectivity','Terminal'],
  'Civil Aviation':['Terminal Building','Runway','Cargo Complex','ATC Upgrade'],
  'Telecom':['Optical Fibre','Tower Network','Data Centre','Rural Connectivity']
};
const MINISTRY_OF = {
  'Roads & Highways':'Ministry of Road Transport & Highways','Railways':'Ministry of Railways',
  'Power':'Ministry of Power','Petroleum & Natural Gas':'Ministry of Petroleum & Natural Gas',
  'Urban Development':'Ministry of Housing & Urban Affairs','Water Resources':'Ministry of Jal Shakti',
  'Ports & Shipping':'Ministry of Ports, Shipping & Waterways','Civil Aviation':'Ministry of Civil Aviation',
  'Telecom':'Ministry of Communications'
};
const AGENCY_OF = {
  'Roads & Highways':['NHAI','NHIDCL','State PWD Wing'],'Railways':['RVNL','IRCON','Railway Zone Unit'],
  'Power':['NTPC','POWERGRID','NHPC'],'Petroleum & Natural Gas':['GAIL','IOCL','ONGC'],
  'Urban Development':['Metro Rail Corporation','Urban Development Authority','Municipal Corporation'],
  'Water Resources':['WAPCOS','State Irrigation Dept','NWDA'],
  'Ports & Shipping':['Port Authority','Sagarmala Unit','IWAI'],
  'Civil Aviation':['AAI','Airport SPV','AAICLAS'],'Telecom':['BSNL','BBNL','C-DOT']
};
const STATES = ['Assam','West Bengal','Maharashtra','Karnataka','Tamil Nadu','Uttar Pradesh','Bihar',
  'Rajasthan','Gujarat','Odisha','Madhya Pradesh','Kerala','Delhi','Telangana','Andhra Pradesh'];
const DISTRICTS = {Assam:['Kamrup','Dibrugarh','Nagaon','Cachar'],'West Bengal':['Howrah','Nadia','Bardhaman'],
  Maharashtra:['Pune','Nagpur','Thane','Nashik'],Karnataka:['Bengaluru Rural','Belagavi','Mysuru'],
  'Tamil Nadu':['Coimbatore','Madurai','Salem'],'Uttar Pradesh':['Varanasi','Kanpur Nagar','Gorakhpur'],
  Bihar:['Patna','Muzaffarpur','Gaya'],Rajasthan:['Jaipur','Jodhpur','Kota'],Gujarat:['Surat','Rajkot','Kutch'],
  Odisha:['Khordha','Angul','Sundargarh'],'Madhya Pradesh':['Indore','Jabalpur','Bhopal'],
  Kerala:['Ernakulam','Kozhikode','Thrissur'],Delhi:['New Delhi','South West Delhi'],
  Telangana:['Rangareddy','Warangal','Nizamabad'],'Andhra Pradesh':['Visakhapatnam','Guntur','Kurnool']};
const CONTRACTORS = ['Aarvi Infra Ltd','Bharat Constructions','Chetak EPC Pvt Ltd','Deepak Engineering',
  'Eastern Projects Ltd','Garuda Infratech','Himalaya Builders','Indus Civil Works','Konark EPC',
  'Lakshmi Engineering','Meghna Infra','Nirvana Projects Ltd'];
const DELAY_REASONS = ['Land acquisition','Forest/environment clearance','Contractor performance',
  'Funds constraint','Utility shifting','Litigation','Design revision','Adverse weather','Material supply',
  'Right of way'];
const CLEARANCES = ['Approved','Partial','Pending'];
const STATUSES = ['On Schedule','Slight Delay','Delayed','Severely Delayed','Completed'];
const CONTRACT_TYPES = ['EPC','HAM','BOT','Item Rate','Turnkey'];
const FUNDING = ['Budgetary Support','Internal & Extra Budgetary Resources','External Assistance','PPP'];

/* ------------------------------------------------------------- settings */
const DEFAULT_SETTINGS = {
  tLow:40, tHigh:70, tCrit:85, wDelay:0.55, wCost:0.45, staleDays:30, modelVersion:'v1.3.0-demo'
};
let SETTINGS = Object.assign({}, DEFAULT_SETTINGS, store.get('settings', {}));

/* --------------------------------------------------------- risk engine */
function features(p){
  const sanctioned = p.sanctionedCostCr, revised = p.revisedCostCr || sanctioned;
  const costOverrunRatio = (revised - sanctioned)/sanctioned;
  const progressGap = p.expectedProgressPct - p.physicalProgressPct;
  const progressRatio = p.expectedProgressPct ? p.physicalProgressPct/p.expectedProgressPct : 1;
  const plannedDuration = Math.max(1, monthsBetween(p.actualStartDate, p.originalCompletionDate));
  const elapsed = Math.max(0, monthsBetween(p.actualStartDate, TODAY));
  const slippage = elapsed/plannedDuration;
  const expenditureRatio = revised ? p.expenditureIncurredCr/revised : 0;
  const total = p.milestones.length || 1;
  const delayedMilestones = p.milestones.filter(m=>m.status==='Delayed').length;
  const milestoneDelayRatio = delayedMilestones/total;
  const landGap = (100 - p.landAcquisitionPct)/100;
  const clearancePenalty = p.clearanceStatus==='Pending'?1:p.clearanceStatus==='Partial'?0.5:0;
  return {costOverrunRatio, progressGap, progressRatio, plannedDuration, elapsed, slippage,
    expenditureRatio, milestoneDelayRatio, delayedMilestones, totalMilestones:total, landGap,
    clearancePenalty, monthsOfDelay:p.monthsOfDelay||0,
    slipExcess: Math.max(0, slippage-0.9) * (1 - 0.55*clamp(p.physicalProgressPct,0,100)/100)};
}
/* Logistic scorers standing in for the trained XGBoost / RandomForest classifiers
   served by the FastAPI model service. Coefficients act as feature weights. */
const DELAY_W = {bias:-2.35, gap:0.055, slip:2.0, land:1.5, clear:1.0, milestone:0.9, cost:0.8, months:0.05};
const COST_W  = {bias:-1.75, cost:4.5, gap:0.028, land:1.0, clear:0.6, slip:1.0, months:0.03};

function predict(p){
  const f = features(p);
  const gap = Math.max(0, f.progressGap);
  const dParts = {
    'Physical Progress Gap': DELAY_W.gap*gap,
    'Schedule Slippage': DELAY_W.slip*f.slipExcess,
    'Land Acquisition': DELAY_W.land*f.landGap,
    'Clearance Status': DELAY_W.clear*f.clearancePenalty,
    'Milestone Delay': DELAY_W.milestone*f.milestoneDelayRatio,
    'Cost Revision': DELAY_W.cost*Math.max(0,f.costOverrunRatio),
    'Reported Delay': DELAY_W.months*f.monthsOfDelay
  };
  const cParts = {
    'Cost Revision': COST_W.cost*Math.max(0,f.costOverrunRatio),
    'Physical Progress Gap': COST_W.gap*gap,
    'Land Acquisition': COST_W.land*f.landGap,
    'Clearance Status': COST_W.clear*f.clearancePenalty,
    'Schedule Slippage': COST_W.slip*f.slipExcess,
    'Reported Delay': COST_W.months*f.monthsOfDelay
  };
  const dz = DELAY_W.bias + Object.values(dParts).reduce((a,b)=>a+b,0);
  const czz = COST_W.bias + Object.values(cParts).reduce((a,b)=>a+b,0);
  const delayProbability = clamp(sig(dz), 0.01, 0.98);
  const costOverrunProbability = clamp(sig(czz), 0.01, 0.98);
  const overallRiskScore = Math.round(100*(SETTINGS.wDelay*delayProbability + SETTINGS.wCost*costOverrunProbability));
  const riskLevel = levelOf(overallRiskScore);
  const merged = {};
  for (const k in dParts) merged[k] = (merged[k]||0) + dParts[k]*SETTINGS.wDelay;
  for (const k in cParts) merged[k] = (merged[k]||0) + cParts[k]*SETTINGS.wCost;
  const drivers = Object.entries(merged).filter(([,v])=>v>0.05)
    .sort((a,b)=>b[1]-a[1]).slice(0,4)
    .map(([factor,v])=>({factor, contribution:v, impact:v>=0.45?'High':v>=0.2?'Medium':'Low',
      detail:driverDetail(factor,p,f)}));
  return {
    projectId:p.id, modelVersion:SETTINGS.modelVersion, predictionDate:iso(TODAY),
    delayProbability, costOverrunProbability, overallRiskScore, riskLevel,
    estimatedDelayMonthsMin: Math.round(10*delayProbability),
    estimatedDelayMonthsMax: Math.round(15*delayProbability),
    estimatedCostOverrunPctMin: Math.round(27*costOverrunProbability),
    estimatedCostOverrunPctMax: Math.round(38*costOverrunProbability),
    topRiskDrivers: drivers, suggestedReviewFocus: reviewFocus(drivers, p, f), features:f
  };
}
function driverDetail(factor, p, f){
  switch(factor){
    case 'Physical Progress Gap': return `Actual progress is ${p.physicalProgressPct}% while expected progress is ${p.expectedProgressPct}%.`;
    case 'Cost Revision': return `Revised cost is ${Math.round(f.costOverrunRatio*100)}% above sanctioned cost (${cr(p.sanctionedCostCr)} → ${cr(p.revisedCostCr)}).`;
    case 'Land Acquisition': return `Land acquisition is ${p.landAcquisitionPct}% complete.`;
    case 'Clearance Status': return `Statutory clearance status is recorded as ${p.clearanceStatus.toLowerCase()}.`;
    case 'Milestone Delay': return `${f.delayedMilestones} of ${f.totalMilestones} milestones are behind their planned date.`;
    case 'Schedule Slippage': return `${Math.round(f.elapsed)} months elapsed against a planned duration of ${Math.round(f.plannedDuration)} months.`;
    case 'Reported Delay': return `Agency has reported ${f.monthsOfDelay} months of delay against the original completion date.`;
    default: return '';
  }
}
function reviewFocus(drivers, p, f){
  const map = {
    'Land Acquisition':'Expedite land acquisition coordination with the district administration.',
    'Clearance Status':'Escalate pending statutory clearances to the nodal ministry.',
    'Physical Progress Gap':'Review contractor mobilisation and the execution plan for the current quarter.',
    'Cost Revision':'Verify revised cost estimate and the additional funding requirement.',
    'Milestone Delay':'Convene a milestone review meeting with the implementing agency.',
    'Schedule Slippage':'Request a revised completion plan with a month-wise catch-up schedule.',
    'Reported Delay':'Reconcile the reported delay with the approved revised completion date.'
  };
  const out = drivers.map(d=>map[d.factor]).filter(Boolean);
  if (daysAgo(p.lastUpdatedDate) > SETTINGS.staleDays)
    out.push('Obtain an updated progress report — last update is '+daysAgo(p.lastUpdatedDate)+' days old.');
  if (!out.length) out.push('Continue routine quarterly monitoring; no material risk driver detected.');
  return out.slice(0,5);
}
function levelOf(score){
  if (score >= SETTINGS.tCrit) return 'Critical';
  if (score >= SETTINGS.tHigh) return 'High';
  if (score >= SETTINGS.tLow) return 'Medium';
  return 'Low';
}
const LEVEL_CLASS = {Low:'b-low',Medium:'b-med',High:'b-high',Critical:'b-crit'};
const LEVEL_COLOR = {Low:'var(--low)',Medium:'var(--med)',High:'var(--high)',Critical:'var(--crit)'};
const riskBadge = l => `<span class="badge ${LEVEL_CLASS[l]}"><i class="dot"></i>${l}</span>`;
