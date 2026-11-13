// Shared full-screen creator layout: the 3D character fills the screen, a thin
// rail of category glyphs sits on the edge, and one floating liquid-glass panel
// holds the active category. Used by the account creator (AvatarAppearanceDialog),
// first-login setup (GenesisWizard) and the Game 3D "Create character" overlay.
import {useEffect,useRef,useState} from 'react';
import {Eye, EyeOff, RotateCcw, Shuffle} from 'lucide-react';
import CreatorStage from './CreatorStage';
import {CREATOR_SECTIONS,CreatorNavigation} from './CharacterAppearanceEditor';
import {creatorCultureAccent} from './creatorCultures';
import './character-creator.css';

const typing=t=>t instanceof Element&&Boolean(t.closest('input,textarea,select,[contenteditable="true"]'));

export default function CreatorStudio({config,shot,expression,onCapabilities,onCustomizationState,layers={},section,onSection,sections=CREATOR_SECTIONS,showRail=true,
 brand,topTools,kicker,title,panel,footer,onRandomize,panelLabel='Appearance options',className=''}) {
 const [hidden,setHidden]=useState(false),[resetKey,setResetKey]=useState(0);
 const stage=useRef(null);
 useEffect(()=>{
  const key=e=>{if(typing(e.target)||e.metaKey||e.ctrlKey||e.altKey)return;if(e.key==='h'||e.key==='H'){e.preventDefault();setHidden(v=>!v);}};
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 },[]);
 const index=sections.findIndex(s=>s.id===section);
 return <div className={'creator-studio '+className} data-ui={hidden?'hidden':'shown'} data-rail={showRail?'on':'off'} style={{'--creator-culture-accent':creatorCultureAccent(config.cultural_inspirations)}}>
  <div className="creator-backdrop" aria-hidden="true"/>
  <section className="creator-stage" aria-label="Live character preview">
   <CreatorStage ref={stage} config={config} shot={shot} expression={expression} onCapabilities={onCapabilities} onCustomizationState={onCustomizationState} resetKey={resetKey}/>
  </section>
  <header className="creator-topline">
   <div className="creator-brand">{brand}</div>
   <div className="creator-tools" role="toolbar" aria-label="Preview tools">
    {onRandomize&&<button type="button" className="creator-tool" onClick={onRandomize} title="Randomize" aria-label="Randomize appearance"><Shuffle size={16} strokeWidth={1.4}/></button>}
    <button type="button" className="creator-tool" onClick={()=>{if(stage.current?.resetView)stage.current.resetView();else setResetKey(k=>k+1);}} title="Reset view" aria-label="Reset preview camera"><RotateCcw size={16} strokeWidth={1.4}/></button>
    <button type="button" className="creator-tool" onClick={()=>setHidden(v=>!v)} title={hidden?'Show interface (H)':'Hide interface (H)'} aria-label={hidden?'Show interface':'Hide interface'} aria-pressed={hidden}>{hidden?<Eye size={16} strokeWidth={1.4}/>:<EyeOff size={16} strokeWidth={1.4}/>}</button>
    {topTools}
   </div>
  </header>
  {showRail&&<aside className="creator-rail" aria-hidden={hidden||undefined}><CreatorNavigation section={section} onChange={onSection} sections={sections}/></aside>}
  <section className="creator-panel" aria-label={panelLabel} aria-hidden={hidden||undefined}>
   <span className="creator-panel-sheen" aria-hidden="true"/>
   <header className="creator-panel-head">{kicker&&<p>{kicker}</p>}<h2>{title||sections[index]?.label}</h2>{showRail&&index>=0&&<span className="creator-panel-count">{String(index+1).padStart(2,'0')}<i>/</i>{String(sections.length).padStart(2,'0')}</span>}</header>
   <div className="creator-panel-scroll">{panel}</div>
   {footer&&<footer className="creator-panel-foot">{footer}</footer>}
  </section>
  {layers.loading&&<p className="creator-preview-status" role="status">Fitting layers…</p>}
  {layers.error&&<p className="creator-preview-error" role="alert">{layers.error}</p>}
  <p className="creator-gesture-hint" aria-hidden="true">Drag to turn · Pinch or scroll to zoom</p>
 </div>;
}
