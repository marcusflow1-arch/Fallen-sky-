import { useState, useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { base44 } from '@/api/base44Client';
import CharacterLoginScreen from '../components/game3d/CharacterLoginScreen';
import WorldEntryCurtain from '../components/game3d/WorldEntryCurtain';
import { worldCheckpointStore } from '../components/game3d/worldCheckpointStore';
import GameWorld3D from '../components/game3d/GameWorld3D';
import Game3DPerformanceBootstrap from '../components/game3d/performance/Game3DPerformanceBootstrap';
import {game3dCharacterModel} from '../components/game3d/game3dCharacterModel';
import GameHUD from '../components/game3d/hud/GameHUD';
import {readGame3DCommunityHUD,GAME3D_COMMUNITY_HUD_EVENT}
  from '../components/game3d/hud/game3dCommunityHUDSettings.mjs';
import '../components/game3d/hud/Game3DCommunityHUD.css';
import AXEQuestTrailMount from '../components/game3d/hud/AXEQuestTrailMount';
import AXEVerifiedQuestbookMount172 from '../components/game3d/axe/quests/AXEVerifiedQuestbookMount172';
import SoulEmporiumOverlay from '../components/game3d/premiumShop/SoulEmporiumOverlay';
import CharacterProgressionMenu from '../components/game3d/CharacterProgressionMenu';
import useAXEServiceMode from '../components/game3d/axe/services/useAXEServiceMode';
import AXEServiceWorkspace from '../components/game3d/axe/services/AXEServiceWorkspace';
import { getAXEServiceGroupForService } from '../components/game3d/axe/services/AXEServiceGroups.js';
import { getGame3DMenuShortcut } from '../components/game3d/axe/services/game3dMenuHotkeys.mjs';
import { getAXECharacterShortcutAction } from '../components/game3d/axe/services/AXECharacterShortcutRouting.mjs';
import { normalizeAXEServiceRequest } from '../components/game3d/axe/services/AXEServiceRegistry';
import MultiplayerSystem from '../components/game/MultiplayerSystem';
import GameWorldServerManager from '../components/game3d/GameWorldServerManager';
import WorldSyncMount from '../components/game3d/network/WorldSyncMount';
import AXEWeaponIdentityMount from '../components/game3d/axe/weapons/AXEWeaponIdentityMount';
import AXEWeaponQuickSwitchMount from '../components/game3d/axe/weapons/AXEWeaponQuickSwitchMount';
import AXEMountFusionHUD from '../components/game3d/axe/progression/AXEMountFusionHUD';
import FriendsListPanel from '../components/game3d/social/FriendsListPanel';
import PartyPanel from '../components/game3d/social/PartyPanel';
import TradePanel from '../components/game3d/social/TradePanel';
import TradeSessionWatcher from '../components/game3d/social/TradeSessionWatcher';
import IncomingRequestToast from '../components/game3d/social/IncomingRequestToast';
import WorldChatPanel from '../components/game3d/social/WorldChatPanel';
import EchoChronicleOverlay from '../components/game3d/social/EchoChronicleOverlay';
import ChronicleBlueprintLibrary from '../components/game3d/chronicle/ChronicleBlueprintLibrary';
import MiniGamesHub from '../components/game3d/minigames/MiniGamesHub';
import CharacterVaultSync from '../components/game3d/character/CharacterVaultSync';
import DuelSystem from '../components/game3d/social/DuelSystem';
import DuelMarkers from '../components/game3d/social/DuelMarkers';
import NetworkBridgeMount from '../components/network/NetworkBridgeMount';
import NetworkBridgeHUD from '../components/network/debug/NetworkBridgeHUD';
import NetworkRemotesMount from '../components/network/remote/NetworkRemotesMount';
import LegacyRemotesVisibilityToggle from '../components/network/remote/LegacyRemotesVisibilityToggle';
import NetworkRemotesDebugOverlay from '../components/network/debug/NetworkRemotesDebugOverlay';
import NetworkValidationTelemetry from '../components/network/debug/NetworkValidationTelemetry';
import RenderStatsOverlay from '../components/game3d/debug/RenderStatsOverlay';
import { partyStore } from '../components/game3d/social/socialStores';
import GameWorldLootLayer from '../components/game3d/GameWorldLootLayer';
import ExplorationDiscoveryMount from '../components/game3d/exploration/ExplorationDiscoveryMount';
import EnemyPlayerSpawner from '../components/game3d/EnemyPlayerSpawner';
import RogueAIHPBarLayer from '../components/game3d/RogueAIHPBarLayer';
import ShopEffectsBridge from '../components/game3d/shop/shopEffectsBridge';
// Each action has its own dedicated send module — they do NOT share a code path.
import { sendFriendRequest } from '../components/game3d/social/friendRequest';
import { sendPartyInvite } from '../components/game3d/social/partyInvite';
import { sendTradeRequest } from '../components/game3d/social/tradeRequest';
import { sendDuelChallenge } from '../components/game3d/social/duelChallenge';
import {
  blockGame3DPlayer, reportGame3DPlayer, inviteGame3DClan,
  inviteGame3DCompetition, requestGame3DMountActivity,
} from '../components/game3d/social/game3dWorldInteractions';
import Game3DCompetitionInbox from '../components/game3d/social/Game3DCompetitionInbox';
import { useAuth } from '@/components/auth/AuthContext';
import { toast, Toaster } from 'react-hot-toast';
import PassiveSkillAuraEffects from '../components/game3d/PassiveSkillAuraEffects';
import PlayerHaloAura from '../components/game3d/PlayerHaloAura';
import PlayerAngelWings from '../components/game3d/PlayerAngelWings';
import PlayerBlueEnergyWings from '../components/game3d/PlayerBlueEnergyWings';
import { getLearnedSkillIds, subscribeLearnedSkills } from '../components/game3d/lootStore';
import { runOneTimeProgressionReset } from '../components/game3d/progression/oneTimeReset';
import SlashEffectLayer from '../components/game3d/SlashEffect';
import PauseMenu from '../components/game3d/PauseMenu';
import WindRunEffect from '../components/game3d/WindRunEffect';
import SkillActivationToastListener from '../components/game3d/SkillActivationToastListener';
import GameStateProvider from '../components/game3d/state/GameStateProvider';
import CombatMusicTrigger from '../components/game3d/CombatMusicTrigger';
import DeathFlowController from '../components/game3d/death/DeathFlowController';
import ClanOverlay from '../components/game3d/clan/ClanOverlay';
import CinematicQuestDialogue from '../components/game3d/npc/CinematicQuestDialogue';
import {
  bindWorldAudio,
  setWorldTargetVolume,
  teardownCombatMusic,
  isInCombat,
} from '../components/game3d/combatMusicController';
import {createGame3DEntryAudio,GAME3D_WORLD_THEME_GAIN}
  from '../components/game3d/audio/Game3DEntryAudio.mjs';

export default function GameView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [phase, setPhase] = useState('login'); // 'login' | 'world'
  const [worldEntryStatus,setWorldEntryStatus]=useState('idle'); // idle | loading | revealing | error
  const [worldReady,setWorldReady]=useState(false);
  const worldReadyRef=useRef(false);
  const readyModelUrlRef=useRef('');
  const [entryPreviewMode,setEntryPreviewMode]=useState('start');
  const [worldEntryError,setWorldEntryError]=useState('');
  const [worldEntryCycle,setWorldEntryCycle]=useState(0);
  const [playIntroCamera,setPlayIntroCamera]=useState(false);
  const [creatorOnLogin, setCreatorOnLogin] = useState(false);
  const [worldRegion,setWorldRegion]=useState('wolfveil');
  const [portalReturn,setPortalReturn]=useState(false);
  const vortexOriginRef=useRef(null); // remember portal source across dungeon remount
  const [workflowSpawn, setWorkflowSpawn] = useState(null);
  const [resumeCheckpoint, setResumeCheckpoint] = useState(null);
  const services = useAXEServiceMode();
  const [storeOpen, setStoreOpen] = useState(false);
  const [progressionOpen, setProgressionOpen] = useState(false);
  const [requestedService, setRequestedService] = useState(null);
  const [requestedServiceItemId, setRequestedServiceItemId] = useState(null);
  const [requestedCharacterTab, setRequestedCharacterTab] = useState(null);
  // Modern Character/Appearance workspace owns C. Track its actual tab so
  // pressing C from Equipment returns to Character before closing the panel.
  const [activeCharacterSubview, setActiveCharacterSubview] = useState('Character');
  const [focusCharacterRequest, setFocusCharacterRequest] = useState(0);
  const [friendsListOpen, setFriendsListOpen] = useState(false);
  const [clanOverlayOpen, setClanOverlayOpen] = useState(false);
  const [learnedSkillIds, setLearnedSkillIds] = useState(() => getLearnedSkillIds());
  const [pauseMenuOpen, setPauseMenuOpen] = useState(false);
  const [communityHUD,setCommunityHUD]=useState(()=>readGame3DCommunityHUD());
  useEffect(()=>{
    const onCommunity=event=>setCommunityHUD(event?.detail||readGame3DCommunityHUD());
    window.addEventListener(GAME3D_COMMUNITY_HUD_EVENT,onCommunity);
    return ()=>window.removeEventListener(GAME3D_COMMUNITY_HUD_EVENT,onCommunity);
  },[]);
  const [themeVolume, setThemeVolume] = useState(() => {
    const saved = parseFloat(localStorage.getItem('game_theme_volume'));
    return Number.isFinite(saved) ? saved : 0.5;
  });
  const audioRef = useRef(null);
  const entryAudioRef=useRef(null);

  useEffect(() => subscribeLearnedSkills(setLearnedSkillIds), []);
  // World creation reports readiness only after its player asset has loaded.
  // Never fade the entry screen based on a source-only scene-ready event.
  useEffect(()=>{
    const ready=event=>{
      readyModelUrlRef.current=event?.detail?.modelUrl||'';
      worldReadyRef.current=true;setWorldReady(true);
      setWorldEntryStatus(current=>current==='loading'?'revealing':current);
    };
    const teardown=()=>{worldReadyRef.current=false;readyModelUrlRef.current='';setWorldReady(false);};
    const failed=(event)=>{
      setWorldEntryError(event?.detail?.message||'The 3D world could not load.');
      setWorldEntryStatus(current=>current==='loading'?'error':current);
    };
    window.addEventListener('game3dWorldAvatarReady',ready);
    window.addEventListener('gw3dSceneTeardown',teardown);
    window.addEventListener('game3dWorldAvatarLoadError',failed);
    return ()=>{
      window.removeEventListener('game3dWorldAvatarReady',ready);
      window.removeEventListener('gw3dSceneTeardown',teardown);
      window.removeEventListener('game3dWorldAvatarLoadError',failed);
    };
  },[]);
  useEffect(()=>{
    if(worldEntryStatus!=='revealing')return undefined;
    const timer=window.setTimeout(()=>setWorldEntryStatus('idle'),920);
    return ()=>window.clearTimeout(timer);
  },[worldEntryStatus]);
  useEffect(()=>{
    if(worldEntryStatus!=='loading')return undefined;
    // A scene constructor can fail before the avatar loader fires. Never leave
    // the owner staring at an indefinite blank/blocked Game 3D entry.
    const timer=window.setTimeout(()=>{
      setWorldEntryError('Game 3D did not finish loading. Retry, or return to character selection and check the browser console.');
      setWorldEntryStatus(current=>current==='loading'?'error':current);
    },30000);
    return ()=>window.clearTimeout(timer);
  },[worldEntryStatus]);

  // One-time wipe: reset Halo + Title progression to zero so the player can
  // rebuild from scratch. Guarded by a versioned localStorage flag — runs
  // exactly once per browser.
  useEffect(() => { runOneTimeProgressionReset(); }, []);

  // Use the owner's actual uploaded intro music instead of the legacy
  // game-1/game-2 hero-background lookup. The live world is already mounted
  // under the character menu; only this audio transport changes at entry.
  useEffect(()=>{
    const music=createGame3DEntryAudio({
      initialVolume:themeVolume,
      inCombat:isInCombat,
    });
    entryAudioRef.current=music;
    // Combat music now fades/pauses the SAME title score that continues
    // through exploration. Nature is its own low-volume background layer.
    audioRef.current=music.getWorldAudio();
    bindWorldAudio(audioRef,themeVolume*GAME3D_WORLD_THEME_GAIN);
    const unlock=()=>music.unlock();
    // Autoplay cannot be guaranteed before a gesture. The first Start,
    // character-selection, or PLAY click reliably unlocks sound instead.
    window.addEventListener('pointerdown',unlock,true);
    window.addEventListener('keydown',unlock,true);
    music.start();
    return ()=>{
      window.removeEventListener('pointerdown',unlock,true);
      window.removeEventListener('keydown',unlock,true);
      music.dispose();
      entryAudioRef.current=null;
      audioRef.current=null;
    };
  },[]);
  useEffect(()=>{
    entryAudioRef.current?.setPhase(phase);
    if(phase==='world'){
      // Refresh the combat resume target even if the volume changed while
      // on character selection, without bypassing the entry fade.
      bindWorldAudio(audioRef,themeVolume*GAME3D_WORLD_THEME_GAIN);
    }
  },[phase]);
  useEffect(()=>{entryAudioRef.current?.setRegion(worldRegion);},[worldRegion]);
  useEffect(()=>{if(phase==='login')teardownCombatMusic();},[phase]);
  // Returning to character selection must not carry an open in-world panel back
  // into the next world entry. Services, Character, the store, friends, clan and
  // the pause menu all keep the game's input flags set, so the re-entered world
  // ignored WASD until that panel was clicked closed again.
  useEffect(()=>{
    if(phase!=='login')return;
    services.controller.close();
    setPauseMenuOpen(false);
    setStoreOpen(false);
    setProgressionOpen(false);
    setRequestedService(null);
    setRequestedServiceItemId(null);
    setRequestedCharacterTab(null);
    setFriendsListOpen(false);
    setClanOverlayOpen(false);
    vortexOriginRef.current=null; // never carry a stale dungeon origin into a fresh Play
  },[phase,services.controller]);

  // Tear down combat audio when leaving GameView entirely.
  useEffect(() => () => teardownCombatMusic(), []);


  // Real portal crossings remount the same engine in a separate map scene.
  // The original Wolfveil terrain and its protected Luna mansion stay intact.
  useEffect(()=>{
    if(phase!=='world')return;
    const onPortalTravel=(event)=>{
      const target=event.detail?.target;
      if(!['wolfveil','lunar-cave','astral-dungeon'].includes(target)||target===worldRegion)return;
      services.controller.close();
      setPauseMenuOpen(false);
      setStoreOpen(false);
      setProgressionOpen(false);
      window.dispatchEvent(new Event('game3dCheckpointFlush'));
      setWorkflowSpawn(null);
      setResumeCheckpoint(null);
      if(target!=='wolfveil'){
        vortexOriginRef.current=event.detail?.sourcePortal==='vortex'?'vortex':null;
        setPortalReturn(false);
      }else{
        const fromVortex=vortexOriginRef.current==='vortex';
        setPortalReturn(fromVortex?'vortex':
          event.detail?.returnToGate==='astral'?'astral':
          event.detail?.returnToGate===true);
        vortexOriginRef.current=null;
      }
      setWorldRegion(target);
    };
    window.addEventListener('game3dPortalTravel',onPortalTravel);
    return ()=>window.removeEventListener('game3dPortalTravel',onPortalTravel);
  },[phase,worldRegion,services.controller]);

  // World server join is handled by GameWorldServerManager — it enforces the
  // 20-player cap and dispatches joinMultiplayerChannel only when capacity allows.

  // Player interaction menu actions — each action (friend / party / trade / duel)
  // is dispatched to its OWN dedicated module. They do not share a code path,
  // so each one can evolve its rules, side effects, and error messages
  // independently.
  useEffect(() => {
    // Shared error formatter for the generic codes that every send helper can throw.
    const formatError = (err, action) => {
      if (err?.code === 'cooldown') return { msg: err.message, icon: '⏳' };
      if (err?.code === 'rate_limit') return { msg: 'Server is busy — try again in a few seconds', error: true };
      if (err?.code === 'self') return { msg: "That's you!", error: true };
      if (err?.code === 'invalid') return { msg: 'Invalid target', error: true };
      return { msg: `Failed to send ${action}: ${err?.message || 'unknown error'}`, error: true };
    };
    const showError = (err, action) => {
      const f = formatError(err, action);
      if (f.error) toast.error(f.msg); else toast(f.msg, { icon: f.icon });
    };

    // ─── FRIEND ───
    const handleFriend = async (sender, receiver) => {
      try {
        await sendFriendRequest(sender, receiver);
        toast.success(`Friend request sent to ${receiver.name}`);
      } catch (err) {
        console.error('[Social/friend] failed:', err);
        if (err?.code === 'already_friends') toast(err.message, { icon: '🤝' });
        else showError(err, 'friend request');
      }
    };

    // ─── PARTY ───
    const handleParty = async (sender, receiver) => {
      try {
        await sendPartyInvite(sender, receiver, partyStore.get().partyId);
        toast.success(`Party invite sent to ${receiver.name}`);
      } catch (err) {
        console.error('[Social/party] failed:', err);
        if (err?.code === 'party_full') toast.error('Your party is full');
        else showError(err, 'party invite');
      }
    };

    // ─── TRADE ───
    const handleTrade = async (sender, receiver) => {
      try {
        await sendTradeRequest(sender, receiver);
        toast.success(`Trade request sent to ${receiver.name}`);
      } catch (err) {
        console.error('[Social/trade] failed:', err);
        showError(err, 'trade request');
      }
    };

    // ─── DUEL ───
    const handleDuel = async (sender, receiver) => {
      try {
        await sendDuelChallenge(sender, receiver);
        toast.success(`Duel challenge sent to ${receiver.name}`);
      } catch (err) {
        console.error('[Social/duel] failed:', err);
        if (err?.code === 'already_dueling') toast.error(err.message);
        else showError(err, 'duel challenge');
      }
    };

    const onAction = (e) => {
      const { action, playerId, playerName, region:interactionRegion } = e.detail || {};
      console.log('[Social] gamePlayerAction received:', { action, playerId, playerName, myId: user?.id });
      // The dedicated Echo listener handles two-player dialogue, not the old social handlers.
      if (action === 'talk') return;
      if (!playerId) { toast.error('No target player ID'); return; }
      if (!user?.id) { toast.error('You must be signed in'); return; }
      if (playerId === user.id) { toast.error("That's you!"); return; }
      const senderName = user.full_name || user.username || 'Player';
      const sender = { id: user.id, name: senderName };
      const receiver = { id: playerId, name: playerName };

      // Route to the dedicated handler — no shared try/catch, no shared switch.
      if (action === 'friend') handleFriend(sender, receiver);
      else if (action === 'party') handleParty(sender, receiver);
      else if (action === 'trade') handleTrade(sender, receiver);
      else if (action === 'duel') handleDuel(sender, receiver);
      else if (action === 'clan' || action === 'block' || action.startsWith('report:') || action.startsWith('compete:')) {
        void (async () => {
          try {
            if (action === 'clan') {
              await inviteGame3DClan(receiver.id);
              toast.success('Clan invitation sent to ' + receiver.name);
            } else if (action === 'block') {
              await blockGame3DPlayer(receiver.id);
              window.dispatchEvent(new Event('game3dBlockedListChanged'));
              toast.success(receiver.name + ' can no longer privately message you');
            } else if (action.startsWith('report:')) {
              await reportGame3DPlayer(receiver.id, action.slice(7), interactionRegion);
              toast.success('Report submitted for review');
            } else {
              await inviteGame3DCompetition(receiver.id, action.slice(8), interactionRegion);
              toast.success('Competition invitation sent to ' + receiver.name);
            }
          } catch (error) {
            showError(error, action.split(':')[0]);
          }
        })();
      }
      else console.warn('[Social] unknown action:', action);
    };
    window.addEventListener('gamePlayerAction', onAction);
    return () => window.removeEventListener('gamePlayerAction', onAction);
  }, [user?.id, user?.full_name, user?.username]);

  // Quiet confirmation that farming loot was safely redirected to the vault.
  useEffect(() => {
    if (phase !== 'world') return undefined;
    const onStored = event => {
      const name = event.detail?.item?.name || 'Item';
      toast(`${name} sent to personal storage`, {icon:'📦'});
    };
    window.addEventListener('game3dLootStored', onStored);
    return () => window.removeEventListener('game3dLootStored', onStored);
  }, [phase]);

  // Mount menu commands go to the authenticated intent ledger. The world cannot
  // grant mount treasure or bond XP while its animations are still absent.
  useEffect(() => {
    if (phase !== 'world') return undefined;
    const onMountAction = event => {
      const { action, companionId, region:targetRegion } = event.detail || {};
      if (!user?.id || !action?.startsWith('mount:') || !companionId) return;
      void requestGame3DMountActivity(companionId, action.slice(6), targetRegion)
        .then(() => toast('Mount activity recorded — awaiting animation support', {icon:'🐾'}))
        .catch(error => toast.error(error?.message || 'Mount activity could not be saved'));
    };
    window.addEventListener('game3dMountAction', onMountAction);
    return () => window.removeEventListener('game3dMountAction', onMountAction);
  }, [phase, user?.id]);

  // Living Quest NPC interaction is now handled in-world by CinematicQuestDialogue
  // (mounted below), which listens for the same 'openLivingQuest' event.

  useEffect(() => {
    const onOpenHub = (event) => {
      services.controller.close();
      setRequestedService(null);
      setRequestedCharacterTab(event?.detail?.tab || 'inventory');
      setProgressionOpen(true);
    };
    window.addEventListener('axeOpenCharacterHub', onOpenHub);
    return () => window.removeEventListener('axeOpenCharacterHub', onOpenHub);
  }, [services.controller]);

  // NPCs keep their existing service identifiers and owned-item requests. C's
  // Services tab still uses the same controls and transaction gateway.
  useEffect(() => {
    const onService = (event) => {
      const serviceId = normalizeAXEServiceRequest(event?.detail?.service || 'reinforcement');
      const group = getAXEServiceGroupForService(serviceId);
      if (!group) return;
      setProgressionOpen(false);
      setStoreOpen(false);
      services.controller.open(group.id, { serviceId,
        itemId: event?.detail?.itemId || event?.detail?.instanceId || null });
    };
    window.addEventListener('axeServiceRequested', onService);
    return () => window.removeEventListener('axeServiceRequested', onService);
  }, [services.controller]);

  // Live-update audio volume when slider changes (without reloading the track)
  useEffect(() => {
    entryAudioRef.current?.setVolume(themeVolume);
    // Only adjust the combat transport during an actual slider change in
    // world gameplay. On initial login this setter would raise the PAUSED
    // ambience element to full volume, bypassing the cinematic crossfade.
    if(phase==='world')setWorldTargetVolume(themeVolume*GAME3D_WORLD_THEME_GAIN);
    localStorage.setItem('game_theme_volume', String(themeVolume));
  }, [themeVolume]);

  // The eight owner-assigned keys are captured before GameWorld3D's movement,
  // weapon and quest-debug listeners. Only one service/map/character menu lives
  // at a time; pressing the current key again closes it.
  useEffect(() => {
    if (phase !== 'world') return undefined;
    const onServiceKey = (event) => {
      const destination = getGame3DMenuShortcut(event);
      if (!destination || pauseMenuOpen || window.__axeDialogueOpen ||
        window.__axeTileInspectionEditing) return;
      event.preventDefault();
      event.stopImmediatePropagation?.();
      const currentGroup = services.controller.getSnapshot().groupId;
      const mapWasOpen = !!window.__axeWorldMapOpen;
      // The map is a separate HUD portal, not a station workspace.
      window.dispatchEvent(new Event('axeCloseWorldMap'));
      setStoreOpen(false);
      setFriendsListOpen(false);
      setClanOverlayOpen(false);

      if (destination === 'map') {
        services.controller.close();
        setProgressionOpen(false);
        setRequestedService(null);
        setRequestedServiceItemId(null);
        setRequestedCharacterTab(null);
        if (!mapWasOpen) {
          window.dispatchEvent(new CustomEvent('axeOpenWorldMap', { detail: { force: true } }));
        }
        return;
      }

      if (destination === 'character') {
        const action = getAXECharacterShortcutAction({
          activeGroupId: currentGroup,
          legacyHubOpen: progressionOpen,
          activeTab: activeCharacterSubview,
        });
        // The former Attributes/Inventory/Companion CharacterProgressionMenu
        // is not the new C page. Always close it rather than reopening it.
        setProgressionOpen(false);
        setRequestedService(null);
        setRequestedServiceItemId(null);
        setRequestedCharacterTab(null);
        if (action === 'close') {
          services.controller.close();
        } else if (action === 'focus') {
          setFocusCharacterRequest(value => value + 1);
        } else {
          setActiveCharacterSubview('Character');
          // Reuse the already-registered unified Character + Appearance
          // workspace, including its current 3D model and live stats.
          void services.controller.open('character', { serviceId: 'character' });
        }
        return;
      }

      setProgressionOpen(false);
      setRequestedService(null);
      setRequestedServiceItemId(null);
      setRequestedCharacterTab(null);
      if (currentGroup === destination) services.controller.close();
      else void services.controller.open(destination);
    };
    window.addEventListener('keydown', onServiceKey, true);
    return () => window.removeEventListener('keydown', onServiceKey, true);
  }, [phase, pauseMenuOpen, progressionOpen, activeCharacterSubview, services.controller]);

  // Other in-world controls: TAB = Soul Emporium, G = Clan,
  // Shift+L = Friends, ESC = close overlay / pause.
  // Shift+C still cycles owned weapon roles; V is a companion combat ability.
  useEffect(() => {
    if (phase !== 'world') return;
    const onKey = (e) => {
      if (e.repeat) return;
      // The MMO Escape menu owns its captured ESC/Tab keys. Do not open
      // stores, clans or other HUD overlays behind its settings panels.
      if (pauseMenuOpen) return;
      if (services.active) {
        if (e.key === 'Escape') { e.preventDefault(); services.controller.close(); }
        return; // Tab stays focus navigation; service clicks/keys never open combat overlays.
      }
      if (storeOpen) {
        // Keep C/G/L combat hotkeys from triggering underneath the store.
        // Tab remains native focus navigation, even while a search input is focused.
        if (e.key === 'Escape') {
          e.preventDefault();
          setStoreOpen(false);
        }
        return;
      }
      if (window.__axeDialogueOpen ||
        e.target?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'Tab') {
        e.preventDefault();
        setStoreOpen(true);
      } else if (e.shiftKey && e.code === 'KeyL') {
        e.preventDefault();
        setFriendsListOpen((v) => !v);
      } else if (!e.shiftKey && e.key.toLowerCase() === 'g') {
        setClanOverlayOpen((v) => !v);
      } else if (e.key === 'Escape') {
        // Close any open sub-panels first; otherwise toggle pause menu.
        if (storeOpen) setStoreOpen(false);
        else if (progressionOpen) {
          setProgressionOpen(false);
          setRequestedService(null);
          setRequestedServiceItemId(null);
          setRequestedCharacterTab(null);
        }
        else if (friendsListOpen) setFriendsListOpen(false);
        else if (clanOverlayOpen) setClanOverlayOpen(false);
        else setPauseMenuOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, storeOpen, progressionOpen, friendsListOpen, clanOverlayOpen, pauseMenuOpen, services.active, services.controller]);


  return (
    <div className="game3d-view fixed inset-0 bg-black overflow-hidden"
      style={{'--game3d-community-scale':communityHUD.scale}}
      data-service-mode={services.active ? 'true' : 'false'} data-services-open={services.active || services.expanded ? 'true' : 'false'}>
      {/* Hybrid host-authoritative simulation layer.
          Owns enemies / loot / pvp damage / player hp.
          GameWorld3D is becoming a renderer that reads from this. */}
      <GameStateProvider showDebugHUD={false}>
      {user?.id && <CharacterVaultSync showStatus={false} />}
       <GameWorld3D key={worldRegion+':'+worldEntryCycle} region={worldRegion}
        entryMode={phase==='login'} entryPreviewMode={entryPreviewMode}
        entryCinematic={playIntroCamera}
        initialWorkflowTarget={workflowSpawn} workflowAllowed={user?.role==='admin'} portalReturn={portalReturn}
        resumeCheckpoint={resumeCheckpoint} />
      {/* Keep GPU governor/warmup, but relocate its floating GPU/FPS button to native Graphics settings. */}
      <Game3DPerformanceBootstrap region={worldRegion} showPanel={false} />
      {phase==='login' ? (
        <>
          <CharacterLoginScreen liveWorld worldReady={worldReady} worldError={worldEntryError}
             initialMusicVolume={themeVolume} onMusicVolumeChange={setThemeVolume}
            onEntryStepChange={setEntryPreviewMode}
            onPrepareWorld={async character=>{
              // A newly-created Eve/Adam may need a different GLB. Do not start
              // the orbit using the previous character or before its animation
              // controller is ready. Same-GLB appearance changes reuse the scene.
              const expected=game3dCharacterModel(character);
              if(worldReadyRef.current && readyModelUrlRef.current===expected)return;
              await new Promise((resolve,reject)=>{
                let timer;
                const cleanup=()=>{
                  window.clearTimeout(timer);
                  window.removeEventListener('game3dWorldAvatarReady',ready);
                  window.removeEventListener('game3dWorldAvatarLoadError',failed);
                };
                const ready=event=>{
                  if(event?.detail?.modelUrl!==expected)return;
                  cleanup();resolve();
                };
                const failed=event=>{cleanup();reject(new Error(event?.detail?.message||'Character model could not load.'));};
                window.addEventListener('game3dWorldAvatarReady',ready);
                window.addEventListener('game3dWorldAvatarLoadError',failed);
                timer=window.setTimeout(()=>{cleanup();reject(new Error('Your character took too long to load. Retry world.'));},30000);
                // Close the mount/listener race if the actor arrived meanwhile.
                if(worldReadyRef.current && readyModelUrlRef.current===expected){cleanup();resolve();}
              });
            }}
            onRetryWorld={()=>{worldReadyRef.current=false;setWorldReady(false);setWorldEntryError('');setWorldEntryCycle(cycle=>cycle+1);}}
            workflowEnabled={user?.role==='admin'} openCreator={creatorOnLogin}
            onPlay={(region='wolfveil',target=null)=>{
              setCreatorOnLogin(false);
              setWorldEntryError('');
              const requestedRegion=['forest','astral-dungeon','lunar-cave'].includes(region)?region:'wolfveil';
               // Standard Play resumes this character's last stored world and coordinates.
               // An explicit preview/workflow target always takes precedence.
               const resume = requestedRegion==='wolfveil' && !target ? worldCheckpointStore.read() : null;
               const nextRegion = resume?.region || requestedRegion;
               setResumeCheckpoint(resume);
              // Wolfveil is ALREADY rendered below this menu; do not remount it.
              // Loading curtain applies only if a model or another region is pending.
              setWorldEntryStatus(nextRegion==='wolfveil'&&worldReadyRef.current?'idle':'loading');
              setPlayIntroCamera(false); // The gateway fades directly into gameplay, without an orbit cinematic.
              setPortalReturn(false);
              if(nextRegion!=='wolfveil'){
                worldReadyRef.current=false;
                setWorldReady(false);
              }
              setWorldRegion(nextRegion);
              setWorkflowSpawn(nextRegion==='wolfveil' && user?.role==='admin'?target:null);
              setPhase('world');
            }}
            onBack={()=>navigate({to:'/'})} />
          
        </>
      ) : (
        <>
      <AXEVerifiedQuestbookMount172 />
      <AXEQuestTrailMount region={worldRegion} enabled={!services.active && !services.expanded} />
      <GameHUD region={worldRegion} serviceMode={services.active} servicesExpanded={services.expanded}
        activeServiceGroup={services.groupId} onToggleServices={() => services.controller.toggle()}
        onSelectServiceGroup={groupId => {
          setProgressionOpen(false); setStoreOpen(false); setPauseMenuOpen(false);
          setFriendsListOpen(false); setClanOverlayOpen(false);
          services.controller.open(groupId);
        }} />
      {services.active && <AXEServiceWorkspace mode={services} onClose={() => services.controller.close()}
        onCharacterTabChange={setActiveCharacterSubview}
        focusCharacterRequest={focusCharacterRequest} />}
      {!services.active && services.message && <div className="axe-service-session-notice" role="status">{services.message}</div>}
      {/* World boss UI removed in the systems/animation test scene. */}
      <MultiplayerSystem envUrl="game_world_lowpoly" surface="game-world" />
      <GameWorldServerManager showHud={communityHUD.online && !services.active && !services.expanded} />
      {/* Equipped weapon is the canonical source for mastery/class/role identity. */}
      <AXEWeaponIdentityMount />
      {/* Wuxia blueprint: Shift+1 / Shift+2 draw the two quick-slot weapons. */}
      <AXEWeaponQuickSwitchMount />
      {/* Wuxia blueprint: Mount Soul Fusion timer while a mount is absorbed. */}
      <div className="axe-service-combat-overlays" inert={services.active ? '' : undefined} aria-hidden={services.active || undefined}><AXEMountFusionHUD /></div>
      {/* GameView renders outside the app Layout, whose Toaster is the only one, so every in-game
          toast (skill activations, weapon and PvP notices, social requests) was silently dropped.
          This one sits below the boss bar, in the ink style of the Wuxia HUD. */}
      <Toaster
        position="top-center"
        containerStyle={{ top: 128 }}
        toastOptions={{ style: { background: 'rgba(17,16,15,0.9)', color: '#efe6d2', border: '1px solid rgba(239,230,210,0.14)', fontFamily: 'Georgia, "Noto Serif", serif', fontSize: 13 } }}
      />
      {/* Host-authoritative enemy/boss sync — elects one host per channel,
          broadcasts world snapshots, and applies them on non-hosts. */}
      <WorldSyncMount />
      {/* AXE Prompt 003 — logical region/POI/travel streaming follows the live player position. */}
      {/* AXEWorldStreamingMount is paused while Game 3D runs the self-contained forest biome prototype. */}
      {/* AXE Prompt 004 — first 2.4 km macro-region blockout. */}
      {/* AXEFirstRegionMount is paused while Game 3D runs the self-contained forest biome prototype. */}
      {/* AXE Prompt 005 — character first-spawn entry and tutorial handoff. */}
      {/* AXEFirstSpawnMount is paused while Game 3D runs the self-contained forest biome prototype. */}
      {/* AXE Prompt 007 — fall safety, landing severity and world trigger volumes. */}
      {/* AXETraversalSafetyMount is paused while Game 3D runs the self-contained forest biome prototype. */}
      {/* AXE Prompt 008 — reusable NPC/door/gate/teleport/service interactions. */}
      {/* AXEInteractionMount is paused while Game 3D runs the self-contained forest biome prototype. */}
      {/* AXE Prompt 009 — defended faction capital blockout and districts. */}
      {/* AXECapitalBlockoutMount is paused while Game 3D runs the self-contained forest biome prototype. */}
      {/* AXE Prompt 037 — cave/dungeon/SOS-access prototype entrances and session state. */}
      {/* AXEDungeonMount is paused while Game 3D runs the self-contained forest biome prototype. */}
      {/* AXEDungeonRuntime is paused while Game 3D runs the self-contained forest biome prototype. */}
      {/* AXE Prompt 039 — recurring faction-war objectives and invasion defenses. */}
      {/* AXEFactionWarRuntime is paused while Game 3D runs the self-contained forest biome prototype. */}
      <SoulEmporiumOverlay isOpen={storeOpen} onClose={() => setStoreOpen(false)} />
      <CharacterProgressionMenu
        isOpen={progressionOpen}
        onClose={() => {
          setProgressionOpen(false);
          setRequestedService(null);
          setRequestedCharacterTab(null);
        }}
        requestedService={requestedService}
        requestedItemId={requestedServiceItemId}
        initialTab={requestedCharacterTab}
        onServiceRequestConsumed={() => {
          setRequestedService(null);
          setRequestedServiceItemId(null);
        }}
      />
      <FriendsListPanel open={friendsListOpen} onClose={() => setFriendsListOpen(false)} />
      <div className="axe-service-combat-overlays" inert={services.active ? '' : undefined} aria-hidden={services.active || undefined}><PartyPanel /></div>
      <TradePanel />
      <TradeSessionWatcher userId={user?.id} />
      <IncomingRequestToast userId={user?.id} />
      <WorldChatPanel userId={user?.id} suppressed={services.active} showDock={communityHUD.chat} />
       <EchoChronicleOverlay suppressed={services.active || services.expanded} showLauncher={communityHUD.echo}
        onOpenQuestLogbook={() => {
          setProgressionOpen(false);setStoreOpen(false);setPauseMenuOpen(false);
          services.controller.open('quest_logbook');
        }} />
      {/* Creator-only asset BLUEPRINT organizer; independent from the player's
          200-slot inventory and the separate narrative Echo Chronicle. */}
      <ChronicleBlueprintLibrary suppressed={services.active || services.expanded ||
        storeOpen || progressionOpen || pauseMenuOpen} />
      {/* Small third icon next to the two Chronicle controls. Signups and
          spectators are server-verified; games themselves are not yet playable. */}
      <MiniGamesHub userId={user?.id} showLauncher={communityHUD.miniGames} suppressed={services.active || services.expanded ||
        storeOpen || progressionOpen || pauseMenuOpen || friendsListOpen || clanOverlayOpen} />
      <Game3DCompetitionInbox enabled={phase==='world'} userId={user?.id} />
      <DuelSystem userId={user?.id} />
      <DuelMarkers localUserId={user?.id} />

      {/* Slice B — feature-flagged. Default OFF, no effect on existing systems. */}
      <NetworkBridgeMount />
      <NetworkBridgeHUD />
      {/* Slice C — feature-flagged. Default OFF, runs alongside legacy WebRTC remotes. */}
      <NetworkRemotesMount />
      <LegacyRemotesVisibilityToggle />
      <NetworkRemotesDebugOverlay />
      <NetworkValidationTelemetry />
      {/* Developer renderer.info overlay. Default OFF; ?renderStats=1 turns it on. */}
      <RenderStatsOverlay />

      {/* Loot drop layer — spawns world items on enemy death, handles E-to-pickup */}
      <GameWorldLootLayer />

      {/* Exploration discoveries — material nodes and elite finds out in the land, E to gather;
          the server grants the reward for a character it keeps */}
      <ExplorationDiscoveryMount />

      {/* Hostile rogue-player AIs — kill them for gold, XP, loot, and PvP title kills */}
      <EnemyPlayerSpawner />

      {/* HP bars (level + random name + liquid-glass HP) above each rogue AI */}
      <RogueAIHPBarLayer />

      {/* Shop consumable effects — applies buffs/heals when items are used from the shop */}
      <ShopEffectsBridge />

      {/* Passive skill aura visual effects rendered over the player */}
      <PassiveSkillAuraEffects activeSkillIds={[...learnedSkillIds]} />

      {/* 3D angelic halo above the player's head — scales with Halo level */}
      <PlayerHaloAura />

      {/* 3D angel wings on the player's back — scales with equipped Wings level */}
      <PlayerAngelWings />
      <PlayerBlueEnergyWings />

      {/* Slash visual effects — fires on basic attack and skill activations */}
      <SlashEffectLayer />

      {/* Wind streaks while sprinting (Shift-to-Run skill) */}
      <WindRunEffect />

      {/* Toast feedback when self-cast skills (Shield, Focus, Haste, etc.) activate */}
      <SkillActivationToastListener />

      {/* Combat activity cannot start music or keep combat timers alive
          while the world remains mounted behind the character login menu. */}
      {phase==='world' && <CombatMusicTrigger />}

      {/* Death flow — death animation → 5s tips overlay → respawn map */}
      <DeathFlowController />

      {/* Guild Wars 2-style clan overlay — opened by G key */}
      <ClanOverlay open={clanOverlayOpen} onClose={() => setClanOverlayOpen(false)} userId={user?.id} />

      {/* In-world cinematic dialogue → quest flow for the Living Quest NPC (Artemis) */}
      <CinematicQuestDialogue />

      {/* Pause menu — opened by ESC */}
      <PauseMenu
        open={pauseMenuOpen}
        onClose={() => setPauseMenuOpen(false)}
        onCreateCharacter={() => { window.dispatchEvent(new Event('game3dCheckpointFlush')); setResumeCheckpoint(null); setPauseMenuOpen(false); setWorldEntryStatus('idle'); setPlayIntroCamera(false); setCreatorOnLogin(true); setPhase('login'); }}
        volume={themeVolume}
        onVolumeChange={setThemeVolume}
        onReturnToCharacterSelect={() => {
           window.dispatchEvent(new Event('game3dCheckpointFlush'));
           setResumeCheckpoint(null);
           setPauseMenuOpen(false);
          setCreatorOnLogin(false);
          setWorldEntryStatus('idle');
          setPlayIntroCamera(false);
          setPhase('login');
        }}
      />
      {worldEntryStatus!=='idle' && <WorldEntryCurtain
        status={worldEntryStatus}
        error={worldEntryError}
        onRetry={()=>{worldReadyRef.current=false;setWorldReady(false);setWorldEntryError('');setWorldEntryStatus('loading');setWorldEntryCycle(cycle=>cycle+1);}}
        onReturn={()=>{setWorldEntryStatus('idle');setPlayIntroCamera(false);setPhase('login');}}
      />}
        </>
      )}
      </GameStateProvider>
    </div>
  );
}