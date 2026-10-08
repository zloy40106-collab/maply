'use strict';
// Car route alternatives, not live traffic or emergency navigation.
const cache=new Map();let nextRequest=0;
const distance=(a,b)=>{const r=Math.PI/180,p=(b.lat-a.lat)*r,l=(b.lng-a.lng)*r,h=Math.sin(p/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(l/2)**2;return 12742000*Math.asin(Math.min(1,Math.sqrt(h)));};
module.exports=async function(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'METHOD_NOT_ALLOWED'});}
  const a={lat:Number(req.query.fromLat),lng:Number(req.query.fromLng)},b={lat:Number(req.query.toLat),lng:Number(req.query.toLng)};
  if([a,b].some(p=>!Number.isFinite(p.lat)||!Number.isFinite(p.lng)||Math.abs(p.lat)>85||Math.abs(p.lng)>180))return res.status(400).json({error:'INVALID_ROUTE'});
  if(distance(a,b)>150000)return res.status(400).json({error:'ROUTE_TOO_LONG'});
  const key=[a.lng,a.lat,b.lng,b.lat].map(n=>n.toFixed(5)).join(','),now=Date.now(),old=cache.get(key);
  if(old&&old.until>now)return res.status(200).json(old.value);
  if(now<nextRequest){res.setHeader('Retry-After','2');return res.status(429).json({error:'WAIT_AND_RETRY'});}
  nextRequest=now+1100;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    const base=new URL(process.env.MAPLY_OSRM_URL||'https://routing.openstreetmap.de/routed-car/');
    if(base.protocol!=='https:'||base.username||base.password)throw new Error('CONFIG');
    const path='route/v1/driving/'+[a,b].map(p=>p.lng+','+p.lat).join(';');
    const url=new URL(path,base.href.endsWith('/')?base.href:base.href+'/');
    url.search=new URLSearchParams({alternatives:'true',overview:'full',geometries:'geojson',steps:'false',generate_hints:'false'}).toString();
    const upstream=await fetch(url,{signal:controller.signal,headers:{'User-Agent':'Maply/1.0 (+https://maply-ebon.vercel.app)','Accept':'application/json'}});
    if(!upstream.ok)return res.status(upstream.status===429?429:502).json({error:'ROUTE_UNAVAILABLE'});
    const body=await upstream.json();
    if(body.code==='NoRoute')return res.status(404).json({error:'NO_ROUTE'});
    if(body.code!=='Ok'||!Array.isArray(body.routes))throw new Error('RESPONSE');
    const routes=body.routes.slice(0,3).flatMap(r=>{
      const c=r.geometry?.coordinates;
      if(!Array.isArray(c)||c.length<2||c.length>30000||!Number.isFinite(r.duration)||r.duration<0||!Number.isFinite(r.distance)||r.distance<0||r.distance>150000||c.some(p=>!Array.isArray(p)||!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>180||Math.abs(p[1])>85))return [];
      return [{distance:r.distance,duration:r.duration,coordinates:c}];
    });
    if(!routes.length)return body.routes.some(r=>r.distance>150000)?res.status(400).json({error:'ROUTE_TOO_LONG'}):res.status(404).json({error:'NO_ROUTE'});
    const value={routes,provider:'OSRM',data:'OpenStreetMap',liveTraffic:false};
    if(cache.size>=60)cache.delete(cache.keys().next().value);cache.set(key,{until:now+300000,value});
    return res.status(200).json(value);
  }catch{return res.status(controller.signal.aborted?504:502).json({error:'ROUTE_UNAVAILABLE'});}
  finally{clearTimeout(timer);}
};
