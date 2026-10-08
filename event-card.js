'use strict';
(() => {
  const t=window.MaplyI18n.t;
  const $=id=>document.getElementById(id),C=window.MaplyCategories;
  function el(tag,text,cls) {const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
  function duration(ms) {
    const m=Math.max(1,Math.floor(ms/60000));if(m<60)return m+' '+t("\u043c\u0438\u043d.");
    const h=Math.floor(m/60);return h<24?h+' '+t("\u0447."):Math.floor(h/24)+' '+t("\u0434.");
  }
  function plural(n,words){const last=n%10,two=n%100;return last===1&&two!==11?words[0]:last>=2&&last<=4&&(two<12||two>14)?words[1]:words[2];}
  function create({getUser,getLocation,onVote,onDelete,onReport}) {
    const dialog=$('event-dialog');let current=null,previousFocus;
    function close() {dialog.close();current=null;document.body.classList.remove('event-open');previousFocus?.focus?.({preventScroll:true});}
    function render(pin,busy=false) {
      current=pin;const type=C.types[pin.type]||C.types.custom,box=$('event-content');box.replaceChildren();
      const heading=el('p',type.emoji+' '+type.name,'event-category');heading.style.color=type.color;box.append(heading);
      $('event-title').textContent=pin.title;
      const elapsed=Date.now()-Date.parse(pin.created_at);
      let meta=elapsed<60000?t("\u0414\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u043e \u0442\u043e\u043b\u044c\u043a\u043e \u0447\u0442\u043e"):t("\u0414\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u043e {time} \u043d\u0430\u0437\u0430\u0434",{time:duration(elapsed)});
      const location=getLocation();
      if(location){const d=C.distance(location,pin);meta+=' \u00b7 '+t("{distance} \u043e\u0442 \u0432\u0430\u0441",{distance:d<1000?Math.round(d/10)*10+' '+t("\u043c"):(d/1000).toLocaleString(window.MaplyI18n.locale(),{minimumFractionDigits:1,maximumFractionDigits:1})+' '+t("\u043a\u043c")});}
      box.append(el('p',meta,'event-meta'));
      const state=C.state(pin);box.append(el('p',state.label,'event-state state-'+state.key));
      if(pin.is_verified===true)box.append(el('p',t("\u041f\u0440\u043e\u0432\u0435\u0440\u0435\u043d\u043e \u043c\u043e\u0434\u0435\u0440\u0430\u0442\u043e\u0440\u043e\u043c"),'verified-label'));
      const active=Number(pin.active_votes)||0,gone=Number(pin.gone_votes)||0;
      box.append(el('p',window.MaplyI18n.confirmations(active,gone),'event-votes'));
      if(pin.description)box.append(el('p',pin.description,'event-description'));
      box.append(el('p',t("\u0412\u0438\u0434\u043d\u043e \u0434\u043e {date}.",{date:new Date(pin.expires_at).toLocaleString(window.MaplyI18n.locale(),{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}),'small'));
      const votes=el('div',undefined,'event-actions');
      for(const [value,label] of [['active',t("\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c")],['gone',t("\u0423\u0436\u0435 \u043d\u0435\u0430\u043a\u0442\u0443\u0430\u043b\u044c\u043d\u043e")]]){
        const b=el('button',label,'vote-button');b.type='button';b.disabled=busy||!C.available(pin);
        const selected=Boolean(getUser()&&pin.my_vote===value);b.setAttribute('aria-pressed',String(selected));b.classList.toggle('selected',selected);
        b.addEventListener('click',()=>onVote(pin,value));votes.append(b);
      }
      box.append(votes);
      const route=el('a',t("\u2197 \u041f\u043e\u0441\u0442\u0440\u043e\u0438\u0442\u044c \u043c\u0430\u0440\u0448\u0440\u0443\u0442"),'route-button');route.href='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(pin.lat+','+pin.lng)+'&travelmode=driving';route.target='_blank';route.rel='noopener noreferrer';
      route.setAttribute('aria-label',t('\u041f\u043e\u0441\u0442\u0440\u043e\u0438\u0442\u044c \u043c\u0430\u0440\u0448\u0440\u0443\u0442 \u0432 Maply'));route.addEventListener('click',e=>{if(window.MaplyAppJourney){e.preventDefault();close();window.MaplyAppJourney.toEvent(pin);}});box.append(route);
      const report=el('button',t("\u041f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u0442\u044c\u0441\u044f"),'text-button');report.type='button';report.disabled=busy;report.addEventListener('click',()=>onReport(pin));box.append(report);
      box.append(el('p',t("\u0421\u0442\u0430\u0442\u0443\u0441 \u043e\u0441\u043d\u043e\u0432\u0430\u043d \u043d\u0430 \u0432\u0440\u0435\u043c\u0435\u043d\u0438 \u043f\u0443\u0431\u043b\u0438\u043a\u0430\u0446\u0438\u0438 \u0438 \u0433\u043e\u043b\u043e\u0441\u0430\u0445 \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u043e\u0432. \u041f\u0440\u043e\u0432\u0435\u0440\u044c \u043e\u0431\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0443 \u043d\u0430 \u043c\u0435\u0441\u0442\u0435."),'small'));
      box.append(el('p',t("\u041f\u0435\u0440\u0432\u043e\u0435 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u0435 \u043e\u0442 \u0442\u0435\u0431\u044f \u0434\u043e\u0431\u0430\u0432\u043b\u044f\u0435\u0442 2 \u0447\u0430\u0441\u0430. \u0413\u043e\u043b\u043e\u0441 \u043c\u043e\u0436\u043d\u043e \u0438\u0437\u043c\u0435\u043d\u0438\u0442\u044c."),'small'));
      if(getUser()?.id===pin.user_id){const b=el('button',t("\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u043c\u043e\u0451 \u0441\u043e\u0431\u044b\u0442\u0438\u0435"),'danger-button');b.type='button';b.disabled=busy;b.addEventListener('click',()=>onDelete(pin));box.append(b);}
    }
    function open(pin,busy=false) {
      if(!C.available(pin))return;render(pin,busy);
      if(!dialog.open){previousFocus=document.activeElement;dialog.show();document.body.classList.add('event-open');$('event-close').focus({preventScroll:true});}
    }
    $('event-close').addEventListener('click',close);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
    let origin;
    const handle=$('event-handle');
    handle.addEventListener('pointerdown',e=>{origin={x:e.clientX,y:e.clientY};handle.setPointerCapture(e.pointerId);});
    handle.addEventListener('pointerup',e=>{if(origin&&e.clientY-origin.y>80&&Math.abs(e.clientX-origin.x)<100)close();origin=null;});
    handle.addEventListener('pointercancel',()=>{origin=null;});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&dialog.open&&!document.querySelector('dialog[open]:not(#event-dialog)'))close();});
    return {open,close,current:()=>current,update(pin,busy){if(current?.id===pin.id&&dialog.open)render(pin,busy);},el};
  }
  window.MaplyEventCard={create,el,duration};
})();
