import {Crosshair, Save, Shield, Swords} from 'lucide-react';
import {SKILL_BOOK_WEAPON_MODES,getWeaponForSkillBookMode,getSkillBookWeaponArt}
  from './SkillBookWeaponModes.mjs';
const ROLE_ICONS={damage:Swords,range:Crosshair,defense:Shield};
const COMPANION_SET_NAMES=['Support','Combat','Mobility'];

// Replaces the exterior preset box with actual owned weapon portraits.
// Item imagery, item name and equipped status come from the canonical
// character-scoped equipment inventory, not illustrative sample images.
export function SkillBookWeaponRail({items,activeMode,onChoose}){
  return <aside className="axe-book-weapon-rail" aria-label="Weapon slots">
    <strong>Weapons</strong>
    {SKILL_BOOK_WEAPON_MODES.map(mode=>{
      const item=getWeaponForSkillBookMode(items,mode.id);
      const src=getSkillBookWeaponArt(item);
      const Icon=ROLE_ICONS[mode.id];
      return <button key={mode.id} type="button" className="axe-book-weapon-slot"
        aria-pressed={activeMode===mode.id}
        aria-label={mode.label+' weapon: '+(item?.name||'Not owned')}
        title={item?.name||'No '+mode.label.toLowerCase()+' weapon owned'}
        onClick={()=>onChoose(mode.id)}>
        <span className="axe-book-weapon-portrait" aria-hidden="true">
          {src?<img src={src} alt="" loading="lazy"/>:<Icon size={26}/>}
        </span>
        <span className="axe-book-weapon-role">{mode.label}</span>
        <small>{item?.name||'Empty weapon slot'}</small>
        {item?.equipped&&<em>Equipped</em>}
      </button>;
    })}
  </aside>;
}

// Moves the old three preset choices INTO the skill-book pages (above the
// open folio and the single horizontal hotbar). Companion retains its own
// three saved sets without incorrectly claiming companions equip weapons.
export function SkillBookStanceStrip({companion,activeIndex,onChoose,onSave}){
  const labels=companion?COMPANION_SET_NAMES:
    SKILL_BOOK_WEAPON_MODES.map(mode=>mode.label);
  return <nav className="axe-book-stance-strip"
    aria-label={companion?'Companion ability sets':'Weapon skill bars'}>
    <span className="axe-book-stance-caption">{companion?'Companion':'Weapon skills'}</span>
    {labels.map((label,index)=><button type="button" key={label}
      aria-pressed={index===activeIndex} onClick={()=>onChoose(index)}>
      {label}</button>)}
    <button type="button" className="axe-book-stance-save"
      title="Save current skill bar" aria-label="Save current skill bar"
      onClick={onSave}><Save size={15}/></button>
  </nav>;
}
