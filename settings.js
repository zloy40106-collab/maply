'use strict';
(() => {
  const t=window.MaplyI18n.t;
  const $=id=>document.getElementById(id),C=window.MaplyCategories;
  const DEFAULTS={language:window.MaplyI18n.language(),theme:'light',mapStyle:'auto',autoLocate:true,autoRefresh:true,showOld:true,fadeOld:true,radius:0,enabledTypes:Object.keys(C.types)};
  const listeners=new Set(),systemTheme=window.matchMedia?.('(prefers-color-scheme: dark)');let values={...DEFAULTS};
  function valid(key,value){
    if(key==='language')return window.MaplyI18n.valid(value);
    if(key==='theme')return ['light','dark','system'].includes(value);
    if(key==='mapStyle')return ['auto','liberty','positron','dark'].includes(value);
    if(key==='radius')return [0,1000,3000,5000,10000].includes(value);
    if(key==='enabledTypes')return Array.isArray(value)&&value.length>0&&value.every(v=>Object.hasOwn(C.types,v));
    return ['autoLocate','autoRefresh','showOld','fadeOld'].includes(key)&&typeof value==='boolean';
  }
  try{const saved=JSON.parse(localStorage.getItem('maply-settings-v1'));for(const key of Object.keys(DEFAULTS))if(valid(key,saved?.[key]))values[key]=saved[key];}catch{}
  function get(){return {...values,enabledTypes:[...values.enabledTypes]};}
  function theme(){return values.theme==='system'?(systemTheme?.matches?'dark':'light'):values.theme;}
  function mapStyle(){return values.mapStyle==='auto'?(theme()==='dark'?'dark':'liberty'):values.mapStyle;}
  function sync(){for(const key of Object.keys(DEFAULTS)){const node=$('setting-'+key);if(!node)continue;if(typeof values[key]==='boolean')node.checked=values[key];else node.value=String(values[key]);}
    document.querySelectorAll('[data-setting-type-label]').forEach(n=>{const type=C.types[n.dataset.settingTypeLabel];n.textContent=type.emoji+' '+type.name;});
    document.querySelectorAll('[data-setting-type]').forEach(n=>{n.checked=values.enabledTypes.includes(n.dataset.settingType);n.setAttribute('aria-label',t('\u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0442\u044c: {type}',{type:C.types[n.dataset.settingType].name}));});}
  function changed(){window.MaplyI18n.set(values.language);document.documentElement.dataset.theme=theme();const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=theme()==='dark'?'#111c29':'#102b46';sync();for(const fn of listeners)fn(get());}
  function save(){try{localStorage.setItem('maply-settings-v1',JSON.stringify(values));}catch{}changed();}
  function set(key,value){if(!valid(key,value))return;values[key]=value;save();}
  function reset(){values={...DEFAULTS,language:'tr',enabledTypes:[...DEFAULTS.enabledTypes]};save();}
  function init({getUser,openAccount,configureTypes,notify,openMine,logout}) {
    function profile(){const user=getUser();$('menu-user').textContent=user?.email||t("\u0422\u044b \u0441\u043c\u043e\u0442\u0440\u0438\u0448\u044c \u043a\u0430\u0440\u0442\u0443 \u043a\u0430\u043a \u0433\u043e\u0441\u0442\u044c");$('menu-auth').textContent=user?t("\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043f\u0440\u043e\u0444\u0438\u043b\u044c"):t("\u0412\u043e\u0439\u0442\u0438 \u0438\u043b\u0438 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c\u0441\u044f");$('menu-logout').hidden=!user;}
    for(const key of Object.keys(DEFAULTS)){const node=$('setting-'+key);if(node)node.addEventListener('change',()=>set(key,typeof values[key]==='boolean'?node.checked:key==='radius'?Number(node.value):node.value));}
    $('menu-auth').addEventListener('click',()=>{$('menu-dialog').close();openAccount();});
    $('menu-reset-filters').addEventListener('click',()=>{$('menu-dialog').close();configureTypes();});
    $('settings-reset').addEventListener('click',()=>{reset();notify(t("\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0441\u0431\u0440\u043e\u0448\u0435\u043d\u044b."));});
    $('menu-mine').addEventListener('click',()=>{$('menu-dialog').close();openMine('mine');});
    $('menu-votes').addEventListener('click',()=>{$('menu-dialog').close();openMine('votes');});
    $('menu-logout').addEventListener('click',()=>{$('menu-dialog').close();logout();});
    $('types-reset').addEventListener('click',()=>set('enabledTypes',Object.keys(C.types)));
    const box=$('type-settings');box.replaceChildren();
    for(const [key,type] of Object.entries(C.types)){const label=document.createElement('label');label.className='setting-toggle';const text=document.createElement('span');text.dataset.settingTypeLabel=key;text.textContent=type.emoji+' '+type.name;const input=document.createElement('input');input.type='checkbox';input.dataset.settingType=key;input.setAttribute('aria-label',t("\u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0442\u044c: {type}",{type:type.name}));input.addEventListener('change',()=>{const selected=[...document.querySelectorAll('[data-setting-type]:checked')].map(n=>n.dataset.settingType);if(!selected.length){input.checked=true;notify(t("\u041e\u0441\u0442\u0430\u0432\u044c \u0445\u043e\u0442\u044f \u0431\u044b \u043e\u0434\u0438\u043d \u0442\u0438\u043f \u0441\u043e\u0431\u044b\u0442\u0438\u0439."));return;}set('enabledTypes',selected);});label.append(text,input);box.append(label);}
    profile();sync();return {profile,open(){profile();sync();$('menu-dialog').showModal();}};
  }
  changed();systemTheme?.addEventListener?.('change',()=>{if(values.theme==='system')changed();});
  window.MaplySettings={get,set,reset,theme,mapStyle,init,subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);}};
})();
