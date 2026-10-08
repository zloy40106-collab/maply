'use strict';
(() => {
  const BASE='id,user_id,type,title,description,lat,lng,created_at,expires_at,active_votes,gone_votes,hidden_by_votes';
  const EXTRA=',updated_at,reports_count,is_verified,last_confirmed_at,happening_now';
  const wrap = n => ((n+180)%360+360)%360-180;
  function create(getDb) {
    let features={extended:false,reports:false,photos:false,notifications:false,deleteAccount:false};
    const db=()=>{const value=getDb();if(!value) throw new Error('MAPLY_NOT_READY');return value;};
    const check=result=>{if(result.error) throw result.error;return result.data;};
    async function detect() {
      const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),10000);
      try{const result=await db().rpc('maply_capabilities').abortSignal(ac.signal);
        if (!result.error && result.data?.version === 1) features={...features,...result.data};
        return {...features};
      }finally{clearTimeout(timer);}
    }
    async function load(bounds,userId,signal) {
      let q=db().from('maply_markers').select(BASE+(features.extended?EXTRA:''))
        .eq('hidden_by_votes',false).gt('expires_at',new Date().toISOString())
        .gte('lat',Math.max(-85.05112878,bounds.getSouth())).lte('lat',Math.min(85.05112878,bounds.getNorth()));
      if(bounds.getEast()-bounds.getWest()<360) {
        const west=wrap(bounds.getWest()),east=wrap(bounds.getEast());
        q=west<=east?q.gte('lng',west).lte('lng',east):q.or(`lng.gte.${west},lng.lte.${east}`);
      }
      const pins=check(await q.order('created_at',{ascending:false}).limit(500).abortSignal(signal))||[];
      let votes=[];
      if(userId && pins.length) votes=check(await db().from('maply_votes').select('marker_id,vote')
        .eq('user_id',userId).in('marker_id',pins.map(p=>p.id)).abortSignal(signal))||[];
      const own=new Map(votes.map(v=>[v.marker_id,v.vote]));
      return pins.map(p=>({...p,my_vote:own.get(p.id)||null}));
    }
    async function publish(input) {
      const payload={user_id:input.user_id,type:input.type,title:input.title,description:input.description,lat:input.lat,lng:wrap(input.lng)};
      if(features.extended) payload.happening_now=input.happening_now !== false;
      const rows=check(await db().from('maply_markers').insert(payload).select(BASE+(features.extended?EXTRA:'')));
      return rows?.[0] || null;
    }
    async function vote(id,value) {return check(await db().rpc('maply_vote',{p_marker_id:id,p_vote:value}));}
    async function remove(id,userId) {return check(await db().from('maply_markers').delete().eq('id',id).eq('user_id',userId).select('id'));}
    async function report(id,reason,details) {
      if(!features.reports) throw new Error('MAPLY_REPORT_NOT_READY');
      return check(await db().rpc('maply_report',{p_marker_id:id,p_reason:reason,p_details:details}));
    }
    async function mine(userId,mode,signal) {
      let ids;
      if(mode==='votes') {
        const votes=check(await db().from('maply_votes').select('marker_id').eq('user_id',userId).eq('vote','active').order('updated_at',{ascending:false}).limit(100).abortSignal(signal))||[];
        ids=votes.map(v=>v.marker_id);if(!ids.length)return [];
      }
      let q=db().from('maply_markers').select(BASE+(features.extended?EXTRA:''))
        .eq('hidden_by_votes',false).gt('expires_at',new Date().toISOString());
      q=ids?q.in('id',ids):q.eq('user_id',userId);
      return check(await q.order('created_at',{ascending:false}).limit(100).abortSignal(signal))||[];
    }
    // TODO: implement these through an authenticated server API and Storage policies.
    async function uploadPhoto() {throw new Error('MAPLY_PHOTO_NOT_READY');}
    async function deleteAccount() {throw new Error('MAPLY_DELETE_ACCOUNT_NOT_READY');}
    return {detect,features:()=>({...features}),load,publish,vote,remove,report,mine,uploadPhoto,deleteAccount};
  }
  window.MaplyAPI={create};
})();
