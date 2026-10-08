'use strict';
// Photon adapter. For a public release configure a managed/private Photon endpoint.
const cache=new Map();let nextRequest=0;
module.exports=async function(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'METHOD_NOT_ALLOWED'});}
  const q=String(req.query.q||'').trim(),lat=Number(req.query.lat),lng=Number(req.query.lng);
  const lang=['tr','ru','en'].includes(req.query.lang)?req.query.lang:'tr';
  if(q.length<3||q.length>100||!Number.isFinite(lat)||Math.abs(lat)>85||!Number.isFinite(lng)||Math.abs(lng)>180)return res.status(400).json({error:'INVALID_SEARCH'});
  const key=JSON.stringify([q.toLowerCase(),lat.toFixed(2),lng.toFixed(2),lang]),now=Date.now(),old=cache.get(key);
  if(old&&old.until>now)return res.status(200).json(old.value);
  if(now<nextRequest){res.setHeader('Retry-After','2');return res.status(429).json({error:'WAIT_AND_RETRY'});}
  nextRequest=now+1100;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
    const base=new URL(process.env.MAPLY_PHOTON_URL||'https://photon.komoot.io/');
    if(base.protocol!=='https:'||base.username||base.password)throw new Error('CONFIG');
    const url=new URL('api/',base.href.endsWith('/')?base.href:base.href+'/');
    url.search=new URLSearchParams({q,lat:String(lat),lon:String(lng),lang,limit:'8',location_bias_scale:'0.15'}).toString();
    const options={signal:controller.signal,headers:{'User-Agent':'Maply/1.0 (+https://maply-ebon.vercel.app)','Accept':'application/json'}};
    let upstream=await fetch(url,options);
    // Photon installations may not have imported the requested language.
    // Retry without forcing it so local place names remain searchable.
    if(upstream.status===400){url.searchParams.delete('lang');upstream=await fetch(url,options);}
    if(!upstream.ok)return res.status(upstream.status===429?429:502).json({error:'SEARCH_UNAVAILABLE'});
    const body=await upstream.json();if(!Array.isArray(body.features))throw new Error('RESPONSE');
    const places=body.features.slice(0,8).flatMap(f=>{
      const c=f.geometry?.coordinates,p=f.properties||{};
      if(!Array.isArray(c)||c.length<2||!Number.isFinite(c[0])||!Number.isFinite(c[1])||Math.abs(c[0])>180||Math.abs(c[1])>85)return [];
      return [{id:String(p.osm_type||'')+String(p.osm_id||''),name:String(p.name||p.street||p.city||q).slice(0,180),address:[p.street,p.housenumber,p.district,p.city,p.state,p.country].filter(Boolean).map(String).join(', ').slice(0,400),lat:c[1],lng:c[0],kind:String(p.osm_value||'place').slice(0,60)}];
    });
    const value={places,provider:'Photon',data:'OpenStreetMap'};
    if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,{until:now+600000,value});
    return res.status(200).json(value);
  }catch{return res.status(controller.signal.aborted?504:502).json({error:'SEARCH_UNAVAILABLE'});}
  finally{clearTimeout(timer);}
};
