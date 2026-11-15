import {createClientFromRequest} from 'npm:@base44/sdk@0.8.23';
import {miniGameById,miniGameReadiness,miniGameEventOpen,validMiniGameRole}
  from '../../shared/game3dMiniGameCatalog.mjs';

const HEADERS={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{...HEADERS,'Content-Type':'application/json'},
});
const reject=(error:string,status=400)=>json({error},status);
const fourHours=4*60*60_000;
const cleanName=(value:unknown)=>String(value||'Player')
  .replace(/\p{Cc}/gu,' ').trim().slice(0,64);

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:HEADERS});
  if(req.method!=='POST')return reject('Unsupported request',405);
  try{
    const app=createClientFromRequest(req);
    const user=await app.auth.me();
    if(!user?.id)return reject('Sign in to use Mini Games',401);
    const svc=app.asServiceRole.entities;
    const me=String(user.id);
    const body=await req.json().catch(()=>({}));
    const action=String(body.action||'list');
    const data=body.data||{};
    const now=Date.now(),iso=new Date(now).toISOString();
    const entries=async id=>(await svc.Game3DMiniRSVP.filter(
      {event_id:String(id)},'-created_date',120))||[];
    const summary=async row=>{
      const game=miniGameById(row.game_id);
      if(!game)return null;
      const rsvps=await entries(row.id);
      const count=miniGameReadiness(game.id,rsvps);
      const mine=rsvps.find((r:any)=>r.user_id===me&&r.status==='active');
      return{
        id:row.id,gameId:game.id,hostName:row.host_name||'Player',
        hostId:row.host_id,expiresAt:row.expires_at,
        state:!miniGameEventOpen(row,now)?'closed':count.ready?'ready':'open',
        players:count.players,spectators:count.spectators,
        needed:count.remaining,minPlayers:game.minPlayers,maxPlayers:game.maxPlayers,
        myRole:mine?.role||null,
        // Intentionally no 'playing', server result, reward or tournament win
        // until separate authoritative game-specific gameplay is implemented.
      };
    };
    if(action==='list'){
      const rows=await svc.Game3DMiniEvent.filter({status:'open'},'-created_date',50);
      const available=(rows||[]).filter((row:any)=>miniGameEventOpen(row,now)).slice(0,24);
      const events=(await Promise.all(available.map(summary))).filter(Boolean);
      return json({success:true,events});
    }
    if(action==='create'){
      const game=miniGameById(data.gameId);
      if(!game)return reject('Select an available mini game');
      const recent=await svc.Game3DMiniEvent.filter({host_id:me},'-created_date',30);
      const open=(recent||[]).filter((row:any)=>miniGameEventOpen(row,now));
      if(open.length>=3)return reject('You already host three open events',429);
      if(open.some((row:any)=>row.game_id===game.id))
        return reject('You already have an open event for this game',409);
      if((recent||[]).some((row:any)=>now-Date.parse(row.created_at||row.created_date||0)<8000))
        return reject('Wait a moment before creating another event',429);
      const event=await svc.Game3DMiniEvent.create({
        game_id:game.id,host_id:me,
        host_name:cleanName(user.full_name||user.username),
        status:'open',created_at:iso,expires_at:new Date(now+fourHours).toISOString(),
      });
      await svc.Game3DMiniRSVP.create({
        event_id:event.id,user_id:me,display_name:cleanName(user.full_name||user.username),
        role:'player',status:'active',joined_at:iso,
      });
      return json({success:true,event:await summary(event)});
    }
    const id=String(data.eventId||'').trim();
    if(!id || id.length>128)return reject('Select an event');
    const event=await svc.Game3DMiniEvent.get(id).catch(()=>null);
    if(!event)return reject('Event not found',404);
    if(action==='cancel'){
      if(event.host_id!==me)return reject('Only the host can cancel',403);
      if(event.status==='open')await svc.Game3DMiniEvent.update(event.id,{status:'cancelled'});
      return json({success:true,cancelled:true,eventId:id});
    }
    if(!miniGameEventOpen(event,now))return reject('This signup has closed',409);
    const rsvps=await entries(id);
    const mine=rsvps.find((r:any)=>r.user_id===me);
    if(action==='leave'){
      if(mine?.status==='active')
        await svc.Game3DMiniRSVP.update(mine.id,{status:'left'});
      return json({success:true,event:await summary(event)});
    }
    if(action==='rsvp'){
      const role=String(data.role||'');
      if(!validMiniGameRole(role))return reject('Choose player or spectator');
      const otherActive=rsvps.filter((r:any)=>r.status==='active'&&r.user_id!==me);
      const count=miniGameReadiness(event.game_id,otherActive);
      const game=miniGameById(event.game_id);
      if(role==='player'&&count.players>=game.maxPlayers)return reject('Player places are full',409);
      if(role==='spectator'&&count.spectators>=64)return reject('Spectator places are full',409);
      const patch={display_name:cleanName(user.full_name||user.username),
        role,status:'active',joined_at:iso};
      if(mine)await svc.Game3DMiniRSVP.update(mine.id,patch);
      else await svc.Game3DMiniRSVP.create({event_id:id,user_id:me,...patch});
      return json({success:true,event:await summary(event)});
    }
    return reject('Unknown Mini Games action',400);
  }catch(err){
    console.error('[Game3D Mini Games]',err);
    return reject('Mini Games service unavailable. Try again later.',503);
  }
});
