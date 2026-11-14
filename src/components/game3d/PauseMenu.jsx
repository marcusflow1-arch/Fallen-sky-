import React, {useEffect, useRef, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {
  AudioLines, ChevronRight, DoorOpen, Gamepad2,
  Keyboard, LogOut, Monitor, MousePointerClick, Play, Settings2,
  ShieldAlert, UserPlus, Volume2, VolumeX, X,
} from 'lucide-react';
import {base44} from '@/api/base44Client';
import {inkPaletteFor} from './render/inkWashLook';
import {getAXEControlSettings, setAXEClickToMoveEnabled, setAXEAutoTargetNearbyEnabled,
  subscribeAXEControlSettings} from './axe/player/AXEControlSettingsStore';
import {GAME3D_PAUSE_SECTIONS,game3dPauseEscape,
  game3dPauseGraphicsDefaults} from './game3dPauseMenuModel.mjs';
import './PauseMenu.css';

const MENU_ICONS={overview:Gamepad2,audio:AudioLines,controls:Keyboard,
  graphics:Monitor,session:DoorOpen};
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
}){
  const [view,setView]=useState('overview');
  const [confirmAction,setConfirmAction]=useState(null);
  const [error,setError]=useState('');
  const [controls,setControls]=useState(getAXEControlSettings);
  const [graphics,setGraphics]=useState(()=>{
    let saved=null;
    try{saved=JSON.parse(localStorage.getItem('game_graphics_settings')||'null');}
    catch{/* local settings may be unavailable */}
    return game3dPauseGraphicsDefaults(saved);
  });
  const resumeRef=useRef(null);
  const dialogRef=useRef(null);
  const lastVolumeRef=useRef(volume>0?volume:.5);

  useEffect(()=>subscribeAXEControlSettings(setControls),[]);
  useEffect(()=>{
    if(!open){setView('overview');setConfirmAction(null);setError('');return;}
    // A true MMO menu keeps the shared world running. It only blocks local
    // combat/movement input, so the hero never attacks behind the controls.
    window.__axePauseMenuOpen=true;
    window.dispatchEvent(new Event('axePauseMenuOpened'));
    if(document.pointerLockElement)document.exitPointerLock?.();
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
    overview:['Journey Menu','Your adventure is still running'],
    audio:['Audio','Adjust your game theme'],
    controls:['Controls','Choose how you move through the world'],
    graphics:['Graphics & Display','Tune the world to your device'],
    session:['Session','Manage your character and account'],
  }[view]||['Journey Menu','Your adventure is still running'];

  return <AnimatePresence>
    {open&&<motion.div className="axe3d-pause__overlay"
      initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      transition={{duration:.15}}>
      <motion.section ref={dialogRef} role="dialog" aria-modal="true" aria-label="Game 3D world menu"
        className="axe3d-pause__panel"
        initial={{opacity:0,scale:.97,y:16}} animate={{opacity:1,scale:1,y:0}}
        exit={{opacity:0,scale:.98,y:12}} transition={{duration:.18}}>
        <div className="axe3d-pause__topline"/>
        <header className="axe3d-pause__header">
          <div className="axe3d-pause__identity">
            <div className="axe3d-pause__crest"><Gamepad2 aria-hidden="true" size={23}/></div>
            <div>
              <span className="axe3d-pause__eyebrow">ATOM X EVE / GAME 3D</span>
              <h2>WORLD MENU</h2>
            </div>
          </div>
          <div className="axe3d-pause__header-end">
            <span className="axe3d-pause__online"><span/> WORLD ACTIVE</span>
            <button type="button" className="axe3d-pause__icon-button"
              onClick={onClose} aria-label="Resume game" title="Resume game"><X size={20}/></button>
          </div>
        </header>
        <div className="axe3d-pause__body">
          <nav className="axe3d-pause__rail axe3d-pause__scroller" aria-label="World menu navigation">
            <span className="axe3d-pause__rail-label">ADVENTURE</span>
            <button ref={resumeRef} type="button" className="axe3d-pause__resume" onClick={onClose}>
              <Play size={17} fill="currentColor"/> Continue Game <span className="axe3d-pause__keycap">ESC</span>
            </button>
            <div className="axe3d-pause__rail-separator"/>
            <span className="axe3d-pause__rail-label">OPTIONS</span>
            {GAME3D_PAUSE_SECTIONS.map(section=>{
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
                  <span>WOLFVEIL · ADVENTURE</span>
                  <h4>The path is yours.</h4>
                  <p>Review your setup, then return to the living world. Other players and world systems are not paused.</p>
                  <button type="button" onClick={onClose}>
                    <Play size={18} fill="currentColor"/> Return to World <ChevronRight size={17}/>
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
                </div>
                <div className="axe3d-pause__surface">
                  <h4 className="axe3d-pause__subhead">Quick reference</h4>
                  <div className="axe3d-pause__key-grid">
                    {CONTROL_KEYS.map(item=><div key={item.keys}><kbd>{item.keys}</kbd><span>{item.action}</span></div>)}
                  </div>
                </div>
              </>}
              {view==='graphics'&&<div className="axe3d-pause__settings-grid">
                <div className="axe3d-pause__surface">
                  <OptionButtons label="Visual style" value={graphics.artStyle}
                    items={[{id:'ink',text:'Sumi-e Ink Wash'},{id:'original',text:'Original'}]}
                    onPick={artStyle=>changeGraphics({...graphics,artStyle})}/>
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
                  <p className="axe3d-pause__help">Graphics changes are saved and applied to the existing renderer.</p>
                </div>
              </div>}
              {view==='session'&&<div className="axe3d-pause__surface">
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
          <span><span className="axe3d-pause__footer-spark"/> GAME 3D · ONLINE WORLD</span>
          <span><kbd>ESC</kbd> {confirmAction?'Cancel':view==='overview'?'Resume':'Back to main menu'}</span>
        </footer>
      </motion.section>
    </motion.div>}
  </AnimatePresence>;
}
