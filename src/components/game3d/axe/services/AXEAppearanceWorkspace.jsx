import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  Check, Crown, Feather, Gem, Shield, Shirt, Sparkles, UserRound, X,
} from 'lucide-react';
import { getAXEVanityState, subscribeAXEVanity, equipAXEVanityPiece } from '../progression/AXEVanityStore';
import { AXE_VANITY_PIECES, AXE_VANITY_SLOTS } from '../progression/AXEVanitySystem';
import { getAXECostumeState, subscribeAXECostumes, equipAXECostume } from '../progression/AXECostumeStore';
import { AXE_COSTUME_DEFINITIONS } from '../progression/AXECostumeSystem';
import { getAXECapeState, subscribeAXECapes } from '../progression/AXECapeStore';
import { getAXECapeBonuses, getAXECapeDefinition } from '../progression/AXECapeSystem';
import { subscribeCharacterChange } from '../../characterStorage';
import { getAllAXEEquipmentItems, subscribeAXEEquipmentInventory } from '../equipment/AXEEquipmentInventoryStore';
import { subscribeAXEAura } from '../equipment/AXEEquipmentAuraStore';
import { getAppearanceAuraSource, subscribeAppearanceAuraSource, selectAppearanceAuraSource } from './AXEAppearanceAuraSelection';
import AXEAppearanceDetails from './AXEAppearanceDetails';
import AXEGlassLoadoutPane from './AXEGlassLoadoutPane';
import './AXEAppearanceWorkspace.css';

const GameCharacterPreview = lazy(() => import('../../equipment/EquipmentPreview3D'));
const CharacterWorkspace = lazy(() => import('./AXECharacterWorkspace'));
const CapeSubTab = lazy(() => import('../../progression/hub/CapeSubTab'));
const TAB_NAMES = ['Character', 'Equipment', 'Vanity', 'Aura'];
// Eight viewer slots (four on each side) remain visible on every Appearance tab.
// Arms has no separate Vanity slot in the current equipment rules; render its
// actual empty state instead of inventing an item to match concept artwork.
export const APPEARANCE_SLOTS = [
  ['head', 'Head', Crown], ['torso', 'Chest', Shirt], ['arms', 'Arms', Shield], ['customs', 'Customs', Shirt],
  ['leggings', 'Legs', Shield], ['pelvis', 'Waist', Gem], ['cape', 'Cape', Feather], ['aura', 'Aura', Sparkles],
];
const LABELS = { hp:'HP', maxHP:'HP', damage:'Attack', strength:'Strength',
  defense:'Defense', spirit:'Spirit', focus:'Focus', dexterity:'Dexterity',
  constitution:'Constitution', critChance:'Crit Rate', critDamage:'Crit Damage',
  criticalDefense:'Critical Defense', critDefense:'Critical Defense',
  chi:'Chi', attributionAttack:'Attribute Attack', attributionDefense:'Attribute Defense' };
const PERCENT_STATS = new Set(['critChance', 'critDamage', 'criticalDefense', 'critDefense']);
const number = value => Number(value || 0);
const pretty = value => number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
function bonusText(stats) {
  const entries = Object.entries(stats || {}).filter(([,value]) => number(value));
  return entries.length ? entries.map(([key,value]) =>
    (LABELS[key] || key) + ' +' + pretty(value) + (PERCENT_STATS.has(key) ? '%' : '')).join(' · ') : 'No stat bonuses';
}
function useLive(subscribe, read) {
  const [value, setValue] = useState(read);
  useEffect(() => subscribe(setValue), [subscribe]);
  return value;
}
function GlassCard({ title, icon: Icon, extra, headingAction, className = '', children }) {
  return <section className={'axe-app-card ' + className}>
    <header className="axe-app-card-heading">{Icon && <Icon size={21} aria-hidden="true"/>}
      <h3>{title}</h3>{headingAction}{extra && <small>{extra}</small>}</header>
    <div className="axe-app-card-content">{children}</div>
  </section>;
}
function ItemSymbol({ item }) {
  if (item?.appearanceImage || item?.iconUrl) {
    return <img src={item.appearanceImage || item.iconUrl} alt="" loading="lazy" draggable={false}/>;
  }
  return item?.kind === 'costume' ? <Shirt size={34}/> : <Gem size={34}/>;
}

