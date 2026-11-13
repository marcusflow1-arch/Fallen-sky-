import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronUp, ChevronDown, ChevronRight, Crown, MapPin, Plus, Settings, Sparkles, Trash2, X } from 'lucide-react';
import AvatarAppearanceDialog from '@/components/onboarding/AvatarAppearanceDialog';
import {useCompanionIdentity} from '@/components/onboarding/CompanionIdentityContext';
import {CULTURAL_INSPIRATIONS, GENRE_DIRECTIONS} from '@/components/onboarding/creatorCultures';
import {AXE_FACTIONS, getAXEFaction} from './axe/factions/AXEFactionWeaponConfig';
import CreatorStage from '@/components/onboarding/CreatorStage';
import FactionDossier from './axe/factions/FactionDossier';
import {
  subscribeCharacters,
  activateAndSyncToHUD,
  getCharacterState,
  upsertPlatformAvatarCharacter,
  deleteCreatedCharacter,
  isDeletableGame3DCharacter,
} from './characterStore';
import {callGameServer} from './social/socialServer';
import { subscribeCharacterChange, userScopedKey, getStorageUser } from './characterStorage';
import { readCharacterSelectionOverview, formatCharacterOverviewValue } from './character/characterSelectionOverview.mjs';
import { getLivingChronicleIdentity } from './character/livingChronicleIdentity.mjs';
import { getVisibleCrosslineSlots } from './character/characterCrossline.mjs';
import { computeDerivedStats } from './statsSystem';
import CharacterCreationModal from './CharacterCreationModal';
import WorkflowTeleportPanel from './workflow/WorkflowTeleportPanel';
import './CharacterLoginScreen.css';
import './CharacterLoginWorldEntry.css';
import './CharacterArcaneEntry.css';
import './CharacterLiquidGlassEntry.css';
import './CharacterSelectionPanorama.css';
import './CharacterLivingChronicle.css';
import './CharacterCrossline.css';
import './CharacterSelectionRefinement.css';
import './CharacterFactionDossier.css';
import './CharacterCreatorOriginalLayout.css';
import '@/components/onboarding/creator-viewport-fix.css';


function displayField(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}
function characterLevel(character) {
  try {
    const key = userScopedKey('wwm_player_progression_v1') + '::' + character.id;
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    const level = Number(saved?.level);
    return Number.isFinite(level) && level >= 1 ? Math.floor(level) : 1;
  } catch {
    return 1;
  }
}

const CHRONICLE_TABS = Object.freeze([
  {id:'overview',label:'Overview'},
  {id:'growth',label:'Growth'},
  {id:'spirit',label:'Spirit'},
  {id:'forge',label:'Forge'},
]);
const format = formatCharacterOverviewValue;
function InformationSection({ title, rows = [], children }) {
  return <section className="axe-login-info-section">
    <h3>{title}</h3>
    {rows.length > 0 && <dl className="axe-login-character-details">
      {rows.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value ?? '—'}</dd></div>)}
    </dl>}
    {children}
  </section>;
}
function SavedExperience({xp,required}){
  const available=Number.isFinite(xp) && Number.isFinite(required) && required>0;
  const fraction=available?Math.max(0,Math.min(100,xp/required*100)):0;
  const progressText=available ? `${format(xp)} of ${format(required)} experience` : 'Experience not recorded';
  return <div className="axe-login-experience" aria-label="Character experience progress">
    <div><span>Experience</span><strong>{format(xp)} / {format(required)}</strong></div>
    <div className="axe-login-experience-track" role="progressbar" aria-label="Experience to next level"
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={available?Math.round(fraction):undefined}
      aria-valuetext={progressText}>
      <span style={{width:`${fraction}%`}}/>
    </div>
  </div>;
}

/**
 * The actual Wolfveil renderer stays mounted beneath the character gateway.
 * An opaque arcane wallpaper conceals terrain until Enter World. Creation
 * saves back to selection; it never auto-enters or changes the account avatar.
 */
