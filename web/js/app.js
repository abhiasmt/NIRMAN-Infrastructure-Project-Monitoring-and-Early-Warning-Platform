/* NIRMAN — modal, event handling, router, boot. Loaded last. */

/* --------------------------------------------------------------- modal */
function interventionModal(p){
  return `<div class="overlay" data-act="closeModal"><div class="modal" data-stop>
    <div class="modal-head"><div class="card-title">Create intervention</div>
      <button class="icon-btn" style="margin-left:auto" data-act="closeModal" aria-label="Close">${ic('x',18)}</button></div>
    <div class="modal-body">
      <p class="small muted" style="margin-bottom:16px">${esc(p.projectCode)} · ${esc(p.projectName)}</p>
      <div class="field"><label for="ivType">Intervention type</label>
        <select class="input" id="ivType">${INTERVENTION_TYPES.map(t=>`<option>${t}</option>`).join('')}</select></div>
      <div class="field"><label for="ivDesc">Description</label>
        <textarea class="input" id="ivDesc" rows="3" placeholder="What should the reviewing authority examine?"></textarea></div>
      <div class="field"><label for="ivAuth">Assigned authority</label>
        <input class="input" id="ivAuth" value="${esc(p.agency)}"></div>
      <div class="field"><label for="ivDue">Due date</label>
        <input class="input" id="ivDue" type="date" value="${iso(addMonths(TODAY,1))}"></div>
    </div>
    <div class="modal-foot"><button class="btn" data-act="closeModal">Cancel</button>
      <button class="btn btn-primary" data-act="saveIntervention" data-id="${p.id}">Create intervention</button></div>
  </div></div>`;
}

/* ------------------------------------------------------------- actions */
function toast(msg){ S.toast = msg; render(); setTimeout(()=>{ S.toast=null; render(); }, 2600); }
function go(route){ S.route = route; S.menu=false; S.drawer=false; window.scrollTo(0,0); render(); }

