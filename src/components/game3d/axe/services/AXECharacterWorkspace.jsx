import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Activity, Check, Crown, Feather, Gem, HeartPulse, Shield, Shirt, Sparkles, Sword, Wind } from 'lucide-react';
import { getPlayerHUD, subscribePlayerHUD, applyAttributeAllocationPlan } from '../../playerHUDStore';
import { getAllAXEEquipmentItems, subscribeAXEEquipmentInventory } from '../equipment/AXEEquipmentInventoryStore';
import { subscribeCharacterChange } from '../../characterStorage';
import { getActiveCharacter, subscribeCharacters } from '../../characterStore';
import { AXE_EQUIPMENT_SLOT_DEFS } from '../equipment/AXEEquipmentSystem';
import { getWingsState, subscribeWings } from '../../progression/wingsStore';
import { getAXECapeState, subscribeAXECapes } from '../progression/AXECapeStore';
import { getAXECapeDefinition } from '../progression/AXECapeSystem';
import { getAXEVanityState, subscribeAXEVanity } from '../progression/AXEVanityStore';
import { AXE_VANITY_PIECES } from '../progression/AXEVanitySystem';
import { getAXECostumeState, subscribeAXECostumes } from '../progression/AXECostumeStore';
import { AXE_COSTUME_DEFINITIONS } from '../progression/AXECostumeSystem';
import './AXEAppearanceWorkspace.css';
import './AXECharacterWorkspace.css';

