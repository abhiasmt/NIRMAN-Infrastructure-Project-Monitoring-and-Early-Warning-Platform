/* NIRMAN — charts and screen renderers (one function per screen).
   Depends on core.js and data.js. */

/* -------------------------------------------------------------- charts */
function hbars(rows, opt={}){
  if (!rows.length) return '<div class="empty">No data for the current filters.</div>';
  const max = Math.max(...rows.map(r=>r.value), 1);
  return rows.map(r=>`<div class="bar-row">
    <div class="bar-label" title="${esc(r.label)}">${esc(r.label)}</div>
    <div class="bar-track"><i class="bar-fill" style="width:${(r.value/max*100).toFixed(1)}%;background:${r.color||'var(--ink-2)'}"></i></div>
    <div class="bar-val">${opt.fmt?opt.fmt(r.value):r.value}</div></div>`).join('');
}
function donut(rows){
  const total = rows.reduce((a,r)=>a+r.value,0) || 1;
  const R=52, C=2*Math.PI*R; let off=0;
  const arcs = rows.map(r=>{
    const len = r.value/total*C;
    const s = `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${r.color}" stroke-width="17"
      stroke-dasharray="${len.toFixed(2)} ${(C-len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"
      transform="rotate(-90 70 70)"><title>${esc(r.label)}: ${r.value}</title></circle>`;
    off += len; return s;
  }).join('');
  return `<div style="display:flex;align-items:center;gap:22px;flex-wrap:wrap">
    <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="Risk distribution">
      ${arcs}<text x="70" y="67" text-anchor="middle" font-size="24" font-weight="700" fill="#111827">${total}</text>
      <text x="70" y="85" text-anchor="middle" font-size="10" fill="#6B7280">projects</text></svg>
    <div style="flex:1;min-width:150px">${rows.map(r=>`<div class="bar-row" style="grid-template-columns:14px 1fr 54px">
      <i class="dot" style="background:${r.color};width:9px;height:9px"></i>
      <div class="bar-label">${esc(r.label)}</div>
      <div class="bar-val">${r.value} <span class="muted" style="font-weight:400">${Math.round(r.value/total*100)}%</span></div>
    </div>`).join('')}</div></div>`;
}
function lineChart(points, opt={}){
  if (points.length<2) return '<div class="empty">Not enough reporting periods.</div>';
  const W=560,H=190,pad={l:34,r:12,t:14,b:26};
  const ys = points.map(p=>p.value);
  const min = opt.min ?? Math.max(0, Math.floor((Math.min(...ys)-6)/10)*10);
  const max = opt.max ?? Math.min(100, Math.ceil((Math.max(...ys)+6)/10)*10);
  const x = i => pad.l + i*(W-pad.l-pad.r)/(points.length-1);
  const y = v => pad.t + (1-(v-min)/Math.max(1,max-min))*(H-pad.t-pad.b);
  const path = points.map((p,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const grid = [0,.25,.5,.75,1].map(f=>{const v=min+(max-min)*f;
    return `<line x1="${pad.l}" y1="${y(v)}" x2="${W-pad.r}" y2="${y(v)}" stroke="#E5E7EB" stroke-width="1"/>
      <text x="${pad.l-7}" y="${y(v)+4}" text-anchor="end" font-size="10" fill="#9CA3AF">${Math.round(v)}</text>`;}).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="${esc(opt.label||'Trend')}">
    ${grid}<path d="${path}" fill="none" stroke="#1F2937" stroke-width="2" stroke-linejoin="round"/>
    ${points.map((p,i)=>`<circle cx="${x(i)}" cy="${y(p.value)}" r="3.2" fill="#111827"><title>${esc(p.label)}: ${p.value}</title></circle>`).join('')}
    ${points.map((p,i)=>`<text x="${x(i)}" y="${H-7}" text-anchor="middle" font-size="10" fill="#9CA3AF">${esc(p.label)}</text>`).join('')}
  </svg>`;
}
function countBy(list, key, filter){
  const m = new Map();
  list.forEach(p=>{ if(filter && !filter(p)) return; m.set(p[key], (m.get(p[key])||0)+1); });
  return [...m.entries()].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value);
}
const shortMinistry = m => m.replace('Ministry of ','').replace(' & ',' & ');

/* --------------------------------------------------------------- login */
function viewLogin(err){
  return `<div class="login-wrap"><div class="login-card">
    <div class="login-brand">${ic('logo',26)}
      <div><div class="login-title">NIRMAN</div><div class="login-sub">Infrastructure Intelligence</div></div></div>
    <div class="panel login-panel">
      <h1 style="font-size:17px;font-weight:600;margin-bottom:4px">Sign in</h1>
      <p class="small muted" style="margin-bottom:18px">Infrastructure Project Monitoring and Early-Warning Platform</p>
      ${err?`<div class="err">${esc(err)}</div>`:''}
      <div class="field"><label for="em">Email</label>
        <input class="input" id="em" type="email" autocomplete="username" placeholder="mospi@nirman.demo"></div>
      <div class="field"><label for="pw">Password</label>
        <input class="input" id="pw" type="password" autocomplete="current-password" placeholder="Demo@123"></div>
      <button class="btn btn-primary btn-block" data-act="login" style="margin-top:6px">Sign in</button>
    </div>
    <div class="panel demo-card">
      <div class="small" style="font-weight:600;margin-bottom:8px">Demo accounts — password <b>Demo@123</b></div>
      ${USERS.map(u=>`<div class="demo-row"><span class="demo-mail">${u.email}</span>
        <span style="display:flex;align-items:center;gap:8px"><span class="demo-role">${ROLE_LABEL[u.role]}</span>
        <button class="btn btn-sm" data-act="quick" data-email="${u.email}">Use</button></span></div>`).join('')}
    </div>
    <p class="foot" style="padding:18px 2px 0">Demo uses synthetic CUF-like project data. Production deployment
      requires authorised PAIMANA/OCMS integration.</p>
  </div></div>`;
}

/* ---------------------------------------------------------------- shell */
const PAGE_TITLES = {overview:['Portfolio overview','Delay and cost-overrun risk across the monitored portfolio'],
  projects:['Projects','Search, filter and prioritise monitored projects'],
  detail:['Project detail','Risk prediction, drivers and officer actions'],
  alerts:['Risk alerts','Early-warning alerts raised by the monitoring rules'],
  interventions:['Interventions','Track review actions assigned to implementing authorities'],
  upload:['Data upload','Import periodic project returns from CSV'],
  analytics:['Analytics','Portfolio patterns by sector, ministry and state'],
  model:['Model insights','Model version, evaluation and feature importance'],
  admin:['Admin settings','Risk thresholds, scoring weights and data quality rules']};

function shell(body){
  const u = S.user, nav = ROLE_NAV[u.role];
  const [title, sub] = PAGE_TITLES[S.route] || ['',''];
  const crumbLast = S.route==='detail' ? (S.projects.find(p=>p.id===S.projectId)?.projectCode||'Project') : NAV_META[S.route]?.label || title;
  return `<div class="app ${S.collapsed?'collapsed':''} ${S.drawer?'drawer':''}">
    <div class="scrim" data-act="closeDrawer"></div>
    <aside class="sidebar">
      <div class="sb-head">${ic('logo',24)}
        <div class="hide-collapsed"><div class="sb-name">NIRMAN</div><div class="sb-tag">Infrastructure Intelligence</div></div></div>
      <nav class="sb-nav">
        ${nav.map(k=>`<div class="nav-item ${S.route===k||(S.route==='detail'&&k==='projects')?'active':''}"
          data-act="go" data-route="${k}" role="button" tabindex="0" title="${NAV_META[k].label}">
          ${ic(NAV_META[k].icon)}<span class="hide-collapsed">${NAV_META[k].label}</span></div>`).join('')}
      </nav>
      <div class="sb-foot"><div class="sb-user"><div class="avatar">${initials(u.name)}</div>
        <div class="hide-collapsed"><div class="sb-user-name">${esc(u.name)}</div>
        <div class="sb-user-role">${ROLE_LABEL[u.role]}</div></div></div></div>
    </aside>
    <div class="main">
      <header class="topbar">
        <button class="icon-btn" data-act="toggleSidebar" aria-label="Toggle sidebar">${ic('panel',18)}</button>
        <div class="crumb"><b>NIRMAN</b> ${ic('chev',11)} ${esc(crumbLast)}</div>
        <div class="topbar-right">
          <button class="icon-btn" data-act="refreshAll" title="Refresh risk scores">${ic('refresh',17)}</button>
          <button class="profile-btn" data-act="menu">
            <span class="avatar" style="width:24px;height:24px;flex-basis:24px;font-size:10px">${initials(u.name)}</span>
            <span class="profile-name small" style="font-weight:500">${esc(u.name)}</span>${ic('chevDown',14)}</button>
          ${S.menu?`<div class="menu"><div class="menu-head">
            <div style="font-weight:600">${esc(u.name)}</div>
            <div class="small muted">${ROLE_LABEL[u.role]}</div>
            <div class="small muted">${esc(u.org)}</div></div>
            <div class="menu-item" data-act="logout">${ic('logout',16)} Sign out</div></div>`:''}
        </div>
      </header>
      <div class="content">
        <div class="page-head"><div class="head-row"><div>
          <h1 class="page-title">${esc(title)}</h1><p class="page-sub">${esc(sub)}</p></div></div></div>
        ${body}
      </div>
      <footer class="foot">Demo uses synthetic CUF-like project data. Production deployment requires authorised
        PAIMANA/OCMS integration. Risk output is decision support — MoSPI/IPMD officers remain the deciding authority.</footer>
    </div></div>
    ${S.modal||''}${S.toast?`<div class="toast">${esc(S.toast)}</div>`:''}`;
}

/* ------------------------------------------------------------ overview */
function viewOverview(){
  const all = visibleProjects();
  const ps = applyFilters(all);
  const lv = l => ps.filter(p=>p.prediction.riskLevel===l).length;
  const avg = ps.length? Math.round(ps.reduce((a,p)=>a+p.prediction.overallRiskScore,0)/ps.length) : 0;
  const newlyHigh = ps.filter(p=>{
    const prev = p.riskHistory[p.riskHistory.length-2];
    return p.prediction.overallRiskScore>=SETTINGS.tHigh && prev && prev.score<SETTINGS.tHigh; }).length;
  const stale = ps.filter(p=>daysAgo(p.lastUpdatedDate)>SETTINGS.staleDays).length;
  const highs = p => p.prediction.overallRiskScore >= SETTINGS.tHigh;
  const kpi = (label,value,foot,color) => `<div class="card"><div class="kpi-label">${label}</div>
    <div class="kpi-value" ${color?`style="color:${color}"`:''}>${value}</div><div class="kpi-foot">${foot}</div></div>`;
  const top = [...ps].sort((a,b)=>b.prediction.overallRiskScore-a.prediction.overallRiskScore).slice(0,10);
  const trend = ps.length ? ps[0].riskHistory.map((h,i)=>({label:h.period,
    value: Math.round(ps.reduce((a,p)=>a+(p.riskHistory[i]?.score||0),0)/ps.length)})) : [];
  return `
  ${filterBar(all,['ministry','sector','state','agency','level','status'])}
  <div class="grid kpis" style="margin-bottom:14px">
    ${kpi('Total projects', ps.length, 'In the current view')}
    ${kpi('High risk', lv('High')+lv('Critical'), `Score ≥ ${SETTINGS.tHigh}, incl. ${lv('Critical')} critical`,'var(--high)')}
    ${kpi('Medium risk', lv('Medium'), `Score ${SETTINGS.tLow}–${SETTINGS.tHigh-1}`,'var(--med)')}
    ${kpi('Low risk', lv('Low'), `Score below ${SETTINGS.tLow}`,'var(--low)')}
    ${kpi('Average risk score', avg, 'Portfolio mean, 0–100')}
    ${kpi('Newly high risk', newlyHigh, 'Crossed the high band this period')}
    ${kpi('Stale updates', stale, `No return in ${SETTINGS.staleDays}+ days`)}
  </div>
  <div class="grid cols-2" style="margin-bottom:14px">
    <div class="card"><div class="card-head"><div class="card-title">Risk distribution</div>
      <div class="card-note">All risk bands</div></div>
      ${donut([{label:'Low',value:lv('Low'),color:'#15803D'},{label:'Medium',value:lv('Medium'),color:'#B45309'},
               {label:'High',value:lv('High'),color:'#B91C1C'},{label:'Critical',value:lv('Critical'),color:'#7F1D1D'}])}</div>
    <div class="card"><div class="card-head"><div class="card-title">Average risk score by period</div>
      <div class="card-note">Last 6 reporting periods</div></div>${lineChart(trend,{label:'Average risk score'})}</div>
  </div>
  <div class="grid cols-3" style="margin-bottom:14px">
    <div class="card"><div class="card-head"><div class="card-title">High-risk projects by sector</div></div>
      ${hbars(countBy(ps,'sector',highs).slice(0,9))}</div>
    <div class="card"><div class="card-head"><div class="card-title">High-risk projects by ministry</div></div>
      ${hbars(countBy(ps,'ministry',highs).slice(0,9).map(r=>({...r,label:shortMinistry(r.label)})))}</div>
    <div class="card"><div class="card-head"><div class="card-title">High-risk projects by state</div></div>
      ${hbars(countBy(ps,'state',highs).slice(0,9))}</div>
  </div>
  <div class="card-head" style="margin-bottom:10px"><div class="card-title">Top 10 projects by risk score</div>
    <div class="card-note"><button class="btn btn-sm" data-act="go" data-route="projects">Open projects list</button></div></div>
  ${projectTable(top, true)}`;
}

/* ------------------------------------------------------- filters + list */
function applyFilters(list){
  const f = S.filters, q = f.q.trim().toLowerCase();
  return list.filter(p=>{
    if (q && !(p.projectName.toLowerCase().includes(q) || p.projectCode.toLowerCase().includes(q)
      || p.agency.toLowerCase().includes(q) || p.state.toLowerCase().includes(q))) return false;
    if (f.ministry && p.ministry!==f.ministry) return false;
    if (f.sector && p.sector!==f.sector) return false;
    if (f.state && p.state!==f.state) return false;
    if (f.agency && p.agency!==f.agency) return false;
    if (f.level && p.prediction.riskLevel!==f.level) return false;
    if (f.status && p.currentStatus!==f.status) return false;
    if (f.stale==='stale' && daysAgo(p.lastUpdatedDate)<=SETTINGS.staleDays) return false;
    if (f.stale==='fresh' && daysAgo(p.lastUpdatedDate)>SETTINGS.staleDays) return false;
    if (f.minCost && p.sanctionedCostCr < Number(f.minCost)) return false;
    return true;
  });
}
function filterBar(list, keys, withSearch){
  const uniq = k => [...new Set(list.map(p=>p[k]))].sort();
  const sel = (key,label,opts,fmt) => `<div class="filter"><label>${label}</label>
    <select data-filter="${key}"><option value="">All</option>
    ${opts.map(o=>`<option value="${esc(o)}" ${S.filters[key]===o?'selected':''}>${esc(fmt?fmt(o):o)}</option>`).join('')}
    </select></div>`;
  const parts = [];
  if (withSearch) parts.push(`<div class="filter search"><label>Search</label>
    <input data-filter="q" value="${esc(S.filters.q)}" placeholder="Project name, code, agency or state" style="width:100%"></div>`);
  if (keys.includes('ministry')) parts.push(sel('ministry','Ministry',uniq('ministry'),shortMinistry));
  if (keys.includes('sector')) parts.push(sel('sector','Sector',uniq('sector')));
  if (keys.includes('state')) parts.push(sel('state','State',uniq('state')));
  if (keys.includes('agency')) parts.push(sel('agency','Agency',uniq('agency')));
  if (keys.includes('level')) parts.push(sel('level','Risk level',['Low','Medium','High','Critical']));
  if (keys.includes('status')) parts.push(sel('status','Project status',STATUSES));
  if (keys.includes('stale')) parts.push(`<div class="filter"><label>Data freshness</label>
    <select data-filter="stale"><option value="">All</option>
      <option value="stale" ${S.filters.stale==='stale'?'selected':''}>Stale only</option>
      <option value="fresh" ${S.filters.stale==='fresh'?'selected':''}>Up to date</option></select></div>`);
  if (keys.includes('cost')) parts.push(`<div class="filter"><label>Min sanctioned cost (₹ Cr)</label>
    <input data-filter="minCost" type="number" min="0" step="50" value="${esc(S.filters.minCost)}" placeholder="0"></div>`);
  parts.push(`<div class="filter"><label>&nbsp;</label><button class="btn" data-act="clearFilters">Clear</button></div>`);
  return `<div class="filters">${parts.join('')}</div>`;
}
const SORTS = {
  code:p=>p.projectCode, name:p=>p.projectName, ministry:p=>p.ministry, sector:p=>p.sector, state:p=>p.state,
  cost:p=>p.sanctionedCostCr, progress:p=>p.physicalProgressPct, delay:p=>p.prediction.delayProbability,
  costrisk:p=>p.prediction.costOverrunProbability, risk:p=>p.prediction.overallRiskScore,
  updated:p=>new Date(p.lastUpdatedDate).getTime()
};
function sortProjects(list){
  const {key,dir} = S.sort, f = SORTS[key]||SORTS.risk;
  return [...list].sort((a,b)=>{
    const x=f(a), y=f(b);
    const c = typeof x==='string' ? x.localeCompare(y) : x-y;
    return dir==='desc' ? -c : c;
  });
}
function projectTable(rows, plain){
  const th = (key,label,cls='') => plain
    ? `<th class="${cls}">${label}</th>`
    : `<th class="sortable ${cls}" data-sort="${key}">${label}${S.sort.key===key?(S.sort.dir==='desc'?' ↓':' ↑'):''}</th>`;
  if (!rows.length) return `<div class="table-wrap"><div class="empty"><b>No projects match these filters</b>
    Adjust or clear the filters to see monitored projects.</div></div>`;
  return `<div class="table-wrap"><table>
    <thead><tr>${th('code','Code')}${th('name','Project')}${th('ministry','Ministry')}${th('sector','Sector')}
      ${th('state','State')}${th('cost','Sanctioned','t-num')}${th('progress','Progress','t-num')}
      ${th('delay','Delay risk','t-num')}${th('costrisk','Cost risk','t-num')}${th('risk','Score','t-num')}
      <th>Level</th>${th('updated','Updated')}<th></th></tr></thead>
    <tbody>${rows.map(p=>{const pr=p.prediction; return `<tr class="row-link" data-act="open" data-id="${p.id}">
      <td class="t-code">${esc(p.projectCode)}</td>
      <td class="t-name">${esc(p.projectName)}<div class="small muted">${esc(p.agency)}</div></td>
      <td class="small">${esc(shortMinistry(p.ministry))}</td><td class="small">${esc(p.sector)}</td>
      <td class="small">${esc(p.state)}</td><td class="t-num">${p.sanctionedCostCr.toLocaleString('en-IN')}</td>
      <td class="t-num">${p.physicalProgressPct}%</td>
      <td class="t-num">${Math.round(pr.delayProbability*100)}%</td>
      <td class="t-num">${Math.round(pr.costOverrunProbability*100)}%</td>
      <td class="t-num" style="font-weight:700">${pr.overallRiskScore}</td>
      <td>${riskBadge(pr.riskLevel)}</td>
      <td class="small muted">${fdate(p.lastUpdatedDate)}</td>
      <td class="small" style="color:var(--text-3)">${ic('chev',14)}</td></tr>`;}).join('')}</tbody></table></div>`;
}
function viewProjects(){
  const all = visibleProjects();
  const rows = sortProjects(applyFilters(all));
  return `${filterBar(all,['ministry','sector','state','agency','level','status','stale','cost'],true)}
    <div class="small muted" style="margin-bottom:10px">${rows.length} of ${all.length} projects ·
      sorted by ${SORT_LABEL[S.sort.key]||'risk score'} ${S.sort.dir==='desc'?'(high to low)':'(low to high)'}</div>
    ${projectTable(rows)}`;
}
const SORT_LABEL = {code:'project code',name:'project name',ministry:'ministry',sector:'sector',state:'state',
  cost:'sanctioned cost',progress:'physical progress',delay:'delay risk',costrisk:'cost-overrun risk',
  risk:'risk score',updated:'last update'};

/* --------------------------------------------------------- project detail */
function viewDetail(){
  const p = S.projects.find(x=>x.id===S.projectId);
  if (!p) return `<div class="card"><div class="empty"><b>Project not found</b>It may have been filtered out.</div></div>`;
  const pr = p.prediction, f = pr.features;
  const alerts = visibleAlerts().filter(a=>a.projectId===p.id);
  const ivs = S.interventions.filter(i=>i.projectId===p.id);
  const tabs = [['overview','Overview'],['risk','Risk & explanation'],['milestones','Milestones'],
    ['alerts',`Alerts (${alerts.length})`],['interventions',`Interventions (${ivs.length})`],['history','Update history']];
  return `
  <div class="head-row" style="margin:-8px 0 16px">
    <button class="btn btn-sm" data-act="go" data-route="projects">${ic('back',14)} Back to projects</button>
    <div><div style="font-size:18px;font-weight:700">${esc(p.projectName)}</div>
      <div class="small muted">${esc(p.projectCode)} · ${esc(p.agency)} · ${esc(p.state)}</div></div>
    <div class="spacer"></div>
    ${riskBadge(pr.riskLevel)}
    ${can('intervene')?`<button class="btn btn-sm btn-primary" data-act="newIntervention" data-id="${p.id}">${ic('plus',14)} Create intervention</button>`:''}
    <button class="btn btn-sm" data-act="refreshOne" data-id="${p.id}">${ic('refresh',14)} Refresh risk</button>
  </div>
  <div class="tabs">${tabs.map(([k,l])=>`<div class="tab ${S.tab===k?'on':''}" data-act="tab" data-tab="${k}" role="button" tabindex="0">${l}</div>`).join('')}</div>
  ${S.tab==='overview'?detailOverview(p,f):''}
  ${S.tab==='risk'?detailRisk(p,pr):''}
  ${S.tab==='milestones'?detailMilestones(p):''}
  ${S.tab==='alerts'?alertTable(alerts):''}
  ${S.tab==='interventions'?interventionTable(ivs, p):''}
  ${S.tab==='history'?detailHistory(p):''}`;
}
function detailOverview(p,f){
  const kv = (k,v) => `<div class="kv"><dt>${k}</dt><dd>${v}</dd></div>`;
  return `<div class="detail-grid">
    <div class="stack">
      <div class="card"><div class="card-head"><div class="card-title">Project overview</div></div>
        <dl style="margin:0">
        ${kv('Project name', esc(p.projectName))}${kv('Project code', esc(p.projectCode))}
        ${kv('Ministry', esc(p.ministry))}${kv('Implementing agency', esc(p.agency))}
        ${kv('Sector', esc(p.sector)+' · '+esc(p.subSector))}${kv('State / district', esc(p.state)+' · '+esc(p.district))}
        ${kv('Project status', esc(p.currentStatus))}${kv('Contract', esc(p.contractType)+' · '+esc(p.contractorName))}
        ${kv('Funding type', esc(p.fundingType))}
        ${kv('Primary delay reason', p.delayReasonPrimary?esc(p.delayReasonPrimary):'Not reported')}
        ${kv('Secondary delay reason', p.delayReasonSecondary?esc(p.delayReasonSecondary):'Not reported')}
        ${kv('Last updated', fdate(p.lastUpdatedDate)+` <span class="muted small">(${daysAgo(p.lastUpdatedDate)} days ago)</span>`)}
        </dl></div>
      <div class="grid cols-2">
        <div class="card"><div class="card-head"><div class="card-title">Financial snapshot</div></div><dl style="margin:0">
          ${kv('Sanctioned cost', cr(p.sanctionedCostCr))}${kv('Revised cost', cr(p.revisedCostCr))}
          ${kv('Cost revision', Math.round(f.costOverrunRatio*100)+'%')}
          ${kv('Expenditure incurred', cr(p.expenditureIncurredCr))}
          ${kv('Expenditure ratio', Math.round(f.expenditureRatio*100)+'% of revised cost')}</dl></div>
        <div class="card"><div class="card-head"><div class="card-title">Schedule & progress</div></div><dl style="margin:0">
          ${kv('Actual start', fdate(p.actualStartDate))}
          ${kv('Original completion', fdate(p.originalCompletionDate))}
          ${kv('Revised completion', p.revisedCompletionDate?fdate(p.revisedCompletionDate):'Not revised')}
          ${kv('Reported delay', p.monthsOfDelay+' months')}
          ${kv('Physical progress', p.physicalProgressPct+'%')}${kv('Expected progress', p.expectedProgressPct+'%')}
          ${kv('Land acquisition', p.landAcquisitionPct+'%')}${kv('Clearance status', esc(p.clearanceStatus))}</dl>
          <div style="margin-top:12px">
            <div class="small muted" style="display:flex;justify-content:space-between"><span>Physical</span><span>${p.physicalProgressPct}%</span></div>
            <div class="progress" style="margin:4px 0 9px"><i style="width:${p.physicalProgressPct}%"></i></div>
            <div class="small muted" style="display:flex;justify-content:space-between"><span>Expected</span><span>${p.expectedProgressPct}%</span></div>
            <div class="progress" style="margin-top:4px"><i style="width:${p.expectedProgressPct}%;background:var(--text-3)"></i></div>
          </div></div>
      </div>
    </div>
    ${riskPanel(p)}
  </div>`;
}
function riskPanel(p, withTrend=true){
  const pr = p.prediction;
  return `<div class="stack">
    <div class="card"><div class="card-head"><div class="card-title">AI risk prediction</div>
      <div class="card-note">${esc(pr.modelVersion)}</div></div>
      <div class="riskbig"><b style="color:${LEVEL_COLOR[pr.riskLevel]}">${pr.overallRiskScore}</b>
        <span class="muted">/100</span><span style="margin-left:auto">${riskBadge(pr.riskLevel)}</span></div>
      <div class="probs">
        <div><div class="prob-label">Delay risk</div><div class="prob-val">${Math.round(pr.delayProbability*100)}%</div>
          <div class="progress"><i style="width:${pr.delayProbability*100}%;background:var(--high)"></i></div></div>
        <div><div class="prob-label">Cost-overrun risk</div><div class="prob-val">${Math.round(pr.costOverrunProbability*100)}%</div>
          <div class="progress"><i style="width:${pr.costOverrunProbability*100}%;background:var(--med)"></i></div></div>
      </div>
      <dl style="margin:16px 0 0">
        <div class="kv"><dt>Estimated delay range</dt><dd>${pr.estimatedDelayMonthsMin}–${pr.estimatedDelayMonthsMax} months</dd></div>
        <div class="kv"><dt>Estimated cost-overrun range</dt><dd>${pr.estimatedCostOverrunPctMin}–${pr.estimatedCostOverrunPctMax}%</dd></div>
        <div class="kv"><dt>Predicted on</dt><dd>${fdate(pr.predictionDate)}</dd></div></dl>
      <p class="small muted" style="margin-top:12px">Early-warning indicator for officer review. It does not
        forecast a certain outcome, and the reviewing officer remains the deciding authority.</p></div>
    ${withTrend?`<div class="card"><div class="card-head"><div class="card-title">Risk score trend</div>
      <div class="card-note">6 periods</div></div>
      ${lineChart(p.riskHistory.map(h=>({label:h.period,value:h.score})),{label:'Risk score trend'})}</div>`:''}
  </div>`;
}
function detailRisk(p,pr){
  return `<div class="detail-grid">
    <div class="stack">
      <div class="card"><div class="card-head"><div class="card-title">Why this project is flagged</div>
        <div class="card-note">Top contributing features</div></div>
        ${pr.topRiskDrivers.length?pr.topRiskDrivers.map(d=>`<div class="driver i-${d.impact}">
          <div class="driver-top"><span class="driver-title">${esc(d.factor)}</span>
            <span class="badge ${d.impact==='High'?'b-high':d.impact==='Medium'?'b-med':'b-low'}" style="margin-left:auto">${d.impact} impact</span></div>
          <div class="driver-detail">${esc(d.detail)}</div></div>`).join('')
          :'<div class="empty">No material risk driver crossed the reporting threshold for this project.</div>'}
        <p class="small muted" style="margin-top:10px">Contribution is derived from the model's feature weighting
          for this project, expressed in the officer's vocabulary rather than raw model output.</p></div>
      <div class="card"><div class="card-head"><div class="card-title">Feature values used</div></div>
        ${hbars([
          {label:'Progress gap (pp)', value:Math.round(Math.max(0,pr.features.progressGap))},
          {label:'Cost revision (%)', value:Math.round(pr.features.costOverrunRatio*100)},
          {label:'Land pending (%)', value:Math.round(pr.features.landGap*100)},
          {label:'Schedule slippage (%)', value:Math.round(pr.features.slippage*100)},
          {label:'Milestones delayed', value:pr.features.delayedMilestones},
          {label:'Months of delay', value:pr.features.monthsOfDelay}])}</div>
    </div>
    <div class="stack">
      <div class="card"><div class="card-head"><div class="card-title">Suggested review focus</div></div>
        <ul class="focus-list">${pr.suggestedReviewFocus.map(s=>`<li>${ic('chev',14)}<span>${esc(s)}</span></li>`).join('')}</ul>
        ${can('intervene')?`<button class="btn btn-block btn-primary" style="margin-top:14px"
          data-act="newIntervention" data-id="${p.id}">Create intervention</button>`:''}</div>
      ${riskPanel(p, false)}
    </div></div>`;
}
function detailMilestones(p){
  const badge = s => s==='Completed'?'<span class="badge b-low"><i class="dot"></i>Completed</span>'
    : s==='Delayed'?'<span class="badge b-high"><i class="dot"></i>Delayed</span>'
    : s==='In Progress'?'<span class="badge b-info"><i class="dot"></i>In progress</span>'
    : '<span class="badge b-plain"><i class="dot"></i>Planned</span>';
  return `<div class="card"><div class="card-head"><div class="card-title">Milestone tracker</div>
    <div class="card-note">${p.milestones.filter(m=>m.status==='Completed').length} of ${p.milestones.length} completed</div></div>
    <ul class="timeline">${p.milestones.map(m=>`<li><span class="tl-dot" style="background:${
      m.status==='Delayed'?'var(--high)':m.status==='Completed'?'var(--low)':'var(--text-3)'}"></span>
      <div><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <b style="font-size:13.5px">${esc(m.name)}</b>${badge(m.status)}</div>
        <div class="small muted">Planned ${fdate(m.plannedDate)}${m.actualDate?` · actual ${fdate(m.actualDate)}`:''}</div>
      </div></li>`).join('')}</ul></div>`;
}
function detailHistory(p){
  return `<div class="card"><div class="card-head"><div class="card-title">Project update history</div>
    <div class="card-note">Periodic returns filed by the implementing agency</div></div>
    <div class="table-wrap" style="border:none"><table style="min-width:520px"><thead><tr>
      <th>Date</th><th class="t-num">Physical progress</th><th class="t-num">Expenditure</th><th>Remark</th></tr></thead>
      <tbody>${p.updates.map(u=>`<tr><td>${fdate(u.date)}</td><td class="t-num">${u.physicalProgressPct}%</td>
      <td class="t-num">${cr(u.expenditureIncurredCr)}</td><td class="small muted">${esc(u.remark)}</td></tr>`).join('')}
      </tbody></table></div></div>`;
}

/* --------------------------------------------------------------- alerts */
const SEV_CLASS = {Low:'b-low',Medium:'b-med',High:'b-high',Critical:'b-crit'};
function alertTable(rows){
  if (!rows.length) return `<div class="table-wrap"><div class="empty"><b>No alerts in this view</b>
    Alerts are raised automatically when a monitoring rule is crossed.</div></div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Severity</th><th>Type</th><th>Project</th>
    <th>Message</th><th>Raised</th><th>Status</th><th>Assigned</th><th></th></tr></thead>
    <tbody>${rows.map(a=>`<tr>
      <td><span class="badge ${SEV_CLASS[a.severity]}"><i class="dot"></i>${a.severity}</span></td>
      <td class="small">${ALERT_META[a.type].label}</td>
      <td class="small"><span class="row-link" data-act="open" data-id="${a.projectId}"
        style="font-weight:500;text-decoration:underline;text-underline-offset:2px">${esc(a.projectCode)}</span>
        <div class="muted" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.projectName)}</div></td>
      <td class="small muted" style="max-width:300px">${esc(a.message)}</td>
      <td class="small muted">${fdate(a.createdAt)}</td>
      <td><span class="badge ${a.status==='Resolved'?'b-low':a.status==='Acknowledged'?'b-info':'b-plain'}">${a.status}</span></td>
      <td class="small muted">${a.assignedTo?esc(a.assignedTo):'—'}</td>
      <td style="white-space:nowrap">${can('alertAction')?
        (a.status==='Open'?`<button class="btn btn-sm" data-act="ackAlert" data-id="${a.id}">Acknowledge</button>`:
         a.status==='Acknowledged'?`<button class="btn btn-sm" data-act="resolveAlert" data-id="${a.id}">Resolve</button>`:
         '<span class="small muted">Closed</span>'):''}</td></tr>`).join('')}</tbody></table></div>`;
}
function viewAlerts(){
  const all = visibleAlerts();
  const f = S.alertFilters;
  const rows = all.filter(a=>(!f.severity||a.severity===f.severity)&&(!f.type||a.type===f.type)
    &&(!f.status||a.status===f.status)&&(!f.ministry||a.ministry===f.ministry))
    .sort((a,b)=>({Critical:0,High:1,Medium:2,Low:3})[a.severity]-({Critical:0,High:1,Medium:2,Low:3})[b.severity]);
  const c = t => all.filter(a=>a.type===t).length;
  const sel=(k,label,opts,fmt)=>`<div class="filter"><label>${label}</label><select data-afilter="${k}">
    <option value="">All</option>${opts.map(o=>`<option value="${esc(o)}" ${f[k]===o?'selected':''}>${esc(fmt?fmt(o):o)}</option>`).join('')}
    </select></div>`;
  return `<div class="grid kpis" style="margin-bottom:14px">
    ${[['CRITICAL_RISK','Critical risk'],['HIGH_RISK','New high risk'],['RISK_INCREASE','Risk increase'],
       ['MILESTONE_DELAY','Milestone delay'],['CLEARANCE_PENDING','Clearance pending'],['STALE_DATA','Stale data']]
      .map(([t,l])=>`<div class="card"><div class="kpi-label">${l}</div><div class="kpi-value">${c(t)}</div>
      <div class="kpi-foot">${all.filter(a=>a.type===t&&a.status==='Open').length} open</div></div>`).join('')}</div>
    <div class="filters">${sel('severity','Severity',['Critical','High','Medium','Low'])}
      ${sel('type','Alert type',Object.keys(ALERT_META),t=>ALERT_META[t].label)}
      ${sel('status','Status',['Open','Acknowledged','Resolved'])}
      ${sel('ministry','Ministry',[...new Set(all.map(a=>a.ministry))].sort(),shortMinistry)}
      <div class="filter"><label>&nbsp;</label><button class="btn" data-act="clearAlertFilters">Clear</button></div></div>
    <div class="small muted" style="margin-bottom:10px">${rows.length} alerts</div>
    ${alertTable(rows.slice(0,200))}`;
}

/* -------------------------------------------------------- interventions */
function interventionTable(rows, project){
  if (!rows.length) return `<div class="table-wrap"><div class="empty"><b>No interventions recorded</b>
    ${can('intervene')&&project?'Create one from the risk panel to assign a review action.':'Interventions appear here once an officer assigns a review action.'}</div></div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Type</th><th>Project</th><th>Assigned authority</th>
    <th>Due</th><th>Status</th><th>Notes</th><th></th></tr></thead><tbody>
    ${rows.map(v=>`<tr><td style="font-weight:500">${esc(v.type)}<div class="small muted" style="max-width:230px">${esc(v.description)}</div></td>
      <td class="small"><span class="row-link" data-act="open" data-id="${v.projectId}"
        style="text-decoration:underline;text-underline-offset:2px">${esc(v.projectCode)}</span></td>
      <td class="small">${esc(v.assignedAuthority)}</td>
      <td class="small ${new Date(v.dueDate)<TODAY&&v.status!=='Completed'?'':'muted'}"
        ${new Date(v.dueDate)<TODAY&&v.status!=='Completed'?'style="color:var(--high);font-weight:500"':''}>${fdate(v.dueDate)}</td>
      <td><span class="badge ${v.status==='Completed'?'b-low':v.status==='In Progress'?'b-info':'b-plain'}">${v.status}</span></td>
      <td class="small muted" style="max-width:200px">${esc(v.outcomeNotes)||'—'}</td>
      <td>${can('intervene')&&v.status!=='Completed'?`<button class="btn btn-sm" data-act="advanceIv" data-id="${v.id}">
        ${v.status==='Open'?'Start':'Mark complete'}</button>`:''}</td></tr>`).join('')}</tbody></table></div>`;
}
function viewInterventions(){
  const ids = new Set(visibleProjects().map(p=>p.id));
  const rows = S.interventions.filter(v=>ids.has(v.projectId));
  const c = s => rows.filter(v=>v.status===s).length;
  return `<div class="grid kpis" style="margin-bottom:14px">
    <div class="card"><div class="kpi-label">Open</div><div class="kpi-value">${c('Open')}</div><div class="kpi-foot">Awaiting action</div></div>
    <div class="card"><div class="kpi-label">In progress</div><div class="kpi-value">${c('In Progress')}</div><div class="kpi-foot">Under review</div></div>
    <div class="card"><div class="kpi-label">Completed</div><div class="kpi-value">${c('Completed')}</div><div class="kpi-foot">Closed with notes</div></div>
    <div class="card"><div class="kpi-label">Overdue</div><div class="kpi-value" style="color:var(--high)">${
      rows.filter(v=>v.status!=='Completed'&&new Date(v.dueDate)<TODAY).length}</div><div class="kpi-foot">Past due date</div></div>
  </div>${interventionTable(rows)}`;
}

/* ---------------------------------------------------------- data upload */
const CSV_COLUMNS = ['project_code','project_name','physical_progress_pct','expected_progress_pct',
  'revised_cost_cr','expenditure_incurred_cr','land_acquisition_pct','clearance_status','months_of_delay','last_updated_date'];
function sampleCSV(){
  const rows = S.projects.slice(0,3).map(p=>[p.projectCode,p.projectName,p.physicalProgressPct,
    p.expectedProgressPct,p.revisedCostCr,p.expenditureIncurredCr,p.landAcquisitionPct,p.clearanceStatus,
    p.monthsOfDelay,p.lastUpdatedDate].join(','));
  return CSV_COLUMNS.join(',')+'\n'+rows.join('\n');
}
function parseCSV(text){
  const lines = text.trim().split(/\r?\n/).filter(l=>l.trim());
  if (!lines.length) return {header:[],rows:[]};
  const split = l => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).slice(0,-1)
    .map(s=>s.replace(/,$/,'').replace(/^"|"$/g,'').replace(/""/g,'"').trim());
  const header = split(lines[0]).map(h=>h.toLowerCase());
  return {header, rows: lines.slice(1).map(l=>{ const c=split(l); const o={};
    header.forEach((h,i)=>o[h]=c[i]??''); return o; })};
}
function validateRow(r, i){
  const errs = [];
  if (!r.project_code) errs.push('project_code is required');
  else if (!S.projects.some(p=>p.projectCode===r.project_code)) errs.push(`no project with code ${r.project_code}`);
  const num = (k,min,max) => { if (r[k]==='' || r[k]==null) return; const v=Number(r[k]);
    if (isNaN(v)) errs.push(`${k} is not a number`); else if (v<min||v>max) errs.push(`${k} out of range ${min}–${max}`); };
  num('physical_progress_pct',0,100); num('expected_progress_pct',0,100); num('land_acquisition_pct',0,100);
  num('revised_cost_cr',0,1e6); num('expenditure_incurred_cr',0,1e6); num('months_of_delay',0,240);
  if (r.clearance_status && !CLEARANCES.includes(r.clearance_status))
    errs.push('clearance_status must be Approved, Partial or Pending');
  if (r.last_updated_date && isNaN(new Date(r.last_updated_date).getTime())) errs.push('last_updated_date is not a valid date');
  return {line:i+2, data:r, errors:errs};
}
function viewUpload(){
  const u = S.upload;
  return `<div class="grid cols-2" style="align-items:start">
    <div class="stack">
      <div class="card"><div class="card-head"><div class="card-title">Upload periodic project returns</div>
        <div class="card-note"><button class="btn btn-sm" data-act="downloadTemplate">${ic('download',14)} Sample CSV</button></div></div>
        <div class="drop" id="drop" data-act="pickFile" role="button" tabindex="0">
          ${ic('upload',26)}<div style="font-weight:600;margin-top:8px">Drop a CSV here, or choose a file</div>
          <div class="small muted" style="margin-top:4px">Matched to existing projects by project_code</div></div>
        <input type="file" id="file" accept=".csv,text/csv" style="display:none">
        <div class="small muted" style="margin-top:12px">Expected columns: ${CSV_COLUMNS.join(', ')}</div>
      </div>
      ${u?`<div class="card"><div class="card-head"><div class="card-title">Validation summary</div>
        <div class="card-note">${esc(u.filename)}</div></div>
        <div class="sum-grid">
          <div class="sum-item"><div class="kpi-label">Total rows</div><div class="kpi-value" style="font-size:22px">${u.total}</div></div>
          <div class="sum-item"><div class="kpi-label">Valid</div><div class="kpi-value" style="font-size:22px;color:var(--low)">${u.valid}</div></div>
          <div class="sum-item"><div class="kpi-label">Rejected</div><div class="kpi-value" style="font-size:22px;color:var(--high)">${u.rejected}</div></div>
          <div class="sum-item"><div class="kpi-label">Warnings</div><div class="kpi-value" style="font-size:22px;color:var(--med)">${u.warnings}</div></div>
        </div>
        ${u.applied?`<p class="small" style="margin-top:14px;color:var(--low);font-weight:500">
          Imported. Risk scores and alerts were recalculated for the affected projects.</p>`
          :`<button class="btn btn-primary" style="margin-top:14px" data-act="applyUpload" ${u.valid?'':'disabled'}>
            Import ${u.valid} rows and refresh risk</button>`}
        ${u.rowErrors.length?`<div style="margin-top:16px"><div class="small" style="font-weight:600;margin-bottom:8px">Row errors</div>
          ${u.rowErrors.slice(0,12).map(e=>`<div class="small" style="padding:6px 0;border-top:1px solid var(--border)">
            <b>Line ${e.line}</b> <span class="muted">${esc(e.errors.join('; '))}</span></div>`).join('')}
          ${u.rowErrors.length>12?`<div class="small muted" style="padding-top:6px">+ ${u.rowErrors.length-12} more</div>`:''}</div>`:''}
      </div>`:''}
      ${u&&u.preview.length?`<div class="card"><div class="card-head"><div class="card-title">Preview — first 10 rows</div></div>
        <div class="table-wrap" style="border:none"><table style="min-width:640px"><thead><tr>
        ${u.header.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>
        ${u.preview.map(r=>`<tr>${u.header.map(h=>`<td class="small">${esc(r[h])}</td>`).join('')}</tr>`).join('')}
        </tbody></table></div></div>`:''}
    </div>
    <div class="card"><div class="card-head"><div class="card-title">Upload history</div></div>
      ${S.uploads.length?`<ul class="timeline">${S.uploads.map(l=>`<li><span class="tl-dot"></span><div>
        <b style="font-size:13.5px">${esc(l.filename)}</b>
        <div class="small muted">${fdate(l.at)} · ${l.imported} imported · ${l.rejected} rejected · by ${esc(l.by)}</div>
        </div></li>`).join('')}</ul>`:'<div class="empty">No imports yet. Upload a CSV to update project returns.</div>'}
    </div></div>`;
}

/* ------------------------------------------------------------ analytics */
function viewAnalytics(){
  const all = visibleProjects(), ps = applyFilters(all);
  const highs = p => p.prediction.overallRiskScore >= SETTINGS.tHigh;
  const avgBy = key => {
    const m = new Map();
    ps.forEach(p=>{ const e = m.get(p[key])||{s:0,n:0}; e.s+=p.prediction.overallRiskScore; e.n++; m.set(p[key],e); });
    return [...m.entries()].map(([label,v])=>({label, value:Math.round(v.s/v.n)})).sort((a,b)=>b.value-a.value);
  };
  const reasons = new Map();
  ps.forEach(p=>{ if(p.delayReasonPrimary) reasons.set(p.delayReasonPrimary,(reasons.get(p.delayReasonPrimary)||0)+1); });
  const reasonRows = [...reasons.entries()].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value).slice(0,8);
  const buckets = [[0,10],[10,20],[20,30],[30,100]].map(([a,b])=>({
    label:`${a}–${b===100?'30+':b} pp`, value: ps.filter(p=>{const g=p.expectedProgressPct-p.physicalProgressPct; return g>=a&&g<b;}).length}));
  const costBands = [['Within sanction',p=>p.revisedCostCr<=p.sanctionedCostCr*1.0],
    ['Up to 10%',p=>p.revisedCostCr>p.sanctionedCostCr&&p.revisedCostCr<=p.sanctionedCostCr*1.10],
    ['10–25%',p=>p.revisedCostCr>p.sanctionedCostCr*1.10&&p.revisedCostCr<=p.sanctionedCostCr*1.25],
    ['Above 25%',p=>p.revisedCostCr>p.sanctionedCostCr*1.25]].map(([label,f])=>({label,value:ps.filter(f).length}));
  return `${filterBar(all,['ministry','sector','state','level'])}
  <div class="grid cols-2" style="margin-bottom:14px">
    <div class="card"><div class="card-head"><div class="card-title">Average risk score by sector</div>
      <div class="card-note">0–100</div></div>${hbars(avgBy('sector'))}</div>
    <div class="card"><div class="card-head"><div class="card-title">Average risk score by ministry</div></div>
      ${hbars(avgBy('ministry').map(r=>({...r,label:shortMinistry(r.label)})))}</div>
    <div class="card"><div class="card-head"><div class="card-title">High-risk concentration by state</div>
      <div class="card-note">Count of projects in the high or critical band</div></div>
      ${hbars(countBy(ps,'state',highs).slice(0,10))}</div>
    <div class="card"><div class="card-head"><div class="card-title">Reported primary delay reasons</div></div>
      ${hbars(reasonRows)}</div>
    <div class="card"><div class="card-head"><div class="card-title">Progress gap distribution</div>
      <div class="card-note">Expected minus actual progress</div></div>${hbars(buckets)}</div>
    <div class="card"><div class="card-head"><div class="card-title">Cost revision bands</div></div>
      ${hbars(costBands)}</div>
  </div>
  <div class="card"><div class="card-head"><div class="card-title">Projects needing attention first</div>
    <div class="card-note">High risk and stale data</div></div>
    ${hbars(countBy(ps.filter(p=>highs(p)&&daysAgo(p.lastUpdatedDate)>SETTINGS.staleDays),'sector').slice(0,8))}</div>`;
}

/* -------------------------------------------------------- model insights */
function viewModel(){
  const ps = visibleProjects();
  const imp = [
    {label:'Physical progress gap', value:24},{label:'Cost revision ratio', value:21},
    {label:'Schedule slippage', value:16},{label:'Land acquisition', value:13},
    {label:'Milestone delay ratio', value:11},{label:'Clearance status', value:9},
    {label:'Reported months of delay', value:6}];
  const dist = ['Low','Medium','High','Critical'].map((l,i)=>({label:l,
    value:ps.filter(p=>p.prediction.riskLevel===l).length, color:['#15803D','#B45309','#B91C1C','#7F1D1D'][i]}));
  const metric=(l,v,f)=>`<div class="card"><div class="kpi-label">${l}</div><div class="kpi-value">${v}</div><div class="kpi-foot">${f}</div></div>`;
  return `<div class="grid kpis" style="margin-bottom:14px">
    ${metric('Model version', SETTINGS.modelVersion,'Delay + cost-overrun classifiers')}
    ${metric('Training rows','2,840','Synthetic CUF-like records')}
    ${metric('Delay model ROC-AUC','0.89','Hold-out split, demo data')}
    ${metric('Cost model ROC-AUC','0.84','Hold-out split, demo data')}
    ${metric('Scored projects', ps.length,'Last refreshed '+fdate(TODAY))}</div>
  <div class="grid cols-2">
    <div class="card"><div class="card-head"><div class="card-title">Feature importance</div>
      <div class="card-note">Relative weight, %</div></div>${hbars(imp,{fmt:v=>v+'%'})}
      <p class="small muted" style="margin-top:12px">Gradient-boosted classifier with a random-forest fallback.
        Per-project attribution drives the explanation shown on each project page.</p></div>
    <div class="card"><div class="card-head"><div class="card-title">Prediction distribution</div></div>
      ${donut(dist)}
      <div class="small muted" style="margin-top:14px">Scores follow the configured thresholds:
        Low below ${SETTINGS.tLow}, Medium to ${SETTINGS.tHigh-1}, High to ${SETTINGS.tCrit-1}, Critical above.</div></div>
    <div class="card"><div class="card-head"><div class="card-title">Evaluation on the hold-out split</div>
      <div class="card-note">Delay classifier</div></div>
      <dl style="margin:0"><div class="kv"><dt>Precision</dt><dd>0.82</dd></div>
      <div class="kv"><dt>Recall</dt><dd>0.79</dd></div><div class="kv"><dt>F1 score</dt><dd>0.80</dd></div>
      <div class="kv"><dt>Brier score</dt><dd>0.11</dd></div>
      <div class="kv"><dt>Calibration</dt><dd>Isotonic</dd></div></dl>
      <p class="small muted" style="margin-top:12px">Figures are from the synthetic demo dataset and are not a
        claim about live project outcomes.</p></div>
    <div class="card"><div class="card-head"><div class="card-title">Scoring pipeline</div></div>
      <ul class="timeline">
        <li><span class="tl-dot"></span><div><b style="font-size:13.5px">Periodic return received</b>
          <div class="small muted">Agency files progress, expenditure and clearance status.</div></div></li>
        <li><span class="tl-dot"></span><div><b style="font-size:13.5px">Feature engineering</b>
          <div class="small muted">Progress gap, cost-overrun ratio, slippage, land and milestone ratios.</div></div></li>
        <li><span class="tl-dot"></span><div><b style="font-size:13.5px">Delay and cost-overrun scoring</b>
          <div class="small muted">Two classifiers return calibrated probabilities.</div></div></li>
        <li><span class="tl-dot"></span><div><b style="font-size:13.5px">Explanation and alerting</b>
          <div class="small muted">Drivers, suggested review focus and rule-based alerts are generated.</div></div></li>
        <li><span class="tl-dot"></span><div><b style="font-size:13.5px">Officer review</b>
          <div class="small muted">IPMD officer reviews, records an intervention and closes the loop.</div></div></li>
      </ul>
      ${S.user.role!=='VIEWER'?`<button class="btn" style="margin-top:6px" data-act="refreshAll">${ic('refresh',14)} Refresh all predictions</button>`:''}</div>
  </div>`;
}

/* --------------------------------------------------------------- admin */
function viewAdmin(){
  const num=(k,label,help,min,max,step)=>`<div class="field"><label>${label}</label>
    <input class="input" type="number" data-setting="${k}" value="${SETTINGS[k]}" min="${min}" max="${max}" step="${step||1}">
    <div class="small muted" style="margin-top:4px">${help}</div></div>`;
  return `<div class="grid cols-2" style="align-items:start">
    <div class="stack">
      <div class="card"><div class="card-head"><div class="card-title">Risk thresholds</div>
        <div class="card-note">Applied to every score</div></div>
        ${num('tLow','Medium band starts at','Scores below this are Low.',1,99)}
        ${num('tHigh','High band starts at','Triggers a high-risk alert.',2,99)}
        ${num('tCrit','Critical band starts at','Triggers a critical-risk alert.',3,100)}
        ${num('staleDays','Stale data after (days)','Raises a stale-data alert and a review prompt.',1,365)}
        <button class="btn btn-primary" data-act="saveSettings">Save thresholds</button>
        <button class="btn" data-act="resetSettings" style="margin-left:8px">Reset to defaults</button></div>
      <div class="card"><div class="card-head"><div class="card-title">Risk score weights</div>
        <div class="card-note">Must total 1.00</div></div>
        ${num('wDelay','Delay probability weight','Default 0.55.',0,1,0.05)}
        ${num('wCost','Cost-overrun probability weight','Default 0.45.',0,1,0.05)}
        <div class="small muted">Overall score = 100 × (w<sub>delay</sub> × delay probability + w<sub>cost</sub> × cost-overrun probability).</div>
        <button class="btn btn-primary" style="margin-top:14px" data-act="saveSettings">Save weights</button></div>
    </div>
    <div class="stack">
      <div class="card"><div class="card-head"><div class="card-title">Model</div></div>
        <dl style="margin:0"><div class="kv"><dt>Active version</dt><dd>${esc(SETTINGS.modelVersion)}</dd></div>
        <div class="kv"><dt>Algorithm</dt><dd>Gradient boosting (RF fallback)</dd></div>
        <div class="kv"><dt>Last trained</dt><dd>${fdate('2026-08-18')}</dd></div>
        <div class="kv"><dt>Scoring schedule</dt><dd>Nightly + on data import</dd></div></dl>
        <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
          <button class="btn" data-act="refreshAll">${ic('refresh',14)} Refresh all predictions</button>
          <button class="btn" data-act="retrain">Trigger retraining</button></div></div>
      <div class="card"><div class="card-head"><div class="card-title">Users</div>
        <div class="card-note">${USERS.length} demo accounts</div></div>
        <div class="table-wrap" style="border:none"><table style="min-width:420px"><thead><tr>
          <th>Name</th><th>Email</th><th>Role</th><th>Organisation</th></tr></thead><tbody>
          ${USERS.map(u=>`<tr><td style="font-weight:500">${esc(u.name)}</td><td class="small">${esc(u.email)}</td>
          <td class="small">${ROLE_LABEL[u.role]}</td><td class="small muted">${esc(u.org)}</td></tr>`).join('')}
        </tbody></table></div></div>
      <div class="card"><div class="card-head"><div class="card-title">Data governance</div></div>
        <p class="small muted">This prototype runs entirely on synthetic CUF-like project data generated for
          SIH demonstration. It does not read confidential or live PAIMANA/OCMS data. A production deployment
          would require encryption at rest, government SSO, an independent security audit, authorised API
          access and data-governance approval.</p></div>
    </div></div>`;
}
