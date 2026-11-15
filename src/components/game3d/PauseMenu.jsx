import React, {useEffect, useRef, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {
  AudioLines, ChevronRight, DoorOpen, Gamepad2,
  Keyboard, LogOut, Monitor, MousePointerClick, Play, Settings2, Users, MessageSquare, BookOpen,
  ShieldAlert, UserPlus, Volume2, VolumeX, X,
} from 'lucide-react';
import {base44} from '@/api/base44Client';
import {inkPaletteFor} from './render/inkWashLook';
import {getAXEControlSettings, setAXEClickToMoveEnabled, setAXEAutoTargetNearbyEnabled,
  subscribeAXEControlSettings} from './axe/player/AXEControlSettingsStore';
import {GAME3D_PAUSE_SECTIONS,game3dPauseEscape,
  game3dPauseGraphicsDefaults,activateCloneUltraWorldGraphics} from './game3dPauseMenuModel.mjs';
import {readGame3DCommunityHUD,saveGame3DCommunityHUD,GAME3D_COMMUNITY_HUD_EVENT}
  from './hud/game3dCommunityHUDSettings.mjs';
import {RENDER_STATS_STORAGE_KEY,isRenderStatsEnabled} from './debug/renderStats';
import {CLONE_GPU_PROFILE_KEY,CLONE_GPU_PROFILES,readCloneGPUProfile,
  normalizeCloneGPUProfile} from './performance/AdaptiveGraphics.mjs';
import './PauseMenu.css';

const MENU_ICONS={overview:Gamepad2,audio:AudioLines,controls:Keyboard,
  graphics:Monitor,community:Users,session:DoorOpen};
const PRESET_QUALITY=['low','medium','high','ultra'];
const FPS_CAPS=[30,60,120,144];
const CONTROL_KEYS=[
  {keys:'W A S D',action:'Move your character'},
  {keys:'Space',action:'Jump'},
  {keys:'R',action:'Forward roll (uses dodge stamina)'},
  {keys:'Double-tap WASD',action:'Directional dodge (uses dodge stamina)'},
  {keys:'Mouse',action:'Look and aim'},
  {keys:'Middle-click',action:'Manually lock onto or release a target'},
  {keys:'E',action:'Interact with the world'},
  {keys:'TAB',action:'Open the store'},
  {keys:'C',action:'Character hub'},
  {keys:'ESC',action:'Open or close the world menu'},
];

function OptionButtons({label,items,value,onPick}){
  return <fieldset className="axe3d-pause__setting">
    <legend>{label}</legend>
    <div className="axe3d-pause__option-group">
      {items.map(({id,text})=>
        <button type="button" key={id} aria-pressed={value===id}
          onClick={()=>onPick(id)}
          className={value===id?'axe3d-pause__option is-selected':'axe3d-pause__option'}>
          {text}
        </button>)}
    </div>
  </fieldset>;
}
function Switch({checked,onChange,label,description}){
  return <div className="axe3d-pause__switch-row">
    <div><strong>{label}</strong><p>{description}</p></div>
    <button type="button" className="axe3d-pause__switch" role="switch"
      aria-checked={!!checked} aria-label={label} onClick={onChange}>
      <span className="axe3d-pause__switch-knob"/>
    </button>
  </div>;
}

export default function PauseMenu({
  open,onClose,volume=0.5,onVolumeChange=()=>{},onReturnToCharacterSelect,onCreateCharacter,
  context='world',motionEnabled,onMotionChange,
}){
  const entry=context==='entry';
  const reduceMotion=typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [view,setView]=useState('overview');
  const [confirmAction,setConfirmAction]=useState(null);
  const [error,setError]=useState('');
  const [controls,setControls]=useState(getAXEControlSettings);
  const [graphics,setGraphics]=useState(()=>{
    try{return activateCloneUltraWorldGraphics(localStorage);}
    catch{return game3dPauseGraphicsDefaults(null);}
  });
  const [community,setCommunity]=useState(()=>readGame3DCommunityHUD());
  const [presence,setPresence]=useState({status:'unknown',count:null,max:20});
  const [gpuStats,setGpuStats]=useState(()=>
    isRenderStatsEnabled(typeof window==='undefined'?'':window.location.search,
      typeof window==='undefined'?null:window.localStorage));
  const [gpuProfile,setGpuProfile]=useState(()=>
    typeof window==='undefined'?'auto':readCloneGPUProfile(window));
  const [menuMotion,setMenuMotion]=useState(()=>{
    try{return localStorage.getItem('game3d_menu_motion')!=='false';}
    catch{return true;}
  });
  const shouldAnimate=menuMotion&&!reduceMotion;
  const availableSections=entry
    ?GAME3D_PAUSE_SECTIONS.filter(section=>section.id!=='session')
    :GAME3D_PAUSE_SECTIONS;
  const updateMotion=next=>{
    const enabled=!!next;
    setMenuMotion(enabled);
    try{localStorage.setItem('game3d_menu_motion',String(enabled));}catch{}
    onMotionChange?.(enabled);
  };
  useEffect(()=>{
    if(open&&typeof motionEnabled==='boolean')setMenuMotion(motionEnabled);
  },[open,motionEnabled]);
  const resumeRef=useRef(null);
  const dialogRef=useRef(null);
  const lastVolumeRef=useRef(volume>0?volume:.5);

  useEffect(()=>subscribeAXEControlSettings(setControls),[]);
  useEffect(()=>{
    const onPresence=event=>setPresence(event?.detail||{status:'unknown',count:null,max:20});
    window.addEventListener('game3dWorldPresence',onPresence);
    if(window.__game3dWorldPresence)setPresence(window.__game3dWorldPresence);
    return ()=>window.removeEventListener('game3dWorldPresence',onPresence);
  },[]);
  useEffect(()=>{
    if(!open){setView('overview');setConfirmAction(null);setError('');return;}
    // A true MMO menu keeps the shared world running. It only blocks local
    // combat/movement input, so the hero never attacks behind the controls.
    window.__axePauseMenuOpen=true;
    window.dispatchEvent(new Event('axePauseMenuOpened'));
    if(document.pointerLockElement)document.exitPointerLock?.();
    setCommunity(readGame3DCommunityHUD());
    setGpuStats(isRenderStatsEnabled(window.location.search,window.localStorage));
    setGpuProfile(readCloneGPUProfile(window));
    // Refresh the same graphics settings written from either entry or in-world.
    try{setGraphics(activateCloneUltraWorldGraphics(localStorage));}
    catch{setGraphics(game3dPauseGraphicsDefaults(null));}
    resumeRef.current?.focus();
    return ()=>{window.__axePauseMenuOpen=false;};
  },[open]);

  useEffect(()=>{
    if(!open)return;
    // Capture before GameView/GameWorld's bubbling hotkeys, including when
    // focus is on a range input. ESC first backs out of nested pages.
    const onEscape=event=>{
      if(event.key==='Tab'){
        // A visible MMO menu owns keyboard focus; Tab must never wander
        // into the live game HUD behind its full-screen modal.
        const focusables=Array.from(dialogRef.current?.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )||[]).filter(element=>element.getClientRects().length>0);
        if(focusables.length){
          const first=focusables[0],last=focusables[focusables.length-1];
          const outside=!dialogRef.current.contains(document.activeElement);
          if(event.shiftKey&&(document.activeElement===first||outside)){
            event.preventDefault();last.focus();
          }else if(!event.shiftKey&&(document.activeElement===last||outside)){
            event.preventDefault();first.focus();
          }
        }
        return;
      }
      // Console-style keyboard navigation of the left/top text rail.
      if((event.key==='ArrowDown'||event.key==='ArrowUp'||event.key==='Home'||event.key==='End')
        &&event.target?.closest?.('.axe3d-pause__rail')){
        const buttons=Array.from(dialogRef.current?.querySelectorAll(
          '.axe3d-pause__rail button:not([disabled])')||[]);
        const i=buttons.indexOf(document.activeElement);
        if(buttons.length){
          const next=event.key==='Home'?0:event.key==='End'?buttons.length-1
            :(Math.max(0,i)+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;
          event.preventDefault();event.stopImmediatePropagation();buttons[next].focus();
        }
        return;
      }
      if(event.key!=='Escape'||event.repeat)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const next=game3dPauseEscape(view,confirmAction);
      setConfirmAction(next.confirmAction);
      if(next.close)onClose();
      else setView(next.view);
    };
    window.addEventListener('keydown',onEscape,true);
    return ()=>window.removeEventListener('keydown',onEscape,true);
  },[open,view,confirmAction,onClose]);

  const selectView=id=>{setConfirmAction(null);setError('');setView(id);};
  const changeGraphics=next=>{
    const sanitized=game3dPauseGraphicsDefaults(next);
    setGraphics(sanitized);
    try{localStorage.setItem('game_graphics_settings',JSON.stringify(sanitized));}
    catch{/* a private-browser quota error must not break the menu */}
    window.dispatchEvent(new CustomEvent('graphicsSettingsChanged',{detail:sanitized}));
  };
  const changeCommunity=next=>{
    const saved=saveGame3DCommunityHUD(next);
    setCommunity(saved);
    window.dispatchEvent(new CustomEvent(GAME3D_COMMUNITY_HUD_EVENT,{detail:saved}));
  };
  const changeGpuStats=next=>{
    const enabled=!!next;
    setGpuStats(enabled);
    try{localStorage.setItem(RENDER_STATS_STORAGE_KEY,enabled?'1':'0');}catch{}
    window.dispatchEvent(new CustomEvent('game3dRenderStatsChanged',{detail:{enabled}}));
  };
  const changeGpuProfile=next=>{
    const profile=normalizeCloneGPUProfile(next);
    setGpuProfile(profile);
    try{localStorage.setItem(CLONE_GPU_PROFILE_KEY,profile);}catch{}
    window.__axe3dCloneGovernor?.setProfile?.(profile);
    window.dispatchEvent(new CustomEvent('game3dCloneGPUProfileChanged',{detail:{profile}}));
  };
  const changeVolume=value=>{
    const next=Math.max(0,Math.min(1,Number(value)||0));
    if(next>0)lastVolumeRef.current=next;
    onVolumeChange(next);
  };
  const executeSessionAction=async()=>{
    const action=confirmAction;
    setConfirmAction(null);
    if(action==='create'){
      if(typeof onCreateCharacter==='function')onCreateCharacter();
      else setError('Character creation is not available in this session.');
    }else if(action==='character'){
      if(typeof onReturnToCharacterSelect==='function')onReturnToCharacterSelect();
      else setError('Character selection is not available in this session.');
    }else if(action==='logout'){
      try{await base44.auth.logout();}
      catch(e){
        setError('Sign out failed. Your session is still active.');
        console.error('Game 3D logout failed:',e);
      }
    }
  };

  const heading={
    overview:entry?['Game Settings','Adjust your experience before entering Wolfveil']
      :['Journey Menu','Your adventure is still running'],
    audio:['Audio','Adjust your game theme'],
    controls:['Controls','Choose how you move through the world'],
    graphics:['Graphics & Display','Tune the world to your device'],
    community:['HUD & Community','Choose which social elements appear while you play'], 
    session:['Session','Manage your character and account'],
  }[view]||['Journey Menu','Your adventure is still running'];

  return <AnimatePresence>
    {open&&<motion.div className="axe3d-pause__overlay" data-context={context}
      data-motion={shouldAnimate?'on':'off'}
      initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      transition={{duration:shouldAnimate?.15:0}}>
      <motion.section ref={dialogRef} role="dialog" aria-modal="true" aria-label={entry?'Game 3D title settings':'Game 3D world menu'}
        className="axe3d-pause__panel"
        initial={{opacity:0,scale:.97,y:16}} animate={{opacity:1,scale:1,y:0}}
        exit={{opacity:0,scale:.98,y:12}} transition={{duration:shouldAnimate?.18:0}}>
        <div className="axe3d-pause__topline"/>
        <header className="axe3d-pause__header">
          <div className="axe3d-pause__identity">
            <div className="axe3d-pause__crest"><Gamepad2 aria-hidden="true" size={23}/></div>
            <div>
              <span className="axe3d-pause__eyebrow">ATOM X EVE / GAME 3D</span>
              <h2>{entry?'SETTINGS':'WORLD MENU'}</h2>
            </div>
          </div>
          <div className="axe3d-pause__header-end">
            <span className="axe3d-pause__online"><span/> {entry?'TITLE SCREEN':'WORLD ACTIVE'}</span>
            <button type="button" className="axe3d-pause__icon-button"
              onClick={onClose} aria-label={entry?"Close settings":"Resume game"} title={entry?"Close settings":"Resume game"}><X size={20}/></button>
          </div>
        </header>
        <div className="axe3d-pause__body">
          <nav className="axe3d-pause__rail axe3d-pause__scroller" aria-label="World menu navigation">
            <span className="axe3d-pause__rail-label">{entry?'TITLE':'ADVENTURE'}</span>
            <button ref={resumeRef} type="button" className="axe3d-pause__resume" onClick={onClose}>
              <Play size={17} fill="currentColor"/> {entry?'Back to Title':'Continue Game'} <span className="axe3d-pause__keycap">ESC</span>
            </button>
            <div className="axe3d-pause__rail-separator"/>
            <span className="axe3d-pause__rail-label">OPTIONS</span>
            {availableSections.map(section=>{
              const Icon=MENU_ICONS[section.id],active=view===section.id;
              return <button key={section.id} type="button" aria-current={active?'page':undefined}
                onClick={()=>selectView(section.id)}
                className={active?'axe3d-pause__nav-item is-selected':'axe3d-pause__nav-item'}>
                <Icon size={19} aria-hidden="true"/><span>{section.label}</span>
                <ChevronRight size={15} aria-hidden="true"/>
              </button>;
            })}
            <div className="axe3d-pause__rail-note">
              <span className="axe3d-pause__rail-note-dot"/>
              Connected world
              <small>The game world continues while this menu is open.</small>
            </div>
          </nav>
          <div className="axe3d-pause__content axe3d-pause__scroller" key={view}>
            <div className="axe3d-pause__section-head">
              <div>
                <span className="axe3d-pause__eyebrow">SYSTEM / {view.toUpperCase()}</span>
                <h3>{heading[0]}</h3>
                <p>{heading[1]}</p>
              </div>
              <Settings2 size={25} aria-hidden="true" className="axe3d-pause__heading-glyph"/>
            </div>
            {confirmAction? <div className="axe3d-pause__confirm" role="alertdialog"
              aria-modal="true" aria-label="Confirm session action">
              <ShieldAlert size={35} aria-hidden="true"/>
              <h4>{confirmAction==='logout'?'Sign out of Atom X Eve?':confirmAction==='create'?'Create a new character?':'Return to character selection?'}</h4>
              <p>{confirmAction==='logout'
                ?'You will leave the current online session and sign out of this account.'
                :confirmAction==='create'?'You will leave the current Game 3D world and open the character creator. Your existing character remains saved.':'You will leave the current Game 3D world and return to character selection.'}</p>
              <div className="axe3d-pause__confirm-actions">
                <button type="button" className="axe3d-pause__secondary" onClick={()=>setConfirmAction(null)}>Stay in game</button>
                <button type="button" className="axe3d-pause__danger" onClick={executeSessionAction}>
                  Confirm {confirmAction==='logout'?'sign out':'leave world'}</button>
              </div>
            </div> : <>
              {view==='overview'&&<>
                <div className="axe3d-pause__hero">
                  <span>WOLFVEIL · {entry?'TITLE SETTINGS':'ADVENTURE'}</span>
                  <h4>{entry?'Prepare your journey.':'The path is yours.'}</h4>
                  <p>{entry?'Audio, graphics and controls use the same saved preferences as the in-game Escape menu.'
                    :'Review your setup, then return to the living world. Other players and world systems are not paused.'}</p>
                  <button type="button" onClick={onClose}>
                    <Play size={18} fill="currentColor"/> {entry?'Return to Title':'Return to World'} <ChevronRight size={17}/>
                  </button>
                </div>
                <div className="axe3d-pause__shortcut-grid">
                  <button type="button" onClick={()=>selectView('graphics')}>
                    <Monitor size={22}/><strong>Display</strong><span>{graphics.quality} quality · {graphics.fpsCap} FPS</span>
                  </button>
                  <button type="button" onClick={()=>selectView('audio')}>
                    <Volume2 size={22}/><strong>Sound</strong><span>Theme at {Math.round(volume*100)}%</span>
                  </button>
                  <button type="button" onClick={()=>selectView('controls')}>
                    <Keyboard size={22}/><strong>Input</strong><span>WASD and mouse</span>
                  </button>
                  <button type="button" onClick={()=>selectView('community')}>
                    <Users size={22}/><strong>Community</strong><span>Chat · Echo · Players</span>
                  </button>
                </div>
              </>}
              {view==='audio'&&<div className="axe3d-pause__surface">
                <div className="axe3d-pause__surface-heading"><Volume2 size={22}/><div><strong>Game Theme</strong><p>Music volume, updated immediately.</p></div></div>
                <div className="axe3d-pause__volume-row">
                  <button type="button" className="axe3d-pause__icon-button" aria-label={volume>0?'Mute game theme':'Unmute game theme'}
                    onClick={()=>changeVolume(volume>0?0:lastVolumeRef.current)}>
                    {volume>0?<Volume2 size={20}/>:<VolumeX size={20}/>}
                  </button>
                  <input type="range" min="0" max="1" step=".01" aria-label="Game theme volume"
                    value={volume} onChange={e=>changeVolume(e.target.value)}/>
                  <output>{Math.round(volume*100)}%</output>
                </div>
                <p className="axe3d-pause__help">This setting controls the existing theme audio and is saved in your browser.</p>
              </div>}
              {view==='controls'&&<>
                <div className="axe3d-pause__surface">
                  <div className="axe3d-pause__surface-heading"><MousePointerClick size={22}/><div><strong>Movement Options</strong><p>WASD movement remains available at all times.</p></div></div>
                  <Switch label="Click to move" checked={controls.clickToMove}
                    description="Click the ground to walk there. WASD cancels the destination."
                    onChange={()=>setAXEClickToMoveEnabled(!controls.clickToMove)}/>
                  <Switch label="Automatically lock nearby enemies" checked={controls.autoTargetNearby}
                    description="Off by default. Leave off to keep camera and movement independent of enemy spawns; middle-click still locks targets manually."
                    onChange={()=>setAXEAutoTargetNearbyEnabled(!controls.autoTargetNearby)}/>
                  <Switch label="Menu animations" checked={menuMotion}
                    description="Animate the title and Escape menu. Reduced-motion system settings still take precedence."
                    onChange={()=>updateMotion(!menuMotion)}/>
                </div>
                <div className="axe3d-pause__surface">
                  <h4 className="axe3d-pause__subhead">Quick reference</h4>
                  <div className="axe3d-pause__key-grid">
                    {CONTROL_KEYS.map(item=><div key={item.keys}><kbd>{item.keys}</kbd><span>{item.action}</span></div>)}
                  </div>
                </div>
              </>}
              {view==='community'&&<div className="axe3d-pause__settings-grid" data-testid="game3d-community-settings">
                <div className="axe3d-pause__surface">
                  <div className="axe3d-pause__surface-heading">
                    <Users size={22}/><div><strong>World & Community</strong>
                      <p>Keep the game view clear. Multiplayer stays connected when a HUD item is hidden.</p>
                    </div>
                  </div>
                  <Switch label="World and party chat" checked={community.chat}
                    description="Show the compact chat dock. Enter still opens chat when the dock is hidden."
                    onChange={()=>changeCommunity({...community,chat:!community.chat})}/>
                  <Switch label="Echo Chronicle book" checked={community.echo}
                    description="Keep the small book launcher next to the portrait. Incoming conversations remain accessible."
                    onChange={()=>changeCommunity({...community,echo:!community.echo})}/>
                  <Switch label="Players online HUD badge" checked={community.online}
                    description="Show an optional small online count during gameplay. The live count remains here either way."
                    onChange={()=>changeCommunity({...community,online:!community.online})}/>
                  <OptionButtons label="Community UI size" value={community.scale}
                    items={[{id:.75,text:'75%'},{id:1,text:'100%'},{id:1.25,text:'125%'}]}
                    onPick={scale=>changeCommunity({...community,scale})}/>
                </div>
                <div className="axe3d-pause__surface">
                  <div className="axe3d-pause__surface-heading">
                    <MessageSquare size={22}/><div><strong>Online & Conversations</strong>
                      <p>Native community options without another floating settings box.</p>
                    </div>
                  </div>
                  <p className="axe3d-pause__help" role="status">
                    World server: {entry?'available after entering the world':
                      (presence.status==='unknown'?'waiting for current presence':
                        (presence.status+' · '+(Number.isFinite(presence.count)?presence.count:'—')+
                        '/'+(presence.max||20)+' players'))}.
                  </p>
                  {!entry&&<div className="axe3d-pause__shortcut-grid">
                    <button type="button" onClick={()=>{
                      onClose();window.dispatchEvent(new Event('game3dOpenWorldChat'));
                    }}><MessageSquare size={20}/><strong>Open Chat</strong><span>World / Party</span></button>
                    <button type="button" onClick={()=>{
                      onClose();window.dispatchEvent(new Event('game3dOpenEchoChronicle'));
                    }}><BookOpen size={20}/><strong>Open Echo</strong><span>Memory book</span></button>
                  </div>}
                </div>
              </div>}
              {view==='graphics'&&<div className="axe3d-pause__settings-grid">
                <div className="axe3d-pause__surface">
                  <OptionButtons label="Visual style" value={graphics.artStyle}
                    items={[{id:'original',text:'Classic'},{id:'ink',text:'Sumi-e Ink Wash'},
                      {id:'atomic-ultra-sumi',text:'ULTRA MAX · Living Ultra-Sumi'}]}
                    onPick={artStyle=>changeGraphics({...graphics,artStyle})}/>
                  {graphics.artStyle==='atomic-ultra-sumi'&&<p className="axe3d-pause__help">
                      ON by default in the clone: world-wide living-energy grass, flowing
                      jade/cobalt/violet Sumi-e tree material and 3× taller flame blades.
                      Existing character, roads, buildings and terrain keep their colors.
                      No full-screen white bloom or duplicate game physics.
                    </p>}
                  {graphics.artStyle==='ink'&&<>
                    <OptionButtons label="Ink color profile" value={inkPaletteFor(graphics)}
                      items={[{id:'vibrant',text:'Vibrant Color'},{id:'classic',text:'Classic Ink'}]}
                      onPick={inkPalette=>changeGraphics({...graphics,inkPalette})}/>
                    <p className="axe3d-pause__help">Brush detail follows the selected quality preset.</p>
                  </>}
                </div>
                <div className="axe3d-pause__surface">
                  <OptionButtons label="Quality preset" value={graphics.quality}
                    items={PRESET_QUALITY.map(id=>({id,text:id.charAt(0).toUpperCase()+id.slice(1)}))}
                    onPick={quality=>changeGraphics({...graphics,quality})}/>
                  <Switch label="Dynamic Shadows" checked={graphics.shadows}
                    description="Enable real-time shadows in the 3D world."
                    onChange={()=>changeGraphics({...graphics,shadows:!graphics.shadows})}/>
                </div>
                <div className="axe3d-pause__surface">
                  <OptionButtons label="Frame rate cap" value={graphics.fpsCap}
                    items={FPS_CAPS.map(id=>({id,text:id+' FPS'}))}
                    onPick={fpsCap=>changeGraphics({...graphics,fpsCap})}/>
                  <OptionButtons label="GPU render profile" value={gpuProfile}
                    items={CLONE_GPU_PROFILES.map(id=>({id,text:id==='auto'?'Auto':id==='off'?'Disable adaptive scaling':id.charAt(0).toUpperCase()+id.slice(1)}))}
                    onPick={changeGpuProfile}/>
                  <p className="axe3d-pause__help">Controls the clone renderer's adaptive resolution. No GPU model or VRAM total is inferred.</p>
                  <Switch label="Performance metrics (FPS / GPU / CPU)" checked={gpuStats}
                    description="Show the optional rendering diagnostics during gameplay. GPU timing is displayed only when the browser supports it."
                    onChange={()=>changeGpuStats(!gpuStats)}/>
                  <p className="axe3d-pause__help">Graphics changes are saved and applied to the existing renderer.</p>
                </div>
              </div>}
              {view==='session'&&!entry&&<div className="axe3d-pause__surface">
                <h4 className="axe3d-pause__subhead">Leave the world</h4>
                <p className="axe3d-pause__help">These actions end your current viewing session. They will not pause the online world.</p>
                {typeof onCreateCharacter==='function'&&<button type="button" className="axe3d-pause__session-action"
                  onClick={()=>setConfirmAction('create')}>
                  <UserPlus size={22}/><span><strong>Create Character</strong><small>Open the Game 3D character creator</small></span><ChevronRight size={18}/>
                </button>}
                <button type="button" className="axe3d-pause__session-action"
                  onClick={()=>setConfirmAction('character')}>
                  <DoorOpen size={22}/><span><strong>Character Selection</strong><small>Return to the character login screen</small></span><ChevronRight size={18}/>
                </button>
                <button type="button" className="axe3d-pause__session-action axe3d-pause__session-danger"
                  onClick={()=>setConfirmAction('logout')}>
                  <LogOut size={22}/><span><strong>Sign Out</strong><small>Log out of Atom X Eve</small></span><ChevronRight size={18}/>
                </button>
              </div>}
            </>}
            {error&&<p className="axe3d-pause__error" role="alert">{error}</p>}
          </div>
        </div>
        <footer className="axe3d-pause__footer">
          <span><span className="axe3d-pause__footer-spark"/> GAME 3D · {entry?'TITLE SETTINGS':'ONLINE WORLD'}</span>
          <span><kbd>ESC</kbd> {confirmAction?'Cancel':view==='overview'?(entry?'Close':'Resume'):'Back to main menu'}</span>
        </footer>
      </motion.section>
    </motion.div>}
  </AnimatePresence>;
}
