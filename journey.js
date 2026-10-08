'use strict';
(() => {
  const t=window.MaplyI18n.t,$=id=>document.getElementById(id),N=window.MaplyNavigationAPI,C=window.MaplyCategories;
  const el=window.MaplyEventCard.el;
  function create({engine,api,getUser,notify,openEvent}){
    let destination=null,routes=[],chosen=null,routePins=[],routeTruncated=false,routeChecked=0;
    let searchController,routeController,searchVersion=0,routeVersion=0,lastSearch=0,lastRoute=0;
    let active=false,watchId=null,watchVersion=0,position=null,previous=null,nearby=[],nearController,lastNearby=0,nearCenter=null,nearFresh=0;
    let lastAlert=0,lastVoice=0,alertTimer,wakeLock,loadTimer;const seen=new Map();
    const time=s=>Math.max(1,Math.round(s/60))+' '+t('\u043c\u0438\u043d.');
    const length=d=>d<1000?Math.round(d/10)*10+' '+t('\u043c'):(d/1000).toLocaleString(window.MaplyI18n.locale(),{maximumFractionDigits:1})+' '+t('\u043a\u043c');
    const errorMessage=e=>({WAIT_AND_RETRY:t('\u041f\u043e\u0434\u043e\u0436\u0434\u0438 \u043f\u0430\u0440\u0443 \u0441\u0435\u043a\u0443\u043d\u0434 \u0438 \u043f\u043e\u0432\u0442\u043e\u0440\u0438.'),ROUTE_TOO_LONG:t('\u0412 Maply \u043f\u043e\u043a\u0430 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b \u043c\u0430\u0440\u0448\u0440\u0443\u0442\u044b \u0434\u043e 150 \u043a\u043c. \u0414\u043b\u044f \u0434\u0430\u043b\u044c\u043d\u0438\u0445 \u043f\u043e\u0435\u0437\u0434\u043e\u043a \u043e\u0442\u043a\u0440\u043e\u0439 \u043d\u0430\u0432\u0438\u0433\u0430\u0442\u043e\u0440.'),NO_ROUTE:t('\u0410\u0432\u0442\u043e\u043c\u043e\u0431\u0438\u043b\u044c\u043d\u044b\u0439 \u043c\u0430\u0440\u0448\u0440\u0443\u0442 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d.'),SEARCH_UNAVAILABLE:t('\u041f\u043e\u0438\u0441\u043a \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u043f\u043e\u0437\u0436\u0435.'),ROUTE_UNAVAILABLE:t('\u041c\u0430\u0440\u0448\u0440\u0443\u0442 \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043b\u0441\u044f. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u0435\u0449\u0451 \u0440\u0430\u0437.')})[e?.message]||t('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u044c \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u0435\u0449\u0451 \u0440\u0430\u0437.');
    function tripState(text){$('trip-state').textContent=text;$('trip-toggle').setAttribute('aria-pressed',String(active));$('trip-toggle').classList.toggle('selected',active);$('trip-toggle-label').textContent=active?t('\u0412 \u043f\u0443\u0442\u0438 \u00b7 \u0412\u043a\u043b.'):t('\u0412 \u043f\u0443\u0442\u0438');$('trip-start').textContent=active?t('\u041e\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u044c \u0440\u0435\u0436\u0438\u043c'):t('\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0440\u0435\u0436\u0438\u043c');$('trip-start').classList.toggle('danger-button',active);}
    function availableRoutes(){return routes.length>0&&chosen;}
    function renderPlace(){if(!destination)return;$('place-title').textContent=destination.name;$('place-address').textContent=destination.address||'';$('place-panel').hidden=availableRoutes();$('place-external').href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(destination.lat+','+destination.lng);}
    function renderRoutes(){
      if(!availableRoutes())return;
      $('place-panel').hidden=true;$('route-panel').hidden=false;document.body.classList.add('route-open');$('route-title').textContent=destination.name;
      $('route-summary').textContent=length(chosen.distance)+' \u00b7 '+time(chosen.duration)+' \u00b7 '+t('\u0411\u0435\u0437 \u0443\u0447\u0451\u0442\u0430 \u043f\u0440\u043e\u0431\u043e\u043a');
      const options=$('route-options');options.replaceChildren();
      for(const [i,route]of routes.entries()){
        const b=el('button',t('\u0412\u0430\u0440\u0438\u0430\u043d\u0442 {number}',{number:i+1})+' \u00b7 '+length(route.distance)+' \u00b7 '+time(route.duration)+' \u00b7 '+t('\u041c\u0435\u0442\u043a\u0438 \u0440\u044f\u0434\u043e\u043c: {count}',{count:route.hits.length}),'route-option');b.type='button';b.setAttribute('aria-pressed',String(route===chosen));b.classList.toggle('selected',route===chosen);b.addEventListener('click',()=>{chosen=route;engine.setRoute(route.coordinates,destination);renderRoutes();});options.append(b);
      }
      $('route-warning').textContent=chosen.closures?t('\u0420\u044f\u0434\u043e\u043c \u0441 \u043c\u0430\u0440\u0448\u0440\u0443\u0442\u043e\u043c \u0435\u0441\u0442\u044c \u043f\u0435\u0440\u0435\u043a\u0440\u044b\u0442\u0438\u0435. \u041f\u0440\u043e\u0435\u0437\u0434 \u043d\u0435 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043d.'):chosen.hits.length?t('\u0420\u044f\u0434\u043e\u043c \u0441 \u0434\u043e\u0440\u043e\u0433\u043e\u0439 \u0435\u0441\u0442\u044c \u0441\u043e\u0431\u044b\u0442\u0438\u044f. \u041f\u0440\u043e\u0432\u0435\u0440\u044c \u043f\u0440\u0435\u0434\u0443\u043f\u0440\u0435\u0436\u0434\u0435\u043d\u0438\u044f.'):t('\u0412 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u043d\u044b\u0445 \u0434\u0430\u043d\u043d\u044b\u0445 \u0440\u044f\u0434\u043e\u043c \u0441 \u043c\u0430\u0440\u0448\u0440\u0443\u0442\u043e\u043c \u043c\u0435\u0442\u043e\u043a \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e.');
      const list=$('route-events');list.replaceChildren();
      for(const hit of chosen.hits){const type=C.types[hit.pin.type]||C.types.custom,b=el('button',type.emoji+' '+hit.pin.title,'route-event');b.type='button';b.addEventListener('click',()=>openEvent(hit.pin));list.append(b);}
      $('route-coverage').textContent=t('\u0421\u0440\u0430\u0432\u043d\u0435\u043d\u0438\u0435 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0445 \u0432\u0430\u0440\u0438\u0430\u043d\u0442\u043e\u0432 \u043f\u043e \u043c\u0435\u0442\u043a\u0430\u043c \u0432 \u043f\u0440\u0435\u0434\u0435\u043b\u0430\u0445 45 \u043c \u043e\u0442 \u043b\u0438\u043d\u0438\u0438. \u042d\u0442\u043e \u043d\u0435 \u0433\u0430\u0440\u0430\u043d\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0439 \u043e\u0431\u044a\u0435\u0437\u0434.')+' '+(routeTruncated?t('\u0417\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u043e \u0442\u043e\u043b\u044c\u043a\u043e 500 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0445 \u0441\u043e\u0431\u044b\u0442\u0438\u0439. \u041d\u0435\u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u043c\u0435\u0442\u043a\u0438 \u043c\u043e\u0433\u043b\u0438 \u043d\u0435 \u043f\u043e\u043f\u0430\u0441\u0442\u044c \u0432 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0443.'):t('\u041c\u0435\u0442\u043a\u0438 \u043c\u043e\u0433\u0443\u0442 \u0431\u044b\u0442\u044c \u043d\u0435\u0442\u043e\u0447\u043d\u044b\u043c\u0438 \u0438\u043b\u0438 \u043d\u0435\u043f\u043e\u043b\u043d\u044b\u043c\u0438.'));
      $('route-external').href='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(destination.lat+','+destination.lng)+'&travelmode=driving';
      updateProgress();
    }
    function updateProgress(){
      const current=engine.location();
      if(current){const hit=N.nearest(current,chosen.coordinates);$('route-progress').textContent=hit.distance>100?t('\u0422\u044b \u0432\u043d\u0435 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0433\u043e \u043c\u0430\u0440\u0448\u0440\u0443\u0442\u0430. \u041f\u043e\u0441\u0442\u0440\u043e\u0439 \u0435\u0433\u043e \u0437\u0430\u043d\u043e\u0432\u043e.'):t('\u0414\u043e \u0446\u0435\u043b\u0438 \u043f\u043e \u043f\u0440\u044f\u043c\u043e\u0439: {distance}',{distance:length(N.distance(current,destination))});}
    }
    function clearRoute(){++routeVersion;routeController?.abort();$('place-route').disabled=false;routes=[];chosen=null;routePins=[];destination=null;engine.setRoute(null);engine.showPlace(null);$('route-panel').hidden=true;$('place-panel').hidden=true;document.body.classList.remove('route-open','place-open','manual-route-start');}
    function choosePlace(place){clearRoute();$('route-start').value='location';destination=place;engine.showPlace(place);engine.map.setView([place.lat,place.lng],16);$('search-dialog').close();$('place-message').textContent='';$('place-panel').hidden=false;document.body.classList.add('place-open');renderPlace();}
    async function search(event){
      event?.preventDefault();const q=$('search-input').value.trim();
      if(q.length<3)return $('search-message').textContent=t('\u0412\u0432\u0435\u0434\u0438 \u0445\u043e\u0442\u044f \u0431\u044b 3 \u0441\u0438\u043c\u0432\u043e\u043b\u0430.');
      if(!navigator.onLine)return $('search-message').textContent=t('\u0414\u043b\u044f \u043f\u043e\u0438\u0441\u043a\u0430 \u043d\u0443\u0436\u0435\u043d \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442.');
      if(Date.now()-lastSearch<1500)return;lastSearch=Date.now();searchController?.abort();searchController=new AbortController();const request=searchController,n=++searchVersion;
      $('search-submit').disabled=true;$('search-results').replaceChildren();$('search-message').textContent=t('\u0418\u0449\u0435\u043c \u043c\u0435\u0441\u0442\u0430\u2026');const timer=setTimeout(()=>request.abort(),12000);
      try{const data=await N.search(q,engine.map.getCenter(),request.signal);if(n!==searchVersion||request.signal.aborted)return;
        $('search-message').textContent=data.places.length?'':t('\u041d\u0438\u0447\u0435\u0433\u043e \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e. \u0423\u0442\u043e\u0447\u043d\u0438 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0438\u043b\u0438 \u0433\u043e\u0440\u043e\u0434.');
        for(const place of data.places){const b=el('button',undefined,'place-result');b.type='button';b.append(el('strong',place.name),el('span',place.address,'small'));b.addEventListener('click',()=>choosePlace(place));$('search-results').append(b);}
      }catch(e){if(n===searchVersion)$('search-message').textContent=errorMessage(e);}
      finally{clearTimeout(timer);if(n===searchVersion)$('search-submit').disabled=false;}
    }
    async function buildRoute(){
      if(!destination||$('place-route').disabled)return;
      if(!navigator.onLine)return $('place-message').textContent=t('\u0414\u043b\u044f \u043c\u0430\u0440\u0448\u0440\u0443\u0442\u0430 \u043d\u0443\u0436\u0435\u043d \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442.');
      if(Date.now()-lastRoute<1500)return;lastRoute=Date.now();
      routeController?.abort();routeController=new AbortController();const request=routeController,n=++routeVersion,to={...destination};
      $('place-route').disabled=true;$('place-message').textContent=t('\u0421\u0442\u0440\u043e\u0438\u043c \u043c\u0430\u0440\u0448\u0440\u0443\u0442\u2026');let timer;
      try{
        let from;
        if($('route-start').value==='center')from=engine.map.getCenter();
        else{const known=engine.location();from=known&&Date.now()-known.timestamp<30000&&known.accuracy<=100?known:await engine.requestLocation(false,false);if(!from||from.accuracy>100){$('place-message').textContent=t('\u0422\u043e\u0447\u043d\u043e\u0435 \u043c\u0435\u0441\u0442\u043e\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e. \u041c\u043e\u0436\u043d\u043e \u0432\u044b\u0431\u0440\u0430\u0442\u044c \u0441\u0442\u0430\u0440\u0442 \u0438\u0437 \u0446\u0435\u043d\u0442\u0440\u0430 \u043a\u0430\u0440\u0442\u044b.');return;}}
        if(n!==routeVersion||request.signal.aborted||destination?.lat!==to.lat||destination?.lng!==to.lng)return;
        if(N.distance(from,to)<20){$('place-message').textContent=t('\u0421\u0442\u0430\u0440\u0442 \u0438 \u0446\u0435\u043b\u044c \u0441\u043e\u0432\u043f\u0430\u0434\u0430\u044e\u0442. \u041f\u0435\u0440\u0435\u0434\u0432\u0438\u043d\u044c \u043a\u0430\u0440\u0442\u0443 \u043a \u043c\u0435\u0441\u0442\u0443 \u0441\u0442\u0430\u0440\u0442\u0430.');return;}
        timer=setTimeout(()=>request.abort(),40000);
        const result=await N.route(from,to,request.signal);
        $('place-message').textContent=t('\u041f\u0440\u043e\u0432\u0435\u0440\u044f\u0435\u043c \u0441\u043e\u0431\u044b\u0442\u0438\u044f \u043d\u0430 \u043c\u0430\u0440\u0448\u0440\u0443\u0442\u0435\u2026');
        // Query the entire route area, independently of UI filters. RLS still hides closed events.
        const pins=await api.load(N.routeBounds(result.routes),null,request.signal);
        if(n!==routeVersion||request.signal.aborted)return;
        routePins=pins;routeTruncated=pins.length===500;routeChecked=Date.now();routes=N.evaluate(result.routes,pins);chosen=routes[0];
        document.body.classList.remove('manual-route-start');engine.setRoute(chosen.coordinates,to,true);renderRoutes();notify(t('\u041c\u0430\u0440\u0448\u0440\u0443\u0442 \u0433\u043e\u0442\u043e\u0432. \u0421\u0440\u0430\u0432\u043d\u0435\u043d\u044b \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0435 \u0432\u0430\u0440\u0438\u0430\u043d\u0442\u044b.'));
      }catch(e){if(n===routeVersion)$('place-message').textContent=errorMessage(e);}
      finally{clearTimeout(timer);if(n===routeVersion)$('place-route').disabled=false;}
    }
    async function updateRouteEvents(){
      if(!routes.length||Date.now()-routeChecked<60000||routeController?.signal.aborted)return;
      const version=routeVersion;routeChecked=Date.now();
      try{const pins=await api.load(N.routeBounds(routes),null,routeController.signal);if(version!==routeVersion)return;const index=chosen.index;
        routePins=pins;routeTruncated=pins.length===500;routes=N.evaluate(routes,pins);chosen=routes.find(r=>r.index===index)||routes[0];renderRoutes();
      }catch{if(version===routeVersion)$('route-progress').textContent=t('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u0441\u043e\u0431\u044b\u0442\u0438\u044f \u043d\u0430 \u043c\u0430\u0440\u0448\u0440\u0443\u0442\u0435.');}
    }
    async function loadNearby(force=false){
      if(!active||!position||document.hidden||!navigator.onLine)return;
      const now=Date.now(),moved=nearCenter?N.distance(position,nearCenter):Infinity;
      if(!force&&(now-lastNearby<5000||(now-lastNearby<20000&&moved<300)))return;
      lastNearby=now;nearController?.abort();nearController=new AbortController();const request=nearController,version=watchVersion,center={...position};
      const timer=setTimeout(()=>request.abort(),12000);
      try{const pins=await api.load(N.bounds([center],1500),null,request.signal);if(!active||version!==watchVersion||request.signal.aborted)return;nearby=pins;nearCenter=center;nearFresh=Date.now();
        if(pins.length===500)tripState(t('\u0412 \u043f\u0443\u0442\u0438. \u0412 \u043e\u0431\u043b\u0430\u0441\u0442\u0438 \u043c\u043d\u043e\u0433\u043e \u0441\u043e\u0431\u044b\u0442\u0438\u0439: \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u044b \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 500.'));else updateTripCaption();checkNearby();
      }catch{if(active&&version===watchVersion&&!request.signal.aborted)tripState(t('\u0421\u043e\u0431\u044b\u0442\u0438\u044f \u0440\u044f\u0434\u043e\u043c \u043d\u0435 \u043e\u0431\u043d\u043e\u0432\u0438\u043b\u0438\u0441\u044c. \u041f\u0440\u043e\u0432\u0435\u0440\u044c \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442.'));}
      finally{clearTimeout(timer);}
    }
    function updateTripCaption(){if(!active)return;if(document.hidden)return tripState(t('\u0420\u0435\u0436\u0438\u043c \u043f\u0440\u0438\u043e\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d: \u0432\u0435\u0440\u043d\u0438\u0441\u044c \u0432 Maply.'));if(!navigator.onLine)return tripState(t('\u041d\u0435\u0442 \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442\u0430. \u041f\u0440\u0435\u0434\u0443\u043f\u0440\u0435\u0436\u0434\u0435\u043d\u0438\u044f \u043f\u0440\u0438\u043e\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u044b.'));if(!position||position.accuracy>80||Date.now()-position.timestamp>15000)return tripState(t('\u0416\u0434\u0451\u043c \u0442\u043e\u0447\u043d\u043e\u0435 \u043c\u0435\u0441\u0442\u043e\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435\u2026'));if(Date.now()-nearFresh>90000)return tripState(t('\u0416\u0434\u0451\u043c \u0441\u0432\u0435\u0436\u0438\u0435 \u0441\u043e\u0431\u044b\u0442\u0438\u044f \u0440\u044f\u0434\u043e\u043c\u2026'));tripState(t('\u0412 \u043f\u0443\u0442\u0438. \u041f\u0440\u0435\u0434\u0443\u043f\u0440\u0435\u0436\u0434\u0430\u0435\u043c \u0437\u0430 {distance}.',{distance:length(N.radius(position.speed))}));}
    async function systemNotification(pin,text){
      if(!$('trip-notifications').checked||!('Notification'in window)||Notification.permission!=='granted')return;
      try{const registration=await navigator.serviceWorker?.getRegistration();if(registration?.active)await registration.showNotification('Maply \u00b7 '+C.types[pin.type].name,{body:text,tag:'maply-near-'+pin.id,icon:'/api/icon?size=192',lang:window.MaplyI18n.language(),data:{url:location.origin+'/'},silent:false});}catch{}
    }
    function checkNearby(){
      if(!active||document.hidden||!position||position.accuracy>80||Date.now()-position.timestamp>15000||!navigator.onLine||Date.now()-nearFresh>90000)return;
      const now=Date.now(),radius=N.radius(position.speed),origin=chosen?N.nearest(position,chosen.coordinates):null;
      const candidates=nearby.filter(C.available).flatMap(pin=>{
        const d=N.distance(position,pin),previousAlert=seen.get(pin.id);
        if(previousAlert&&(d>radius+200)&&now-previousAlert>600000)seen.delete(pin.id);
        if(d>radius||!N.ahead(position,pin)||seen.has(pin.id))return [];
        if(chosen){const hit=N.nearest(pin,chosen.coordinates);if(hit.distance>45||(origin.distance<=100&&hit.index+hit.fraction<origin.index+origin.fraction-.5))return [];}
        return [{pin,d}];
      }).sort((a,b)=>a.d-b.d);
      if(!candidates.length||now-lastAlert<8000)return;
      const {pin,d}=candidates[0];lastAlert=now;seen.set(pin.id,now);if(seen.size>1000)seen.delete(seen.keys().next().value);
      const type=C.types[pin.type]||C.types.custom,text=t('\u0420\u044f\u0434\u043e\u043c: {type}, {distance}',{type:type.name,distance:length(d)});
      $('near-title').textContent=type.emoji+' '+text;$('near-description').textContent=pin.title;$('near-alert').hidden=false;$('near-open').onclick=()=>{openEvent(pin);$('near-alert').hidden=true;};
      clearTimeout(alertTimer);alertTimer=setTimeout(()=>{$('near-alert').hidden=true;},10000);
      navigator.vibrate?.([100,60,100]);systemNotification(pin,text);
      if($('trip-voice').checked&&'speechSynthesis'in window&&now-lastVoice>10000){lastVoice=now;const speech=new SpeechSynthesisUtterance(text);speech.lang=window.MaplyI18n.locale();speechSynthesis.cancel();speechSynthesis.speak(speech);}
    }
    function onPosition(value,version){
      if(!active||version!==watchVersion||document.hidden)return;
      const c=value.coords;if(!Number.isFinite(c.latitude)||!Number.isFinite(c.longitude)||Math.abs(c.latitude)>85||Math.abs(c.longitude)>180||!Number.isFinite(c.accuracy))return;
      const now=Date.now();let speed=Number.isFinite(c.speed)?Math.max(0,Math.min(70,c.speed)):0;
      const p={lat:c.latitude,lng:c.longitude,accuracy:Math.max(1,c.accuracy),timestamp:now,heading:Number.isFinite(c.heading)?c.heading:null,speed};
      if(c.speed===null&&position&&position.accuracy<=40&&p.accuracy<=40){const dt=(now-position.timestamp)/1000;if(dt>=1&&dt<=30)p.speed=Math.min(70,Math.max(0,N.distance(position,p)-position.accuracy-p.accuracy)/dt);}
      previous=position;position=p;engine.updateLocation(p);updateTripCaption();
      if($('trip-follow').checked&&p.accuracy<=80)engine.map.setView([p.lat,p.lng],Math.max(15,Math.min(17,engine.map.getZoom())),{silent:true});
      if(chosen)updateProgress();loadNearby();checkNearby();
    }
    function startWatch(){
      if(!active||document.hidden||watchId!==null)return;
      const version=++watchVersion;
      watchId=navigator.geolocation.watchPosition(p=>onPosition(p,version),error=>{if(version!==watchVersion)return;if(error.code===1){stop();notify(t('\u0420\u0430\u0437\u0440\u0435\u0448\u0438 \u0434\u043e\u0441\u0442\u0443\u043f \u043a \u043c\u0435\u0441\u0442\u043e\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u044e, \u0447\u0442\u043e\u0431\u044b \u0432\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0440\u0435\u0436\u0438\u043c.'));}else tripState(t('\u041c\u0435\u0441\u0442\u043e\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e. \u041f\u0440\u0435\u0434\u0443\u043f\u0440\u0435\u0436\u0434\u0435\u043d\u0438\u044f \u043f\u0440\u0438\u043e\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u044b.'));},{enableHighAccuracy:true,maximumAge:3000,timeout:15000});
    }
    async function acquireWakeLock(){try{if(active&&!document.hidden&&navigator.wakeLock){const lock=await navigator.wakeLock.request('screen');if(active&&!document.hidden)wakeLock=lock;else await lock.release();}}catch{}}
    function pause(){++watchVersion;if(watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null;}nearController?.abort();wakeLock?.release?.();wakeLock=null;window.speechSynthesis?.cancel();$('near-alert').hidden=true;updateTripCaption();}
    function start(){if(!navigator.geolocation?.watchPosition)return notify(t('\u0413\u0435\u043e\u043b\u043e\u043a\u0430\u0446\u0438\u044f \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430. \u0412\u044b\u0431\u0435\u0440\u0438 \u043c\u0435\u0441\u0442\u043e \u0432\u0440\u0443\u0447\u043d\u0443\u044e.'));active=true;nearFresh=0;lastNearby=0;position=null;previous=null;updateTripCaption();startWatch();acquireWakeLock();}
    function stop(){active=false;pause();nearby=[];position=null;clearTimeout(alertTimer);tripState(t('\u0420\u0435\u0436\u0438\u043c \u0432\u044b\u043a\u043b\u044e\u0447\u0435\u043d. \u041c\u0435\u0441\u0442\u043e\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u0431\u043e\u043b\u044c\u0448\u0435 \u043d\u0435 \u043e\u0442\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044f.'));}
    $('search-open').addEventListener('click',()=>{$('search-dialog').showModal();$('search-input').focus({preventScroll:true});});
    $('search-form').addEventListener('submit',search);$('search-dialog').addEventListener('close',()=>{++searchVersion;searchController?.abort();$('search-submit').disabled=false;});
    $('route-start').addEventListener('change',()=>{const manual=$('route-start').value==='center';document.body.classList.toggle('manual-route-start',manual);if(manual)$('trip-follow').checked=false;$('place-message').textContent=manual?t('\u041f\u0435\u0440\u0435\u0434\u0432\u0438\u043d\u044c \u043a\u0430\u0440\u0442\u0443 \u043a \u043c\u0435\u0441\u0442\u0443 \u0441\u0442\u0430\u0440\u0442\u0430. \u041d\u0430\u0447\u0430\u043b\u043e \u2014 \u0446\u0435\u043d\u0442\u0440 \u043a\u0430\u0440\u0442\u044b.') : '';});
    $('place-close').addEventListener('click',clearRoute);$('route-close').addEventListener('click',clearRoute);$('place-route').addEventListener('click',buildRoute);
    $('route-rebuild').addEventListener('click',()=>{routes=[];chosen=null;engine.setRoute(null);$('route-panel').hidden=true;document.body.classList.remove('route-open');renderPlace();buildRoute();});
    $('trip-toggle').addEventListener('click',()=>{$('trip-dialog').showModal();updateTripCaption();});
    $('trip-start').addEventListener('click',()=>{if(active)stop();else start();});
    $('trip-notifications').addEventListener('change',async()=>{if(!$('trip-notifications').checked)return;if(!('Notification'in window)){$('trip-notifications').checked=false;notify(t('\u0421\u0438\u0441\u0442\u0435\u043c\u043d\u044b\u0435 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f \u0437\u0434\u0435\u0441\u044c \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b. \u041f\u0440\u0435\u0434\u0443\u043f\u0440\u0435\u0436\u0434\u0435\u043d\u0438\u044f \u043e\u0441\u0442\u0430\u043d\u0443\u0442\u0441\u044f \u0432 Maply.'));return;}try{const permission=await Notification.requestPermission();if(permission!=='granted'){$('trip-notifications').checked=false;notify(t('\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f \u0437\u0430\u043f\u0440\u0435\u0449\u0435\u043d\u044b. \u041f\u0440\u0435\u0434\u0443\u043f\u0440\u0435\u0436\u0434\u0435\u043d\u0438\u044f \u043e\u0441\u0442\u0430\u043d\u0443\u0442\u0441\u044f \u0432 Maply.'));}else{const registration=await navigator.serviceWorker?.getRegistration();if(!registration?.active){$('trip-notifications').checked=false;notify(t('\u0421\u0438\u0441\u0442\u0435\u043c\u043d\u044b\u0435 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f \u0437\u0434\u0435\u0441\u044c \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b. \u041f\u0440\u0435\u0434\u0443\u043f\u0440\u0435\u0436\u0434\u0435\u043d\u0438\u044f \u043e\u0441\u0442\u0430\u043d\u0443\u0442\u0441\u044f \u0432 Maply.'));}}}catch{$('trip-notifications').checked=false;}});
    $('near-close').addEventListener('click',()=>{$('near-alert').hidden=true;});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else if(active){startWatch();loadNearby(true);acquireWakeLock();}});
    window.addEventListener('pagehide',stop);window.addEventListener('offline',()=>{nearController?.abort();updateTripCaption();});window.addEventListener('online',()=>{updateTripCaption();loadNearby(true);});
    loadTimer=setInterval(()=>{if(active&&!document.hidden){updateTripCaption();loadNearby();checkNearby();}if(!document.hidden)updateRouteEvents();},20000);
    window.MaplySettings.subscribe(()=>{renderPlace();renderRoutes();if(active)updateTripCaption();else tripState(t('\u0420\u0435\u0436\u0438\u043c \u0432\u044b\u043a\u043b\u044e\u0447\u0435\u043d. \u041c\u0435\u0441\u0442\u043e\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u0431\u043e\u043b\u044c\u0448\u0435 \u043d\u0435 \u043e\u0442\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044f.'));});
    tripState(t('\u0420\u0435\u0436\u0438\u043c \u0432\u044b\u043a\u043b\u044e\u0447\u0435\u043d. \u041c\u0435\u0441\u0442\u043e\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u0431\u043e\u043b\u044c\u0448\u0435 \u043d\u0435 \u043e\u0442\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044f.'));
    return {toEvent(pin){choosePlace({lat:pin.lat,lng:pin.lng,name:pin.title,address:C.types[pin.type]?.name||''});},choosePlace,search,buildRoute,start,stop,active:()=>active};
  }
  window.MaplyJourney={create};
})();
