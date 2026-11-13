import {CULTURAL_INSPIRATIONS,GENRE_DIRECTIONS,normalizeCulturalInspirations,toggleCulturalInspiration} from './creatorCultures';
import './creator-cultures.css';

/**
 * Minimal art-direction controls: one compact genre row + multi-select chips.
 * Inspirations affect decorative lighting and palette, never identity, body
 * shape, skin colour, ancestry or character stats.
 */
export default function CulturalInspirationSelector({config={},setConfig,compact=false}) {
 const chosen=normalizeCulturalInspirations(config.cultural_inspirations);
 const direction=GENRE_DIRECTIONS.some(item=>item.id===config.genre_direction)
  ? config.genre_direction:'fantasy';
 const update=patch=>setConfig(current=>({...current,...patch}));
 return <section className={'creator-inspiration creator-inspiration-clean'+(compact?' is-compact':'')}
   aria-label="Visual inspiration and genre">
  <header className="creator-inspiration-heading">
   <h3>Art direction</h3>
   <p>Choose a genre, then add the influences you like.</p>
  </header>
  <fieldset className="creator-inspiration-fieldset">
   <legend>Genre</legend>
   <div className="creator-genre-choices" role="group" aria-label="World genre">
    {GENRE_DIRECTIONS.map(({id,label})=><button key={id} type="button"
      aria-pressed={direction===id} onClick={()=>update({genre_direction:id})}>{label}</button>)}
   </div>
  </fieldset>
  <fieldset className="creator-inspiration-fieldset">
   <legend>Influences <small>{chosen.length} selected</small></legend>
   <div className="creator-culture-grid">
    {CULTURAL_INSPIRATIONS.map(({id,label,accent})=><button key={id} type="button"
      className="creator-culture-option" style={{'--culture-accent':accent}}
      aria-pressed={chosen.includes(id)}
      onClick={()=>update({cultural_inspirations:toggleCulturalInspiration(chosen,id)})}>
     <span className="creator-culture-dot" aria-hidden="true"/>
     <span className="creator-culture-copy"><strong>{label}</strong></span>
     <span className="creator-culture-check" aria-hidden="true">{chosen.includes(id)?'✓':'+'}</span>
    </button>)}
   </div>
  </fieldset>
  <details className="creator-inspiration-more">
   <summary>About these influences</summary>
   <p>These are artistic themes, not ancestry or complexion settings. They change the studio palette;
     clothing and ornaments appear on the character only when compatible assets exist.</p>
   {chosen.length>0&&<ul>{CULTURAL_INSPIRATIONS.filter(item=>chosen.includes(item.id))
     .map(item=><li key={item.id}><strong>{item.label}:</strong> {item.description}</li>)}</ul>}
  </details>
 </section>;
}
