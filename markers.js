'use strict';
(() => {
  function create({map,TYPES,getDb,getUser,matchesPin,fadeOld,openLogin,toast,status,errorText,element}) {
    const $ = id => document.getElementById(id);
    const EVENT_TYPES = new Set(['accident','closed','police']);
    const layer = L.layerGroup().addTo(map), pinsById = new Map(), pendingVotes = new Set();
    let loadedPins = [], pinsLoaded = false, loadNumber = 0, loadTimer;
  function availablePin(pin) {
    return !pin.hidden_by_votes && Number.isFinite(Date.parse(pin.expires_at)) && Date.parse(pin.expires_at) > Date.now();
  }
  function agedPin(pin) {
    return EVENT_TYPES.has(pin.type) && Date.now() - Date.parse(pin.created_at) >= 3600000;
  }
  function removeCachedPin(id) {
    loadedPins = loadedPins.filter(pin => pin.id !== id);
    const marker = pinsById.get(id);
    if (marker) layer.removeLayer(marker);
    pinsById.delete(id);updateCount();
  }
  function expireCachedPins() {
    for (const pin of loadedPins.filter(pin => !availablePin(pin))) removeCachedPin(pin.id);
  }
  function updateCount() {
    const count = pinsById.size;
    const last = count % 10, lastTwo = count % 100;
    const word = last === 1 && lastTwo !== 11 ? '\u043c\u0435\u0442\u043a\u0430'
      : last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? '\u043c\u0435\u0442\u043a\u0438' : '\u043c\u0435\u0442\u043e\u043a';
    $('count').textContent = String(count);
    $('count-caption').textContent = word + ' \u0432 \u044d\u0442\u043e\u0439 \u043e\u0431\u043b\u0430\u0441\u0442\u0438';
  }
  function showPinsStatus() {
    status(loadedPins.length === 500 ? '\u0417\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u044b 500 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0445 \u043c\u0435\u0442\u043e\u043a. \u041f\u0440\u0438\u0431\u043b\u0438\u0437\u044c \u043a\u0430\u0440\u0442\u0443, \u0447\u0442\u043e\u0431\u044b \u0443\u0432\u0438\u0434\u0435\u0442\u044c \u0431\u043e\u043b\u044c\u0448\u0435.' : '');
  }
  function durationText(milliseconds) {
    const minutes = Math.max(1,Math.ceil(milliseconds / 60000));
    if (minutes < 60) return minutes + ' \u043c\u0438\u043d.';
    const hours = Math.floor(minutes / 60), rest = minutes % 60;
    if (hours >= 24) return Math.floor(hours / 24) + ' \u0434. ' + (hours % 24) + ' \u0447.';
    return hours + ' \u0447.' + (rest ? ' ' + rest + ' \u043c\u0438\u043d.' : '');
  }
  function ageText(pin) {
    const elapsed = Math.max(0,Date.now() - Date.parse(pin.created_at));
    return elapsed < 60000 ? '\u0422\u043e\u043b\u044c\u043a\u043e \u0447\u0442\u043e' : durationText(elapsed) + ' \u043d\u0430\u0437\u0430\u0434';
  }
  async function voteFor(pin,choice) {
    const db = getDb(), user = getUser();
    if (!availablePin(pin)) {toast('\u0421\u0440\u043e\u043a \u044d\u0442\u043e\u0439 \u043c\u0435\u0442\u043a\u0438 \u0443\u0436\u0435 \u0438\u0441\u0442\u0451\u043a \u0438\u043b\u0438 \u043e\u043d\u0430 \u0441\u043a\u0440\u044b\u0442\u0430.');await loadPins();return;}
    if (!navigator.onLine) return toast('\u0414\u043b\u044f \u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043d\u0438\u044f \u043d\u0443\u0436\u0435\u043d \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442.');
    if (!db) return toast('\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 \u0435\u0449\u0451 \u043d\u0435 \u0433\u043e\u0442\u043e\u0432\u043e. \u041e\u0431\u043d\u043e\u0432\u0438 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443.');
    if (!user) {
      openLogin();return;
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
        removeCachedPin(pin.id);
        toast('\u0413\u043e\u043b\u043e\u0441 \u0443\u0447\u0442\u0451\u043d. \u041c\u0435\u0442\u043a\u0430 \u0441\u043a\u0440\u044b\u0442\u0430: \u00ab\u043d\u0435\u0442\u00bb \u043d\u0430 3 \u0431\u043e\u043b\u044c\u0448\u0435, \u0447\u0435\u043c \u00ab\u0430\u043a\u0442\u0443\u0430\u043b\u044c\u043d\u043e\u00bb.');
      } else {
        const updated = {active_votes:data.active_votes,gone_votes:data.gone_votes,
          expires_at:data.expires_at,my_vote:getUser()?.id === voterId ? data.my_vote : null};
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
    const user = getUser(), db = getDb();
    const box = element('div',undefined,'pin-popup');
    const type = TYPES[pin.type] || TYPES.custom;
    box.append(element('h2',type.emoji + ' ' + pin.title));
    box.append(element('p',type.name,'small'));
    box.append(element('p',user?.id === pin.user_id ? '\u0422\u0432\u043e\u044f \u043c\u0435\u0442\u043a\u0430' : '\u0414\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u0430 \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u043e\u043c Maply','pin-author'));
    const meta = element('div',undefined,'pin-meta');
    for (const [label,value] of [['\u0421\u043e\u0437\u0434\u0430\u043d\u0430',ageText(pin)],['\u041e\u0441\u0442\u0430\u043b\u043e\u0441\u044c',durationText(Math.max(0,Date.parse(pin.expires_at) - Date.now()))]]) {
      const cell = element('div',undefined,'meta-cell');
      cell.append(element('span',label,'meta-label'),element('span',value,'meta-value'));meta.append(cell);
    }
    box.append(meta);
    const life = element('div',undefined,'life-track'), fill = element('span',undefined,'life-fill');
    const lifetime = Math.max(1,Date.parse(pin.expires_at) - Date.parse(pin.created_at));
    fill.style.width = Math.max(0,Math.min(100,100 * (Date.parse(pin.expires_at) - Date.now()) / lifetime)) + '%';
    life.setAttribute('aria-hidden','true');life.append(fill);box.append(life);
    if (agedPin(pin)) box.append(element('p','\u0421\u043e\u0431\u044b\u0442\u0438\u0435 \u0441\u043e\u0437\u0434\u0430\u043d\u043e \u0431\u043e\u043b\u044c\u0448\u0435 \u0447\u0430\u0441\u0430 \u043d\u0430\u0437\u0430\u0434. \u041f\u0440\u043e\u0432\u0435\u0440\u044c, \u043e\u0441\u0442\u0430\u0451\u0442\u0441\u044f \u043b\u0438 \u043e\u043d\u043e \u0430\u043a\u0442\u0443\u0430\u043b\u044c\u043d\u044b\u043c.','age-note'));
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
        if (getUser()?.id !== pin.user_id) return toast('\u0412\u043e\u0439\u0434\u0438 \u0432 \u0430\u043a\u043a\u0430\u0443\u043d\u0442 \u0430\u0432\u0442\u043e\u0440\u0430, \u0447\u0442\u043e\u0431\u044b \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u043c\u0435\u0442\u043a\u0443.');
        if (!confirm('\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u044d\u0442\u0443 \u043c\u0435\u0442\u043a\u0443?')) return;
        button.disabled = true;
        try {
          const {data,error} = await db.from('maply_markers').delete().eq('id',pin.id).eq('user_id',user.id).select('id');
          if (error) throw error;
          if (!data?.length) {toast('\u041c\u0435\u0442\u043a\u0430 \u0443\u0436\u0435 \u0438\u0441\u0447\u0435\u0437\u043b\u0430 \u0438\u043b\u0438 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430.');}
          else toast('\u041c\u0435\u0442\u043a\u0430 \u0443\u0434\u0430\u043b\u0435\u043d\u0430.');
          removeCachedPin(pin.id);map.closePopup(); await loadPins();
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
      if (!availablePin(pin) || !matchesPin(pin)) continue;
      if (!Number.isFinite(pin.lat) || !Number.isFinite(pin.lng)) continue;
      const type = TYPES[pin.type] || TYPES.custom;
      const icon = L.divIcon({className:'pin-icon' + (fadeOld() && agedPin(pin) ? ' pin-aged' : ''),html:`<div class="pin-badge" style="--pin-color:${type.color}"><span>${type.emoji}</span></div>`,iconSize:[40,40],iconAnchor:[20,40],popupAnchor:[0,-36]});
      const marker = L.marker([pin.lat,pin.lng],{icon,title:pin.title,keyboard:true,draggable:false})
        .bindPopup(popupFor(pin)).addTo(layer);
      marker.maplyPin = pin; pinsById.set(pin.id,marker);
    }
    updateCount();
    if (openId && pinsById.has(openId)) pinsById.get(openId).openPopup();
  }
  const wrapLng = lng => ((lng + 180) % 360 + 360) % 360 - 180;
  async function loadPins() {
    const db = getDb(), user = getUser();
    if (!db || !map || document.hidden) return;
    expireCachedPins();
    if (!navigator.onLine) {renderPins(loadedPins);status('\u041d\u0435\u0442 \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442\u0430. \u041c\u0435\u0442\u043a\u0438 \u0438 \u043a\u0430\u0440\u0442\u0430 \u043c\u043e\u0433\u0443\u0442 \u0431\u044b\u0442\u044c \u0443\u0441\u0442\u0430\u0440\u0435\u0432\u0448\u0438\u043c\u0438.',true);return;}
    const number = ++loadNumber;
    const viewerId = user?.id || null;
    $('refresh').disabled = true;
    if (!pinsLoaded) status('\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c \u043c\u0435\u0442\u043a\u0438\u2026');
    const bounds = map.getBounds();
    let query = db.from('maply_markers').select('id,user_id,type,title,description,lat,lng,created_at,expires_at,active_votes,gone_votes,hidden_by_votes')
      .eq('hidden_by_votes',false).gt('expires_at',new Date().toISOString())
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
        if (number !== loadNumber || viewerId !== (getUser()?.id || null)) return;
        if (voteError) throw voteError;
        ownVotes = new Map((votes || []).map(vote => [vote.marker_id,vote.vote]));
      }
      if (number !== loadNumber || viewerId !== (getUser()?.id || null)) return;
      for (const pin of pins) pin.my_vote = ownVotes.get(pin.id) || null;
      loadedPins = pins; pinsLoaded = true; renderPins(loadedPins);
      showPinsStatus();
    } catch (error) {if (number === loadNumber) status(errorText(error),true);}
    finally {if (number === loadNumber) $('refresh').disabled = false;}
  }
  function scheduleLoad() {clearTimeout(loadTimer);loadTimer = setTimeout(loadPins,350);}

    return {load:loadPins,render() {renderPins(loadedPins);},schedule:scheduleLoad,
      isLoaded:() => pinsLoaded,showStatus:showPinsStatus,expire:expireCachedPins,
      authChanged() {++loadNumber;for (const pin of loadedPins) pin.my_vote = null;renderPins(loadedPins);scheduleLoad();}
    };
  }
  window.MaplyMarkers = {create};
})();
