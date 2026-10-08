'use strict';
(() => {
  const t=window.MaplyI18n.t;
  function create({engine,api,getUser,getSettings,matchesPin,openLogin,toast,status,errorText,onReport}) {
    const C=window.MaplyCategories,$=id=>document.getElementById(id);
    let pins=[],loaded=false,number=0,timer,controller,lastDisplayed=[];
    const pending=new Set();
    const card=window.MaplyEventCard.create({getUser,getLocation:engine.location,onVote:vote,onDelete:remove,onReport});
    function invalidate(){++number;controller?.abort();$('refresh').disabled=false;$('events-loading').hidden=true;}
    function render() {
      const s=getSettings(),location=engine.location();
      pins=pins.filter(C.available);
      lastDisplayed=pins.filter(p=>matchesPin(p)&&(s.showOld||!C.aged(p))&&(!location||!s.radius||C.distance(location,p)<=s.radius));
      engine.setEvents(lastDisplayed.map(p=>({...p,maplyOpacity:s.fadeOld&&C.aged(p)?.58:1})));
      const count=lastDisplayed.length,last=count%10,two=count%100;
      $('count').textContent=String(count);$('count-caption').textContent=window.MaplyI18n.countCaption(count);
      $('empty-state').hidden=true;
      const current=card.current();if(current){const updated=pins.find(p=>p.id===current.id);if(!updated||!lastDisplayed.some(p=>p.id===current.id))card.close();else card.update(updated,pending.has(current.id));}
    }
    function showStatus(){status(pins.length===500?t("\u041f\u043e\u043a\u0430\u0437\u0430\u043d\u044b 500 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0445 \u0441\u043e\u0431\u044b\u0442\u0438\u0439. \u041f\u0440\u0438\u0431\u043b\u0438\u0437\u044c \u043a\u0430\u0440\u0442\u0443, \u0447\u0442\u043e\u0431\u044b \u0443\u0432\u0438\u0434\u0435\u0442\u044c \u0431\u043e\u043b\u044c\u0448\u0435."):'');}
    async function load() {
      if(document.hidden)return false;
      if(!navigator.onLine){render();status(t("\u041d\u0435\u0442 \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442\u0430. \u041a\u0430\u0440\u0442\u0430 \u0438 \u0441\u043e\u0431\u044b\u0442\u0438\u044f \u043c\u043e\u0433\u0443\u0442 \u0431\u044b\u0442\u044c \u0443\u0441\u0442\u0430\u0440\u0435\u0432\u0448\u0438\u043c\u0438."),true);return false;}
      controller?.abort();controller=new AbortController();const activeController=controller,n=++number,viewer=getUser()?.id||null;
      $('refresh').disabled=true;$('events-loading').hidden=false;
      const timeout=setTimeout(()=>activeController.abort(),15000);
      try {
        const rows=await api.load(engine.map.getBounds(),viewer,activeController.signal);
        if(n!==number||viewer!==(getUser()?.id||null))return false;
        pins=rows;loaded=true;render();showStatus();return true;
      }catch(error){if(n===number)status(activeController.signal.aborted?t("\u0421\u043e\u0431\u044b\u0442\u0438\u044f \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043b\u0438\u0441\u044c. \u041d\u0430\u0436\u043c\u0438 \u00ab\u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u044c\u00bb."):errorText(error),true);return false;}
      finally{clearTimeout(timeout);if(n===number){$('refresh').disabled=false;$('events-loading').hidden=true;}}
    }
    function schedule(){invalidate();clearTimeout(timer);timer=setTimeout(load,350);}
    async function vote(pin,choice) {
      if(!getUser()){openLogin();return;}
      if(!C.available(pin)){card.close();toast(t("\u0421\u043e\u0431\u044b\u0442\u0438\u0435 \u0443\u0436\u0435 \u0437\u0430\u043a\u0440\u044b\u0442\u043e."));await load();return;}
      if(!navigator.onLine){toast(t("\u0414\u043b\u044f \u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043d\u0438\u044f \u043d\u0443\u0436\u0435\u043d \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442."));return;}
      if(pending.has(pin.id))return;
      pending.add(pin.id);card.update(pin,true);const viewer=getUser().id;
      try {
        const raw=await api.vote(pin.id,choice),data=Array.isArray(raw)?raw[0]:raw;invalidate();
        if(!data)throw new Error('MAPLY_EMPTY_VOTE');
        if(data.hidden_by_votes){pins=pins.filter(p=>p.id!==pin.id);card.close();toast(t("\u0413\u043e\u043b\u043e\u0441 \u0443\u0447\u0442\u0451\u043d. \u0421\u043e\u0431\u044b\u0442\u0438\u0435 \u0441\u043a\u0440\u044b\u0442\u043e."));}
        else {
          Object.assign(pin,{active_votes:data.active_votes,gone_votes:data.gone_votes,expires_at:data.expires_at,my_vote:getUser()?.id===viewer?data.my_vote:null});
          const cached=pins.find(p=>p.id===pin.id);if(cached)Object.assign(cached,pin);
          card.update(pin,true);toast(data.extended?t("\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u0435 \u0443\u0447\u0442\u0435\u043d\u043e. \u0421\u0440\u043e\u043a \u043f\u0440\u043e\u0434\u043b\u0451\u043d \u043d\u0430 2 \u0447\u0430\u0441\u0430."):t("\u0413\u043e\u043b\u043e\u0441 \u0443\u0447\u0442\u0451\u043d."));
        }
        render();await load();
      }catch(error){toast(errorText(error));if(String(error?.message).includes('MAPLY_MARKER_UNAVAILABLE')){pins=pins.filter(p=>p.id!==pin.id);card.close();render();await load();}}
      finally{pending.delete(pin.id);card.update(pins.find(p=>p.id===pin.id)||pin,false);}
    }
    async function remove(pin) {
      const user=getUser();if(!user||user.id!==pin.user_id)return toast(t("\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0441\u043e\u0431\u044b\u0442\u0438\u0435 \u043c\u043e\u0436\u0435\u0442 \u0442\u043e\u043b\u044c\u043a\u043e \u0430\u0432\u0442\u043e\u0440."));
      if(!navigator.onLine)return toast(t("\u0414\u043b\u044f \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u044f \u043d\u0443\u0436\u0435\u043d \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442."));
      if(pending.has(pin.id)||!confirm(t("\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u044d\u0442\u043e \u0441\u043e\u0431\u044b\u0442\u0438\u0435?")))return;
      pending.add(pin.id);card.update(pin,true);
      try {const rows=await api.remove(pin.id,user.id);invalidate();pins=pins.filter(p=>p.id!==pin.id);card.close();render();toast(rows?.length?t("\u0421\u043e\u0431\u044b\u0442\u0438\u0435 \u0443\u0434\u0430\u043b\u0435\u043d\u043e."):t("\u0421\u043e\u0431\u044b\u0442\u0438\u0435 \u0443\u0436\u0435 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e."));await load();}
      catch(error){toast(errorText(error));}finally{pending.delete(pin.id);card.update(pin,false);}
    }
    function open(id){const pin=pins.find(p=>p.id===id);if(pin&&C.available(pin))card.open(pin,pending.has(id));}
    function adopt(pin){if(!pin||!C.available(pin))return;invalidate();pins=pins.filter(p=>p.id!==pin.id);pins.unshift(pin);loaded=true;render();card.open(pin,pending.has(pin.id));}
    engine.onSelect(open);
    return {load,render,schedule,open,adopt,close:card.close,list:()=>lastDisplayed.slice(),isLoaded:()=>loaded,showStatus,
      expire:render,authChanged(){invalidate();for(const p of pins)p.my_vote=null;render();schedule();}};
  }
  window.MaplyMarkers={create};
})();
