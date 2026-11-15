import {Save} from 'lucide-react';
import {SKILL_BOOK_WEAPON_MODES,getWeaponForSkillBookMode,getSkillBookWeaponArt}
  from './SkillBookWeaponModes.mjs';
// When an owned weapon has no iconUrl (the seeded sword and dagger do not),
// render a small original weapon-shaped vector instead of the incorrect generic
// Shield symbol. It is a class silhouette, not a fabricated item screenshot.
function WeaponSilhouette({item,role}){
  const words=String([item?.name,item?.weaponFamily,item?.masteryWeaponId].join(' ')).toLowerCase();
  const dagger=/dagger|knife|dual_blades/.test(words);
  if(role==='range')return <svg viewBox="0 0 64 64" role="img" aria-label="Bow silhouette">
    <path d="M15 8 Q43 29 14 56" fill="none" stroke="#f0d59f" strokeWidth="4.6" strokeLinecap="round"/>
    <path d="M15 8 L15 56" stroke="#a9d9e5" strokeWidth="1.7"/>
    <path d="M6 34 L53 34 M47 29 L53 34 L47 39" fill="none" stroke="#e9dcc4" strokeWidth="2.3" strokeLinecap="round"/>
  </svg>;
  if(dagger)return <svg viewBox="0 0 64 64" role="img" aria-label="Dagger silhouette">
    <path d="M38 8 L48 20 L29 42 L22 35 Z" fill="#bad5dd" stroke="#f4d99e" strokeWidth="2"/>
    <path d="M23 28 L41 45 M23 45 L41 28" stroke="#d1ac6d" strokeWidth="4" strokeLinecap="round"/>
    <path d="M23 43 L13 53" stroke="#ddbf86" strokeWidth="6" strokeLinecap="round"/>
    <circle cx="11" cy="55" r="3" fill="#e7c784"/>
  </svg>;
  return <svg viewBox="0 0 64 64" role="img" aria-label="Sword silhouette">
    <path d="M34 5 L42 14 L30 43 L24 38 Z" fill="#bcd9e1" stroke="#f4d59c" strokeWidth="2"/>
    <path d="M20 37 L42 46" stroke="#e9bd7d" strokeWidth="5" strokeLinecap="round"/>
    <path d="M30 42 L22 57" stroke="#e7d3aa" strokeWidth="5" strokeLinecap="round"/>
    <circle cx="20" cy="59" r="3" fill="#edcb86"/>
  </svg>;
}
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

      return <button key={mode.id} type="button" className="axe-book-weapon-slot"
        aria-pressed={activeMode===mode.id}
        aria-label={mode.label+' weapon: '+(item?.name||'Not owned')}
        title={item?.name||'No '+mode.label.toLowerCase()+' weapon owned'}
        onClick={()=>onChoose(mode.id)}>
        <span className="axe-book-weapon-portrait" aria-hidden="true">
          {src?<img src={src} alt="" loading="lazy"/>:<WeaponSilhouette item={item} role={mode.id}/>}
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
