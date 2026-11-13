import React from 'react';
import { ArrowLeft, ArrowRight, ChevronRight, Shield, MapPin, Sparkles } from 'lucide-react';
import { AXE_FACTIONS } from './AXEFactionWeaponConfig';
import { getFactionDossier } from './factionDossierPresentation.mjs';

/** Original line illustrations; not screenshots or previews of an equipped GLB. */
function AncestralBeast({ kind }) {
  const wolf = kind === 'wolf';
  const tiger = kind === 'tiger';
  return <svg className="axe-fd-beast-art" viewBox="0 0 280 150" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="fd-beast-coat" x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#f5e9d6" stopOpacity=".90"/>
        <stop offset=".6" stopColor="#91bad2" stopOpacity=".58"/>
        <stop offset="1" stopColor="#355b79" stopOpacity=".18"/>
      </linearGradient>
    </defs>
    <circle cx="140" cy="75" r="69" stroke="currentColor" strokeOpacity=".23" strokeDasharray="2 8"/>
    <path d="M47 140Q70 108 84 89Q101 64 140 56Q179 64 196 89Q210 108 233 140"
      fill="url(#fd-beast-coat)" stroke="currentColor" strokeWidth="1.8" strokeOpacity=".5"/>
    {wolf
      ? <><path d="M93 82 82 7 127 43M187 82 198 7 153 43"
        fill="#354d68" stroke="currentColor" strokeWidth="3"/>
        <path d="M103 66Q111 35 140 39Q169 35 177 66L189 93 161 125H119L91 93Z"
          fill="url(#fd-beast-coat)" stroke="currentColor" strokeWidth="2.5"/>
        <path d="M123 96 140 129 157 96 169 104 140 142 111 104Z"
          fill="#18324d" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M105 89 123 96 133 92M175 89 157 96 147 92" stroke="currentColor" strokeWidth="3"/>
        <path d="M140 101 133 109 140 114 147 109Z" fill="#d8e9f6"/></>
      : <><path d="M88 63Q77 32 101 22Q126 14 132 55M192 63Q203 32 179 22Q154 14 148 55"
          fill="#34475c" stroke="currentColor" strokeWidth="3"/>
        <path d="M84 88Q83 40 140 38Q197 40 196 88Q190 125 164 133H116Q90 125 84 88Z"
          fill="url(#fd-beast-coat)" stroke="currentColor" strokeWidth="2.5"/>
        <path d="M104 93Q118 100 127 96M176 93Q162 100 153 96"
          stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
        <path d="M116 117Q140 97 164 117Q157 139 140 140Q123 139 116 117Z"
          fill="#d4e1e6" stroke="currentColor" strokeWidth="2"/>
        <path d="M140 113 132 119 140 126 148 119Z" fill="#243a50"/>
        {tiger && <g stroke="#28364d" strokeWidth="5" strokeLinecap="round">
          <path d="M140 45V73M126 48 119 66M154 48 161 66M93 74 112 82M187 74 168 82M98 103 115 109M182 103 165 109"/>
        </g>}
        {!tiger && <path d="M98 59 115 65M182 59 165 65" stroke="currentColor" strokeWidth="3"/>}
      </>}
    <path d="M111 90 124 87M169 90 156 87" stroke="#132c46" strokeWidth="5" strokeLinecap="round"/>
    <path d="M133 141Q140 145 147 141" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M44 117 70 121M210 121 236 117" stroke="currentColor" strokeOpacity=".4"/>
  </svg>;
}

