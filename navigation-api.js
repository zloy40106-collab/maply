'use strict';
(() => {
  const R=6371000,rad=Math.PI/180;
  const distance=(a,b)=>window.MaplyCategories.distance(a,b);
  function segment(point,a,b){
    const scale=Math.cos(point.lat*rad),x=(a[0]-point.lng)*rad*R*scale,y=(a[1]-point.lat)*rad*R;
    const dx=(b[0]-a[0])*rad*R*scale,dy=(b[1]-a[1])*rad*R,length=dx*dx+dy*dy;
    const f=length?Math.max(0,Math.min(1,-(x*dx+y*dy)/length)):0;
    return {distance:Math.hypot(x+f*dx,y+f*dy),fraction:f};
  }
  function nearest(point,coordinates){
    let best={distance:Infinity,index:0,fraction:0};
    for(let i=1;i<coordinates.length;i++){const hit=segment(point,coordinates[i-1],coordinates[i]);if(hit.distance<best.distance)best={...hit,index:i-1};}
    return best;
  }
  const segmentIndexes=new WeakMap();
  function corridorHit(point,coordinates){
    let index=segmentIndexes.get(coordinates);
    if(!index){
      index=new Map();index.long=[];
      for(let i=1;i<coordinates.length;i++){
        const a=coordinates[i-1],b=coordinates[i],x0=Math.floor(Math.min(a[0],b[0])*500),x1=Math.floor(Math.max(a[0],b[0])*500),y0=Math.floor(Math.min(a[1],b[1])*500),y1=Math.floor(Math.max(a[1],b[1])*500);
        if((x1-x0+1)*(y1-y0+1)>200){index.long.push(i);continue;}
        for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){const key=x+','+y;if(!index.has(key))index.set(key,[]);index.get(key).push(i);}
      }
      segmentIndexes.set(coordinates,index);
    }
    const x=Math.floor(point.lng*500),y=Math.floor(point.lat*500),range=Math.ceil(45/(222.64*Math.max(.087,Math.cos(point.lat*rad))))+1,ids=new Set(index.long);
    for(let dx=-range;dx<=range;dx++)for(let dy=-1;dy<=1;dy++)for(const id of index.get((x+dx)+','+(y+dy))||[])ids.add(id);
    let best={distance:Infinity,index:0,fraction:0};
    for(const id of ids){const hit=segment(point,coordinates[id-1],coordinates[id]);if(hit.distance<best.distance)best={...hit,index:id-1};}
    return best;
  }
  function bounds(points,padding=0){
    const lats=points.map(p=>p.lat),lngs=points.map(p=>p.lng),latPad=padding/111320,mid=(Math.min(...lats)+Math.max(...lats))/2,lngPad=latPad/Math.max(.1,Math.cos(mid*rad));
    const south=Math.max(-85,Math.min(...lats)-latPad),north=Math.min(85,Math.max(...lats)+latPad),west=Math.max(-180,Math.min(...lngs)-lngPad),east=Math.min(180,Math.max(...lngs)+lngPad);
    return {getSouth:()=>south,getNorth:()=>north,getWest:()=>west,getEast:()=>east};
  }
  function routeBounds(routes){let south=85,north=-85,west=180,east=-180;for(const route of routes)for(const [lng,lat]of route.coordinates){south=Math.min(south,lat);north=Math.max(north,lat);west=Math.min(west,lng);east=Math.max(east,lng);}return bounds([{lat:south,lng:west},{lat:north,lng:east}],100);}
  const weights={closed:10000,flood:300,fire:300,danger:200,accident:100,pothole:20,infrastructure:20,police:0,custom:10};
  function evaluate(routes,pins){
    return routes.map((route,index)=>{
      const hits=pins.filter(window.MaplyCategories.available).flatMap(pin=>{const hit=corridorHit(pin,route.coordinates);return hit.distance<=45?[{pin,...hit}]:[];});
      const closures=hits.filter(h=>h.pin.type==='closed').length;
      const penalty=hits.reduce((sum,h)=>sum+(weights[h.pin.type]??10),0);
      return {...route,index:route.index??index,hits,closures,score:route.duration+penalty};
    }).sort((a,b)=>a.closures-b.closures||a.score-b.score||a.duration-b.duration);
  }
  async function request(path,params,signal){
    const response=await fetch(path+'?'+new URLSearchParams(params),{signal,cache:'no-store'});
    let data;try{data=await response.json();}catch{throw new Error('API_UNAVAILABLE');}
    if(!response.ok)throw new Error(data?.error||'API_UNAVAILABLE');return data;
  }
  function bearing(a,b){const y=Math.sin((b.lng-a.lng)*rad)*Math.cos(b.lat*rad),x=Math.cos(a.lat*rad)*Math.sin(b.lat*rad)-Math.sin(a.lat*rad)*Math.cos(b.lat*rad)*Math.cos((b.lng-a.lng)*rad);return (Math.atan2(y,x)/rad+360)%360;}
  function ahead(origin,pin){return !Number.isFinite(origin.heading)||!(origin.speed>=2)||Math.abs(((bearing(origin,pin)-origin.heading+540)%360)-180)<=100;}
  function radius(speed){return Math.round(Math.max(150,Math.min(500,Math.max(0,speed||0)*20))/10)*10;}
  window.MaplyNavigationAPI={distance,nearest,bounds,routeBounds,evaluate,ahead,radius,
    search(q,center,signal){return request('/api/map-search',{q,lat:center.lat,lng:center.lng,lang:window.MaplyI18n.language()},signal);},
    route(from,to,signal){return request('/api/map-route',{fromLat:from.lat,fromLng:from.lng,toLat:to.lat,toLng:to.lng},signal);}};
})();
