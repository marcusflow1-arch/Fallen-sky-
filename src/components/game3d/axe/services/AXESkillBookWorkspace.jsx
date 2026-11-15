import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Gem, Shield, Sparkles, Swords, WandSparkles, X } from 'lucide-react';
import { getAllSkills, getSkillById } from '../../skills/skillRegistry';
import { CAST_TYPE, SKILL_TYPE, WEAPON_TYPE } from '../../skills/skillTypes';
import {
  ACTIVE_SLOTS, equipActive, equipPassive, getLoadout, getSkillPresets,
  saveSkillPreset, selectSkillPreset, subscribeLoadout, unequipActive, unequipPassive,
} from '../../skills/loadoutStore';
import {
  COMPANION_SLOT_KEYS, equipCompanionSkill, getCompanionLoadout,
  subscribeCompanionLoadout, unequipCompanionSkill,
} from '../../skills/companionLoadoutStore';
import { getAllCompanionSkills, getCompanionSkillById, COMPANION_SKILL_CATEGORY } from '../../skills/companionSkillRegistry';
import AXESkillMasteryDetail from './AXESkillMasteryDetail';
import { getSkillMastery, subscribeSkillMastery } from '../../skills/skillMasteryStore';
import { getAXEEquipmentInventoryState, subscribeAXEEquipmentInventory,
  switchAXEInventoryWeapon } from '../equipment/AXEEquipmentInventoryStore';
import {SKILL_BOOK_WEAPON_MODES,getWeaponForSkillBookMode,
  getSkillBookModeForPreset} from './SkillBookWeaponModes.mjs';
import {SkillBookWeaponRail,SkillBookStanceStrip} from './SkillBookWeaponControls';
import './AXESkillBookWorkspace.css';

// No art texture or sample screenshot is rendered. The pages, metallic edges,
// selection rings and spine are CSS; ALL book tiles come from Game 3D's registry.
const LEFT_FILTERS = [
  { id: 'passives', label: 'Passives' },
  { id: 'enhance', label: 'Enhance' },
];
const RIGHT_FILTERS = [
  { id: 'damage', label: 'Damage' },
  { id: 'defense', label: 'Defense' },
  { id: 'range', label: 'Range' },
];
const COMPANION_LEFT = [
  { id: 'support', label: 'Support' }, { id: 'mobility', label: 'Mobility' },
  { id: 'fusion', label: 'Fusion' },
];
const COMPANION_RIGHT = [
  { id: 'combat', label: 'Combat' }, { id: 'support', label: 'Support' },
  { id: 'mobility', label: 'Mobility' }, { id: 'fusion', label: 'Fusion' },
];
const PRESET_COUNT = 3;
const BOOK_PRESET_KEY = 'game3d_skills_book_rails_v1';
const blank = len => Array.from({ length: len }, () => null);
const useStore = (read, subscribe) => {
  const [state, setState] = useState(read);
  useEffect(() => subscribe(setState), [subscribe]);
  return state;
};
function readBanks() {
  const baseline = {
    passiveIndex: 0, passiveSets: [getLoadout().passivePanel.slice(), blank(6), blank(6)],
    companionIndex: 0, companionSets: [getCompanionLoadout().activeSlots.slice(), blank(4), blank(4)],
  };
  try {
    const stored = JSON.parse(localStorage.getItem(BOOK_PRESET_KEY) || 'null');
    if (!stored) return baseline;
    const valid = (items, count, get) => Array.from({ length: PRESET_COUNT },
      (_, i) => Array.from({ length: count }, (__, j) => {
        const id = items?.[i]?.[j];
        return typeof id === 'string' && get(id) ? id : null;
      }));
    return {
      passiveIndex: [0, 1, 2].includes(stored.passiveIndex) ? stored.passiveIndex : 0,
      passiveSets: valid(stored.passiveSets, 6, id => getSkillById(id)?.skill_type === SKILL_TYPE.PASSIVE),
      companionIndex: [0, 1, 2].includes(stored.companionIndex) ? stored.companionIndex : 0,
      companionSets: valid(stored.companionSets, 4, getCompanionSkillById),
    };
  } catch { return baseline; }
}
function saveBanks(state) {
  try { localStorage.setItem(BOOK_PRESET_KEY, JSON.stringify(state)); return true; }
  catch { return false; }
}
function classify(skill) {
  if (skill?.aoe_radius > 0 || skill?.axe_pattern?.includes('aoe')) return 'AOE';
  if (skill?.hit_count > 1 || [CAST_TYPE.MULTI_HIT_SEQUENTIAL, CAST_TYPE.MULTI_HIT_BURST,
    CAST_TYPE.RANGED_DOUBLE, CAST_TYPE.RANGED_BARRAGE].includes(skill?.cast_type)) return 'Multi-Hit';
  return 'Single-Hit';
}
function characterSkills(side, filter) {
  const all = getAllSkills();
  if (side === 'left') {
    if (filter === 'passives') return all.filter(s => s.skill_type === SKILL_TYPE.PASSIVE);
    // The Enhancements filter includes EVERY registered active buff, regardless of weapon.
    return all.filter(s => s.skill_type === SKILL_TYPE.ACTIVE_BUFF);
  }
  return all.filter(s => s.skill_type === SKILL_TYPE.ACTIVE_ATTACK &&
    (filter === 'damage' ||
      (filter === 'defense' && s.weapon_type === WEAPON_TYPE.GUARDIAN) ||
      (filter === 'range' && s.weapon_type === WEAPON_TYPE.RANGED)));
}
function companionSkills(side, filter) {
  const all = getAllCompanionSkills();
  // Companion skills have no PASSIVE registry type; do not fake passive slots.
  return all.filter(s => s.category === filter);
}
const skillLabel = s => s?.skill_name || 'Empty slot';
const skillGlyph = s => s?.icon || '✧';

