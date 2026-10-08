'use strict';
(() => {
  const t=window.MaplyI18n?.t||((text)=>text);
  const $=id=>document.getElementById(id),C=window.MaplyCategories,settings=window.MaplySettings;
  if(!window.MaplyI18n||!C||!settings||!window.MaplyAPI||!window.MaplyEventCard||!window.MaplyMap||!window.MaplyMarkers){$('status').textContent=t("\u0424\u0430\u0439\u043b\u044b \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u044f \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043b\u0438\u0441\u044c. \u041e\u0431\u043d\u043e\u0432\u0438 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443.");return;}
  const TYPES=C.types;let db,user=null,engine,markers,menu,signingUp=false,selectedPoint=null,placing=false,step=1,submitting=false,toastTimer,installPrompt;
  let resumeAfterLogin=false,resumePoint=null,activeFilter='all',activeGroup='all',listController;
  const api=window.MaplyAPI.create(()=>db);
  try{const f=localStorage.getItem('maply-event-filter'),g=localStorage.getItem('maply-event-group');if(f==='all'||Object.hasOwn(TYPES,f))activeFilter=f;if(['all','events','infrastructure'].includes(g))activeGroup=g;}catch{}
  function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('toast').hidden=true;},5000);}
  function status(text,error=false){$('status-text').textContent=text;$('status').hidden=!text;$('status').classList.toggle('error',error);$('retry').hidden=!error;}
  function message(id,text,success=false){$(id).textContent=text;$(id).classList.toggle('success',success);}
  function errorText(error){
    const text=String(error?.message||error||'');
    if(text.includes('MAPLY_MARKER_UNAVAILABLE'))return t("\u0421\u043e\u0431\u044b\u0442\u0438\u0435 \u0443\u0436\u0435 \u0441\u043a\u0440\u044b\u0442\u043e, \u0443\u0434\u0430\u043b\u0435\u043d\u043e \u0438\u043b\u0438 \u0435\u0433\u043e \u0441\u0440\u043e\u043a \u0438\u0441\u0442\u0451\u043a.");
    if(text.includes('MAPLY_RATE_LIMIT'))return t("\u0417\u0430 \u0447\u0430\u0441 \u043c\u043e\u0436\u043d\u043e \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c 20 \u0441\u043e\u0431\u044b\u0442\u0438\u0439. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u043f\u043e\u0437\u0436\u0435.");
    if(text.includes('MAPLY_REPORT_LIMIT'))return t("\u0421\u0435\u0433\u043e\u0434\u043d\u044f \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e \u043c\u043d\u043e\u0433\u043e \u0436\u0430\u043b\u043e\u0431. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u0437\u0430\u0432\u0442\u0440\u0430.");
    if(text.includes('MAPLY_REPORT_NOT_READY'))return t("\u041f\u0440\u0438\u0451\u043c \u0436\u0430\u043b\u043e\u0431 \u043f\u043e\u043a\u0430 \u043d\u0435 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0451\u043d.");
    if(text.includes('Invalid login credentials'))return t("\u041f\u0440\u043e\u0432\u0435\u0440\u044c email \u0438 \u043f\u0430\u0440\u043e\u043b\u044c.");
    if(text.includes('Email not confirmed'))return t("\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438 email \u043f\u043e \u0441\u0441\u044b\u043b\u043a\u0435 \u0432 \u043f\u0438\u0441\u044c\u043c\u0435, \u0437\u0430\u0442\u0435\u043c \u0432\u043e\u0439\u0434\u0438.");
    if(text.includes('Password'))return t("\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439 \u043f\u0430\u0440\u043e\u043b\u044c \u043d\u0435 \u043a\u043e\u0440\u043e\u0447\u0435 8 \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432.");
    if(text.includes('already registered'))return t("\u042d\u0442\u043e\u0442 email \u0443\u0436\u0435 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u043d. \u0412\u044b\u0431\u0435\u0440\u0438 \u00ab\u0412\u043e\u0439\u0442\u0438\u00bb.");
    if(text.includes('rate limit')||text.includes('security purposes'))return t("\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u043c\u043d\u043e\u0433\u043e \u043f\u043e\u043f\u044b\u0442\u043e\u043a. \u041f\u043e\u0434\u043e\u0436\u0434\u0438 \u043d\u0435\u0441\u043a\u043e\u043b\u044c\u043a\u043e \u043c\u0438\u043d\u0443\u0442.");
    if(!navigator.onLine||text.includes('fetch')||text.includes('Network'))return t("\u041d\u0435\u0442 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f. \u041f\u0440\u043e\u0432\u0435\u0440\u044c \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442 \u0438 \u043f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u0441\u043d\u043e\u0432\u0430.");
    if(text.includes('JWT')||text.includes('MAPLY_LOGIN_REQUIRED')||error?.code==='42501')return t("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c \u0432\u0445\u043e\u0434. \u0412\u043e\u0439\u0434\u0438 \u0432 \u0430\u043a\u043a\u0430\u0443\u043d\u0442 \u0435\u0449\u0451 \u0440\u0430\u0437.");
    if(text.includes('maply_vote')||error?.code==='PGRST202')return t("\u042d\u0442\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043f\u043e\u043a\u0430 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u043f\u043e\u0437\u0436\u0435.");
    return t("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u044c \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u0435\u0449\u0451 \u0440\u0430\u0437.");
  }
  const wrap=n=>((n+180)%360+360)%360-180;
  function matchesGroup(type){return activeGroup==='all'||TYPES[type]?.group===activeGroup;}
  function applyFilters(){
    if(activeFilter!=='all'&&!matchesGroup(activeFilter))activeFilter='all';
    try{localStorage.setItem('maply-event-filter',activeFilter);localStorage.setItem('maply-event-group',activeGroup);}catch{}
    document.querySelectorAll('[data-filter]').forEach(b=>{b.hidden=b.dataset.filter!=='all'&&!matchesGroup(b.dataset.filter);const on=b.dataset.filter===activeFilter;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});
    document.querySelectorAll('[data-group]').forEach(b=>{const on=b.dataset.group===activeGroup;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});
    $('reset-filters').hidden=activeGroup==='all'&&activeFilter==='all';$('filter-caption').textContent=activeFilter==='all'?'':', '+TYPES[activeFilter].name;
    markers?.render();
  }
  function chooseFilter(value){if(value!=='all'&&!Object.hasOwn(TYPES,value))return;if(value!=='all'&&!matchesGroup(value))activeGroup='all';activeFilter=value;applyFilters();}
  function buildCategories(){
    const nav=$('event-filters');nav.replaceChildren();
    const addFilter=(key,name,emoji,color)=>{const b=document.createElement('button');b.type='button';b.className='filter-button';b.dataset.filter=key;b.style.setProperty('--category',color);const i=document.createElement('span');i.textContent=emoji;i.setAttribute('aria-hidden','true');b.append(i,document.createTextNode(name));b.addEventListener('click',()=>chooseFilter(key));nav.append(b);};
    addFilter('all',t("\u0412\u0441\u0435"),'','#102b46');for(const [key,type]of Object.entries(TYPES))addFilter(key,type.name,type.emoji,type.color);
    const grid=$('category-grid');grid.replaceChildren();const supported=api.features().extended?Object.keys(TYPES):C.legacy;
    for(const [key,type]of Object.entries(TYPES)){const b=document.createElement('button');b.type='button';b.className='category-choice';b.style.setProperty('--category',type.color);b.dataset.category=key;b.disabled=!supported.includes(key);b.textContent=type.emoji+' '+type.name+(b.disabled?' \u00b7 '+t("\u0421\u043a\u043e\u0440\u043e"):'');b.setAttribute('aria-pressed',String($('type').value===key));b.addEventListener('click',()=>{$('type').value=key;document.querySelectorAll('[data-category]').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.category===key)));});grid.append(b);}
    $('happening-now-row').hidden=!api.features().extended;
    $('category-note').hidden=api.features().extended;applyFilters();
  }
  function showStep(value){step=value;document.querySelectorAll('[data-step]').forEach(n=>{n.hidden=Number(n.dataset.step)!==step;});$('pin-title').textContent=['',t("\u0427\u0442\u043e \u043f\u0440\u043e\u0438\u0437\u043e\u0448\u043b\u043e?"),t("\u0413\u0434\u0435 \u043f\u0440\u043e\u0438\u0437\u043e\u0448\u043b\u043e?"),t("\u0414\u0435\u0442\u0430\u043b\u0438 \u0441\u043e\u0431\u044b\u0442\u0438\u044f")][step];$('step-caption').textContent=t("\u0428\u0430\u0433 {step} \u0438\u0437 3",{step});$('pin-back').hidden=step===1;$('pin-next').hidden=step===3;$('pin-submit').hidden=step!==3;message('pin-message','');updatePoint();}
  function updatePoint(){
    $('coordinates').textContent=selectedPoint?t("\u0412\u044b\u0431\u0440\u0430\u043d\u043e \u043c\u0435\u0441\u0442\u043e: {lat}, {lng}",{lat:selectedPoint.lat.toFixed(5),lng:wrap(selectedPoint.lng).toFixed(5)}):t("\u0412\u044b\u0431\u0435\u0440\u0438 \u043c\u0435\u0441\u0442\u043e \u043d\u0430 \u043a\u0430\u0440\u0442\u0435 \u0438\u043b\u0438 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439 \u0433\u0435\u043e\u043b\u043e\u043a\u0430\u0446\u0438\u044e.");
    engine?.selectPoint(placing?selectedPoint:null);
  }
  function cancelPlacement(){placing=false;$('placement').hidden=true;document.body.classList.remove('placing');engine?.selectPoint(null);}
  function closeDraft(){if(submitting)return;cancelPlacement();selectedPoint=null;$('pin-dialog').close();}
  function beginPlacement(point=null){
    if(submitting)return;
    if(!navigator.onLine)return toast(t("\u0414\u043b\u044f \u043f\u0443\u0431\u043b\u0438\u043a\u0430\u0446\u0438\u0438 \u043d\u0443\u0436\u0435\u043d \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442."));if(!db||!engine)return toast(t("\u041f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u0435\u0449\u0451 \u0437\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u0442\u0441\u044f. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u0447\u0435\u0440\u0435\u0437 \u043d\u0435\u0441\u043a\u043e\u043b\u044c\u043a\u043e \u0441\u0435\u043a\u0443\u043d\u0434."));
    if(!user){resumeAfterLogin=true;resumePoint=point;message('auth-message',t("\u0412\u043e\u0439\u0434\u0438, \u0447\u0442\u043e\u0431\u044b \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0441\u043e\u0431\u044b\u0442\u0438\u0435."));$('auth-dialog').showModal();return;}
    markers?.close();cancelPlacement();$('pin-form').reset();$('type').value='accident';
    const geo=engine.location();selectedPoint=point||(geo&&Date.now()-geo.timestamp<300000?{lat:geo.lat,lng:geo.lng}:null);
    buildCategories();showStep(1);$('pin-dialog').showModal();
  }
  function updateAccount(){
    $('account').textContent=user?t("\u0410\u043a\u043a\u0430\u0443\u043d\u0442"):t("\u041c\u0435\u043d\u044e");menu?.profile();$('auth-title').textContent=user?t("\u041f\u0440\u043e\u0444\u0438\u043b\u044c"):signingUp?t("\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0430\u043a\u043a\u0430\u0443\u043d\u0442"):t("\u0412\u0445\u043e\u0434 \u0432 Maply");
    $('auth-submit').textContent=signingUp?t('\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c\u0441\u044f'):t('\u0412\u043e\u0439\u0442\u0438');$('auth-switch').textContent=signingUp?t('\u0423\u0436\u0435 \u0435\u0441\u0442\u044c \u0430\u043a\u043a\u0430\u0443\u043d\u0442? \u0412\u043e\u0439\u0442\u0438'):t('\u041d\u0435\u0442 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430? \u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c\u0441\u044f');if(!submitting)$('pin-submit').textContent=t('\u041e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u0442\u044c \u0441\u043e\u0431\u044b\u0442\u0438\u0435');
    $('signed-in').hidden=!user;$('auth-form').hidden=Boolean(user);$('user-email').textContent=user?.email||'';
    if(user&&resumeAfterLogin){const point=resumePoint;resumeAfterLogin=false;resumePoint=null;$('auth-dialog').close();beginPlacement(point);}
    if(!user&&!submitting)closeDraft();
  }
  function openLogin(text=t("\u0412\u043e\u0439\u0434\u0438, \u0447\u0442\u043e\u0431\u044b \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c \u0441\u043e\u0431\u044b\u0442\u0438\u0435.")){resumeAfterLogin=false;resumePoint=null;message('auth-message',text);$('auth-dialog').showModal();}
  async function logout(){if(!db)return;$('logout').disabled=true;try{const {error}=await db.auth.signOut({scope:'local'});if(error)throw error;user=null;updateAccount();$('auth-dialog').close();markers?.authChanged();toast(t("\u0422\u044b \u0432\u044b\u0448\u0435\u043b \u0438\u0437 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430."));}catch(e){message('auth-message',errorText(e));toast(errorText(e));}finally{$('logout').disabled=false;}}
  async function openList(mode='area'){
    if(mode!=='area'&&!user){openLogin(t("\u0412\u043e\u0439\u0434\u0438, \u0447\u0442\u043e\u0431\u044b \u043f\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u0441\u0432\u043e\u0438 \u0441\u043e\u0431\u044b\u0442\u0438\u044f \u0438 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u044f."));return;}
    markers?.close();listController?.abort();listController=new AbortController();const request=listController,viewer=user?.id;
    $('list-title').textContent=mode==='mine'?t("\u041c\u043e\u0438 \u0441\u043e\u0431\u044b\u0442\u0438\u044f"):mode==='votes'?t("\u041c\u043e\u0438 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u044f"):t("\u0421\u043e\u0431\u044b\u0442\u0438\u044f \u0432 \u043e\u0431\u043b\u0430\u0441\u0442\u0438");$('list-content').replaceChildren(window.MaplyEventCard.el('p',t("\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430\u2026"),'small'));for(let i=0;i<3;i++){const skeleton=window.MaplyEventCard.el('div',undefined,'skeleton-row');skeleton.setAttribute('aria-hidden','true');$('list-content').append(skeleton);}$('list-dialog').showModal();
    try{const rows=mode==='area'?markers.list():await api.mine(viewer,mode,request.signal);if(request.signal.aborted||!$('list-dialog').open||(mode!=='area'&&viewer!==user?.id))return;
      const box=$('list-content');box.replaceChildren();if(!rows.length)box.append(window.MaplyEventCard.el('p',mode==='area'?t("\u0412 \u044d\u0442\u043e\u0439 \u043e\u0431\u043b\u0430\u0441\u0442\u0438 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0441\u043e\u0431\u044b\u0442\u0438\u0439. \u0415\u0441\u043b\u0438 \u0437\u0430\u043c\u0435\u0442\u0438\u043b\u0438 \u0447\u0442\u043e-\u0442\u043e \u0432\u0430\u0436\u043d\u043e\u0435, \u0434\u043e\u0431\u0430\u0432\u044c\u0442\u0435 \u043c\u0435\u0442\u043a\u0443 \u043d\u0430 \u043a\u0430\u0440\u0442\u0443."):t("\u0417\u0434\u0435\u0441\u044c \u043f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0445 \u0441\u043e\u0431\u044b\u0442\u0438\u0439. \u0417\u0430\u043a\u0440\u044b\u0442\u044b\u0435 \u0441\u043e\u0431\u044b\u0442\u0438\u044f \u043d\u0435 \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u044e\u0442\u0441\u044f."),'small'));
      if(mode!=='area')box.append(window.MaplyEventCard.el('p',t("\u0414\u043e 100 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0445 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0445 \u0441\u043e\u0431\u044b\u0442\u0438\u0439."),'small'));
      for(const p of rows){const type=TYPES[p.type]||TYPES.custom,b=window.MaplyEventCard.el('button',type.emoji+' '+p.title,'list-event');b.type='button';b.addEventListener('click',()=>{if(!C.available(p)){toast(t("\u0421\u043e\u0431\u044b\u0442\u0438\u0435 \u0443\u0436\u0435 \u0437\u0430\u043a\u0440\u044b\u0442\u043e."));return;}$('list-dialog').close();settings.set('showOld',true);settings.set('enabledTypes',Array.from(new Set([...settings.get().enabledTypes,p.type])));chooseFilter(p.type);engine.map.setView([p.lat,p.lng],16,{animate:false});markers.adopt(p);});box.append(b);}
    }catch(e){if(!request.signal.aborted)$('list-content').replaceChildren(window.MaplyEventCard.el('p',errorText(e),'message'));}
  }
  function openReport(pin){
    if(!user){openLogin(t("\u0412\u043e\u0439\u0434\u0438, \u0447\u0442\u043e\u0431\u044b \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0436\u0430\u043b\u043e\u0431\u0443."));return;}
    $('report-form').reset();$('report-dialog').dataset.markerId=pin.id;$('report-submit').disabled=!api.features().reports;
    message('report-message',api.features().reports?'':t("\u041f\u0440\u0438\u0451\u043c \u0436\u0430\u043b\u043e\u0431 \u043f\u043e\u043a\u0430 \u043d\u0435 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0451\u043d. \u0416\u0430\u043b\u043e\u0431\u0430 \u043d\u0435 \u0431\u0443\u0434\u0435\u0442 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0430."));$('report-dialog').showModal();
  }
  menu=settings.init({getUser:()=>user,openAccount:()=>openLogin(''),configureTypes:()=>{$('types-dialog').showModal();},notify:toast,openMine:openList,logout});
  let displayedLanguage=window.MaplyI18n.language();
  settings.subscribe(()=>{engine?.settingsChanged();markers?.render();if(displayedLanguage!==window.MaplyI18n.language()){displayedLanguage=window.MaplyI18n.language();buildCategories();updateAccount();if($('pin-dialog').open||placing)showStep(step);}});
  document.querySelectorAll('[data-group]').forEach(b=>b.addEventListener('click',()=>{activeGroup=b.dataset.group;activeFilter='all';applyFilters();}));
  $('reset-filters').addEventListener('click',()=>{activeGroup='all';activeFilter='all';applyFilters();});
  $('account').addEventListener('click',()=>menu.open());$('add').addEventListener('click',()=>beginPlacement());
  $('empty-add').addEventListener('click',()=>beginPlacement());$('summary-button').addEventListener('click',()=>openList());
  $('refresh').addEventListener('click',async()=>{if(await markers?.load())toast(t("\u0421\u043e\u0431\u044b\u0442\u0438\u044f \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u044b."));});
  $('retry').addEventListener('click',()=>db?markers?.load():location.reload());
  $('locate').addEventListener('click',()=>engine?.requestLocation());
  $('geo-retry').addEventListener('click',()=>engine?.requestLocation());$('geo-settings').addEventListener('click',()=>{$('geo-help').hidden=true;toast(t("\u041e\u0442\u043a\u0440\u043e\u0439 \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043d\u0438\u0439 \u0441\u0430\u0439\u0442\u0430 \u0432 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435 \u0438 \u0440\u0430\u0437\u0440\u0435\u0448\u0438 \u0434\u043e\u0441\u0442\u0443\u043f \u043a \u043c\u0435\u0441\u0442\u043e\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u044e."));});
  $('geo-manual').addEventListener('click',()=>{$('geo-help').hidden=true;beginPlacement();});
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
  $('pin-close').addEventListener('click',closeDraft);$('pin-dialog').addEventListener('cancel',e=>{e.preventDefault();closeDraft();});
  $('auth-dialog').addEventListener('close',()=>{resumeAfterLogin=false;resumePoint=null;});
  $('list-dialog').addEventListener('close',()=>listController?.abort());
  $('pin-back').addEventListener('click',()=>showStep(Math.max(1,step-1)));
  $('pin-next').addEventListener('click',()=>{if(step===2&&!selectedPoint)return message('pin-message',t("\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0432\u044b\u0431\u0435\u0440\u0438 \u043c\u0435\u0441\u0442\u043e \u0441\u043e\u0431\u044b\u0442\u0438\u044f."));showStep(step+1);});
  $('choose-map').addEventListener('click',()=>{$('pin-dialog').close();placing=true;$('placement').hidden=false;document.body.classList.add('placing');updatePoint();});
  $('confirm-place').addEventListener('click',()=>{if(!selectedPoint)return toast(t("\u041d\u0430\u0436\u043c\u0438 \u043d\u0430 \u043a\u0430\u0440\u0442\u0443 \u0432 \u043c\u0435\u0441\u0442\u0435 \u0441\u043e\u0431\u044b\u0442\u0438\u044f."));cancelPlacement();showStep(2);$('pin-dialog').showModal();});
  $('cancel-placement').addEventListener('click',()=>{cancelPlacement();showStep(2);$('pin-dialog').showModal();});
  $('use-location').addEventListener('click',async()=>{$('use-location').disabled=true;try{const geo=await engine?.requestLocation(false,false);if(geo){selectedPoint={lat:geo.lat,lng:geo.lng};updatePoint();message('pin-message',t("\u041c\u0435\u0441\u0442\u043e\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u0432\u044b\u0431\u0440\u0430\u043d\u043e."),true);}else message('pin-message',t("\u0412\u044b\u0431\u0435\u0440\u0438 \u043c\u0435\u0441\u0442\u043e \u0432\u0440\u0443\u0447\u043d\u0443\u044e \u043d\u0430 \u043a\u0430\u0440\u0442\u0435."));}finally{$('use-location').disabled=false;}});
  $('pin-form').addEventListener('submit',async e=>{
    e.preventDefault();if(submitting)return;if(step!==3){$('pin-next').click();return;}
    if(!db||!user||!selectedPoint)return message('pin-message',t("\u0412\u043e\u0439\u0434\u0438 \u0438 \u0432\u044b\u0431\u0435\u0440\u0438 \u043c\u0435\u0441\u0442\u043e \u0441\u043e\u0431\u044b\u0442\u0438\u044f."));if(!navigator.onLine)return message('pin-message',t("\u0414\u043b\u044f \u043f\u0443\u0431\u043b\u0438\u043a\u0430\u0446\u0438\u0438 \u043d\u0443\u0436\u0435\u043d \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442."));
    const type=$('type').value,title=$('title').value.trim()||(type==='custom'?'':TYPES[type]?.name),description=$('description').value.trim();
    if(!title||title.length>80)return message('pin-message',t("\u0423\u043a\u0430\u0436\u0438 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0434\u043e 80 \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432."));if(description.length>200)return message('pin-message',t("\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u0434\u043e\u043b\u0436\u043d\u043e \u0431\u044b\u0442\u044c \u043d\u0435 \u0434\u043b\u0438\u043d\u043d\u0435\u0435 200 \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432."));
    if(!api.features().extended&&!C.legacy.includes(type))return message('pin-message',t("\u042d\u0442\u0430 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f \u043f\u043e\u043a\u0430 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430."));
    submitting=true;const controls=[...$('pin-dialog').querySelectorAll('button,input,textarea')];const states=controls.map(n=>n.disabled);controls.forEach(n=>{n.disabled=true;});$('pin-submit').textContent=t("\u041f\u0443\u0431\u043b\u0438\u043a\u0443\u0435\u043c\u2026");$('pin-form').setAttribute('aria-busy','true');message('pin-message','');
    const point={...selectedPoint};
    try{
      const pin=await api.publish({user_id:user.id,type,title,description,lat:point.lat,lng:point.lng,happening_now:$('happening-now').checked});
      $('pin-dialog').close();selectedPoint=null;cancelPlacement();settings.set('showOld',true);settings.set('enabledTypes',Array.from(new Set([...settings.get().enabledTypes,type])));chooseFilter(type);engine.map.setView([point.lat,point.lng],16,{animate:false});
      toast(t("\u0421\u043e\u0431\u044b\u0442\u0438\u0435 \u043e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d\u043e."));if(pin)markers.adopt(pin);await markers.load();if(pin)markers.open(pin.id);
    }catch(error){message('pin-message',errorText(error));}
    finally{submitting=false;controls.forEach((n,i)=>{n.disabled=states[i];});$('pin-submit').textContent=t("\u041e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u0442\u044c \u0441\u043e\u0431\u044b\u0442\u0438\u0435");$('pin-form').setAttribute('aria-busy','false');}
  });
  $('report-form').addEventListener('submit',async e=>{
    e.preventDefault();if($('report-submit').disabled)return;if(!user)return openLogin(t("\u0412\u043e\u0439\u0434\u0438, \u0447\u0442\u043e\u0431\u044b \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0436\u0430\u043b\u043e\u0431\u0443."));if(!navigator.onLine)return message('report-message',t("\u0414\u043b\u044f \u043e\u0442\u043f\u0440\u0430\u0432\u043a\u0438 \u043d\u0443\u0436\u0435\u043d \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442."));
    const markerId=$('report-dialog').dataset.markerId;$('report-submit').disabled=true;
    try{const result=await api.report(markerId,$('report-reason').value,$('report-details').value.trim());message('report-message',result?.already_reported?t("\u0422\u044b \u0443\u0436\u0435 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u044f\u043b \u0436\u0430\u043b\u043e\u0431\u0443 \u043d\u0430 \u044d\u0442\u043e \u0441\u043e\u0431\u044b\u0442\u0438\u0435."):t("\u0416\u0430\u043b\u043e\u0431\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0430. \u0410\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u043e\u0439 \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u0438 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442."),true);}
    catch(error){message('report-message',errorText(error));$('report-submit').disabled=!api.features().reports;}
  });
  // Existing email/password authentication and persistent sessions.
  $('auth-switch').addEventListener('click',()=>{
    signingUp=!signingUp;$('auth-title').textContent=signingUp?t("\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0430\u043a\u043a\u0430\u0443\u043d\u0442"):t("\u0412\u0445\u043e\u0434 \u0432 Maply");$('auth-submit').textContent=signingUp?t("\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c\u0441\u044f"):t("\u0412\u043e\u0439\u0442\u0438");$('auth-switch').textContent=signingUp?t("\u0423\u0436\u0435 \u0435\u0441\u0442\u044c \u0430\u043a\u043a\u0430\u0443\u043d\u0442? \u0412\u043e\u0439\u0442\u0438"):t("\u041d\u0435\u0442 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430? \u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c\u0441\u044f");$('password').autocomplete=signingUp?'new-password':'current-password';message('auth-message','');
  });
  let authBusy=false;
  $('auth-form').addEventListener('submit',async e=>{
    e.preventDefault();if(authBusy)return;if(!db)return message('auth-message',t("\u041f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u0435\u0449\u0451 \u0437\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u0442\u0441\u044f."));if(!navigator.onLine)return message('auth-message',t("\u0414\u043b\u044f \u0432\u0445\u043e\u0434\u0430 \u043d\u0443\u0436\u0435\u043d \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442."));
    authBusy=true;$('auth-submit').disabled=true;$('auth-switch').disabled=true;message('auth-message','');
    try{const credentials={email:$('email').value.trim(),password:$('password').value};const result=signingUp?await db.auth.signUp({...credentials,options:{emailRedirectTo:location.origin+'/'}}):await db.auth.signInWithPassword(credentials);if(result.error)throw result.error;$('password').value='';
      if(signingUp&&!result.data.session)message('auth-message',t("\u041f\u0440\u043e\u0432\u0435\u0440\u044c \u043f\u043e\u0447\u0442\u0443 \u0438 \u043f\u0430\u043f\u043a\u0443 \u00ab\u0421\u043f\u0430\u043c\u00bb. \u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438 email \u043f\u043e \u0441\u0441\u044b\u043b\u043a\u0435 \u0432 \u043f\u0438\u0441\u044c\u043c\u0435, \u0437\u0430\u0442\u0435\u043c \u0432\u043e\u0439\u0434\u0438."),true);
      else{user=result.data.session?.user||null;updateAccount();$('auth-dialog').close();toast(t("\u0422\u044b \u0432\u043e\u0448\u0451\u043b \u0432 Maply."));}}
    catch(error){message('auth-message',errorText(error));}finally{authBusy=false;$('auth-submit').disabled=false;$('auth-switch').disabled=false;}
  });
  $('logout').addEventListener('click',logout);
  const standalone=()=>Boolean(navigator.standalone||window.matchMedia?.('(display-mode: standalone)').matches);
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();if(standalone())return;installPrompt=e;$('install').hidden=false;});
  $('install').addEventListener('click',async()=>{if(!installPrompt||standalone()){$('install').hidden=true;return;}await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('install').hidden=true;});
  const installed=()=>{installPrompt=null;$('install').hidden=true;};window.addEventListener('appinstalled',installed);window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change',e=>{if(e.matches)installed();});
  window.addEventListener('offline',()=>{status(t("\u041d\u0435\u0442 \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442\u0430. \u041a\u0430\u0440\u0442\u0430 \u0438 \u0441\u043e\u0431\u044b\u0442\u0438\u044f \u043c\u043e\u0433\u0443\u0442 \u0431\u044b\u0442\u044c \u0443\u0441\u0442\u0430\u0440\u0435\u0432\u0448\u0438\u043c\u0438."),true);if(placing){cancelPlacement();showStep(2);$('pin-dialog').showModal();}markers?.render();});
  window.addEventListener('online',()=>db?markers?.load():location.reload());document.addEventListener('visibilitychange',()=>{if(!document.hidden)markers?.load();});
  async function init(){
    if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>toast(t("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0443 \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u044f. \u041a\u0430\u0440\u0442\u0430 \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442 \u0432 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435.")));
    buildCategories();engine=await window.MaplyMap.create({notify:toast,status,getSettings:settings.get,getStyle:settings.mapStyle,onMove:()=>markers?.schedule(),onLocation:()=>markers?.render(),
      onClick:e=>{if(placing){selectedPoint=e.latlng;updatePoint();}},onLongPress:p=>{if(!document.querySelector('dialog[open]')&&!placing)beginPlacement(p);}});
    markers=window.MaplyMarkers.create({engine,api,getUser:()=>user,getSettings:settings.get,matchesPin:p=>matchesGroup(p.type)&&(activeFilter==='all'||activeFilter===p.type)&&settings.get().enabledTypes.includes(p.type),toast,status,errorText,openLogin,onReport:openReport});
    if(!window.supabase)throw new Error('MAPLY_AUTH_RESOURCE');
    let config;
    if(navigator.onLine){const ac=new AbortController(),t=setTimeout(()=>ac.abort(),15000);try{const response=await fetch('/api/config',{cache:'no-store',signal:ac.signal});config=await response.json();if(!response.ok)throw new Error('MAPLY_CONFIG');try{localStorage.setItem('maply-public-config',JSON.stringify(config));}catch{}}finally{clearTimeout(t);}}
    else{try{config=JSON.parse(localStorage.getItem('maply-public-config'));}catch{}if(!config)throw new Error('MAPLY_CONFIG');}
    if(typeof config?.url!=='string'||typeof config?.key!=='string')throw new Error('MAPLY_CONFIG');
    db=window.supabase.createClient(config.url,config.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'}});
    db.auth.onAuthStateChange((_e,session)=>{user=session?.user||null;updateAccount();markers.authChanged();});
    const {data,error}=await db.auth.getSession();if(error)throw error;user=data.session?.user||null;updateAccount();
    try{await api.detect();}catch{}buildCategories();
    await markers.load();engine.requestLocation(true);
    setInterval(()=>{if(document.hidden)return;markers.expire();if(settings.get().autoRefresh)markers.load();},30000);
    if(location.hash.includes('error')){toast(t("\u0421\u0441\u044b\u043b\u043a\u0430 \u0434\u043b\u044f \u0432\u0445\u043e\u0434\u0430 \u0443\u0441\u0442\u0430\u0440\u0435\u043b\u0430. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u0432\u043e\u0439\u0442\u0438 \u0441\u043d\u043e\u0432\u0430."));history.replaceState(null,'',location.pathname);}
  }
  function sizeUI(){const r=$('map-chrome').getBoundingClientRect();document.documentElement.style.setProperty('--chrome-height',Math.ceil(r.bottom+8)+'px');document.documentElement.style.setProperty('--status-bottom',Math.ceil($('status').hidden?r.bottom+8:$('status').getBoundingClientRect().bottom)+'px');const v=window.visualViewport;document.documentElement.style.setProperty('--viewport-height',(v?.height||window.innerHeight)+'px');document.documentElement.style.setProperty('--keyboard-inset',Math.max(0,window.innerHeight-(v?.height||window.innerHeight)-(v?.offsetTop||0))+'px');}
  if(window.ResizeObserver){const observer=new ResizeObserver(sizeUI);observer.observe($('map-chrome'));observer.observe($('status'));}window.addEventListener('resize',sizeUI);window.visualViewport?.addEventListener('resize',sizeUI);sizeUI();
  init().catch(error=>status(errorText(error),true));
})();