function handle(act, el, ev){
  switch(act){
    case 'login': {
      const email = $('#em').value.trim().toLowerCase(), pw = $('#pw').value;
      const u = USERS.find(x=>x.email===email);
      if (!u || pw!=='Demo@123') return renderLogin('Incorrect email or password. Use a demo account below.');
      S.user = u; store.set('session', u.email);
      S.route = ROLE_NAV[u.role][0]; render(); break;
    }
    case 'quick': {
      const u = USERS.find(x=>x.email===el.dataset.email);
      S.user = u; store.set('session', u.email); S.route = ROLE_NAV[u.role][0]; render(); break;
    }
    case 'logout': S.user=null; S.menu=false; store.set('session',null); renderLogin(); break;
    case 'go': go(el.dataset.route); break;
    case 'toggleSidebar':
      if (window.innerWidth<=860) S.drawer=!S.drawer; else S.collapsed=!S.collapsed; render(); break;
    case 'closeDrawer': S.drawer=false; render(); break;
    case 'menu': S.menu=!S.menu; render(); break;
    case 'open': S.projectId = el.dataset.id; S.tab='overview'; S.route='detail'; window.scrollTo(0,0); render(); break;
    case 'tab': S.tab = el.dataset.tab; render(); break;
    case 'clearFilters':
      S.filters = {q:'',ministry:'',sector:'',state:'',agency:'',level:'',status:'',stale:'',minCost:''}; render(); break;
    case 'clearAlertFilters': S.alertFilters={severity:'',type:'',status:'',ministry:''}; render(); break;
    case 'refreshAll': recomputeAll(); persist(); toast('Risk scores refreshed for '+S.projects.length+' projects'); break;
    case 'refreshOne': {
      const p = S.projects.find(x=>x.id===el.dataset.id);
      p.prediction = predict(p); recomputeAll(); persist();
      toast('Risk score refreshed — now '+p.prediction.overallRiskScore+'/100'); break;
    }
    case 'ackAlert': {
      const a = S.alerts.find(x=>x.id===el.dataset.id);
      a.status='Acknowledged'; a.assignedTo=S.user.name; persist(); toast('Alert acknowledged'); break;
    }
    case 'resolveAlert': {
      const a = S.alerts.find(x=>x.id===el.dataset.id);
      a.status='Resolved'; persist(); toast('Alert resolved'); break;
    }
    case 'advanceIv': {
      const v = S.interventions.find(x=>x.id===el.dataset.id);
      if (v.status==='Open') v.status='In Progress';
      else { v.status='Completed'; v.outcomeNotes = v.outcomeNotes || 'Review completed and recorded by '+S.user.name+'.'; }
      persist(); toast('Intervention marked '+v.status.toLowerCase()); break;
    }
    case 'newIntervention': {
      const p = S.projects.find(x=>x.id===el.dataset.id);
      S.modal = interventionModal(p); render(); break;
    }
    case 'closeModal': S.modal=null; render(); break;
    case 'saveIntervention': {
      const p = S.projects.find(x=>x.id===el.dataset.id);
      const v = {id:'IV'+Date.now().toString().slice(-6), projectId:p.id, projectCode:p.projectCode,
        projectName:p.projectName, type:$('#ivType').value, description:$('#ivDesc').value.trim()||'Review initiated by the monitoring officer.',
        assignedAuthority:$('#ivAuth').value.trim()||p.agency, dueDate:$('#ivDue').value||iso(addMonths(TODAY,1)),
        status:'Open', outcomeNotes:'', createdAt:iso(TODAY), createdBy:S.user.name};
      S.interventions.unshift(v); S.modal=null; S.tab='interventions'; persist();
      toast('Intervention created and assigned to '+v.assignedAuthority); break;
    }
    case 'pickFile': $('#file').click(); break;
    case 'downloadTemplate': {
      const blob = new Blob([sampleCSV()], {type:'text/csv'});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'nirman_project_update_template.csv'; a.click(); URL.revokeObjectURL(a.href);
      toast('Sample CSV downloaded'); break;
    }
    case 'applyUpload': applyUpload(); break;
    case 'saveSettings': {
      document.querySelectorAll('[data-setting]').forEach(inp=>{
        const v = Number(inp.value); if (!isNaN(v)) SETTINGS[inp.dataset.setting] = v; });
      SETTINGS.tLow = clamp(SETTINGS.tLow,1,98);
      SETTINGS.tHigh = clamp(SETTINGS.tHigh, SETTINGS.tLow+1, 99);
      SETTINGS.tCrit = clamp(SETTINGS.tCrit, SETTINGS.tHigh+1, 100);
      const sum = SETTINGS.wDelay + SETTINGS.wCost;
      if (sum>0){ SETTINGS.wDelay = Math.round(SETTINGS.wDelay/sum*100)/100; SETTINGS.wCost = Math.round((1-SETTINGS.wDelay)*100)/100; }
      recomputeAll(); persist(); toast('Settings saved — scores and alerts recalculated'); break;
    }
    case 'resetSettings': SETTINGS = Object.assign({}, DEFAULT_SETTINGS);
      recomputeAll(); persist(); toast('Settings reset to defaults'); break;
    case 'retrain': toast('Retraining queued — the model service would pick this up in a live deployment'); break;
  }
}
function applyUpload(){
  const u = S.upload; let imported = 0;
  u.rows.forEach(r=>{
    if (r.errors.length) return;
    const p = S.projects.find(x=>x.projectCode===r.data.project_code);
    if (!p) return;
    const set = (k,f)=>{ const v=r.data[f]; if (v!=='' && v!=null && !isNaN(Number(v))) p[k]=Number(v); };
    set('physicalProgressPct','physical_progress_pct'); set('expectedProgressPct','expected_progress_pct');
    set('revisedCostCr','revised_cost_cr'); set('expenditureIncurredCr','expenditure_incurred_cr');
    set('landAcquisitionPct','land_acquisition_pct'); set('monthsOfDelay','months_of_delay');
    if (CLEARANCES.includes(r.data.clearance_status)) p.clearanceStatus = r.data.clearance_status;
    if (r.data.last_updated_date && !isNaN(new Date(r.data.last_updated_date).getTime()))
      p.lastUpdatedDate = iso(new Date(r.data.last_updated_date));
    p.updates.unshift({date:iso(TODAY), physicalProgressPct:p.physicalProgressPct,
      expenditureIncurredCr:p.expenditureIncurredCr, remark:'Imported from '+u.filename+' by '+S.user.name+'.'});
    p.milestones = makeMilestones(p, p.expectedProgressPct-p.physicalProgressPct>16?.85:.3);
    imported++;
  });
  recomputeAll();
  S.uploads.unshift({filename:u.filename, at:iso(TODAY), imported, rejected:u.rejected, by:S.user.name});
  u.applied = true; persist();
  toast(imported+' projects updated — risk scores and alerts refreshed');
}
function readFile(file){
  const reader = new FileReader();
  reader.onload = () => {
    const {header, rows} = parseCSV(String(reader.result));
    const checked = rows.map((r,i)=>validateRow(r,i));
    const missing = CSV_COLUMNS.filter(c=>!header.includes(c));
    S.upload = {filename:file.name, header, preview:rows.slice(0,10), rows:checked,
      total:rows.length, valid:checked.filter(r=>!r.errors.length).length,
      rejected:checked.filter(r=>r.errors.length).length, warnings:missing.length,
      rowErrors:checked.filter(r=>r.errors.length), applied:false};
    if (missing.length) S.upload.rowErrors.unshift({line:1, errors:['missing optional columns: '+missing.join(', ')]});
    render();
  };
  reader.readAsText(file);
}

