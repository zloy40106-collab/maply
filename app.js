'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const TYPES = {
    accident: {name:'ĞĞ²Ğ°Ñ€Ğ¸Ñ',emoji:'ğŸš—',color:'#dc4949'},
    closed: {name:'Ğ”Ğ¾Ñ€Ğ¾Ğ³Ğ° Ğ·Ğ°ĞºÑ€Ñ‹Ñ‚Ğ°',emoji:'â›”',color:'#dc7133'},
    police: {name:'ĞŸĞ¾Ğ»Ğ¸Ñ†Ğ¸Ñ',emoji:'ğŸš“',color:'#397dc5'},
    pothole: {name:'Ğ¯Ğ¼Ğ°',emoji:'ğŸ•³ï¸',color:'#927129'},
    custom: {name:'Ğ¡Ğ²Ğ¾Ñ Ğ¼ĞµÑ‚ĞºĞ°',emoji:'ğŸ“',color:'#07887f'}
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
    if (text.includes('MAPLY_MARKER_UNAVAILABLE')) return 'ĞœĞµÑ‚ĞºĞ° ÑƒĞ¶Ğµ ÑĞºÑ€Ñ‹Ñ‚Ğ°, ÑƒĞ´Ğ°Ğ»ĞµĞ½Ğ° Ğ¸Ğ»Ğ¸ ĞµÑ‘ ÑÑ€Ğ¾Ğº Ğ¸ÑÑ‚Ñ‘Ğº.';
    if (text.includes('MAPLY_INVALID_VOTE')) return 'ĞĞµ ÑƒĞ´Ğ°Ğ»Ğ¾ÑÑŒ Ñ€Ğ°ÑĞ¿Ğ¾Ğ·Ğ½Ğ°Ñ‚ÑŒ Ğ³Ğ¾Ğ»Ğ¾Ñ. ĞĞ±Ğ½Ğ¾Ğ²Ğ¸ ÑÑ‚Ñ€Ğ°Ğ½Ğ¸Ñ†Ñƒ.';
    if (text.includes('maply_vote') || text.includes('maply_votes') || text.includes('active_votes') || text.includes('hidden_by_votes') || error?.code === 'PGRST202') return 'Ğ“Ğ¾Ğ»Ğ¾ÑĞ¾Ğ²Ğ°Ğ½Ğ¸Ğµ ĞµÑ‰Ñ‘ Ğ½Ğµ Ğ½Ğ°ÑÑ‚Ñ€Ğ¾ĞµĞ½Ğ¾. Ğ’Ñ‹Ğ¿Ğ¾Ğ»Ğ½Ğ¸ 1-SQL-golosovanie.sql Ğ² Supabase SQL Editor.';
    if (text.includes('MAPLY_RATE_LIMIT')) return 'Ğ—Ğ° Ñ‡Ğ°Ñ Ğ¼Ğ¾Ğ¶Ğ½Ğ¾ Ğ´Ğ¾Ğ±Ğ°Ğ²Ğ¸Ñ‚ÑŒ 20 Ğ¼ĞµÑ‚Ğ¾Ğº. ĞŸĞ¾Ğ¿Ñ€Ğ¾Ğ±ÑƒĞ¹ Ğ¿Ğ¾Ğ·Ğ¶Ğµ.';
    if (text.includes('Invalid login credentials')) return 'ĞŸÑ€Ğ¾Ğ²ĞµÑ€ÑŒ email Ğ¸ Ğ¿Ğ°Ñ€Ğ¾Ğ»ÑŒ.';
    if (text.includes('Email not confirmed')) return 'ĞŸĞ¾Ğ´Ñ‚Ğ²ĞµÑ€Ğ´Ğ¸ email Ğ¿Ğ¾ ÑÑÑ‹Ğ»ĞºĞµ Ğ² Ğ¿Ğ¸ÑÑŒĞ¼Ğµ, Ğ·Ğ°Ñ‚ĞµĞ¼ Ğ²Ğ¾Ğ¹Ğ´Ğ¸.';
    if (text.includes('rate limit') || text.includes('security purposes')) return 'Ğ¡Ğ»Ğ¸ÑˆĞºĞ¾Ğ¼ Ğ¼Ğ½Ğ¾Ğ³Ğ¾ Ğ¿Ğ¾Ğ¿Ñ‹Ñ‚Ğ¾Ğº. ĞŸĞ¾Ğ´Ğ¾Ğ¶Ğ´Ğ¸ Ğ½ĞµÑĞºĞ¾Ğ»ÑŒĞºĞ¾ Ğ¼Ğ¸Ğ½ÑƒÑ‚.';
    if (text.includes('email_address_not_authorized') || text.includes('Email address') && text.includes('not authorized')) return 'ĞÑ‚Ğ¿Ñ€Ğ°Ğ²ĞºĞ° Ğ¿Ğ¸ÑĞµĞ¼ Ğ½Ğ° ÑÑ‚Ğ¾Ñ‚ Ğ°Ğ´Ñ€ĞµÑ Ğ¿Ğ¾ĞºĞ° Ğ½Ğµ Ğ½Ğ°ÑÑ‚Ñ€Ğ¾ĞµĞ½Ğ°. Ğ’Ğ»Ğ°Ğ´ĞµĞ»ĞµÑ† Maply Ğ´Ğ¾Ğ»Ğ¶ĞµĞ½ Ğ¿Ğ¾Ğ´ĞºĞ»ÑÑ‡Ğ¸Ñ‚ÑŒ SMTP Ğ² Supabase.';
    if (text.includes('Password')) return 'ĞŸĞ°Ñ€Ğ¾Ğ»ÑŒ Ğ½Ğµ Ğ¿Ğ¾Ğ´Ñ…Ğ¾Ğ´Ğ¸Ñ‚ Ñ‚Ñ€ĞµĞ±Ğ¾Ğ²Ğ°Ğ½Ğ¸ÑĞ¼. ĞŸĞ¾Ğ¿Ñ€Ğ¾Ğ±ÑƒĞ¹ Ğ±Ğ¾Ğ»ĞµĞµ Ğ´Ğ»Ğ¸Ğ½Ğ½Ñ‹Ğ¹ Ğ¿Ğ°Ñ€Ğ¾Ğ»ÑŒ.';
    if (text.includes('already registered')) return 'Ğ­Ñ‚Ğ¾Ñ‚ email ÑƒĞ¶Ğµ Ğ·Ğ°Ñ€ĞµĞ³Ğ¸ÑÑ‚Ñ€Ğ¸Ñ€Ğ¾Ğ²Ğ°Ğ½. Ğ’Ñ‹Ğ±ĞµÑ€Ğ¸ Â«Ğ’Ğ¾Ğ¹Ñ‚Ğ¸Â».';
    if (text.includes('Failed to fetch') || text.includes('NetworkError') || !navigator.onLine) return 'ĞĞµÑ‚ ÑĞ¾ĞµĞ´Ğ¸Ğ½ĞµĞ½Ğ¸Ñ. ĞŸÑ€Ğ¾Ğ²ĞµÑ€ÑŒ Ğ¸Ğ½Ñ‚ĞµÑ€Ğ½ĞµÑ‚ Ğ¸ Ğ¿Ğ¾Ğ¿Ñ€Ğ¾Ğ±ÑƒĞ¹ ÑĞ½Ğ¾Ğ²Ğ°.';
    if (text.includes('maply_markers') || error?.code === 'PGRST205') return 'Ğ¢Ğ°Ğ±Ğ»Ğ¸Ñ†Ğ° Maply ĞµÑ‰Ñ‘ Ğ½Ğµ Ğ³Ğ¾Ñ‚Ğ¾Ğ²Ğ°. Ğ’Ñ‹Ğ¿Ğ¾Ğ»Ğ½Ğ¸ Ğ¸ÑÑ…Ğ¾Ğ´Ğ½Ñ‹Ğ¹ 0-SQL-dlya-Supabase.sql Ğ² Supabase SQL Editor.';
    if (error?.code === '42501' || text.includes('JWT') || text.includes('MAPLY_LOGIN_REQUIRED')) return 'ĞĞµ ÑƒĞ´Ğ°Ğ»Ğ¾ÑÑŒ Ğ¿Ğ¾Ğ´Ñ‚Ğ²ĞµÑ€Ğ´Ğ¸Ñ‚ÑŒ Ğ²Ñ…Ğ¾Ğ´. Ğ’Ñ‹Ğ¹Ğ´Ğ¸ Ğ¸ Ğ²Ğ¾Ğ¹Ğ´Ğ¸ ÑĞ½Ğ¾Ğ²Ğ°. Ğ•ÑĞ»Ğ¸ Ğ¾ÑˆĞ¸Ğ±ĞºĞ° Ğ¾ÑÑ‚Ğ°Ñ‘Ñ‚ÑÑ, Ğ¿Ñ€Ğ¾Ğ²ĞµÑ€ÑŒ Ğ½Ğ°ÑÑ‚Ñ€Ğ¾Ğ¹ĞºĞ¸ Ğ±Ğ°Ğ·Ñ‹.';
    return 'ĞĞµ ÑƒĞ´Ğ°Ğ»Ğ¾ÑÑŒ Ğ²Ñ‹Ğ¿Ğ¾Ğ»Ğ½Ğ¸Ñ‚ÑŒ Ğ´ĞµĞ¹ÑÑ‚Ğ²Ğ¸Ğµ. ĞŸĞ¾Ğ¿Ñ€Ğ¾Ğ±ÑƒĞ¹ ÑĞ½Ğ¾Ğ²Ğ°. ' + text.slice(0,180);
  }
  function cancelPlacement() {
    placing = false; $('placement').hidden = true; document.body.classList.remove('placing');
  }
  function beginPlacement() {
    if (!navigator.onLine) return toast('Ğ”Ğ»Ñ Ğ´Ğ¾Ğ±Ğ°Ğ²Ğ»ĞµĞ½Ğ¸Ñ Ğ¼ĞµÑ‚ĞºĞ¸ Ğ½ÑƒĞ¶ĞµĞ½ Ğ¸Ğ½Ñ‚ĞµÑ€Ğ½ĞµÑ‚.');
    if (!db) return toast('ĞŸĞ¾Ğ´ĞºĞ»ÑÑ‡ĞµĞ½Ğ¸Ğµ ĞµÑ‰Ñ‘ Ğ½Ğµ Ğ³Ğ¾Ñ‚Ğ¾Ğ²Ğ¾. ĞĞ±Ğ½Ğ¾Ğ²Ğ¸ ÑÑ‚Ñ€Ğ°Ğ½Ğ¸Ñ†Ñƒ Ğ¸Ğ»Ğ¸ Ğ¿Ñ€Ğ¾Ğ²ĞµÑ€ÑŒ Ğ½Ğ°ÑÑ‚Ñ€Ğ¾Ğ¹ĞºĞ¸ Vercel.');
    if (!user) {
      resumeAfterLogin = true; message('auth-message','Ğ’Ğ¾Ğ¹Ğ´Ğ¸, Ñ‡Ñ‚Ğ¾Ğ±Ñ‹ Ğ´Ğ¾Ğ±Ğ°Ğ²Ğ¸Ñ‚ÑŒ Ğ¼ĞµÑ‚ĞºÑƒ.');
      $('auth-dialog').showModal(); return;
    }
    placing = true; selectedPoint = null; map.closePopup();
    $('placement').hidden = false; document.body.classList.add('placing');
  }
  function updateAccount() {
    $('account').textContent = user ? 'ĞĞºĞºĞ°ÑƒĞ½Ñ‚' : 'Ğ’Ğ¾Ğ¹Ñ‚Ğ¸';
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
    if (!navigator.onLine) return toast('Ğ”Ğ»Ñ Ğ³Ğ¾Ğ»Ğ¾ÑĞ¾Ğ²Ğ°Ğ½Ğ¸Ñ Ğ½ÑƒĞ¶ĞµĞ½ Ğ¸Ğ½Ñ‚ĞµÑ€Ğ½ĞµÑ‚.');
    if (!db) return toast('ĞŸĞ¾Ğ´ĞºĞ»ÑÑ‡ĞµĞ½Ğ¸Ğµ ĞµÑ‰Ñ‘ Ğ½Ğµ Ğ³Ğ¾Ñ‚Ğ¾Ğ²Ğ¾. ĞĞ±Ğ½Ğ¾Ğ²Ğ¸ ÑÑ‚Ñ€Ğ°Ğ½Ğ¸Ñ†Ñƒ.');
    if (!user) {
      resumeAfterLogin = false;
      message('auth-message','Ğ’Ğ¾Ğ¹Ğ´Ğ¸, Ñ‡Ñ‚Ğ¾Ğ±Ñ‹ Ğ³Ğ¾Ğ»Ğ¾ÑĞ¾Ğ²Ğ°Ñ‚ÑŒ. ĞŸĞ¾ÑĞ»Ğµ Ğ²Ñ…Ğ¾Ğ´Ğ° Ğ¾Ñ‚ĞºÑ€Ğ¾Ğ¹ Ğ¼ĞµÑ‚ĞºÑƒ Ğ¸ Ğ²Ñ‹Ğ±ĞµÑ€Ğ¸ Ğ³Ğ¾Ğ»Ğ¾Ñ.');
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
        toast('Ğ“Ğ¾Ğ»Ğ¾Ñ ÑƒÑ‡Ñ‚Ñ‘Ğ½. ĞœĞµÑ‚ĞºĞ° ÑĞºÑ€Ñ‹Ñ‚Ğ°: Â«Ğ½ĞµÑ‚Â» Ğ½Ğ° 3 Ğ±Ğ¾Ğ»ÑŒÑˆĞµ, Ñ‡ĞµĞ¼ Â«Ğ°ĞºÑ‚ÑƒĞ°Ğ»ÑŒĞ½Ğ¾Â».');
      } else {
        const updated = {active_votes:data.active_votes,gone_votes:data.gone_votes,
          expires_at:data.expires_at,my_vote:user?.id === voterId ? data.my_vote : null};
        Object.assign(pin,updated);
        const currentMarker = pinsById.get(pin.id);
        if (currentMarker) Object.assign(currentMarker.maplyPin,updated);
        refreshPopup(pin.id);
        toast(data.extended ? 'Ğ“Ğ¾Ğ»Ğ¾Ñ ÑƒÑ‡Ñ‚Ñ‘Ğ½. Ğ¡Ñ€Ğ¾Ğº Ğ¼ĞµÑ‚ĞºĞ¸ Ğ¿Ñ€Ğ¾Ğ´Ğ»Ñ‘Ğ½ Ğ½Ğ° 2 Ñ‡Ğ°ÑĞ°.' : 'Ğ“Ğ¾Ğ»Ğ¾Ñ ÑƒÑ‡Ñ‚Ñ‘Ğ½.');
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
    box.append(element('p','Ğ’Ğ¸Ğ´Ğ½Ğ° Ğ´Ğ¾: ' + new Date(pin.expires_at).toLocaleString('ru-RU',{
      day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'
    }),'small'));
    box.append(element('p',`ĞĞºÑ‚ÑƒĞ°Ğ»ÑŒĞ½Ğ¾: ${pin.active_votes} / ĞĞµÑ‚: ${pin.gone_votes}`,'vote-counts'));
    const votes = element('div',undefined,'vote-buttons');
    for (const [choice,label] of [['active','Ğ•Ñ‰Ñ‘ Ğ°ĞºÑ‚ÑƒĞ°Ğ»ÑŒĞ½Ğ¾'],['gone','Ğ£Ğ¶Ğµ Ğ½ĞµÑ‚']]) {
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
      ? 'ĞœĞ¾Ğ¶Ğ½Ğ¾ Ğ¼ĞµĞ½ÑÑ‚ÑŒ Ğ³Ğ¾Ğ»Ğ¾Ñ. ĞŸĞµÑ€Ğ²Ğ¾Ğµ Â«Ğ°ĞºÑ‚ÑƒĞ°Ğ»ÑŒĞ½Ğ¾Â» Ğ¾Ñ‚ Ñ‚ĞµĞ±Ñ Ğ´Ğ¾Ğ±Ğ°Ğ²Ğ¸Ñ‚ 2 Ñ‡Ğ°ÑĞ°. ĞŸÑ€Ğ¸ Ğ¿ĞµÑ€ĞµĞ²ĞµÑĞµ Â«Ğ½ĞµÑ‚Â» Ğ½Ğ° 3 Ğ¼ĞµÑ‚ĞºĞ° ÑĞºÑ€Ñ‹Ğ²Ğ°ĞµÑ‚ÑÑ.'
      : 'Ğ’Ğ¾Ğ¹Ğ´Ğ¸, Ñ‡Ñ‚Ğ¾Ğ±Ñ‹ Ğ³Ğ¾Ğ»Ğ¾ÑĞ¾Ğ²Ğ°Ñ‚ÑŒ. ĞŸÑ€Ğ¸ Ğ¿ĞµÑ€ĞµĞ²ĞµÑĞµ Â«Ğ½ĞµÑ‚Â» Ğ½Ğ° 3 Ğ¼ĞµÑ‚ĞºĞ° ÑĞºÑ€Ñ‹Ğ²Ğ°ĞµÑ‚ÑÑ.','vote-hint'));
    if (user?.id === pin.user_id) {
      const button = element('button','Ğ£Ğ´Ğ°Ğ»Ğ¸Ñ‚ÑŒ Ğ¼Ğ¾Ñ Ğ¼ĞµÑ‚ĞºÑƒ');
      button.type = 'button';
      button.addEventListener('click',async () => {
        if (!navigator.onLine) return toast('Ğ”Ğ»Ñ ÑƒĞ´Ğ°Ğ»ĞµĞ½Ğ¸Ñ Ğ½ÑƒĞ¶ĞµĞ½ Ğ¸Ğ½Ñ‚ĞµÑ€Ğ½ĞµÑ‚.');
        if (!confirm('Ğ£Ğ´Ğ°Ğ»Ğ¸Ñ‚ÑŒ ÑÑ‚Ñƒ Ğ¼ĞµÑ‚ĞºÑƒ?')) return;
        button.disabled = true;
        try {
          const {data,error} = await db.from('maply_markers').delete().eq('id',pin.id).eq('user_id',user.id).select('id');
          if (error) throw error;
          if (!data?.length) {toast('ĞœĞµÑ‚ĞºĞ° ÑƒĞ¶Ğµ Ğ¸ÑÑ‡ĞµĞ·Ğ»Ğ° Ğ¸Ğ»Ğ¸ Ğ½ĞµĞ´Ğ¾ÑÑ‚ÑƒĞ¿Ğ½Ğ°.');}
          else toast('ĞœĞµÑ‚ĞºĞ° ÑƒĞ´Ğ°Ğ»ĞµĞ½Ğ°.');
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
    if (!navigator.onLine) {status('ĞĞµÑ‚ Ğ¸Ğ½Ñ‚ĞµÑ€Ğ½ĞµÑ‚Ğ°. ĞœĞµÑ‚ĞºĞ¸ Ğ¸ ĞºĞ°Ñ€Ñ‚Ğ° Ğ¼Ğ¾Ğ³ÑƒÑ‚ Ğ±Ñ‹Ñ‚ÑŒ ÑƒÑÑ‚Ğ°Ñ€ĞµĞ²ÑˆĞ¸Ğ¼Ğ¸.',true);return;}
    const number = ++loadNumber;
    const viewerId = user?.id || null;
    $('refresh').disabled = true;
    status('ĞĞ±Ğ½Ğ¾Ğ²Ğ»ÑĞµĞ¼ Ğ¼ĞµÑ‚ĞºĞ¸â€¦');
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
      status(pins.length === 500 ? 'ĞŸĞ¾ĞºĞ°Ğ·Ğ°Ğ½Ñ‹ 500 Ğ¿Ğ¾ÑĞ»ĞµĞ´Ğ½Ğ¸Ñ… Ğ¼ĞµÑ‚Ğ¾Ğº. ĞŸÑ€Ğ¸Ğ±Ğ»Ğ¸Ğ·ÑŒ ĞºĞ°Ñ€Ñ‚Ñƒ.' : pins.length ? 'ĞœĞµÑ‚ĞºĞ¸ Ğ¾Ğ±Ğ½Ğ¾Ğ²Ğ»ĞµĞ½Ñ‹' : 'Ğ—Ğ´ĞµÑÑŒ Ğ¿Ğ¾ĞºĞ° Ğ½ĞµÑ‚ Ğ¼ĞµÑ‚Ğ¾Ğº. ĞœĞ¾Ğ¶Ğ½Ğ¾ Ğ´Ğ¾Ğ±Ğ°Ğ²Ğ¸Ñ‚ÑŒ Ğ¿ĞµÑ€Ğ²ÑƒÑ.');
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
    $('auth-title').textContent = signingUp ? 'Ğ¡Ğ¾Ğ·Ğ´Ğ°Ñ‚ÑŒ Ğ°ĞºĞºĞ°ÑƒĞ½Ñ‚' : 'Ğ’Ñ…Ğ¾Ğ´ Ğ² Maply';
    $('auth-submit').textContent = signingUp ? 'Ğ—Ğ°Ñ€ĞµĞ³Ğ¸ÑÑ‚Ñ€Ğ¸Ñ€Ğ¾Ğ²Ğ°Ñ‚ÑŒÑÑ' : 'Ğ’Ğ¾Ğ¹Ñ‚Ğ¸';
    $('auth-switch').textContent = signingUp ? 'Ğ£Ğ¶Ğµ ĞµÑÑ‚ÑŒ Ğ°ĞºĞºĞ°ÑƒĞ½Ñ‚? Ğ’Ğ¾Ğ¹Ñ‚Ğ¸' : 'ĞĞµÑ‚ Ğ°ĞºĞºĞ°ÑƒĞ½Ñ‚Ğ°? Ğ—Ğ°Ñ€ĞµĞ³Ğ¸ÑÑ‚Ñ€Ğ¸Ñ€Ğ¾Ğ²Ğ°Ñ‚ÑŒÑÑ';
    $('password').autocomplete = signingUp ? 'new-password' : 'current-password';
    message('auth-message','');
  });
  $('auth-form').addEventListener('submit',async event => {
    event.preventDefault();
    if (!db) return message('auth-message','Ğ¡Ğ½Ğ°Ñ‡Ğ°Ğ»Ğ° Ğ½Ğ°ÑÑ‚Ñ€Ğ¾Ğ¹ Ğ¿Ğ¾Ğ´ĞºĞ»ÑÑ‡ĞµĞ½Ğ¸Ğµ Supabase Ğ² Vercel.');
    if (!navigator.onLine) return message('auth-message','Ğ”Ğ»Ñ Ğ²Ñ…Ğ¾Ğ´Ğ° Ğ½ÑƒĞ¶ĞµĞ½ Ğ¸Ğ½Ñ‚ĞµÑ€Ğ½ĞµÑ‚.');
    $('auth-submit').disabled = true; $('auth-switch').disabled = true; message('auth-message','');
    try {
      const credentials = {email:$('email').value.trim(),password:$('password').value};
      const result = signingUp
        ? await db.auth.signUp({...credentials,options:{emailRedirectTo:location.origin + '/'}})
        : await db.auth.signInWithPassword(credentials);
      if (result.error) throw result.error;
      $('password').value = '';
      if (signingUp && !result.data.session) {
        message('auth-message','ĞŸÑ€Ğ¾Ğ²ĞµÑ€ÑŒ Ğ¿Ğ¾Ñ‡Ñ‚Ñƒ Ğ¸ ÑĞ¿Ğ°Ğ¼. Ğ•ÑĞ»Ğ¸ Ğ°Ğ´Ñ€ĞµÑ Ğ½Ğ¾Ğ²Ñ‹Ğ¹, Ğ¿Ñ€Ğ¸Ğ´Ñ‘Ñ‚ Ğ¿Ğ¸ÑÑŒĞ¼Ğ¾ Ñ Ğ¿Ğ¾Ğ´Ñ‚Ğ²ĞµÑ€Ğ¶Ğ´ĞµĞ½Ğ¸ĞµĞ¼. Ğ—Ğ°Ñ‚ĞµĞ¼ Ğ²ĞµÑ€Ğ½Ğ¸ÑÑŒ Ğ¸ Ğ²Ğ¾Ğ¹Ğ´Ğ¸.',true);
      } else {
        user = result.data.session?.user || null; updateAccount(); $('auth-dialog').close(); toast('Ğ¢Ñ‹ Ğ²Ğ¾ÑˆÑ‘Ğ» Ğ² Maply.');
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
      user = null; updateAccount(); $('auth-dialog').close(); await loadPins(); toast('Ğ¢Ñ‹ Ğ²Ñ‹ÑˆĞµĞ» Ğ¸Ğ· Ğ°ĞºĞºĞ°ÑƒĞ½Ñ‚Ğ°.');
    } catch (error) {message('auth-message',errorText(error));}
    finally {$('logout').disabled = false;}
  });
  $('type').addEventListener('change',() => {$('title').required = $('type').value === 'custom';});
  $('pin-form').addEventListener('submit',async event => {
    event.preventDefault();
    if (!db || !user || !selectedPoint) return message('pin-message','Ğ’Ğ¾Ğ¹Ğ´Ğ¸ Ğ¸ Ğ²Ñ‹Ğ±ĞµÑ€Ğ¸ Ğ¼ĞµÑÑ‚Ğ¾ Ğ½Ğ° ĞºĞ°Ñ€Ñ‚Ğµ ĞµÑ‰Ñ‘ Ñ€Ğ°Ğ·.');
    if (!navigator.onLine) return message('pin-message','Ğ”Ğ»Ñ Ğ¿ÑƒĞ±Ğ»Ğ¸ĞºĞ°Ñ†Ğ¸Ğ¸ Ğ½ÑƒĞ¶ĞµĞ½ Ğ¸Ğ½Ñ‚ĞµÑ€Ğ½ĞµÑ‚.');
    const type = $('type').value;
    const title = $('title').value.trim() || (type === 'custom' ? '' : TYPES[type].name);
    if (!title) return message('pin-message','Ğ£ĞºĞ°Ğ¶Ğ¸ Ğ½Ğ°Ğ·Ğ²Ğ°Ğ½Ğ¸Ğµ ÑĞ²Ğ¾ĞµĞ¹ Ğ¼ĞµÑ‚ĞºĞ¸.');
    $('pin-submit').disabled = true; message('pin-message','');
    try {
      const {error} = await db.from('maply_markers').insert({
        user_id:user.id,type,title,description:$('description').value.trim(),
        lat:selectedPoint.lat,lng:wrapLng(selectedPoint.lng)
      });
      if (error) throw error;
      $('pin-dialog').close(); selectedPoint = null; toast('ĞœĞµÑ‚ĞºĞ° Ğ´Ğ¾Ğ±Ğ°Ğ²Ğ»ĞµĞ½Ğ°.'); await loadPins();
    } catch (error) {message('pin-message',errorText(error));}
    finally {$('pin-submit').disabled = false;}
  });
  $('locate').addEventListener('click',() => {
    if (!map) return toast('ĞšĞ°Ñ€Ñ‚Ğ° ĞµÑ‰Ñ‘ Ğ·Ğ°Ğ³Ñ€ÑƒĞ¶Ğ°ĞµÑ‚ÑÑ.');
    if (!navigator.geolocation) return toast('Ğ­Ñ‚Ğ¾Ñ‚ Ğ±Ñ€Ğ°ÑƒĞ·ĞµÑ€ Ğ½Ğµ Ğ¿Ğ¾Ğ´Ğ´ĞµÑ€Ğ¶Ğ¸Ğ²Ğ°ĞµÑ‚ Ğ³ĞµĞ¾Ğ»Ğ¾ĞºĞ°Ñ†Ğ¸Ñ.');
    $('locate').disabled = true;
    navigator.geolocation.getCurrentPosition(position => {
      const {latitude,longitude,accuracy} = position.coords;
      map.setView([Math.max(-85,Math.min(85,latitude)),longitude],16);
      if (locationLayer) map.removeLayer(locationLayer);
      locationLayer = L.circle([latitude,longitude],{radius:Math.max(accuracy,8),color:'#397dc5',fillColor:'#397dc5',fillOpacity:.15,weight:2}).addTo(map);
      $('locate').disabled = false;
    },error => {
      $('locate').disabled = false;
      toast(error.code === 1 ? 'Ğ Ğ°Ğ·Ñ€ĞµÑˆĞ¸ Ğ´Ğ¾ÑÑ‚ÑƒĞ¿ Ğº Ğ¼ĞµÑÑ‚Ğ¾Ğ¿Ğ¾Ğ»Ğ¾Ğ¶ĞµĞ½Ğ¸Ñ Ğ² Ğ½Ğ°ÑÑ‚Ñ€Ğ¾Ğ¹ĞºĞ°Ñ… Ğ±Ñ€Ğ°ÑƒĞ·ĞµÑ€Ğ°. ĞœĞµÑÑ‚Ğ¾ ÑĞ¾Ğ±Ñ‹Ñ‚Ğ¸Ñ Ğ¼Ğ¾Ğ¶Ğ½Ğ¾ Ğ²Ñ‹Ğ±Ñ€Ğ°Ñ‚ÑŒ Ğ²Ñ€ÑƒÑ‡Ğ½ÑƒÑ.' : 'ĞĞµ ÑƒĞ´Ğ°Ğ»Ğ¾ÑÑŒ Ğ¾Ğ¿Ñ€ĞµĞ´ĞµĞ»Ğ¸Ñ‚ÑŒ Ğ¼ĞµÑÑ‚Ğ¾Ğ¿Ğ¾Ğ»Ğ¾Ğ¶ĞµĞ½Ğ¸Ğµ. Ğ’Ñ‹Ğ±ĞµÑ€Ğ¸ Ğ¼ĞµÑÑ‚Ğ¾ Ğ½Ğ° ĞºĞ°Ñ€Ñ‚Ğµ Ğ²Ñ€ÑƒÑ‡Ğ½ÑƒÑ.');
    },{enableHighAccuracy:true,timeout:12000,maximumAge:30000});
  });
  window.addEventListener('offline',() => {status('ĞĞµÑ‚ Ğ¸Ğ½Ñ‚ĞµÑ€Ğ½ĞµÑ‚Ğ°. ĞœĞµÑ‚ĞºĞ¸ Ğ¸ ĞºĞ°Ñ€Ñ‚Ğ° Ğ¼Ğ¾Ğ³ÑƒÑ‚ Ğ±Ñ‹Ñ‚ÑŒ ÑƒÑÑ‚Ğ°Ñ€ĞµĞ²ÑˆĞ¸Ğ¼Ğ¸.',true);cancelPlacement();});
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
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => toast('ĞĞµ ÑƒĞ´Ğ°Ğ»Ğ¾ÑÑŒ Ğ²ĞºĞ»ÑÑ‡Ğ¸Ñ‚ÑŒ ÑƒÑÑ‚Ğ°Ğ½Ğ¾Ğ²ĞºÑƒ Ğ¿Ñ€Ğ¸Ğ»Ğ¾Ğ¶ĞµĞ½Ğ¸Ñ. ĞšĞ°Ñ€Ñ‚Ğ° Ñ€Ğ°Ğ±Ğ¾Ñ‚Ğ°ĞµÑ‚ Ğ² Ğ±Ñ€Ğ°ÑƒĞ·ĞµÑ€Ğµ.'));
    if (!window.L) {status('ĞšĞ°Ñ€Ñ‚Ğ° Ğ½Ğµ Ğ·Ğ°Ğ³Ñ€ÑƒĞ·Ğ¸Ğ»Ğ°ÑÑŒ. ĞŸÑ€Ğ¾Ğ²ĞµÑ€ÑŒ Ğ¸Ğ½Ñ‚ĞµÑ€Ğ½ĞµÑ‚ Ğ¸ Ğ¾Ğ±Ğ½Ğ¾Ğ²Ğ¸ ÑÑ‚Ñ€Ğ°Ğ½Ğ¸Ñ†Ñƒ.',true);return;}
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
      $('coordinates').textContent = `ĞœĞµÑÑ‚Ğ¾: ${selectedPoint.lat.toFixed(5)}, ${wrapLng(selectedPoint.lng).toFixed(5)}`;
      message('pin-message',''); $('pin-dialog').showModal();
    });
    if (!window.supabase) {status('ĞœĞ¾Ğ´ÑƒĞ»ÑŒ Ğ²Ñ…Ğ¾Ğ´Ğ° Ğ½Ğµ Ğ·Ğ°Ğ³Ñ€ÑƒĞ·Ğ¸Ğ»ÑÑ. ĞŸÑ€Ğ¾Ğ²ĞµÑ€ÑŒ Ğ¸Ğ½Ñ‚ĞµÑ€Ğ½ĞµÑ‚ Ğ¸ Ğ¾Ğ±Ğ½Ğ¾Ğ²Ğ¸ ÑÑ‚Ñ€Ğ°Ğ½Ğ¸Ñ†Ñƒ.',true);return;}
    try {
      let config;
      if (navigator.onLine) {
        const response = await fetch('/api/config',{cache:'no-store',signal:AbortSignal.timeout(15000)});
        config = await response.json();
        if (!response.ok) throw new Error(config.error || 'ĞĞµ ÑƒĞ´Ğ°Ğ»Ğ¾ÑÑŒ Ğ·Ğ°Ğ³Ñ€ÑƒĞ·Ğ¸Ñ‚ÑŒ Ğ½Ğ°ÑÑ‚Ñ€Ğ¾Ğ¹ĞºĞ¸ Vercel.');
        try {localStorage.setItem('maply-public-config',JSON.stringify(config));} catch {}
      } else {
        try {config = JSON.parse(localStorage.getItem('maply-public-config') || 'null');} catch {}
        if (!config) throw new Error('Ğ”Ğ»Ñ Ğ¿ĞµÑ€Ğ²Ğ¾Ğ³Ğ¾ Ğ¾Ñ‚ĞºÑ€Ñ‹Ñ‚Ğ¸Ñ Maply Ğ½ÑƒĞ¶ĞµĞ½ Ğ¸Ğ½Ñ‚ĞµÑ€Ğ½ĞµÑ‚.');
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
        toast('Ğ¡ÑÑ‹Ğ»ĞºĞ° Ğ´Ğ»Ñ Ğ²Ñ…Ğ¾Ğ´Ğ° Ğ½ĞµĞ´ĞµĞ¹ÑÑ‚Ğ²Ğ¸Ñ‚ĞµĞ»ÑŒĞ½Ğ° Ğ¸Ğ»Ğ¸ ÑƒÑÑ‚Ğ°Ñ€ĞµĞ»Ğ°. ĞŸĞ¾Ğ¿Ñ€Ğ¾Ğ±ÑƒĞ¹ Ğ²Ğ¾Ğ¹Ñ‚Ğ¸ ÑĞ½Ğ¾Ğ²Ğ°.');
        history.replaceState(null,'',location.pathname);
      }
    } catch (error) {status(errorText(error),true);}
  }
  init().catch(error => status(errorText(error),true));
})();