const PlayerModel = lazy(() => import('../../equipment/EquipmentPreview3D'));
const ATTRIBUTES = Object.freeze([
  { key:'constitution', name:'Vitals', Icon:HeartPulse, info:'Increases HP, regeneration and resilience.' },
  { key:'dexterity', name:'Dexterity', Icon:Wind, info:'Improves speed, defense, accuracy and avoidance.' },
  { key:'strength', name:'Strength', Icon:Shield, info:'Improves physical damage and attack accuracy.' },
  { key:'focus', name:'Spirit', Icon:Sparkles, info:'Improves Chi, spirit damage and recovery.' },
]);
// This is a read-only equipment sheet, not a second inventory. Keep every
// supported equip position visible, including off-hand, rings, wings,
// cosmetics and the auxiliary slots. Long rails scroll independently of the 3D model.
const CHARACTER_DISPLAY_SLOTS = Object.freeze(
  Object.entries(AXE_EQUIPMENT_SLOT_DEFS).flatMap(([slot, def]) =>
    Array.from({length:def.maxEquipped}, (_,index)=>[slot,index])),
);
const SLOT_SPLIT = Math.ceil(CHARACTER_DISPLAY_SLOTS.length / 2);
const SLOT_LABELS = {
  helm:'Head', chest:'Chest', legs:'Legs', vanity_head:'Vanity Head',
  vanity_torso:'Vanity Chest', vanity_pelvis:'Vanity Waist',
  vanity_leggings:'Vanity Legs',
};
const METRICS = [
  ['Damage','damage'], ['Defense','defense'], ['Chi','chi'],
  ['Critical Chance','critChance','%'], ['Critical Damage','criticalDamage','%'],
  ['Evasion','evasionPct','%'], ['Hit Chance','hitChance','%'],
  ['Attack Speed','attackSpeedPct','%'], ['HP Regen','hpRegen'],
  ['Chi Regen','manaRegen'], ['Attack Success','attackSuccess'], ['Attack Block','attackBlock'],
  ['Skill Power','skillPowerPct','%'], ['Cooldown Reduction','cooldownReductionPct','%'],
];
const num = value => Number(value || 0);
const display = value => num(value).toLocaleString('en-US',{maximumFractionDigits:2});
const caption = value => String(value || '').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
function GearIcon({item}) {
  const url=item?.imageUrl || item?.iconUrl || item?.appearanceImage;
  if(url && (url.startsWith('/') || /^https:\/\//.test(url))) return <img src={url} alt="" loading="lazy"/>;
  if(item?.slot==='weapon')return <Sword size={24}/>;
  if(item?.slot==='helm')return <Crown size={24}/>;
  if(item?.slot==='ring'||item?.slot==='necklace'||item?.slot==='trinket'||item?.slot==='accessory')return <Gem size={24}/>;
  if(item?.slot==='cape'||item?.slot==='wings')return <Feather size={24}/>;
  if(item?.slot==='costume'||item?.slot?.startsWith('vanity_'))return <Shirt size={24}/>;
  return <Shield size={24}/>;
}
export default function AXECharacterWorkspace({ embedded=false } = {}) {
  const [hud,setHud]=useState(getPlayerHUD);
  const [activeCharacter,setActiveCharacter]=useState(getActiveCharacter);
  const [equipment,setEquipment]=useState(getAllAXEEquipmentItems);
  const [wings,setWings]=useState(getWingsState);
  const [capes,setCapes]=useState(getAXECapeState);
  const [vanity,setVanity]=useState(getAXEVanityState);
  const [costumes,setCostumes]=useState(getAXECostumeState);
  const [plan,setPlan]=useState({});
  const [review,setReview]=useState(false);
  const [notice,setNotice]=useState('');
  useEffect(()=>subscribePlayerHUD(setHud),[]);
  useEffect(()=>subscribeCharacters(state=>setActiveCharacter(
    state.roster.find(character=>character.id===state.activeId)||null)),[]);
  useEffect(()=>subscribeAXEEquipmentInventory(state=>setEquipment(state.items)),[]);
  useEffect(()=>subscribeWings(setWings),[]);
  useEffect(()=>subscribeAXECapes(setCapes),[]);
  useEffect(()=>subscribeAXEVanity(setVanity),[]);
  useEffect(()=>subscribeAXECostumes(setCostumes),[]);
  useEffect(()=>subscribeCharacterChange(()=>{
    setPlan({});setReview(false);setNotice('');
  }),[]);
  const spent=ATTRIBUTES.reduce((n,{key})=>n+num(plan[key]),0);
  const points=Math.max(0,num(hud.unspentPoints));
  const remaining=Math.max(0,points-spent);
  useEffect(()=>{
    if(spent>points){setPlan({});setReview(false);}
  },[points,spent]);
  const liveEquipment=useMemo(()=>equipment.filter(item=>item.equipped),[equipment]);
  const slotItem=(slot,index)=>{
    const inventoryItem=liveEquipment.filter(item=>item.slot===slot)[index];
    if(inventoryItem)return inventoryItem;
    if(index!==0)return null;
    // Specialized progression equipment is stored outside the AXE inventory.
    // Reuse its current equipped state so an active wing/cape/costume/vanity
    // piece does not incorrectly appear as an empty slot.
    if(slot==='wings' && wings.equippedWing)
      return {slot,name:wings.equippedWing.name || wings.equippedWing.label || 'Equipped Wings'};
    if(slot==='cape' && capes.equippedCapeId) {
      const def=getAXECapeDefinition(capes.equippedCapeId);
      return def ? {slot,name:def.name} : null;
    }
    if(slot==='costume' && costumes.equippedCostumeId) {
      const def=AXE_COSTUME_DEFINITIONS[costumes.equippedCostumeId];
      return def ? {slot,name:def.name} : null;
    }
    if(slot.startsWith('vanity_')) {
      const def=AXE_VANITY_PIECES[vanity.equippedBySlot?.[slot.slice(7)]];
      return def ? {slot,name:def.name} : null;
    }
    return null;
  };
  const equippedDisplayCount=CHARACTER_DISPLAY_SLOTS.filter(([slot,index])=>slotItem(slot,index)).length;
  const derived=hud.derived||{};
  const effective=derived.effective||{};
  const totalAttr={
    constitution:effective.vitality ?? effective.constitution ?? hud.baseStats?.constitution,
    strength:effective.strength ?? hud.baseStats?.strength,
    dexterity:effective.agility ?? effective.dexterity ?? hud.baseStats?.dexterity,
    focus:effective.spirit ?? effective.focus ?? hud.baseStats?.focus,
  };
  const add=(key,count)=>{
    if(count<=0||remaining<=0)return;
    setPlan(current=>({...current,[key]:num(current[key])+Math.min(count,remaining)}));
    setReview(false);setNotice('');
  };
  const subtract=(key)=>{
    // Remove one UNSAVED planned point only; committed stats are immutable here.
    if(num(plan[key])<=0)return;
    setPlan(current=>({...current,[key]:Math.max(0,num(current[key])-1)}));
    setReview(false);setNotice('');
  };
  const allocate=()=>{
    setReview(false);
    if(spent<1)return;
    const result=applyAttributeAllocationPlan(plan);
    setNotice(result.ok ? 'Allocated '+result.spent+' character attribute points.'
      : String(result.reason || 'Unable to allocate points').replaceAll('_',' '));
    if(result.ok)setPlan({});
  };
  const equippedSlot=([slot,index])=>{
    const gear=slotItem(slot,index);
    const label=(SLOT_LABELS[slot] || caption(slot))+
      (AXE_EQUIPMENT_SLOT_DEFS[slot].maxEquipped>1?' '+(index+1):'');
    return <div key={slot+index} className="axe-app-viewer-slot axe-char-viewer-slot"
      title={gear?gear.name:label+' empty'} aria-label={label+': '+(gear?.name||'Empty')}>
      <span className="axe-app-viewer-slot-art"><GearIcon item={gear || { slot }} /></span>
      <small>{label}</small><span className="axe-app-viewer-item-name">{gear?.name||'—'}</span>
    </div>;
  };
  return <div className={'axe-app-root axe-char-root'+(embedded?' axe-char-root--embedded':'')}
    aria-label="Character attributes and equipment">
    {!embedded&&<div className="axe-app-brand"><span className="axe-app-banner" aria-hidden="true">✧</span>
      <div><h2>Character</h2><p>Attributes, equipped gear, and live combat statistics</p></div>
      <div className="axe-char-level">Level {display(hud.level)} <span>{display(points)} unspent points</span></div>
    </div>}
    <div className="axe-char-layout">
      <section className="axe-app-model-stage axe-char-model-stage" aria-label="Player 3D viewer with all supported equipment slots">
        <div className="axe-app-model-glow" aria-hidden="true"/>
        <div className="axe-app-viewer-gear axe-app-viewer-gear--left">
          {CHARACTER_DISPLAY_SLOTS.slice(0,SLOT_SPLIT).map(equippedSlot)}
        </div>
        <div className="axe-app-model-center axe-char-model-center">
          <Suspense fallback={<p className="axe-app-loading">Loading character model…</p>}>
            <div className="axe-app-model-host"><PlayerModel/></div>
          </Suspense>
        </div>
        <div className="axe-app-viewer-gear axe-app-viewer-gear--right">
          {CHARACTER_DISPLAY_SLOTS.slice(SLOT_SPLIT).map(equippedSlot)}
        </div>
        <div className="axe-app-model-caption">
          <strong>Character Equipment</strong>
          <span>{equippedDisplayCount} equipped slots · Stats update automatically</span>
        </div>
      </section>

      <aside className="axe-char-stats-column" aria-label="Complete live character information and statistics">
        <section className="axe-app-card axe-char-live-stats" aria-label="Real-time total character stats">
          <header className="axe-app-card-heading"><Activity size={21}/><h3>Character Stats</h3>
            <small>Live totals</small></header>
          <div className="axe-app-card-content">
            <div className="axe-char-profile" aria-label="Current character profile">
              <div><span>Character</span><strong>{activeCharacter?.name || 'Character'}</strong></div>
              <div><span>Level</span><strong>{display(hud.level)}</strong></div>
              <div><span>Experience</span><strong>{display(hud.xp)}</strong></div>
              {(activeCharacter?.className || activeCharacter?.role) && <div><span>Class / Role</span>
                <strong>{activeCharacter.className || activeCharacter.role}</strong></div>}
              {(activeCharacter?.factionName || activeCharacter?.faction) && <div><span>Faction</span>
                <strong>{activeCharacter.factionName || activeCharacter.faction}</strong></div>}
            </div>
            <div className="axe-char-allocation-section" aria-label="Spend character attribute points">
              <div className="axe-char-alloc-heading">
                <h4 className="axe-char-section-title">Increase Attributes</h4>
                <small>{display(remaining)} points available</small>
              </div>
              <div className="axe-char-primary-stats">
                {ATTRIBUTES.map(({key,name,info})=><div key={key} className="axe-char-inline-attribute">
                  <span className="axe-char-attribute-name" title={info}>{name}</span>
                  <div className="axe-char-attribute-buttons" role="group" aria-label={name + ' point allocation'}>
                    <button type="button" aria-label={'Remove one pending point from '+name}
                      title={'Undo one pending '+name+' point'} disabled={num(plan[key])<=0}
                      onClick={()=>subtract(key)}>−</button>
                    <button type="button" aria-label={'Add one point to '+name}
                      disabled={!remaining} onClick={()=>add(key,1)}>+</button>
                    <button type="button" aria-label={'Add five points to '+name}
                      disabled={!remaining} onClick={()=>add(key,5)}>+5</button>
                    <button type="button" aria-label={'Add ten points to '+name}
                      disabled={!remaining} onClick={()=>add(key,10)}>+10</button>
                    <button type="button" aria-label={'Assign all remaining points to '+name}
                      disabled={!remaining} onClick={()=>add(key,remaining)}>Max</button>
                  </div>
                  <span className="axe-char-attribute-total" aria-label={name + ' current total'}>
                    <b>{display(totalAttr[key])}</b>
                    {num(plan[key])>0 && <small>+{display(plan[key])}</small>}
                  </span>
                </div>)}
              </div>
              <div className="axe-char-allocation-footer">
                <span>{display(spent)} pending · {display(remaining)} remaining</span>
                <button type="button" disabled={!spent} onClick={()=>setPlan({})}>Reset</button>
                <button type="button" disabled={!spent} onClick={()=>setReview(true)}>
                  <Check size={14}/> Apply Points</button>
              </div>
              {notice && <p className="axe-char-notice" role="status">{notice}</p>}
            </div>
            <h4 className="axe-char-section-title">Combat &amp; Secondary Stats</h4>
            <div className="axe-char-stat-list">
              {METRICS.map(([label,key,unit])=><div className="axe-char-stat-row" key={key}>
                <span>{label}</span><b>{display(key==='criticalDamage' ? num(derived[key])*100 : derived[key])}{unit||''}</b></div>)}
            </div>
            <p className="axe-char-explanation">Totals include equipped armor, weapons, gems, runes, wings, halo, cores, and active progression bonuses.</p>
          </div>
        </section>
      </aside>
    </div>
    {review && <div className="axe-char-review-backdrop" role="presentation">
      <div className="axe-char-review" role="dialog" aria-modal="true" aria-label="Confirm character attribute allocation">
        <h3>Allocate {spent} Attribute Points?</h3>
        <p>{ATTRIBUTES.filter(({key})=>plan[key]).map(({key,name})=>name+' +'+plan[key]).join(' · ')}</p>
        <p>These points will be saved to this character and will immediately affect combat.</p>
        <div><button type="button" onClick={()=>setReview(false)}>Cancel</button>
          <button type="button" onClick={allocate}>Confirm Allocation</button></div>
      </div>
    </div>}
  </div>;
}