/* --------------------------------------------------------------- render */
function bodyFor(){
  switch(S.route){
    case 'overview': return viewOverview();
    case 'projects': return viewProjects();
    case 'detail': return viewDetail();
    case 'alerts': return viewAlerts();
    case 'interventions': return viewInterventions();
    case 'upload': return viewUpload();
    case 'analytics': return viewAnalytics();
    case 'model': return viewModel();
    case 'admin': return viewAdmin();
    default: return viewOverview();
  }
}
function renderLogin(err){ $('#root').innerHTML = viewLogin(err); }
function render(){
  if (!S.user) return renderLogin();
  const allowed = ROLE_NAV[S.user.role];
  if (S.route!=='detail' && !allowed.includes(S.route)) S.route = allowed[0];
  if (S.route==='detail' && !allowed.includes('projects')) S.route = allowed[0];
  $('#root').innerHTML = shell(bodyFor());
  const f = $('#file'); if (f) f.onchange = e => { if (e.target.files[0]) readFile(e.target.files[0]); };
  const drop = $('#drop');
  if (drop){
    drop.addEventListener('dragover', e=>{ e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', ()=>drop.classList.remove('over'));
    drop.addEventListener('drop', e=>{ e.preventDefault(); drop.classList.remove('over');
      const file = e.dataTransfer.files[0]; if (file) readFile(file); });
  }
}
/* delegated events */
document.addEventListener('click', e=>{
  const stop = e.target.closest('[data-stop]');
  const el = e.target.closest('[data-act]');
  if (!el){ if (S.menu && !e.target.closest('.topbar-right')){ S.menu=false; render(); } return; }
  if (el.dataset.act==='closeModal' && stop && !e.target.closest('.modal-foot,.modal-head')) return;
  e.preventDefault(); handle(el.dataset.act, el, e);
});
document.addEventListener('keydown', e=>{
  if (e.key==='Enter'){
    const el = e.target.closest('[data-act]');
    if (el && ['go','tab','open','pickFile'].includes(el.dataset.act)){ e.preventDefault(); handle(el.dataset.act, el, e); return; }
    if (!S.user && (e.target.id==='em'||e.target.id==='pw')) handle('login', e.target, e);
  }
  if (e.key==='Escape' && S.modal){ S.modal=null; render(); }
});
document.addEventListener('change', e=>{
  const fk = e.target.dataset.filter, ak = e.target.dataset.afilter;
  if (fk){ S.filters[fk] = e.target.value; render(); }
  else if (ak){ S.alertFilters[ak] = e.target.value; render(); }
});
document.addEventListener('input', e=>{
  if (e.target.dataset.filter==='q'){
    S.filters.q = e.target.value;
    clearTimeout(window.__q); window.__q = setTimeout(()=>{ render();
      const inp = document.querySelector('[data-filter="q"]');
      if (inp){ inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } }, 260);
  }
});
document.addEventListener('click', e=>{
  const th = e.target.closest('th[data-sort]');
  if (!th) return;
  const k = th.dataset.sort;
  S.sort = S.sort.key===k ? {key:k, dir:S.sort.dir==='desc'?'asc':'desc'} : {key:k, dir:'desc'};
  render();
});

/* ----------------------------------------------------------------- boot */
initData();
const saved = store.get('session', null);
if (saved){ const u = USERS.find(x=>x.email===saved); if (u){ S.user=u; S.route=ROLE_NAV[u.role][0]; } }
render();
