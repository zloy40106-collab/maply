'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const TYPES = {
    accident: {name:'\u0410\u0432\u0430\u0440\u0438\u044f',emoji:'\ud83d\ude97',color:'#dc4949'},
    closed: {name:'\u0414\u043e\u0440\u043e\u0433\u0430 \u0437\u0430\u043a\u0440\u044b\u0442\u0430',emoji:'\u26d4',color:'#dc7133'},
    police: {name:'\u041f\u043e\u043b\u0438\u0446\u0438\u044f',emoji:'\ud83d\ude93',color:'#397dc5'},
    pothole: {name:'\u042f\u043c\u0430',emoji:'\ud83d\udd73\ufe0f',color:'#927129'},
    custom: {name:'\u0421\u0432\u043e\u044f \u043c\u0435\u0442\u043a\u0430',emoji:'\ud83d\udccd',color:'#07887f'}
  };
  let map, db, user = null, layer, locationLayer;
  let placing = false, selectedPoint = null, signingUp = false;
  const pinsById = new Map();
  const pendingVotes = new Set();
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
    if (text.includes('MAPLY_MARKER_UNAVAILABLE')) return '\u041c\u0435\u0442\u043a\u0430 \u0443\u0436\u0435 \u0441\u043a\u0440\u044b\u0442\u0430, \u0443\u0434\u0430\u043b\u0435\u043d\u0430 \u0438\u043b\u0438 \u0435\u0451 \u0441\u0440\u043e\u043a \u0438\u0441\u0442\u0451\u043a.';
    if (text.includes('MAPLY_INVALID_VOTE')) return '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0440\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u0442\u044c \u0433\u043e\u043b\u043e\u0441. \u041e\u0431\u043d\u043e\u0432\u0438 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443.';
    if (text.includes('maply_vote') || text.includes('maply_votes') || text.includes('active_votes') || text.includes('hidden_by_votes') || error?.code === 'PGRST202') return '\u0413\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043d\u0438\u0435 \u0435\u0449\u0451 \u043d\u0435 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043d\u043e. \u0412\u044b\u043f\u043e\u043b\u043d\u0438 1-SQL-golosovanie.sql \u0432 Supabase SQL Editor.';
    if (text.includes('MAPLY_RATE_LIMIT')) return '\u0417\u0430 \u0447\u0430\u0441 \u043c\u043e\u0436\u043d\u043e \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c 20 \u043c\u0435\u0442\u043e\u043a. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u043f\u043e\u0437\u0436\u0435.';
    if (text.includes('Invalid login credentials')) return '\u041f\u0440\u043e\u0432\u0435\u0440\u044c email \u0438 \u043f\u0430\u0440\u043e\u043b\u044c.';
    if (text.includes('Email not confirmed')) return '\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438 email \u043f\u043e \u0441\u0441\u044b\u043b\u043a\u0435 \u0432 \u043f\u0438\u0441\u044c\u043c\u0435, \u0437\u0430\u0442\u0435\u043c \u0432\u043e\u0439\u0434\u0438.';
    if (text.includes('rate limit') || text.includes('security purposes')) return '\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u043c\u043d\u043e\u0433\u043e \u043f\u043e\u043f\u044b\u0442\u043e\u043a. \u041f\u043e\u0434\u043e\u0436\u0434\u0438 \u043d\u0435\u0441\u043a\u043e\u043b\u044c\u043a\u043e \u043c\u0438\u043d\u0443\u0442.';
    if (text.includes('email_address_not_authorized') || text.includes('Email address') && text.includes('not authorized')) return '\u041e\u0442\u043f\u0440\u0430\u0432\u043a\u0430 \u043f\u0438\u0441\u0435\u043c \u043d\u0430 \u044d\u0442\u043e\u0442 \u0430\u0434\u0440\u0435\u0441 \u043f\u043e\u043a\u0430 \u043d\u0435 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043d\u0430. \u0412\u043b\u0430\u0434\u0435\u043b\u0435\u0446 Maply \u0434\u043e\u043b\u0436\u0435\u043d \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0438\u0442\u044c SMTP \u0432 Supabase.';
    if (text.includes('Password')) return '\u041f\u0430\u0440\u043e\u043b\u044c \u043d\u0435 \u043f\u043e\u0434\u0445\u043e\u0434\u0438\u0442 \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u044f\u043c. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u0431\u043e\u043b\u0435\u0435 \u0434\u043b\u0438\u043d\u043d\u044b\u0439 \u043f\u0430\u0440\u043e\u043b\u044c.';
    if (text.includes('already registered')) return '\u042d\u0442\u043e\u0442 email \u0443\u0436\u0435 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u043d. \u0412\u044b\u0431\u0435\u0440\u0438 \u00ab\u0412\u043e\u0439\u0442\u0438\u00bb.';
    if (text.includes('Failed to fetch') || text.includes('NetworkError') || !navigator.onLine) return '\u041d\u0435\u0442 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f. \u041f\u0440\u043e\u0432\u0435\u0440\u044c \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442 \u0438 \u043f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u0441\u043d\u043e\u0432\u0430.';
    if (text.includes('maply_markers') || error?.code === 'PGRST205') return '\u0422\u0430\u0431\u043b\u0438\u0446\u0430 Maply \u0435\u0449\u0451 \u043d\u0435 \u0433\u043e\u0442\u043e\u0432\u0430. \u0412\u044b\u043f\u043e\u043b\u043d\u0438 \u0438\u0441\u0445\u043e\u0434\u043d\u044b\u0439 0-SQL-dlya-Supabase.sql \u0432 Supabase SQL Editor.';
    if (error?.code === '42501' || text.includes('JWT') || text.includes('MAPLY_LOGIN_REQUIRED')) return '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c \u0432\u0445\u043e\u0434. \u0412\u044b\u0439\u0434\u0438 \u0438 \u0432\u043e\u0439\u0434\u0438 \u0441\u043d\u043e\u0432\u0430. \u0415\u0441\u043b\u0438 \u043e\u0448\u0438\u0431\u043a\u0430 \u043e\u0441\u0442\u0430\u0451\u0442\u0441\u044f, \u043f\u0440\u043e\u0432\u0435\u0440\u044c \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0431\u0430\u0437\u044b.';
    return '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u044c \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u0441\u043d\u043e\u0432\u0430. ' + text.slice(0,180);
  }
  function cancelPlacement() {
    placing = false; $('placement').hidden = true; document.body.classList.remove('placing');
  }
  function beginPlacement() {
    if (!navigator.onLine) return toast('\u0414\u043b\u044f \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u0438\u044f \u043c\u0435\u0442\u043a\u0438 \u043d\u0443\u0436\u0435\u043d \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442.');
    if (!db) return toast('\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 \u0435\u0449\u0451 \u043d\u0435 \u0433\u043e\u0442\u043e\u0432\u043e. \u041e\u0431\u043d\u043e\u0432\u0438 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443 \u0438\u043b\u0438 \u043f\u0440\u043e\u0432\u0435\u0440\u044c \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 Vercel.');
    if (!user) {
      resumeAfterLogin = true; message('auth-message','\u0412\u043e\u0439\u0434\u0438, \u0447\u0442\u043e\u0431\u044b \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043c\u0435\u0442\u043a\u0443.');
      $('auth-dialog').showModal(); return;
    }
    placing = true; selectedPoint = null; map.closePopup();
    $('placement').hidden = false; document.body.classList.add('placing');
  }
  function updateAccount() {
    $('account').textContent = user ? '\u0410\u043a\u043a\u0430\u0443\u043d\u0442' : '\u0412\u043e\u0439\u0442\u0438';
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
  async function voteFor(pin,choice) {
    if (!navigator.onLine) return toast('\u0414\u043b\u044f \u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043d\u0438\u044f \u043d\u0443\u0436\u0435\u043d \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442.');
    if (!db) return toast('\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 \u0435\u0449\u0451 \u043d\u0435 \u0433\u043e\u0442\u043e\u0432\u043e. \u041e\u0431\u043d\u043e\u0432\u0438 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443.');
    if (!user) {
      resumeAfterLogin = false;
      message('auth-message','\u0412\u043e\u0439\u0434\u0438, \u0447\u0442\u043e\u0431\u044b \u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u0442\u044c. \u041f\u043e\u0441\u043b\u0435 \u0432\u0445\u043e\u0434\u0430 \u043e\u0442\u043a\u0440\u043e\u0439 \u043c\u0435\u0442\u043a\u0443 \u0438 \u0432\u044b\u0431\u0435\u0440\u0438 \u0433\u043e\u043b\u043e\u0441.');
      $('auth-dialog').showModal(); return;
    }
    if (pendingVotes.has(pin.id)) return;
    pendingVotes.add(pin.id); refreshPopup(pin.id);
    const voterId = user.id;
    try {
      const {data,error} = await db.rpc('maply_vote',{p_marker_id:pin.id,p_vote:choice});
      if (error) throw error;
      // Invalidate any map request that started before this vote completed.
      ++loadNumber;
      if (data.hidden_by_votes) {
        const marker = pinsById.get(pin.id);
        if (marker) layer.removeLayer(marker);
        pinsById.delete(pin.id); $('count').textContent = String(pinsById.size);
        toast('\u0413\u043e\u043b\u043e\u0441 \u0443\u0447\u0442\u0451\u043d. \u041c\u0435\u0442\u043a\u0430 \u0441\u043a\u0440\u044b\u0442\u0430: \u00ab\u043d\u0435\u0442\u00bb \u043d\u0430 3 \u0431\u043e\u043b\u044c\u0448\u0435, \u0447\u0435\u043c \u00ab\u0430\u043a\u0442\u0443\u0430\u043b\u044c\u043d\u043e\u00bb.');
      } else {
        const updated = {active_votes:data.active_votes,gone_votes:data.gone_votes,
          expires_at:data.expires_at,my_vote:user?.id === voterId ? data.my_vote : null};
        Object.assign(pin,updated);
        const currentMarker = pinsById.get(pin.id);
        if (currentMarker) Object.assign(currentMarker.maplyPin,updated);
        refreshPopup(pin.id);
        toast(data.extended ? '\u0413\u043e\u043b\u043e\u0441 \u0443\u0447\u0442\u0451\u043d. \u0421\u0440\u043e\u043a \u043c\u0435\u0442\u043a\u0438 \u043f\u0440\u043e\u0434\u043b\u0451\u043d \u043d\u0430 2 \u0447\u0430\u0441\u0430.' : '\u0413\u043e\u043b\u043e\u0441 \u0443\u0447\u0442\u0451\u043d.');
      }
      await loadPins();
    } catch (error) {
      toast(errorText(error));
      if (String(error?.message || '').includes('MAPLY_MARKER_UNAVAILABLE')) await loadPins();
    } finally {
      pendingVotes.delete(pin.id); refreshPopup(pin.id);
    }
  }
  function refreshPopup(id) {
    const marker = pinsById.get(id);
    if (marker) marker.setPopupContent(popupFor(marker.maplyPin));
  }
  function popupFor(pin) {
    const box = element('div',undefined,'pin-popup');
    const type = TYPES[pin.type] || TYPES.custom;
    box.append(element('h2',type.emoji + ' ' + pin.title));
    box.append(element('p',type.name,'small'));
    if (pin.description) box.append(element('p',pin.description));
    const time = element('time',new Date(pin.created_at).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}));
    time.dateTime = pin.created_at; box.append(time);
    box.append(element('p','\u0412\u0438\u0434\u043d\u0430 \u0434\u043e: ' + new Date(pin.expires_at).toLocaleString('ru-RU',{
      day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'
    }),'small'));
    box.append(element('p',`\u0410\u043a\u0442\u0443\u0430\u043b\u044c\u043d\u043e: ${pin.active_votes} / \u041d\u0435\u0442: ${pin.gone_votes}`,'vote-counts'));
    const votes = element('div',undefined,'vote-buttons');
    for (const [choice,label] of [['active','\u0415\u0449\u0451 \u0430\u043a\u0442\u0443\u0430\u043b\u044c\u043d\u043e'],['gone','\u0423\u0436\u0435 \u043d\u0435\u0442']]) {
      const button = element('button',label,'vote-button');
      button.type = 'button';
      const selected = Boolean(user && pin.my_vote === choice);
      button.setAttribute('aria-pressed',String(selected));
      button.classList.toggle('selected',selected);
      button.disabled = pendingVotes.has(pin.id);
      button.addEventListener('click',() => voteFor(pin,choice));
      votes.append(button);
    }
    box.append(votes);
    box.append(element('p',user
      ? '\u041c\u043e\u0436\u043d\u043e \u043c\u0435\u043d\u044f\u0442\u044c \u0433\u043e\u043b\u043e\u0441. \u041f\u0435\u0440\u0432\u043e\u0435 \u00ab\u0430\u043a\u0442\u0443\u0430\u043b\u044c\u043d\u043e\u00bb \u043e\u0442 \u0442\u0435\u0431\u044f \u0434\u043e\u0431\u0430\u0432\u0438\u0442 2 \u0447\u0430\u0441\u0430. \u041f\u0440\u0438 \u043f\u0435\u0440\u0435\u0432\u0435\u0441\u0435 \u00ab\u043d\u0435\u0442\u00bb \u043d\u0430 3 \u043c\u0435\u0442\u043a\u0430 \u0441\u043a\u0440\u044b\u0432\u0430\u0435\u0442\u0441\u044f.'
      : '\u0412\u043e\u0439\u0434\u0438, \u0447\u0442\u043e\u0431\u044b \u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u0442\u044c. \u041f\u0440\u0438 \u043f\u0435\u0440\u0435\u0432\u0435\u0441\u0435 \u00ab\u043d\u0435\u0442\u00bb \u043d\u0430 3 \u043c\u0435\u0442\u043a\u0430 \u0441\u043a\u0440\u044b\u0432\u0430\u0435\u0442\u0441\u044f.','vote-hint'));
    if (user?.id === pin.user_id) {
      const button = element('button','\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u043c\u043e\u044e \u043c\u0435\u0442\u043a\u0443');
      button.type = 'button';
      button.addEventListener('click',async () => {
        if (!navigator.onLine) return toast('\u0414\u043b\u044f \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u044f \u043d\u0443\u0436\u0435\u043d \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442.');
        if (!confirm('\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u044d\u0442\u0443 \u043c\u0435\u0442\u043a\u0443?')) return;
        button.disabled = true;
        try {
          const {data,error} = await db.from('maply_markers').delete().eq('id',pin.id).eq('user_id',user.id).select('id');
          if (error) throw error;
          if (!data?.length) {toast('\u041c\u0435\u0442\u043a\u0430 \u0443\u0436\u0435 \u0438\u0441\u0447\u0435\u0437\u043b\u0430 \u0438\u043b\u0438 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430.');}
          else toast('\u041c\u0435\u0442\u043a\u0430 \u0443\u0434\u0430\u043b\u0435\u043d\u0430.');
          map.closePopup(); await loadPins();
        } catch (error) {toast(errorText(error));}
        finally {button.disabled = false;}
      });
      box.append(button);
    }
    return box;
  }
  function renderPins(pins) {
    const openId = [...pinsById.values()].find(marker => marker.isPopupOpen())?.maplyPin.id;
    layer.clearLayers(); pinsById.clear();
    for (const pin of pins) {
      if (!Number.isFinite(pin.lat) || !Number.isFinite(pin.lng)) continue;
      const type = TYPES[pin.type] || TYPES.custom;
      const icon = L.divIcon({className:'pin-icon',html:`<div class="pin-badge" style="--pin-color:${type.color}"><span>${type.emoji}</span></div>`,iconSize:[40,40],iconAnchor:[20,40],popupAnchor:[0,-36]});
      const marker = L.marker([pin.lat,pin.lng],{icon,title:pin.title,keyboard:true})
        .bindPopup(popupFor(pin)).addTo(layer);
      marker.maplyPin = pin; pinsById.set(pin.id,marker);
    }
    $('count').textContent = String(pinsById.size);
    if (openId && pinsById.has(openId)) pinsById.get(openId).openPopup();
  }
  const wrapLng = lng => ((lng + 180) % 360 + 360) % 360 - 180;
  async function loadPins() {
    if (!db || !map || document.hidden) return;
    if (!navigator.onLine) {status('\u041d\u0435\u0442 \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442\u0430. \u041c\u0435\u0442\u043a\u0438 \u0438 \u043a\u0430\u0440\u0442\u0430 \u043c\u043e\u0433\u0443\u0442 \u0431\u044b\u0442\u044c \u0443\u0441\u0442\u0430\u0440\u0435\u0432\u0448\u0438\u043c\u0438.',true);return;}
    const number = ++loadNumber;
    const viewerId = user?.id || null;
    $('refresh').disabled = true;
    status('\u041e\u0431\u043d\u043e\u0432\u043b\u044f\u0435\u043c \u043c\u0435\u0442\u043a\u0438\u2026');
    const bounds = map.getBounds();
    let query = db.from('maply_markers').select('id,user_id,type,title,description,lat,lng,created_at,expires_at,active_votes,gone_votes,hidden_by_votes')
      .eq('hidden_by_votes',false)
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
      const pins = data || [];
      let ownVotes = new Map();
      if (viewerId && pins.length) {
        const {data:votes,error:voteError} = await db.from('maply_votes')
          .select('marker_id,vote').eq('user_id',viewerId).in('marker_id',pins.map(pin => pin.id));
        if (number !== loadNumber || viewerId !== (user?.id || null)) return;
        if (voteError) throw voteError;
        ownVotes = new Map((votes || []).map(vote => [vote.marker_id,vote.vote]));
      }
      if (number !== loadNumber || viewerId !== (user?.id || null)) return;
      for (const pin of pins) pin.my_vote = ownVotes.get(pin.id) || null;
      renderPins(pins);
      status(pins.length === 500 ? '\u041f\u043e\u043a\u0430\u0437\u0430\u043d\u044b 500 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0445 \u043c\u0435\u0442\u043e\u043a. \u041f\u0440\u0438\u0431\u043b\u0438\u0437\u044c \u043a\u0430\u0440\u0442\u0443.' : pins.length ? '\u041c\u0435\u0442\u043a\u0438 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u044b' : '\u0417\u0434\u0435\u0441\u044c \u043f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043c\u0435\u0442\u043e\u043a. \u041c\u043e\u0436\u043d\u043e \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043f\u0435\u0440\u0432\u0443\u044e.');
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
      user = null; updateAccount(); $('auth-dialog').close(); await loadPins(); toast('\u0422\u044b \u0432\u044b\u0448\u0435\u043b \u0438\u0437 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430.');
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
      $('pin-dialog').close(); selectedPoint = null; toast('\u041c\u0435\u0442\u043a\u0430 \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u0430.'); await loadPins();
    } catch (error) {message('pin-message',errorText(error));}
    finally {$('pin-submit').disabled = false;}
  });
  $('locate').addEventListener('click',() => {
    if (!map) return toast('\u041a\u0430\u0440\u0442\u0430 \u0435\u0449\u0451 \u0437\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u0442\u0441\u044f.');
    if (!navigator.geolocation) return toast('\u042d\u0442\u043e\u0442 \u0431\u0440\u0430\u0443\u0437\u0435\u0440 \u043d\u0435 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442 \u0433\u0435\u043e\u043b\u043e\u043a\u0430\u0446\u0438\u044e.');
    $('locate').disabled = true;
    navigator.geolocation.getCurrentPosition(position => {
      const {latitude,longitude,accuracy} = position.coords;
      map.setView([Math.max(-85,Math.min(85,latitude)),longitude],16);
      if (locationLayer) map.removeLayer(locationLayer);
      locationLayer = L.circle([latitude,longitude],{radius:Math.max(accuracy,8),color:'#397dc5',fillColor:'#397dc5',fillOpacity:.15,weight:2}).addTo(map);
      $('locate').disabled = false;
    },error => {
      $('locate').disabled = false;
      toast(error.code === 1 ? '\u0420\u0430\u0437\u0440\u0435\u0448\u0438 \u0434\u043e\u0441\u0442\u0443\u043f \u043a \u043c\u0435\u0441\u0442\u043e\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u044e \u0432 \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430\u0445 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430. \u041c\u0435\u0441\u0442\u043e \u0441\u043e\u0431\u044b\u0442\u0438\u044f \u043c\u043e\u0436\u043d\u043e \u0432\u044b\u0431\u0440\u0430\u0442\u044c \u0432\u0440\u0443\u0447\u043d\u0443\u044e.' : '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0438\u0442\u044c \u043c\u0435\u0441\u0442\u043e\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435. \u0412\u044b\u0431\u0435\u0440\u0438 \u043c\u0435\u0441\u0442\u043e \u043d\u0430 \u043a\u0430\u0440\u0442\u0435 \u0432\u0440\u0443\u0447\u043d\u0443\u044e.');
    },{enableHighAccuracy:true,timeout:12000,maximumAge:30000});
  });
  window.addEventListener('offline',() => {status('\u041d\u0435\u0442 \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442\u0430. \u041c\u0435\u0442\u043a\u0438 \u0438 \u043a\u0430\u0440\u0442\u0430 \u043c\u043e\u0433\u0443\u0442 \u0431\u044b\u0442\u044c \u0443\u0441\u0442\u0430\u0440\u0435\u0432\u0448\u0438\u043c\u0438.',true);cancelPlacement();});
  window.addEventListener('online',() => {if (db) loadPins(); else location.reload();});
  document.addEventListener('visibilitychange',() => {if (!document.hidden) loadPins();});
  window.addEventListener('beforeinstallprompt',event => {event.preventDefault();installPrompt = event;$('install').hidden = false;});
  $('install').addEventListener('click',async () => {
    if (!installPrompt) return;
    await installPrompt.prompt(); await installPrompt.userChoice;
    installPrompt = null; $('install').hidden = true;
  });
  window.addEventListener('appinstalled',() => {$('install').hidden = true;});

  function loadMapResource(kind,url) {
    return new Promise((resolve,reject) => {
      const node = document.createElement(kind === 'script' ? 'script' : 'link');
      if (kind === 'script') {node.src = url; node.async = true;}
      else {node.rel = 'stylesheet'; node.href = url;}
      const timer = setTimeout(() => {
        node.onload = node.onerror = null; node.remove(); reject(new Error('MAPLY_MAP_RESOURCE_TIMEOUT'));
      },15000);
      node.onload = () => {clearTimeout(timer); resolve();};
      node.onerror = () => {clearTimeout(timer); node.remove(); reject(new Error('MAPLY_MAP_RESOURCE_FAILED'));};
      document.head.append(node);
    });
  }
  async function initBasemap() {
    // Keep a usable base map while the vector renderer loads, or if WebGL is unavailable.
    const fallback = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      maxZoom:19
    }).addTo(map);
    let modern;
    try {
      await Promise.all([
        loadMapResource('style','https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.css'),
        loadMapResource('script','https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js')
      ]);
      if (typeof window.maplibregl?.Map !== 'function') throw new Error('MAPLY_MAP_LIBRARY_UNAVAILABLE');
      await loadMapResource('script','https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.0.22/leaflet-maplibre-gl.js');
      modern = L.maplibreGL({
        style:'https://tiles.openfreemap.org/styles/liberty',
        interactive:false,
        renderWorldCopies:true,
        attribution:'<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> &copy; <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
      }).addTo(map);
      modern.getContainer().style.visibility = 'hidden';
      const gl = modern.getMaplibreMap();
      await new Promise((resolve,reject) => {
        const cleanup = () => {clearTimeout(timer); gl.off('load',ready); gl.off('error',failed);};
        const ready = () => {cleanup(); resolve();};
        const failed = () => {cleanup(); reject(new Error('MAPLY_VECTOR_MAP_FAILED'));};
        const timer = setTimeout(failed,20000);
        gl.once('load',ready); gl.once('error',failed);
        if (gl.loaded()) ready();
      });
      modern.getContainer().style.visibility = '';
      map.removeLayer(fallback);
      gl.getCanvas().addEventListener('webglcontextlost',() => {
        // Let MapLibre restore its context, and show the raster map meanwhile.
        if (!map.hasLayer(fallback)) fallback.addTo(map);
        modern.getContainer().style.visibility = 'hidden';
      });
      gl.getCanvas().addEventListener('webglcontextrestored',() => {
        gl.once('idle',() => {
          modern.getContainer().style.visibility = '';
          if (map.hasLayer(fallback)) map.removeLayer(fallback);
        });
      });
    } catch (error) {
      console.warn('Maply basemap:',error);
      if (modern && map.hasLayer(modern)) map.removeLayer(modern);
      toast('\u0421\u043e\u0432\u0440\u0435\u043c\u0435\u043d\u043d\u0430\u044f \u043a\u0430\u0440\u0442\u0430 \u043f\u043e\u043a\u0430 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430. \u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u043c \u043e\u0431\u044b\u0447\u043d\u0443\u044e \u043a\u0430\u0440\u0442\u0443.');
    }
  }

  async function init() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => toast('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0443 \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u044f. \u041a\u0430\u0440\u0442\u0430 \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442 \u0432 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435.'));
    if (!window.L) {status('\u041a\u0430\u0440\u0442\u0430 \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043b\u0430\u0441\u044c. \u041f\u0440\u043e\u0432\u0435\u0440\u044c \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442 \u0438 \u043e\u0431\u043d\u043e\u0432\u0438 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443.',true);return;}
    map = L.map('map',{zoomControl:false,worldCopyJump:true,minZoom:3,maxZoom:19,maxBoundsViscosity:1,maxBounds:[[-85.05112878,-540],[85.05112878,540]]}).setView([41.0082,28.9784],12);
    initBasemap();
    L.control.zoom({position:'bottomleft'}).addTo(map);
    layer = L.layerGroup().addTo(map);
    map.on('moveend',scheduleLoad);
    map.on('click',event => {
      if (!placing) return;
      selectedPoint = event.latlng; cancelPlacement();
      $('pin-form').reset(); $('title').required = false;
      $('coordinates').textContent = `\u041c\u0435\u0441\u0442\u043e: ${selectedPoint.lat.toFixed(5)}, ${wrapLng(selectedPoint.lng).toFixed(5)}`;
      message('pin-message',''); $('pin-dialog').showModal();
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
        user = session?.user || null; ++loadNumber; updateAccount();
        for (const marker of pinsById.values()) {marker.maplyPin.my_vote = null; refreshPopup(marker.maplyPin.id);}
        scheduleLoad();
      });
      const {data,error} = await db.auth.getSession();
      if (error) throw error;
      user = data.session?.user || null; updateAccount();
      await loadPins(); setInterval(loadPins,30000);
      if (location.hash.includes('error')) {
        toast('\u0421\u0441\u044b\u043b\u043a\u0430 \u0434\u043b\u044f \u0432\u0445\u043e\u0434\u0430 \u043d\u0435\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043b\u044c\u043d\u0430 \u0438\u043b\u0438 \u0443\u0441\u0442\u0430\u0440\u0435\u043b\u0430. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u0432\u043e\u0439\u0442\u0438 \u0441\u043d\u043e\u0432\u0430.');
        history.replaceState(null,'',location.pathname);
      }
    } catch (error) {status(errorText(error),true);}
  }
  init().catch(error => status(errorText(error),true));
})();