export default function AXEAppearanceWorkspace({
  serviceId = 'character', stationMessage = '', initialTab = null, onClose,
  onActiveTabChange, focusCharacterRequest = 0,
}) {
  const vanity = useLive(subscribeAXEVanity, getAXEVanityState);
  const costumes = useLive(subscribeAXECostumes, getAXECostumeState);
  const capes = useLive(subscribeAXECapes, getAXECapeState);
  const [allEquipment,setAllEquipment] = useState(getAllAXEEquipmentItems);
  const [auraRecords,setAuraRecords] = useState({});
  const [auraSource,setAuraSource] = useState(getAppearanceAuraSource);
  useEffect(()=>subscribeAXEEquipmentInventory(state=>setAllEquipment(state?.items||getAllAXEEquipmentItems())),[]);
  useEffect(()=>subscribeAXEAura(setAuraRecords),[]);
  useEffect(()=>subscribeAppearanceAuraSource(setAuraSource),[]);
  const [tab, setTab] = useState(() => initialTab === 'Equipment' ? 'Equipment' : serviceId === 'equipment_aura' ? 'Aura' : serviceId === 'vanity' ? 'Vanity' : serviceId === 'costume' ? 'Vanity' : 'Character');
  // Report the actual visible Character/Equipment/Vanity/Aura subpage so C
  // returns from a different subpage before toggling the menu closed.
  useEffect(() => { onActiveTabChange?.(tab); }, [tab, onActiveTabChange]);
  useEffect(() => {
    if (focusCharacterRequest > 0) setTab('Character');
  }, [focusCharacterRequest]);
  const [selected, setSelected] = useState(null); // {kind: 'vanity'|'costume', id}
  const [detail, setDetail] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    const destination = initialTab === 'Equipment' ? 'Equipment' : serviceId === 'equipment_aura' ? 'Aura' : serviceId === 'vanity' ? 'Vanity' : serviceId === 'costume' ? 'Vanity' : 'Character';
    setTab(destination);
    setFilter(serviceId === 'costume' ? 'Costumes' : 'All');
    setSelected(null); setDetail('');
  }, [serviceId, initialTab]);
  useEffect(() => subscribeCharacterChange(() => {
    setSelected(null); setDetail(''); setNotice(''); setFilter('All');
  }), []);

  const ownedCostumes = useMemo(() => (costumes.owned || [])
    .map(id => AXE_COSTUME_DEFINITIONS[id]).filter(Boolean), [costumes.owned]);
  const ownedVanity = useMemo(() => (vanity.ownedPieceIds || [])
    .map(id => AXE_VANITY_PIECES[id]).filter(Boolean), [vanity.ownedPieceIds]);
  const ownedAuras = useMemo(() => allEquipment.filter(item=>auraRecords[item.instanceId]).map(item=>({
    id:item.instanceId,kind:'aura',name:(item.name||'Equipment')+' Aura',aura:auraRecords[item.instanceId],item,
  })),[allEquipment,auraRecords]);
  const equippedAura = ownedAuras.find(entry=>entry.id===auraSource) || null;
  const inventory = useMemo(() => [
    ...ownedVanity.map(piece => ({ ...piece, kind:'vanity' })),
    ...ownedCostumes.map(costume => ({ ...costume, kind:'costume' })),
  ], [ownedVanity, ownedCostumes]);
  const visibleInventory = inventory.filter(item => filter === 'All' ||
    (filter === 'Vanity' && item.kind === 'vanity') ||
    (filter === 'Costumes' && item.kind === 'costume'));
  // Display real owned item details immediately, rather than an empty template.
  const selectedItem = visibleInventory.find(item => item.kind === selected?.kind && item.id === selected?.id)
    || visibleInventory[0] || null;
  const currentCostume = AXE_COSTUME_DEFINITIONS[costumes.equippedCostumeId];
  const equippedCape = capes.equippedCapeId ? getAXECapeDefinition(capes.equippedCapeId) : null;
  const equippedPieces = Object.entries(vanity.equippedBySlot || {})
    .map(([slot,id]) => ({slot,piece:AXE_VANITY_PIECES[id]}))
    .filter(row => row.piece?.slot === row.slot);

  const showTab = next => {
    setTab(next); setFilter('All');
    setDetail(''); setNotice('');
  };
  const selectItem = item => {
    setSelected({kind:item.kind,id:item.id});
    
  };
  // One click inspects; double-click equips exactly the clicked owned item.
  // Do not rely on the selected state: React may not have committed the
  // second click before the double-click event arrives.
  const equipFromInventory = item => {
    selectItem(item);
    const result = item.kind === 'vanity' ? equipAXEVanityPiece(item.id)
      : item.kind === 'costume' ? equipAXECostume(item.id)
      : {ok:false,reason:'Unsupported appearance item'};
    setNotice(result.ok ? (result.message || item.name + ' equipped.')
      : (result.message || result.reason || 'Unable to equip appearance.'));
  };
  const selectOutfit = def => {
    setSelected({kind:'costume',id:def.id});
    if(tab==='Character'){
      // The outfit wardrobe now lives BESIDE the original character box.
      // Selecting a real owned outfit equips it directly so the shared 3D
      // viewer and real equipment stats refresh without leaving Character.
      const result=equipAXECostume(def.id);
      setNotice(result.ok?(result.message||def.name+' equipped.') :
        (result.message||result.reason||'Unable to equip outfit.'));
    }else { showTab('Vanity'); setFilter('Costumes'); }
  };
  const handleSlot = slot => {
    if (slot === 'cape') { setDetail('cape'); return; }
    if (slot === 'aura') { showTab('Aura');return; }
    if (slot === 'customs') { showTab('Vanity');setFilter('Costumes');return; }
    const id = vanity.equippedBySlot?.[slot];
    setTab('Vanity'); setFilter('Vanity'); setDetail('');
    setSelected(id ? {kind:'vanity',id} : null);
  };

  const gearSlot = ([slot,label,Icon]) => {
    const id = slot === 'cape' ? capes.equippedCapeId : vanity.equippedBySlot?.[slot];
    const def = slot === 'cape' ? equippedCape : slot === 'aura' ? equippedAura
      : slot === 'customs' ? currentCostume : AXE_VANITY_PIECES[id];
    return <button key={slot} type="button" className="axe-app-viewer-slot"
      title={def?.name || label + ' slot empty'} aria-label={label + ': ' + (def?.name || 'Empty')}
      onClick={() => handleSlot(slot)}>
      <span className="axe-app-viewer-slot-art"><Icon size={29}/></span>
      <small>{label}</small><span className="axe-app-viewer-item-name">{def?.name || '—'}</span>
    </button>;
  };


  // Retain the ONLY Overview feature the owner wants: the live owned outfit
  // selector. Reuse the same rail alongside the embedded Character panel.
  const outfitRail = (<aside className="axe-app-rail" aria-label="Costume wardrobe outfits">
        <div className="axe-app-rail-glyph"><Shirt size={21}/><span>Outfits</span></div>
        {ownedCostumes.map(def => <button type="button" key={def.id}
          title={def.name} aria-label={'Select outfit '+def.name}
          aria-pressed={selected?.kind === 'costume' && selected.id === def.id ||
            !selected && costumes.equippedCostumeId === def.id}
          onClick={() => selectOutfit(def)}>
          <UserRound size={23}/><span className="axe-app-rail-name">{def.name}</span>
          {costumes.equippedCostumeId === def.id && <Check className="axe-app-rail-check" size={13}/>}
        </button>)}
        {!ownedCostumes.length && <small>No outfits owned</small>}
      </aside>);

  return <div className="axe-app-root" aria-label="Character, equipment and appearance customization">
    <div className="axe-app-brand"><span className="axe-app-banner" aria-hidden="true">✧</span>
      <div><h2>Character</h2><p>Character attributes, equipped gear, outfits and appearance.</p></div>
      {stationMessage && <p className="axe-app-placement-note" role="status">
        <span aria-hidden="true">ⓘ</span>{stationMessage}</p>}
      {onClose&&<button type="button" data-service-close className="axe-app-unified-close"
        aria-label="Close Character" onClick={onClose}>Close <X size={15}/></button>}
    </div>
    <nav className="axe-app-tabs" aria-label="Character and appearance tabs">
      {TAB_NAMES.map(name => <button type="button" key={name} aria-pressed={tab === name}
        onClick={() => showTab(name)}>{name === 'Character' ? <UserRound size={20}/> :
          name === 'Equipment' ? <Shield size={20}/> : name === 'Vanity' ? <Gem size={20}/> : name === 'Aura' ? <Sparkles size={20}/> : <Feather size={20}/>}
        <span>{name}</span></button>)}
    </nav>

    {tab === 'Equipment' ? <AXEGlassLoadoutPane actor="player" onNotice={setNotice}/> :
      tab === 'Character' ? <div className="axe-app-unified-character-layout">
        {outfitRail}
        <section className="axe-app-unified-character-panel"
          aria-label="Character 3D viewer, equipment, attributes and live statistics">
          <Suspense fallback={<p className="axe-app-loading">Loading Character…</p>}>
            <CharacterWorkspace embedded/>
          </Suspense>
          {notice && <div className="axe-app-notice" role="status">{notice}
            <button type="button" onClick={()=>setNotice('')}
              aria-label="Dismiss outfit message"><X size={15}/></button>
          </div>}
        </section>
      </div> : <div className="axe-app-layout">
      {outfitRail}

      <section className={"axe-app-model-stage"+(equippedAura?' axe-app-model-stage--aura':'')} aria-label="Character 3D viewer and equipped appearance slots">
        <div className="axe-app-model-glow" aria-hidden="true"/>
        <div className="axe-app-viewer-gear axe-app-viewer-gear--left" aria-label="Equipped left-side slots">
          {APPEARANCE_SLOTS.slice(0,4).map(gearSlot)}
        </div>
        <div className="axe-app-model-center">
          <Suspense fallback={<p className="axe-app-loading">Loading your character…</p>}>
            <div className="axe-app-model-host"><GameCharacterPreview/></div>
          </Suspense>
        </div>
        <div className="axe-app-viewer-gear axe-app-viewer-gear--right" aria-label="Equipped right-side slots">
          {APPEARANCE_SLOTS.slice(4).map(gearSlot)}
        </div>
        <div className="axe-app-model-caption">
          <strong>{currentCostume?.name || 'Current Appearance'}</strong>
          <span>Equipped appearance · {equippedPieces.length} vanity pieces</span>
        </div>
      </section>

      <main className="axe-app-main-stack" aria-label="Appearance inventory">
        {detail === 'cape' ? <GlassCard title="Capes" icon={Feather} extra="Owned cape progression">
          <button type="button" className="axe-app-back" onClick={() => setDetail('')}>← Back to Inventory</button>
          <div className="axe-app-embedded"><Suspense fallback={<p>Loading capes…</p>}><CapeSubTab/></Suspense></div>
        </GlassCard> : tab === 'Aura' ? <GlassCard title="Inventory Aura" icon={Sparkles}
          extra={ownedAuras.length+' owned'} className="axe-app-inventory">
          <p className="axe-app-inventory-note">Auras already attached to your owned equipment. Selecting one changes the visible player Aura, not its underlying equipment stats.</p>
          <div className="axe-app-inventory-grid" role="list" aria-label="Owned aura inventory">
            {ownedAuras.map(aura=><button type="button" role="listitem" key={aura.id}
              className="axe-app-inventory-tile" aria-pressed={(selected?.id||auraSource)===aura.id}
              onClick={()=>setSelected({kind:'aura',id:aura.id})}
              onDoubleClick={()=>{const result=selectAppearanceAuraSource(aura.id);
                setNotice(result.ok?aura.name+' appearance equipped.':result.reason);}}>
              <span className="axe-app-inventory-art"><Sparkles size={32}/></span>
              <span className="axe-app-inventory-name">{aura.name}</span>
              <small>Tier {aura.aura.tierRank}</small>
              {auraSource===aura.id && <Check className="axe-app-equipped-check" size={17} aria-label="Active Aura"/>}
            </button>)}
            {!ownedAuras.length && <p className="axe-app-inventory-empty">You do not own any equipment with an Aura effect yet.</p>}
          </div>
        </GlassCard> : <GlassCard title="Inventory" icon={Gem}
          extra={visibleInventory.length + ' shown · ' + inventory.length + ' owned'}
          headingAction={<label className="axe-app-inventory-filter-select">
            <span className="sr-only">Filter inventory</span>
            <select aria-label="Filter inventory" value={filter}
              onChange={event => setFilter(event.target.value)}>
              <option value="All">All</option><option value="Vanity">Vanity</option>
              <option value="Costumes">Costumes</option>
            </select>
          </label>}
          className="axe-app-inventory">
          <div className="axe-app-inventory-browser">
          <div className="axe-app-inventory-filters" role="group" aria-label="Inventory filter">
            {['All','Vanity','Costumes'].map(kind => <button type="button" key={kind}
              aria-pressed={filter === kind} onClick={() => setFilter(kind)}>{kind}</button>)}
          </div>
          <div className="axe-app-inventory-grid" role="list" aria-label="Owned vanity pieces and costumes">
            {visibleInventory.map(item => <button type="button" role="listitem"
              key={item.kind + ':' + item.id} className="axe-app-inventory-tile"
              aria-pressed={selected?.kind === item.kind && selected.id === item.id}
              aria-label={item.name + ' · ' + item.kind} onClick={() => selectItem(item)}
              onDoubleClick={() => equipFromInventory(item)}>
              <span className="axe-app-inventory-art"><ItemSymbol item={item}/></span>
              <span className="axe-app-inventory-name">{item.name}</span>
              <small>{item.kind === 'vanity' ? AXE_VANITY_SLOTS[item.slot]?.label || 'Vanity'
                : item.rarity || 'Costume'}</small>
              {(item.kind === 'vanity' && vanity.equippedBySlot?.[item.slot] === item.id ||
                item.kind === 'costume' && costumes.equippedCostumeId === item.id) &&
                <Check className="axe-app-equipped-check" size={17} aria-label="Equipped"/>}
            </button>)}
            {!visibleInventory.length && <p className="axe-app-inventory-empty">No owned items in this category.</p>}
          </div>
          </div>
        </GlassCard>}
      </main>

      <aside className="axe-app-right-stack" aria-label="Selected appearance details">
        {detail === 'cape' ? <GlassCard title="Equipped Cape" icon={Feather}>
          <h4>{equippedCape?.name || 'No cape equipped'}</h4>
          <p>{equippedCape ? bonusText(getAXECapeBonuses(capes.equippedCapeId)) : 'No cape bonuses'}</p>
          <button className="axe-app-manage" type="button" onClick={() => setDetail('')}>Back to Inventory</button>
        </GlassCard> : tab === 'Aura' ? <GlassCard title="Aura Details" icon={Sparkles}
          extra="Equipped appearance">
          {(()=>{
            const chosen=ownedAuras.find(aura=>aura.id===selected?.id)||equippedAura||ownedAuras[0];
            return chosen ? <>
              <h4>{chosen.name}</h4>
              <p>Source Equipment: {chosen.item.name}</p>
              <p>Tier {chosen.aura.tierRank}</p>
              {chosen.aura.effects?.map(effect=><div key={effect.id} className="axe-app-bonus-row">
                <span>{LABELS[effect.stat]||effect.stat}</span><b>+{pretty(effect.value)}</b>
              </div>)}
              <p>Aura bonuses remain attached to the original equipment. Appearance selection only chooses its visual glow.</p>
              <button className="axe-app-manage" type="button"
                disabled={auraSource===chosen.id}
                onClick={()=>{const result=selectAppearanceAuraSource(chosen.id);
                  setNotice(result.ok?'Aura appearance equipped.':result.reason);}}>
                {auraSource===chosen.id?'Aura Equipped':'Equip Aura'}
              </button>
              {auraSource && <button className="axe-app-back" type="button"
                onClick={()=>{selectAppearanceAuraSource('');setNotice('Aura appearance hidden.');}}>Hide Aura</button>}
            </> : <p>No owned equipment Aura to equip.</p>;
          })()}
        </GlassCard> : <AXEAppearanceDetails
          key={tab}
          tab={tab} selectedItem={selectedItem}
          vanity={vanity} costumes={costumes}
          onSelectPiece={id => setSelected({kind:'vanity',id})}
          onNotice={setNotice}
        />}
        {notice && <div className="axe-app-notice" role="status">{notice}
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss message"><X size={15}/></button></div>}
      </aside>
    </div>}
    {tab === 'Equipment' && notice && <div className="axe-app-notice" role="status">{notice}
      <button type="button" onClick={()=>setNotice('')} aria-label="Dismiss message"><X size={15}/></button></div>}
  </div>;
}