export default function CharacterLoginScreen({ onPlay, onBack, workflowEnabled = false, openCreator = false, liveWorld = false, worldReady = false, worldError = '', onRetryWorld, onEntryStepChange, onPrepareWorld, initialMusicVolume = 0.5, onMusicVolumeChange }) {
  const platformAvatar = useCompanionIdentity();
  const [roster, setRoster] = useState(() => getCharacterState().roster);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [saveTick, setSaveTick] = useState(0);
  // Pause menu → Create character: reopen selection with the local-only creator visible.
  const [step,setStep]=useState(()=>openCreator?'faction':'start');
  const [selectedFaction,setSelectedFaction]=useState(null);
  const [factionPreviewId,setFactionPreviewId]=useState(AXE_FACTIONS[0].id);
  const [showCreate, setShowCreate] = useState(false);
  const creatorSavedRef=useRef(false);
  const [showEditPlatformAvatar, setShowEditPlatformAvatar] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoTab, setInfoTab] = useState('overview');
  const infoScrollRef = useRef(null);
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [entering, setEntering] = useState(false);
  const [startError, setStartError] = useState('');
  const [deleteTarget,setDeleteTarget]=useState(null);
  const [deleteBusy,setDeleteBusy]=useState(false);
  const [deleteError,setDeleteError]=useState('');

  // Every game uses the one completed account avatar; Game 3D only adds its own progression slot.
  useEffect(() => {
    if (platformAvatar?.id && platformAvatar.setup_status === 'complete') {
      upsertPlatformAvatarCharacter(platformAvatar);
    }
  }, [platformAvatar]);

  useEffect(()=>{if(openCreator){setStep('faction');setShowCreate(false);}},[openCreator]);
  // Drive the camera in the existing Wolfveil canvas from the same menu state.
  useEffect(()=>{onEntryStepChange?.(entering?'select':showCreate?'creator':step);},[step,showCreate,entering,onEntryStepChange]);

  useEffect(() => subscribeCharacters((state) => {
    setRoster(state.roster);
    const visibleRoster = workflowEnabled ? state.roster : state.roster.filter(char=>!char.isDevTest);
    const activeIndex = visibleRoster.findIndex((char) => char.id === state.activeId);
    if (activeIndex >= 0) setSelectedIndex(activeIndex);
    else setSelectedIndex((current) => Math.min(current, Math.max(0, visibleRoster.length - 1)));
  }), [workflowEnabled]);
  useEffect(() => subscribeCharacterChange(() => setSaveTick((value) => value + 1)), []);

  const characters = useMemo(
    () => roster.map((char) => ({ ...char, level: characterLevel(char) })),
    [roster, saveTick],
  );
  // Dev Test is an editor fixture and must not count as a real player's character.
  const selectableCharacters = workflowEnabled ? characters : characters.filter(char=>!char.isDevTest);
  const playableCount = characters.filter(char=>!char.isDevTest).length;
  const selected = selectableCharacters[selectedIndex] || null;
  const rosterScrollRef = useRef(null);
  const characterWheelRef = useRef(null);
  const wheelLastChangeRef = useRef(0);
  const keyboardCharacterNavRef = useRef(false);
  // Switching saves must never strand the player halfway down the previous
  // character's detail pane (especially when Growth was scrolled deeply).
  useEffect(() => {
    setInfoTab('overview');
    if(infoScrollRef.current) infoScrollRef.current.scrollTop = 0;
  }, [selected?.id]);
  const switchInfoTab = tab => {
    if (!CHRONICLE_TABS.some(item => item.id === tab)) return;
    setInfoTab(tab);
    infoScrollRef.current?.scrollTo?.({
      top:0,
      behavior:motionEnabled && !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
        ? 'smooth' : 'auto',
    });
  };
  // Read the selected character's own saved data; never switch the active
  // character merely to preview another slot's progression in the menu.
  const overview = useMemo(
    () => selected ? readCharacterSelectionOverview(selected.id, getStorageUser()) : null,
    [selected?.id, saveTick, roster],
  );
  // The roster persists base attributes, not full post-gear combat totals.
  // Compute the canonical *unbuffed* values separately, never pretending these
  // previews are the equipped stats the game recalculates when entering world.
  const baseCombat = useMemo(() => overview?.hasPlayerSave &&
    Object.values(overview.baseStats).every(Number.isFinite)
      ? computeDerivedStats(overview.baseStats) : null, [overview]);
  const chronicle = useMemo(
    () => getLivingChronicleIdentity(selected, overview),
    [selected?.id, selected?.factionId, overview],
  );
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const portraitRail = window.matchMedia?.('(max-width:800px) and (orientation:portrait)')?.matches;
    const current = rosterScrollRef.current?.querySelector('[aria-pressed="true"]');
    // A keyboard-selected item remains focused even when perspective slots
    // unmount and remount around the newly selected character.
    if (keyboardCharacterNavRef.current) {
      current?.focus?.({ preventScroll:true });
      keyboardCharacterNavRef.current = false;
    }
    // Only portrait has a physically scrollable ribbon. Desktop slots are
    // transformed in perspective; scrollIntoView on them can scroll the whole
    // login page or displace the viewer while navigating.
    if (portraitRail) current?.scrollIntoView?.({
      block:'nearest', inline:'center',
      behavior: motionEnabled && !reduced ? 'smooth' : 'auto',
    });
  }, [selectedIndex, step, motionEnabled]);
  const cycleCharacter = stepAmount => {
    if (!selectableCharacters.length) return;
    setSelectedIndex(index => (index + stepAmount + selectableCharacters.length) % selectableCharacters.length);
    setStartError('');
  };
  // A wheel gesture over the RIGHT CHARACTER SELECTOR changes saved characters.
  // Attach a non-passive native listener: React wheel handlers are passive in
  // modern browsers, so preventDefault there does not reliably stop page scroll.
  // The left Chronicle's independent stats panel keeps its normal wheel scroll.
  useEffect(() => {
    if (step !== 'select' || selectableCharacters.length < 2) return undefined;
    const rail = characterWheelRef.current;
    if (!rail) return undefined;
    const count = selectableCharacters.length;
    const onCharacterWheel = event => {
      // Keep browser pinch-zoom and trackpad horizontal swipe intact.
      if (event.ctrlKey || event.metaKey ||
          Math.abs(event.deltaX) >= Math.abs(event.deltaY) ||
          Math.abs(event.deltaY) < 2) return;
      event.preventDefault();
      event.stopPropagation();
      const now = performance.now();
      if (now - wheelLastChangeRef.current < 170) return;
      wheelLastChangeRef.current = now;
      keyboardCharacterNavRef.current = false;
      setSelectedIndex(index => (index + (event.deltaY > 0 ? 1 : -1) + count) % count);
      setStartError('');
    };
    rail.addEventListener('wheel', onCharacterWheel, { passive:false });
    return () => rail.removeEventListener('wheel', onCharacterWheel);
  }, [step, selectableCharacters.length]);
  const startJourney=()=>setStep(playableCount?'select':'faction');
  // Destructive action runs only after explicit confirmation and the server's
  // owned-character tombstone acknowledgement. Failed/offline requests keep the
  // character untouched so it cannot reappear from a newer cloud copy.
  const confirmCharacterDelete=async()=>{
    if(deleteBusy || starting || !deleteTarget)return;
    const current=getCharacterState().roster.find(char=>char.id===deleteTarget.id);
    if(!isDeletableGame3DCharacter(current)){
      setDeleteError('This character cannot be deleted.');
      return;
    }
    setDeleteBusy(true);setDeleteError('');
    try {
      const result=await callGameServer('characterVault','delete',{characterId:current.id});
      if(result?.success!==true || result?.deleted!==true)throw new Error('The server did not confirm character deletion.');
      if(!deleteCreatedCharacter(current.id))throw new Error('The server deleted this character, but the local roster could not update. Refresh this page.');
      setDeleteTarget(null);
      setStartError('');
      if(!getCharacterState().roster.some(char=>!char.isDevTest))setStep('select');
    }catch(error){
      setDeleteError(error?.message||'Could not delete this character. Please retry.');
    }finally{setDeleteBusy(false);}
  };
  const classLabel = selected
    ? displayField(selected.className || selected.role || selected.faction, 'Adventurer')
    : '—';
  const factionLabel = selected ? (getAXEFaction(selected.factionId)?.displayName || displayField(selected.faction, 'Unassigned')) : '—';
  const stat = (value) => Number.isFinite(Number(value)) && value !== null && value !== undefined ? Math.max(0, Math.floor(Number(value))) : '—';
  const regionLabel = selected
    ? displayField(selected.lastLocation || selected.lastRegion, 'Wolfveil Valley')
    : '—';
  const worldGenre = GENRE_DIRECTIONS.find((item) => item.id === selected?.genre_direction)?.label || 'Fantasy';
  const inspirations = CULTURAL_INSPIRATIONS.filter((item) => selected?.cultural_inspirations?.includes(item.id))
    .map((item) => item.label).join(' · ') || 'Your original design';

  const enterWorld = async (region = 'wolfveil', workflowDestination = null, createdCharacter = null) => {
    const chosen=createdCharacter||selected;
    if (starting || !chosen) return;
    setStartError('');
    setStarting(true);
    try {
      // Play always activates the selected character in the real game world;
      // the retired workstream terrain is no longer a selectable destination.
      await activateAndSyncToHUD(chosen.id);
      // New body choices can swap GLBs. Keep the front-facing menu camera and
      // creation world up until the ACTUAL selected model is ready to animate.
      await onPrepareWorld?.(chosen);
      setEntering(true);
      // Dissolve the menu above the ALREADY mounted Wolfveil world.
      // Reduced-motion users skip camera theatrics.
      const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if(motionEnabled && !reduced) await new Promise(resolve=>window.setTimeout(resolve,650));
      await onPlay?.(['forest','astral-dungeon','lunar-cave'].includes(region) ? region : 'wolfveil', region === 'wolfveil' ? workflowDestination : null);
      return true;
    } catch (error) {
      setEntering(false);
      setStartError(error?.message || 'Unable to load this character.');
      return false;
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape' || event.repeat) return;
      if(deleteTarget){
        event.preventDefault();
        if(!deleteBusy){setDeleteTarget(null);setDeleteError('');}
        return;
      }
      if (showCreate || showEditPlatformAvatar || workflowOpen) return; // Each overlay owns its close flow.
      if (settingsOpen) { event.preventDefault(); setSettingsOpen(false); }
      else if (step === 'faction') { event.preventDefault(); setStep('select'); }
      else if (step === 'select') { event.preventDefault(); setStep('start'); }
      else if (onBack) { event.preventDefault(); onBack(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settingsOpen, showCreate, showEditPlatformAvatar, workflowOpen, deleteTarget, deleteBusy, onBack, step]);

  return (
    <main className={'axe-login axe-login--live-entry axe-login--arcane'+(entering?' axe-login--entering':'')} aria-label="Game 3D character selection" data-entry-step={step} data-live-world={liveWorld?'true':'false'} data-world-ready={worldReady?'true':'false'} data-motion={motionEnabled?'on':'off'} data-info-tab={infoTab} style={chronicle.css}>
      <div className="axe-login-scene" aria-hidden="true"><div className="axe-login-glyph"/><div className="axe-login-scrim" /></div>
      {step==='start' && <button type="button" className="axe-login-entrance-settings"
        aria-label="Game 3D settings" aria-expanded={settingsOpen}
        onClick={() => setSettingsOpen(open => !open)}><Settings size={24}/></button>}
      {settingsOpen && step==='start' && (
        <section className="axe-login-settings axe-login-arcane-settings" aria-label="Game 3D settings">
          <div className="axe-login-settings-heading"><strong>Game Settings</strong>
            <button type="button" aria-label="Close settings" onClick={()=>setSettingsOpen(false)}><X size={18}/></button>
          </div>
          <label className="axe-login-setting-field">
            <span>Music volume</span>
            <input type="range" min="0" max="1" step="0.05"
              value={initialMusicVolume}
              onChange={event=>onMusicVolumeChange?.(Number(event.target.value))}/>
          </label>
          <label className="axe-login-setting-field">
            <span>Animated glyphs</span>
            <input type="checkbox" checked={motionEnabled}
              onChange={event=>setMotionEnabled(event.target.checked)}/>
          </label>
          <p>System reduced-motion preferences are also respected.</p>
        </section>
      )}
      {step!=='start' && step!=='creator' && <h1 className="axe-login-page-title">
        {step==='faction'?'Choose a Faction':'Select Your Character'}
      </h1>}
      {step==='select' && <>
        <aside className="axe-login-stats-panel axe-login-info-rail" aria-label="Selected character information">
          <div className="axe-login-info-scroll">
            <header className="axe-chronicle-intro" aria-label="Selected character summary">
              <div className="axe-login-selected-identity">
                <p className="axe-login-panel-kicker">LIVING CHRONICLE</p>
                {selected ? <>
                  <div className="axe-chronicle-identity-row">
                    <h2>{selected.name}</h2>
                    <p className="axe-chronicle-path">{chronicle.phrase}</p>
                  </div>
                  <p className="axe-login-stats-level">Level {selected.level} <span>· {classLabel}</span></p>
                  <SavedExperience xp={overview?.xp} required={overview?.xpForNext}/>
                </> : <p className="axe-login-empty">Create a character to begin a new chronicle.</p>}
              </div>
            </header>
            {selected && <>
              <nav className="axe-chronicle-tabs" role="tablist" aria-label="Character details">
                {CHRONICLE_TABS.map(item=><button type="button" key={item.id}
                  role="tab" id={`axe-chronicle-tab-${item.id}`}
                  aria-selected={infoTab===item.id}
                  aria-controls="axe-chronicle-content"
                  tabIndex={infoTab===item.id?0:-1}
                  className={infoTab===item.id?'is-active':''}
                  onClick={()=>switchInfoTab(item.id)}
                  onKeyDown={event=>{
                    const key=event.key;
                    if(key!=='ArrowRight'&&key!=='ArrowLeft'&&key!=='Home'&&key!=='End')return;
                    event.preventDefault();
                    const current=CHRONICLE_TABS.findIndex(tab=>tab.id===infoTab);
                    const next=key==='Home'?0:key==='End'?CHRONICLE_TABS.length-1
                      :(current+(key==='ArrowRight'?1:-1)+CHRONICLE_TABS.length)%CHRONICLE_TABS.length;
                    switchInfoTab(CHRONICLE_TABS[next].id);
                    document.getElementById(`axe-chronicle-tab-${CHRONICLE_TABS[next].id}`)?.focus();
                  }}
                >{item.label}</button>)}
              </nav>
              <div className="axe-chronicle-content" ref={infoScrollRef}
                id="axe-chronicle-content" role="tabpanel" tabIndex={0}
                aria-labelledby={`axe-chronicle-tab-${infoTab}`} key={selected.id+'-'+infoTab}>
                {infoTab==='overview' && <>
                  <InformationSection title="Vitals" rows={[
                    ['HP',`${format(overview?.hp ?? selected.hp ?? selected.currentHp)} / ${format(selected.maxHp)}`],
                    ['Chi',`${format(selected.chi ?? selected.currentChi)} / ${format(selected.maxChi)}`],
                    ['Will',format(selected.will ?? selected.currentWill)],
                    ['Available points',format(overview?.unspentPoints)],
                  ]}/>
                  <InformationSection title="Primary Attributes" rows={[
                    ['Strength',format(overview?.baseStats.strength)],
                    ['Agility',format(overview?.baseStats.dexterity)],
                    ['Vitality',format(overview?.baseStats.constitution)],
                    ['Spirit',format(overview?.baseStats.focus)],
                  ]}/>
                  <InformationSection title="Spiritual Progress" rows={[
                    ['Halo',`Level ${format(overview?.spiritual.halo)}`],
                    ['Wings',overview?.spiritual.wingLevel != null
                      ? `${overview.spiritual.wingName} · Lv ${overview.spiritual.wingLevel}` : 'Not equipped'],
                    ['Title',overview?.spiritual.titleLevel != null
                      ? `${overview.spiritual.titleName} · Lv ${overview.spiritual.titleLevel}` : 'Not equipped'],
                  ]}/>
                </>}
                {infoTab==='growth' && <>
                  <InformationSection title="Character" rows={[
                    ['Faction',factionLabel],['Class',classLabel],
                    ['Region',regionLabel],['World style',worldGenre],['Inspirations',inspirations],
                  ]}/>
                  <InformationSection title="Recorded Combat" rows={[
                    ['Attack',format(selected.attack)],['Defense',format(selected.defense)],
                    ['Accuracy',format(selected.accuracy)],['Evasion',format(selected.evasion)],
                    ['Critical rate',format(selected.critChance,'%')],
                    ['Critical defense',format(selected.criticalDefense)],
                    ['Attack speed',format(selected.attackSpeed)],
                  ]}/>
                  <InformationSection title="Base Combat · Without Gear" rows={[
                    ['Attack',format(baseCombat?.damage)],['Defense',format(baseCombat?.defense)],
                    ['Max HP',format(baseCombat?.maxHP)],['Max Chi',format(baseCombat?.chi)],
                    ['Hit chance',format(baseCombat?.hitChance,'%')],
                    ['Evasion',format(baseCombat?.evasionPct,'%')],
                    ['Critical rate',format(baseCombat?.critChance,'%')],
                    ['Critical defense',format(baseCombat?.criticalDefense)],
                    ['Attack speed',format(baseCombat?.attackSpeedPct,'%')],
                  ]}/>
                  <InformationSection title="Evolution" rows={[
                    ['Power tier',overview?.hasPlayerSave ? overview.power.tier : '—'],
                    ['Power level',format(overview?.hasPlayerSave ? overview.power.tierLevel : null)],
                    ['Master',format(overview?.hasPlayerSave ? overview.power.master : null)],
                    ['Adept Master',format(overview?.hasPlayerSave ? overview.power.adept : null)],
                    ['God',format(overview?.hasPlayerSave ? overview.power.god : null)],
                    ['Rebirth',format(overview?.hasPlayerSave ? overview.power.rebirth : null)],
                    ['Palace rank',format(overview?.hasPlayerSave ? overview.power.palace : null)],
                    ['Ascension',format(overview?.hasPlayerSave ? overview.power.ascension : null)],
                  ]}/>
                </>}
                {infoTab==='spirit' && <>
                  <InformationSection title="Spirituality" rows={[
                    ['Halo level',format(overview?.spiritual.halo)],
                    ['Aura level',format(overview?.spiritual.aura)],
                    ['Equipped wings',overview?.spiritual.hasSpiritualSave ? overview.spiritual.wingName : '—'],
                    ['Wing level',format(overview?.spiritual.wingLevel)],
                    ['Wing reinforcement',format(overview?.spiritual.wingReinforcement,'%')],
                    ['Equipped title',overview?.spiritual.hasSpiritualSave ? overview.spiritual.titleName : '—'],
                    ['Title level',format(overview?.spiritual.titleLevel)],
                    ['Title contribution',format(overview?.spiritual.titleContribution)],
                  ]}/>
                  <InformationSection title="Buddha Essence">
                    <dl className="axe-login-character-details">
                      {(overview?.spiritual.essence || []).map(essence=><div key={essence.id}>
                        <dt>{essence.label}</dt>
                        <dd>Lv {essence.level} <small>· {essence.xp}/{essence.nextCost} XP</small></dd>
                      </div>)}
                    </dl>
                    <p className="axe-login-info-footnote">Allocated levels: {format(overview?.spiritual.essenceUsed)}</p>
                  </InformationSection>
                  {!!overview?.spiritual.wingPaths.length && <InformationSection title="Wing Paths"
                    rows={overview.spiritual.wingPaths.map(item=>[item.label,`Lv ${item.level} · +${format(item.reinforcement,'%')}`])}/>}
                  {!!overview?.spiritual.titlePaths.length && <InformationSection title="Title Paths"
                    rows={overview.spiritual.titlePaths.map(item=>[item.label,`Lv ${item.level}`])}/>}
                </>}
                {infoTab==='forge' && <>
                  <InformationSection title="Blacksmith / Forge" rows={[
                    ['Upgraded items',format(overview?.forge.hasSave ? overview.forge.itemCount : null)],
                    ['Total enchant levels',format(overview?.forge.hasSave ? overview.forge.totalEnchant : null)],
                    ['Highest enchant',format(overview?.forge.hasSave ? overview.forge.highestEnchant : null)],
                    ['Highest over-enchant',format(overview?.forge.hasSave ? overview.forge.highestOverEnchant : null)],
                    ['Highest reinforcement',format(overview?.forge.hasSave ? overview.forge.highestReinforcement : null,'%')],
                  ]}/>
                  <p className="axe-login-info-disclaimer">Detailed upgrades and equipment can be inspected and changed at the Blacksmith after entering the world.</p>
                </>}
                <p className="axe-login-info-disclaimer">Saved character preview. A dash means no recorded value; actual equipped combat totals are recalculated in-world.</p>
              </div>
            </>}
          </div>
        </aside>
        <section className="axe-login-character-panel axe-login-xross-roster"
          ref={characterWheelRef} aria-label="Character selection">
          <div className="axe-crossline-heading">
            <span>YOUR CHARACTERS</span>
            <span className="axe-crossline-capacity">{playableCount} / 8</span>
          </div>
          <div className="axe-crossline-track" ref={rosterScrollRef}
            aria-label="Choose a saved character"
            onKeyDown={event=>{
              if(event.altKey || event.ctrlKey || event.metaKey || !selectableCharacters.length) return;
              const key = event.key;
              if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(key)) return;
              event.preventDefault();
              const next = key==='Home' ? 0 : key==='End' ? selectableCharacters.length-1
                : (selectedIndex + (key==='ArrowUp'||key==='ArrowLeft'?-1:1)
                  + selectableCharacters.length) % selectableCharacters.length;
              if(next !== selectedIndex){
                keyboardCharacterNavRef.current = true;
                setSelectedIndex(next);
                setStartError('');
              }
            }}>
            <span className="axe-crossline-guide" aria-hidden="true"/>
            {getVisibleCrosslineSlots(selectableCharacters.length,selectedIndex).map(({index,offset})=>{
              const character=selectableCharacters[index];
              return <div className={'axe-crossline-slot'+(offset===0?' is-current':'')}
                data-offset={offset} key={character.id}
                style={{'--cross-offset':offset,'--cross-distance':Math.abs(offset)}}>
                <button type="button"
                  className={'axe-login-roster-entry axe-crossline-choice'+(offset===0?' is-selected':'')}
                  onClick={()=>{keyboardCharacterNavRef.current=false;setSelectedIndex(index);setStartError('');}}
                  aria-pressed={offset===0} tabIndex={offset===0?0:-1}
                  aria-label={`${character.name}, level ${character.level}${offset===0?', selected':''}`}>
                  <span className="axe-crossline-name"><strong>{character.name}</strong>
                    {character.isDevTest && <small className="axe-crossline-editor"><Crown size={11}/> EDITOR</small>}
                  </span>
                  <small className="axe-crossline-level">LV {character.level}</small>
                </button>
              </div>;
            })}
            {selectableCharacters.length===0 && <p className="axe-crossline-empty">Your story begins with a new character.</p>}
          </div>
          <div className="axe-crossline-footer">
            <div className="axe-crossline-pager" aria-label="Browse characters">
              <button type="button" disabled={selectableCharacters.length<2}
                aria-label="Previous character" onClick={()=>cycleCharacter(-1)}><ChevronUp size={18}/></button>
              <span aria-live="polite">{selected ? selectedIndex+1 : 0} / {selectableCharacters.length}</span>
              <button type="button" disabled={selectableCharacters.length<2}
                aria-label="Next character" onClick={()=>cycleCharacter(1)}><ChevronDown size={18}/></button>
            </div>
            <div className="axe-crossline-actions" role="group" aria-label="Character actions">
              {playableCount<8 && <button type="button" className="axe-login-create-minimal axe-crossline-action"
                onClick={()=>setStep('faction')}><Plus size={18}/><span>New Character</span></button>}
              {selected && isDeletableGame3DCharacter(selected) && (
                <button type="button" className="axe-login-roster-delete axe-crossline-action axe-crossline-delete"
                  aria-label={'Delete '+selected.name} disabled={starting||deleteBusy}
                  onClick={()=>{setDeleteError('');setDeleteTarget({id:selected.id,name:selected.name});}}>
                  <Trash2 size={16} strokeWidth={1.7}/><span>Delete</span>
                </button>
              )}
              {selected?.platform_avatar_id && <button type="button" className="axe-crossline-action"
                onClick={()=>setShowEditPlatformAvatar(true)}>
                <Sparkles size={16}/><span>Customize Avatar</span>
              </button>}
              {workflowEnabled && <button type="button" className="axe-crossline-action"
                onClick={()=>setWorkflowOpen(true)} disabled={!selected||starting}>
                <MapPin size={16}/><span>Workflow</span>
              </button>}
            </div>
          </div>
        </section>
      </>}

      {step==='faction' && (
        <FactionDossier
          activeId={factionPreviewId}
          onPreview={setFactionPreviewId}
          onChoose={factionId=>{
            if(!AXE_FACTIONS.some(faction=>faction.id===factionId))return;
            setSelectedFaction(factionId);
            setStep('creator');
            setShowCreate(true);
          }}
          onBack={()=>setStep(selectableCharacters.length?'select':'start')}
        />
      )}

      {step==='select' && <div className="axe-chronicle-sigil" key={selected?.id||'empty'}
        aria-hidden="true"><i/><i/><i/></div>}
      {step==='select' && <div className="axe-chronicle-threshold" aria-hidden="true"><i/><i/></div>}
      {step==='select' && <section className="axe-login-avatar-stage"
        aria-label="Selected character 3D preview">
        {selected
          ? <CreatorStage key={selected.id} config={selected} shot="body"
              livingIdle={motionEnabled} expression={{values:{smile:motionEnabled ? 0.12 : 0,brow_up:motionEnabled ? 0.025 : 0}}}/>
          : <div className="axe-login-no-character" aria-hidden="true">✧</div>}
      </section>}

      {(step==='start'||step==='select') && <div className="axe-login-bottom-action">
        {startError && <p role="alert" className="axe-login-error">{startError}</p>}
        <button type="button" className="axe-login-play"
          onClick={()=>{if(step==='start')startJourney();else enterWorld('wolfveil');}}
          disabled={starting||(step==='select'&&!selected)}>
          <span aria-hidden="true">✧</span>
          {starting?'ENTERING…':step==='start'
            ? (playableCount?'ENTER SERVER':'CREATE NEW CHARACTER')
            : 'ENTER WORLD'}
        </button>
      </div>}
      {worldError && step==='select' && <p className="axe-login-live-status" role="alert">
        {worldError}<button type="button" onClick={onRetryWorld}>Retry world</button>
      </p>}
      {workflowEnabled && workflowOpen && <WorkflowTeleportPanel
        onClose={() => setWorkflowOpen(false)}
        onSelect={(target) => target?.region === 'astral-dungeon' ? enterWorld('astral-dungeon') : enterWorld('wolfveil', target)}
        busy={starting}
      />}
      {deleteTarget && (
        <div className="axe-login-delete-shield">
          <section className="axe-login-delete-dialog" role="alertdialog" aria-modal="true"
            aria-labelledby="axe-delete-title" aria-describedby="axe-delete-description"
            onKeyDown={event=>{
              if(event.key!=='Tab') return;
              const buttons=[...event.currentTarget.querySelectorAll('button:not(:disabled)')];
              if(!buttons.length) return;
              const first=buttons[0], last=buttons[buttons.length-1];
              if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
              else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
            }}>
            <h2 id="axe-delete-title">Delete character?</h2>
            <p id="axe-delete-description">Delete <strong>{deleteTarget.name}</strong> and their Game 3D progression, equipment and saved appearance? This cannot be undone.</p>
            {deleteError && <p className="axe-login-delete-error" role="alert">{deleteError}</p>}
            <div className="axe-login-delete-actions">
              <button type="button" autoFocus disabled={deleteBusy}
                onClick={()=>{setDeleteTarget(null);setDeleteError('');}}>Cancel</button>
              <button type="button" className="axe-login-delete-confirm" disabled={deleteBusy}
                onClick={confirmCharacterDelete}>{deleteBusy?'Deleting…':'Delete character'}</button>
            </div>
          </section>
        </div>
      )}
      {showEditPlatformAvatar && (
        <section className="axe-login-creator-inworld" aria-label="Edit avatar in the living world">
          <AvatarAppearanceDialog embedded
            initialAvatar={platformAvatar}
            onClose={() => setShowEditPlatformAvatar(false)}
          />
        </section>
      )}
      {showCreate && (
        <section className="axe-login-creator-inworld" aria-label="Character customization in the living world">
          <CharacterCreationModal embedded factionId={selectedFaction}
            onClose={()=>{if(creatorSavedRef.current){creatorSavedRef.current=false;return;}setShowCreate(false);setStep('faction');}}
            onCreated={created=>{
            creatorSavedRef.current=true;
            // Save the new character and return to selection. Never auto-enter
            // the world: the player chooses when to use Enter World.
            const newIndex=getCharacterState().roster
              .filter(character=>workflowEnabled||!character.isDevTest)
              .findIndex(character=>character.id===created.id);
            setSelectedIndex(Math.max(0,newIndex));
            setShowCreate(false);
            setStep('select');
            setStartError('');
          }} />
        </section>
      )}
    </main>
  );
}