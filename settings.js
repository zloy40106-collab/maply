'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const DEFAULTS = Object.freeze({theme:'light',mapStyle:'auto',autoLocate:true,autoRefresh:true,fadeOld:true});
  const listeners = new Set();
  const systemTheme = window.matchMedia?.('(prefers-color-scheme: dark)');
  let values = {...DEFAULTS};
  function valid(key,value) {
    if (key === 'theme') return ['light','dark','system'].includes(value);
    if (key === 'mapStyle') return ['auto','liberty','positron','dark'].includes(value);
    return ['autoLocate','autoRefresh','fadeOld'].includes(key) && typeof value === 'boolean';
  }
  try {
    const saved = JSON.parse(localStorage.getItem('maply-settings-v1') || 'null');
    if (saved && typeof saved === 'object') {
      for (const key of Object.keys(DEFAULTS)) if (valid(key,saved[key])) values[key] = saved[key];
    }
  } catch {}
  function get() {return {...values};}
  function theme() {return values.theme === 'system' ? (systemTheme?.matches ? 'dark' : 'light') : values.theme;}
  function mapStyle() {return values.mapStyle === 'auto' ? (theme() === 'dark' ? 'dark' : 'liberty') : values.mapStyle;}
  function applyTheme() {
    document.documentElement.dataset.theme = theme();
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme() === 'dark' ? '#111c29' : '#102b46';
  }
  function syncForm() {
    for (const key of Object.keys(DEFAULTS)) {
      const node = $('setting-' + key);
      if (!node) continue;
      if (typeof DEFAULTS[key] === 'boolean') node.checked = values[key];
      else node.value = values[key];
    }
  }
  function changed() {
    applyTheme();syncForm();
    for (const listener of listeners) listener(get());
  }
  function set(key,value) {
    if (!valid(key,value) || values[key] === value) return;
    values[key] = value;
    try {localStorage.setItem('maply-settings-v1',JSON.stringify(values));} catch {}
    changed();
  }
  function reset() {
    values = {...DEFAULTS};
    try {localStorage.setItem('maply-settings-v1',JSON.stringify(values));} catch {}
    changed();
  }
  function init({getUser,openAccount,resetFilters,notify}) {
    function profile() {
      const user = getUser();
      $('menu-user').textContent = user ? user.email || '\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a Maply' : '\u0422\u044b \u0441\u043c\u043e\u0442\u0440\u0438\u0448\u044c \u043a\u0430\u0440\u0442\u0443 \u043a\u0430\u043a \u0433\u043e\u0441\u0442\u044c';
      $('menu-auth').textContent = user ? '\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0430\u043a\u043a\u0430\u0443\u043d\u0442' : '\u0412\u043e\u0439\u0442\u0438 \u0438\u043b\u0438 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c\u0441\u044f';
    }
    for (const key of Object.keys(DEFAULTS)) {
      const node = $('setting-' + key);
      node.addEventListener('change',() => set(key,typeof DEFAULTS[key] === 'boolean' ? node.checked : node.value));
    }
    $('menu-auth').addEventListener('click',() => {$('menu-dialog').close();openAccount();});
    $('menu-reset-filters').addEventListener('click',() => {resetFilters();notify('\u041f\u043e\u043a\u0430\u0437\u0430\u043d\u044b \u0432\u0441\u0435 \u0442\u0438\u043f\u044b \u043c\u0435\u0442\u043e\u043a.');});
    $('settings-reset').addEventListener('click',() => {reset();notify('\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0432\u043e\u0437\u0432\u0440\u0430\u0449\u0435\u043d\u044b \u043a \u043e\u0431\u044b\u0447\u043d\u044b\u043c.');});
    syncForm();profile();
    return {open() {profile();syncForm();$('menu-dialog').showModal();},profile};
  }
  applyTheme();
  systemTheme?.addEventListener?.('change',() => {if (values.theme === 'system') changed();});
  window.MaplySettings = {get,set,reset,theme,mapStyle,init,subscribe(listener) {listeners.add(listener);return () => listeners.delete(listener);}};
})();
