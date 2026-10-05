'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const TYPES = {
    accident: {name:'Авария',emoji:'🚗',color:'#dc4949'},
    closed: {name:'Дорога закрыта',emoji:'⛔',color:'#dc7133'},
    police: {name:'Полиция',emoji:'🚓',color:'#397dc5'},
    pothole: {name:'Яма',emoji:'🕳️',color:'#927129'},
    custom: {name:'Своя метка',emoji:'📍',color:'#07887f'}
  };
  let map, db, user = null, layer, locationLayer;
  let placing = false, selectedPoint = null, signingUp = false;
  let resumeAfterLogin = false, loadNumber = 0, loadTimer, toastTimer, installPrompt;

  function toast(text) {
    $('toast').textContent = text; $('toast').hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => {$('toast').hidden = true;},5000);
  }
  function status(text, error = false) {
    $('status').textContent = text; $('status').classList.toggle('error',error);
  }
  function message(id,text,success = false) {
    $(id).textContent = text; $(id).classList.toggle('success',success);
  }
  function errorText(error) {
    const text = String(error?.message || error || '');
    if (text.includes('MAPLY_RATE_LIMIT')) return 'За час можно добавить 20 меток. Попробуй позже.';
    if (text.includes('Invalid login credentials')) return 'Проверь email и пароль.';
    if (text.includes('Email not confirmed')) return 'Подтверди email по ссылке в письме, затем войди.';
    if (text.includes('rate limit') || text.includes('security purposes')) return 'Слишком много попыток. Подожди несколько минут.';
    if (text.includes('email_address_not_authorized') || text.includes('Email address') && text.includes('not authorized')) return 'Отправка писем на этот адрес пока не настроена. Владелец Maply должен подключить SMTP в Supabase.';
    if (text.includes('Password')) return 'Пароль не подходит требованиям. Попробуй более длинный пароль.';
    if (text.includes('already registered')) return 'Этот email уже зарегистрирован. Выбери «Войти».';
    if (text.includes('Failed to fetch') || text.includes('NetworkError') || !navigator.onLine) return 'Нет соединения. Проверь интернет и попробуй снова.';
    if (text.includes('maply_markers') || error?.code === 'PGRST205') return 'Таблица Maply ещё не готова. Выполни supabase.sql в Supabase SQL Editor.';
    if (error?.code === '42501' || text.includes('JWT') || text.includes('MAPLY_LOGIN_REQUIRED')) return 'Не удалось подтвердить вход. Выйди и войди снова. Если ошибка остаётся, проверь настройки базы.';
    return 'Не удалось выполнить действие. Попробуй снова. ' + text.slice(0,180);
  }
  function cancelPlacement() {
    placing = false; $('placement').hidden = true; document.body.classList.remove('placing');
  }
  function beginPlacement() {
    if (!navigator.onLine) return toast('Для добавления метки нужен интернет.');
    if (!db) return toast('Подключение ещё не готово. Обнови страницу или проверь настройки Vercel.');
    if (!user) {
      resumeAfterLogin = true; message('auth-message','Войди, чтобы добавить метку.');
      $('auth-dialog').showModal(); return;
    }
    placing = true; selectedPoint = null; map.closePopup();
    $('placement').hidden = false; document.body.classList.add('placing');
  }
  function updateAccount() {
    $('account').textContent = user ? 'Аккаунт' : 'Войти';
    $('signed-in').hidden = !user; $('auth-form').hidden = Boolean(user);
    $('user-email').textContent = user?.email || '';
    if (user && resumeAfterLogin) {
      resumeAfterLogin = false; $('auth-dialog').close(); beginPlacement();
    }
    if (!user) {cancelPlacement(); $('pin-dialog').close();}
  }
  function element(tag,text,className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function popupFor(pin) {
    const box = element('div',undefined,'pin-popup');
    const type = TYPES[pin.type] || TYPES.custom;
    box.append(element('h2',type.emoji + ' ' + pin.title));
    box.append(element('p',type.name,'small'));
    if (pin.description) box.append(element('p',pin.description));
    const time = element('time',new Date(pin.created_at).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}));
    time.dateTime = pin.created_at; box.append(time);
    if (user?.id === pin.user_id) {
      const button = element('button','Удалить мою метку');
      button.type = 'button';
      button.addEventListener('click',async () => {
        if (!navigator.onLine) return toast('Для удаления нужен интернет.');
        if (!confirm('Удалить эту метку?')) return;
        button.disabled = true;
        try {
          const {data,error} = await db.from('maply_markers').delete().eq('id',pin.id).eq('user_id',user.id).select('id');
          if (error) throw error;
          if (!data?.length) {toast('Метка уже исчезла или недоступна.');}
          else toast('Метка удалена.');
          map.closePopup(); await loadPins();
        } catch (error) {toast(errorText(error));}
        finally {button.disabled = false;}
      });
      box.append(button);
    }
    return box;
  }
  function renderPins(pins) {
    layer.clearLayers();
    for (const pin of pins) {
      if (!Number.isFinite(pin.lat) || !Number.isFinite(pin.lng)) continue;
      const type = TYPES[pin.type] || TYPES.custom;
      const icon = L.divIcon({className:'pin-icon',html:`<div class="pin-badge" style="--pin-color:${type.color}"><span>${type.emoji}</span></div>`,iconSize:[40,40],iconAnchor:[20,40],popupAnchor:[0,-36]});
      L.marker([pin.lat,pin.lng],{icon,title:pin.title,keyboard:true}).bindPopup(popupFor(pin)).addTo(layer);
    }
    $('count').textContent = String(pins.length);
  }
  const wrapLng = lng => ((lng + 180) % 360 + 360) % 360 - 180;
  async function loadPins() {
    if (!db || !map || document.hidden) return;
    if (!navigator.onLine) {status('Нет интернета. Метки и карта могут быть устаревшими.',true);return;}
    const number = ++loadNumber;
    $('refresh').disabled = true;
    status('Обновляем метки…');
    const bounds = map.getBounds();
    let query = db.from('maply_markers').select('id,user_id,type,title,description,lat,lng,created_at,expires_at')
      .gt('expires_at',new Date().toISOString())
      .gte('lat',Math.max(-85.05112878,bounds.getSouth()))
      .lte('lat',Math.min(85.05112878,bounds.getNorth()));
    if (bounds.getEast() - bounds.getWest() < 360) {
      const west = wrapLng(bounds.getWest()), east = wrapLng(bounds.getEast());
      query = west <= east ? query.gte('lng',west).lte('lng',east) : query.or(`lng.gte.${west},lng.lte.${east}`);
    }
    try {
      const {data,error} = await query.order('created_at',{ascending:false}).limit(500);
      if (number !== loadNumber) return;
      if (error) throw error;
      renderPins(data || []);
      status(data.length === 500 ? 'Показаны 500 последних меток. Приблизь карту.' : data.length ? 'Метки обновлены' : 'Здесь пока нет меток. Можно добавить первую.');
    } catch (error) {if (number === loadNumber) status(errorText(error),true);}
    finally {if (number === loadNumber) $('refresh').disabled = false;}
  }
  function scheduleLoad() {clearTimeout(loadTimer);loadTimer = setTimeout(loadPins,350);}

  $('add').addEventListener('click',beginPlacement);
  $('cancel-placement').addEventListener('click',cancelPlacement);
  $('refresh').addEventListener('click',loadPins);
  $('account').addEventListener('click',() => {
    resumeAfterLogin = false; message('auth-message',''); $('auth-dialog').showModal();
  });
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click',() => $(button.dataset.close).close()));
  $('auth-dialog').addEventListener('close',() => {resumeAfterLogin = false;});
  $('auth-switch').addEventListener('click',() => {
    signingUp = !signingUp;
    $('auth-title').textContent = signingUp ? 'Создать аккаунт' : 'Вход в Maply';
    $('auth-submit').textContent = signingUp ? 'Зарегистрироваться' : 'Войти';
    $('auth-switch').textContent = signingUp ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться';
    $('password').autocomplete = signingUp ? 'new-password' : 'current-password';
    message('auth-message','');
  });
  $('auth-form').addEventListener('submit',async event => {
    event.preventDefault();
    if (!db) return message('auth-message','Сначала настрой подключение Supabase в Vercel.');
    if (!navigator.onLine) return message('auth-message','Для входа нужен интернет.');
    $('auth-submit').disabled = true; $('auth-switch').disabled = true; message('auth-message','');
    try {
      const credentials = {email:$('email').value.trim(),password:$('password').value};
      const result = signingUp
        ? await db.auth.signUp({...credentials,options:{emailRedirectTo:location.origin + '/'}})
        : await db.auth.signInWithPassword(credentials);
      if (result.error) throw result.error;
      $('password').value = '';
      if (signingUp && !result.data.session) {
        message('auth-message','Проверь почту и спам. Если адрес новый, придёт письмо с подтверждением. Затем вернись и войди.',true);
      } else {
        user = result.data.session?.user || null; updateAccount(); $('auth-dialog').close(); toast('Ты вошёл в Maply.');
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
      user = null; updateAccount(); $('auth-dialog').close(); await loadPins(); toast('Ты вышел из аккаунта.');
    } catch (error) {message('auth-message',errorText(error));}
    finally {$('logout').disabled = false;}
  });
  $('type').addEventListener('change',() => {$('title').required = $('type').value === 'custom';});
  $('pin-form').addEventListener('submit',async event => {
    event.preventDefault();
    if (!db || !user || !selectedPoint) return message('pin-message','Войди и выбери место на карте ещё раз.');
    if (!navigator.onLine) return message('pin-message','Для публикации нужен интернет.');
    const type = $('type').value;
    const title = $('title').value.trim() || (type === 'custom' ? '' : TYPES[type].name);
    if (!title) return message('pin-message','Укажи название своей метки.');
    $('pin-submit').disabled = true; message('pin-message','');
    try {
      const {error} = await db.from('maply_markers').insert({
        user_id:user.id,type,title,description:$('description').value.trim(),
        lat:selectedPoint.lat,lng:wrapLng(selectedPoint.lng)
      });
      if (error) throw error;
      $('pin-dialog').close(); selectedPoint = null; toast('Метка добавлена.'); await loadPins();
    } catch (error) {message('pin-message',errorText(error));}
    finally {$('pin-submit').disabled = false;}
  });
  $('locate').addEventListener('click',() => {
    if (!map) return toast('Карта ещё загружается.');
    if (!navigator.geolocation) return toast('Этот браузер не поддерживает геолокацию.');
    $('locate').disabled = true;
    navigator.geolocation.getCurrentPosition(position => {
      const {latitude,longitude,accuracy} = position.coords;
      map.setView([Math.max(-85,Math.min(85,latitude)),longitude],16);
      if (locationLayer) map.removeLayer(locationLayer);
      locationLayer = L.circle([latitude,longitude],{radius:Math.max(accuracy,8),color:'#397dc5',fillColor:'#397dc5',fillOpacity:.15,weight:2}).addTo(map);
      $('locate').disabled = false;
    },error => {
      $('locate').disabled = false;
      toast(error.code === 1 ? 'Разреши доступ к местоположению в настройках браузера. Место события можно выбрать вручную.' : 'Не удалось определить местоположение. Выбери место на карте вручную.');
    },{enableHighAccuracy:true,timeout:12000,maximumAge:30000});
  });
  window.addEventListener('offline',() => {status('Нет интернета. Метки и карта могут быть устаревшими.',true);cancelPlacement();});
  window.addEventListener('online',() => {if (db) loadPins(); else location.reload();});
  document.addEventListener('visibilitychange',() => {if (!document.hidden) loadPins();});
  window.addEventListener('beforeinstallprompt',event => {event.preventDefault();installPrompt = event;$('install').hidden = false;});
  $('install').addEventListener('click',async () => {
    if (!installPrompt) return;
    await installPrompt.prompt(); await installPrompt.userChoice;
    installPrompt = null; $('install').hidden = true;
  });
  window.addEventListener('appinstalled',() => {$('install').hidden = true;});

  async function init() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => toast('Не удалось включить установку приложения. Карта работает в браузере.'));
    if (!window.L) {status('Карта не загрузилась. Проверь интернет и обнови страницу.',true);return;}
    map = L.map('map',{zoomControl:false,worldCopyJump:true,minZoom:3,maxZoom:19,maxBounds:[[-85.05112878,-540],[85.05112878,540]]}).setView([41.0082,28.9784],12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',maxZoom:19
    }).addTo(map);
    L.control.zoom({position:'bottomleft'}).addTo(map);
    layer = L.layerGroup().addTo(map);
    map.on('moveend',scheduleLoad);
    map.on('click',event => {
      if (!placing) return;
      selectedPoint = event.latlng; cancelPlacement();
      $('pin-form').reset(); $('title').required = false;
      $('coordinates').textContent = `Место: ${selectedPoint.lat.toFixed(5)}, ${wrapLng(selectedPoint.lng).toFixed(5)}`;
      message('pin-message',''); $('pin-dialog').showModal();
    });
    if (!window.supabase) {status('Модуль входа не загрузился. Проверь интернет и обнови страницу.',true);return;}
    try {
      let config;
      if (navigator.onLine) {
        const response = await fetch('/api/config',{cache:'no-store',signal:AbortSignal.timeout(15000)});
        config = await response.json();
        if (!response.ok) throw new Error(config.error || 'Не удалось загрузить настройки Vercel.');
        try {localStorage.setItem('maply-public-config',JSON.stringify(config));} catch {}
      } else {
        try {config = JSON.parse(localStorage.getItem('maply-public-config') || 'null');} catch {}
        if (!config) throw new Error('Для первого открытия Maply нужен интернет.');
      }
      db = window.supabase.createClient(config.url,config.key,{
        auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'}
      });
      db.auth.onAuthStateChange((_event,session) => {
        user = session?.user || null; updateAccount(); scheduleLoad();
      });
      const {data,error} = await db.auth.getSession();
      if (error) throw error;
      user = data.session?.user || null; updateAccount();
      await loadPins(); setInterval(loadPins,30000);
      if (location.hash.includes('error')) {
        toast('Ссылка для входа недействительна или устарела. Попробуй войти снова.');
        history.replaceState(null,'',location.pathname);
      }
    } catch (error) {status(errorText(error),true);}
  }
  init().catch(error => status(errorText(error),true));
})();
