'use strict';
(() => {
  const t=window.MaplyI18n.t;
  const $=id=>document.getElementById(id), C=window.MaplyCategories;
  const STYLES={liberty:'https://tiles.openfreemap.org/styles/liberty',positron:'https://tiles.openfreemap.org/styles/positron',dark:'https://tiles.openfreemap.org/styles/dark'};
  const wrap=n=>((n+180)%360+360)%360-180;
  const empty=()=>({type:'FeatureCollection',features:[]});
  const raster=()=>({version:8,glyphs:'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,
    attribution:'\u00a9 <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}},layers:[{id:'osm',type:'raster',source:'osm'}]});
  function resource(kind,url) {return new Promise((resolve,reject)=>{
    const node=document.createElement(kind==='script'?'script':'link');
    if(kind==='script'){node.src=url;node.async=true;}else{node.rel='stylesheet';node.href=url;}
    const timer=setTimeout(()=>{node.remove();reject(new Error('MAPLY_MAP_TIMEOUT'));},15000);
    node.onload=()=>{clearTimeout(timer);resolve();};node.onerror=()=>{clearTimeout(timer);node.remove();reject(new Error('MAPLY_MAP_RESOURCE'));};document.head.append(node);
  });}
  function view() {
    try{const v=JSON.parse(localStorage.getItem('maply-map-view'));if(v&&Number.isFinite(v.lat)&&Math.abs(v.lat)<=85&&Number.isFinite(v.lng)&&Math.abs(v.lng)<=180&&v.zoom>=3&&v.zoom<=19)return v;}catch{}
    return {lat:41.0082,lng:28.9784,zoom:15};
  }
  async function create({notify,status,getSettings,getStyle,onMove,onClick,onLongPress,onLocation}) {
    let gl,leaflet,layer,locationLayer,pins=[],selected=null,geo=null,locationRequest=0,viewVersion=0,autoPending=false;
    let pick=()=>{},styleTimer,styleVersion=0,desired=getStyle(),ready=false;
    const start=view();
    const map={
      getBounds:()=> (gl||leaflet).getBounds(),getCenter:()=> (gl||leaflet).getCenter(),getZoom:()=> (gl||leaflet).getZoom(),
      setView(point,zoom,options={}){if(gl){const camera={center:[point[1],point[0]],zoom:zoom??gl.getZoom(),duration:350};if(options.animate===false)gl.jumpTo(camera);else gl.easeTo(camera);}else leaflet.setView(point,zoom??leaflet.getZoom(),options);return map;},
      closePopup(){},getBearing:()=>gl?gl.getBearing():0
    };
    function persist() {
      const p=map.getCenter();try{localStorage.setItem('maply-map-view',JSON.stringify({lat:p.lat,lng:wrap(p.lng),zoom:map.getZoom()}));}catch{}
      if(gl){$('compass-arrow').style.transform=`rotate(${-gl.getBearing()}deg)`;$('compass').setAttribute('aria-label',t("\u0421\u0435\u0432\u0435\u0440 \u0441\u0432\u0435\u0440\u0445\u0443. \u041f\u043e\u0432\u043e\u0440\u043e\u0442 {degrees} \u0433\u0440\u0430\u0434\u0443\u0441\u043e\u0432",{degrees:Math.round(gl.getBearing())}));}
      onMove();
    }
    function icon(type,confirmed=false) {
      const canvas=document.createElement('canvas');canvas.width=canvas.height=72;const ctx=canvas.getContext('2d');
      ctx.beginPath();ctx.arc(36,36,28,0,Math.PI*2);ctx.fillStyle='white';ctx.fill();ctx.lineWidth=5;ctx.strokeStyle=type.color;ctx.stroke();
      ctx.font='32px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=type.color;ctx.fillText(type.emoji,36,37);
      if(confirmed){ctx.beginPath();ctx.arc(57,55,12,0,Math.PI*2);ctx.fillStyle='#06766f';ctx.fill();ctx.font='bold 17px system-ui';ctx.fillStyle='white';ctx.fillText('\u2713',57,55);}
      return ctx.getImageData(0,0,72,72);
    }
    function eventsData() {return {type:'FeatureCollection',features:pins.map(p=>({type:'Feature',id:p.id,geometry:{type:'Point',coordinates:[p.lng,p.lat]},
      properties:{id:p.id,type:C.types[p.type]?p.type:'custom',icon:'maply-'+(C.types[p.type]?p.type:'custom')+(Number(p.active_votes)>0?'-yes':''),confirmed:Number(p.active_votes)>0,opacity:p.maplyOpacity??1}}))};}
    function overlays() {
      if(!gl||!ready)return;
      for(const [key,type] of Object.entries(C.types))for(const confirmed of [false,true]){const id='maply-'+key+(confirmed?'-yes':'');if(!gl.hasImage(id))gl.addImage(id,icon(type,confirmed),{pixelRatio:2});}
      if(!gl.getSource('maply-events')) {
        gl.addSource('maply-events',{type:'geojson',data:eventsData(),cluster:true,clusterMaxZoom:17,clusterRadius:48});
        gl.addLayer({id:'maply-clusters',type:'circle',source:'maply-events',filter:['has','point_count'],paint:{'circle-color':'#06766f','circle-radius':22,'circle-stroke-color':'#ffffff','circle-stroke-width':3}});
        gl.addLayer({id:'maply-cluster-count',type:'symbol',source:'maply-events',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-font':['Noto Sans Regular'],'text-size':14,'text-allow-overlap':true},paint:{'text-color':'#ffffff'}});
        gl.addLayer({id:'maply-confirmed',type:'circle',source:'maply-events',filter:['all',['!',['has','point_count']],['==',['get','confirmed'],true]],paint:{'circle-color':'#d9f5ed','circle-radius':21,'circle-stroke-color':'#06766f','circle-stroke-width':2,'circle-opacity':['get','opacity'],'circle-stroke-opacity':['get','opacity']}});
        gl.addLayer({id:'maply-pins',type:'symbol',source:'maply-events',filter:['!',['has','point_count']],layout:{'icon-image':['get','icon'],'icon-size':1,'icon-allow-overlap':true},paint:{'icon-opacity':['get','opacity']}});
      }else gl.getSource('maply-events').setData(eventsData());
      drawLocation();drawSelection();
    }
    function drawLocation() {
      if(!geo)return;
      if(!gl) {
        if(locationLayer)leaflet.removeLayer(locationLayer);
        locationLayer=L.layerGroup([L.circle([geo.lat,geo.lng],{radius:geo.accuracy,color:'#397dc5',fillOpacity:.12,interactive:false}),L.circleMarker([geo.lat,geo.lng],{radius:6,color:'white',weight:2,fillColor:'#276bb0',fillOpacity:1,interactive:false})]).addTo(leaflet);return;
      }
      if(!ready)return;
      const ring=[],a=Math.min(geo.accuracy,2000000)/6371000,lat=geo.lat*Math.PI/180,lng=geo.lng*Math.PI/180;
      for(let i=0;i<=64;i++){const b=i*Math.PI/32,phi=Math.asin(Math.sin(lat)*Math.cos(a)+Math.cos(lat)*Math.sin(a)*Math.cos(b));ring.push([(lng+Math.atan2(Math.sin(b)*Math.sin(a)*Math.cos(lat),Math.cos(a)-Math.sin(lat)*Math.sin(phi)))*180/Math.PI,phi*180/Math.PI]);}
      const data={type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Polygon',coordinates:[ring]},properties:{kind:'accuracy'}},{type:'Feature',geometry:{type:'Point',coordinates:[geo.lng,geo.lat]},properties:{kind:'point'}}]};
      if(gl.getSource('maply-location'))gl.getSource('maply-location').setData(data);
      else {
        gl.addSource('maply-location',{type:'geojson',data});gl.addLayer({id:'maply-accuracy',type:'fill',source:'maply-location',filter:['==',['get','kind'],'accuracy'],paint:{'fill-color':'#397dc5','fill-opacity':.15}});
        gl.addLayer({id:'maply-position',type:'circle',source:'maply-location',filter:['==',['get','kind'],'point'],paint:{'circle-color':'#276bb0','circle-radius':6,'circle-stroke-color':'#ffffff','circle-stroke-width':3}});
      }
    }
    let pointMarker;
    function drawSelection() {
      if(pointMarker){pointMarker.remove();pointMarker=null;}
      if(!selected)return;
      if(gl){const el=document.createElement('div');el.className='selected-location';el.textContent='+';el.setAttribute('aria-label',t("\u0412\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0435 \u043c\u0435\u0441\u0442\u043e \u0441\u043e\u0431\u044b\u0442\u0438\u044f"));pointMarker=new maplibregl.Marker({element:el,draggable:false}).setLngLat([selected.lng,selected.lat]).addTo(gl);}
      else pointMarker=L.marker([selected.lat,selected.lng],{draggable:false}).addTo(leaflet);
    }
    function setEvents(rows) {
      pins=rows;
      if(gl){overlays();return;}
      layer.clearLayers();
      for(const p of pins){const t=C.types[p.type]||C.types.custom;const el=document.createElement('button');el.className='fallback-pin';el.textContent=t.emoji+(Number(p.active_votes)>0?' \u2713':'');el.style.borderColor=t.color;el.style.opacity=String(p.maplyOpacity??1);el.setAttribute('aria-label',t.name+': '+p.title);el.addEventListener('click',e=>{e.stopPropagation();pick(p.id);});
        const marker=L.marker([p.lat,p.lng],{draggable:false,icon:L.divIcon({className:'pin-icon',html:el,iconSize:[44,44],iconAnchor:[22,22]})}).addTo(layer);marker.on('click',()=>pick(p.id));}
    }
    function changeStyle(style) {
      if(!STYLES[style])return;desired=style;if(!gl)return;ready=false;
      const version=++styleVersion;clearTimeout(styleTimer);
      try{gl.setStyle(STYLES[style]);}catch{gl.setStyle(raster());notify(t("\u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u043c \u0440\u0435\u0437\u0435\u0440\u0432\u043d\u0443\u044e \u043a\u0430\u0440\u0442\u0443."));}
      styleTimer=setTimeout(()=>{if(version===styleVersion&&!gl.isStyleLoaded()){gl.setStyle(raster());notify(t("\u0426\u0432\u0435\u0442\u043d\u0430\u044f \u043a\u0430\u0440\u0442\u0430 \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043b\u0430\u0441\u044c. \u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u043c \u0440\u0435\u0437\u0435\u0440\u0432\u043d\u0443\u044e \u043a\u0430\u0440\u0442\u0443."));}},18000);
    }
    try {
      if(typeof window.maplibregl?.Map!=='function')await Promise.all([resource('style','https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.css'),resource('script','https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js')]);
      gl=new maplibregl.Map({container:'map',style:raster(),center:[start.lng,start.lat],zoom:start.zoom,minZoom:3,maxZoom:19,bearing:0,pitch:0,touchZoomRotate:true,dragRotate:true,touchPitch:false,attributionControl:false});
      gl.touchZoomRotate.enableRotation();
      gl.addControl(new maplibregl.AttributionControl({compact:false,customAttribution:'<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> \u00b7 <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a>'}),'bottom-left');
      gl.on('style.load',()=>{ready=true;clearTimeout(styleTimer);overlays();if($('status-text').textContent===t("\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 \u043a\u0430\u0440\u0442\u044b\u2026"))status('');});
      gl.on('movestart',()=>{++viewVersion;});gl.on('moveend',persist);gl.on('rotate',()=>{$('compass-arrow').style.transform=`rotate(${-gl.getBearing()}deg)`;});
      gl.on('click',async e=>{
        const layers=['maply-clusters','maply-pins'].filter(id=>gl.getLayer(id));
        if(Date.now()<heldUntil)return;
        const features=layers.length?gl.queryRenderedFeatures(e.point,{layers}):[];
        const cluster=features.find(f=>f.properties.cluster_id!==undefined);
        if(cluster){try{const source=gl.getSource('maply-events');const zoom=await source.getClusterExpansionZoom(cluster.properties.cluster_id);if(source===gl.getSource('maply-events'))gl.easeTo({center:cluster.geometry.coordinates,zoom,duration:350});}catch{}return;}
        if(features[0]){pick(features[0].properties.id);return;}
        onClick({latlng:{lat:e.lngLat.lat,lng:wrap(e.lngLat.lng)}});
      });
      gl.on('contextmenu',e=>{e.originalEvent?.preventDefault();if(!e.originalEvent?.ctrlKey)onLongPress({lat:e.lngLat.lat,lng:wrap(e.lngLat.lng)});});
      const canvas=gl.getCanvas();canvas.setAttribute('aria-label',t('\u041a\u0430\u0440\u0442\u0430 \u0441\u043e\u0431\u044b\u0442\u0438\u0439. \u041f\u043e\u0432\u0435\u0440\u043d\u0438 \u0434\u0432\u0443\u043c\u044f \u043f\u0430\u043b\u044c\u0446\u0430\u043c\u0438; \u043a\u043e\u043c\u043f\u0430\u0441 \u0432\u043e\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u0442 \u0441\u0435\u0432\u0435\u0440 \u0432\u0432\u0435\u0440\u0445.'));canvas.setAttribute('data-i18n-aria-label','\u041a\u0430\u0440\u0442\u0430 \u0441\u043e\u0431\u044b\u0442\u0438\u0439. \u041f\u043e\u0432\u0435\u0440\u043d\u0438 \u0434\u0432\u0443\u043c\u044f \u043f\u0430\u043b\u044c\u0446\u0430\u043c\u0438; \u043a\u043e\u043c\u043f\u0430\u0441 \u0432\u043e\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u0442 \u0441\u0435\u0432\u0435\u0440 \u0432\u0432\u0435\u0440\u0445.');let hold,startTouch,heldUntil=0;
      canvas.addEventListener('touchstart',e=>{clearTimeout(hold);if(e.touches.length!==1)return;const t=e.touches[0];startTouch={x:t.clientX,y:t.clientY};hold=setTimeout(()=>{heldUntil=Date.now()+1000;const rect=canvas.getBoundingClientRect(),p=gl.unproject([startTouch.x-rect.left,startTouch.y-rect.top]);onLongPress({lat:p.lat,lng:wrap(p.lng)});},650);},{passive:true});
      canvas.addEventListener('touchmove',e=>{const t=e.touches[0];if(e.touches.length!==1||!t||!startTouch||Math.hypot(t.clientX-startTouch.x,t.clientY-startTouch.y)>8)clearTimeout(hold);},{passive:true});
      for(const name of ['touchend','touchcancel'])canvas.addEventListener(name,()=>clearTimeout(hold),{passive:true});
      canvas.addEventListener('webglcontextlost',()=>status(t("\u041a\u0430\u0440\u0442\u0430 \u0432\u043e\u0441\u0441\u0442\u0430\u043d\u0430\u0432\u043b\u0438\u0432\u0430\u0435\u0442\u0441\u044f\u2026"),true));canvas.addEventListener('webglcontextrestored',()=>{gl.once('idle',()=>{overlays();status('');});});
      changeStyle(desired);
    } catch(error) {
      if(gl){gl.remove();gl=null;}if(!window.L)throw error;
      $('map').replaceChildren();leaflet=L.map('map',{zoomControl:false,tapHold:true,worldCopyJump:true,minZoom:3,maxZoom:19}).setView([start.lat,start.lng],start.zoom);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'\u00a9 <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(leaflet);layer=L.layerGroup().addTo(leaflet);
      leaflet.on('movestart',()=>{++viewVersion;});leaflet.on('moveend',persist);leaflet.on('click',onClick);leaflet.on('contextmenu',e=>onLongPress(e.latlng));
      $('compass').disabled=true;ready=true;status('');notify(t("\u0420\u0435\u0437\u0435\u0440\u0432\u043d\u0430\u044f \u043a\u0430\u0440\u0442\u0430 \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442 \u0431\u0435\u0437 \u043f\u043e\u0432\u043e\u0440\u043e\u0442\u0430. \u041f\u0440\u043e\u0432\u0435\u0440\u044c \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442 \u0438 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0443 \u0433\u0440\u0430\u0444\u0438\u043a\u0438 \u0432 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435."));
    }
    function requestLocation(automatic=false,recenter=true) {
      if(automatic&&!getSettings().autoLocate)return Promise.resolve(null);
      if(!navigator.geolocation){if(!automatic)notify(t("\u0413\u0435\u043e\u043b\u043e\u043a\u0430\u0446\u0438\u044f \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430. \u0412\u044b\u0431\u0435\u0440\u0438 \u043c\u0435\u0441\u0442\u043e \u0432\u0440\u0443\u0447\u043d\u0443\u044e."));return Promise.resolve(null);}
      const request=++locationRequest,started=viewVersion;autoPending=automatic;$('locate').disabled=true;
      return new Promise(resolve=>navigator.geolocation.getCurrentPosition(position=>{
        if(request!==locationRequest){resolve(null);return;}autoPending=false;$('locate').disabled=false;
        const {latitude,longitude,accuracy}=position.coords;
        if(!Number.isFinite(latitude)||!Number.isFinite(longitude)){resolve(null);return;}
        geo={lat:latitude,lng:wrap(longitude),accuracy:Math.max(8,Number(accuracy)||8),timestamp:Date.now()};
        if(recenter&&(!automatic||viewVersion===started))map.setView([Math.max(-85,Math.min(85,geo.lat)),geo.lng],16);
        drawLocation();onLocation?.(geo);resolve(geo);
      },error=>{if(request===locationRequest){autoPending=false;$('locate').disabled=false;if(!automatic){status(error.code===1?t("\u0420\u0430\u0437\u0440\u0435\u0448\u0438 \u0434\u043e\u0441\u0442\u0443\u043f \u043a \u043c\u0435\u0441\u0442\u043e\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u044e \u0438\u043b\u0438 \u0432\u044b\u0431\u0435\u0440\u0438 \u043c\u0435\u0441\u0442\u043e \u0432\u0440\u0443\u0447\u043d\u0443\u044e."):t("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0438\u0442\u044c \u043c\u0435\u0441\u0442\u043e\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u0435\u0449\u0451 \u0440\u0430\u0437."),true);$('geo-help').hidden=false;}}resolve(null);
      },{enableHighAccuracy:true,timeout:automatic?8000:12000,maximumAge:30000}));
    }
    $('compass').addEventListener('click',()=>gl?.resetNorth({duration:350}));
    $('zoom-in').addEventListener('click',()=>map.setView([map.getCenter().lat,map.getCenter().lng],Math.min(19,map.getZoom()+1)));
    $('zoom-out').addEventListener('click',()=>map.setView([map.getCenter().lat,map.getCenter().lng],Math.max(3,map.getZoom()-1)));
    return {map,setEvents,onSelect(fn){pick=fn;},requestLocation,changeStyle,selectPoint(p){selected=p;drawSelection();},location:()=>geo,
      ready:()=>ready,settingsChanged(){if(!getSettings().autoLocate&&autoPending){++locationRequest;autoPending=false;$('locate').disabled=false;}if(desired!==getStyle())changeStyle(getStyle());}};
  }
  window.MaplyMap={create};
})();
