'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const wrapLng = lng => ((lng + 180) % 360 + 360) % 360 - 180;
  const STYLES = {liberty:'https://tiles.openfreemap.org/styles/liberty',positron:'https://tiles.openfreemap.org/styles/positron',dark:'https://tiles.openfreemap.org/styles/dark'};
  let resourcePromise;
  function loadResource(kind,url) {
    return new Promise((resolve,reject) => {
      const node = document.createElement(kind === 'script' ? 'script' : 'link');
      if (kind === 'script') {node.src = url;node.async = true;}
      else {node.rel = 'stylesheet';node.href = url;}
      const timer = setTimeout(() => {node.onload = node.onerror = null;node.remove();reject(new Error('MAPLY_MAP_RESOURCE_TIMEOUT'));},15000);
      node.onload = () => {clearTimeout(timer);resolve();};
      node.onerror = () => {clearTimeout(timer);node.remove();reject(new Error('MAPLY_MAP_RESOURCE_FAILED'));};
      document.head.append(node);
    });
  }
  function ensureResources() {
    if (!resourcePromise) resourcePromise = (async () => {
      if (typeof window.maplibregl?.Map !== 'function') {
        await Promise.all([
          loadResource('style','https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.css'),
          loadResource('script','https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js')
        ]);
      }
      if (typeof window.maplibregl?.Map !== 'function') throw new Error('MAPLY_MAP_LIBRARY_UNAVAILABLE');
      if (typeof L.maplibreGL !== 'function') await loadResource('script','https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.1.3/leaflet-maplibre-gl.js');
    })().catch(error => {resourcePromise = null;throw error;});
    return resourcePromise;
  }
  function initialView() {
    try {
      const saved = JSON.parse(localStorage.getItem('maply-map-view') || 'null');
      if (saved && Number.isFinite(saved.lat) && Math.abs(saved.lat) <= 85 && Number.isFinite(saved.lng) && Math.abs(saved.lng) <= 180 && Number.isFinite(saved.zoom) && saved.zoom >= 3 && saved.zoom <= 19) return saved;
    } catch {}
    return {lat:41.0082,lng:28.9784,zoom:15};
  }
  function create({notify,getSettings,getStyle,onMove,onClick,onLongPress}) {
    const view = initialView();
    const map = L.map('map',{zoomControl:false,tapHold:true,worldCopyJump:true,minZoom:3,maxZoom:19,maxBoundsViscosity:1,maxBounds:[[-85.05112878,-540],[85.05112878,540]]}).setView([view.lat,view.lng],view.zoom);
    L.control.zoom({position:'bottomleft'}).addTo(map);
    const fallback = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',maxZoom:19
    }).addTo(map);
    let modern, gl, ready = false, initializing = false, desired = getStyle(), current;
    let cancelStyleWait = () => {}, switching = false, styleVersion = 0, viewVersion = 0;
    let locationLayer, locationRequest = 0, pendingAutomatic = false;
    function showFallback() {
      if (!map.hasLayer(fallback)) fallback.addTo(map);
      if (modern) modern.getContainer().style.visibility = 'hidden';
    }
    function showModern() {
      modern.getContainer().style.visibility = '';
      if (map.hasLayer(fallback)) map.removeLayer(fallback);
    }
    function changeStyle(style) {
      if (!Object.prototype.hasOwnProperty.call(STYLES,style)) return;
      desired = style;
      if (!ready) {if (!initializing) initBasemap();return;}
      if (current === desired && !switching) return;
      cancelStyleWait();switching = true;showFallback();
      const version = ++styleVersion, requested = desired;
      const cleanup = () => {clearTimeout(timer);gl.off('idle',loaded);gl.off('error',failed);};
      const loaded = () => {cleanup();if (version === styleVersion) {switching = false;current = requested;showModern();}};
      const failed = () => {cleanup();if (version === styleVersion) {switching = false;current = null;showFallback();notify('\u0421\u0442\u0438\u043b\u044c \u043a\u0430\u0440\u0442\u044b \u043f\u043e\u043a\u0430 \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043b\u0441\u044f. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u0432\u044b\u0431\u0440\u0430\u0442\u044c \u0434\u0440\u0443\u0433\u043e\u0439.');}};
      const timer = setTimeout(failed,20000);
      cancelStyleWait = cleanup;
      gl.once('idle',loaded);gl.once('error',failed);
      try {gl.setStyle(STYLES[requested]);} catch {failed();}
    }
    async function initBasemap() {
      if (initializing) return;
      initializing = true;
      try {
        await ensureResources();
        const requested = desired;
        modern = L.maplibreGL({style:STYLES[requested],interactive:false,renderWorldCopies:true,
          attribution:'<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> &copy; <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
        }).addTo(map);
        modern.getContainer().style.visibility = 'hidden';gl = modern.getMaplibreMap();
        await new Promise((resolve,reject) => {
          const cleanup = () => {clearTimeout(timer);gl.off('load',loaded);gl.off('error',failed);};
          const loaded = () => {cleanup();resolve();};
          const failed = () => {cleanup();reject(new Error('MAPLY_VECTOR_MAP_FAILED'));};
          const timer = setTimeout(failed,20000);
          gl.once('load',loaded);gl.once('error',failed);if (gl.loaded()) loaded();
        });
        ready = true;current = requested;showModern();
        gl.getCanvas().addEventListener('webglcontextlost',() => {showFallback();});
        gl.getCanvas().addEventListener('webglcontextrestored',() => {gl.once('idle',() => {if (current === desired) showModern();});});
        if (current !== desired) changeStyle(desired);
      } catch (error) {
        console.warn('Maply basemap:',error);ready = false;
        if (modern && map.hasLayer(modern)) map.removeLayer(modern);
        modern = null;showFallback();notify('\u0421\u043e\u0432\u0440\u0435\u043c\u0435\u043d\u043d\u0430\u044f \u043a\u0430\u0440\u0442\u0430 \u043f\u043e\u043a\u0430 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430. \u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u043c \u043e\u0431\u044b\u0447\u043d\u0443\u044e \u043a\u0430\u0440\u0442\u0443.');
      } finally {initializing = false;}
    }
    function requestLocation(automatic = false) {
      if (automatic && !getSettings().autoLocate) return;
      if (!navigator.geolocation) {if (!automatic) notify('\u042d\u0442\u043e\u0442 \u0431\u0440\u0430\u0443\u0437\u0435\u0440 \u043d\u0435 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442 \u0433\u0435\u043e\u043b\u043e\u043a\u0430\u0446\u0438\u044e.');return;}
      const request = ++locationRequest, startedAt = viewVersion;
      pendingAutomatic = automatic;$('locate').disabled = true;
      navigator.geolocation.getCurrentPosition(position => {
        if (request !== locationRequest) return;
        pendingAutomatic = false;
        const {latitude,longitude,accuracy} = position.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {$('locate').disabled = false;return;}
        if (!automatic || viewVersion === startedAt) map.setView([Math.max(-85,Math.min(85,latitude)),longitude],16);
        if (locationLayer) map.removeLayer(locationLayer);
        locationLayer = L.layerGroup([
          L.circle([latitude,longitude],{radius:Math.max(Number.isFinite(accuracy) ? accuracy : 8,8),color:'#397dc5',fillColor:'#397dc5',fillOpacity:.12,weight:1,interactive:false}),
          L.circleMarker([latitude,longitude],{radius:6,color:'white',weight:2,fillColor:'#276bb0',fillOpacity:1,interactive:false})
        ]).addTo(map);$('locate').disabled = false;
      },error => {
        if (request !== locationRequest) return;
        pendingAutomatic = false;$('locate').disabled = false;
        if (!automatic) notify(error.code === 1 ? '\u0420\u0430\u0437\u0440\u0435\u0448\u0438 \u0434\u043e\u0441\u0442\u0443\u043f \u043a \u043c\u0435\u0441\u0442\u043e\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u044e \u0432 \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430\u0445 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430.' : '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0438\u0442\u044c \u043c\u0435\u0441\u0442\u043e\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u0435\u0449\u0451 \u0440\u0430\u0437.');
      },{enableHighAccuracy:true,timeout:automatic ? 8000 : 12000,maximumAge:30000});
    }
    map.on('movestart',() => {++viewVersion;});
    map.on('moveend',() => {
      const center = map.getCenter();
      try {localStorage.setItem('maply-map-view',JSON.stringify({lat:center.lat,lng:wrapLng(center.lng),zoom:map.getZoom()}));} catch {}
      onMove();
    });
    map.on('click',onClick);
    map.on('contextmenu',event => {
      if (event.originalEvent?.target?.closest?.('.leaflet-marker-icon,.leaflet-popup,.leaflet-control')) return;
      onLongPress(event.latlng);
    });
    initBasemap();requestLocation(true);
    return {map,requestLocation,changeStyle,settingsChanged() {
      if (!getSettings().autoLocate && pendingAutomatic) {++locationRequest;pendingAutomatic = false;$('locate').disabled = false;}
      changeStyle(getStyle());
    }};
  }
  window.MaplyMap = {create};
})();
