'use strict';
(() => {
  const t=window.MaplyI18n.t;
  const types = Object.freeze({
    accident:{get name(){return t("\u0410\u0432\u0430\u0440\u0438\u044f");},emoji:'\ud83d\ude97',color:'#bf3540',group:'events',hours:8},
    closed:{get name(){return t("\u041f\u0435\u0440\u0435\u043a\u0440\u044b\u0442\u0438\u0435");},emoji:'\u26d4',color:'#b8551d',group:'events',hours:24},
    police:{get name(){return t("\u041f\u043e\u043b\u0438\u0446\u0438\u044f");},emoji:'\ud83d\ude93',color:'#276bb0',group:'events',hours:4},
    fire:{get name(){return t("\u041f\u043e\u0436\u0430\u0440");},emoji:'\ud83d\udd25',color:'#c24720',group:'events',hours:12},
    danger:{get name(){return t("\u041e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u044c");},emoji:'\u26a0\ufe0f',color:'#8a6500',group:'events',hours:12},
    flood:{get name(){return t("\u041d\u0430\u0432\u043e\u0434\u043d\u0435\u043d\u0438\u0435");},emoji:'\ud83c\udf0a',color:'#087e9c',group:'events',hours:24},
    pothole:{get name(){return t("\u042f\u043c\u0430");},emoji:'\ud83d\udd73\ufe0f',color:'#806018',group:'infrastructure',hours:72},
    infrastructure:{get name(){return t("\u0418\u043d\u0444\u0440\u0430\u0441\u0442\u0440\u0443\u043a\u0442\u0443\u0440\u0430");},emoji:'\ud83d\udee0\ufe0f',color:'#7751b5',group:'infrastructure',hours:72},
    custom:{get name(){return t("\u0414\u0440\u0443\u0433\u043e\u0435");},emoji:'\ud83d\udccd',color:'#06766f',group:'events',hours:24}
  });
  const legacy = ['accident','closed','police','pothole','custom'];
  const available = pin => !pin.hidden_by_votes && Date.parse(pin.expires_at) > Date.now();
  const aged = pin => types[pin.type]?.group === 'events' && Date.now() - Date.parse(pin.created_at) >= 3600000;
  function state(pin) {
    if (!available(pin)) return {key:'closed',label:t("\u0417\u0430\u043a\u0440\u044b\u0442\u043e")};
    if (Number(pin.gone_votes) > Number(pin.active_votes)) return {key:'unlikely',label:t("\u0412\u0435\u0440\u043e\u044f\u0442\u043d\u043e \u043d\u0435\u0430\u043a\u0442\u0443\u0430\u043b\u044c\u043d\u043e")};
    if (Number(pin.active_votes) > 0) return {key:'confirmed',label:t("\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u043e \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f\u043c\u0438")};
    if (pin.happening_now !== false && Date.now() - Date.parse(pin.created_at) < 1800000) return {key:'new',label:t("\u041d\u043e\u0432\u043e\u0435")};
    return {key:'check',label:t("\u041d\u0443\u0436\u0434\u0430\u0435\u0442\u0441\u044f \u0432 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0435")};
  }
  function distance(a,b) {
    const rad = Math.PI / 180, dLat = (b.lat-a.lat)*rad, dLng=(b.lng-a.lng)*rad;
    const h=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLng/2)**2;
    return 6371000*2*Math.atan2(Math.sqrt(Math.min(1,h)),Math.sqrt(Math.max(0,1-h)));
  }
  function normalize(pin) {
    return {id:pin.id,category:pin.type,title:pin.title,description:pin.description,
      latitude:pin.lat,longitude:pin.lng,createdAt:pin.created_at,updatedAt:pin.updated_at || pin.created_at,
      expiresAt:pin.expires_at,status:state(pin).key,confirmationsCount:Number(pin.active_votes)||0,
      noLongerRelevantCount:Number(pin.gone_votes)||0,reportsCount:Number(pin.reports_count)||0,
      authorId:pin.user_id,isVerified:pin.is_verified === true,lastConfirmedAt:pin.last_confirmed_at || null};
  }
  window.MaplyCategories={types,legacy,available,aged,state,distance,normalize};
})();
