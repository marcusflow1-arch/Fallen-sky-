import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Trophy,X,Users,Eye,Plus,RefreshCcw,CalendarDays,ShieldCheck} from 'lucide-react';
import {MINI_GAMES,miniGameById} from '../../../../base44/shared/game3dMiniGameCatalog.mjs';
import {callGameServer} from '../social/socialServer';
import MiniGameArenaPreview from './MiniGameArenaPreview';
import './MiniGamesHub.css';

// Opt-in social lobby and procedural arena preview, NOT a live match engine.
// Only the authenticated backend can create an RSVP/advertised event.
// No fake opponents, local-only multiplayer counts, wins, or rewards.
export default function MiniGamesHub({userId,suppressed=false,showLauncher=true}){
  const [open,setOpen]=useState(false);
  const dialogRef=useRef(null);
  const [gameId,setGameId]=useState('basketball');
  const [events,setEvents]=useState([]);
  const [busy,setBusy]=useState('');
  const [notice,setNotice]=useState('');
  const [loading,setLoading]=useState(false);
  const game=miniGameById(gameId);
  const gameEvents=useMemo(()=>events.filter(item=>item.gameId===gameId),[events,gameId]);
  const refresh=useCallback(async()=>{
    if(!userId)return;
    try{
      const response=await callGameServer('game3dMiniGames','list');
      setEvents(Array.isArray(response.events)?response.events:[]);
      setNotice(old=>old.startsWith('Unable to load')?'':old);
    }catch(error){
      setNotice('Unable to load event lobbies: '+(error?.message||'Service unavailable'));
    }finally{setLoading(false)}
  },[userId]);
  useEffect(()=>{
    if(suppressed)setOpen(false);
  },[suppressed]);
  useEffect(()=>{
    if(!open)return undefined;
    const prior=Boolean(window.__axeUiModalOpen);
    window.__axeUiModalOpen=true;
    window.__axeMiniGamesOpen=true;
    document.exitPointerLock?.();
    dialogRef.current?.querySelector('button[aria-label="Close Mini Games"]')?.focus();
    const esc=event=>{
      if(event.key==='Tab'){
        const focusables=[...(dialogRef.current?.querySelectorAll(
          'button:not(:disabled),[href],input:not(:disabled),[tabindex]:not([tabindex="-1"])')||[])];
        if(focusables.length){
          const first=focusables[0],last=focusables[focusables.length-1];
          if(event.shiftKey&&document.activeElement===first){
            event.preventDefault();last.focus();
          }else if(!event.shiftKey&&document.activeElement===last){
            event.preventDefault();first.focus();
          }
        }
        return;
      }
      if(event.key!=='Escape')return;
      event.preventDefault();event.stopImmediatePropagation?.();
      setOpen(false);
    };
    window.addEventListener('keydown',esc,true);
    return ()=>{
      window.removeEventListener('keydown',esc,true);
      window.__axeMiniGamesOpen=false;
      // Preserve a modal flag that already belonged to another screen.
      if(!prior)window.__axeUiModalOpen=false;
    };
  },[open]);
  useEffect(()=>{
    if(!open||!userId)return undefined;
    setLoading(true);
    void refresh();
    const timer=window.setInterval(()=>void refresh(),10000);
    return ()=>window.clearInterval(timer);
  },[open,userId,refresh]);
  const run=async(action,data={})=>{
    if(busy||!userId)return;
    setBusy(action);setNotice('');
    try{
      const response=await callGameServer('game3dMiniGames',action,data);
      if(action==='create')setNotice('Lobby created. Other players can now sign up.');
      if(action==='rsvp')setNotice(data.role==='spectator'
        ?'Spectator place reserved. Live camera viewing awaits match implementation.'
        :'Your player place is reserved.');
      if(action==='leave')setNotice('You left the event queue.');
      if(action==='cancel')setNotice('Event lobby cancelled.');
      if(response.event && action!=='cancel')
        setEvents(list=>[response.event,...list.filter(item=>item.id!==response.event.id)]);
      await refresh();
    }catch(error){setNotice(error?.message||'Could not update the event');}
    finally{setBusy('')}
  };
  if(!userId)return null;
  return <>
    {!suppressed&&showLauncher&&<button className="axe-minigames-launch" type="button"
      onClick={()=>setOpen(true)} title="Mini Games · sports, board games and player events"
      aria-label="Open Mini Games events" aria-expanded={open}>
      <Trophy size={20}/><span className="sr-only">Mini Games</span>
    </button>}
    {open&&!suppressed&&<div className="axe-minigames-backdrop" onMouseDown={event=>{
      if(event.target===event.currentTarget)setOpen(false);
    }}>
      <section ref={dialogRef} className="axe-minigames-panel" role="dialog" aria-modal="true"
        aria-labelledby="axe-minigames-title">
        <header className="axe-minigames-header">
          <div className="axe-minigames-title">
            <span className="axe-minigames-emblem"><Trophy size={23}/></span>
            <div><small>ATOM X EVE · SOCIAL ARENAS</small>
              <h2 id="axe-minigames-title">Mini Games</h2>
              <p>Choose a game, organize a group, and reserve spectator spots.</p>
            </div>
          </div>
          <button type="button" className="axe-minigames-close" onClick={()=>setOpen(false)}
            aria-label="Close Mini Games"><X size={21}/></button>
        </header>
        <div className="axe-minigames-body">
          <nav className="axe-minigames-catalog" aria-label="Mini Games categories">
            <div className="axe-minigames-eyebrow">CHOOSE AN EVENT</div>
            {MINI_GAMES.map(row=><button key={row.id} type="button"
              className={gameId===row.id?'axe-minigame-option is-selected':'axe-minigame-option'}
              aria-pressed={gameId===row.id} onClick={()=>setGameId(row.id)}>
              <span className="axe-minigame-emoji" aria-hidden="true">{row.icon}</span>
              <span><strong>{row.name}</strong><small>{row.category}</small></span>
              {events.some(item=>item.gameId===row.id)&&<i title="Event lobbies available"/>}
            </button>)}
          </nav>
          <main className="axe-minigames-detail">
            <div className="axe-minigames-detail-head">
              <div><small>{game.category.toUpperCase()}</small><h3>{game.icon} {game.name}</h3>
                <p>{game.description} · {game.minPlayers}–{game.maxPlayers} players per event</p></div>
              <button type="button" disabled={!!busy||loading} onClick={()=>{setLoading(true);void refresh();}}
                title="Refresh event signups" aria-label="Refresh Mini Games events">
                <RefreshCcw size={17}/>
              </button>
            </div>
            <div className="axe-minigames-arena">
              <MiniGameArenaPreview gameId={gameId}/>
              <div className="axe-minigames-arena-caption"><ShieldCheck size={14}/>
                Procedural arena preview · does not modify the main town
              </div>
            </div>
            <div className="axe-minigames-queue-head">
              <div><h4>Player-organized events</h4><small>Events open as soon as someone creates a lobby</small></div>
              <button type="button" className="axe-minigames-create" disabled={!!busy||loading}
                onClick={()=>void run('create',{gameId})}>
                <Plus size={16}/> Host an event
              </button>
            </div>
            {notice&&<p className="axe-minigames-notice" role="status">{notice}</p>}
            <div className="axe-minigames-event-list">
              {loading&&<p className="axe-minigames-empty">Loading available events…</p>}
              {!loading&&gameEvents.length===0&&<p className="axe-minigames-empty">
                No {game.name} lobbies yet. Host one and invite other players to sign up.
              </p>}
              {!loading&&gameEvents.map(event=><article className="axe-minigames-event" key={event.id}>
                <div className="axe-minigames-event-info">
                  <strong>{event.hostName}'s {game.name} lobby</strong>
                  <div><Users size={14}/>{event.players} / {event.maxPlayers} players
                    <span>· {event.spectators} spectators</span></div>
                  <div className="axe-minigames-event-meta">
                    <CalendarDays size={13}/>
                    {event.state==='ready'?'Minimum players reached · arena setup pending':
                      event.needed+' more players to become ready'}
                  </div>
                </div>
                <div className="axe-minigames-event-actions">
                  {event.myRole?<button type="button" disabled={!!busy}
                    onClick={()=>void run('leave',{eventId:event.id})}>
                    Leave {event.myRole==='spectator'?'spectating':'event'}
                  </button>:<>
                    <button type="button" disabled={!!busy||event.players>=event.maxPlayers}
                      onClick={()=>void run('rsvp',{eventId:event.id,role:'player'})}>Join</button>
                    <button type="button" disabled={!!busy} onClick={()=>void run('rsvp',{eventId:event.id,role:'spectator'})}>
                      <Eye size={14}/> Spectator RSVP
                    </button>
                  </>}
                  {event.hostId===userId&&<button type="button" disabled={!!busy}
                    className="axe-minigames-cancel" onClick={()=>void run('cancel',{eventId:event.id})}>Cancel lobby</button>}
                </div>
              </article>)}
            </div>
          </main>
        </div>
        <footer className="axe-minigames-footer">
          <span>Lobby signup is active once the server function is deployed. Matches, terrain transfers,
            scoring and live spectator cameras are under development.</span>
          <span>ESC · Close</span>
        </footer>
      </section>
    </div>}
  </>;
}