function SkillTile({ skill, active, equipped, companion, onClick, onDoubleClick }) {
  const [mastery, setMastery] = useState(() => companion ? null : getSkillMastery(skill.skill_id));
  useEffect(() => {
    if (companion) {setMastery(null);return;}
    return subscribeSkillMastery(() => setMastery(getSkillMastery(skill.skill_id)));
  }, [companion, skill.skill_id]);
  return <button type="button" className="axe-book-skill" aria-pressed={active}
    onClick={onClick} onDoubleClick={onDoubleClick}
    title={skill.description || skill.skill_name}>
    <span className="axe-book-skill-icon" aria-hidden="true">{skillGlyph(skill)}</span>
    <span className="axe-book-skill-label">{skillLabel(skill)}</span>
    {mastery ? <>
      <span className="axe-book-skill-level">Lv. {mastery.level} / {mastery.maxLevel}</span>
      <span className="axe-book-skill-progress" aria-label={'Mastery '+Math.round(mastery.progress*100)+'%'}><i style={{width:Math.max(0,Math.min(100,mastery.progress*100))+'%'}}/></span>
    </> : <span className="axe-book-skill-level">{Number(skill.cooldown)||0}s cooldown</span>}
    {equipped && <span className="axe-book-equipped">Equipped</span>}
  </button>;
}
function SkillGrid({ skills, selected, equipped, onSelect, onQuickEquip, isCompanion, side, filter }) {
  const groups = side === 'right' && !isCompanion
    ? ['Single-Hit', 'Multi-Hit', 'AOE'].map(label => ({ label, items: skills.filter(s => classify(s) === label) }))
    : [{ label: filter === 'advance' ? 'Skill Mastery' : filter === 'passives' ? 'Passive Skills' : (isCompanion ? 'Companion Abilities' : 'Active Buffs'), items: skills }];
  return <div className="axe-book-grid-scroll">
    {groups.map(group => <section className="axe-book-category" key={group.label}>
      <h3><span />{group.label}<span /></h3>
      {group.items.length
        ? <div className="axe-book-cards">{group.items.map(skill =>
          <SkillTile key={skill.skill_id} skill={skill} companion={isCompanion} active={selected?.skill_id === skill.skill_id}
            equipped={equipped.includes(skill.skill_id)}
            onClick={() => onSelect(selected?.skill_id === skill.skill_id ? null : skill)}
            onDoubleClick={() => onQuickEquip(skill)} />)}</div>
        : <p className="axe-book-empty">{side === 'left' && filter === 'passives'
          ? 'No passive skills are registered for this character yet.'
          : 'There are no registered skills in this category.'}</p>}
    </section>)}
  </div>;
}
function FilterBar({ options, value, onChange }) {
  return <nav className="axe-book-filter" aria-label="Skill filters">
    {options.map(item => <button type="button" key={item.id} aria-pressed={value === item.id}
      onClick={() => onChange(item.id)}>{item.label}</button>)}
  </nav>;
}
function SlotButton({ id, index, selected, onEquip, onRemove, label, getSkill, compact = false, disabled = false }) {
  const skill = id && getSkill(id);
  return <div className={'axe-book-slot-wrap'+(compact ? ' axe-book-slot-wrap--compact' : '')}>
    <button type="button" className="axe-book-slot" disabled={disabled}
      title={skill ? skill.skill_name+' — select a skill to replace' : 'Equip selected skill in '+label}
      onClick={() => onEquip(index)} aria-label={label+': '+skillLabel(skill)}>
      <span className="axe-book-slot-icon" aria-hidden="true">{skillGlyph(skill)}</span>
      <small>{label}</small>
      {selected && <span className="axe-book-slot-target" aria-hidden="true">+</span>}
    </button>
    {id && !disabled && <button type="button" className="axe-book-slot-remove"
      onClick={() => onRemove(index)} title={'Unequip '+skillLabel(skill)}
      aria-label={'Unequip '+skillLabel(skill)+' from '+label}><X size={10}/></button>}
  </div>;
}
export default function AXESkillBookWorkspace({ serviceId = 'skills_character', onSelect, onClose }) {
  // Character Hub can also open this component without the world-mode router.
  const [localPage, setLocalPage] = useState(serviceId);
  const currentPage = onSelect ? serviceId : localPage;
  const companion = currentPage === 'skills_companion';
  const player = useStore(getLoadout, subscribeLoadout);
  const friend = useStore(getCompanionLoadout, subscribeCompanionLoadout);
  const equipment = useStore(getAXEEquipmentInventoryState, subscribeAXEEquipmentInventory);
  const [banks, setBanks] = useState(readBanks);
  const [presetRevision, setPresetRevision] = useState(0);
  const [leftFilter, setLeftFilter] = useState('enhance');
  const [rightFilter, setRightFilter] = useState('damage');
  const [view, setView] = useState('skills');
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState('');
  const activeIds = companion ? friend.activeSlots : player.activeSlots;
  const passiveIds = companion ? [] : player.passivePanel;
  const playerPresets = getSkillPresets();
  const activeMode=getSkillBookModeForPreset(playerPresets.index);
  const ownedWeapons=equipment?.items||[];
  void presetRevision;

  useEffect(() => {
    setSelected(null);
    setLeftFilter(companion ? 'support' : 'enhance');
    setRightFilter(companion ? 'combat' : 'damage');
    setView('skills');
    setStatus('');
  }, [companion]);

  const leftSkills = useMemo(() => companion
    ? companionSkills('left', leftFilter)
    : characterSkills('left', leftFilter), [companion, leftFilter]);
  const rightSkills = useMemo(() => companion
    ? companionSkills('right', rightFilter)
    : characterSkills('right', rightFilter), [companion, rightFilter]);

  const feedback = result => {
    if (result?.ok) setStatus('Loadout updated.');
    else setStatus('This skill cannot be equipped in that slot.');
  };
  const refreshBanks = next => { setBanks(next); saveBanks(next); };
  const placeActive = (index, skill = selected) => {
    if (!skill) return;
    const result = companion ? equipCompanionSkill(index, skill.skill_id) : equipActive(index, skill.skill_id);
    feedback(result);
    if (result.ok && companion) refreshBanks({ ...banks, companionSets:
      banks.companionSets.map((set,i) => i === banks.companionIndex ? getCompanionLoadout().activeSlots.slice() : set) });
    if (result.ok && !companion) { saveSkillPreset(); setPresetRevision(x => x+1); }
    if (result.ok) setSelected(null);
  };
  const removeActive = index => {
    const result = companion ? unequipCompanionSkill(index) : unequipActive(index);
    feedback(result);
    if (result.ok && companion) refreshBanks({ ...banks, companionSets:
      banks.companionSets.map((set,i) => i === banks.companionIndex ? getCompanionLoadout().activeSlots.slice() : set) });
    if (result.ok && !companion) saveSkillPreset();
  };
  const placePassive = (index, skill = selected) => {
    if (!skill || companion) return;
    const result = equipPassive(index, skill.skill_id);
    feedback(result);
    if (result.ok) {
      refreshBanks({ ...banks, passiveSets: banks.passiveSets.map((set,i) =>
        i === banks.passiveIndex ? getLoadout().passivePanel.slice() : set) });
      setSelected(null);
    }
  };
  const removePassive = index => {
    const result = unequipPassive(index);
    feedback(result);
    if (result.ok) refreshBanks({ ...banks, passiveSets: banks.passiveSets.map((set,i) =>
      i === banks.passiveIndex ? getLoadout().passivePanel.slice() : set) });
  };
  const quickEquip = skill => {
    if (!companion && skill.skill_type === SKILL_TYPE.PASSIVE) {
      const slot = passiveIds.indexOf(null);
      if (slot !== -1) placePassive(slot,skill);
      else setStatus('No empty passive slots. In Buffs, remove an equipped passive chip to make space.');
      return;
    }
    const slot = activeIds.indexOf(null);
    if (slot !== -1) placeActive(slot,skill);
    else setStatus('No empty active slots. Select an occupied slot to replace it.');
  };
  const changePreset = (side, index) => {
    if (companion) {
      const next = { ...banks, companionIndex:index, companionSets:banks.companionSets.map((set,i) =>
        i === banks.companionIndex ? getCompanionLoadout().activeSlots.slice() : set) };
      refreshBanks(next);
      // Clearing first avoids the companion auto-swap behavior dropping a
      // skill when it is moved to a different slot in the target preset.
      for (let i=0;i<COMPANION_SLOT_KEYS.length;i++) unequipCompanionSkill(i);
      next.companionSets[index].forEach((id,i) => { if(id) equipCompanionSkill(i,id); });
    } else if (side === 'right') {
      const result = selectSkillPreset(index);
      feedback(result);
      setPresetRevision(x => x+1);
    } else {
      const next = { ...banks, passiveIndex:index, passiveSets:banks.passiveSets.map((set,i) =>
        i === banks.passiveIndex ? getLoadout().passivePanel.slice() : set) };
      refreshBanks(next);
      next.passiveSets[index].forEach((id,i) => equipPassive(i,id));
    }
    setSelected(null);
    setStatus(companion ? ['Support','Combat','Mobility'][index]+' companion skills selected.' : 'Weapon skill bar selected.');
  };
  const savePreset = side => {
    if (companion) refreshBanks({ ...banks, companionSets:banks.companionSets.map((set,i) =>
      i === banks.companionIndex ? getCompanionLoadout().activeSlots.slice() : set) });
    else if (side === 'right') { feedback(saveSkillPreset()); setPresetRevision(x=>x+1); }
    else refreshBanks({ ...banks, passiveSets:banks.passiveSets.map((set,i) =>
      i === banks.passiveIndex ? getLoadout().passivePanel.slice() : set) });
    setStatus(companion?'Companion ability set saved.':'Current weapon skill bar saved.');
  };
  const chooseWeaponMode = modeId=>{
    const mode=SKILL_BOOK_WEAPON_MODES.find(entry=>entry.id===modeId);
    if(!mode)return;
    const weapon=getWeaponForSkillBookMode(ownedWeapons,mode.id);
    // Use the canonical atomic weapon-draw transaction. It enforces owned
    // items and equip restrictions; never write equipment state in the UI.
    if(weapon){
      const draw=switchAXEInventoryWeapon(weapon.instanceId);
      if(!draw.ok){
        setStatus(draw.message||'This weapon cannot be equipped right now.');
        return;
      }
    }
    // Existing gameplay hotbar keys 1-0 read this same loadout store.
    const result=selectSkillPreset(mode.presetIndex);
    feedback(result);
    if(!result.ok)return;
    setRightFilter(mode.id);
    setSelected(null);
    setView('skills');
    setPresetRevision(n=>n+1);
    setStatus((weapon?.name||mode.label+' slot')+' — '+mode.label+' skill bar selected.');
  };
  const currentSkill = selected && (companion
    ? getCompanionSkillById(selected.skill_id) : getSkillById(selected.skill_id));
  const advancementSkills = useMemo(() => companion ? getAllCompanionSkills() : getAllSkills(), [companion]);
  const changeView = next => { setView(next); setSelected(null); setStatus(''); };
  const chooseSkill = skill => { setSelected(skill); setStatus(''); };

  return <div className="axe-skill-book-root" data-progression-panel={currentPage}>
    <header className="axe-skill-book-header">
      <span className="axe-skill-book-crest"><BookOpen size={30}/></span>
      <div className="axe-skill-book-heading"><h2>Skills &amp; Services</h2>
        <p>Damage, Range &amp; Defense weapon bars · real equipped abilities</p></div>
      <nav className="axe-skill-book-mode" aria-label="Skills subpages">
        {[['skills_character','Character'],['skills_companion','Companion']].map(([id,label]) =>
          <button key={id} type="button" aria-pressed={currentPage === id}
            onClick={() => onSelect ? onSelect(id) : setLocalPage(id)}>{label}</button>)}
      </nav>
      <nav className="axe-skill-book-view-nav" aria-label="Skills, buffs and advancement">
        {['skills','buffs','advance'].map(id => <button type="button" key={id}
          aria-pressed={view === id} onClick={() => changeView(id)}>
          {id === 'skills' ? 'Skills' : id === 'buffs' ? 'Buffs' : 'Advance'}
        </button>)}
      </nav>
      {onClose && <button type="button" data-service-close className="axe-skill-book-close"
        onClick={onClose} aria-label="Close Skills"><X size={19}/></button>}
    </header>
    <div className="axe-skill-book-layout" data-weapon-slots={companion?'companion':'character'}>
      {!companion&&<SkillBookWeaponRail items={ownedWeapons}
        activeMode={activeMode.id} onChoose={chooseWeaponMode}/>}
      <div className="axe-skill-book-volume">
        <SkillBookStanceStrip companion={companion}
          activeIndex={companion?banks.companionIndex:playerPresets.index}
          onChoose={i=>companion?changePreset('right',i):
            chooseWeaponMode(SKILL_BOOK_WEAPON_MODES[i].id)}
          onSave={()=>savePreset('right')}/>
        <div className="axe-skill-book-spread">
          <section className="axe-skill-book-page axe-skill-book-page--left" aria-label="Buffs and passive skills">
            <div className="axe-skill-book-page-title"><Sparkles size={17}/><h2>{view==='skills'?'Skill Details':view==='advance'?'Skill Mastery':(companion?'Support & Abilities':'Buffs & Passives')}</h2></div>
            {view==='buffs' && <FilterBar options={companion?COMPANION_LEFT:LEFT_FILTERS} value={leftFilter}
              onChange={x=>{setLeftFilter(x);setSelected(null);}} />}
            {view==='buffs'&&!companion&&passiveIds.some(Boolean)&&
              <nav className="axe-book-passive-chips" aria-label="Equipped passive skills">
                {passiveIds.map((id,i)=>id&&<button key={i} type="button"
                  title={'Remove '+skillLabel(getSkillById(id))}
                  onClick={()=>removePassive(i)}>
                  {skillLabel(getSkillById(id))}<X size={11}/></button>)}
              </nav>}
            <div className="axe-skill-book-page-content">
              {view==='skills' ? <AXESkillMasteryDetail skill={currentSkill} companion={companion}/>
                : <SkillGrid side="left" filter={view==='advance'?'advance':leftFilter} isCompanion={companion}
                  skills={view==='advance'?advancementSkills:leftSkills} selected={currentSkill}
                  equipped={[...activeIds,...passiveIds]} onSelect={chooseSkill} onQuickEquip={quickEquip}/>}

            </div>
          </section>
          <div className="axe-skill-book-binding" aria-hidden="true"><Gem size={23}/></div>
          <section className="axe-skill-book-page axe-skill-book-page--right" aria-label="Active combat skills">
            <div className="axe-skill-book-page-title"><Swords size={19}/><h2>{view==='skills'?'Skills':view==='buffs'?'Buff Details':'Advance Details'}</h2></div>
            {view==='skills' && <FilterBar options={companion?COMPANION_RIGHT:RIGHT_FILTERS} value={rightFilter}
              onChange={x=>{setRightFilter(x);setSelected(null);}} />}
            <div className="axe-skill-book-page-content">
              {view==='skills'
                ? <SkillGrid side="right" filter={rightFilter} isCompanion={companion}
                    skills={rightSkills} selected={currentSkill} equipped={activeIds}
                    onSelect={chooseSkill} onQuickEquip={quickEquip} />
                : <AXESkillMasteryDetail skill={currentSkill} companion={companion}/>}

            </div>
          </section>
        </div>
        <footer className="axe-skill-book-hotbar" aria-label="Equipped skill bar">
          <span className="axe-skill-book-hotbar-ornament"><Shield size={20}/></span>
          <div className="axe-skill-book-hotbar-slots">
            {activeIds.map((id,i) => <SlotButton key={i} id={id} index={i} compact
              label={companion?COMPANION_SLOT_KEYS[i]:String(i+1)}
              selected={!!selected && (companion||selected.skill_type!==SKILL_TYPE.PASSIVE)}
              getSkill={companion?getCompanionSkillById:getSkillById}
              onEquip={placeActive} onRemove={removeActive}/>)}
          </div>
          <span className="axe-skill-book-hotbar-ornament"><WandSparkles size={20}/></span>
        </footer>
      </div>
    </div>
    <footer className="axe-skill-book-foot">
      <span role="status">{status || (selected
        ? 'Selected '+skillLabel(selected)+'. Inspect mastery and equip a compatible slot.'
        : view==='advance' ? 'Select a skill to view earned XP, level and the next upgrade.'
        : 'Select a skill to inspect it, or double-click to equip an empty slot.')}</span>
      <span>{currentSkill && <><strong>{skillLabel(currentSkill)}</strong> · {currentSkill.description}</>}</span>
    </footer>
  </div>;
}
