'use strict';
(() => {
  const $ = id => document.getElementById(id);
  if (!window.MaplySettings || !window.MaplyMap || !window.MaplyMarkers) {
    $('status').textContent = '\u041d\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043b\u0438\u0441\u044c \u043d\u043e\u0432\u044b\u0435 \u0444\u0430\u0439\u043b\u044b Maply. \u041f\u0440\u043e\u0432\u0435\u0440\u044c, \u0447\u0442\u043e \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u044b map.js, markers.js, settings.js \u0438 \u043e\u0431\u043d\u043e\u0432\u043b\u0451\u043d index.html.';
    $('status').classList.add('error');return;
  }
  const TYPES = {
    accident: {name:'\u0410\u0432\u0430\u0440\u0438\u044f',emoji:'\ud83d\ude97',color:'#dc4949'},
    closed: {name:'\u0414\u043e\u0440\u043e\u0433\u0430 \u0437\u0430\u043a\u0440\u044b\u0442\u0430',emoji:'\u26d4',color:'#dc7133'},
    police: {name:'\u041f\u043e\u043b\u0438\u0446\u0438\u044f',emoji:'\ud83d\ude93',color:'#397dc5'},
    pothole: {name:'\u042f\u043c\u0430',emoji:'\ud83d\udd73\ufe0f',color:'#927129'},
    custom: {name:'\u0421\u0432\u043e\u044f \u043c\u0435\u0442\u043a\u0430',emoji:'\ud83d\udccd',color:'#07887f'}
  };
  let map, db, user = null, markers, mapEngine, menu;
  const settings = window.MaplySettings;
  let placing = false, selectedPoint = null, signingUp = false;
  const FILTER_LABELS = {all:'\u0412\u0441\u0435 \u0441\u043e\u0431\u044b\u0442\u0438\u044f',accident:'\u0410\u0432\u0430\u0440\u0438\u0438',closed:'\u041f\u0435\u0440\u0435\u043a\u0440\u044b\u0442\u0438\u044f',police:'\u041f\u043e\u043b\u0438\u0446\u0438\u044f',pothole:'\u042f\u043c\u044b',custom:'\u0421\u0432\u043e\u044f \u043c\u0435\u0442\u043a\u0430'};
  const EVENT_TYPES = new Set(['accident','closed','police']);
  let activeFilter = 'all', activeGroup = 'all';
  let resumePoint = null;
  try {
    const saved = localStorage.getItem('maply-event-filter');
    if (Object.prototype.hasOwnProperty.call(FILTER_LABELS,saved)) activeFilter = saved;
    const group = localStorage.getItem('maply-event-group');
    if (['all','events','infrastructure'].includes(group)) activeGroup = group;
    if (activeFilter !== 'all' && !matchesGroup(activeFilter)) activeFilter = 'all';
  } catch {}
  let resumeAfterLogin = false, toastTimer, installPrompt;

  function matchesGroup(type) {
    return activeGroup === 'all' || (activeGroup === 'events' ? EVENT_TYPES.has(type) : type === 'pothole');
  }
  function saveFilterChoice() {
    try {localStorage.setItem('maply-event-filter',activeFilter);localStorage.setItem('maply-event-group',activeGroup);} catch {}
  }
  function updateFilterButtons() {
    let selectedButton;
    document.querySelectorAll('[data-filter]').forEach(button => {
      button.hidden = button.dataset.filter !== 'all' && !matchesGroup(button.dataset.filter);
      const selected = button.dataset.filter === activeFilter;
      button.classList.toggle('selected',selected);
      button.setAttribute('aria-pressed',String(selected));
      if (selected) selectedButton = button;
    });
    document.querySelectorAll('[data-group]').forEach(button => {
      const selected = button.dataset.group === activeGroup;
      button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));
    });
    document.body.classList.toggle('infrastructure-filter',activeGroup === 'infrastructure');
    const nav = $('event-filters');
    nav.hidden = activeGroup === 'infrastructure';
    if (selectedButton && (selectedButton.offsetLeft < nav.scrollLeft
      || selectedButton.offsetLeft + selectedButton.offsetWidth > nav.scrollLeft + nav.clientWidth)) {
      nav.scrollLeft = Math.max(0,selectedButton.offsetLeft - (nav.clientWidth - selectedButton.offsetWidth) / 2);
    }
    $('reset-filters').hidden = activeGroup === 'all' && activeFilter === 'all';
    const name = activeFilter === 'all' ? {all:'\u0412\u0441\u0435 \u0441\u043e\u0431\u044b\u0442\u0438\u044f',events:'\u0421\u043e\u0431\u044b\u0442\u0438\u044f',infrastructure:'\u0418\u043d\u0444\u0440\u0430\u0441\u0442\u0440\u0443\u043a\u0442\u0443\u0440\u0430'}[activeGroup] : FILTER_LABELS[activeFilter];
    $('filter-caption').textContent = ', ' + name.toLocaleLowerCase('ru-RU');
  }
  function applyFilterChoice() {
    saveFilterChoice();updateFilterButtons();
    markers?.render();
    if (markers?.isLoaded() && navigator.onLine && !$('refresh').disabled) markers.showStatus();
  }
  function chooseFilter(value) {
    if (!Object.prototype.hasOwnProperty.call(FILTER_LABELS,value)) return;
    if (value !== 'all' && !matchesGroup(value)) activeGroup = 'all';
    activeFilter = value;applyFilterChoice();
  }
  function chooseGroup(value) {
    if (!['all','events','infrastructure'].includes(value)) return;
    activeGroup = value;activeFilter = 'all';applyFilterChoice();
  }
  function openPinForm(point) {
    if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return;
    selectedPoint = point;cancelPlacement();
    $('pin-form').reset();$('title').required = false;
    $('coordinates').textContent = `\u041c\u0435\u0441\u0442\u043e: ${point.lat.toFixed(5)}, ${wrapLng(point.lng).toFixed(5)}`;
    message('pin-message','');$('pin-dialog').showModal();
  }
  const wrapLng = lng => ((lng + 180) % 360 + 360) % 360 - 180;
  function isStandalone() {
    return Boolean(navigator.standalone || window.matchMedia?.('(display-mode: standalone)').matches);
  }

  function toast(text) {
    $('toast').textContent = text; $('toast').hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => {$('toast').hidden = true;},5000);
  }
  function status(text, error = false) {
    $('status').textContent = text; $('status').hidden = !text; $('status').classList.toggle('error',error);
  }
  function message(id,text,success = false) {
    $(id).textContent = text; $(id).classList.toggle('success',success);
  }
  function errorText(error) {
    const text = String(error?.message || error || '');
    if (text.includes('MAPLY_MARKER_UNAVAILABLE')) return '\u041c\u0435\u0442\u043a\u0430 \u0443\u0436\u0435 \u0441\u043a\u0440\u044b\u0442\u0430, \u0443\u0434\u0430\u043b\u0435\u043d\u0430 \u0438\u043b\u0438 \u0435\u0451 \u0441\u0440\u043e\u043a \u0438\u0441\u0442\u0451\u043a.';
    if (text.includes('MAPLY_INVALID_VOTE')) return '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0440\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u0442\u044c \u0433\u043e\u043b\u043e\u0441. \u041e\u0431\u043d\u043e\u0432\u0438 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443.';
    if (text.includes('maply_vote') || text.includes('maply_votes') || text.includes('active_votes') || text.includes('hidden_by_votes') || error?.code === 'PGRST202') return '\u0413\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043d\u0438\u0435 \u0441\u0435\u0439\u0447\u0430\u0441 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u043f\u043e\u0437\u0436\u0435.';
    if (text.includes('MAPLY_RATE_LIMIT')) return '\u0417\u0430 \u0447\u0430\u0441 \u043c\u043e\u0436\u043d\u043e \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c 20 \u043c\u0435\u0442\u043e\u043a. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u043f\u043e\u0437\u0436\u0435.';
    if (text.includes('Invalid login credentials')) return '\u041f\u0440\u043e\u0432\u0435\u0440\u044c email \u0438 \u043f\u0430\u0440\u043e\u043b\u044c.';
    if (text.includes('Email not confirmed')) return '\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438 email \u043f\u043e \u0441\u0441\u044b\u043b\u043a\u0435 \u0432 \u043f\u0438\u0441\u044c\u043c\u0435, \u0437\u0430\u0442\u0435\u043c \u0432\u043e\u0439\u0434\u0438.';
    if (text.includes('rate limit') || text.includes('security purposes')) return '\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u043c\u043d\u043e\u0433\u043e \u043f\u043e\u043f\u044b\u0442\u043e\u043a. \u041f\u043e\u0434\u043e\u0436\u0434\u0438 \u043d\u0435\u0441\u043a\u043e\u043b\u044c\u043a\u043e \u043c\u0438\u043d\u0443\u0442.';
    if (text.includes('email_address_not_authorized') || text.includes('Email address') && text.includes('not authorized')) return '\u041e\u0442\u043f\u0440\u0430\u0432\u043a\u0430 \u043f\u0438\u0441\u0435\u043c \u043d\u0430 \u044d\u0442\u043e\u0442 \u0430\u0434\u0440\u0435\u0441 \u043f\u043e\u043a\u0430 \u043d\u0435 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043d\u0430. \u0412\u043b\u0430\u0434\u0435\u043b\u0435\u0446 Maply \u0434\u043e\u043b\u0436\u0435\u043d \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0438\u0442\u044c SMTP \u0432 Supabase.';
    if (text.includes('Password')) return '\u041f\u0430\u0440\u043e\u043b\u044c \u043d\u0435 \u043f\u043e\u0434\u0445\u043e\u0434\u0438\u0442 \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u044f\u043c. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u0431\u043e\u043b\u0435\u0435 \u0434\u043b\u0438\u043d\u043d\u044b\u0439 \u043f\u0430\u0440\u043e\u043b\u044c.';
    if (text.includes('already registered')) return '\u042d\u0442\u043e\u0442 email \u0443\u0436\u0435 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u043d. \u0412\u044b\u0431\u0435\u0440\u0438 \u00ab\u0412\u043e\u0439\u0442\u0438\u00bb.';
    if (text.includes('Failed to fetch') || text.includes('NetworkError') || !navigator.onLine) return '\u041d\u0435\u0442 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f. \u041f\u0440\u043e\u0432\u0435\u0440\u044c \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442 \u0438 \u043f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u0441\u043d\u043e\u0432\u0430.';
    if (text.includes('maply_markers') || error?.code === 'PGRST205') return '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043c\u0435\u0442\u043a\u0438. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u043e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443.';
    if (error?.code === '42501' || text.includes('JWT') || text.includes('MAPLY_LOGIN_REQUIRED')) return '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c \u0432\u0445\u043e\u0434. \u0412\u044b\u0439\u0434\u0438 \u0438 \u0432\u043e\u0439\u0434\u0438 \u0441\u043d\u043e\u0432\u0430. \u0415\u0441\u043b\u0438 \u043e\u0448\u0438\u0431\u043a\u0430 \u043e\u0441\u0442\u0430\u0451\u0442\u0441\u044f, \u043f\u0440\u043e\u0432\u0435\u0440\u044c \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0431\u0430\u0437\u044b.';
    return '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u044c \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u0441\u043d\u043e\u0432\u0430. ' + text.slice(0,180);
  }
  function cancelPlacement() {
    placing = false; $('placement').hidden = true; document.body.classList.remove('placing');
  }
  function beginPlacement(point = null) {
    if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) point = null;
    if (!navigator.onLine) return toast('\u0414\u043b\u044f \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u0438\u044f \u043c\u0435\u0442\u043a\u0438 \u043d\u0443\u0436\u0435\u043d \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442.');
    if (!db) return toast('\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 \u0435\u0449\u0451 \u043d\u0435 \u0433\u043e\u0442\u043e\u0432\u043e. \u041e\u0431\u043d\u043e\u0432\u0438 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443 \u0438\u043b\u0438 \u043f\u0440\u043e\u0432\u0435\u0440\u044c \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 Vercel.');
    if (!user) {
      resumeAfterLogin = true; resumePoint = point; message('auth-message','\u0412\u043e\u0439\u0434\u0438, \u0447\u0442\u043e\u0431\u044b \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043c\u0435\u0442\u043a\u0443.');
      $('auth-dialog').showModal(); return;
    }
    placing = true; selectedPoint = null; map.closePopup();
    $('placement').hidden = false; document.body.classList.add('placing');
    if (point) openPinForm(point);
  }
  function updateAccount() {
    $('account').textContent = user ? '\u0410\u043a\u043a\u0430\u0443\u043d\u0442' : '\u041c\u0435\u043d\u044e';
    menu?.profile();
    $('auth-title').textContent = user ? '\u0410\u043a\u043a\u0430\u0443\u043d\u0442' : signingUp ? '\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0430\u043a\u043a\u0430\u0443\u043d\u0442' : '\u0412\u0445\u043e\u0434 \u0432 Maply';
    $('signed-in').hidden = !user; $('auth-form').hidden = Boolean(user);
    $('user-email').textContent = user?.email || '';
    if (user && resumeAfterLogin) {
      const point = resumePoint; resumePoint = null;
      resumeAfterLogin = false; $('auth-dialog').close(); beginPlacement(point);
    }
    if (!user) {cancelPlacement(); $('pin-dialog').close();}
  }
  function element(tag,text,className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  menu = settings.init({getUser:() => user,resetFilters:() => chooseGroup('all'),notify:toast,
    openAccount:() => {resumeAfterLogin = false;resumePoint = null;message('auth-message','');$('auth-dialog').showModal();}
  });
  settings.subscribe(() => {mapEngine?.settingsChanged();markers?.render();});

  document.querySelectorAll('[data-filter]').forEach(button => {
    button.addEventListener('click',() => chooseFilter(button.dataset.filter));
  });
  document.querySelectorAll('[data-group]').forEach(button => {
    button.addEventListener('click',() => chooseGroup(button.dataset.group));
  });
  $('reset-filters').addEventListener('click',() => chooseGroup('all'));
  updateFilterButtons();

  $('add').addEventListener('click',() => beginPlacement());
  $('cancel-placement').addEventListener('click',cancelPlacement);
  $('refresh').addEventListener('click',async () => {await markers?.load();if (navigator.onLine && markers?.isLoaded() && !$('status').classList.contains('error')) toast('\u041c\u0435\u0442\u043a\u0438 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u044b.');});
  $('account').addEventListener('click',() => {
    resumeAfterLogin = false; resumePoint = null;menu.open();
  });
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click',() => $(button.dataset.close).close()));
  $('auth-dialog').addEventListener('close',() => {resumeAfterLogin = false;resumePoint = null;});
  $('auth-switch').addEventListener('click',() => {
    signingUp = !signingUp;
    $('auth-title').textContent = signingUp ? '\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0430\u043a\u043a\u0430\u0443\u043d\u0442' : '\u0412\u0445\u043e\u0434 \u0432 Maply';
    $('auth-submit').textContent = signingUp ? '\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c\u0441\u044f' : '\u0412\u043e\u0439\u0442\u0438';
    $('auth-switch').textContent = signingUp ? '\u0423\u0436\u0435 \u0435\u0441\u0442\u044c \u0430\u043a\u043a\u0430\u0443\u043d\u0442? \u0412\u043e\u0439\u0442\u0438' : '\u041d\u0435\u0442 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430? \u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c\u0441\u044f';
    $('password').autocomplete = signingUp ? 'new-password' : 'current-password';
    message('auth-message','');
  });
  $('auth-form').addEventListener('submit',async event => {
    event.preventDefault();
    if (!db) return message('auth-message','\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u043d\u0430\u0441\u0442\u0440\u043e\u0439 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 Supabase \u0432 Vercel.');
    if (!navigator.onLine) return message('auth-message','\u0414\u043b\u044f \u0432\u0445\u043e\u0434\u0430 \u043d\u0443\u0436\u0435\u043d \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442.');
    $('auth-submit').disabled = true; $('auth-switch').disabled = true; message('auth-message','');
    try {
      const credentials = {email:$('email').value.trim(),password:$('password').value};
      const result = signingUp
        ? await db.auth.signUp({...credentials,options:{emailRedirectTo:location.origin + '/'}})
        : await db.auth.signInWithPassword(credentials);
      if (result.error) throw result.error;
      $('password').value = '';
      if (signingUp && !result.data.session) {
        message('auth-message','\u041f\u0440\u043e\u0432\u0435\u0440\u044c \u043f\u043e\u0447\u0442\u0443 \u0438 \u0441\u043f\u0430\u043c. \u0415\u0441\u043b\u0438 \u0430\u0434\u0440\u0435\u0441 \u043d\u043e\u0432\u044b\u0439, \u043f\u0440\u0438\u0434\u0451\u0442 \u043f\u0438\u0441\u044c\u043c\u043e \u0441 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u0435\u043c. \u0417\u0430\u0442\u0435\u043c \u0432\u0435\u0440\u043d\u0438\u0441\u044c \u0438 \u0432\u043e\u0439\u0434\u0438.',true);
      } else {
        user = result.data.session?.user || null; updateAccount(); $('auth-dialog').close(); toast('\u0422\u044b \u0432\u043e\u0448\u0451\u043b \u0432 Maply.');
      }
    } catch (error) {message('auth-message',errorText(error));}
    finally {$('auth-submit').disabled = false; $('auth-switch').disabled = false;}
  });
  $('logout').addEventListener('click',async () => {
    if (!db) return;
    $('logout').disabled = true;
    try {
      const {error} = await db.auth.signOut({scope:'local'});
      if (error) throw error;
      user = null; updateAccount(); $('auth-dialog').close(); await markers?.load(); toast('\u0422\u044b \u0432\u044b\u0448\u0435\u043b \u0438\u0437 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430.');
    } catch (error) {message('auth-message',errorText(error));}
    finally {$('logout').disabled = false;}
  });
  $('type').addEventListener('change',() => {$('title').required = $('type').value === 'custom';});
  $('pin-form').addEventListener('submit',async event => {
    event.preventDefault();
    if (!db || !user || !selectedPoint) return message('pin-message','\u0412\u043e\u0439\u0434\u0438 \u0438 \u0432\u044b\u0431\u0435\u0440\u0438 \u043c\u0435\u0441\u0442\u043e \u043d\u0430 \u043a\u0430\u0440\u0442\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437.');
    if (!navigator.onLine) return message('pin-message','\u0414\u043b\u044f \u043f\u0443\u0431\u043b\u0438\u043a\u0430\u0446\u0438\u0438 \u043d\u0443\u0436\u0435\u043d \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442.');
    const type = $('type').value;
    const title = $('title').value.trim() || (type === 'custom' ? '' : TYPES[type].name);
    if (!title) return message('pin-message','\u0423\u043a\u0430\u0436\u0438 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0441\u0432\u043e\u0435\u0439 \u043c\u0435\u0442\u043a\u0438.');
    $('pin-submit').disabled = true; message('pin-message','');
    try {
      const {error} = await db.from('maply_markers').insert({
        user_id:user.id,type,title,description:$('description').value.trim(),
        lat:selectedPoint.lat,lng:wrapLng(selectedPoint.lng)
      });
      if (error) throw error;
      $('pin-dialog').close(); selectedPoint = null;
      if (!matchesGroup(type) || (activeFilter !== 'all' && activeFilter !== type)) chooseFilter(type);
      toast('\u041c\u0435\u0442\u043a\u0430 \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u0430.'); await markers?.load();
    } catch (error) {message('pin-message',errorText(error));}
    finally {$('pin-submit').disabled = false;}
  });
  $('locate').addEventListener('click',() => mapEngine?.requestLocation());
  window.addEventListener('offline',() => {status('\u041d\u0435\u0442 \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442\u0430. \u041c\u0435\u0442\u043a\u0438 \u0438 \u043a\u0430\u0440\u0442\u0430 \u043c\u043e\u0433\u0443\u0442 \u0431\u044b\u0442\u044c \u0443\u0441\u0442\u0430\u0440\u0435\u0432\u0448\u0438\u043c\u0438.',true);cancelPlacement();});
  window.addEventListener('online',() => {if (db) markers?.load(); else location.reload();});
  document.addEventListener('visibilitychange',() => {if (!document.hidden) markers?.load();});
  window.addEventListener('beforeinstallprompt',event => {
    event.preventDefault();if (isStandalone()) return;
    installPrompt = event;$('install').hidden = false;
  });
  $('install').addEventListener('click',async () => {
    if (!installPrompt || isStandalone()) {$('install').hidden = true;return;}
    await installPrompt.prompt(); await installPrompt.userChoice;
    installPrompt = null; $('install').hidden = true;
  });
  window.addEventListener('appinstalled',() => {installPrompt = null;$('install').hidden = true;});
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change',event => {if (event.matches) {installPrompt = null;$('install').hidden = true;}});

  async function init() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => toast('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0443 \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u044f. \u041a\u0430\u0440\u0442\u0430 \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442 \u0432 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435.'));
    if (!window.L) {status('\u041a\u0430\u0440\u0442\u0430 \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043b\u0430\u0441\u044c. \u041f\u0440\u043e\u0432\u0435\u0440\u044c \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442 \u0438 \u043e\u0431\u043d\u043e\u0432\u0438 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443.',true);return;}
    mapEngine = window.MaplyMap.create({notify:toast,getSettings:settings.get,getStyle:settings.mapStyle,
      onMove:() => markers?.schedule(),onClick:event => {if (placing) openPinForm(event.latlng);},
      onLongPress:point => {if (!$('pin-dialog').open && !$('auth-dialog').open && !$('menu-dialog').open) beginPlacement(point);}
    });
    map = mapEngine.map;
    markers = window.MaplyMarkers.create({map,TYPES,getDb:() => db,getUser:() => user,
      matchesPin:pin => matchesGroup(pin.type) && (activeFilter === 'all' || pin.type === activeFilter),
      fadeOld:() => settings.get().fadeOld,toast,status,errorText,element,
      openLogin:() => {resumeAfterLogin = false;resumePoint = null;message('auth-message','\u0412\u043e\u0439\u0434\u0438, \u0447\u0442\u043e\u0431\u044b \u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u0442\u044c. \u041f\u043e\u0441\u043b\u0435 \u0432\u0445\u043e\u0434\u0430 \u043e\u0442\u043a\u0440\u043e\u0439 \u043c\u0435\u0442\u043a\u0443 \u0438 \u0432\u044b\u0431\u0435\u0440\u0438 \u0433\u043e\u043b\u043e\u0441.');$('auth-dialog').showModal();}
    });
    if (!window.supabase) {status('\u041c\u043e\u0434\u0443\u043b\u044c \u0432\u0445\u043e\u0434\u0430 \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043b\u0441\u044f. \u041f\u0440\u043e\u0432\u0435\u0440\u044c \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442 \u0438 \u043e\u0431\u043d\u043e\u0432\u0438 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443.',true);return;}
    try {
      let config;
      if (navigator.onLine) {
        const response = await fetch('/api/config',{cache:'no-store',signal:AbortSignal.timeout(15000)});
        config = await response.json();
        if (!response.ok) throw new Error(config.error || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 Vercel.');
        try {localStorage.setItem('maply-public-config',JSON.stringify(config));} catch {}
      } else {
        try {config = JSON.parse(localStorage.getItem('maply-public-config') || 'null');} catch {}
        if (!config) throw new Error('\u0414\u043b\u044f \u043f\u0435\u0440\u0432\u043e\u0433\u043e \u043e\u0442\u043a\u0440\u044b\u0442\u0438\u044f Maply \u043d\u0443\u0436\u0435\u043d \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442.');
      }
      db = window.supabase.createClient(config.url,config.key,{
        auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'}
      });
      db.auth.onAuthStateChange((_event,session) => {
        user = session?.user || null;updateAccount();markers.authChanged();
      });
      const {data,error} = await db.auth.getSession();
      if (error) throw error;
      user = data.session?.user || null; updateAccount();
      await markers.load();setInterval(() => {markers.expire();if (settings.get().autoRefresh) markers.load();else markers.render();},30000);
      if (location.hash.includes('error')) {
        toast('\u0421\u0441\u044b\u043b\u043a\u0430 \u0434\u043b\u044f \u0432\u0445\u043e\u0434\u0430 \u043d\u0435\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043b\u044c\u043d\u0430 \u0438\u043b\u0438 \u0443\u0441\u0442\u0430\u0440\u0435\u043b\u0430. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u0432\u043e\u0439\u0442\u0438 \u0441\u043d\u043e\u0432\u0430.');
        history.replaceState(null,'',location.pathname);
      }
    } catch (error) {status(errorText(error),true);}
  }
  init().catch(error => status(errorText(error),true));
})();