function ArmorIllustration({ kind }) {
  return <svg className="axe-fd-armor-art" viewBox="0 0 200 120" fill="none" aria-hidden="true">
    <path d="M66 21 85 12 100 20 115 12 134 21 160 27 176 52 151 62 140 49 138 100 100 113 62 100 60 49 49 62 24 52 40 27Z"
      fill="#152b47" stroke="currentColor" strokeOpacity=".6" strokeWidth="2"/>
    <path d="M85 12 80 37 100 58 120 37 115 12M80 37 60 49M120 37 140 49"
      stroke="currentColor" strokeOpacity=".65" strokeWidth="2"/>
    <path d="M77 47 100 65 123 47 130 93 100 103 70 93Z"
      fill="#344e69" stroke="currentColor" strokeOpacity=".78" strokeWidth="2"/>
    <path d="M100 65 100 104M70 77 88 80M130 77 112 80" stroke="#f1d5a4" strokeOpacity=".65" strokeWidth="1.7"/>
    <path d={kind === 'wolf'
      ? 'M95 65 100 49 105 65 113 78 100 75 87 78Z'
      : kind === 'tiger'
        ? 'M100 55 113 68 100 91 87 68Z'
        : 'M84 61 100 53 116 61 116 74 100 85 84 74Z'}
      fill="#c4a777" fillOpacity=".75" stroke="currentColor"/>
    <path d="M59 23Q45 18 33 41M141 23Q155 18 167 41" stroke="currentColor" strokeOpacity=".64" strokeWidth="4"/>
    <path d="M67 19 100 26 133 19" stroke="currentColor" strokeOpacity=".42" strokeWidth="2"/>
  </svg>;
}

function HomelandIllustration({ scene }) {
  return <svg className="axe-fd-homeland-art" viewBox="0 0 220 120" fill="none" aria-hidden="true">
    <defs><linearGradient id="fd-vista" x1="0" y1="0" x2="0" y2="1">
      <stop stopColor="#86accc" stopOpacity=".45"/><stop offset="1" stopColor="#183350" stopOpacity=".05"/>
    </linearGradient></defs>
    <rect width="220" height="120" fill="url(#fd-vista)"/>
    <circle cx={scene === 'desert' ? 152 : 166} cy="23" r={scene==='moonwood'?17:13}
      fill="currentColor" opacity=".65"/>
    {scene==='mountain'
      ? <><path d="M0 90 45 24 78 70 115 19 163 83 188 52 220 96V120H0Z"
        fill="#203d55" stroke="currentColor" strokeOpacity=".4"/>
        <path d="M26 52 45 24 63 48M95 44 115 19 139 52" stroke="#d7e5e6" strokeOpacity=".8" strokeWidth="3"/>
        <path d="M91 100V62H129V100M83 62H138M94 62l16-22 16 22" stroke="#ead5a9" strokeWidth="3"/></>
      : scene==='moonwood'
        ? <><path d="M0 100 34 67 68 94 111 48 152 96 188 69 220 97V120H0Z"
          fill="#213b59"/><path d="M72 103V61H84V49H101V37H113V49H130V61H144V103Z"
          fill="#314e69" stroke="currentColor" strokeOpacity=".65" strokeWidth="2"/>
          <path d="M103 105V80h12v25M78 68h58" stroke="#c0d8ee" strokeWidth="2"/>
          <path d="m16 105 18-43 18 43M157 108l14-40 17 40M182 108l15-35 13 35"
          fill="#233c4e" stroke="#98b9c9" strokeWidth="2"/></>
        : <><path d="M0 100Q44 70 100 97T220 90V120H0Z" fill="#7a614f" opacity=".7"/>
          <path d="M0 108Q55 87 117 107T220 100" stroke="#e2b983" strokeWidth="2" opacity=".65"/>
          <path d="M72 101V58L110 30 148 58V101M63 59h94M90 102V71h40v31" stroke="#e8ce9a" strokeWidth="3"/>
          <path d="M104 102V78h12v24M110 30V13" stroke="#ead3ac" strokeWidth="2"/></>}
    <path d="M0 118Q67 110 108 117T220 113" stroke="currentColor" strokeOpacity=".52" strokeWidth="1.5"/>
  </svg>;
}

/** The left rail PREVIEWS a faction; the right action CONFIRMS the faction. */
export default function FactionDossier({ activeId, onPreview, onChoose, onBack }) {
  const activeFaction = AXE_FACTIONS.find(f => f.id === activeId) || AXE_FACTIONS[0];
  const detail = getFactionDossier(activeFaction?.id);
  if(!activeFaction || !detail) return null;
  return <section className="axe-fd-stage" aria-label="Choose a faction"
    style={{ '--fd-accent': detail.accent, '--fd-rgb': detail.rgb }}>
    <nav className="axe-fd-rail" aria-label="Browse factions">
      <div className="axe-fd-rail-heading">
        <span className="axe-fd-overline">CHOOSE YOUR ALLEGIANCE</span>
        <span className="axe-fd-rail-instruction">Select a faction to explore its legacy</span>
      </div>
      <div className="axe-fd-options">
        {AXE_FACTIONS.map(faction => {
          const data=getFactionDossier(faction.id);
          return <button type="button" key={faction.id}
            className={'axe-fd-option'+(activeFaction.id===faction.id?' is-active':'')}
            aria-pressed={activeFaction.id===faction.id} aria-controls="axe-fd-details"
            onClick={()=>onPreview(faction.id)}>
            <span className="axe-fd-number">{String(faction.index).padStart(2,'0')}</span>
            <span className="axe-fd-option-text"><strong>{faction.displayName}</strong>
              <small>{data?.beastName || 'Ancestral beast'}</small></span>
            <ChevronRight size={18} aria-hidden="true"/>
          </button>;
        })}
      </div>
      <button type="button" className="axe-fd-back" onClick={onBack}>
        <ArrowLeft size={17}/> Back
      </button>
    </nav>
    <aside className="axe-fd-details" id="axe-fd-details" aria-live="polite">
      <svg className="axe-fd-ripple" viewBox="0 0 36 680" preserveAspectRatio="none" aria-hidden="true">
        <path d="M36 0Q3 27 27 59T20 128T26 191T14 260T25 329T17 397T26 464T12 529T24 610T36 680"
          fill="none" stroke="currentColor" strokeOpacity=".54" strokeWidth="1.5"/>
        <path d="M34 0Q13 40 32 82T28 179T32 279T26 378T31 487T27 575T34 680"
          fill="none" stroke="currentColor" strokeOpacity=".22" strokeWidth="1"/>
      </svg>
      <header className="axe-fd-detail-head">
        <span className="axe-fd-overline">FACTION ARCHIVE <Sparkles size={12}/></span>
        <h2>{activeFaction.displayName}</h2>
        <p className="axe-fd-motto">{detail.motto}</p>
      </header>
      <p className="axe-fd-description">{detail.description}</p>
      <div className="axe-fd-beast-block">
        <div className="axe-fd-beast-visual"><AncestralBeast kind={detail.beast}/></div>
        <div className="axe-fd-beast-caption">
          <span className="axe-fd-overline">ANCESTRAL SYMBOL</span>
          <strong>{detail.beastName}</strong>
          <small>Also represented by its faction mount</small>
        </div>
      </div>
      <div className="axe-fd-gallery">
        <article className="axe-fd-gallery-item" aria-label={'Armor visual identity: '+detail.armorName}>
          <div className="axe-fd-gallery-image"><ArmorIllustration kind={detail.beast}/></div>
          <div className="axe-fd-gallery-caption"><Shield size={13}/><span>ARMOR STYLE</span></div>
          <strong>{detail.armorName}</strong>
          <small>{detail.armorNote}</small>
        </article>
        <article className="axe-fd-gallery-item" aria-label={'Homeland visual concept: '+detail.homelandName}>
          <div className="axe-fd-gallery-image"><HomelandIllustration scene={detail.scene}/></div>
          <div className="axe-fd-gallery-caption"><MapPin size={13}/><span>HOMELAND VISION</span></div>
          <strong>{detail.homelandName}</strong>
          <small>{detail.homelandNote}</small>
        </article>
      </div>
      <button type="button" className="axe-fd-confirm" onClick={()=>onChoose(activeFaction.id)}>
        Choose {activeFaction.displayName} <ArrowRight size={18}/>
      </button>
      <p className="axe-fd-visual-note">Visual motifs are illustrative; no armor is automatically equipped or restricted.</p>
    </aside>
  </section>;
}
