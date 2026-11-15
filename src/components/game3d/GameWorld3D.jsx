import {useGameAvatar} from './useGameAvatar';
import {loadAvatarModel,applyPlayerAppearance,disposeAvatarModel} from '@/components/onboarding/avatarAssetRuntime';
import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Loader2 } from 'lucide-react';
import WorldTileEditor from '../worldTileEditor/WorldTileEditor';
import { describeWolfveilTile } from '../worldTileEditor/wolfveilTileCatalogue.mjs';
// The Wolfveil geometry is 1100m wide, then its market-at-spawn transform adds +70m Z.
const WOLFVEIL_TILE_BOUNDS = Object.freeze({ minX: -550, maxX: 550, minZ: -480, maxZ: 620 });
const ARENA_TILE_BOUNDS = Object.freeze({ minX: -37.5, maxX: 37.5, minZ: -37.5, maxZ: 37.5 });
import EnemyHealthBar from './EnemyHealthBar';
import BossHeadHPTank from './hud/BossHeadHPTank';
import QuestFloatingLabel from './QuestFloatingLabel';
import QuestDialogueBox from './QuestDialogueBox';
import FloatingDamageNumbers from './FloatingDamageNumbers';
import { setPlayerHUD, awardXP, getPlayerHUD, setHP, tickRegen, subscribePlayerHUD } from './playerHUDStore';
import { gainAXEBuddhaEssenceExperience } from './axe/progression/AXEElixirStore';
import { DEFAULT_PLAYER_STATS, computeDerivedStats, calculateHit } from './statsSystem';
import { getAXEEnemyStats } from './axe/balance/AXEPowerBudget';
import { QUEST_NPCS, QUESTS } from './questData';
import { getAXENPCQuestHandoff } from './axe/quests/AXENPCQuestHandoff';
import { acceptQuest, completeQuest, reportEnemyKill, subscribeQuests, getQuestState } from './useQuestStore';
import { playActionSound, getActionSound, startLoopSound, stopLoopSound } from './combatAudioStore';
import { createLayeredWorldSoundscape } from './audio/LayeredWorldSoundscape.mjs';
import { createGameEventSoundBridge, setOutdoorNatureBed } from './audio/GameEventSoundBridge.mjs';
import { preloadActionSounds } from './combatAudioStore';
import { isInCombat } from './combatMusicController';
import { faceMoodsFor } from '@/components/onboarding/faceMoods';
import { setPlayerPosition } from './playerPositionStore';
import { MAP_SPAWN_POINTS, getRespawnPoint } from './mapSpawnPoints';
import { findSafeNearbyRespawn, NEARBY_RESPAWN_ID } from './death/nearbyRespawnRules.mjs';
import { createWorldRespawnShrines } from './death/WorldRespawnShrines';
import { worldCheckpointStore } from './worldCheckpointStore';
import { getActiveId, getStorageUser } from './characterStorage';
import { CREATURE_MODEL_URL, CREATURE_ANIMATION_URLS } from './creatureAssets';
import { setBosses, updateBoss } from './bossStore';
import { createBossEncounterController } from './boss/BossEncounterController';
import { createBossCombatDialogue } from './boss/BossCombatDialogue';
import { spawnWorldBoss } from './boss/spawnWorldBoss';
import { createQuarryDragonBoss } from './boss/QuarryDragonAerialSlam';
import { updateBossMovement, projectBossHead } from './boss/updateBossMovement';
import { castLegacyTargetedAbility } from './legacyTargetedAbilities';
import CompanionMountHUD from './CompanionMountHUD';
import { getCompanionState, subscribeCompanion, setMounted, getEffectiveSpeedMultiplier } from './companionStore';
import { getActiveAXEMountSpeedMultiplier, getAXEMountFusionState, setAXEMountRiding, tickAXEMountRideActivity } from './axe/progression/AXEMountStore';
import { awardCompanionXP, getCompanionProgression, subscribeCompanionProgression } from './companionProgressionStore';
import CompanionHealthBar from './CompanionHealthBar';
import PlayerNameTag from './PlayerNameTag';
import { base44 } from '@/api/base44Client';
import { getActiveCharacter } from './characterStore';
import { getCompanionById, createCompanionLoadingManager } from './companionData';
import { loadCompanionFolderClips } from './companionAnimationLoader';
import { prepareMountAnimationClips } from './character/mountAnimations.mjs';
import {createFactionThreeMountRig,isFactionThreeMount} from './character/factionThreeMountRig.mjs';
import {createFactionThreeFacingFrame} from './character/factionThreeMountFacing.mjs';
import { createMountedRiderPose } from './player/mountedRiderPose.mjs';
import { createMountedWeaponPresentation } from './player/mountedWeaponPresentation.mjs';
import { createEquippedBowGLBPresentation } from './player/equippedBowGLBPresentation.mjs';
import { inferAXEMasteryWeaponId } from './axe/weapons/AXEWeaponIdentity';
import { getAbilityState, tickCooldowns as tickLegacyAbilityCooldowns, startCooldown as startLegacyAbilityCooldown, clearTarget, updateTargetHP, ABILITY_DEFINITIONS } from './abilityStore';
import { getLoadout, cycleSkillPreset, startCooldown as startSkillCooldown, tickCooldowns as tickSkillCooldowns } from './skills/loadoutStore';
import { castSkill } from './skills/skillExecutor';
import { getSkillById } from './skills/skillRegistry';
import { getSkillMasteryLevel } from './skills/skillMasteryStore';
import { isChargeableCombatSkill, getSkillChargeStatus, canAcceptFinisherChain, skillCombatFamily } from './combat/ChargedSkillRules';
import { createKillFlowCounter, isKillFlowCastEligible } from './combat/KillFlowCounter.mjs';
import { AXE_AOE_CHANNEL, isAOEChannelUnlocked } from './combat/ContinuousAOERules.mjs';
import { pickForwardCombatTargets } from './combat/FreeAimCombatTargets';
import { BOW_PVE_RANGE, selectCameraBowTarget, cameraBowImpactPoint } from './combat/BowCameraAim.mjs';
import { getBowChargeStatus, applyBowImpactDamage } from './combat/ArcheryChargeRules.mjs';
import { createGame3DBowAimVisuals } from './vfx/Game3DBowSpiritBird.mjs';
import { SKILL_TYPE } from './skills/skillTypes';
import { getPlayerHUD as getHUDForSkill } from './playerHUDStore';
import { tickCompanionCooldowns } from './companionAbilityStore';
import { processCompanionAbilityPress } from './companionAbilityHandler';
import { tickFusion } from './fusionStore';
import { handleCompanionKey } from './companionKeyHandler';
import { applyFusionEffects } from './applyFusionEffects';
import { tickCompanionAutoCombat, resetCompanionAutoCombat } from './companionAutoCombat';
import { createRemotePlayersManager } from './RemotePlayersManager';
import { createEchoGestureRuntime } from './social/echoGestureRuntime';
import { createRemoteCompanionManager } from './RemoteCompanionManager';
import { CompanionAISystem } from './ai/CompanionAISystem';
import {
  combatEnemyProfile, enemyHomeDistance, horizontalDistance,
  shouldEnemyEngage, planEnemyStrike, isWithinEnemyStrike, enemyPursuitVector,
} from './ai/EnemyCombatIntelligence';
import { createEnemyAttackTelegraphs } from './ai/EnemyAttackTelegraphs';
import { CombatSystem } from './combat/CombatSystem';
import { createCombatActionQueue, basicAttackCooldown } from './combat/CombatActionQueue';
import { addDamageFeedback, feedbackKindFromStrike } from './combat/CombatFeedback';
import { createCombatImpactFeedback } from './vfx/CombatImpactFeedback';
import { createDuelDefenseFeedback } from './vfx/DuelDefenseFeedback';
import { createCombatWeaponTrails } from './vfx/CombatWeaponTrails';
import { canSpendCombatResource, spendCombatResource, tickCombatResources, resetCombatResources } from './combat/combatResourcesStore';
import { selectCombatSwingSound, selectCombatImpactSound, AUTHORED_SKILL_SOUNDS } from './combat/CombatSoundRouter';
import { AbilitySystem } from './skills/AbilitySystem';
import { ENEMY_SPAWNS } from './enemySpawnConfig';
import {selectWolfveilGroundedEnemySpawns} from './wolfveil/WolfveilEnemySpawns.mjs';
import {createWolfveilZombieHordeRuntime} from './wolfveil/WolfveilZombieHordeRuntime.js';
import {zombieAttackLevel} from './wolfveil/WolfveilZombieCamps.mjs';
import {WOLFVEIL_ADMIN_C1_MODEL,WOLFVEIL_ADMIN_C1_ANIMATIONS} from './wolfveil/WolfveilEnemyAssets.mjs';
import { createSharedSkinnedFBXSpawner } from './performance/SharedSkinnedFBXSpawner.mjs';
import { broadcastEnemyKill } from './enemyRespawnManager';
import PlayerInteractionMenu from './PlayerInteractionMenu';
import { handleMiddleClick } from './middleClickHandler';
import VoiceMicIndicator from './VoiceMicIndicator';
import { useProximityVoiceController } from './useProximityVoiceController';
import { handleVoiceToggle, attachMicErrorListener } from './handleVoiceToggle';
import { getRunMultiplier, getSprintMultiplier } from './runSkillStore';
import { noteSprintTravel } from './skills/skillMasteryStore';
import { tickBuffs, absorbShield } from './skills/buffCompat';
import { getWeaponMoveSpeedMult } from './weaponClassCombatHelpers';
import { getAXEAttackSpeedMult, resolveAXEHeroStrike, resolveAXEStrikeOnHero } from './axe/combat/AXEStrikeRuntime';
import { getActiveWeaponPath } from './weaponClassBuffStore';
import { pvpFailureMessage, validateLockedPvpTarget } from './pvpCombatRules';
import { getActiveWeaponId } from './progression/weaponMastery/WeaponScalingPipeline';
import { getActiveEquippedAXEWeapon } from './axe/equipment/AXEEquipmentInventoryStore';
import { getAXEWeaponLegacyEchoDamage } from './axe/equipment/AXEWeaponLegacyForge';
import { reportWeaponHit, reportWeaponKill } from './progression/weaponMastery/WeaponMasteryEngine';
import { getTitleState, recordTitleKill, subscribeTitles } from './progression/titleStore';
import { getHaloState } from './progression/haloStore';
import { createAXEMountFusionVisualRuntime } from './axe/progression/AXEMountFusionVisualRuntime';
import { createAXEAscensionVisualRuntime } from './axe/progression/AXEAscensionVisualRuntime';
import { createAXEArmorEquipSync } from './axe/equipment/AXEArmorEquipSync';
import { createAXEAscendedGearVisualRuntime } from './axe/equipment/AXEAscendedGearVisualRuntime';
import { bankAXEAscensionDamage, getAXEAscensionProfile } from './axe/progression/AXEAscensionStore';
import { createAXEHaloVisualRuntime } from './axe/progression/AXEHaloVisualRuntime'; import { addGold } from './shop/shopStore'; import { dispatchRogueAttack } from './rogueAttackBridge';

// GameWorld3D — constants & enemy tier table live in ./gameWorldConfig.js.
import { xpForLevel, pickTier, getEnemyTierByName,
  ARCHER_URL, ANIMATION_URLS,
  DEATH_FADE_DELAY, WALK_SPEED, RUN_SPEED, ROT_SMOOTH, BLEND,
  ENEMY_SPEED, ENEMY_WALK_TIME, ENEMY_IDLE_TIME, ENEMY_WANDER_RADIUS,
  NPC_INTERACT_RANGE, ENEMY_ATTACK_RANGE, RANGED_ATTACK_RANGE, PLAYER_INVUL_AFTER_HIT,
} from './gameWorldConfig';
import { attachContextGuard } from './webglContextGuard';
import { createInkWashLook, resolveInkLevel, resolveInkPalette, readGraphicsSettings } from './render/inkWashLook';
import { createAtomicUltraSumiMode } from './render/atomicUltraSumiMode.mjs';
import {activateCloneUltraWorldGraphics} from './game3dPauseMenuModel.mjs';
import {isInsideMeadowCircle,meadowGroundHeight}
  from './wolfveil/WolfveilMeadowField.mjs';
import {classifyBlazeBiome} from './render/BlazeBiomeLandscaping.mjs';
import { buildGrassEnvironment } from './buildGrassEnvironment';
import {createWolfveilVillage} from './wolfveil/WolfveilScene';
import {createWolfveilAmbientBirds} from './wolfveil/ambient/WolfveilAmbientBirds.mjs';
import {createVortexLakeLandmark} from './wolfveil/VortexLakeScene.mjs';
import {VORTEX_LAKE,isVortexLakeWetSurface} from './wolfveil/VortexLakeLayout.mjs';
import {installWolfveilImportedTown} from './wolfveil/WolfveilImportedTownScene.mjs';
import {WOLFVEIL_PLAYER_TOWN_SPAWN,wolfveilQuestNpcSpot,insideWolfveilImportedTown} from './wolfveil/WolfveilImportedTownLayout.mjs';
import {createWolfveilLivingMeadow} from './wolfveil/WolfveilLivingMeadow';
import {createWolfveilLivingSumiEMaterials} from './wolfveil/WolfveilLivingSumiEMaterials.mjs';
import { insideWolfveilClientGround } from './wolfveil/WolfveilTravelSafety.mjs';
import { findWorkflowSpawn } from './workflow/workflowDestinations.mjs';
import { initialPlayerAnimationClips, loadPlayerAnimationClips } from './player/playerAnimationLibrary';
import { syncFusedLocomotion } from './player/fusedLocomotionSync';
import { createLunaDashboardPlayerController as createPlayerAnimationController } from './player/LunaDashboardPlayerController';
import { CorePlayerStateMachine } from './player/CorePlayerStateMachine';
import { CoreAnimationController } from './player/CoreAnimationController';
import { PlayerCameraSystem } from './player/PlayerCameraSystem'; import { OTS_AIM, createOTSAimState, applyOTSAimFacing } from './player/otsAim.mjs'; import { createOTSCameraColliders } from './player/otsCameraColliders.mjs'; import { updateOTSAimFrame } from './player/otsAimRuntime'; import OTSAimReticle from './hud/OTSAimReticle';
import { createGame3DWorldEntryCamera } from './player/Game3DWorldEntryCamera.mjs';
import {
  GAME3D_GAME2_CAMERA,applyGame3DGame2MouseLook,
  applyGame3DGame2ArrowLook,game3dGame2Zoom,
} from './player/Game3DGame2Camera.mjs';
import { createAvatarDrawCalls } from './player/avatarDrawCalls';
import { createWorldEnvironmentSystem } from './WorldEnvironmentSystem';
import { createCharacterReadabilityLights } from './CharacterReadabilityLights';
import { getCharacterDodge, getPlanarBasisFromYaw } from './player/characterDodgeVector';
import { AXE_CLICK_TO_MOVE_CONFIG, classifyAXEClick, createAXEClickToMove, directionRelativeToFacing } from './axe/player/AXEClickToMove';
import { createAXEClickToMoveMarker, pickAXEClickToMoveGround } from './axe/player/AXEClickToMoveScene';
import { isAXEClickToMoveEnabled } from './axe/player/AXEControlSettingsStore';
import WorldEnvironmentHUD from './WorldEnvironmentHUD';
import { getDetroitWeather } from '@/functions/getDetroitWeather';
import { createPlayerCastLightBeam } from './vfx/playerCastLightBeam';
import { createQuestEnemySpawner } from './questEnemySpawner';
import { spawnLivingQuestNPC } from './npc/spawnLivingQuestNPC';
import {loadAXEQuestNPCVisual} from './npc/axeAnimatedQuestNpcGLB.mjs';
import LivingQuestWorldOverlay from './npc/LivingQuestWorldOverlay';
import { grantQuestReward } from './questRewards';
import QuestRewardToast from './QuestRewardToast';
import Game3DLunarNotifications from './notifications/Game3DLunarNotifications';
import { createAXEServiceStationRuntime } from './axe/services/world/AXEServiceStationRuntime';
import { getAXEDungeonState } from './axe/dungeons/AXEDungeonStore';
import { WOLFVEIL_ROUTES, WOLFVEIL_SITES, wolfveilDistanceToRiver, wolfveilRouteClearance } from './wolfveil/WolfveilLayout';
import { createGame3DWaterContact } from './axe/world/Game3DWaterContact';
import { LUNAR_CAVE_REGION, LUNAR_CAVE_ENTRANCE, LUNAR_CAVE_TRAINING_SPAWNS, LUNAR_CAVE_WATER_END } from './dungeons/LunarCaveLayout.mjs';
import { createLunarMountainEntrance, createLunarCaveDungeon } from './dungeons/LunarCaveScene';
import { ASTRAL_DUNGEON_REGION, ASTRAL_DUNGEON_ENTRANCE, ASTRAL_MONSTER_SPAWNS } from './dungeons/AstralDungeonLayout.mjs';
import { createAstralDungeon, createAstralMountainGate } from './dungeons/AstralDungeonScene';
import { clearLunarCaveMapEnemies, publishLunarCaveMapEnemies } from './dungeons/LunarCaveMapStore.mjs';

const showCombatNotice = (text) => {
  if (!text || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('skillActivatedToast', { detail: { text } }));
};

export default function GameWorld3D({region='wolfveil',initialWorkflowTarget=null,workflowAllowed=false,portalReturn=false,entryCinematic=false,entryMode=false,entryPreviewMode='start',resumeCheckpoint=null} = {}) {
  const avatarConfig=useGameAvatar();
  const appearanceRef=useRef(avatarConfig);appearanceRef.current=avatarConfig;
  // This flag is read by the existing WebGL loop without destroying its scene
  // when character selection gives way to playable world control.
  const entryModeRef=useRef(entryMode);entryModeRef.current=entryMode;
  const entryPreviewModeRef=useRef(entryPreviewMode);entryPreviewModeRef.current=entryPreviewMode;
  const containerRef = useRef(null);
  const modelRef = useRef(null);
  const checkpointTeleporterRef = useRef(null);
  const checkpointOwnerRef = useRef('');
  const [loading, setLoading] = useState(true);
  // Manual clone-only GLB / pure-source exporter status. No auto-downloads.
  const [mapExportState,setMapExportState]=useState('idle');
  const [mapExportError,setMapExportError]=useState('');
  // Buddha Essence tracks real local combat activity. The same character-scoped
  // store supplies the Spiritual UI and permanent stat allocations; no XP is
  // awarded by opening the menu, passive regeneration or idle ticks.
  useEffect(() => {
    let previous = getPlayerHUD();
    let worldReady = false;
    const onWorldReady = () => { previous = getPlayerHUD(); worldReady = true; };
    window.addEventListener('gw3dSceneReady', onWorldReady);
    const unsubscribe = subscribePlayerHUD(current => {
      const last = previous;
      // Claim this snapshot first: awarding Essence recomputes the HUD, and that
      // nested notification must compare against the value just seen, not re-award.
      previous = current;
      if (!worldReady || !last) return;
      if (Number(current?.hp) < Number(last.hp) && Number(current?.maxHP) === Number(last.maxHP) && Number(current.hp) > 0) {
        gainAXEBuddhaEssenceExperience('vitality', Math.max(1, Math.min(8, Math.ceil((last.hp - current.hp) / 25))));
      }
      if (Number.isFinite(Number(current?.chi)) && Number.isFinite(Number(last.chi)) && Number(current.chi) < Number(last.chi)) {
        gainAXEBuddhaEssenceExperience('spirit', Math.max(1, Math.min(8, Math.ceil((last.chi - current.chi) / 15))));
      }
    });
    return () => {
      unsubscribe();
      window.removeEventListener('gw3dSceneReady', onWorldReady);
    };
  }, []);

  const [envSystem, setEnvSystem] = useState(null);
  const [activeDialogue, setActiveDialogue] = useState(null); // { name, text }
  const [armorLayerError,setArmorLayerError]=useState('');
  useEffect(()=>{
    const handle=e=>setArmorLayerError(e.detail?.error||'');
    window.addEventListener('game3dArmorRenderStatus',handle);
    return ()=>window.removeEventListener('game3dArmorRenderStatus',handle);
  },[]);
  // Boss encounter — suppresses quest NPCs + gates boss music/dialogue while active.
  const [questNPCSuppressed, setQuestNPCSuppressed] = useState(false);
  const [nearbyNPC, setNearbyNPC] = useState(null);
  const [nearbyTownResident, setNearbyTownResident] = useState(null);
  const [enemyCount, setEnemyCount] = useState(region==='wolfveil'?0:region===LUNAR_CAVE_REGION?LUNAR_CAVE_TRAINING_SPAWNS.length:region===ASTRAL_DUNGEON_REGION?ASTRAL_MONSTER_SPAWNS.length:ENEMY_SPAWNS.length);
  const [score, setScore] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [playerXP, setPlayerXP] = useState(0);
  const [enemiesUI, setEnemiesUI] = useState([]); // [{ id, x, y, hp, maxHp, level, visible }]
  const [bossHeadUI, setBossHeadUI] = useState(null); // { x, y, hp, maxHp, hpTanks, hpTankSize, name, level }
  const [questNPCsUI, setQuestNPCsUI] = useState([]); // [{ id, x, y, status }]
  const [nearbyQuestNPC, setNearbyQuestNPC] = useState(null); // { id, name }
  const [livingQuestUI, setLivingQuestUI] = useState(null); // projected head label { x, y }
  const [nearbyLivingQuest, setNearbyLivingQuest] = useState(false);
  const livingQuestNearRef = useRef(false);
  const [activeQuestDialogue, setActiveQuestDialogue] = useState(null); // { npcName, quest, mode, progress }
  const spawnQuestEnemiesRef = useRef(null); // set inside useEffect once scene is ready
  const [questState, setQuestState] = useState(getQuestState());
  // Quest and NPC dialogues release the cursor and own A/D/F/R input.
  useEffect(() => {
    const open = !!(activeDialogue || activeQuestDialogue);
    window.__axeDialogueOpen = open;
    if (open) {
      if (document.pointerLockElement) document.exitPointerLock?.();
      window.dispatchEvent(new Event('axeDialogueOpened'));
    }
    return () => { if (window.__axeDialogueOpen === open) window.__axeDialogueOpen = false; };
  }, [activeDialogue, activeQuestDialogue]);
  useEffect(() => {
    if (!activeDialogue || activeQuestDialogue) return;
    const onDialogueKey = event => {
      const key = event.key.toLowerCase();
      if (!event.repeat && (key === 'escape' || key === 'f' || key === 'enter')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setActiveDialogue(null);
      }
    };
    window.addEventListener('keydown', onDialogueKey, true);
    return () => window.removeEventListener('keydown', onDialogueKey, true);
  }, [activeDialogue, activeQuestDialogue]);
  const [playerMenu, setPlayerMenu] = useState(null); const remoteManagerRef = useRef(null);
  const [localMicOn, setLocalMicOn] = useState(false);
  const [talkingPeers, setTalkingPeers] = useState({});
  const [remoteMicUI, setRemoteMicUI] = useState([]);
  const { voiceRef } = useProximityVoiceController({
    remoteManagerRef,
    onTalkingChange: (peerId, talking) => setTalkingPeers((prev) => {
      if (!!prev[peerId] === talking) return prev;
      const next = { ...prev }; if (talking) next[peerId] = true; else delete next[peerId]; return next;
    }),
  });
  const [nearbyCompanion, setNearbyCompanion] = useState(false);
  const nearbyCompanionRef = useRef(false);
  const [isMounted, setIsMounted] = useState(false);
  // Companion live HP bar (projected to screen each frame)
  const [companionUI, setCompanionUI] = useState(null); // { x, y, hp, maxHp, level }
  // Player name tag floating above the player's head
  const [playerName, setPlayerName] = useState('');
  const [playerTitleDisplay, setPlayerTitleDisplay] = useState(() => {
    const s = getTitleState();
    return (!s.displayHidden && s.equippedTitle?.level > 0) ? s.equippedTitle.name : '';
  });
  const [playerNameUI, setPlayerNameUI] = useState(null); // { x, y }
  // Companion live combat stats (HP, derived, level) — updated when stats are allocated
  const companionStatsRef = useRef(null);
  const companionRegenAccumRef = useRef(0);
  const companionGroupRef = useRef(null);
  const companionMixerRef = useRef(null);
  const companionWalkActionRef = useRef(null);
  const companionIdleActionRef = useRef(null);
  const companionRunActionRef = useRef(null);
  const companionCurrentAnimRef = useRef('idle');
  const mountToggleRef = useRef(false);
  const isMountedRef = useRef(false);
  const companionDefRef = useRef(getCompanionById(getCompanionState().activeCompanionId));
  // Floating damage/XP numbers — projected to screen each frame.
  const floatsRef = useRef([]);
  const [floats, setFloats] = useState([]);
  const floatIdRef = useRef(0);
  // Keep every critical/miss distinct. Rapid SAME-KIND numeric strikes
  // combine into a total and hit count, not the last-hit overwrite.
  const spawnDamageFloat = (enemyId, value, { kind } = {}) => {
    const resolvedKind = kind || (value === 'MISS' ? 'miss' : 'normal');
    floatsRef.current = addDamageFeedback(floatsRef.current, {
      id: ++floatIdRef.current, enemyId, value,
      kind: resolvedKind, born: performance.now(),
    });
  };
  const spawnXPFloat = (value) => {
    floatsRef.current.push({ id: ++floatIdRef.current, enemyId: 'player', value, type: 'xp', born: performance.now() });
  };
  const playerLevelRef = useRef(1);
  const playerXPRef = useRef(0);
  // Player stats: base + gear → derived combat values
  const playerBaseStatsRef = useRef({ ...DEFAULT_PLAYER_STATS });
  const playerEquipmentRef = useRef([]);
  const playerDerivedRef = useRef(
    computeDerivedStats(DEFAULT_PLAYER_STATS, [])
  );
  const keys = useRef({});
  const drag = useRef({ active: false, x: 0, y: 0 });
  const abilityKeyPressed = useRef(-1); // slot index pressed this frame (-1 = none)
  const companionAbilityPressed = useRef(null);
  const activeEffects = useRef([]); // { alive: fn, update: fn }
  const orbit = useRef({ yaw: 0, pitch: GAME3D_GAME2_CAMERA.pitch, distance: GAME3D_GAME2_CAMERA.distance }); const otsAim = useRef(null); if (!otsAim.current) otsAim.current = createOTSAimState();
  const nearbyNPCRef = useRef(null);
  const nearbyTownResidentRef = useRef(null);
  const interactPressed = useRef(false);
  const attackPressed = useRef(false);
  const rangedClickAttackPressed = useRef(false);
  const oneShotPlaying = useRef(false);
  const lockOnTargetRef = useRef(null);
  const playerAttackCooldown = useRef(0);
  const playerInvulTimer = useRef(0);
  const nearbyQuestNPCRef = useRef(null);
  // Master visibility flag for all non-boss entities on the map (quest NPCs,
  // mutant enemies, companion). Hidden by default; press '=' to toggle back.
  const npcsVisibleRef = useRef(region === 'wolfveil' || region === LUNAR_CAVE_REGION);
  const playerLevelStateRef = useRef(1); // kept in sync with playerLevel for quest gating

  // Hydrate persistent progression (level, XP, stats, HP) from localStorage.
  useEffect(() => {
    const saved = getPlayerHUD();
    playerLevelRef.current = saved.level || 1;
    playerXPRef.current = saved.xp || 0;
    playerBaseStatsRef.current = { ...saved.baseStats };
    playerDerivedRef.current = saved.derived || computeDerivedStats(saved.baseStats, []);
    setPlayerLevel(saved.level || 1);
    setPlayerXP(saved.xp || 0);
    // Refresh xpForNext to match the loaded level's curve
    setPlayerHUD({ xpForNext: xpForLevel(saved.level || 1) });
  }, []);

  // Quest store subscription
  useEffect(() => subscribeQuests((s) => setQuestState({ ...s })), []);
  // Toast when mic permission is denied
  useEffect(() => attachMicErrorListener(), []);
  useEffect(()=>{if(modelRef.current)applyPlayerAppearance(modelRef.current,avatarConfig);},[JSON.stringify(avatarConfig)]);
  // Show the selected Game 3D character's own name, including same-model swaps.
  // The editor-only Dev Test avatar continues to use the account display name.
  const activeCharacterId=getActiveCharacter()?.id;
  useEffect(() => {
    const character=getActiveCharacter();
    if(character?.name && !character.isDevTest){setPlayerName(character.name);return;}
    base44.auth.me().then((u) => { if (u) setPlayerName(u.username || u.full_name || u.email?.split('@')[0] || 'Player'); }).catch(() => setPlayerName('Player'));
  }, [activeCharacterId]);

  // A renderer can stay mounted behind character selection. Only save a
  // position under the identity that actually entered world play.
  useEffect(() => {
    checkpointOwnerRef.current = entryMode ? '' : getStorageUser() + '::' + getActiveId();
  }, [entryMode, activeCharacterId]);

  useEffect(() => subscribeTitles((s) => {
    setPlayerTitleDisplay((!s.displayHidden && s.equippedTitle?.level > 0) ? s.equippedTitle.name : '');
  }), []);

  // Keep companion def ref in sync when player picks a different companion in the menu
  useEffect(() => {
    return subscribeCompanion((s) => {
      companionDefRef.current = getCompanionById(s.activeCompanionId);
    });
  }, []);

  // Live companion combat stats — recomputed when player allocates Skill Tree points.
  // Result is consumed by the HP-bar UI and (later) any companion attack/ability code.
  useEffect(() => {
    return subscribeCompanionProgression(() => {
      const def = companionDefRef.current;
      if (!def) return;
      const prog = getCompanionProgression(def.id);
      const derived = computeDerivedStats(prog.baseStats, []);
      const prev = companionStatsRef.current;
      const hp = prev ? Math.min(derived.maxHP, prev.hp + Math.max(0, derived.maxHP - prev.maxHp)) : derived.maxHP;
      companionStatsRef.current = { hp, maxHp: derived.maxHP, level: prog.level, derived };
    });
  }, []);

  // Keep a ref of the latest player level for the animation loop to read
  useEffect(() => {
    playerLevelStateRef.current = playerLevel;
  }, [playerLevel]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Scene — natural sky dome + retained terrain fog depth.
    // No static skybox: the WorldEnvironmentSystem paints a gradient sky
    // (day/night/season/weather) and drives the sun + moon across it.
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x080b18, 350, 2200);
    scene.background = null;

    // Renderer — keep it simple and proven. Create a canvas explicitly so we
    // can attach the WebGL context-loss listener BEFORE THREE allocates the
    // context, and we can detect a failed context immediately.
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    } catch (e) {
      console.error('GameWorld3D: WebGL unavailable —', e);
      window.dispatchEvent(new CustomEvent('game3dWorldAvatarLoadError',{detail:{message:'WebGL could not start. Check browser graphics support and reload.'}}));
      setLoading(false);
      canvas.remove();
      const msg = document.createElement('div');
      msg.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-family:sans-serif;background:#0f1419;text-align:center;padding:24px;';
      msg.innerHTML = '<div><div style="font-size:18px;font-weight:600;margin-bottom:8px">3D world unavailable</div><div style="opacity:0.6;font-size:14px">Your browser couldn\'t allocate a WebGL context. Close other tabs and reload.</div></div>';
      container.appendChild(msg);
      return;
    }

    // Width/height may be 0 on first paint inside hidden tabs — guard against that.
    const w0 = container.clientWidth || window.innerWidth;
    const h0 = container.clientHeight || window.innerHeight;
    // Perf: cap pixel ratio at 1.5 — halves fragment-shader work on hi-DPI
    // screens with virtually no visible quality loss.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(w0, h0, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Cave-specific exposure: protect readable monster colors and surfaces
    // in an enclosed map without brightening outdoor Wolfveil or other games.
    renderer.toneMappingExposure = region===LUNAR_CAVE_REGION ? 1.55 : region===ASTRAL_DUNGEON_REGION ? 1.45 : 1.1;
    // Perf: cheaper shadow filtering + don't re-render the shadow map every
    // frame (the sun is static, so shadows only need an occasional refresh).
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    // Guard against WebGL context loss + post-dispose render calls — without
    // this, three.js shadow-map pass crashes inside getUniforms() with
    // "Cannot read properties of null (reading 'trim')".
    const rendererGuard = attachContextGuard(renderer);
    // Clone-only, one-time activation of the user's selected Ultra Max
    // world style; never migrates inventory, characters or simulation state.
    let cloneUltraGraphics;
    try{cloneUltraGraphics=activateCloneUltraWorldGraphics(window.localStorage);}
    catch{cloneUltraGraphics=activateCloneUltraWorldGraphics(null);}
    // The world's look: sumi-e ink wash (render/inkWashLook.js), as the pause menu's Graphics settings say (or ?ink=).
    const inkLook = createInkWashLook({ renderer, guard: rendererGuard, level: resolveInkLevel(), palette: resolveInkPalette() });
    let livingInkWorld = null; // initialized only after the Game 3D Wolfveil roots exist
    let atomicLook = null; // clone-only safe global vegetation material style
    window.__gw3dInkLook = inkLook; // the bench and reviews read and set its level
    const onGraphicsSettings = () => {
      inkLook.setPalette(resolveInkPalette());
      inkLook.setLevel(resolveInkLevel());
      livingInkWorld?.setLevel(resolveInkLevel());
      const g={...cloneUltraGraphics,...readGraphicsSettings()};
      atomicLook?.setQuality(g.quality||'high');
      ambientBirds?.setQuality(g.quality||'high');
      atomicLook?.setEnabled(g.artStyle==='atomic-ultra-sumi');
    };
    window.addEventListener('graphicsSettingsChanged', onGraphicsSettings);

    // Camera
    const camera = new THREE.PerspectiveCamera(GAME3D_GAME2_CAMERA.fov, (w0 || 1) / (h0 || 1), 0.1, 3200);
    camera.position.set(0, 3, -5);
    // One-shot cinematic after genuine Wolfveil Play has loaded its own actor.
    // No second preview world, alternate ground height or authority fork.
    const entryCamera=createGame3DWorldEntryCamera({enabled:entryCinematic && region==='wolfveil' && !entryMode});
    let menuCameraHeld=Boolean(entryModeRef.current);
    let entryCameraReleased=false; // only after the real player model/animation load

    remoteManagerRef.current = createRemotePlayersManager(scene);
    // Dedicated duels use server-owned X/Z and 2D capsule collision.
    // This is a visual projection, NOT a replacement for world terrain physics.
    let dedicatedMode=window.__game3dDedicatedMode||null;
    let dedicatedPose=window.__game3dDedicatedPose||null;
    const onDedicatedMode=event=>{
      dedicatedMode=event.detail||null;
      if(!dedicatedMode){
        dedicatedPose=null;
      }else{
        // Movement input is disabled by the per-frame authority gate.
      }
    };
    const onDedicatedPose=event=>{
      const pose=event.detail;
      if(dedicatedMode && pose?.matchId===dedicatedMode.matchId &&
          Array.isArray(pose.players)&&pose.players.length===2)
        dedicatedPose=pose;
    };
    window.addEventListener('game3dDedicatedMode',onDedicatedMode);
    window.addEventListener('game3dDedicatedPose',onDedicatedPose);
    const remoteCompanionManager = createRemoteCompanionManager(scene);
    // Echo gestures are presentation-only and never override movement or combat.
    // A gesture is emitted only after the server confirms it in an active,
    // participant-authorized conversation. Every client renders its own actor.
    const echoGestureRuntime = createEchoGestureRuntime({
      scene,
      getLocalModel: () => modelRef.current,
      getRemoteModel: (playerId) => remoteManagerRef.current?.getRemotes?.().get(playerId)?.group,
    });
    const onEchoGestureObserved = (event) => {
      echoGestureRuntime.play(event.detail);
    };
    window.addEventListener('echoGestureObserved', onEchoGestureObserved);

    // Slice C — expose scene + camera + legacy remote manager on window so the
    // network-remotes pipeline (mounted as a sibling) can attach without code
    // changes inside this giant useEffect. Cleared on unmount below.
    window.__gw3dScene = scene;
    window.__gw3dCamera = camera;
    window.__gw3dRenderer = renderer; // read by debug/RenderStatsOverlay (default off)
    window.__gw3dLegacyRemoteManager = remoteManagerRef.current;
    const hemi = new THREE.HemisphereLight(0xcfe4ff, 0x4a3a2a, 1.0);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff4d6, 2.2);
    sun.position.set(20, 30, 10);
    sun.castShadow = true;
    // Perf: 1024 shadow map (down from 2048) + tighter shadow frustum around
    // the playable arena — quarter of the texture memory & fill cost.
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -25;
    sun.shadow.camera.right = 25;
    sun.shadow.camera.top = 25;
    sun.shadow.camera.bottom = -25;
    sun.shadow.camera.far = 80;
    scene.add(sun);

    // GLTF loader shared by runtime VFX (e.g. player cast beam).
    const worldGltfLoader = new GLTFLoader();

    // Day/night + seasons + dynamic weather (rain, snow, storm, fog, clouds)
    const envSystem = createWorldEnvironmentSystem({ scene, sun, hemi, fog: scene.fog, camera, renderer, dayLengthSeconds: 86400 });
    setEnvSystem(envSystem);
    window.__worldEnv = envSystem;
    if(region===ASTRAL_DUNGEON_REGION){
      envSystem.setSkyEnabled(false);
      sun.intensity=0;hemi.intensity=0;
    }

    // Character readability layer — fill + rim lights that follow the player
    // and camera so avatars stay visible at dusk/night while the WORLD stays
    // dark. Applied after envSystem.update each frame so weather/time can't
    // crush character visibility.
    const charLights = createCharacterReadabilityLights({ scene });

    // Tornado weather/boss effect is temporarily removed from the playable
    // Game Viewer. Keep an inert compatibility object so older movement/camera
    // code can run without spawning visuals, physics, lift, or camera shake.
    const tornado = {
      update: () => ({ allowLookUp: false, lockMovement: false, liftY: 0, shake: 0 }),
      getState: () => ({ active: false }),
      spawn: () => false,
      stop: () => {},
      dispose: () => {},
    };
    window.__tornado = null;
    const tornadoView = { allowLookUp: false, wasActive: false };

    // Fetch the real 7-day Detroit forecast from the NWS and feed it to the
    // environment system so rain/snow/storm/fog/cloud cover mirror the actual
    // weather at that time. Re-fetch every 30 minutes to stay current.
    const fetchWeather = async () => {
      try {
        const res = await getDetroitWeather({});
        const data = res?.data;
        if (data && Array.isArray(data.hours) && data.hours.length > 0) {
          envSystem.loadForecast(data);
        }
      } catch (e) { /* keep the probabilistic fallback until the next fetch */ }
    };
    fetchWeather();
    const weatherInterval = setInterval(fetchWeather, 30 * 60 * 1000);

    // Game 1 Verdant Wilds forest: real raised bark, wind/rain grass, water,
    // muddy puddles, and wandering fauna on this world's Three.js scene.
    // This intentionally does NOT mount Game 2's separate WebGL arena.

    // LOW-POLY ENVIRONMENT MAP — bundle URLs from admin AssetFile manifest. groundMeshes used for raycast snapping.
    const groundMeshes = [];           // meshes used for terrain raycasts
    const groundRaycaster = new THREE.Raycaster();
    const downVec = new THREE.Vector3(0, -1, 0);
    /** Returns terrain Y at (x,z), or null if no hit. */
    const sampleGroundY = (x, z) => {
      if (groundMeshes.length === 0) return null;
      // Wolfveil mountains exceed the old 50m ray origin. Cast from above
      // the highest ridge, otherwise walking can find no floor and appear to fall.
      groundRaycaster.set(new THREE.Vector3(x, region === 'wolfveil' ? 1500 : 50, z), downVec);
      const hits = groundRaycaster.intersectObjects(groundMeshes, true);
      return hits.length > 0 ? Math.max(hits[0].point.y, importedSpawnTown?.groundY(x, z) ?? -Infinity) : null;
    };
    // Aerial reports sample from above the highest peaks rather than the
    // regular player-foot 50m ray origin; this preserves mountain elevations.
    const sampleTileGroundY = (x,z) => {
      if (!groundMeshes.length) return null;
      groundRaycaster.set(new THREE.Vector3(x, 1500, z), downVec);
      const hits = groundRaycaster.intersectObjects(groundMeshes, true);
      return hits.length ? hits[0].point.y : null;
    };
    window.__axeTileInspectionSampleGroundY = sampleTileGroundY;

    let mapReady = false;
    const pendingFootings = []; // entities waiting to be snapped to ground once map loads

    // Game 1 enters the Shadow Wolf hometown by default. Its ground is the
    // very same mesh used by the full-size village renderer and physics.
    // Keep the old forest test world selectable, never silently delete it.
    const wolfveilVillage=region==='wolfveil'
      ?createWolfveilVillage(scene,{
          originAtMarket:true,
          // Game 3D-only silver river; default Game 1 material stays unchanged.
          silverWater:true,
          sunLight:sun,
          hideMarketStalls:true, // remove requested vendor shelters/tables
          importedTownAtMarket:true, // replace old market fountain/plaza with assembled town
          // First 96m x 96m spawn square: textured earth/grass underneath
          // actual 3D clumps, preserving paved plaza and road readability.
          // Keep all other squares and the shared Game 1 view untouched.
          spawnGroundTile:true,
          groundCover:{radius:68,cellSize:16,attemptsPerCell:450,squareHalfExtent:48},
          // The model loads asynchronously. Register its true floors and
          // stair treads for player-foot and companion raycasts as soon as
          // the single shared GLB finishes loading.
          onHouseWalkableSurfaces(surfaces){
            groundMeshes.push(...surfaces);
            scene.updateMatrixWorld(true);
          },
        }) : null;
    // Clone-only ambient wildlife: one owner bird GLB, cosmetic flight only.
    const ambientBirds=wolfveilVillage?createWolfveilAmbientBirds({
      scene,quality:readGraphicsSettings().quality||'high',
      mobile:window.matchMedia?.('(pointer: coarse)')?.matches??false,
    }):null;
    const waterContact=wolfveilVillage
      ?createGame3DWaterContact(wolfveilVillage.river.water,{originZ:70,fog:scene.fog})
      :null;
    // Share the same wake rings and clock between foam and water normals.
    wolfveilVillage?.river?.bindContact?.(waterContact);
    // The cave is an entirely separate map, sharing only Game 3D's real
    // character, renderer, animations and combat systems.
    const lunarDungeon = region===LUNAR_CAVE_REGION ? createLunarCaveDungeon(scene) : null;
    const astralDungeon = region===ASTRAL_DUNGEON_REGION ? createAstralDungeon(scene) : null;
    const grassGround=wolfveilVillage?.ground||lunarDungeon?.ground||astralDungeon?.ground||buildGrassEnvironment(scene);
    const forestBiome = grassGround.userData.forestBiome;
    groundMeshes.push(grassGround);
    // The owner's 80-tile assembled town is on the SAME authoritative terrain.
    // Loading errors never block the character or remove Wolfveil's ground.
    const importedSpawnTown=region==='wolfveil'?installWolfveilImportedTown(scene,{onReady:()=>{livingInkWorld?.refresh();for(const npc of questNPCs)snapToGround(npc.group,0);}}):null;
    const vortexLake=region==='wolfveil'
      ?createVortexLakeLandmark(scene,{
        sampleGroundY,
        addGroundMesh:mesh=>groundMeshes.push(mesh),
        removeGroundMesh:mesh=>{
          const i=groundMeshes.indexOf(mesh);
          if(i>=0)groundMeshes.splice(i,1);
        },
      }):null;
    window.__gw3dVortexLake=vortexLake;
    const lunarGate = region==='wolfveil' ? createLunarMountainEntrance(scene,{sampleGroundY}) : null;
    const astralGate = region==='wolfveil' ? createAstralMountainGate(scene,{sampleGroundY}) : null;
    if(wolfveilVillage?.walkableSurfaces?.length) groundMeshes.push(...wolfveilVillage.walkableSurfaces);
    // Streamed outer meadow + map-wide Sumi-e brushwork across terrain, mountains, caves & town.
    const livingMeadow=wolfveilVillage?createWolfveilLivingMeadow({
      scene, offsetZ:70, grassTileReplacement:wolfveilVillage.grassTileReplacement,
      addGroundMesh(mesh){groundMeshes.push(mesh);},
      removeGroundMesh(mesh){const index=groundMeshes.indexOf(mesh);if(index>=0)groundMeshes.splice(index,1);},
    }):null;
    livingMeadow?.update(0,{}, {x:0,z:0}, []);
    livingInkWorld = wolfveilVillage ? createWolfveilLivingSumiEMaterials({
      roots:[wolfveilVillage.world.group,livingMeadow?.root,importedSpawnTown?.root],
      level:resolveInkLevel(),
    }) : null;
    // The *existing* clone game scene is reused. GPU-instanced living grass
    // streams across all eligible outdoor Wolfveil tiles, not one 1000m²
    // demonstration patch. Trees keep their actual imported GLB materials.
    const atomicSettings={...cloneUltraGraphics,...readGraphicsSettings()};
    atomicLook=createAtomicUltraSumiMode({
      scene,renderer,camera,guard:rendererGuard,worldRegion:region,
      // Wolfveil terrain is authored at local Z; the world offset is +70.
      // Analytic sampler avoids ~2,000 expensive ground raycasts per tile.
      sampleHeight:region==='wolfveil'
        ? (x,z)=>isInsideMeadowCircle(x,z-70)?
          meadowGroundHeight(x,z-70):null
        :sampleGroundY,
      quality:atomicSettings.quality||'high',
      enabled:atomicSettings.artStyle==='atomic-ultra-sumi',
      allowGrass:(x,z)=>region==='wolfveil'&&
        isInsideMeadowCircle(x,z-70)&&
        !insideWolfveilImportedTown(x,z,3)&&
        wolfveilDistanceToRiver(x,z-70)>4&&
        !isVortexLakeWetSurface(x,z-70,2)&&
        wolfveilRouteClearance(x,z-70)>4,
      biomeAt:({x,z})=>region==='wolfveil'?'meadow':
        classifyBlazeBiome({region}),
    });
    window.__gw3dAtomicLook=atomicLook;
    // Explicit, opt-in clone map export. Captures the SAME assembled scene
    // seen in play; it never repositions or detaches world objects.
    const exportLiveGame3DMap = async ({allowPartialAssets=false,...options}={}) => {
      if (window.__gw3dScene !== scene) throw Error('The Game 3D world is no longer mounted');
      if (region === 'wolfveil' && !allowPartialAssets) {
        // The current map retires legacy housing in some regions; only require
        // the optional house GLB when residence placements actually exist.
        const hasResidence=wolfveilVillage?.town?.buildings?.some(b=>b.kind==='residence');
        if(hasResidence){
          const houses=await wolfveilVillage?.houseModels?.ready;
          if(!houses)throw Error('Wolfveil house GLB unavailable: refusing incomplete full-map export');
        }
        let checks = 0;
        while (importedSpawnTown?.status === 'loading' && checks++ < 120) {
          await new Promise(resolve => setTimeout(resolve, 250));
        }
        if (importedSpawnTown?.status !== 'ready')
          throw Error('Wolfveil imported town GLB not ready: refusing incomplete full-map export');
      }
      const {exportGame3DFullMap} = await import('./mapExport/Game3DFullMapExporter.mjs');
      return exportGame3DFullMap({...options,scene,region});
    };
    window.exportGame3DMap = exportLiveGame3DMap;
    mapReady = true;
    // Flush any spawn snapping that queued before this point (none in practice
    // since this runs synchronously, but kept for safety).
    pendingFootings.forEach((fn) => fn());
    pendingFootings.length = 0;

    // Helper: stand an object on the terrain at (x,z). If map isn't ready yet,
    // queue the snap for after the FBX finishes loading.
    const snapToGround = (obj3d, footOffset = 0) => {
      const apply = () => {
        const y = sampleGroundY(obj3d.position.x, obj3d.position.z);
        if (y !== null) obj3d.position.y = y + footOffset;
      };
      if (mapReady) apply();
      else pendingFootings.push(apply);
    };

    // Generic capsule NPCs removed; only real quest NPC assets remain.
    const npcs = [];

    // Shared FBX loader (used for player + enemies + quest NPCs)
    const loader = new FBXLoader();
    // One reusable FBX source per world; each actor gets its own skeleton.
    const creatureSource = createSharedSkinnedFBXSpawner(loader, CREATURE_MODEL_URL);
    // Load ahead of later quest spawns, without blocking the first frame.
    if (region === 'wolfveil') {
      const warm = () => { void creatureSource.warm().catch(() => {}); };
      if (typeof requestIdleCallback === 'function') requestIdleCallback(warm, { timeout: 3000 });
      else setTimeout(warm, 1500);
    }
    const clock = new THREE.Clock();
    const playerModelRef = { current: null };

    // Quest-NPC idle clip — uses the ARCHER idle (player-style anim set), not the
    // mutant idle that enemies use. Quest NPCs must ONLY play this idle.
    const questNPCIdleClipPromise = new Promise((resolve) => {
      loader.load(
        ANIMATION_URLS.idle,
        (animFbx) => resolve(animFbx.animations?.[0] || null),
        undefined,
        () => resolve(null),
      );
    });

    // Quest NPC — cloned archer model, spawned right next to the player.
    const questNPCs = []; // populated after ARCHER_URL loads below
    let livingQuestEntity = null; // { group, mixer } — oversized Living Quest NPC

        // COMPANION SPAWN — rideable mount (GLB w/ embedded clips OR FBX w/ separate idle+walk anim files).
    let companionAssetVersion = 0;
    let companionAssetDisposed = false;
    let companionSecondaryRig = null; // actual Faction 3 mount, never rider/camera
    let factionThreeLastRunAt = -Infinity; // absorb tiny follower/terrain state flickers
    let mountedRider = null;
    let mountedWeapon = null;
    let heldBowPresentation = null;
    let heldBowPlayer = null;
    let mountedRiderPlayer = null;
    let mountedRiderMount = null;
    let mountAppearanceSeconds = 0, mountedAttackSeconds = 0; // weapon is drawn while riding only briefly after an attack
    const restoreMountedRider = () => {
      mountedWeapon?.dispose();
      mountedWeapon = null;
      mountedRider?.restore();
      mountedRider = null;
      mountedRiderPlayer = null;
      mountedRiderMount = null;
      mountAppearanceSeconds = 0;
    };
    const loadCompanionAsset = (companionDef) => {
      const assetVersion = ++companionAssetVersion;
      if (!companionDef) return;
      const setupCompanion = (companionModel, embeddedClips = []) => {
        if (companionAssetDisposed || assetVersion !== companionAssetVersion) return;
        // Keep the navigation root aligned with world +Z while the actual
        // Faction 3 animal mesh faces the same bearing as its anatomy.
        // This inner-only correction never changes the player's motion/yaw.
        const {worldRoot: companionWorldRoot} =
          createFactionThreeFacingFrame(companionModel, companionDef);
        const box = new THREE.Box3().setFromObject(companionWorldRoot);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const compScale = (1.7 / maxDim) * (companionDef.scale || 1.0);
        companionWorldRoot.scale.setScalar(compScale);
        companionWorldRoot.position.set(
          companionDef.spawnPos[0],
          companionDef.spawnPos[1],
          companionDef.spawnPos[2],
        );

        companionModel.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = !node.isSkinnedMesh;
            node.receiveShadow = true;
          }
        });

        // Golden friendly ring under the companion
        const ringGeo = new THREE.RingGeometry(0.8 / compScale, 1.05 / compScale, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xfbbf24,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.55,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.02 / compScale;
        companionWorldRoot.add(ring);

        scene.add(companionWorldRoot);
        snapToGround(companionWorldRoot, 0);
        // Anchor repair is calculated after placement, before animation;
        // spring motion remains driven only by the mount's own transform.
        companionSecondaryRig?.dispose();
        companionSecondaryRig=createFactionThreeMountRig(companionModel,companionDef);

        const compMixer = new THREE.AnimationMixer(companionModel);
        companionGroupRef.current = companionWorldRoot;
        companionMixerRef.current = compMixer;

        // Helper: bind idle + walk clips onto this companion's mixer.
        // Used both for embedded-clip and external-clip flows.
        const bindCompanionClips = (clips) => {
          if (companionAssetDisposed || assetVersion !== companionAssetVersion) return;
          const findClip = (substr) => {
            if (!substr || !clips.length) return null;
            const lc = substr.toLowerCase();
            return clips.find((c) => (c.name || '').toLowerCase().includes(lc)) || null;
          };
          const idleClip = findClip(companionDef.idleClipName) || clips[0];
          const walkClip = findClip(companionDef.walkClipName) || clips[1] || clips[0];
          const runClip  = findClip(companionDef.runClipName)  || clips[2] || null;
          if (idleClip) {
            const idle = compMixer.clipAction(idleClip);
            companionIdleActionRef.current = idle;
            idle.reset().fadeIn(0.2).play();
          }
          if (walkClip && walkClip !== idleClip) {
            const walk = compMixer.clipAction(walkClip);
            walk.setEffectiveTimeScale(1.0);
            companionWalkActionRef.current = walk;
          }
          if (runClip && runClip !== idleClip && runClip !== walkClip) {
            const run = compMixer.clipAction(runClip);
            run.setEffectiveTimeScale(1.0);
            companionRunActionRef.current = run;
          }
        };

        if (companionDef.modelFormat === 'glb' &&
            (embeddedClips.length > 0 || companionDef.animationSource?.startsWith('baby-wolf-'))) {
          // Split the dog's authored timeline and bake it onto the target's
          // actual bind pose; never bind dog tracks directly to a different rig.
          prepareMountAnimationClips(companionModel, embeddedClips, companionDef)
            .then(bindCompanionClips)
            .catch(err => console.error('Mount animation preparation error:', err));
        } else if (companionDef.modelFormat === 'glb' && companionDef.animationSource !== 'none') {
          // Legacy mesh — source idle / walk clips from the admin AnimationFBX
          // library (folder = "companion"). See companionAnimationLoader.js.
          loadCompanionFolderClips(loader)
            .then((clips) => bindCompanionClips(clips))
            .catch((err) => console.error('Companion AnimationFBX load error:', err));
        } else if (companionDef.modelFormat !== 'glb') {
          // FBX format — load idle + walk anim files separately via FBXLoader
          loader.load(companionDef.idleAnim, (af) => {
            if (af.animations?.[0]) {
              const idle = compMixer.clipAction(af.animations[0]);
              companionIdleActionRef.current = idle;
              idle.reset().fadeIn(0.2).play();
            }
          });
          loader.load(companionDef.walkAnim, (af) => {
            if (af.animations?.[0]) {
              const walk = compMixer.clipAction(af.animations[0]);
              walk.setEffectiveTimeScale(0.7);
              companionWalkActionRef.current = walk;
            }
          });
        }
      };

      if (companionDef.modelFormat === 'glb') {
        // For glTF bundles (separate .bin + textures), wire a LoadingManager
        // whose URLModifier maps relative paths to absolute Base44 URLs.
        const compManager = createCompanionLoadingManager(THREE, companionDef);
        const gltfLoader = compManager ? new GLTFLoader(compManager) : new GLTFLoader();
        const failToPreviousModel = err => {
          if (companionAssetDisposed || assetVersion !== companionAssetVersion) return;
          if (companionDef.previousModelUrl) {
            console.warn('Faction pet asset unavailable; restoring previous rig', err);
            // Incrementing the asset generation invalidates any still-pending
            // callbacks. The old rig needs its original dog retarget profile.
            loadCompanionAsset({
              ...companionDef,
              modelUrl: companionDef.previousModelUrl,
              previousModelUrl: null,
              animationRigProfile: null,
            });
          } else console.error('Companion GLB load error:', err);
        };
        gltfLoader.load(
          companionDef.modelUrl,
          (gltf) => {
            const root = gltf.scene || gltf.scenes?.[0];
            if (root) setupCompanion(root, gltf.animations || []);
            else failToPreviousModel(new Error('Companion GLB has no scene'));
          },
          undefined,
          failToPreviousModel,
        );
      } else {
        loader.load(companionDef.modelUrl, (fbx) => setupCompanion(fbx, []));
      }
    };
    // The mount and the Companion tab share this SAME model, even when the
    // player changes their active mount mid-session. No scene or map reload.
    let renderedCompanionId = companionDefRef.current?.id || null;
    loadCompanionAsset(companionDefRef.current);
    const unsubCompanionAsset = subscribeCompanion(snapshot => {
      const nextId = snapshot.activeCompanionId || null;
      if (nextId === renderedCompanionId) return;
      renderedCompanionId = nextId;
      ++companionAssetVersion; // invalidate in-flight GLB/FBX callbacks
      if (isMountedRef.current) {
        restoreMountedRider();
        isMountedRef.current = false;
        playerAnim?.setMounted?.(false);
        playerStateMachine.setMounted(false);
        setIsMounted(false);
        setMounted(false);
        setAXEMountRiding(false);
        if (modelRef.current) modelRef.current.visible = true;
      }
      const previous = companionGroupRef.current;
      companionSecondaryRig?.dispose();
      companionSecondaryRig=null;
      factionThreeLastRunAt=-Infinity;
      companionGroupRef.current = null;
      companionMixerRef.current?.stopAllAction?.();
      companionMixerRef.current = null;
      companionIdleActionRef.current = null;
      companionWalkActionRef.current = null;
      companionRunActionRef.current = null;
      companionCurrentAnimRef.current = 'idle';
      if (previous) {
        scene.remove(previous);
        previous.traverse(node => {
          node.geometry?.dispose?.();
          const materials = node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : [];
          materials.forEach(material => material.dispose?.());
        });
      }
      companionDefRef.current = getCompanionById(nextId);
      loadCompanionAsset(companionDefRef.current);
    });

    // Enemy spawns — mutant model patrolling between waypoints
    const enemies = [];
    let lastDungeonMapSync=0;
    if(region===LUNAR_CAVE_REGION||region===ASTRAL_DUNGEON_REGION) clearLunarCaveMapEnemies();
    // Keep all ordinary enemy AI in the existing GameWorld3D loop. Do not
    // update the separate legacy EnemyAISystem as a second, competing AI.
    const enemyTelegraphs = createEnemyAttackTelegraphs(scene);
    // Remote kill listener: peer killed an enemy → kill it here too.
    const handleRemoteAction = (e) => {
      const d = e.detail; if (!d || d.kind !== 'enemy_killed') return;
      const t = enemies.find((en) => en.id === d.enemy_id && en.alive && !en.dying);
      if (!t || t.wolfveilVisualSpawn) return;
      enemyTelegraphs.clear(t);
      t.respawnAt = t.isQuestSpawn ? null : performance.now() + 10000; t.dying = true; t.deathTimer = 0; t.hp = 0;
      if (t.walkAction) t.walkAction.fadeOut(0.15);
      if (t.runAction) t.runAction.fadeOut(0.15);
      if (t.idleAction) t.idleAction.fadeOut(0.15);
      if (cachedDeathClip && t.mixer) { const da = t.mixer.clipAction(cachedDeathClip); da.setLoop(THREE.LoopOnce); da.clampWhenFinished = true; da.reset().fadeIn(0.15).play(); }
      setEnemyCount(enemies.filter((en) => en.alive && !en.dying).length);
    };
    window.addEventListener('webrtcRemoteAction', handleRemoteAction);
    // Each playerSkillStrike is already one timed hit emitted by skillExecutor.
    // Keep each one instead of collapsing repeated events into attackPressed.
    const skillStrikeQueue = createCombatActionQueue();
    const handlePlayerSkillStrike = (e) => {
      skillStrikeQueue.enqueueSkillStrike(e.detail || {});
    };
    const handleAXEAerialSkillCast = () => {
      playerAnim?.requestJump?.();
    };
    const handlePlayerSkillCastStart = (e) => {
      const duration = e.detail?.duration || 0.45;
      activeEffects.current.push(createPlayerCastLightBeam({
        scene,
        loader: worldGltfLoader,
        playerRef: modelRef,
        getGroundY: (x, z) => sampleGroundY?.(x, z) ?? 0,
        duration,
      }));
    };
    window.addEventListener('playerSkillStrike', handlePlayerSkillStrike);
    // Mount Soul Fusion absorbed the mount: run the normal dismount on the next frame
    const handleForceDismount = () => { if (isMountedRef.current) mountToggleRef.current = true; };
    window.addEventListener('axeMountForceDismount', handleForceDismount);
    window.addEventListener('playerSkillCastStart', handlePlayerSkillCastStart);
    window.addEventListener('axeAerialSkillCast', handleAXEAerialSkillCast);

    // Boss entities — declared early so the bus + minion spawner can close over it.
    const bossEntities = [];
    // Expose live arrays for world-sync layer (after both are declared).
    window.__gw3dEnemies = enemies; window.__gw3dBosses = bossEntities;
    window.dispatchEvent(new CustomEvent('gw3dSceneReady'));
    // When Luna's real architecture fails, the fallback geometry is intentionally
    // empty. The client and dedicated worker still enforce the authored palace
    // footprint. Tell players that this area is temporarily restricted rather
    // than leaving an unexplained invisible barrier after removing old platforms.
    if(wolfveilVillage?.palaceLoadStatus==='fallback_source_unavailable'){
      showCombatNotice('Luna mansion failed to load. Placeholder platforms are removed; this area remains restricted. Refresh the preview.');
    }

    // ─── Boss Encounter Controller ──────────────────────────────────────────
    // Single source of truth for "boss encounter" mode. While active: quest NPCs
    // hide, boss music plays, combat dialogue is scoped to the fight. Boss attack
    // patterns (tornado-lift-beam, telegraphs, grab chains) gate on this later.
    const bossEncounter = createBossEncounterController({
      setActiveDialogue,
      setQuestNPCSuppressed,
      startBossMusic: () => {
        stopLoopSound('bgm_character_select');
        stopLoopSound('bgm_dashboard');
        startLoopSound('bgm_boss', { volume: 0.55 });
      },
      stopBossMusic: () => {
        stopLoopSound('bgm_boss');
      },
    });
    window.__gw3dBossEncounter = bossEncounter;

    // World-boss special abilities are temporarily disabled. The boss itself
    // stays in the world and can move / take damage, but tornado, beam, meteor,
    // summon and telegraph systems cannot fire or spam the player.
    const bossTornadoLiftBeam = {
      start: () => false,
      update: () => ({ lockMovement: false, forcedFall: false }),
      isActive: () => false,
      cancel: () => {},
    };
    const cameraShake = { update: () => {}, shake: () => {}, dispose: () => {} };
    const bossTelegraphs = {
      update: () => {},
      spawnLine: () => false,
      spawnCircle: () => false,
      dispose: () => {},
    };
    const detachBossBus = () => {};
    window.__gw3dBossTornadoLiftBeam = null;
    window.__gw3dCameraShake = null;
    window.__gw3dBossTelegraphs = null;

    // Boss combat dialogue remains available for encounter/HP feedback only.
    const bossDialogue = createBossCombatDialogue({ setActiveDialogue });
    window.__gw3dBossDialogue = bossDialogue;

    // Pre-load enemy creature clips once (shared across all enemies).
    // These come from the "creature" folder in admin → AnimationFBX manager
    // (Survivor A Lusth model + mutant animation set).
    const walkClipPromise = new Promise((resolve) => {
      loader.load(CREATURE_ANIMATION_URLS.walk, (animFbx) => resolve(animFbx.animations?.[0] || null), undefined, () => resolve(null));
    });
    const idleClipPromise = new Promise((resolve) => {
      loader.load(CREATURE_ANIMATION_URLS.idle, (animFbx) => resolve(animFbx.animations?.[0] || null), undefined, () => resolve(null));
    });
    // Existing mutant clips are preserved for quest/dungeon enemies. C1 uses
    // its separate admin-bound run/kick/death assets below, not mutant clips.
    const runClipPromise=Promise.resolve(null);
    const deathClipPromise = new Promise((resolve) => {
      loader.load(CREATURE_ANIMATION_URLS.death, (animFbx) => resolve(animFbx.animations?.[0] || null), undefined, () => resolve(null));
    });
    // Use the mutant "punch" animation for attacks (different from the default
    // "swiping" attack so the player sees variety in enemy strikes).
    const attackClipPromise = new Promise((resolve) => {
      loader.load(CREATURE_ANIMATION_URLS.punch, (animFbx) => resolve(animFbx.animations?.[0] || null), undefined, () => resolve(null));
    });
    // Cache the death + attack clips once they load so we can reuse them per-enemy
    let cachedDeathClip = null;
    let cachedAttackClip = null;
    deathClipPromise.then((clip) => { cachedDeathClip = clip; });
    attackClipPromise.then((clip) => { cachedAttackClip = clip; });

    // Helper: pick a random wander point inside the enemy's zone
    const pickWanderTarget = (enemy) => {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * ENEMY_WANDER_RADIUS;
      const tx = enemy.group.position.x + Math.cos(angle) * dist;
      const tz = enemy.group.position.z + Math.sin(angle) * dist;
      // Clamp to zone bounds
      const dx = tx - enemy.zoneCenter[0];
      const dz = tz - enemy.zoneCenter[2];
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > enemy.zoneRadius) {
        const k = enemy.zoneRadius / d;
        enemy.target = new THREE.Vector3(
          enemy.zoneCenter[0] + dx * k,
          enemy.group.position.y,
          enemy.zoneCenter[2] + dz * k,
        );
      } else {
        enemy.target = new THREE.Vector3(tx, enemy.group.position.y, tz);
      }
    };

    // Spawn the visible world boss (creature model x7, 1000x HP). isBoss=true
    // keeps it outside the '=' visibility toggle. The autonomous attack cycle
    // above fires scripted patterns using this entity as the beam origin.
    // Default world boss disabled: this scene is for movement, animation and
    // combat-system experiments. Preserve dungeon-boss APIs for future modes.
    setBosses([]);
    // Wolfveil's existing quarry site is outside the protected hometown.
    // The hosted GLB is fetched only when the player approaches the quarry.
    // The encounter has exactly one ability: a warned jump-and-ground slam.
    const quarryDragon = region === 'wolfveil' ? createQuarryDragonBoss({
      loader: worldGltfLoader,
      scene,
      bossEntities,
      setBosses,
      sampleGroundY: sampleTileGroundY,
      spawnPosition: {
        x: WOLFVEIL_SITES.quarry.x,
        z: WOLFVEIL_SITES.quarry.z + 70, // createWolfveilVillage(originAtMarket:true)
      },
      getPlayerPosition: () => {
        const position = modelRef.current?.position;
        return position ? { x: position.x, z: position.z, alive: getPlayerHUD().hp > 0 } : null;
      },
      applyPlayerDamage: (incoming) => {
        const player = getPlayerHUD();
        if (!player || player.hp <= 0) return;
        const damage = Math.max(0, incoming - absorbShield(incoming));
        if (damage > 0) setHP(Math.max(0, player.hp - damage));
      },
      onEngage: (boss) => {
        if (!bossEncounter.isActive()) {
          bossEncounter.start({ bossId: boss.id });
          bossEncounter.beginCombat();
        }
      },
    }) : null;
    // A SECOND instance of the same real GLB dragon watches the new lake
    // from the eastern mountain rim. It loads only when a player explores
    // nearby; the old quarry encounter, boss HP system and animations stay.
    const lakeStormDragon=region==='wolfveil'?createQuarryDragonBoss({
      loader:worldGltfLoader,scene,bossEntities,setBosses,
      sampleGroundY:sampleTileGroundY,
      instanceId:'wolfveil_living_lake_storm_dragon',
      encounterName:'Dragon of Living Perspectives',
      site:'vortex_lake',
      spawnPosition:{
        x:VORTEX_LAKE.centerX+58,
        z:VORTEX_LAKE.centerZ+70+30,
      },
      getPlayerPosition:()=>{
        const p=modelRef.current?.position;
        return p?{x:p.x,z:p.z,alive:getPlayerHUD().hp>0}:null;
      },
      applyPlayerDamage:(incoming)=>{
        const player=getPlayerHUD();
        if(!player||player.hp<=0)return;
        const damage=Math.max(0,incoming-absorbShield(incoming));
        if(damage>0)setHP(Math.max(0,player.hp-damage));
      },
      onEngage:boss=>{
        if(!bossEncounter.isActive()){
          bossEncounter.start({bossId:boss.id});
          bossEncounter.beginCombat();
        }
      },
    }):null;
    const pendingAXEDungeonBossSpawns = new Set();
    window.__gw3dSpawnAXEDungeonBoss = ({
      bossDef,
      position,
      sessionId = null,
      roomId = null,
    } = {}) => {
      if (!bossDef?.id || !position) return null;
      const runtimeId = `${bossDef.id}::${sessionId || 'runtime'}`;
      const alreadyLive = bossEntities.some((boss) =>
        boss?.id === runtimeId &&
        boss.alive !== false &&
        !boss.dying &&
        !boss.defeated
      );
      if (alreadyLive || pendingAXEDungeonBossSpawns.has(runtimeId)) return null;
      pendingAXEDungeonBossSpawns.add(runtimeId);
      return spawnWorldBoss({
        loader,
        scene,
        snapToGround,
        bossEntities,
        setBosses,
        walkClipPromise,
        idleClipPromise,
        bossDefOverride: bossDef,
        spawnPosition: position,
        instanceId: runtimeId,
        metadata: {
          dungeonBossId: bossDef.id,
          dungeonSessionId: sessionId,
          dungeonRoomId: roomId,
        },
        onSpawn: () => pendingAXEDungeonBossSpawns.delete(runtimeId),
      });
    };

    // Wolfveil's actual quarry/ravine/wolfstone outlands have their own
    // fixed, steep-ground-checked encounter sites. The SAFE settlement and
    // legacy AXE arena coordinates are not mixed. These client visuals are
    // not an authoritative server enemy/XP/loot seed.
    const enemySpawnDefinitions=region===LUNAR_CAVE_REGION
      ?LUNAR_CAVE_TRAINING_SPAWNS
      :region===ASTRAL_DUNGEON_REGION?ASTRAL_MONSTER_SPAWNS
      :region==='wolfveil'?selectWolfveilGroundedEnemySpawns(sampleGroundY):ENEMY_SPAWNS;
    // The 150 planned zombie camp spawns are proximity-streamed at most
    // 30 rigged enemies at once. The single GameWorld3D AI/XP loop owns them.
    const zombieCamps=region==='wolfveil'
      ?createWolfveilZombieHordeRuntime({
          scene,loader,enemies,sampleGroundY,onCountChange:setEnemyCount,
        }):null;
    if(typeof window!=='undefined')window.__gw3dZombieCamps=zombieCamps;
    // C1 is already owner-assigned as an AI enemy in Admin Model3D. Do not
    // graft unrelated mutant animation tracks onto its Erika Archer skeleton.
    // The admin C1 walk field is unassigned: a slower CLONED running clip
    // is used for patrol, preserving independent run/patrol actions.
    const c1ClipPromises=region==='wolfveil'&&enemySpawnDefinitions.length
      ?Object.fromEntries(Object.entries(WOLFVEIL_ADMIN_C1_ANIMATIONS).map(([role,asset])=>[
        role,new Promise(resolve=>loader.load(asset.url,
          fbx=>resolve(fbx.animations?.[0]||null),undefined,
          error=>{console.warn('C1 '+role+' FBX animation unavailable',error);resolve(null);}))
      ])):null;
    // C1's owner-approved rig is reused independently of the legacy creature.
    const wolfveilEnemySource=region==='wolfveil'&&enemySpawnDefinitions.length
      ?createSharedSkinnedFBXSpawner(loader,WOLFVEIL_ADMIN_C1_MODEL.modelUrl)
      :null;
    const loadVisibleCreature=onLoaded=>
      (wolfveilEnemySource||creatureSource).spawn(onLoaded,
        error=>console.warn('Game 3D enemy model unavailable',error));
    enemySpawnDefinitions.forEach((spawn) => {
      loadVisibleCreature((fbx) => {
        const enemyModel = fbx;
        // DETERMINISTIC tier + level — uses the seeded tierRoll from spawn config
        // so every client picks the same tier for the same enemy id.
        const tier = spawn.fixedTier ? getEnemyTierByName(spawn.fixedTier) : pickTier(spawn.tierRoll);
        const enemyLevel = spawn.level || tier.level + (spawn.tierRoll > 0.5 ? 1 : 0); // the zone sets the level
        // stats from the enemy's level and tier: the power budget's enemy curve
        const enemyDerived = getAXEEnemyStats(enemyLevel, tier.name);
        const box = new THREE.Box3().setFromObject(fbx);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = (1.7 / maxDim) * tier.scale;
        enemyModel.scale.setScalar(scale);
        enemyModel.position.set(spawn.home[0], spawn.home[1], spawn.home[2]);

        // Keep the enemy's natural model color — no red tint, no emissive glow.
        // tintMaterials is still tracked so the death-fade can adjust opacity.
        const tintMaterials = [];
        enemyModel.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = !node.isSkinnedMesh;
            node.receiveShadow = true;
            if (node.material) {
              // Skinned-geometry clones can share materials by default.
              // Give each Wolfveil enemy independent fade/appearance state.
              // Cloned enemies share geometry but not mutable death-fade materials.
              node.material=Array.isArray(node.material)
                ?node.material.map(m=>m.clone()):node.material.clone();
              const mats = Array.isArray(node.material) ? node.material : [node.material];
              mats.forEach((m) => tintMaterials.push(m));
            }
          }
        });

        // Hostile red ground ring
        const ringGeo = new THREE.RingGeometry(0.7 / scale, 0.9 / scale, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xff3030, side: THREE.DoubleSide, transparent: true, opacity: 0.55 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.02 / scale;
        enemyModel.add(ring);

        scene.add(enemyModel);
        // Stand enemy feet on the terrain at its spawn point
        snapToGround(enemyModel, 0);

        const enemyMixer = new THREE.AnimationMixer(enemyModel);
        // Randomize initial state + timer so the herd isn't synced
        const startsWalking = Math.random() < 0.5;
        const enemyEntry = {
          id: spawn.id,
          group: enemyModel,
          mixer: enemyMixer,
          walkAction: null,
          runAction: null,
          idleAction: null,
          state: startsWalking ? 'walk' : 'idle',
          stateTimer: Math.random() * (startsWalking ? ENEMY_WALK_TIME : ENEMY_IDLE_TIME),
          target: null,
          alive: true,
          hitCooldown: 0,
          tintMaterials,
          zoneCenter: spawn.zoneCenter,
          zoneRadius: spawn.zoneRadius,
          home: spawn.home, // remembered for respawn
          respawnAt: null,  // set when killed; checked each frame
          tier: tier.name,
          level: enemyLevel,
          hp: enemyDerived.maxHP,
          maxHp: enemyDerived.maxHP,
          derived: enemyDerived,
          xpReward: spawn.wolfveilVisualSpawn || spawn.dungeonTrainingSpawn ? 0 : tier.xp,
          wolfveilVisualSpawn: spawn.wolfveilVisualSpawn === true,
          // Staged training enemies are fought locally; they cannot award
          // currency, XP, quest kills, title progress or peer kill claims.
          dungeonTrainingSpawn: spawn.dungeonTrainingSpawn === true,
          authoritativeServerSpawnVerified: spawn.authoritativeServerSpawnVerified === true,
          attackCooldown: Math.random() * 1.5, // stagger initial attacks
          aiProfile: spawn.aiProfile || 'standard',
          attacking: false,
          attackWindupTimer: 0,
          // Phase 5 desync fix — per-enemy randomized think/move/idle timing.
          thinkInterval: 0.2 + Math.random() * 1.2,
          thinkTimer: Math.random() * 0.9,
          speedJitter: 0.85 + Math.random() * 0.3,
          idleVariance: 0.7 + Math.random() * 0.8,
          walkVariance: 0.7 + Math.random() * 0.8,
        };
        enemies.push(enemyEntry);
        setEnemyCount(enemies.filter(en=>en.alive&&!en.dying).length);
        if (startsWalking) pickWanderTarget(enemyEntry);

        // Attach the ACTUAL admin-model C1 animation assignment for the
        // C1 ambient enemy; legacy quest/dungeon actors retain mutant clips.
        const assignedClips=c1ClipPromises?Promise.all([
          c1ClipPromises.run.then(clip=>clip?.clone()||null),
          c1ClipPromises.idle,c1ClipPromises.run,
          c1ClipPromises.attack,c1ClipPromises.death,
          c1ClipPromises.hit,c1ClipPromises.dodge,
        ]):Promise.all([walkClipPromise,idleClipPromise,runClipPromise,
          null,null,null,null]);
        assignedClips.then(([walkClip,idleClip,runClip,attackClip,deathClip,hitClip,dodgeClip])=>{
          enemyEntry.attackClip=attackClip;
          enemyEntry.deathClip=deathClip;
          enemyEntry.hitClip=hitClip; // Admin 'hit' slot is standing BLOCK.
          enemyEntry.dodgeClip=dodgeClip;
          if (walkClip) {
            const wa = enemyMixer.clipAction(walkClip);
            wa.setEffectiveTimeScale(0.55); // slow it down → walk, not sprint
            enemyEntry.walkAction = wa;
          }
          if (idleClip) {
            enemyEntry.idleAction = enemyMixer.clipAction(idleClip);
          }
          if(runClip){
            enemyEntry.runAction=enemyMixer.clipAction(runClip);
            enemyEntry.runAction.setEffectiveTimeScale(0.8);
          }
          // Play whichever matches initial state
          const initial = enemyEntry.state === 'walk' ? enemyEntry.walkAction : enemyEntry.idleAction;
          if (initial) initial.reset().fadeIn(0.2).play();
        });
      });
    });

    // Load the player model + admin-managed player animation library
    let avatarLoadDisposed=false;
    let mixer;
    let model;
    let playerAnim;
    let haloVisualRuntime = null;
    let fusionVisualRuntime = null; // Mount Soul Fusion aura
    let ascensionVisualRuntime = null; // Taurus Chosen Ascension: levitation, Angel Cloak, Destroyer shockwave, Defensive shield
    let armorEquipSync = null; // equipped armor-pack items -> the armor bridge ('game3d:armor-equip')
    let ascendedGearVisualRuntime = null; // original procedural spiritual aura for ascended equipped gear
    let avatarDrawCalls = null; // skips the avatar's parked skill-effect meshes (docs/game3d/AVATAR_DRAW_CALLS.md)
    const playerStateMachine = new CorePlayerStateMachine();
    let coreAnimationController = null;
    const otsCameraColliders = createOTSCameraColliders({ groundMeshes, roots: () => [wolfveilVillage?.world?.group, importedSpawnTown?.root] }); const playerCameraSystem = new PlayerCameraSystem({ camera, orbit, modelRef, lockOnTargetRef, groundMeshes, aim: otsAim.current, cameraColliders: otsCameraColliders });
    // Clone already owns the tiny OTS aim dot. Add only the confirmed-hit
    // brackets and original spirit-bird animation, not a second crosshair.
    const bowOccluders=otsCameraColliders;
    window.__gw3dBowOccluders=bowOccluders;
    const bowVisuals=createGame3DBowAimVisuals({scene,container,showDot:false});
    // Read-only, local timing and HIT/MISS counters for repeatable bow QA.
    window.__axe3dBowShotStats=bowVisuals.stats;
    const onBowVerifiedHit=(event)=>{
      bowVisuals.confirmHit(event?.detail?.damage);
      if(event?.detail?.headshot)bowVisuals.showHeadshot?.(event?.detail?.damage);
    };
    const onBowVerifiedMiss=(event)=>bowVisuals.confirmMiss(event?.detail?.reason);
    window.addEventListener('game3dVerifiedBowHit',onBowVerifiedHit);
    window.addEventListener('game3dVerifiedBowMiss',onBowVerifiedMiss);
    // Lightweight abilities progress meter. Charges tick in 10% increments;
    // this text is updated in the existing animation frame, not by React
    // rerenders, new intervals or network events.
    const skillChargeHud=document.createElement('div');
    skillChargeHud.dataset.game3dSkillCharge='true';
    skillChargeHud.setAttribute('role','progressbar');
    skillChargeHud.setAttribute('aria-label','Charged ability progress');
    skillChargeHud.setAttribute('aria-valuemin','0');
    skillChargeHud.setAttribute('aria-valuemax','100');
    Object.assign(skillChargeHud.style,{
      position:'absolute',bottom:'15%',left:'50%',transform:'translateX(-50%)',
      zIndex:'64',width:'156px',padding:'6px 9px',borderRadius:'8px',
      pointerEvents:'none',textAlign:'center',font:'bold 11px system-ui,sans-serif',
      color:'#d8efff',background:'rgba(5,25,45,.78)',
      border:'1px solid rgba(128,218,252,.62)',opacity:'0',
    });
    const skillChargeLabel=document.createElement('div');
    skillChargeLabel.textContent='SKILL CHARGE 0%';
    const skillChargeTrack=document.createElement('div');
    Object.assign(skillChargeTrack.style,{
      height:'5px',marginTop:'5px',background:'rgba(13,51,72,.95)',
      borderRadius:'4px',overflow:'hidden',
    });
    const skillChargeFill=document.createElement('div');
    Object.assign(skillChargeFill.style,{
      height:'100%',width:'0%',background:'linear-gradient(90deg,#4aaee2,#ffe4a5)',
    });
    skillChargeTrack.appendChild(skillChargeFill);
    skillChargeHud.appendChild(skillChargeLabel);
    skillChargeHud.appendChild(skillChargeTrack);
    container.appendChild(skillChargeHud);
    const hideSkillCharge=()=>{skillChargeHud.style.opacity='0';};
    const dodgeVanish = { active: false, timer: 0, duration: 0.45 };
    const crouchTogglePressed = { current: false };
    const lastDirectionTap = { current: {} };
    const DOUBLE_TAP_MS = 280;
    const chargedKeys = new Map();
    // Draw on canvas down, fire one resolved arrow only on window release.
    const heldBow={active:false,startedAt:0};
    let pendingBowShotCharge=null;
    const cancelBowCharge=()=>{
      heldBow.active=false;pendingBowShotCharge=null;
      bowVisuals.setCharge?.(null);
    };
    const heldAOEKeys = new Map();
    const killFlowCounter = createKillFlowCounter();
    let killFlowPursuit = null;
    const castInputMeta = { current: null };
    let chargedFinisherWindow = null;
    const onChargedFinisherWindow = (event) => {
      const d = event.detail;
      if (d?.charged && Number.isFinite(d.expiresAt)) chargedFinisherWindow = d;
    };
    window.addEventListener('axeChargedFinisherWindow', onChargedFinisherWindow);
    let playerDodgeSequence = 0; // local verified dodge-start; not a network claim

    // Stations share this world's terrain, collision and renderer. Never create
    // another Canvas or restart the world when opening a personal workspace.
    const stationGroundRay = new THREE.Raycaster();
    const stationGroundOrigin = new THREE.Vector3();
    const isRuntimeFootprintBlocked = (position, radius) => {
        const offsetZ = region === 'wolfveil' ? 70 : 0;
        if (wolfveilVillage?.colliders.some(b => Math.abs(position.x - b.x) < b.w / 2 + radius + .8 && Math.abs(position.z - (b.z + offsetZ)) < b.d / 2 + radius + .8)) return true;
        const trees = forestBiome?.trees || wolfveilVillage?.vegetation?.trees || [];
        if (trees.some(t => Math.hypot(position.x - t.x, position.z - t.z - offsetZ) < radius + (t.radius || .7))) return true;
        if (wolfveilVillage) {
          if (wolfveilDistanceToRiver(position.x, position.z - offsetZ) < 13 + radius) return true;
          for (const road of WOLFVEIL_ROUTES) for (let i = 0; i < road.points.length - 1; i++) {
            const a = road.points[i], b = road.points[i + 1], dx = b[0] - a[0], dz = b[1] - a[1];
            const t = Math.max(0, Math.min(1, ((position.x - a[0]) * dx + (position.z - offsetZ - a[1]) * dz) / (dx * dx + dz * dz || 1)));
            if (Math.hypot(position.x - a[0] - t * dx, position.z - offsetZ - a[1] - t * dz) < road.width / 2 + radius + .5) return true;
          }
        }
        if (forestBiome) {
          // Resolve against the real forest obstacles using footprint probes,
          // including fallen timber not exposed as a separate placement list.
          for (const [dx, dz] of [[0,0],[-radius,0],[radius,0],[0,-radius],[0,radius]]) {
            const probe = new THREE.Vector3(position.x + dx, position.y, position.z + dz);
            if (forestBiome.resolveCollision(probe, .7)) return true;
          }
        }
        return false;
    };
    // Landings and their markers ask one question: is the point inside real
    // world geometry? The town's baked walls are not in the footprint guard.
    const respawnSpotBlocked = (x, y, z, radius) => {
      const probe = new THREE.Vector3(x, y, z);
      importedSpawnTown?.resolveCollision(probe, { x, z }); // town walls and ledges
      stationRuntime?.resolveCollision(probe, radius);
      return Math.hypot(probe.x - x, probe.z - z) > .1 || isRuntimeFootprintBlocked({ x, y, z }, radius);
    };
    const resolveSafeNearbyRespawn = deathPosition => {
      const actor = modelRef.current;
      if (region !== 'wolfveil' || dedicatedMode || !deathPosition || !actor ||
        Math.hypot(actor.position.x - deathPosition.x, actor.position.z - deathPosition.z) > 4) return null;
      return findSafeNearbyRespawn(deathPosition, {
        sampleGroundY, isInBounds: (x,z) => insideWolfveilClientGround(x,z,.9),
        isDangerous: ({x,z}) => enemies.some(enemy => enemy?.alive && !enemy?.dying && enemy?.group && Math.hypot(enemy.group.position.x-x, enemy.group.position.z-z) < 5),
        isBlocked: ({x,y,z},radius) => respawnSpotBlocked(x,y,z,radius),
      });
    };
    const respawnShrines = region === 'wolfveil'
      ? createWorldRespawnShrines({ scene, points: MAP_SPAWN_POINTS, sampleGroundY,
          isInBounds: (x,z) => insideWolfveilClientGround(x,z,.7) && !importedSpawnTown?.isSolid(x,z) }) : null;
    const stationRuntime = createAXEServiceStationRuntime({
      scene, camera, renderer,
      onChanged: () => { renderer.shadowMap.needsUpdate = true; },
      context: () => {
        const player = modelRef.current?.position || { x: 0, y: 0, z: 0 };
        const nearbyThreat = [...enemies, ...bossEntities, ...(window.__gw3dRogues || [])].some(en => en.alive && !en.dying && en.group?.visible && Math.hypot(en.group.position.x - player.x, en.group.position.z - player.z) < 10);
        const busy = !['none', 'aim'].includes(playerStateMachine.current.combat);
        // Nearby hostiles make placing a physical station unsafe, but they do
        // not mean the player actually entered combat. A separate station
        // placement warning lets the already-open service panel remain usable.
        // Genuine combat/death/dungeon states still close the workspace.
        const reason = !modelRef.current ? 'WORLD_NOT_READY'
          : getPlayerHUD().hp <= 0 ? 'PLAYER_DEAD'
          : getAXEDungeonState().activeSession ? 'SERVICES_DISABLED_IN_DUNGEON'
          : busy ? 'SERVICES_UNAVAILABLE_IN_COMBAT'
          : nearbyThreat ? 'STATION_UNSAFE_NEAR_HOSTILES'
          : null;
        return { region, player, yaw: orbit.current.yaw + Math.PI, allowed: !reason, reason };
      },
      sampleGround: (x, z) => {
        stationGroundOrigin.set(x, 1000, z); stationGroundRay.set(stationGroundOrigin, downVec);
        return stationGroundRay.intersectObjects(groundMeshes, true)[0]?.point.y ?? null;
      },
      getPlayers: () => [...(remoteManagerRef.current?.getRemotes?.()?.values() || [])].map(r => r.group.position),
      isBlocked: isRuntimeFootprintBlocked,
    });

    // A browser checkpoint is a *candidate* spawn. Terrain, world bounds and
    // collision must accept it; it cannot override a portal or admin workflow.
    const tryResumeCheckpoint = (point) => {
      const actor = modelRef.current;
      if (!actor || !point || point.region !== region || dedicatedMode ||
          portalReturn || initialWorkflowTarget) return false;
      const ground = sampleGroundY(point.x, point.z);
      if (!Number.isFinite(ground) ||
          (region === 'wolfveil' && !insideWolfveilClientGround(point.x, point.z, .65)) ||
          isRuntimeFootprintBlocked({ x:point.x, y:ground, z:point.z }, .62)) return false;
      actor.position.set(point.x, Math.abs(point.y-ground) <= .6 ? point.y : ground, point.z);
      orbit.current.yaw = point.yaw;
      window.__localPlayerPos = { x:actor.position.x, y:actor.position.y, z:actor.position.z };
      return true;
    };
    checkpointTeleporterRef.current = tryResumeCheckpoint;

    loadAvatarModel(appearanceRef.current,1.7,appearanceRef.current.model_url).then((fbx) => {
      if(avatarLoadDisposed){disposeAvatarModel(fbx);return;}
      model = fbx;
      modelRef.current = fbx;
      playerModelRef.current = fbx;
      // Character appearance can change while asynchronous GLB loading is
      // pending. Apply canonical equipped armor immediately to the live actor
      // before the first frame; viewers follow the same inventory state.
      void applyPlayerAppearance(fbx,appearanceRef.current);
      window.__gw3dPlayerHeight=1.7*(appearanceRef.current.height_scale||1);
      // A chosen workflow location replaces only this character's initial Play spawn.
      // The real terrain raycast and existing tree/building/river guard reject unsafe spots.
      // It never changes remote players, collision meshes, or server-authoritative duels.
      const workflowSpawn = region === 'wolfveil' && workflowAllowed && initialWorkflowTarget && !dedicatedMode
        ? findWorkflowSpawn(initialWorkflowTarget, {
            sampleGroundY,
            isBlocked: (x,z) => isRuntimeFootprintBlocked({x,y:sampleGroundY(x,z) ?? 0,z},.75),
          }) : null;
      const returnSite=portalReturn==='astral'?ASTRAL_DUNGEON_ENTRANCE:LUNAR_CAVE_ENTRANCE;
      const vortexReturn=portalReturn==='vortex'?VORTEX_LAKE.safeReturn:null;
      const returnPosition=region==='wolfveil'&&portalReturn ? {
        x:vortexReturn?.x??returnSite.approachX,
        z:vortexReturn?.z??returnSite.approachZ,
        y:vortexReturn?.y??sampleGroundY(returnSite.approachX,returnSite.approachZ)??0.3,
      }:null;
      fbx.position.set(returnPosition?.x ?? workflowSpawn?.x ?? (region==='wolfveil'?WOLFVEIL_PLAYER_TOWN_SPAWN.x:0),
        returnPosition?.y ?? workflowSpawn?.y ?? 0.3,
        returnPosition?.z ?? workflowSpawn?.z ?? (region==='wolfveil'?WOLFVEIL_PLAYER_TOWN_SPAWN.z:0));
      if (initialWorkflowTarget && !workflowSpawn)
        showCombatNotice('Workflow target has no safe ground. Spawned at the Wolfveil market.');

      fbx.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = !node.isSkinnedMesh;
          node.receiveShadow = true;
        }
      });

      // Before the halo and aura runtimes attach their meshes: the budget manages the GLB's own.
      avatarDrawCalls = createAvatarDrawCalls(fbx);
      window.__gw3dAvatarDrawCalls = avatarDrawCalls;
      scene.add(fbx);
      // The skipped effect meshes are never drawn at load, so compile their shaders now, as the first frame did.
      try { renderer.compile(fbx, camera, scene); } catch { /* a lost context: they compile on first draw */ }
      haloVisualRuntime = createAXEHaloVisualRuntime({ model: fbx, initialState: getHaloState() });
      fusionVisualRuntime = createAXEMountFusionVisualRuntime({ model: fbx, initialState: getAXEMountFusionState() });
      ascensionVisualRuntime = createAXEAscensionVisualRuntime({ model: fbx, initialState: getAXEAscensionProfile() });
      ascendedGearVisualRuntime = createAXEAscendedGearVisualRuntime({ model: fbx });
      // After the avatar loads, so the armor bridge (mounted with the page) hears the start-up equips.
      armorEquipSync = createAXEArmorEquipSync();
      // Workflow already uses the live ground height; normal Play keeps its market snap.
      if (!workflowSpawn&&!returnPosition) snapToGround(fbx, 0);
      if (!entryModeRef.current && resumeCheckpoint && !workflowSpawn && !returnPosition)
        tryResumeCheckpoint(resumeCheckpoint);
      if (workflowSpawn) window.dispatchEvent(new CustomEvent('axeWorkflowArrived', {
        detail: { id: workflowSpawn.id, x: workflowSpawn.x, y: workflowSpawn.y, z: workflowSpawn.z },
      }));
      mixer = new THREE.AnimationMixer(fbx);
      playerAnim = createPlayerAnimationController({ mixer, blend: BLEND, oneShotRef: oneShotPlaying });
      // Native clips are ready with the GLB. Optional admin FBXs must never
      // hold the playable actor in its bind pose while a request is pending.
      playerAnim.bindClips(initialPlayerAnimationClips(fbx));
      coreAnimationController = new CoreAnimationController({ legacyController: playerAnim });

      // ─── Spawn all 5 Quest NPCs as individual archer model copies ───
      // Each gets its own independent skeleton + mixer — no shared-rig conflicts.
      // Preserve the original quest IDs, positions, dialogues and player XP.
      // Only use an authored GLB if it actually contains a playable idle clip.
      let questNpcSharedIdle=null;
      if(region!==LUNAR_CAVE_REGION&&region!==ASTRAL_DUNGEON_REGION) QUEST_NPCS.forEach((npcDef) => {
        loadAXEQuestNPCVisual({
          npcId:npcDef.id,gltfLoader:worldGltfLoader,
          fbxLoader:loader,fallbackUrl:ARCHER_URL,
          onLoaded: ({model:npcFbx,embeddedIdleClip,isEmbeddedGLB,sourceUrl}) => {
          if(avatarLoadDisposed){disposeAvatarModel(npcFbx);return;}
          const npcBox = new THREE.Box3().setFromObject(npcFbx);
          const npcSize = npcBox.getSize(new THREE.Vector3());
          const npcMaxDim = Math.max(.001,npcSize.x, npcSize.y, npcSize.z);
          const npcScale = 1.7 / npcMaxDim;
          npcFbx.scale.setScalar(npcScale);
          const npcSpot = wolfveilQuestNpcSpot(region, npcDef); // around the town in Wolfveil
          npcFbx.position.set(npcSpot.x, npcDef.pos[1], npcSpot.z);
          const ang = npcSpot.facing; // toward where players arrive
          npcFbx.rotation.y = ang;

          // Apply the NPC's tint color so each archer looks distinct
          npcFbx.traverse((node) => {
            if (node.isMesh) {
              node.castShadow = !node.isSkinnedMesh;
              node.receiveShadow = true;
              if (node.material) {
                const mats = Array.isArray(node.material) ? node.material : [node.material];
                // Don't overwrite the carefully authored textures of uploaded
                // GLB characters. Legacy archer NPCs keep their old tint.
                if(!isEmbeddedGLB)
                  mats.forEach((m) => { m.color?.setHex(npcDef.tint); });
              }
            }
          });

          // Golden quest ring under feet
          const npcRingGeo = new THREE.RingGeometry(0.7 / npcScale, 0.95 / npcScale, 32);
          const npcRingMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
          const npcRing = new THREE.Mesh(npcRingGeo, npcRingMat);
          npcRing.rotation.x = -Math.PI / 2;
          npcRing.position.y = 0.02 / npcScale;
          npcFbx.add(npcRing);

          scene.add(npcFbx);
          snapToGround(npcFbx, 0);

          const npcMixer = new THREE.AnimationMixer(npcFbx);
          const chosenIdle=embeddedIdleClip||questNpcSharedIdle;
          const npcIdleAction=chosenIdle?npcMixer.clipAction(chosenIdle):null;
          if(npcIdleAction)npcIdleAction.reset().fadeIn(0.2).play();

          questNPCs.push({
            id: npcDef.id,
            name: npcDef.name,
            group: npcFbx,
            mixer: npcMixer,
            idleAction:npcIdleAction,
            ringMesh:npcRing,
            // Only a legacy FBX still awaiting the player idle needs a handoff.
            _pendingMixer:chosenIdle?null:npcMixer,
            modelFormat:isEmbeddedGLB?'glb':'fbx',
            modelSource:sourceUrl,
          });
          },
          onError:(error)=>console.warn('Quest NPC model failed:',npcDef.id,error),
        });
      });

      // Wire up the quest enemy spawner — set on the ref so the React layer can call it
      spawnQuestEnemiesRef.current = createQuestEnemySpawner({ scene, enemies, loader, snapToGround, walkClipPromise, idleClipPromise, setEnemyCount, creatureSource });
      window.__gw3dSpawnQuestEnemies = spawnQuestEnemiesRef.current;

      // Load player animation clips once — bind to player AND reuse for quest NPC idle
      let avatarReadyReported = false;
      const markAvatarReady = () => {
        if (avatarLoadDisposed || modelRef.current !== fbx || avatarReadyReported) return;
        avatarReadyReported = true;
        setLoading(false);
        entryCameraReleased = true;
        window.dispatchEvent(new CustomEvent('game3dWorldAvatarReady', {
          detail: { modelUrl: appearanceRef.current.model_url, characterId: getActiveCharacter()?.id || null },
        }));
      };
      if (playerAnim.has('idle')) markAvatarReady();
      loadPlayerAnimationClips(loader,fbx, { onMontageReady: clips => {
        if (avatarLoadDisposed || modelRef.current !== fbx) return;
        playerAnim.bindClips(clips);
        markAvatarReady();
      } })
        .then(({clipsByKey,sourceClips}) => {
          if (avatarLoadDisposed || modelRef.current !== fbx) return;
          playerAnim.bindClips(clipsByKey);
          // Bind idle to the quest NPC using the already-loaded clip (no extra fetch)
          const idleClip = sourceClips['idle'];
          questNpcSharedIdle=idleClip||null;
          if (idleClip) {
            questNPCs.forEach((qn) => {
              if (qn._pendingMixer) {
                const idleAction = qn._pendingMixer.clipAction(idleClip);
                idleAction.reset().fadeIn(0.2).play();
                qn.idleAction = idleAction;
                delete qn._pendingMixer;
              }
            });
          }
          // Spawn the oversized Living Quest NPC away from the cluster
          spawnLivingQuestNPC({
            scene, loader, archerUrl: ARCHER_URL, snapToGround,
            idleClip: sourceClips['idle'] || null,
            onReady: (h) => { livingQuestEntity = h; window.__gw3dLivingQuestNPC = h?.group || null; },
          });
          renderer.shadowMap.needsUpdate = true;
          markAvatarReady();
        })
        .catch((err) => {
          console.error('Player AnimationFBX library load error:', err);
          // Missing optional animation clips must not strand a rendered actor.
          markAvatarReady();
        });
    }).catch((err) => {
      console.error('Player model load error:', err);
      setLoading(false);
      if(!avatarLoadDisposed)window.dispatchEvent(new CustomEvent('game3dWorldAvatarLoadError',{
        detail:{message:err?.message || 'Character model could not load. Try again or return to Character Select.'}}));
    });

    // Controls
    const playOneShot = (name, timeScale = 1) => {
      if (!model || !playerAnim) return;
      playerAnim.playOneShot(name, timeScale);
    };

    const getLockOnTargetPosition = () => {
      const target = lockOnTargetRef.current;
      if (!target?.group || (target.aliveRef && !target.aliveRef())) return null;
      return target.group.position;
    };

    const getCombatAxes = () => {
      const target = getLockOnTargetPosition();
      if (!target || !model) return null;
      const forward = new THREE.Vector3(target.x - model.position.x, 0, target.z - model.position.z);
      if (forward.lengthSq() <= 0.0001) return null;
      forward.normalize();
      const cameraForward = new THREE.Vector3();
      camera.getWorldDirection(cameraForward);
      cameraForward.y = 0;
      if (cameraForward.lengthSq() <= 0.0001) cameraForward.copy(forward);
      cameraForward.normalize();
      const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      cameraRight.y = 0;
      if (cameraRight.lengthSq() <= 0.0001) cameraRight.set(forward.z, 0, -forward.x);
      cameraRight.normalize();
      return { forward, right: cameraRight, cameraForward, cameraRight };
    };

    // Dodge is resolved in the CHARACTER's frame — camera angle/pitch has no
    // influence. The tapped key decides the side; any other WASD key still
    // held blends in, all relative to the body's facing.
    const getDodgeVectorAndName = (key) => {
      if (!model) return { direction: 'forward', vector: new THREE.Vector3(0, 0, 1) };
      return getCharacterDodge(model, {
        forward: key === 'w' || !!keys.current['w'],
        backward: key === 's' || !!keys.current['s'],
        left: key === 'a' || !!keys.current['a'],
        right: key === 'd' || !!keys.current['d'],
      });
    };

    const updateLockOnRotation = (delta) => {
      const target = getLockOnTargetPosition();
      if (!target || !model || playerAnim?.isMovementOverridden?.()) return;
      const dir = new THREE.Vector3(target.x - model.position.x, 0, target.z - model.position.z);
      if (dir.lengthSq() <= 0.0001) return;
      dir.normalize();
      const targetYaw = Math.atan2(dir.x, dir.z);
      const targetQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetYaw);
      model.quaternion.slerp(targetQuat, 1 - Math.exp(-14 * delta));
    };

    // Dodge invulnerability is a gameplay window, not invisibility. The
    // previous hide-model assignment made every successful dodge look broken.
    const startDodgeVanish = () => {
      if (!model) return;
      dodgeVanish.active = true;
      dodgeVanish.timer = 0;
    };

    // Click-to-move: a Settings option, off by default (axe/player/AXEClickToMove.js). With it off,
    // nothing below changes WASD play. Walkable = terrain under the point, inside the arena clamp.
    const arenaRadius = region===LUNAR_CAVE_REGION?675:region===ASTRAL_DUNGEON_REGION?330:36.5; // dungeon bounds use their dedicated collision geometry
    // Wolfveil is an explorable landscape, not the 36.5m combat test arena.
    // Both click-to-move and keyboard movement stop only at actual terrain edges.
    const isClickMoveWalkable = (x, z) =>
      (region===LUNAR_CAVE_REGION ? lunarDungeon?.isWalkable(x,z) : region===ASTRAL_DUNGEON_REGION ? astralDungeon?.isWalkable(x,z) : region==='wolfveil'||Math.hypot(x,z)<=arenaRadius) && sampleGroundY(x, z) !== null;
    const clickMoveMarker = createAXEClickToMoveMarker(scene);
    const clickToMove = createAXEClickToMove({
      isEnabled: isAXEClickToMoveEnabled,
      isWalkable: isClickMoveWalkable,
      onChange: (target) => {
        if (target) clickMoveMarker.show(target, sampleGroundY(target.x, target.z));
        else clickMoveMarker.hide();
      },
    });
    const getClickEntityRoots = () => [
      ...[...enemies, ...bossEntities, ...(window.__gw3dRogues || [])].filter((en) => en?.alive && !en.dying).map((en) => en.group),
      ...questNPCs.map((qn) => qn.group),
      livingQuestEntity?.group,
      isMountedRef.current ? null : companionGroupRef.current,
      ...(remoteManagerRef.current?.getMeshes?.() || []),
    ];
    // A left click on walkable ground nearer than any enemy, NPC or player sets the move target.
    // Anything else (an enemy, the sky, a click while a WASD key is held) stays the click attack.
    // Whether clicking an enemy should also lock on and attack is owner decision D9 (not built).
    const tryClickToMove = (e) => {
      if (!model || AXE_CLICK_TO_MOVE_CONFIG.movementKeys.some((k) => keys.current[k])) return false;
      const pick = pickAXEClickToMoveGround({ event: e, element: renderer.domElement, camera, groundMeshes, entityRoots: getClickEntityRoots() });
      const walkable = !!pick.point && isClickMoveWalkable(pick.point.x, pick.point.z);
      if (classifyAXEClick({ enabled: true, ...pick, walkable }) !== 'move') return false;
      return clickToMove.setTarget(pick.point);
    };

    const altCursorHeld = { current: false };
    const onKeyDown = (e) => {
      // Alt temporarily frees the cursor from the 3D pointer lock so the
      // player can choose an actor without accidentally swinging a weapon.
      if (e.key === 'Alt') {
        if (!entryModeRef.current) {
          altCursorHeld.current = true;
          drag.current.active = false;
          if (document.pointerLockElement === renderer.domElement)
            document.exitPointerLock?.();
        }
        return;
      }
      if (entryModeRef.current || entryCamera.isActive()) return; // no movement/combat during camera handoff
      if (window.__axeTileInspectionEditing) return;
      if (window.__axeUiModalOpen || window.__axeServiceModeOpen || window.__axeWorldMapOpen || window.__axePauseMenuOpen || window.__axeDialogueOpen) return;
      if (e.target?.matches?.('input, textarea')) return;
      const k = e.key.toLowerCase(); if (k === 'v' && !e.repeat && otsAim.current.aiming) otsAim.current.toggleShoulder(); // shoulder swap
      if (e.code === 'F1') {
        e.preventDefault();
        if (!e.repeat) {
          const result = cycleSkillPreset();
          if (result.ok) showCombatNotice(`Skill preset ${result.index + 1} ready`);
        }
        return;
      }
      // In Wolfveil the imported Luna mansion is a real playable interior.
      // E operates its genuine front, balcony sliders and attic door; if no
      // mansion door is nearby, the existing NPC/loot interaction is unchanged.
      if(k==='e'&&!e.repeat&&model){
        const door=wolfveilVillage?.interactPalace(model.position);
        if(door){e.preventDefault();return;}
      }
      keys.current[k] = true;
      // Game 2/Luna camera fallback: arrow keys steer camera yaw/pitch.
      if (k.startsWith('arrow')) e.preventDefault();
      clickToMove.noteKey(k); // any WASD key cancels a click move
      const dodgeKeys = new Set(['w', 'a', 's', 'd']);
      if (!e.repeat && dodgeKeys.has(k)) {
        const nowMs = performance.now();
        if (nowMs - (lastDirectionTap.current[k] || 0) <= DOUBLE_TAP_MS) {
          const dodge = getDodgeVectorAndName(k);
          const dodgeBudget = canSpendCombatResource('dodge');
          if (!dodgeBudget.ok) {
            showCombatNotice('Not enough stamina to dodge');
          } else if (playerStateMachine.canStart('dodge') && playerAnim?.requestDodge?.(dodge.vector, dodge.direction) && playerStateMachine.startCombat('dodge', { lock: 0.45, cancel: 0.18 })) {
            spendCombatResource('dodge');
            window.dispatchEvent(new CustomEvent('playerSkillCastCancel'));
            startDodgeVanish(dodge.direction);
            playerDodgeSequence += 1;
            gainAXEBuddhaEssenceExperience('dexterity', 2);
            playActionSound('player_jump');
          }
          lastDirectionTap.current[k] = 0;
          e.preventDefault();
          return;
        }
        lastDirectionTap.current[k] = nowMs;
      }
      // Space = jump. R = forward roll, both using the selected character's
      // own rig and the same world collision as normal movement.
      if(k===' '){
        if(!e.repeat && !isMountedRef.current && playerAnim?.requestJump?.())
          playActionSound('player_jump');
        e.preventDefault();
      }
      if(k==='r'){
        if(!e.repeat && !isMountedRef.current && playerStateMachine.canStart('dodge')){
          const roll=getDodgeVectorAndName('w');
          const budget=canSpendCombatResource('dodge');
          if(!budget.ok)showCombatNotice('Not enough stamina to roll');
          else if(playerAnim?.requestRoll?.(roll.vector)){
            playerStateMachine.startCombat('dodge',{lock:0.72,cancel:0.25});
            spendCombatResource('dodge');
            startDodgeVanish();
            playActionSound('player_jump');
          }
        }
        e.preventDefault();
      }
      // C is reserved for the unified Character Hub. Ctrl remains Sprint.
      // Q is the dedicated crouch toggle so movement and UI controls cannot collide.
      if (k === 'q' && !crouchTogglePressed.current) {
        crouchTogglePressed.current = true;
        playerAnim?.requestCrouch(!playerAnim.getIsCrouching());
        e.preventDefault();
      }
      // E = interact, F = Kick. Next to your companion (while the 'F Mount' prompt shows) or while
      // riding, F mounts / dismounts instead: the kick rebinding (6a64a744) had left mounting unreachable.
      if (k === 'e') interactPressed.current = true;
      if (k === 'f') {
        if (nearbyCompanionRef.current || isMountedRef.current) { if (!e.repeat) mountToggleRef.current = true; }
        else if (playerAnim?.requestAttack('kick', 1.0)) setTimeout(() => { attackPressed.current = true; }, 260);
        e.preventDefault();
      }
      // Kill Flow: a locally earned PvE kill counter replaces the hold only
      // for the next selected single/three-hit skill in real attack range.
      // Master-ranked AoE instead uses a hold to start its bounded channel.
      // At maximum skill mastery: hold a single/three-hit key for ~1 second,
      // then RELEASE to cast charged. A quick tap still casts normally.
      // Below max mastery, retain instant keydown casts (no added latency).
      if ((k >= '1' && k <= '9') || k === '0') {
        e.preventDefault();
        if (!e.repeat) {
          const slotIndex = k === '0' ? 9 : Number(k) - 1;
          const skillId = getLoadout().activeSlots[slotIndex];
          const skill = getSkillById(skillId);
          const family = skillCombatFamily(skill);
          const counterNow = Date.now();
          const pending = killFlowCounter.peek(counterNow);
          const counterTarget = pending && enemies.find(enemy =>
            enemy.id === pending.targetId);
          if (isKillFlowCastEligible({
            opportunity: pending, opportunityId: pending?.id, target: counterTarget,
            lockedTarget: lockOnTargetRef.current, origin: model?.position,
            family, now: counterNow, maxRange: ENEMY_ATTACK_RANGE + 0.5,
            pvp: !!window.__activeDuel, playerAlive: getPlayerHUD().hp > 0,
          })) {
            abilityKeyPressed.current = slotIndex;
            castInputMeta.current = { slotIndex, heldMs: 0,
              counterOpportunityId: pending.id };
          } else if (!window.__activeDuel &&
              isAOEChannelUnlocked(skill, getSkillMasteryLevel(skillId))) {
            heldAOEKeys.set(k, { slotIndex, skillId,
              token: 'axe_aoe_' + Date.now() + '_' + k, at: Date.now(), started: false });
          } else if (isChargeableCombatSkill(skill, getSkillMasteryLevel(skillId))) {
            const activeDuel = window.__activeDuel;
            const chargeId = activeDuel && skill?.skill_type === 'ACTIVE_ATTACK'
              ? `axech${Date.now().toString(36)}_${Math.random().toString(36).slice(2,12)}`
              : null;
            chargedKeys.set(k, { slotIndex, skillId, chargeId, startAt: Date.now() });
            if (chargeId) window.dispatchEvent(new CustomEvent('axeDuelChargeStart', {
              detail: { duelId: activeDuel.duelId, chargeId, skillId,
                weaponPath: getActiveWeaponPath() },
            }));
            showCombatNotice('Hold to charge · release to strike');
          } else {
            abilityKeyPressed.current = slotIndex;
            castInputMeta.current = { slotIndex, heldMs: 0 };
          }
        }
      }
      // GameView owns I/C/L/K/P/M/J/= menu keys before gameplay listeners.
      // Preserve the old test-scene NPC visibility diagnostic on Shift+F9
      // rather than stealing the Blacksmith '=' shortcut.
      if (e.code === 'F9' && e.shiftKey && !e.repeat) {
        npcsVisibleRef.current = !npcsVisibleRef.current;
        e.preventDefault();
      }
      // Z/X/V/B = companion abilities or Deity Fusion (resolved via loadout).
      handleCompanionKey(k, companionAbilityPressed);
      if (e.code === 'Backquote' || k === '`') {
        e.preventDefault();
        handleVoiceToggle(voiceRef, setLocalMicOn);
      }
    };
    const clearWorldMapMovement = () => {
      keys.current = {};
      chargedKeys.clear();
      cancelBowCharge();
      hideSkillCharge();
      for (const held of heldAOEKeys.values()) {
        window.dispatchEvent(new CustomEvent('axeAoeChannelStop', { detail: { token: held.token } }));
      }
      heldAOEKeys.clear();
      killFlowCounter.reset();
      killFlowPursuit = null;
      castInputMeta.current = null;
      // Release captured look whenever map or ESC overlays take focus.
      if (document.pointerLockElement === renderer.domElement)
        document.exitPointerLock?.();
    };
    const onInputBlur = () => {
      altCursorHeld.current = false;
      clearWorldMapMovement();
      drag.current.active = false;
      rightDragMoved.current = false;
    };
    const onKeyUp = (e) => {
      if (e.key === 'Alt') { altCursorHeld.current = false; return; }
      const k = e.key.toLowerCase();
      keys.current[k] = false;
      // Release of a charged/held input while navigating the ESC menu must
      // never cast a queued skill when the player returns to the world.
      if (window.__axePauseMenuOpen || window.__axeDialogueOpen) return;
      if (k === 'q') crouchTogglePressed.current = false;
      const aoeHeld = heldAOEKeys.get(k);
      if (aoeHeld) {
        heldAOEKeys.delete(k);
        if (aoeHeld.started) {
          // A channel queued but not yet cast must never start after release.
          if (abilityKeyPressed.current === aoeHeld.slotIndex &&
              castInputMeta.current?.channelToken === aoeHeld.token) {
            abilityKeyPressed.current = -1;
            castInputMeta.current = null;
          }
          window.dispatchEvent(new CustomEvent('axeAoeChannelStop',
            { detail: { token: aoeHeld.token } }));
        } else if (!window.__axeUiModalOpen && !window.__axeServiceModeOpen &&
            !window.__axeWorldMapOpen &&
            getLoadout().activeSlots[aoeHeld.slotIndex] === aoeHeld.skillId) {
          abilityKeyPressed.current = aoeHeld.slotIndex;
          castInputMeta.current = { slotIndex: aoeHeld.slotIndex, heldMs: 0 };
        }
      }
      const held = chargedKeys.get(k);
      if (held) {
        chargedKeys.delete(k);
        if (!window.__axeUiModalOpen && !window.__axeServiceModeOpen &&
            !window.__axeWorldMapOpen &&
            getLoadout().activeSlots[held.slotIndex] === held.skillId) {
          abilityKeyPressed.current = held.slotIndex;
          castInputMeta.current = {
            slotIndex: held.slotIndex,
            heldMs: Math.max(0, Date.now() - held.startAt),
            chargeId: held.chargeId || null,
          };
        }
      }
    };
    const rightDragMoved = { current: false };
    const contextRay = new THREE.Raycaster();
    const pickContextActor = (event) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return null;
      contextRay.setFromCamera({
        x: ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        y: -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      }, camera);
      const remoteHits = contextRay.intersectObjects(remoteManagerRef.current?.getMeshes?.() || [], false);
      const mount = !isMountedRef.current && companionGroupRef.current?.visible
        ? companionGroupRef.current : null;
      const mountHits = mount ? contextRay.intersectObject(mount, true) : [];
      const remoteHit = remoteHits.find(hit => hit.object?.userData?.remotePlayerId);
      const mountHit = mountHits[0];
      if (mountHit && (!remoteHit || mountHit.distance < remoteHit.distance)) {
        const def = companionDefRef.current;
        return def ? { kind:'mount', target:{ id:def.id, name:def.name || 'Mount' } } : null;
      }
      const mesh = remoteHit?.object;
      return mesh ? { kind:'player', target:{
        id:mesh.userData.remotePlayerId,
        name:mesh.userData.remotePlayerName || 'Player',
      } } : null;
    };
    const onMouseDown = (e) => {
      if (entryModeRef.current || entryCamera.isActive()) return;
      if (window.__axeUiModalOpen || window.__axeServiceModeOpen || window.__axeWorldMapOpen || window.__axePauseMenuOpen || window.__axeDialogueOpen) return;
      // Left click = attack, middle click = Lock-On, right click = camera drag (+ block if no drag)
      if (e.button === 0) {
        if (altCursorHeld.current) { e.preventDefault(); return; }
        if (getActiveWeaponPath()!=='ranged' && isAXEClickToMoveEnabled() && tryClickToMove(e)) { e.preventDefault(); return; }
        // Melee clicks never borrow the bow's 12m range or attack montage.
        // The clone's existing over-the-shoulder reticle stays independent.
        if(getActiveWeaponPath()==='ranged'){
          if(!heldBow.active){
            heldBow.active=true;heldBow.startedAt=performance.now();
            bowVisuals.setCharge?.(getBowChargeStatus(0));
          }
        }else{
          rangedClickAttackPressed.current=false;
          attackPressed.current=true;
        }
        // Like Luna's Game 2 exploration: a click in the 3D viewport locks
        // free-look. Keep left attack and optional click-to-move intact.
        // Embedded previews can refuse pointer lock; right-drag still works.
        if (!isAXEClickToMoveEnabled() &&
            document.pointerLockElement !== renderer.domElement) {
          try {
            const capture = renderer.domElement.requestPointerLock?.();
            capture?.catch?.(() => {});
          } catch { /* Right-drag fallback remains available. */ }
        }
        e.preventDefault();
      } else if (e.button === 1) {
        e.preventDefault();
        const target = handleMiddleClick({ event: e, renderer, camera, enemies, remoteManager: remoteManagerRef.current, setPlayerMenu, rogues: window.__gw3dRogues || [], bosses: bossEntities });
        lockOnTargetRef.current = target && lockOnTargetRef.current?.id !== target.id ? target : null;
      } else if (e.button === 2) {
        // Right-click a visible player or your mount with the cursor freed.
        // On empty space, retain the existing right-drag camera / short guard.
        if (altCursorHeld.current || e.altKey ||
            document.pointerLockElement !== renderer.domElement) {
          const picked = pickContextActor(e);
          if (picked) {
            e.preventDefault();
            drag.current.active = false;
            setPlayerMenu({ ...picked });
            return;
          }
        }
        // Start camera drag on right-click
        drag.current.active = true;
        drag.current.x = e.clientX;
        drag.current.y = e.clientY;
        rightDragMoved.current = false; otsAim.current.beginHold(performance.now()); // hold = OTS aim, tap = guard
        // A browser cannot move its OS cursor programmatically. Pointer lock
        // uses relative mouse deltas and hides the cursor so the reticle stays
        // at the exact centre while the camera follows the mouse.
        if (getActiveWeaponPath()==='ranged' && !altCursorHeld.current &&
            document.pointerLockElement!==renderer.domElement) {
          try { renderer.domElement.requestPointerLock?.()?.catch?.(()=>{}); }
          catch { /* Right-drag remains available in restricted previews. */ }
        }
        e.preventDefault();
      }
    };
    const onMouseUp = (e) => {
      if (entryModeRef.current || entryCamera.isActive()) {cancelBowCharge();return;}
      if (window.__axeUiModalOpen || window.__axeServiceModeOpen || window.__axeWorldMapOpen || window.__axePauseMenuOpen || window.__axeDialogueOpen) {
        cancelBowCharge();drag.current.active=false;rightDragMoved.current=false;
        otsAim.current.endHold(performance.now());return;
      }
      if(e.button===0&&heldBow.active){
        const status=getBowChargeStatus(Math.max(0,performance.now()-heldBow.startedAt));
        heldBow.active=false;
        bowVisuals.setCharge?.(null);
        if(getActiveWeaponPath()==='ranged'&&!isMountedRef.current&&
          getPlayerHUD().hp>0&&!entryModeRef.current){
          pendingBowShotCharge=status;
          rangedClickAttackPressed.current = getActiveWeaponPath()==='ranged';
          attackPressed.current=true;
        }
        return;
      }
      if (e.button === 2) {
        const startedOnWorldCanvas = drag.current.active; const aimHeldMs = otsAim.current.endHold(performance.now());
        drag.current.active = false;
        // Only a quick right-click that never dragged still guards; holding aims.
        if (startedOnWorldCanvas && !rightDragMoved.current && aimHeldMs < OTS_AIM.tapGuardMs) {
          const guardSpend = spendCombatResource('guard');
          if (guardSpend.ok) {
            playerStateMachine.setIntent({ blockHeld: true });
            playerAnim?.setBlocking(true);
            setTimeout(() => {
              playerStateMachine.setIntent({ blockHeld: false });
              playerAnim?.setBlocking(false);
            }, 150);
          } else {
            showCombatNotice('Not enough stamina to guard');
          }
        }
        rightDragMoved.current = false;
      } else {
        drag.current.active = false;
      }
    };
    const onMouseMove = (e) => {
      if (entryModeRef.current || entryCamera.isActive()) return;
      if (window.__axeUiModalOpen || window.__axeServiceModeOpen ||
          window.__axeWorldMapOpen || window.__axePauseMenuOpen || window.__axeDialogueOpen) {
        drag.current.active = false;
        return;
      }
      const captured = document.pointerLockElement === renderer.domElement;
      if (!captured && !drag.current.active) return;
      // Relative movement stays smooth under pointer lock; client positions
      // remain usable if an iframe/browser blocks pointer lock.
      const dx = captured ? e.movementX : e.clientX - drag.current.x;
      const dy = captured ? e.movementY : e.clientY - drag.current.y;
      if (!captured) {
        drag.current.x = e.clientX;
        drag.current.y = e.clientY;
      }
      if (drag.current.active && (Math.abs(dx) > 1 || Math.abs(dy) > 1))
        rightDragMoved.current = true;
      applyGame3DGame2MouseLook(orbit.current, dx, dy);
    };
    const onWheel = (e) => {
      if (entryModeRef.current || entryCamera.isActive()) return;
      if (window.__axeUiModalOpen || window.__axeServiceModeOpen ||
          window.__axeWorldMapOpen || window.__axePauseMenuOpen || window.__axeDialogueOpen) return;
      orbit.current.distance = game3dGame2Zoom(orbit.current.distance, e.deltaY);
      e.preventDefault();
    };
    const onContext = (e) => e.preventDefault();

    const onNearbyRespawnQuery = event => {
      if (typeof event.detail?.respond !== 'function') return;
      event.detail.respond(resolveSafeNearbyRespawn(event.detail.deathPosition));
    };
    window.addEventListener('axeNearbyRespawnQuery', onNearbyRespawnQuery);
    // Recheck the temporary landing at the moment of respawn. If terrain or
    // hostiles changed, fall back to the registered character checkpoint.
    const onPlayerRespawn = (e) => {
      const target = e.detail;
      const m = modelRef.current || playerModelRef.current;
      if (!m || !target) return;
      const point = target.source === NEARBY_RESPAWN_ID
        ? (resolveSafeNearbyRespawn(target.deathPosition) || getRespawnPoint())
        : target;
      if (!Number.isFinite(point?.x) || !Number.isFinite(point?.z)) return;
      m.position.x = point.x;
      m.position.z = point.z;
      const gy = sampleGroundY(point.x, point.z);
      m.position.y = Number.isFinite(gy) ? gy : 0;
      m.visible = true;
      playerAnim?.revive?.();
      clickToMove.cancel('respawn');
      playerInvulTimer.current = PLAYER_INVUL_AFTER_HIT;
      resetCombatResources();
      window.__localPlayerPos = { x: m.position.x, y: m.position.y, z: m.position.z };
    };
    window.addEventListener('playerRespawn', onPlayerRespawn);

    window.addEventListener('axeWorldMapOpened', clearWorldMapMovement);
    window.addEventListener('axeDialogueOpened', clearWorldMapMovement);
    window.addEventListener('axePauseMenuOpened', clearWorldMapMovement);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onInputBlur);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('contextmenu', onContext);
    // Prevent middle-click scroll/autoscroll on the canvas
    renderer.domElement.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });

    const playCompanionAnimation = (targetAnim) => {
      // Faction 3's retargeted clips can alternate on tiny follow packets
      // or terrain-contact steps. Hold the running cycle briefly instead
      // of resetting cross-fades every other frame. Other mounts unchanged.
      if (isFactionThreeMount(companionDefRef.current)) {
        const now=performance.now();
        if (targetAnim==='run') factionThreeLastRunAt=now;
        else if (targetAnim==='idle' && now-factionThreeLastRunAt<170) return;
      }
      const idle = companionIdleActionRef.current;
      const walk = companionWalkActionRef.current;
      const run = companionRunActionRef.current;
      if (targetAnim === 'run' && !run && walk) targetAnim = 'walk';
      const next = targetAnim === 'run' ? run : targetAnim === 'walk' ? walk : idle;
      // A clip arriving asynchronously must still start when the requested
      // state is unchanged. Missing clips must not silence the current action.
      if (!next || (targetAnim === companionCurrentAnimRef.current && next.isRunning())) return;
      if (targetAnim !== 'idle' && idle) idle.fadeOut(0.2);
      if (targetAnim !== 'walk' && walk) walk.fadeOut(0.2);
      if (targetAnim !== 'run' && run) run.fadeOut(0.2);
      next.reset().setEffectiveWeight(1).fadeIn(0.2).play();
      companionCurrentAnimRef.current = targetAnim;
    };

    const companionSystem = new CompanionAISystem({
      companionRef: companionGroupRef,
      ownerRef: playerModelRef,
      sampleGroundY,
      playAnimation: playCompanionAnimation,
      getMounted: () => isMountedRef.current,
    });
    // Sound effects and environment beds run independently from combat music.
    const worldSoundscape=createLayeredWorldSoundscape({getSound:getActionSound,playSound:playActionSound});
    const unlockWorldSound=()=>worldSoundscape.unlock();
    container.addEventListener('pointerdown',unlockWorldSound);
    window.addEventListener('keydown',unlockWorldSound);
    // Sound-pack one-shots for chests, combo finishers, armor breaks and victories.
    const gameEventSounds=createGameEventSoundBridge({playSound:playActionSound,hasSound:key=>!!getActionSound(key),
      getListenerPosition:()=>modelRef.current?.position||null,
      getBossPosition:id=>bossEntities.find(b=>b.id===id)?.group?.position||null});
    preloadActionSounds();
    const combatSystem = new CombatSystem({ calculateHit, getPlayerHUD, setHP, spawnDamageFloat, playActionSound });
    const impactFeedback = createCombatImpactFeedback({ scene });
    const duelDefenseFeedback = createDuelDefenseFeedback({
      scene, getActor: () => modelRef.current,
    });
    const onDuelDefenseResolved = event => {
      const result = event.detail || {};
      // This event is emitted only from the defender's authenticated Duel
      // session subscription, not from a speculative local attack animation.
      duelDefenseFeedback.show(result);
      if (Number(result.hpDamage) > 0) {
        playerAnim?.requestHitReact?.();
        playActionSound('player_hit');
      }
    };
    window.addEventListener('axeDuelDefenseResolved', onDuelDefenseResolved);
    const weaponTrails = createCombatWeaponTrails({ scene });
    const hasCombatSound = (key) => !!getActionSound(key);
    const playSynchronizedSwing = (weaponPath, skillId) => {
      mountedAttackSeconds = 0.9; const sound = selectCombatSwingSound({ weaponPath, skillId, hasSound: hasCombatSound });
      // Authored skill tracks retain their own swing. Standard melee swings
      // combine original swing, cutting wind and optional metallic resonance.
      if(sound||(weaponPath!=='ranged'&&!AUTHORED_SKILL_SOUNDS.has(skillId)))
        worldSoundscape.playSwing({baseKey:sound,melee:weaponPath!=='ranged'});
    };
    const abilitySystem = new AbilitySystem({ getLoadout, castSkill, startSkillCooldown, bindExtendedHotkeys: false });

    // One collision path for normal WASD and short roll/dodge impulses. This
    // is client presentation only; server-authoritative duel positions stay
    // owned by their existing worker and are not modified by animation code.
    const moveWorldActor=(actor,dx,dz,mounted=false)=>{
      if(!actor || !Number.isFinite(dx) || !Number.isFinite(dz))return false;
      const fromX=actor.position.x,fromZ=actor.position.z;
      actor.position.x+=dx;
      actor.position.z+=dz;
      const model=actor;
      const distFromCenter = Math.sqrt(model.position.x * model.position.x + model.position.z * model.position.z);
    if(region==='wolfveil'){
      if(!insideWolfveilClientGround(model.position.x,model.position.z,.65)||
         sampleGroundY(model.position.x,model.position.z)===null){
        model.position.x=fromX;
        model.position.z=fromZ;
      }
    }else if (distFromCenter > arenaRadius) {
      const edgeScale = arenaRadius / distFromCenter;
      model.position.x *= edgeScale;
      model.position.z *= edgeScale;
    }
    // Client presentation collision uses the same tree radii as the
    // forest mesh; this does not pretend to replace server pathfinding.
    forestBiome?.resolveCollision(model.position, .62);
    wolfveilVillage?.resolveBuildingCollision(model.position,.62,
      {x:fromX,y:model.position.y,z:fromZ},{player:true});importedSpawnTown?.resolveCollision(model.position,{x:fromX,z:fromZ}); // town walls and ledges
    lunarDungeon?.resolveCollision(model.position,{x:fromX,z:fromZ},mounted?.85:.62);
    astralDungeon?.resolveCollision(model.position,{x:fromX,z:fromZ},mounted?.85:.62);
    lunarGate?.resolveCollision(model.position,{x:fromX,z:fromZ},mounted?.85:.62);
    astralGate?.resolveCollision(model.position,{x:fromX,z:fromZ},mounted?.85:.62);
    // Prevent client player/mount lateral slip through the deck rails.
    // The server has a corresponding signed-map side-rail footprint.
    wolfveilVillage?.resolveBridgeRailCollision(
      model.position,mounted ? .90 : .62,{x:fromX,z:fromZ});
    stationRuntime.resolveCollision(model.position, .62);
      return Math.hypot(actor.position.x-fromX,actor.position.z-fromZ)>0.001;
    };

    // Save while playing, on scene handoff, and before navigation. Never save
    // the login camera's origin or a dedicated duel worker's arena position.
    const flushCheckpoint = () => {
      const actor = modelRef.current;
      if (!actor || entryModeRef.current || dedicatedMode || getPlayerHUD().hp <= 0 ||
          checkpointOwnerRef.current !== getStorageUser() + '::' + getActiveId()) return;
      const point = {
        region, x:actor.position.x, y:actor.position.y, z:actor.position.z,
        yaw:orbit.current.yaw,
      };
      // Do not stamp a new timestamp every four seconds while standing still.
      // The cloud sync should only upload changed world checkpoints.
      const previous = worldCheckpointStore.read();
      if (previous && previous.region === point.region &&
          Math.hypot(previous.x-point.x, previous.y-point.y, previous.z-point.z)<.02 &&
          Math.abs(previous.yaw-point.yaw)<.015) return;
      worldCheckpointStore.save(point);
    };
    window.addEventListener('pagehide', flushCheckpoint);
    window.addEventListener('game3dCheckpointFlush', flushCheckpoint);
    let nextCheckpointSaveAt = 0;
    // Animation loop
    let frameId;
    let uiFrameCounter = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      // Character selection is a camera/UI state of this SAME Wolfveil scene.
      // Suspend combat, input, rewards and physics; keep scenery, idle animation
      // and real renderer alive. No second canvas or terrain is constructed.
      if (entryModeRef.current) {
        menuCameraHeld=true;
        entryCamera.cancel();
        keys.current={};
        attackPressed.current=false;
        rangedClickAttackPressed.current=false;
        if(region!==ASTRAL_DUNGEON_REGION)envSystem.update(delta);
        wolfveilVillage?.update(delta,envSystem.getState(),modelRef.current?.position);importedSpawnTown?.update(delta,modelRef.current?.position);
        ambientBirds?.update(delta,modelRef.current?.position,envSystem.getState());
        vortexLake?.update(delta,null);
        livingInkWorld?.update(delta,envSystem.getState());
        playerAnim?.updateAnimation?.(delta);
        if(mixer)mixer.update(delta);
        if(model){
          // The loaded world is the backdrop throughout the entry flow. Hide its
          // old actor under Start/Faction and while the creator studio draws the
          // unsaved candidate; show only the selected playable actor in Select.
          model.visible=entryPreviewModeRef.current==='select';
          playerAnim?.updateActionState({moving:false,running:false,direction:'forward',aiming:false});
          charLights.update(delta,envSystem.getState,modelRef.current,camera);
          entryCamera.preview(delta,{camera,model,mode:entryPreviewModeRef.current,
            clipAgainstTerrain:pose=>playerCameraSystem.clipAgainstTerrain(pose)});
        }
        atomicLook?.update(delta,modelRef.current?.position,envSystem.getState());
        if(!atomicLook?.render(camera))inkLook.render(scene,camera);
        return;
      }
      if(menuCameraHeld){
        menuCameraHeld=false;
        if(model)model.visible=true;
        if(region==='wolfveil')entryCamera.start();
      }
      // Revert additive gesture poses before the normal Mixers update.
      echoGestureRuntime.preUpdate();
      impactFeedback.preUpdate(); // restore additive bone recoil before enemy Mixers pose
      const npcsVisible = npcsVisibleRef.current; // '=' toggles all non-boss entities (NPCs/enemies/companion)
      if(region!==ASTRAL_DUNGEON_REGION)envSystem.update(delta);
      forestBiome?.update(delta, envSystem.getState(), modelRef.current?.position);
      wolfveilVillage?.update(delta,envSystem.getState(),modelRef.current?.position);importedSpawnTown?.update(delta,modelRef.current?.position);
      ambientBirds?.update(delta,modelRef.current?.position,envSystem.getState());
      const vortexTravel=vortexLake?.update(delta,modelRef.current?.position);
      if(vortexTravel)
        window.dispatchEvent(new CustomEvent('game3dPortalTravel',{detail:vortexTravel}));
      if(lunarGate?.update(delta,modelRef.current?.position))
        window.dispatchEvent(new CustomEvent('game3dPortalTravel',{detail:{target:LUNAR_CAVE_REGION}}));
      if(astralGate?.update(delta,modelRef.current?.position))
        window.dispatchEvent(new CustomEvent('game3dPortalTravel',{detail:{target:ASTRAL_DUNGEON_REGION}}));
      if(lunarDungeon?.update(delta,modelRef.current?.position))
        window.dispatchEvent(new CustomEvent('game3dPortalTravel',{detail:{target:'wolfveil',returnToGate:true}}));
      if(astralDungeon?.update(delta,modelRef.current?.position))
        window.dispatchEvent(new CustomEvent('game3dPortalTravel',{detail:{target:'wolfveil',returnToGate:'astral'}}));
      const meadowRemoteContacts=Array.from(
        remoteManagerRef.current?.getRemotes?.()?.values?.()||[],
        remote=>remote?.group?.position,
      ).filter(Boolean);
      livingMeadow?.update(delta,envSystem.getState(),modelRef.current?.position,meadowRemoteContacts);
      livingInkWorld?.update(delta,envSystem.getState());
      stationRuntime.update(delta);
      haloVisualRuntime?.update?.(delta);
      fusionVisualRuntime?.update?.(delta);
      ascensionVisualRuntime?.update?.(delta);
      ascendedGearVisualRuntime?.update?.(delta);
      bossEncounter.update(delta);
      charLights.update(delta, envSystem.getState, modelRef.current, camera);
      playerAnim?.setMounted?.(isMountedRef.current);
      const equippedForAnimation = getActiveEquippedAXEWeapon();
      playerAnim?.setEquipmentContext?.({ weaponType: inferAXEMasteryWeaponId(equippedForAnimation) || 'unarmed',
        equipped: !!equippedForAnimation });
      if (getPlayerHUD().hp <= 0 && !playerAnim?.getDebugState?.().isDead) {
        if (isMountedRef.current) {
          restoreMountedRider();
          isMountedRef.current = false;
          setIsMounted(false);
          setMounted(false);
          setAXEMountRiding(false);
          playerStateMachine.setMounted(false);
          playerAnim?.setMounted?.(false);
        }
        playerAnim?.HandleDeath?.();
      }
      playerAnim?.updateAnimation?.(delta);
      if (mixer) mixer.update(delta);
      ascensionVisualRuntime?.lateUpdate?.(); // levitation lifts the posed skeleton
      ascendedGearVisualRuntime?.lateUpdate?.(); // animated hand socket placement
      if (dodgeVanish.active) {
        dodgeVanish.timer += delta;
        if (dodgeVanish.timer >= dodgeVanish.duration) {
          if (model) model.visible = true;
          dodgeVanish.active = false;
        }
      }
      if (remoteManagerRef.current) remoteManagerRef.current.update(delta);
      remoteCompanionManager.update(delta);
      remoteCompanionManager.updateRiders(remoteManagerRef.current?.getRemotes?.());
      if (voiceRef.current && remoteManagerRef.current) {
        const ids = Array.from(remoteManagerRef.current.getRemotes?.()?.keys() || []);
        voiceRef.current.syncPeers(ids);
        voiceRef.current.updateSpatialGains();
      }

      // ─── Companion mount toggle (F) — runs once per key press ───
      if (mountToggleRef.current && model) {
        mountToggleRef.current = false;
        const compGroup = companionGroupRef.current;
        if (isMountedRef.current) {
          restoreMountedRider();
          // Dismount: place player next to companion
          if (compGroup) {
            // Use the same swept collision/ground checks as ordinary travel.
            moveWorldActor(model, Math.cos(compGroup.rotation.y) * 1.2,
              -Math.sin(compGroup.rotation.y) * 1.2, false);
            const groundY = sampleGroundY(model.position.x, model.position.z);
            if (groundY !== null) model.position.y = groundY;
            if (!dodgeVanish.active) model.visible = true;
          }
          isMountedRef.current = false;
          setIsMounted(false);
          setMounted(false);
          setAXEMountRiding(false);
        } else if (compGroup && getPlayerHUD().hp > 0) {
          // Only mount if close enough
          const dx = compGroup.position.x - model.position.x;
          const dz = compGroup.position.z - model.position.z;
          if (Math.sqrt(dx * dx + dz * dz) < 3.5) {
            const rideResult = setAXEMountRiding(true);
            if (rideResult.ok) {
              // The owner permits a disappear/reappear mounting transition.
              // Reappear only after the skeletal seat pose has been applied.
              model.position.x = compGroup.position.x;
              model.position.z = compGroup.position.z;
              model.position.y = compGroup.position.y;
              model.quaternion.copy(compGroup.quaternion);
              mountAppearanceSeconds = 0.16;
              model.visible = false;
              isMountedRef.current = true;
              setIsMounted(true);
              setMounted(true);
            } else if (rideResult.reason === 'MOUNT_ABSORBED') {
              showCombatNotice('Your mount is absorbed in Soul Fusion and cannot be ridden');
            }
          }
        }
        playerAnim?.setMounted?.(isMountedRef.current);
        playerStateMachine.setMounted(isMountedRef.current);
      }

      // Movement
      if (model) {
        const mounted = isMountedRef.current;
        const compGroup = companionGroupRef.current;
        const mountTravelFromX = model.position.x;
        const mountTravelFromZ = model.position.z;
        const axeMountSpeed = getActiveAXEMountSpeedMultiplier();
        const speedMult = mounted ? (axeMountSpeed || getEffectiveSpeedMultiplier()) : 1.0;
        // Opening the C Character Hub immediately releases movement input. This
        // prevents a held W/Shift/Ctrl key from continuing to move the character
        // behind a full-screen UI.
        if (window.__axeUiModalOpen || window.__axeServiceModeOpen || window.__axePauseMenuOpen || window.__axeDialogueOpen) {
          keys.current = {};
          attackPressed.current = false;
          rangedClickAttackPressed.current = false;
          cancelBowCharge();
          hideSkillCharge();
          skillStrikeQueue.clear();
          interactPressed.current = false;
          abilityKeyPressed.current = -1;
          chargedKeys.clear();
          castInputMeta.current = null;
          chargedFinisherWindow = null;
          companionAbilityPressed.current = null;
          mountToggleRef.current = false;
          crouchTogglePressed.current = false;
          drag.current.active = false;
          rightDragMoved.current = false;
          playerStateMachine.setIntent({ blockHeld: false, aimHeld: false }); otsAim.current.endHold(performance.now()); otsAim.current.setPadAim(false);
          playerAnim?.setBlocking(false);
          clickToMove.cancel('ui');
          if (document.pointerLockElement === renderer.domElement)
            document.exitPointerLock?.();
        }
        // Arrow look follows Luna's Game 2 timing before camera-relative WASD.
        applyGame3DGame2ArrowLook(orbit.current, keys.current, delta);
        const yaw = orbit.current.yaw;
        const move = new THREE.Vector3();
        const combatAxes = getCombatAxes();

        // ─── Tornado: ground wind, suction, capture, lift and levitation ───
        const tGround = mapReady ? (sampleGroundY(model.position.x, model.position.z) ?? model.position.y) : model.position.y;
        const tornadoRes = tornado.update(delta, { player: model, groundY: tGround });
        // Boss tornado-lift-beam pattern — drives the tornado as a scripted boss
        // move. Receives the tornado result the world already computed this frame
        // (single update, no double-advance). While active it can lock movement,
        // tick damage, fire a beam, knock the player out, and run a short fall.
        let bossSpecialLock = false;
        let bossFallActive = false;
        if (model) {
          // Use a stand-in boss origin near the player when no boss entity is
          // spawned, so the scripted tornado-lift-beam pattern still advances
          // (auto-attack + 0 test key) instead of stalling after start().
          const bossForPattern = bossEntities[0] || {
            group: { position: { x: model.position.x + 6, y: model.position.y, z: model.position.z } },
          };
          const tornadoBossResult = bossTornadoLiftBeam.update(delta, {
            boss: bossForPattern,
            player: model,
            groundY: tGround,
            playerAnim,
            tornadoResult: tornadoRes,
          });
          bossSpecialLock = !!tornadoBossResult?.lockMovement;
          bossFallActive = !!tornadoBossResult?.forcedFall;
        }
        // HP threshold combat dialogue (Kali) — fires once per threshold.
        if (bossEncounter.isActive() && bossEntities.length > 0) {
          const b = bossEntities[0];
          if (b && b.maxHp > 0) {
            const hpRatio = b.hp / b.maxHp;
            if (hpRatio <= 0.75 && !bossDialogue.hasShown('boss_75')) {
              bossDialogue.queueLine({ id: 'boss_75', name: 'Kali', text: 'You persist longer than the others.', duration: 3.2, once: true });
            }
            if (hpRatio <= 0.4 && !bossDialogue.hasShown('boss_40')) {
              bossDialogue.queueLine({ id: 'boss_40', name: 'Kali', text: 'Then face the heart of the storm!', duration: 3.4, once: true });
            }
          }
        }
        tornadoView.allowLookUp = tornadoRes.allowLookUp;
        const tornadoActive = tornado.getState().active;
        if (tornadoRes.allowLookUp) {
          // Above the storm the sky is open — sun, stars and the wide view.
          envSystem.setWeather('clear');
        } else if (tornadoView.wasActive && !tornadoActive) {
          envSystem.clearWeatherOverride();
        }
        tornadoView.wasActive = tornadoActive;
        // Existing tornado/boss physics owns height. Animation consumes its
        // airborne state without introducing a second gravity simulation.
        playerStateMachine.setAirborneState({ grounded: !bossFallActive && tornadoRes.liftY <= 0,
          verticalVelocity: bossFallActive ? -1 : tornadoRes.liftY > 0 ? 1 : 0 });
        if (combatAxes) {
          if (keys.current['w']) move.add(combatAxes.forward);
          if (keys.current['s']) move.add(combatAxes.forward.clone().multiplyScalar(-1));
          if (keys.current['a']) move.add(combatAxes.cameraRight.clone().multiplyScalar(-1));
          if (keys.current['d']) move.add(combatAxes.cameraRight);
        } else {
          // Camera-relative movement on a correct planar basis (right is derived
          // from forward, so A/D can never skew into a diagonal).
          const { forward, right } = getPlanarBasisFromYaw(yaw);
          if (keys.current['w']) move.add(forward);
          if (keys.current['s']) move.sub(forward);
          if (keys.current['a']) move.sub(right);
          if (keys.current['d']) move.add(right);
        }
        // Click-to-move steers only while no WASD key moves the hero (a key cancels it), through the
        // same vector, so speed, Shift run / Ctrl sprint, animation and collision match WASD.
        if (window.__axeTileInspectionEditing) clickToMove.cancel('tile-editor');
        const clickSteer = clickToMove.steer({ position: model.position, delta, keyMoving: move.lengthSq() > 0 });
        if (clickSteer) move.set(clickSteer.x, 0, clickSteer.z);
        const clickMoveFrom = clickSteer ? { x: model.position.x, z: model.position.z } : null;
        // Kill Flow follows the next LIVE NPC using the same collision-checked
        // movement path as walking. It never teleports/snap-dashes or moves
        // through a wall. Manual WASD always cancels this brief assist.
        let counterAssisting = false;
        const availableCounter = killFlowCounter.peek(Date.now());
        if (!availableCounter || !killFlowPursuit || window.__activeDuel ||
            getPlayerHUD().hp <= 0 || mounted || dedicatedMode ||
            window.__axeUiModalOpen || window.__axeServiceModeOpen) {
          killFlowPursuit = null;
        } else if (move.lengthSq() > 0 || clickSteer) {
          killFlowPursuit = null;
        } else {
          const follow = enemies.find(target =>
            target.id === killFlowPursuit.targetId && target.alive && !target.dying &&
            target.group?.position && target.group.visible !== false);
          const dx = follow ? follow.group.position.x - model.position.x : 0;
          const dz = follow ? follow.group.position.z - model.position.z : 0;
          const dist = Math.hypot(dx, dz);
          if (!follow || dist > 10 || !Number.isFinite(dist)) {
            killFlowPursuit = null;
          } else if (dist > Math.max(1.5, ENEMY_ATTACK_RANGE - 0.25)) {
            move.set(dx / dist, 0, dz / dist);
            counterAssisting = true;
          }
        }

        const isMoving = move.lengthSq() > 0;
        const isRunning = !!keys.current['shift'] && isMoving;
        const isSprinting = !!keys.current['control'] && isMoving;
        if (playerAnim?.setAiming && otsAim.current.appliedAim !== otsAim.current.aiming) { otsAim.current.appliedAim = otsAim.current.aiming; playerAnim.setAiming(otsAim.current.appliedAim); } const isAiming = !!playerAnim?.getIsAiming?.();
        // Locked on, the hero keeps facing the target, so a click move can be a strafe.
        const moveDirection = clickSteer && combatAxes ? directionRelativeToFacing(clickSteer, combatAxes.forward)
          : keys.current['s'] ? 'backward' : keys.current['a'] ? 'left' : keys.current['d'] ? 'right' : 'forward';
        const combatLocked = !!combatAxes;
        // Free movement turns the body toward travel. Side/back clips apply
        // only while lock-on holds its facing; otherwise use its forward gait.
        const animationDirection = combatLocked ? moveDirection : 'forward';
        const isCrouching = !!playerAnim?.getIsCrouching?.();
        const movementOverridden = !!playerAnim?.isMovementOverridden?.();
        // Ctrl is the dedicated Sprint input. Its 2%-per-level passive affects
        // on-foot locomotion only; preserve the separate Shift run upgrade.
        const baseMoveSpeed = isSprinting
          ? RUN_SPEED * 1.35 * (mounted ? 1 : getSprintMultiplier())
          : isRunning ? RUN_SPEED * getRunMultiplier() : WALK_SPEED;
        const speed = (baseMoveSpeed * (isCrouching ? 0.58 : 1)) *
          speedMult * getWeaponMoveSpeedMult() *
          (counterAssisting ? (availableCounter?.chosen ? 1.75 : 1.4) : 1);
        const canMove = isMoving && !window.__axeTileInspectionEditing && !dedicatedMode && !movementOverridden &&
          !tornadoRes.lockMovement && !bossSpecialLock;
        if(dedicatedMode)clickToMove.cancel('dedicated');
        if (canMove) {
          move.normalize();
          const fromX=model.position.x,fromZ=model.position.z;
          moveWorldActor(model,move.x*speed*delta,move.z*speed*delta,mounted);
          if(mounted){
            tickAXEMountRideActivity(delta,{moving:true,distanceMeters:
              Math.hypot(model.position.x-fromX,model.position.z-fromZ)});
          }
          // Award mastery only for actual on-foot movement after collision
          // resolution. Idle/key-hold against solid rocks earns no Sprint XP.
          if (isSprinting && !mounted &&
              Math.hypot(model.position.x-fromX,model.position.z-fromZ) > .05) {
            noteSprintTravel(delta);
          }
          if (!combatAxes && !otsAim.current.aiming) {
            const angle = Math.atan2(move.x, move.z);
            const targetQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
            model.quaternion.slerp(targetQ, ROT_SMOOTH);
          }
        }
        // Glue player feet to terrain, then let the manual controller add jump/roll offsets.
        // Skip during the boss pattern's forced fall — the controller owns Y until landing.
        if (mapReady && !bossFallActive) {
          // Player's feet follow Luna's supported entrance, indoor stairs,
          // upper gallery and roof terrace. Never sample the roof from above
          // or snap an upstairs player down to Wolfveil's hillside.
          const palaceY=wolfveilVillage?.playerPalaceGroundY(model.position);
          const gy=palaceY??sampleGroundY(model.position.x,model.position.z);
          if (gy !== null) model.position.y = gy;
          if(playerAnim)playerAnim.updateMotion(model,delta,gy??model.position.y,(dx,dz)=>{
            if(!dedicatedMode && !tornadoRes.lockMovement && !bossSpecialLock && !window.__axeTileInspectionEditing)
              moveWorldActor(model,dx,dz,mounted);
            return wolfveilVillage?.playerPalaceGroundY(model.position)
              ?? sampleGroundY(model.position.x,model.position.z) ?? model.position.y;
          });
        } else if (playerAnim && !bossFallActive) {
          playerAnim.updateMotion(model,delta,model.position.y-(playerAnim.getJumpOffset?.()||0),(dx,dz)=>{
            if(!dedicatedMode && !tornadoRes.lockMovement && !bossSpecialLock && !window.__axeTileInspectionEditing)
              moveWorldActor(model,dx,dz,mounted);
            return wolfveilVillage?.playerPalaceGroundY(model.position)
              ?? sampleGroundY(model.position.x,model.position.z) ?? model.position.y;
          });
        }
        // Tornado lift is applied after the feet-to-ground pass so the funnel
        // can actually carry the player up out of the storm.
        if (tornadoRes.liftY > 0 && !bossFallActive) model.position.y += tornadoRes.liftY;
        const beforeRoguePush={x:model.position.x,z:model.position.z};
        // Rogue-AI body collision — push player out so they can't walk through hostile player-AIs
        { const _R = window.__gw3dRogues; if (_R) for (let i=0;i<_R.length;i++){ const r=_R[i]; if(!r.alive||r.dying||!r.group?.visible) continue; const dxR=model.position.x-r.group.position.x, dzR=model.position.z-r.group.position.z, dR=Math.sqrt(dxR*dxR+dzR*dzR); if(dR>0&&dR<0.9){ const p=(0.9-dR)/dR; model.position.x+=dxR*p; model.position.z+=dzR*p; } } }
        // A collision impulse must not push a player out of the rendered
        // terrain even if normal WASD movement was previously accepted.
        if(region==='wolfveil' &&
           !insideWolfveilClientGround(model.position.x,model.position.z,.65)){
          model.position.x=beforeRoguePush.x;
          model.position.z=beforeRoguePush.z;
        }
        // After movement and collision: arrival, or a step that made no headway (blocked).
        if (clickMoveFrom) clickToMove.noteStep({ from: clickMoveFrom, to: model.position, expectedMeters: canMove ? speed * delta : 0 });
        clickMoveMarker.update(delta);

        // ─── Mount handling: companion follows player while mounted ───
        if (companionMixerRef.current) companionMixerRef.current.update(delta);
        if (mounted && compGroup) {
          // Keep the gameplay root on the ground. The pose pass places the
          // pelvis on the mount and solves the legs/arms after all animation.
          compGroup.position.x = model.position.x;
          compGroup.position.z = model.position.z;
          // The visual animal's forward axis is compensated only within
          // its child frame. The world root still tracks player movement.
          // Time-based smoothing removes frame-rate-dependent turn jitter.
          const mountTurn=isFactionThreeMount(companionDefRef.current)
            ? 1-Math.exp(-16*Math.min(Math.max(delta,0),.1)) : ROT_SMOOTH;
          compGroup.quaternion.slerp(model.quaternion, mountTurn);
          if (mapReady) {
            const gy = sampleGroundY(compGroup.position.x, compGroup.position.z);
            if (gy !== null) {
              compGroup.position.y = gy;
              model.position.y = gy;
            }
          }
          // Actual travel selects run at every speed; holding W into a wall
          // leaves the animal idle. Walk stays available as a separate clip.
          const mountMoved = Math.hypot(model.position.x - mountTravelFromX,
            model.position.z - mountTravelFromZ) > 0.0001;
          playCompanionAnimation(mountMoved ? 'run' : 'idle');
        } else {
          // Not mounted — steering-based companion AI prevents snap/micro-jitter near the player.
          if (!dodgeVanish.active) model.visible = true;
          companionSystem.update(delta, { ownerMoving: isMoving, ownerRunning: isRunning, ownerYaw: orbit.current.yaw });
        }

        companionSecondaryRig?.update(delta); // mount-owned tail/wing motion, after locomotion
        if (compGroup) compGroup.visible = mounted || npcsVisible;
        // ─── Companion proximity prompt ───
        if (compGroup && !mounted) {
          const dx = compGroup.position.x - model.position.x;
          const dz = compGroup.position.z - model.position.z;
          const isNear = Math.sqrt(dx * dx + dz * dz) < 3.5;
          if (isNear !== nearbyCompanionRef.current) {
            nearbyCompanionRef.current = isNear;
            setNearbyCompanion(isNear);
          }
        } else if (nearbyCompanionRef.current) {
          nearbyCompanionRef.current = false;
          setNearbyCompanion(false);
        }

        // Keep the active bow's centre reticle and player facing aligned to
        // mouse-controlled camera direction, even when RMB is not held.
        otsAim.current.bowEquipped=getActiveWeaponPath()==='ranged'&&!isMountedRef.current;
        updateLockOnRotation(delta); applyOTSAimFacing(model, orbit.current.yaw, otsAim.current, delta);

        // Core player state machine drives locomotion/combat intent, while legacy animation clips remain preserved.
        playerStateMachine.setIntent({
          moveAmount: isMoving ? 1 : 0,
          runHeld: isRunning,
          sprintHeld: isSprinting,
          aimHeld: isAiming,
          direction: animationDirection,
        });
        playerStateMachine.update(delta);
        if (coreAnimationController) {
          coreAnimationController.update(playerStateMachine.getSnapshot(), playerStateMachine.intent);
        } else if (playerAnim) {
          playerAnim.updateActionState({ moving: isMoving, running: isRunning, direction: animationDirection, aiming: isAiming });
        }
        if (canMove && !mounted) syncFusedLocomotion(playerAnim, model, speed);

        // Walk/run SFX loop — start/stop based on movement
        if (isMoving) {
          startLoopSound('player_walk', { volume: isRunning ? 0.6 : 0.4 });
        } else {
          stopLoopSound('player_walk');
        }

        // Dedicated world-space pose is derived ONLY from signed-worker X/Z
        // plus the server-read origin fixed at handoff. Freeze on disconnect
        // rather than continuing local movement or accepting client teleports.
        if(dedicatedMode && dedicatedPose?.matchId===dedicatedMode.matchId &&
           dedicatedPose.worldOrigin &&
           Number.isFinite(dedicatedPose.worldOrigin.x) &&
           Number.isFinite(dedicatedPose.worldOrigin.z)){
          const pose=dedicatedPose;
          const origin=pose.worldOrigin;
          const place=(group,actor,remote=false)=>{
            if(!group || !Number.isFinite(actor?.x) || !Number.isFinite(actor?.z))return;
            const x=origin.x+actor.x,z=origin.z+actor.z;
            const distance=Math.hypot(group.position.x-x,group.position.z-z);
            const blend=distance>2?1:1-Math.exp(-25*Math.min(delta,0.1));
            group.position.x+=(x-group.position.x)*blend;
            group.position.z+=(z-group.position.z)*blend;
            // When the worker has the same static terrain contract, its
            // height is authoritative. Live house GLB floors/bridges are
            // excluded from that contract until a future map manifest.
            const gy=pose.mapId==='wolfveil-v1'&&Number.isFinite(actor.y)
              ?actor.y:sampleGroundY(group.position.x,group.position.z);
            if(gy!==null)group.position.y=gy;
            if(Number.isFinite(actor.facing))group.rotation.y=actor.facing;
            if(remote){
              const other=remoteManagerRef.current?.getRemotes?.().get(actor.id);
              if(other){
                other.targetPos.set(x,group.position.y,z);
                if(Number.isFinite(actor.facing))other.targetYaw=actor.facing;
              }
            }
          };
          const mine=pose.players.find(p=>p.id===pose.playerId);
          if(mine)place(model,mine);
          for(const p of pose.players)if(p.id!==pose.playerId){
            const remote=remoteManagerRef.current?.getRemotes?.().get(p.id);
            if(remote)place(remote.group,p,true);
          }
        }
        // Broadcast live player position + facing to the HUD minimap store (isRunning consumed by WindRunEffect)
        setPlayerPosition({ x: model.position.x, z: model.position.z, yaw: orbit.current.yaw, isRunning: isRunning && isMoving });
        window.__localPlayerPos = { x: model.position.x, y: model.position.y, z: model.position.z };
        if (performance.now() >= nextCheckpointSaveAt) {
          nextCheckpointSaveAt = performance.now() + 4000;
          flushCheckpoint();
        }

        // Broadcast to multiplayer presence system (used by MultiplayerSystem).
        window.dispatchEvent(new CustomEvent('multiplayerLocalUpdate', {
          detail: {
            x: model.position.x,
            y: model.position.y,
            z: model.position.z,
            yaw: orbit.current.yaw,
            // Only directional input, never browser position, drives the
            // dedicated duel worker's separate authoritative arena.
            combatFacing: model.rotation.y,
            duelMoveX: ((keys.current['d'] ? 1 : 0) - (keys.current['a'] ? 1 : 0)) * Math.cos(model.rotation.y) +
              ((keys.current['w'] ? 1 : 0) - (keys.current['s'] ? 1 : 0)) * Math.sin(model.rotation.y),
            duelMoveZ: ((keys.current['w'] ? 1 : 0) - (keys.current['s'] ? 1 : 0)) * Math.cos(model.rotation.y) -
              ((keys.current['d'] ? 1 : 0) - (keys.current['a'] ? 1 : 0)) * Math.sin(model.rotation.y),
            anim: mounted ? companionCurrentAnimRef.current
              : playerAnim?.getCurrent?.() || (isMoving ? (isSprinting ? 'sprint' : isRunning ? 'run' : 'walk') : 'idle'),
          },
        }));

        // Smooth camera system: damped lock-on yaw, combat distance, and sprint pullback without per-frame object spam.
        playerCameraSystem.update(delta, playerStateMachine.intent);
        updateOTSAimFrame({camera,aim:otsAim.current,colliders:otsCameraColliders(),
          extraMeshes:[...enemies,...bossEntities].map(e=>e.group).filter(Boolean),
          bowEquipped:getActiveWeaponPath()==='ranged'&&!isMountedRef.current,
          blocked:entryModeRef.current||window.__axeUiModalOpen||
            window.__axeServiceModeOpen||window.__axeWorldMapOpen||
            window.__axePauseMenuOpen||window.__axeDialogueOpen||
            window.__axeTileInspectionEditing});
        if(heldBow.active&&(getActiveWeaponPath()!=='ranged'||
          isMountedRef.current||getPlayerHUD().hp<=0))cancelBowCharge();
        if(heldBow.active)bowVisuals.setCharge?.(
          getBowChargeStatus(performance.now()-heldBow.startedAt));
        const heldSkill=chargedKeys.values().next().value;
        if(heldSkill && !window.__axeUiModalOpen &&
          !window.__axeServiceModeOpen && !window.__axeWorldMapOpen &&
          !window.__axePauseMenuOpen && !window.__axeDialogueOpen &&
          getPlayerHUD().hp>0) {
          const charge=getSkillChargeStatus(getSkillById(heldSkill.skillId),
            Date.now()-heldSkill.startAt);
          if(skillChargeHud.getAttribute('aria-valuenow')!==String(charge.percent)){
            skillChargeHud.setAttribute('aria-valuenow',String(charge.percent));
            skillChargeLabel.textContent=charge.full
              ?'ABILITY FULL · 100%': 'ABILITY CHARGE · '+charge.percent+'%';
            skillChargeFill.style.width=charge.percent+'%';
          }
          skillChargeHud.style.opacity='1';
        } else hideSkillCharge();
        bowVisuals.update(delta,{
          active:getActiveWeaponPath()==='ranged'&&!isMountedRef.current,
          blocked:entryModeRef.current||window.__axeUiModalOpen||
            window.__axeServiceModeOpen||window.__axeWorldMapOpen||
            window.__axePauseMenuOpen||window.__axeDialogueOpen,
        });
        stationRuntime.focusCamera(delta);
        // Sweep from character-front three-quarter portrait to real Game 2
        // follow camera, clipping against the same actual terrain geometry.
        if(entryCameraReleased)entryCamera.update(delta,{camera,model,clipAgainstTerrain:pose=>playerCameraSystem.clipAgainstTerrain(pose)});

        // Tornado turbulence: the camera trembles near the funnel and inside the
        // core, then steadies almost completely once you're up in the eye.
        if (tornadoRes.shake > 0.01) {
          const s = tornadoRes.shake * 0.22;
          const ts = performance.now() / 1000;
          camera.position.x += Math.sin(ts * 37.1) * s;
          camera.position.y += Math.sin(ts * 29.7) * s * 0.7;
          camera.position.z += Math.cos(ts * 41.3) * s;
        }

        // Camera shake (meteor impacts, crit jolts) — applied after the camera
        // system finalizes position so it never drifts (offset is recomputed
        // fresh each frame, same pattern as the tornado turbulence above).
        cameraShake.update(delta);

        // Boss telegraph warnings — ground circles/lines that fire after a delay.
        bossTelegraphs.update(delta, {
          player: model,
          groundY: model ? (sampleGroundY(model.position.x, model.position.z) ?? model.position.y) : 0,
        });

        // Boss combat dialogue — non-blocking banter queue (intro/callouts/
        // thresholds/outro). Shows one line at a time, auto-hides; never pauses
        // gameplay.
        bossDialogue.update(delta);

        // Boss encounter controller — ticks encounter phase + dialogue auto-clear.
        bossEncounter.update(delta);

        // World-boss special abilities are disabled for this build. The boss
        // remains present and continues its normal movement/animation only.
        // Move + animate each world boss (chase/wander/idle).
        updateBossMovement(delta, bossEntities, model, mapReady, sampleGroundY);
        quarryDragon?.update(delta);
        lakeStormDragon?.update(delta);

        // Clone town residents use the repaired imported town's own floor
        // and separate non-combat AI actor loop. Only publish React proximity
        // when its nearest resident changes, never 60 state writes/second.
        const townNeighbor=(!bossEncounter.isNPCSuppressed()&&npcsVisible)
          ?importedSpawnTown?.nearestResident(model.position):null;
        if(townNeighbor?.id!==nearbyTownResidentRef.current?.id){
          nearbyTownResidentRef.current=townNeighbor||null;
          setNearbyTownResident(townNeighbor?{
            id:townNeighbor.id,name:townNeighbor.name,role:townNeighbor.role,
          }:null);
        }
        // ─── NPC proximity & interaction (generic npcs array is empty) ───
        let closestNPC = null;
        // ─── Quest NPC proximity ───
        const npcSuppressed = bossEncounter.isNPCSuppressed();
        let closestQuestNPC = null;
        let closestQuestDist = NPC_INTERACT_RANGE;
        questNPCs.forEach((qn) => {
          if (qn.group) qn.group.visible = !npcSuppressed && npcsVisible;
          if (qn.mixer) qn.mixer.update(delta);
          if (npcSuppressed) return;
          const dx = qn.group.position.x - model.position.x;
          const dz = qn.group.position.z - model.position.z;
          const d = Math.sqrt(dx * dx + dz * dz);
          if (d < closestQuestDist) { closestQuestDist = d; closestQuestNPC = qn; }
          if (qn.ringMesh) qn.ringMesh.material.opacity = 0.4 + Math.sin(clock.elapsedTime * 2) * 0.2;
        });
        if (npcSuppressed) {
          if (nearbyQuestNPCRef.current) { nearbyQuestNPCRef.current = null; setNearbyQuestNPC(null); }
        } else if (closestQuestNPC?.id !== nearbyQuestNPCRef.current?.id) {
          nearbyQuestNPCRef.current = closestQuestNPC;
          setNearbyQuestNPC(closestQuestNPC ? { id: closestQuestNPC.id, name: closestQuestNPC.name } : null);
        }

        // ─── Living Quest NPC proximity ───
        if (livingQuestEntity?.group) {
          livingQuestEntity.group.visible = !npcSuppressed && npcsVisible;
          if (livingQuestEntity.mixer) livingQuestEntity.mixer.update(delta);
          if (npcSuppressed) {
            if (livingQuestNearRef.current) { livingQuestNearRef.current = false; setNearbyLivingQuest(false); }
          } else {
            const dxL = livingQuestEntity.group.position.x - model.position.x;
            const dzL = livingQuestEntity.group.position.z - model.position.z;
            const nearL = Math.sqrt(dxL * dxL + dzL * dzL) < NPC_INTERACT_RANGE;
            if (nearL !== livingQuestNearRef.current) { livingQuestNearRef.current = nearL; setNearbyLivingQuest(nearL); }
          }
        }

        if (interactPressed.current && livingQuestNearRef.current) {
          interactPressed.current = false;
          window.dispatchEvent(new CustomEvent('openLivingQuest'));
        }
        if (interactPressed.current) {
          interactPressed.current = false;
          // Prefer quest NPC if also nearby (they take priority over generic NPCs)
          if (closestQuestNPC) {
            const handoff = getAXENPCQuestHandoff({
              npcId: closestQuestNPC.id,
              playerLevel: playerLevelStateRef.current,
              questState: getQuestState(),
              factionId: getActiveCharacter()?.factionId || null,
            });
            if (handoff.quest) {
              setActiveQuestDialogue({ npcName: closestQuestNPC.name, ...handoff });
            } else {
              setActiveDialogue({
                name: closestQuestNPC.name,
                text: "I've nothing for you right now, traveler. Return when you've grown stronger.",
              });
            }
          } else if (townNeighbor) {
            const conversation=importedSpawnTown?.interactResident(model.position);
            if(conversation){
              // Ambient language may suggest work but cannot forge inventory
              // grants. Only the existing quest handoff validates a real quest
              // and the QuestDialogueBox's completion path can pay rewards.
              const handoff=conversation.questNpcId?getAXENPCQuestHandoff({
                npcId:conversation.questNpcId,
                playerLevel:playerLevelStateRef.current,
                questState:getQuestState(),
                factionId:getActiveCharacter()?.factionId||null,
              }):null;
              if(handoff?.quest&&
                (handoff.mode==='turn_in'||
                (conversation.questOffer&&handoff.mode==='offer'))){
                setActiveQuestDialogue({npcName:conversation.name,...handoff});
              }else{
                setActiveDialogue({name:conversation.name,text:conversation.text});
              }
            }
          } else if (closestNPC) {
            setActiveDialogue({ name: closestNPC.name, text: closestNPC.dialogue });
          }
        }

        zombieCamps?.update(delta,model.position);
        // ─── Enemy AI: wander state machine (walk ~3s → idle ~5s → repeat) ───
        enemies.forEach((enemy) => {
          // Dying enemies must keep processing so the death animation, fade-out
          // and removal actually run (combat sets alive=false at 0 HP).
          if (!enemy.alive && !enemy.dying) return;
          // Hide all non-boss entities off the map unless toggled on with '='.
          if (!enemy.isBoss) enemy.group.visible = npcsVisible && !(enemy.dying && enemy.deathFinalized);
          if (enemy.mixer) enemy.mixer.update(delta);

          // BOSS PATH — delegate to BossBrain (state machine + abilities + threat).
          // Bypasses wander/attack logic entirely; brain emits bossAction events.
          if (enemy.isBoss && enemy.brain) {
            if (enemy.dying) return;
            const localPos = { id: 'local_player', x: model.position.x, z: model.position.z, hp: getPlayerHUD().hp || 100, maxHp: getPlayerHUD().maxHP || 100, isLocal: true };
            enemy.brain.tick(delta, { players: [localPos], dt: delta });
            if (mapReady) {
              const gy = sampleGroundY(enemy.group.position.x, enemy.group.position.z);
              if (gy !== null) enemy.group.position.y = gy;
            }
            // Animation: walk when aiTarget set, idle otherwise
            if (enemy.aiTarget && enemy.walkAction && enemy.idleAction) {
              if (!enemy.walkAction.isRunning()) { enemy.idleAction.fadeOut(0.2); enemy.walkAction.reset().fadeIn(0.2).play(); }
            } else if (enemy.idleAction && enemy.walkAction) {
              if (!enemy.idleAction.isRunning()) { enemy.walkAction.fadeOut(0.2); enemy.idleAction.reset().fadeIn(0.2).play(); }
            }
            // Boss damage credit when hit by player → into threat table
            if (enemy.hitCooldown > 0) enemy.hitCooldown -= delta;
            return;
          }

          // Death/remote kill interrupts any advertised strike.
          if (enemy.dying) {
            enemyTelegraphs.clear(enemy);
            enemy.attacking = false;
            enemy.attackPlan = null;
            enemy.deathTimer += delta;
            if (enemy.deathTimer >= DEATH_FADE_DELAY) {
              const fadeT = Math.min(1, (enemy.deathTimer - DEATH_FADE_DELAY) / 0.8);
              enemy.tintMaterials.forEach(m => { m.transparent = true; m.opacity = 1 - fadeT; });
              // Death finalization must run even if a test entity was hidden.
              if (fadeT >= 1 && !enemy.deathFinalized) {
                enemy.deathFinalized = true;
                enemy.group.visible = false;
                if (enemy.mixer) enemy.mixer.stopAllAction();
                // Quest-spawned enemies die for good — remove the model from
                // the scene and free its memory. No respawn, no lingering body.
                if (enemy.isQuestSpawn) {
                  scene.remove(enemy.group);
                  enemy.group.traverse((c) => {
                    if (c.geometry) c.geometry.dispose?.();
                    if (c.material) {
                      const ms = Array.isArray(c.material) ? c.material : [c.material];
                      ms.forEach((m) => m?.dispose?.());
                    }
                  });
                  enemy.alive = false;
                  enemy.dying = false; // fully done — skip all further processing
                  enemy.respawnAt = null;
                }
                setEnemyCount(enemies.filter(e => e.alive && !e.dying).length);
              }
            }
            if (enemy.respawnAt && performance.now() >= enemy.respawnAt) {
              enemy.alive = true;
              enemy.dying = false; enemy.deathTimer = 0; enemy.respawnAt = null;
              enemy.deathFinalized = false;
              enemy.hp = enemy.maxHp; enemy.state = 'idle'; enemy.stateTimer = 0;
              enemy.aiEngaged = false; enemy.aiReturning = false;
              enemy.flankTimer = 0; enemy.flankCooldown = 0;
              enemy.attackPlan = null; enemy.combatStrikeSerial = 0;
              enemy.target = null; enemy.attacking = false; enemy.attackCooldown = 0; enemy.hitCooldown = 0;
              enemy.tintMaterials.forEach(m => { m.opacity = 1; m.transparent = false; });
              if (enemy.home && enemy.group) {
                enemy.group.position.set(enemy.home[0], enemy.home[1], enemy.home[2]);
                enemy.group.visible = true;
                if (mapReady) { const gy = sampleGroundY(enemy.group.position.x, enemy.group.position.z); if (gy !== null) enemy.group.position.y = gy; }
              }
              if (enemy.idleAction) enemy.idleAction.reset().fadeIn(0.2).play();
              setEnemyCount(enemies.filter(e => e.alive && !e.dying).length);
            }
            return;
          }

          // ─── Combat Foundation 2.4: live, single-loop PvE enemy intelligence ───
          // Hidden test entities never attack invisibly. Bosses and dungeon
          // enemies with their own brain continue through the earlier path.
          if (!npcsVisible || !enemy.group.visible) {
            enemyTelegraphs.clear(enemy);
            enemy.attacking = false;
            enemy.attackPlan = null;
            if (enemy.attackAction) enemy.attackAction.fadeOut(0.1);
            return;
          }
          const profile = combatEnemyProfile(enemy);
          enemy.attackCooldown = Math.max(0, (enemy.attackCooldown || 0) - delta);
          enemy.flankCooldown = Math.max(0, (enemy.flankCooldown || 0) - delta);
          enemy.flankTimer = Math.max(0, (enemy.flankTimer || 0) - delta);
          const distToPlayer = horizontalDistance(enemy.group.position, model.position);
          const homeDistance = enemyHomeDistance(enemy);
          const engaged = getPlayerHUD().hp > 0 && shouldEnemyEngage({
            playerDistance: distToPlayer, homeDistance,
            alerted: enemy.hitCooldown > 0, engaged: !!enemy.aiEngaged, profile,
          });
          if (engaged) {
            // A dodge that happened before this enemy noticed the player is
            // not an event this enemy can intelligently respond to.
            if (!enemy.aiEngaged) enemy.lastDodgeSequence = playerDodgeSequence;
            enemy.aiEngaged = true;
            enemy.aiReturning = false;
          } else if (enemy.aiEngaged) {
            enemy.aiEngaged = false;
            enemy.aiReturning = true;
            enemy.flankTimer = 0;
          }
          // Each enemy reacts to a *successful* local dodge once, and only
          // if sufficiently close. Reaction is a short grounded side-step,
          // not perfect prediction, infinite pursuit, or a teleport.
          if (enemy.aiEngaged && !enemy.attacking && distToPlayer <= 6 &&
              enemy.lastDodgeSequence !== playerDodgeSequence) {
            enemy.lastDodgeSequence = playerDodgeSequence;
            if (playerDodgeSequence > 0 && (enemy.flankCooldown || 0) === 0) {
              enemy.flankTimer = profile.flankSeconds;
              enemy.flankCooldown = 2.0;
              enemy.flankSide = [...String(enemy.id)].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 2 ? 1 : -1;
            }
          }
          if (enemy.aiEngaged && !enemy.attacking) {
            const dx = model.position.x - enemy.group.position.x;
            const dz = model.position.z - enemy.group.position.z;
            if (dx * dx + dz * dz > 0.0001) {
              const facing = new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(0, 1, 0), Math.atan2(dx, dz),
              );
              enemy.group.quaternion.slerp(facing, Math.min(1, 7 * delta));
            }
          }

          // C1's own melee-kick clip must accompany C1's attack; never
          // graft the generic mutant punch animation onto an Erika Archer rig.
          const attackClipForEnemy=enemy.wolfveilVisualSpawn||enemy.wolfveilZombieCampSpawn
            ?enemy.attackClip:cachedAttackClip;
          if (enemy.aiEngaged && distToPlayer <= profile.range &&
              !enemy.attacking && enemy.attackCooldown <= 0 &&
              attackClipForEnemy && enemy.mixer) {
            const plan = planEnemyStrike(enemy, model.position, profile);
            enemy.combatStrikeSerial = (enemy.combatStrikeSerial || 0) + 1;
            enemy.attackPlan = plan;
            enemy.attacking = true;
            enemy.attackWindupTimer = plan.windup;
            enemy.attackCooldown = plan.cooldown;
            // Fix the attack direction at the visible windup start. The player
            // may move *out* of the advertised cone before damage is resolved.
            enemy.group.rotation.y = plan.facingYaw;
            enemyTelegraphs.begin(enemy, plan);
            playActionSound('enemy_attack');
            enemy.walkAction?.fadeOut(0.1);
            enemy.runAction?.fadeOut(0.1);
            enemy.idleAction?.fadeOut(0.1);
            const atkAction = enemy.mixer.clipAction(attackClipForEnemy);
            atkAction.setLoop(THREE.LoopOnce);
            atkAction.clampWhenFinished = false;
            atkAction.reset().fadeIn(0.1).play();
            enemy.attackAction = atkAction;
          }

          if (enemy.attacking) {
            enemy.attackWindupTimer -= delta;
            if (enemy.attackWindupTimer <= 0) {
              const plan = enemy.attackPlan;
              const hitInWarning = plan && isWithinEnemyStrike({
                origin: enemy.group.position, target: model.position,
                facingYaw: plan.facingYaw,
                range: plan.range, arcDegrees: plan.arcDegrees,
              });
              // The existing damage resolver still owns accuracy, crit, block,
              // reflection and defense. The warning is a geometric *gate*,
              // not a new damage formula. Dodging during the hit prevents it.
              if (hitInWarning && !dodgeVanish.active &&
                  playerInvulTimer.current <= 0 && getPlayerHUD().hp > 0) {
                const playerDerived = getPlayerHUD().derived || playerDerivedRef.current;
                const attackDerived=enemy.wolfveilZombieCampSpawn
                  ?getAXEEnemyStats(zombieAttackLevel(enemy.level,getPlayerHUD().level),'normal')
                  :enemy.derived;
                const strike = resolveAXEStrikeOnHero(attackDerived, playerDerived, { fromBoss: false });
                if (strike.reflected > 0) {
                  enemy.hp -= strike.reflected;
                  spawnDamageFloat(enemy.id, strike.reflected);
                  playActionSound('enemy_hit');
                }
                let dmg = strike.kind === 'hit' ? strike.damage : 0;
                if (dmg > 0) {
                  const absorbed = absorbShield(dmg);
                  dmg = Math.max(0, dmg - absorbed);
                  if (dmg > 0) {
                    setHP(Math.max(0, getPlayerHUD().hp - dmg));
                    playerAnim?.requestHitReact();
                    playActionSound('player_hit');
                  }
                }
                playerInvulTimer.current = PLAYER_INVUL_AFTER_HIT;
              }
              enemyTelegraphs.clear(enemy);
              enemy.attacking = false;
              enemy.attackPlan = null;
              enemy.attackAction?.fadeOut(0.2);
              enemy.idleAction?.reset().fadeIn(0.2).play();
            }
            if (enemy.hitCooldown > 0) enemy.hitCooldown -= delta;
            return;
          }

          const returning = !!enemy.aiReturning;
          const destination = returning
            ? { x: enemy.home?.[0] ?? enemy.group.position.x,
                z: enemy.home?.[2] ?? enemy.group.position.z }
            : model.position;
          const destinationDistance = horizontalDistance(enemy.group.position, destination);
          if (returning && destinationDistance <= 0.65) {
            enemy.aiReturning = false;
            enemy.state = 'idle';
            enemy.stateTimer = 0;
          }
          const moving = returning
            ? destinationDistance > 0.65
            : enemy.aiEngaged && (distToPlayer > profile.range * 0.87 || enemy.flankTimer > 0);
          if (moving) {
            const fromX = enemy.group.position.x, fromZ = enemy.group.position.z;
            const flank = !returning && enemy.flankTimer > 0;
            const direction = enemyPursuitVector(enemy.group.position, destination, {
              flankSide: flank ? enemy.flankSide : 0,
              flankFactor: flank ? 0.85 : 0,
            });
            const step = Math.min(destinationDistance, profile.speed * Math.max(0, delta));
            const nextX = fromX + direction.x * step;
            const nextZ = fromZ + direction.z * step;
            const nextGround = sampleGroundY(nextX, nextZ);
            const fromHome = horizontalDistance({ x: nextX, z: nextZ },
              { x: enemy.home?.[0] ?? fromX, z: enemy.home?.[2] ?? fromZ });
            if (nextGround !== null && nextGround !== undefined &&
                (returning || fromHome <= profile.leashRange)) {
              enemy.group.position.x = nextX;
              enemy.group.position.z = nextZ;
              enemy.group.position.y = nextGround;
              forestBiome?.resolveCollision(enemy.group.position, 0.55);
              wolfveilVillage?.resolveBuildingCollision(enemy.group.position, 0.55, { x: fromX, z: fromZ });importedSpawnTown?.resolveCollision(enemy.group.position, { x: fromX, z: fromZ });
            }
            if (enemy.idleAction?.isRunning?.()) enemy.idleAction.fadeOut(0.2);
            const motionAction=enemy.aiEngaged&&!returning&&enemy.runAction
              ?enemy.runAction:enemy.walkAction;
            const previousAction=motionAction===enemy.runAction
              ?enemy.walkAction:enemy.runAction;
            if(previousAction?.isRunning?.())previousAction.fadeOut(0.2);
            if(motionAction&&!motionAction.isRunning())
              motionAction.reset().fadeIn(0.2).play();
            if (enemy.hitCooldown > 0) enemy.hitCooldown -= delta;
            return;
          }
          if (enemy.aiEngaged || enemy.aiReturning) {
            if (enemy.walkAction?.isRunning?.()) enemy.walkAction.fadeOut(0.2);
            if (enemy.runAction?.isRunning?.()) enemy.runAction.fadeOut(0.2);
            if (enemy.idleAction && !enemy.idleAction.isRunning()) {
              enemy.idleAction.reset().fadeIn(0.2).play();
            }
            if (enemy.hitCooldown > 0) enemy.hitCooldown -= delta;
            return;
          }

          // Out of combat, preserve the existing seeded zone wander behavior.
          enemy.stateTimer += delta;
          if (enemy.state === 'walk') {
            if (enemy.target) {
              const dx = enemy.target.x - enemy.group.position.x;
              const dz = enemy.target.z - enemy.group.position.z;
              const dist = Math.hypot(dx, dz);
              if (dist > 0.15) {
                const fromX = enemy.group.position.x, fromZ = enemy.group.position.z;
                const step = Math.min(dist, ENEMY_SPEED * delta);
                const nextX = fromX + dx / dist * step;
                const nextZ = fromZ + dz / dist * step;
                const ground = sampleGroundY(nextX, nextZ);
                if (ground !== null && ground !== undefined) {
                  enemy.group.position.set(nextX, ground, nextZ);
                  forestBiome?.resolveCollision(enemy.group.position, 0.55);
                  wolfveilVillage?.resolveBuildingCollision(enemy.group.position, 0.55, { x: fromX, z: fromZ });importedSpawnTown?.resolveCollision(enemy.group.position, { x: fromX, z: fromZ });
                }
                const faceQ = new THREE.Quaternion().setFromAxisAngle(
                  new THREE.Vector3(0, 1, 0), Math.atan2(dx, dz),
                );
                enemy.group.quaternion.slerp(faceQ, Math.min(1, 6 * delta));
              }
            }
            if (enemy.stateTimer >= ENEMY_WALK_TIME) {
              enemy.state = 'idle';
              enemy.stateTimer = 0;
              enemy.walkAction?.fadeOut(0.2);
              enemy.idleAction?.reset().fadeIn(0.2).play();
            }
          } else if (enemy.stateTimer >= ENEMY_IDLE_TIME) {
            enemy.state = 'walk';
            enemy.stateTimer = 0;
            pickWanderTarget(enemy);
            enemy.idleAction?.fadeOut(0.2);
            enemy.walkAction?.reset().fadeIn(0.2).play();
          } else {
            enemy.state = 'idle';
          }
          if (enemy.hitCooldown > 0) enemy.hitCooldown -= delta;
        });

        enemyTelegraphs.update(delta);

        // Tick player cooldowns + player attack
        if (playerAttackCooldown.current > 0) playerAttackCooldown.current -= delta;
        if (playerInvulTimer.current > 0) playerInvulTimer.current -= delta;
        const pendingSkillStrike = skillStrikeQueue.nextSkillStrike();
        // A click during cooldown should not abort the animation frame.
        const canProcessBasicStrike = attackPressed.current && playerAttackCooldown.current <= 0;
        if (attackPressed.current && !canProcessBasicStrike && !pendingSkillStrike) {
          if(rangedClickAttackPressed.current)bowVisuals.showNotice('COOLDOWN');
          attackPressed.current = false;
          rangedClickAttackPressed.current = false;
          pendingBowShotCharge=null;
        }
        if (canProcessBasicStrike || pendingSkillStrike) {
          // A skill strike consumes one queued skill hit. A simultaneous basic
          // click remains pending for a later frame instead of stealing its multiplier.
          const isSkillStrike = !!pendingSkillStrike;
          if (!isSkillStrike) attackPressed.current = false;
          const isRangedClickAttack = !isSkillStrike && rangedClickAttackPressed.current;
          const bowShot=isRangedClickAttack?pendingBowShotCharge:null;
          if(!isSkillStrike){
            rangedClickAttackPressed.current=false;
            pendingBowShotCharge=null;
          }
          const strikeMultiplier = isSkillStrike ? pendingSkillStrike.multiplier : 1;

          const activeDuel = typeof window !== 'undefined' ? window.__activeDuel : null;
          const activeWeaponPath = getActiveWeaponPath();
          // Charge only basic attack attempts, never each scheduled combo hit.
          // In duels, validate a locked opponent BEFORE spending the resource.
          const validDuelBasic = !activeDuel || validateLockedPvpTarget({
            attackerPosition: model.position,
            lockedTarget: lockOnTargetRef.current,
            activeDuel, weaponPath: activeWeaponPath,
          }).ok;
          const basicBudget = isSkillStrike || !validDuelBasic
            ? { ok: true }
            : spendCombatResource('basic');
          if (!basicBudget.ok) {
            showCombatNotice('Not enough stamina to attack');
            if(activeWeaponPath==='ranged')bowVisuals.showNotice('NO STAMINA');
          } else if (activeDuel) {
            const pvpCheck = validateLockedPvpTarget({
              attackerPosition: model.position,
              lockedTarget: lockOnTargetRef.current,
              activeDuel,
              weaponPath: activeWeaponPath,
            });

            if (!pvpCheck.ok) {
              showCombatNotice(pvpFailureMessage(pvpCheck, activeWeaponPath));
            } else {
              // PvP is strictly one locked target. No cones, cleaves, nearest-target
              // fallback, or collateral hits are allowed.
              if (!isSkillStrike) playerAttackCooldown.current = basicAttackCooldown(getAXEAttackSpeedMult(getPlayerHUD().derived));
              const montage = activeWeaponPath === 'ranged' ? 'attack' : 'kick';
              if (playerAnim?.HandleCombat) {
                playerAnim.HandleCombat(montage, {
                  combo: isSkillStrike, speed: getAXEAttackSpeedMult(getPlayerHUD().derived),
                  hitIndex: pendingSkillStrike?.hitIndex ?? 0,
                  heavy: /heavy_strike|crushing_blow/.test(pendingSkillStrike?.skillId || ''),
                });
              } else {
                playOneShot(montage, 1.4);
              }
              playSynchronizedSwing(activeWeaponPath, pendingSkillStrike?.skillId);
              weaponTrails.emit({
                actor: model, weaponPath: activeWeaponPath,
                hitIndex: pendingSkillStrike?.hitIndex ?? 0,
              });
              if(activeWeaponPath==='ranged'){
                const aimEnemy=lockOnTargetRef.current?.group?.position;
                bowVisuals.fire({
                  origin:model.position,
                  target:aimEnemy||cameraBowImpactPoint(camera,groundMeshes),
                });
              }
              window.dispatchEvent(new CustomEvent('duelAttack', {
                detail: {
                  targetPlayerId: pvpCheck.targetId,
                  lockedTargetId: lockOnTargetRef.current?.id || null,
                  distance: pvpCheck.distance,
                  weaponPath: activeWeaponPath,
                  skillMultiplier: strikeMultiplier,
                  source: isSkillStrike ? 'ability' : 'basic_attack',
                  // PvP damage remains server-resolved, with existing 3x cap.
                  // No client-provided shield bypass or guaranteed fatal roll.
                  ...(isSkillStrike ? { skillId: pendingSkillStrike.skillId,
                    castId: pendingSkillStrike.castId,
                    hitIndex: pendingSkillStrike.hitIndex } : {}),
                },
              }));
            }
          } else {
            const bowAimStartedAt=activeWeaponPath==='ranged'?performance.now():0;
            let bowAimTarget=activeWeaponPath==='ranged'
              ?selectCameraBowTarget({
                camera,origin:model.position,
                enemies:[...enemies,...(window.__gw3dRogues||[])],bosses:bossEntities,
                maxRange:BOW_PVE_RANGE,
                lockedEnemyId:lockOnTargetRef.current?.id,
                groundMeshes:otsCameraColliders(),
              }):null;
            if(bowAimTarget&&!isSkillStrike)bowAimTarget={
              ...bowAimTarget,chargeMultiplier:bowShot?.multiplier||1,
            };
            if(activeWeaponPath==='ranged')bowVisuals.noteAimTime(performance.now()-bowAimStartedAt);
            // The bridge and normal enemy damage use exactly this SAME resolved
            // hitbox; a second independent raycast must not select another AI.
            // Melee keeps its original synchronous priority resolution. Bow
            // resolution is delayed only until AFTER the shot tracer exists,
            // so a same-frame boss/rogue hit paints that exact tracer green.
            let attackConsumedByPriorityTarget = activeWeaponPath==='ranged'
              ? false : dispatchRogueAttack(playerDerivedRef, strikeMultiplier, bowAimTarget);
            // Basic swings use attack-speed timing. Timed skill combo hits
            // have their own scheduled spacing and bypass this basic cooldown.
            if (!isSkillStrike) playerAttackCooldown.current = basicAttackCooldown(getAXEAttackSpeedMult(getPlayerHUD().derived));
            // Attack montage is manually gated by the animation state machine.
            const montage = isRangedClickAttack || activeWeaponPath === 'ranged' ? 'attack' : 'kick';
            if (playerAnim?.HandleCombat) {
              playerAnim.HandleCombat(montage, {
                combo: isSkillStrike, speed: getAXEAttackSpeedMult(getPlayerHUD().derived),
                hitIndex: pendingSkillStrike?.hitIndex ?? 0,
                heavy: /heavy_strike|crushing_blow/.test(pendingSkillStrike?.skillId || ''),
              });
            } else {
              playOneShot(montage, 1.4);
            }
            playSynchronizedSwing(activeWeaponPath, pendingSkillStrike?.skillId);
            weaponTrails.emit({
              actor: model, weaponPath: activeWeaponPath,
              hitIndex: pendingSkillStrike?.hitIndex ?? 0,
            });
            if(activeWeaponPath==='ranged'){
              bowVisuals.fire({origin:model.position,
                target:bowAimTarget?.point||cameraBowImpactPoint(camera,otsCameraColliders(),BOW_PVE_RANGE)});
              // The hit event arrives synchronously and colors the just-fired
              // arrow. The bridge must never do its own separate target test.
              attackConsumedByPriorityTarget=dispatchRogueAttack(playerDerivedRef,strikeMultiplier,bowAimTarget);
            }
            // PvE bow target range matches the actual reticle trace. Duel
            // validation and its shorter authoritative weapon range stay as is.
            const attackRange = activeWeaponPath === 'ranged' ? BOW_PVE_RANGE :
              isRangedClickAttack || pendingSkillStrike?.weaponType === 'ranged'
                ? RANGED_ATTACK_RANGE : ENEMY_ATTACK_RANGE;
            const aoeRadius = isSkillStrike && !pendingSkillStrike.soulEcho
              ? Math.max(0, Number(pendingSkillStrike.aoeRadius) || 0) : 0;
            // Ranged single shots now resolve against the same small camera
            // dot that is drawn on screen, not the old 150-degree melee fan.
            // AoE skills preserve their original multi-target rules.
            const targetChoices = attackConsumedByPriorityTarget ? [] :
              activeWeaponPath==='ranged' && aoeRadius===0
              ?(bowAimTarget?[{target:bowAimTarget.target,
                distance:bowAimTarget.distance,locked:bowAimTarget.locked}]:[])
              :pickForwardCombatTargets({
              enemies, bosses: bossEntities, origin: model.position,
              yaw: model.rotation.y, maxRange: attackRange,
              radius: aoeRadius,
              lockedEnemyId: lockOnTargetRef.current?.id || pendingSkillStrike?.targetId || null,
              allowEdgeGrace: isSkillStrike,
            });
            // A failed selection is a real MISS, not a silent shot or a
            // fabricated hit. Boss/rogue outcomes come from their bridge.
            if(activeWeaponPath==='ranged'&&aoeRadius===0&&
               !attackConsumedByPriorityTarget&&targetChoices.length===0)
              bowVisuals.confirmMiss('MISS');
            // Single-target attacks pick only the leading foe in front of the
            // model; AoE may hit up to 12 living enemies in its radius.
            // Never select a remote player in this PvE path.
            for (const chosen of targetChoices) {
            const closestEnemy = chosen.target;
            const closestEnemyDist = chosen.distance;
          // One swing, one resolution (AXEStrikeRuntime; docs/game3d/BUILD_BALANCE.md): the hit roll,
          // the enemy's avoidance, crit, block, defense, and every build effect from the sheet. A
          // miss or a dodge shows MISS and spends no buff, charge or forced critical.
          const liveDerived = getPlayerHUD().derived || playerDerivedRef.current;
          const strike = closestEnemy ? resolveAXEHeroStrike(liveDerived, closestEnemy.derived, {
            skillMultiplier: strikeMultiplier, targetHp: closestEnemy.hp, targetMaxHp: closestEnemy.maxHp,
            tier: closestEnemy.isBoss ? 'boss' : closestEnemy.derived?.tier, distance: closestEnemyDist,
            chargedCritBonusPct: pendingSkillStrike?.chargedCritBonusPct || 0,
            chargedFatalBonusPct: pendingSkillStrike?.chargedFatalBonusPct || 0,
            defensePiercePct: pendingSkillStrike?.defensePiercePct || 0,
            criticalAllowed: pendingSkillStrike?.criticalAllowed !== false,
            // An attack executed while physically airborne qualifies for
            // Skyrend's aerial PvE set effect, not ordinary grounded attacks.
            isAerialAttack: !playerStateMachine.current.grounded ||
              !!pendingSkillStrike?.isAerialAttack || !!pendingSkillStrike?.aerial,
            isSkillStrike,
          }) : null;
          if (strike && strike.kind !== 'hit') {
            spawnDamageFloat(closestEnemy.id, 'MISS', { kind: 'miss' });
            if(activeWeaponPath==='ranged'&&aoeRadius===0)
              bowVisuals.confirmMiss(strike.kind==='dodge'?'DODGED':'MISS');
          }
          if (strike && strike.kind === 'hit') {
            // The hit, avoidance, block, crit and armor rules run ONCE before
            // archery's post-hit charge/headshot multiplier applies.
            const dmg=activeWeaponPath==='ranged'&&aoeRadius===0
              ?applyBowImpactDamage(strike.damage,{
                  chargeMultiplier:!isSkillStrike?bowShot?.multiplier||1:1,
                  headshot:!!bowAimTarget?.headshot,pve:true,
                })
              :strike.damage;
            const feedbackKind = feedbackKindFromStrike(strike);
            impactFeedback.hit(closestEnemy, {
              critical: feedbackKind === 'critical', lethal: feedbackKind === 'lethal',
            });

            const activeWeaponId = getActiveWeaponId();
            reportWeaponHit({ weaponId: activeWeaponId, damage: dmg, isCrit: strike.critical, isBoss: !!closestEnemy.isBoss });
            gainAXEBuddhaEssenceExperience('strength', Math.min(8, Math.max(1, Math.ceil(dmg / 40))));
            bankAXEAscensionDamage(dmg, { maxHP: liveDerived?.maxHP || 0 }); // Defensive Nature: 20% of the blow becomes a shield

            const appliedDamage=combatSystem.applyDamage(closestEnemy, dmg, {
              sourceId: closestEnemy.id,
              sound: selectCombatImpactSound({ kind: feedbackKind, hasSound: hasCombatSound }),
              crit: !!strike.critical, lethal: !!strike.lethal,
            });
            if(activeWeaponPath==='ranged'&&aoeRadius===0){
              if(appliedDamage>0)bowVisuals.confirmHit(appliedDamage);
              else bowVisuals.confirmMiss('MISS');
              if(appliedDamage>0&&bowAimTarget?.headshot)bowVisuals.showHeadshot?.(appliedDamage);
            }
            // Additional cutting texture triggers only after the existing
            // combat resolver actually reduces the enemy's HP.
            if(appliedDamage>0&&activeWeaponPath!=='ranged'&&!isRangedClickAttack)
              worldSoundscape.playImpact({melee:true,critical:!!strike.critical});

            // 12-piece endgame set reward: a distinct, non-critical 12%-of-damage
            // attack event, never a multiplicative boost to the hero's stat sheet.
            // Successful PvE strikes alone trigger it; it never procs recursively.
            const echoDamage = getAXEWeaponLegacyEchoDamage(dmg, getActiveEquippedAXEWeapon());
            const echoApplied = echoDamage > 0 && closestEnemy.hp > 0
              ? combatSystem.applyDamage(closestEnemy, echoDamage, {
                  sourceId: closestEnemy.id, sound: 'enemy_hit', crit: false, lethal: false,
                })
              : 0;
            if (echoApplied > 0) {
              reportWeaponHit({ weaponId: activeWeaponId, damage: echoApplied,
                isCrit: false, isBoss: !!closestEnemy.isBoss });
            }


            // life steal (the advanced class), capped on the sheet; heals from the damage dealt
            if (strike.lifeSteal > 0) {
              const hudNow = getPlayerHUD();
              setHP(Math.min(hudNow.maxHP || 1, (hudNow.hp || 0) + strike.lifeSteal));
            }

            // Boss threat credit — feeds the boss brain's aggro table.
            if (closestEnemy.isBoss && closestEnemy.brain) {
              closestEnemy.brain.recordDamage('local_player', dmg + echoApplied);
            }
            if (closestEnemy.hp <= 0) {
              playActionSound('enemy_death');
              // Artemis cinematic enemies are cosmetic until a trusted server
              // confirms identity, completion and rewards. Never progress local
              // character XP, gold, titles, mastery or other quests from them.
              const pendingCinematicHunt = closestEnemy.metadata?.questId === 'q_living_bleeding_moon'
                && closestEnemy.metadata?.rewardAuthority === 'server_pending';
              if (!pendingCinematicHunt && !closestEnemy.wolfveilZombieCampSpawn)
                reportWeaponKill(getActiveWeaponId());
              if (!pendingCinematicHunt && !window.__activeDuel && !closestEnemy.isBoss &&
                  (!isSkillStrike || !Number(pendingSkillStrike?.aoeRadius))) {
                const opportunity = killFlowCounter.grant({
                  killedId: closestEnemy.id, validKill: true,
                  critical: !!strike.critical, origin: model.position,
                  targets: enemies, chosen: !!getAXEAscensionProfile()?.ascended,
                  pvp: false, now: Date.now(),
                });
                if (opportunity) {
                  const nextEnemy = enemies.find(target => target.id === opportunity.targetId);
                  if (nextEnemy) {
                    lockOnTargetRef.current = nextEnemy;
                    clickToMove.cancel('kill_flow');
                    killFlowPursuit = { targetId: nextEnemy.id, until: opportunity.expiresAt };
                    showCombatNotice('COUNTER READY · Single or Three-Hit → ' + (nextEnemy.name || 'Next enemy'));
                    window.dispatchEvent(new CustomEvent('axeKillFlowReady', {
                      detail: { targetId: nextEnemy.id, expiresAt: opportunity.expiresAt,
                        criticalKill: opportunity.criticalKill },
                    }));
                  }
                }
              }
              // Lethal — start death sequence + broadcast kill to all peers so
              // every player sees this enemy die in real time. 10s respawn is
              // scheduled inside killEnemyLocal.
              closestEnemy.respawnAt = closestEnemy.isQuestSpawn ? null :
                performance.now() + (closestEnemy.wolfveilZombieCampSpawn ? 18000 : 10000);
              closestEnemy.dying = true;
              closestEnemy.deathTimer = 0;
              closestEnemy.hp = 0;
              if (closestEnemy.walkAction) closestEnemy.walkAction.fadeOut(0.15);
              if (closestEnemy.runAction) closestEnemy.runAction.fadeOut(0.15);
              if (closestEnemy.idleAction) closestEnemy.idleAction.fadeOut(0.15);
              // Preserve original model-specific admin death clip for C1.
              const deathClipForEnemy=closestEnemy.wolfveilZombieCampSpawn
                ?(closestEnemy.dyingClip || closestEnemy.deathClip)
                :closestEnemy.wolfveilVisualSpawn ? closestEnemy.deathClip : cachedDeathClip;
              if (deathClipForEnemy && closestEnemy.mixer) {
                const deathAction = closestEnemy.mixer.clipAction(deathClipForEnemy);
                deathAction.setLoop(THREE.LoopOnce);
                deathAction.clampWhenFinished = true;
                deathAction.reset().fadeIn(0.15).play();
                closestEnemy.deathAction = deathAction;
              }
              // Ambient Wolfveil creatures are real rendered/animated encounters,
              // but NOT a server-owned enemy seed yet. Do not let the local
              // browser mint rewards, quest credit, loot or peer kill claims.
              if(!closestEnemy.wolfveilVisualSpawn&&!closestEnemy.dungeonTrainingSpawn&&!closestEnemy.wolfveilZombieCampSpawn)
                broadcastEnemyKill(closestEnemy.id, { tier: closestEnemy.tier || closestEnemy.derived?.tier || 'normal', isBoss: !!closestEnemy.isBoss, enemyLevel: closestEnemy.derived?.level || closestEnemy.level || getPlayerHUD().level || 1, x: closestEnemy.group.position.x, y: closestEnemy.group.position.y, z: closestEnemy.group.position.z });
              if (!pendingCinematicHunt && !closestEnemy.wolfveilVisualSpawn && !closestEnemy.dungeonTrainingSpawn) {
                // Locally animated zombie kills award XP only. They cannot
                // claim unverified network kills, gold, mastery or quest credit.
                if(!closestEnemy.wolfveilZombieCampSpawn){
                  recordTitleKill(closestEnemy.isBoss ? 'boss' : (closestEnemy.tier === 'elite' || closestEnemy.tier === 'champion' ? 'elite' : 'normal'), 1);
                  addGold(closestEnemy.isBoss ? 250 : closestEnemy.tier === 'champion' ? 60 : closestEnemy.tier === 'elite' ? 30 : 15);
                }
                setScore(prev => prev + 100 * closestEnemy.xpReward);
              spawnXPFloat(closestEnemy.xpReward);
              awardCompanionXP(companionDefRef.current?.id, closestEnemy.xpReward);
              if(!closestEnemy.wolfveilZombieCampSpawn)
                reportEnemyKill(QUESTS, closestEnemy.tier);
              // Presentation-only combat hint. Does not change quest progress.
              window.dispatchEvent(new CustomEvent('echoLocalCombatMoment', {
                detail: { type: 'enemy_killed', tier: closestEnemy.tier || 'normal' },
              }));
              if (!pendingCinematicHunt && !closestEnemy.wolfveilZombieCampSpawn && (closestEnemy.metadata || closestEnemy.dungeonBoss)) {
                window.dispatchEvent(new CustomEvent('axeRuntimeEnemyDefeated', {
                  detail: {
                    enemyId: closestEnemy.id,
                    tier: closestEnemy.tier || 'normal',
                    isBoss: !!closestEnemy.isBoss,
                    dungeonBoss: !!closestEnemy.dungeonBoss,
                    metadata: closestEnemy.metadata ? { ...closestEnemy.metadata } : null,
                  },
                }));
              }
              // Award XP, handle level-ups against the custom curve.
              // Each level-up grants stat points (handled inside awardXP).
              const levelBeforeReward = playerLevelRef.current;
              let newXP = playerXPRef.current + closestEnemy.xpReward;
              let newLevel = playerLevelRef.current;
              let needed = xpForLevel(newLevel);
              let levelsGained = 0;
              while (newXP >= needed) {
                newXP -= needed;
                newLevel += 1;
                levelsGained += 1;
                needed = xpForLevel(newLevel);
              }
              // awardXP may grant extra rested XP levels. Read the persisted,
              // character-scoped progression after that calculation so the
              // world HUD and next enemy kill do not revert those levels.
              awardXP({ newLevel, newXP, xpForNext: xpForLevel(newLevel), levelsGained, xpGained: closestEnemy.xpReward });
              const hudProgression = getPlayerHUD();
              playerXPRef.current = hudProgression.xp;
              playerLevelRef.current = hudProgression.level;
              setPlayerXP(hudProgression.xp);
              setPlayerLevel(hudProgression.level);
              if (hudProgression.level > levelBeforeReward) playActionSound('level_up');
              } // Ordinary legacy client rewards; never for pending cinematic encounters.
            }
          }
            } // each forward target (one for basic/single; many only for AoE)
        }
      }
    }

      combatSystem.update(delta);
      tickSkillCooldowns(delta); tickLegacyAbilityCooldowns(delta); tickRegen(delta);
      tickCombatResources(delta);
      tickCompanionCooldowns(delta); tickBuffs(); tickFusion();
      applyFusionEffects(model, companionGroupRef.current, isMountedRef.current);
      if (companionAbilityPressed.current) { const abId = companionAbilityPressed.current; companionAbilityPressed.current = null; processCompanionAbilityPress({ abilityId: abId, scene, model, companionGroup: companionGroupRef.current, enemies, cachedDeathClip, companionDefId: companionDefRef.current?.id, playerXPRef, playerLevelRef, setScore, setPlayerXP, setPlayerLevel, spawnXPFloat, spawnDamageFloat, xpForLevel, awardXP, activeEffectsRef: activeEffects }); }

      // ─── Companion auto-combat AI ───
      // Auto-attacks the player's target with off-cooldown abilities, and
      // auto-heals when the player's HP drops low or they take recent damage.
      // Uses the exact same processCompanionAbilityPress() path as manual casts.
      tickCompanionAutoCombat({
        delta, scene, model, companionGroup: companionGroupRef.current,
        enemies, cachedDeathClip,
        companionDefId: companionDefRef.current?.id,
        playerXPRef, playerLevelRef,
        setScore, setPlayerXP, setPlayerLevel,
        spawnXPFloat, spawnDamageFloat, xpForLevel, awardXP,
        activeEffectsRef: activeEffects,
        isMounted: isMountedRef.current,
      });

      // ─── Update active visual effects (lightning etc.) ───
      activeEffects.current = activeEffects.current.filter((fx) => {
        fx.update(delta);
        return fx.alive();
      });

      // Menu transitions, death and PvP cancel held pulses immediately.
      if (window.__axeUiModalOpen || window.__axeServiceModeOpen ||
          window.__axeWorldMapOpen || window.__axePauseMenuOpen || window.__axeDialogueOpen || window.__activeDuel ||
          getPlayerHUD().hp <= 0) {
        for (const held of heldAOEKeys.values()) {
          window.dispatchEvent(new CustomEvent('axeAoeChannelStop',
            { detail: { token: held.token } }));
        }
        heldAOEKeys.clear();
      }
      // Master-rank AOE is held for 260ms to begin a real, bounded channel;
      // a quick tap still produces the original single AOE strike.
      if (!window.__activeDuel && getPlayerHUD().hp > 0 &&
          !window.__axeUiModalOpen && !window.__axeServiceModeOpen && !window.__axePauseMenuOpen && !window.__axeDialogueOpen) {
        for (const held of heldAOEKeys.values()) {
          if (!held.started && Date.now() - held.at >= AXE_AOE_CHANNEL.holdStartMs &&
              getLoadout().activeSlots[held.slotIndex] === held.skillId &&
              abilityKeyPressed.current === -1) {
            held.started = true;
            abilityKeyPressed.current = held.slotIndex;
            castInputMeta.current = { slotIndex: held.slotIndex, heldMs: 0,
              channelAOE: true, channelToken: held.token };
          }
        }
      }
            // ─── Ability firing (1..8 keys) ───
      // NEW PIPELINE: Input → loadoutStore → skillExecutor (validates weapon
      // lock, runs buff/attack via the new system). Falls back to the LEGACY
      // targeted-ability path ONLY for skills not yet in the new registry
      // (lightning_strike, shadow_teleport, frost_tornado — kept verbatim).
      if (abilityKeyPressed.current !== -1 && model) {
        const slotIndex = abilityKeyPressed.current; abilityKeyPressed.current = -1;
        const inputMeta = castInputMeta.current?.slotIndex === slotIndex
          ? castInputMeta.current : { heldMs: 0 };
        castInputMeta.current = null;
        const loadout = getLoadout();
        const newSkillId = loadout.activeSlots[slotIndex];
        const newCooldown = loadout.cooldowns[slotIndex];

        // Try new system first.
        if (newSkillId && newCooldown <= 0) {
          const skill = getSkillById(newSkillId);
          const activeDuel = typeof window !== 'undefined' ? window.__activeDuel : null;
          let canCast = true;

          // In PvP, every offensive weapon skill is single-target and requires
          // the opponent to be explicitly locked and inside that weapon's range.
          // Self buffs remain self-cast and do not require a target.
          if (activeDuel && skill?.skill_type === SKILL_TYPE.ACTIVE_ATTACK) {
            const weaponPath = getActiveWeaponPath();
            const pvpCheck = validateLockedPvpTarget({
              attackerPosition: model.position,
              lockedTarget: lockOnTargetRef.current,
              activeDuel,
              weaponPath,
            });
            canCast = pvpCheck.ok;
            if (!canCast) showCombatNotice(pvpFailureMessage(pvpCheck, weaponPath));
          }

          if (canCast) {
            const chain = chargedFinisherWindow && canAcceptFinisherChain(
              chargedFinisherWindow, Date.now(), skill,
              lockOnTargetRef.current?.id || null,
            ) ? chargedFinisherWindow : null;
            // One unique receipt per cast, shared by its scheduled hit events.
            // No sensitive stats, claimed mastery, or client multiplier sent
            // to the duel server to register the cast.
            const duelCastId = activeDuel && skill?.skill_type === 'ACTIVE_ATTACK'
              ? `axe${Date.now().toString(36)}_${Math.random().toString(36).slice(2,12)}`
              : null;
            const counterCastAt = Date.now();
            const killOffer = !activeDuel && inputMeta.counterOpportunityId
              ? killFlowCounter.peek(counterCastAt) : null;
            const nextCounterTarget = killOffer && enemies.find(target =>
              target.id === killOffer.targetId);
            const counterReady = isKillFlowCastEligible({
              opportunity: killOffer, opportunityId: inputMeta.counterOpportunityId,
              target: nextCounterTarget, lockedTarget: lockOnTargetRef.current,
              origin: model?.position, family: skillCombatFamily(skill),
              now: counterCastAt, maxRange: ENEMY_ATTACK_RANGE + 0.5,
              pvp: !!activeDuel, playerAlive: getPlayerHUD().hp > 0,
            });
            const result = castSkill(newSkillId, { // at the skill's mastery level (skillMasteryStore)
              maxHP: getHUDForSkill().maxHP || 100,
              slotIndex,
              targetId: lockOnTargetRef.current?.id || null,
              castId: duelCastId,
              heldMs: inputMeta.heldMs,
              counterInstant: counterReady,
              channelAOE: !activeDuel && inputMeta.channelAOE === true,
              channelToken: inputMeta.channelToken || null,
              isPvp: !!activeDuel,
              specializationId: getActiveCharacter()?.combatSpecialization || 'standard',
              chainFrom: chain?.skillId || null,
              chainReadyAtMs: chain?.finalHitAtMs || null,
              // The world owns its combat ledger. Other standalone skill callers
              // retain their old behavior until they opt into this gate.
              canSpendCombatResource,
              spendCombatResource,
            });
            if (result.ok) {
              if (activeDuel && newSkillId === 'aegis_shield') {
                window.dispatchEvent(new CustomEvent('axeDuelShieldCast', {
                  detail: { duelId: activeDuel.duelId },
                }));
              }
              if (duelCastId) window.dispatchEvent(new CustomEvent('axeDuelSkillCast', {
                detail: { castId: duelCastId, skillId: newSkillId,
                  chargeId: inputMeta.chargeId || null,
                  chainFromCastId: chain?.castId || null,
                  weaponPath: getActiveWeaponPath(), duelId: activeDuel.duelId },
              }));
              if (chain) chargedFinisherWindow = null;
              if (counterReady) {
                const consumed = killFlowCounter.consume({
                  opportunityId: killOffer.id, targetId: nextCounterTarget.id,
                  family: skillCombatFamily(skill), now: counterCastAt,
                  inRange: counterReady, targetAlive: nextCounterTarget.alive === true,
                  pvp: !!activeDuel,
                });
                if (consumed) {
                  killFlowPursuit = null;
                  showCombatNotice('KILL FLOW · Instant charged ' +
                    (skillCombatFamily(skill) === 'single' ? 'Single' : 'Three-Hit'));
                }
              }
              startSkillCooldown(slotIndex);
              // Current Game 3D skills do not all report a live Chi balance.
              // A successful combat skill cast therefore counts as spiritual
              // activity even for builds whose Chi display is capacity-only.
              gainAXEBuddhaEssenceExperience('spirit', 3);
            }
          }
        }

        // Legacy targeted abilities still live on abilityStore for now.
        const abState = getAbilityState();
        const entry = abState.equipped[slotIndex]; const cooldownLeft = abState.cooldowns[slotIndex];
        if (entry && cooldownLeft <= 0 && !newSkillId) {
          const abId = typeof entry === 'string' ? entry : entry.id;
          const ab = ABILITY_DEFINITIONS.find((a) => a.id === abId);
          const target = abState.target;
          if (ab && target) {
            const activeDuel = typeof window !== 'undefined' ? window.__activeDuel : null;

            if (activeDuel) {
              const weaponPath = getActiveWeaponPath();
              const pvpCheck = validateLockedPvpTarget({
                attackerPosition: model.position,
                lockedTarget: lockOnTargetRef.current,
                activeDuel,
                weaponPath,
              });

              if (!pvpCheck.ok) {
                showCombatNotice(pvpFailureMessage(pvpCheck, weaponPath));
              } else {
                // Legacy abilities also use the shared one-cast resource budget.
                const paid = spendCombatResource('skill', { skill_type: 'ACTIVE_ATTACK', hit_count: 1 });
                if (!paid.ok) {
                  showCombatNotice(paid.reason === 'not_enough_will' ? 'Not enough Will' : 'Not enough stamina');
                } else {
                // Legacy PvP abilities are converted to one locked-target hit.
                // Their old enemy AOE/nearest-target paths never execute in PvP.
                startLegacyAbilityCooldown(slotIndex);
                window.dispatchEvent(new CustomEvent('duelAttack', {
                  detail: {
                    targetPlayerId: pvpCheck.targetId,
                    lockedTargetId: lockOnTargetRef.current?.id || null,
                    distance: pvpCheck.distance,
                    weaponPath,
                    damageOverride: Math.max(1, Number(ab.pvpDamage || ab.damage || 10)),
                    source: 'ability',
                    abilityId: ab.id,
                  },
                }));
                }
              }
            } else {
              const paid = spendCombatResource('skill', { skill_type: 'ACTIVE_ATTACK', hit_count: 1 });
              if (!paid.ok) {
                showCombatNotice(paid.reason === 'not_enough_will' ? 'Not enough Will' : 'Not enough stamina');
              } else {
              startLegacyAbilityCooldown(slotIndex);
              castLegacyTargetedAbility({
                ab, target, enemies, scene, model,
                activeEffectsRef: activeEffects,
                playActionSound, spawnDamageFloat, spawnXPFloat,
                getPlayerHUD, playerDerivedRef, cachedDeathClip,
                awardCompanionXP, companionDefRef, reportEnemyKill, QUESTS,
                setScore, setPlayerXP, setPlayerLevel, awardXP,
                playerXPRef, playerLevelRef, xpForLevel,
                clearTarget, updateTargetHP, getAbilityState,
              });
              }
            }
          }
        }
      }

      // ─── Project enemy world positions → screen-space for HP bars (throttled) ───
      uiFrameCounter++;
      // The HUD radar tracks ACTUAL living dungeon actors, not a static spawn
      // plan. Throttle snapshots independently of the combat/AI frame loop.
      if((region===LUNAR_CAVE_REGION||region===ASTRAL_DUNGEON_REGION) && performance.now()-lastDungeonMapSync>=220){
        lastDungeonMapSync=performance.now();
        publishLunarCaveMapEnemies(enemies.filter(e=>e.alive&&!e.dying&&e.group).map(e=>({
          id:e.id,x:e.group.position.x,z:e.group.position.z,level:e.level,
          tier:e.tier,name:e.bossName||'Dungeon monster',
        })));
      }
      if (uiFrameCounter % 3 === 0) {
        const w = container.clientWidth;
        const h = container.clientHeight;
        const ui = [];
        const tmpVec = new THREE.Vector3();
        enemies.forEach((enemy) => {
          if (!enemy.alive || enemy.dying || !enemy.group) return;
          if (!npcsVisible && !enemy.isBoss) return;
          // Position above head — model height ~1.7, scaled
          tmpVec.set(enemy.group.position.x, enemy.group.position.y + 2.2, enemy.group.position.z);
          tmpVec.project(camera);
          const inView = tmpVec.z > -1 && tmpVec.z < 1 && Math.abs(tmpVec.x) < 1.2 && Math.abs(tmpVec.y) < 1.2;
          if (!inView) return;
          ui.push({
            id: enemy.id,
            x: (tmpVec.x * 0.5 + 0.5) * w,
            y: (-tmpVec.y * 0.5 + 0.5) * h,
            hp: enemy.hp,
            maxHp: enemy.maxHp,
            level: enemy.level,
            name: enemy.bossName || (enemy.tier ? `${enemy.tier.charAt(0).toUpperCase() + enemy.tier.slice(1)} Enemy` : 'Enemy'),
          });
        });
        setEnemiesUI(ui);

        // Prefer an active dungeon boss for the floating boss HUD while inside
        // a dungeon; otherwise preserve the original world-boss HUD behavior.
        const dungeonBossForUI = bossEntities.find((b) =>
          b?.dungeonBoss && b.alive && !b.dying && !b.defeated && b.group?.visible
        );
        const encounterId=bossEncounter.getState().bossId;
        const engagedBoss=bossEntities.find(b=>b.id===encounterId &&
          b.alive && !b.dying && !b.defeated);
        const nearestBoss=bossEntities
          .filter(b=>b.alive&&!b.dying&&!b.defeated&&b.group?.visible)
          .sort((a,b)=>{
            const p=model?.position||{x:0,z:0};
            const da=Math.hypot(a.group.position.x-p.x,a.group.position.z-p.z);
            const db=Math.hypot(b.group.position.x-p.x,b.group.position.z-p.z);
            return da-db;
          })[0];
        setBossHeadUI(projectBossHead(
          dungeonBossForUI||engagedBoss||nearestBoss,camera,w,h));

        // ─── Project quest NPC heads → screen-space for floating "QUEST" labels ───
        const qs = getQuestState();
        const lvl = playerLevelStateRef.current;
        const qUI = [];
        if (bossEncounter.isNPCSuppressed() || !npcsVisible) { setQuestNPCsUI([]); } else
        questNPCs.forEach((qn) => {
          if (!qn.group) return;
          // Same choice as E-interaction; check all objectives, flags and
          // prerequisites before drawing a marker. No client reward or claim.
          const handoff = getAXENPCQuestHandoff({
            npcId: qn.id,
            playerLevel: lvl,
            questState: qs,
            factionId: getActiveCharacter()?.factionId || null,
          });
          const status = handoff.mode === 'offer' ? 'available' : handoff.mode;
          if (!status) return;
          tmpVec.set(qn.group.position.x, qn.group.position.y + 2.4, qn.group.position.z);
          tmpVec.project(camera);
          const inView = tmpVec.z > -1 && tmpVec.z < 1 && Math.abs(tmpVec.x) < 1.2 && Math.abs(tmpVec.y) < 1.2;
          if (!inView) return;
          qUI.push({
            id: qn.id,
            x: (tmpVec.x * 0.5 + 0.5) * w,
            y: (-tmpVec.y * 0.5 + 0.5) * h,
            status,
          });
        });
        setQuestNPCsUI(qUI);

        // ─── Sync live target HP to abilityStore ───
        const currentTarget = getAbilityState().target;
        if (currentTarget) {
          const te = enemies.find((e) => e.id === currentTarget.id);
          if (te && te.alive && !te.dying) {
            updateTargetHP(te.id, Math.max(0, te.hp));
          } else if (!te || !te.alive || te.dying) {
            clearTarget();
          }
        }

        // ─── Project floating damage / XP numbers to screen space ───
        const nowMs = performance.now();
        // Drop expired floats (>1.1s)
        floatsRef.current = floatsRef.current.filter((f) => nowMs - f.born < 1100);
        const projected = [];
        floatsRef.current.forEach((f) => {
          let wx, wy, wz;
          if (f.enemyId === 'player') {
            wx = model.position.x;
            wy = model.position.y + 2.6;
            wz = model.position.z;
          } else {
            const en = enemies.find((e) => e.id === f.enemyId);
            if (!en || !en.group) return;
            wx = en.group.position.x;
            wy = en.group.position.y + 2.4;
            wz = en.group.position.z;
          }
          tmpVec.set(wx, wy, wz);
          tmpVec.project(camera);
          if (tmpVec.z < -1 || tmpVec.z > 1) return;
          projected.push({
            id: f.id,
            x: (tmpVec.x * 0.5 + 0.5) * w,
            y: (-tmpVec.y * 0.5 + 0.5) * h,
            value: f.value,
            type: f.type,
            kind: f.kind,
            hits: f.hits,
            born: f.born,
          });
        });
        setFloats(projected);

        const cg = companionGroupRef.current;
        const cs = companionStatsRef.current;
        if (cg) { window.__localCompanionPos = { x: cg.position.x, y: cg.position.y, z: cg.position.z, yaw: cg.rotation.y }; }
        if (cg && cs && !isMountedRef.current && npcsVisible) {
          tmpVec.set(cg.position.x, cg.position.y + 2.4, cg.position.z); tmpVec.project(camera);
          const iv = tmpVec.z > -1 && tmpVec.z < 1 && Math.abs(tmpVec.x) < 1.2 && Math.abs(tmpVec.y) < 1.2;
          setCompanionUI(iv ? { x: (tmpVec.x * 0.5 + 0.5) * w, y: (-tmpVec.y * 0.5 + 0.5) * h, hp: cs.hp, maxHp: cs.maxHp, level: cs.level } : null);
        } else { setCompanionUI(null); }

        // Project player head → screen for floating name tag
        if (model && !isMountedRef.current) {
          tmpVec.set(model.position.x, model.position.y + 2.6, model.position.z); tmpVec.project(camera);
          const ivP = tmpVec.z > -1 && tmpVec.z < 1 && Math.abs(tmpVec.x) < 1.2 && Math.abs(tmpVec.y) < 1.2;
          setPlayerNameUI(ivP ? { x: (tmpVec.x * 0.5 + 0.5) * w, y: (-tmpVec.y * 0.5 + 0.5) * h } : null);
        } else { setPlayerNameUI(null); }
        // Project remote-player heads → mic icons + capture feet projections for duel markers
        const rmUI = []; const rmFeet = {};
        const rm = remoteManagerRef.current?.getRemotes?.();
        if (rm) rm.forEach((r, pid) => {
          if (!r.group) return;
          tmpVec.set(r.group.position.x, r.group.position.y + 2.6, r.group.position.z); tmpVec.project(camera);
          if (tmpVec.z > -1 && tmpVec.z < 1 && Math.abs(tmpVec.x) < 1.2 && Math.abs(tmpVec.y) < 1.2) rmUI.push({ id: pid, x: (tmpVec.x * 0.5 + 0.5) * w, y: (-tmpVec.y * 0.5 + 0.5) * h });
          tmpVec.set(r.group.position.x, r.group.position.y + 0.05, r.group.position.z); tmpVec.project(camera);
          if (tmpVec.z > -1 && tmpVec.z < 1) rmFeet[pid] = { x: (tmpVec.x * 0.5 + 0.5) * w, y: (-tmpVec.y * 0.5 + 0.5) * h };
        });
        setRemoteMicUI(rmUI);
        let lf = null; if (model) { tmpVec.set(model.position.x, model.position.y + 0.05, model.position.z); tmpVec.project(camera); if (tmpVec.z > -1 && tmpVec.z < 1) lf = { x: (tmpVec.x * 0.5 + 0.5) * w, y: (-tmpVec.y * 0.5 + 0.5) * h }; }
        window.__duelFeetPositions = { local: lf, remotes: rmFeet };

        // Sync live boss state → bossStore
        bossEntities.forEach((b) => { updateBoss(b.id, { x: b.group.position.x, z: b.group.position.z, hp: Math.max(0, b.hp), maxHp: b.maxHp, alive: b.alive && !b.dying }); });
      }

      impactFeedback.update(delta, camera); // short-lived presentation only
      duelDefenseFeedback.update(delta, camera); // confirmed PvP defense only
      weaponTrails.update(delta); // after the normal character pose
      avatarDrawCalls?.update(); // after everything that poses the avatar this frame
      // Light bone gestures run after the base animation pose, with no input lock.
      echoGestureRuntime.update();
      // A real inventory-backed GLB bow follows the active Adam/Eve hand.
      // It yields to the existing mounted weapon renderer when riding.
      if (model && heldBowPlayer !== model) {
        heldBowPresentation?.dispose();
        heldBowPlayer = model;
        heldBowPresentation = createEquippedBowGLBPresentation({ player: model });
      }
      heldBowPresentation?.update({ item: getActiveEquippedAXEWeapon(), mounted: !!isMountedRef.current });
      // Seat and hand constraints win over base clips, gestures and recoil.
      if (isMountedRef.current && model && companionGroupRef.current) {
        if (mountedRiderPlayer !== model || mountedRiderMount !== companionGroupRef.current) {
          mountedWeapon?.dispose();
          mountedRider?.restore();
          mountedRiderPlayer = model;
          mountedRiderMount = companionGroupRef.current;
          mountedRider = createMountedRiderPose({ player: model,
            mount: mountedRiderMount, definition: companionDefRef.current });
          mountedWeapon = createMountedWeaponPresentation({ player: model });
        }
        mountedAttackSeconds = Math.max(0, mountedAttackSeconds - delta); mountedRider.update({ weaponHand: mountedAttackSeconds > 0 });
        const equippedWeapon = mountedAttackSeconds > 0 ? getActiveEquippedAXEWeapon() : null; // both hands hold the mount unless attacking
        mountedWeapon.update({ item: equippedWeapon,
          family: inferAXEMasteryWeaponId(equippedWeapon) });
        mountAppearanceSeconds = Math.max(0, mountAppearanceSeconds - delta);
        if (!dodgeVanish.active) model.visible = mountAppearanceSeconds === 0;
      } else if (mountedRider) {
        restoreMountedRider();
      }
      waterContact?.update(delta,modelRef.current?.position,envSystem.getState());
      // Spatial ambience follows world metres, not terrain tiles. Each track
      // fades separately and remembers its playback position if inaudible.
      const soundPos=modelRef.current?.position;
      if(soundPos){
        if(region==='wolfveil'){
          // The actual Wolfveil river is authored at local Z; only once add
          // the existing +70 world transform used by the visible river mesh.
          const riverRaw=wolfveilDistanceToRiver(soundPos.x,soundPos.z-70),riverDistance=Math.max(0,riverRaw-10);
          worldSoundscape.setBed('ambience_water_flow',{ // half the old level on the bank, up to 20% more once in the water
            distance:riverDistance,near:3,far:105,power:1.7,volume:.325*(1+.2*Math.max(0,Math.min(1,(12-riverRaw)/7))),
            policy:'duck',duckVolume:.75,fadeSeconds:.65,
          });
          const waterfallDistance=Math.hypot(
            soundPos.x-LUNAR_CAVE_ENTRANCE.x,soundPos.z-LUNAR_CAVE_ENTRANCE.z);
          worldSoundscape.setBed('ambience_waterfall',{
            distance:waterfallDistance,near:10,far:105,volume:.24,
            policy:'duck',duckVolume:.75,fadeSeconds:.9,
          });
          // Wind / non-combat world beds pause during battle then resume at
          // their preserved currentTime, like the existing music transport.
          worldSoundscape.setBed('ambience_wind',{
            volume:.035,policy:'pause',fadeSeconds:1.3,
          });
        }else if(region===LUNAR_CAVE_REGION){
          const lakeDistance=Math.hypot(
            soundPos.x-LUNAR_CAVE_WATER_END.x,soundPos.z-LUNAR_CAVE_WATER_END.z);
          worldSoundscape.setBed('ambience_water_flow',{
            distance:lakeDistance,near:6,far:105,volume:.52,
            policy:'duck',duckVolume:.72,fadeSeconds:.8,
          });
          worldSoundscape.setBed('ambience_cave_drips',{
            distance:lakeDistance,near:8,far:90,volume:.38,
            policy:'duck',duckVolume:.75,fadeSeconds:1.1,
          });
          worldSoundscape.setBed('ambience_cave',{
            volume:.25,policy:'pause',fadeSeconds:1.2,
          });
        }
        setOutdoorNatureBed(worldSoundscape,region); // Wolfveil + forest: calm nature bed
      }
      worldSoundscape.update(delta,{inCombat:isInCombat(),muted:entryModeRef.current});
      // Fused characters' faces follow the moment: fierce in combat, relaxed (still blinking) otherwise.
      const playerFace=faceMoodsFor(modelRef.current);
      if(playerFace){const fighting=isInCombat();playerFace.setMood(fighting?'fierce':'neutral',fighting?.85:1);playerFace.update(Math.min(delta,.1));}
      const activeCamera=window.__axeTileInspectionCamera?.worldId === 'game3d'
        ? window.__axeTileInspectionCamera.camera : camera;
      atomicLook?.update(delta,modelRef.current?.position,envSystem.getState());
      if(!atomicLook?.render(activeCamera))inkLook.render(scene,activeCamera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
      inkLook.setSize();
      atomicLook?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      flushCheckpoint();
      window.removeEventListener('pagehide', flushCheckpoint);
      window.removeEventListener('game3dCheckpointFlush', flushCheckpoint);
      checkpointTeleporterRef.current = null;
      heldBowPresentation?.dispose();
      heldBowPresentation = null;
      heldBowPlayer = null;
      restoreMountedRider();
      companionAssetDisposed = true;
      companionSecondaryRig?.dispose();
      companionSecondaryRig=null;
      ++companionAssetVersion;
      unsubCompanionAsset();
      container.removeEventListener('pointerdown',unlockWorldSound);
      window.removeEventListener('keydown',unlockWorldSound);
      worldSoundscape.dispose();
      gameEventSounds.dispose();
      if(region===LUNAR_CAVE_REGION||region===ASTRAL_DUNGEON_REGION) clearLunarCaveMapEnemies();
      window.removeEventListener('echoGestureObserved', onEchoGestureObserved);
      window.removeEventListener('axeChargedFinisherWindow', onChargedFinisherWindow);
      chargedKeys.clear();
      echoGestureRuntime.dispose();
      stationRuntime.dispose();
      impactFeedback.dispose();
      window.removeEventListener('axeDuelDefenseResolved', onDuelDefenseResolved);
      duelDefenseFeedback.dispose();
      if(window.__gw3dBowOccluders===bowOccluders)
        window.__gw3dBowOccluders=null;
      window.removeEventListener('game3dVerifiedBowHit',onBowVerifiedHit);
      window.removeEventListener('game3dVerifiedBowMiss',onBowVerifiedMiss);
      if(window.__axe3dBowShotStats===bowVisuals.stats)window.__axe3dBowShotStats=null;
      bowVisuals.dispose();
      weaponTrails.dispose();
      enemyTelegraphs.dispose();
      avatarLoadDisposed=true;
      creatureSource.dispose();
      wolfveilEnemySource?.dispose();
      haloVisualRuntime?.dispose?.();
      haloVisualRuntime = null;
      fusionVisualRuntime?.dispose?.();
      fusionVisualRuntime = null;
      ascensionVisualRuntime?.dispose?.();
      ascensionVisualRuntime = null;
      ascendedGearVisualRuntime?.dispose?.();
      ascendedGearVisualRuntime = null;
      armorEquipSync?.dispose();
      armorEquipSync = null;
      avatarDrawCalls?.dispose();
      if (window.__gw3dAvatarDrawCalls === avatarDrawCalls) window.__gw3dAvatarDrawCalls = null;
      avatarDrawCalls = null;
      modelRef.current = null;
      // Mark guard disposed FIRST so any in-flight animate() bails before
      // touching the renderer — prevents the null.trim shadow-map crash.
      rendererGuard.markDisposed();
      cancelAnimationFrame(frameId);
      rendererGuard.dispose();
      window.removeEventListener('graphicsSettingsChanged', onGraphicsSettings);
      window.removeEventListener('game3dDedicatedMode',onDedicatedMode);
      window.removeEventListener('game3dDedicatedPose',onDedicatedPose);
      atomicLook?.dispose();
      if(window.__gw3dAtomicLook===atomicLook)window.__gw3dAtomicLook=null;
      inkLook.dispose(); if (window.__gw3dInkLook === inkLook) window.__gw3dInkLook = null;
      clearInterval(weatherInterval);
      window.removeEventListener('axeNearbyRespawnQuery', onNearbyRespawnQuery);
      window.removeEventListener('playerRespawn', onPlayerRespawn);
      respawnShrines?.dispose();
      window.removeEventListener('axeWorldMapOpened', clearWorldMapMovement);
      window.removeEventListener('axeDialogueOpened', clearWorldMapMovement);
      window.removeEventListener('axePauseMenuOpened', clearWorldMapMovement);
      window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur',onInputBlur);
      if (document.pointerLockElement === renderer.domElement)
        document.exitPointerLock?.();
      window.removeEventListener('mouseup', onMouseUp); window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('resize', handleResize);
      window.removeEventListener('playerSkillStrike', handlePlayerSkillStrike);
      for (const held of heldAOEKeys.values()) {
        window.dispatchEvent(new CustomEvent('axeAoeChannelStop',
          { detail: { token: held.token } }));
      }
      window.dispatchEvent(new CustomEvent('playerSkillCastCancel'));
      heldAOEKeys.clear();
      chargedKeys.clear();
      cancelBowCharge();
      hideSkillCharge();
      skillChargeHud.remove();
      killFlowCounter.reset();
      skillStrikeQueue.clear();
      window.removeEventListener('axeMountForceDismount', handleForceDismount);
      window.removeEventListener('playerSkillCastStart', handlePlayerSkillCastStart);
      window.removeEventListener('axeAerialSkillCast', handleAXEAerialSkillCast);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('contextmenu', onContext);
      window.removeEventListener('webrtcRemoteAction', handleRemoteAction);
      detachBossBus();
      resetCompanionAutoCombat();
      charLights.dispose();
      clickToMove.cancel('teardown');
      clickMoveMarker.dispose();
      tornado.dispose();
      if (window.__tornado === tornado) window.__tornado = null;
      envSystem.dispose();
      forestBiome?.dispose();
      waterContact?.dispose();
      quarryDragon?.dispose();
      lakeStormDragon?.dispose();
      vortexLake?.dispose();
      if(window.__gw3dVortexLake===vortexLake)window.__gw3dVortexLake=null;
      livingInkWorld?.dispose();
      livingMeadow?.dispose();
      zombieCamps?.dispose();
      if(window.__gw3dZombieCamps===zombieCamps)window.__gw3dZombieCamps=null;
      importedSpawnTown?.dispose();
      ambientBirds?.dispose();
      wolfveilVillage?.dispose();
      lunarGate?.dispose();
      astralGate?.dispose();
      lunarDungeon?.dispose();
      astralDungeon?.dispose();
      if(!wolfveilVillage&&!lunarDungeon&&!astralDungeon){
        scene.remove(grassGround);
        grassGround.geometry.dispose();
        grassGround.material.dispose(); // releases the locally generated pigment texture too
      }
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      renderer.dispose();
      stopLoopSound('player_walk');
      if (remoteManagerRef.current) { remoteManagerRef.current.dispose(); remoteManagerRef.current = null; }
      remoteCompanionManager.dispose();
      // Slice C — clear scene refs
      if (window.exportGame3DMap === exportLiveGame3DMap) window.exportGame3DMap = null;
      if (window.__gw3dScene === scene) window.__gw3dScene = null;
      if (window.__gw3dCamera === camera) window.__gw3dCamera = null;
      if (window.__gw3dRenderer === renderer) window.__gw3dRenderer = null;
      if (window.__axeTileInspectionSampleGroundY === sampleTileGroundY) window.__axeTileInspectionSampleGroundY = null;
      window.__gw3dLegacyRemoteManager = null;
      if (window.__gw3dEnemies === enemies) window.__gw3dEnemies = null;
      if (window.__gw3dBosses === bossEntities) window.__gw3dBosses = null;
      window.dispatchEvent(new CustomEvent('gw3dSceneTeardown'));
    };
  }, [avatarConfig.model_url]);

  // Wolfveil is already mounted behind character select; Play does not remount
  // the renderer. Apply the chosen checkpoint on that existing world as well.
  useEffect(() => {
    if (!entryMode && resumeCheckpoint?.region === region)
      checkpointTeleporterRef.current?.(resumeCheckpoint);
  }, [entryMode, resumeCheckpoint, region]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {/* Download links are presented in a separate modal after capture;
          each needs a real user click to satisfy browser download policy. */}
      {!entryMode && !loading && (
        <div className="absolute bottom-4 right-4 z-[80] max-w-[min(300px,85vw)]"
          onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
          <button type="button" disabled={mapExportState==='exporting'}
            className="rounded-xl border border-cyan-300/60 bg-slate-950/85 px-4 py-2 text-xs font-semibold text-cyan-100 backdrop-blur-xl disabled:opacity-60 hover:bg-cyan-950/95"
            onClick={async e=>{
              e.stopPropagation();setMapExportError('');setMapExportState('exporting');
              try{
                if(typeof window.exportGame3DMap!=='function')
                  throw Error('Map scene exporter is not ready. Enter Wolfveil and try again.');
                await window.exportGame3DMap({download:true});
                setMapExportState('ready');
              }catch(error){
                setMapExportError(error?.message||'Map export failed');
                setMapExportState('error');
              }
            }}>
            {mapExportState==='exporting'?'Preparing map files…':'Export full map · GLB + code'}
          </button>
          {mapExportState==='error' && <p role="alert"
            className="mt-2 rounded-md bg-slate-950/95 p-2 text-xs text-amber-200">
            {mapExportError}
          </p>}
        </div>
      )}
      {!entryMode&&(armorLayerError||avatarConfig.game3d_armor_visual_warnings?.length>0)&&(
        <div role="status" aria-live="polite"
          className="absolute bottom-28 left-3 z-[22] max-w-[min(360px,82vw)] rounded-lg border border-amber-300/35 bg-slate-950/85 px-3 py-2 text-xs text-amber-100 pointer-events-none">
          Equipped armor cannot be displayed: {String(armorLayerError||
            avatarConfig.game3d_armor_visual_warnings?.join(' · ')||'').slice(0,220)}
        </div>
      )}{!entryMode && <OTSAimReticle />}
      {!entryMode && import.meta.env.DEV && <WorldTileEditor worldId="game3d" title="Game 3D · World Terrain"
        bounds={region === 'wolfveil' ? WOLFVEIL_TILE_BOUNDS : ARENA_TILE_BOUNDS} tileSize={5}
        describeTile={region === 'wolfveil' ? describeWolfveilTile : undefined}
        getWorld={() => ({
          scene: window.__gw3dScene,
          canvas: window.__gw3dRenderer?.domElement,
          playerPosition: window.__localPlayerPos,
          sampleHeight: window.__axeTileInspectionSampleGroundY,
        })}/>}



      {!entryMode && <>
      {/* Enemy HP bars (liquid-glass) — projected above each enemy's head */}
      {!loading && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {enemiesUI.map((e) => (
            <EnemyHealthBar key={e.id} x={e.x} y={e.y} hp={e.hp} maxHp={e.maxHp} level={e.level} name={e.name} visible />
          ))}
          {/* World boss HP tank — projected above the boss's head */}
          {bossHeadUI && (
            <BossHeadHPTank
              x={bossHeadUI.x}
              y={bossHeadUI.y}
              name={bossHeadUI.name}
              level={bossHeadUI.level}
              hp={bossHeadUI.hp}
              maxHp={bossHeadUI.maxHp}
              hpTanks={bossHeadUI.hpTanks}
              hpTankSize={bossHeadUI.hpTankSize}
            />
          )}
          {/* Companion HP bar above pet's head (when not mounted) */}
          {companionUI && (
            <CompanionHealthBar x={companionUI.x} y={companionUI.y} hp={companionUI.hp} maxHp={companionUI.maxHp} level={companionUI.level} name={companionDefRef.current?.name || 'Companion'} visible />
          )}
          {/* Player name floating above the player character's head */}
          {playerNameUI && playerName && (
            <PlayerNameTag x={playerNameUI.x} y={playerNameUI.y} name={playerName} title={playerTitleDisplay} visible />
          )}
          {/* Liquid-glass mic indicators — above local player when on, and above remote talkers */}
          {playerNameUI && localMicOn && <VoiceMicIndicator x={playerNameUI.x} y={playerNameUI.y} visible />}
          {remoteMicUI.map((r) => talkingPeers[r.id] && (
            <VoiceMicIndicator key={r.id} x={r.x} y={r.y} visible />
          ))}
          {/* Floating "QUEST" labels above quest NPCs */}
          {questNPCsUI.map((q) => (
            <QuestFloatingLabel key={q.id} x={q.x} y={q.y} status={q.status} />
          ))}
          {/* Floating damage & XP numbers */}
          <FloatingDamageNumbers entries={floats} />
        </div>
      )}



      {/* Companion mount prompt */}
      <div className="axe-service-combat-overlays">
      {!loading && (
        <CompanionMountHUD
          nearby={nearbyCompanion}
          mounted={isMounted}
          companionName={companionDefRef.current?.name || 'Companion'}
        />
      )}

      {/* Local AI town residents: same E-interact action as existing quests. */}
      {!loading && nearbyTownResident && !nearbyQuestNPC &&
        !activeDialogue && !activeQuestDialogue && (
        <div className="absolute left-1/2 bottom-52 -translate-x-1/2 px-3 py-1.5 rounded-full bg-[#0c1923]/85 backdrop-blur-md border border-amber-200/35 pointer-events-none">
          <div className="flex items-center gap-2 text-xs text-stone-100">
            <span className="px-1.5 py-0.5 rounded bg-amber-200/15 border border-amber-200/40 font-mono">E</span>
            <span>Talk to <span className="text-amber-100 font-semibold">{nearbyTownResident.name}</span></span>
          </div>
        </div>
      )}
      {/* NPC interact prompt (generic NPCs) */}
      {!loading && nearbyNPC && !nearbyQuestNPC && !nearbyTownResident && !activeDialogue && !activeQuestDialogue && (
        <div className="absolute left-1/2 bottom-52 -translate-x-1/2 px-5 py-2.5 rounded-full bg-black/70 backdrop-blur-md border border-cyan-400/50 pointer-events-none">
          <div className="flex items-center gap-2 text-sm text-white">
            <span className="px-2 py-0.5 rounded bg-cyan-500/30 border border-cyan-400/40 font-mono text-xs">E</span>
            <span>Talk to <span className="text-cyan-300 font-semibold">{nearbyNPC.name}</span></span>
          </div>
        </div>
      )}

      {!loading && <LivingQuestWorldOverlay labelPos={livingQuestUI} nearby={nearbyLivingQuest} suppress={!!activeQuestDialogue || !!activeDialogue} />}

      {/* Quest NPC interact prompt (golden) */}
      {!loading && nearbyQuestNPC && !activeQuestDialogue && !activeDialogue && (
        <div
          className="absolute left-1/2 bottom-52 -translate-x-1/2 px-5 py-2.5 rounded-full pointer-events-none"
          style={{
            background: 'rgba(15, 20, 30, 0.7)',
            backdropFilter: 'blur(14px) saturate(160%)',
            WebkitBackdropFilter: 'blur(14px) saturate(160%)',
            border: '1px solid rgba(250, 204, 21, 0.5)',
            boxShadow: '0 4px 18px rgba(250, 204, 21, 0.25)',
          }}
        >
          <div className="flex items-center gap-2 text-sm text-white">
            <span className="px-2 py-0.5 rounded bg-yellow-500/25 border border-yellow-400/40 font-mono text-xs text-yellow-200">E</span>
            <span>Speak with <span className="text-yellow-300 font-semibold">{nearbyQuestNPC.name}</span></span>
          </div>
        </div>
      )}

      {/* Quest dialogue box */}
      </div>
      {activeQuestDialogue && (
        <QuestDialogueBox
          npcName={activeQuestDialogue.npcName}
          quest={activeQuestDialogue.quest}
          mode={activeQuestDialogue.mode}
          progress={activeQuestDialogue.progress}
          objectiveProgress={activeQuestDialogue.objectiveProgress}
          onAccept={() => {
            const q = activeQuestDialogue.quest;
            const accepted = acceptQuest(q.id, q);
            if (!accepted?.ok) {
              setActiveQuestDialogue(null);
              return;
            }
            playActionSound('quest_accept');
            // Spawn the required enemies on the map so the player can fight them
            if (spawnQuestEnemiesRef.current && q.spawnCount) {
              spawnQuestEnemiesRef.current({
                count: q.spawnCount,
                tierName: q.spawnTier || 'normal',
                playerPos: window.__localPlayerPos || { x: 0, z: 0 },
              });
            }
            setActiveQuestDialogue(null);
          }}
          onDecline={() => setActiveQuestDialogue(null)}
          onClose={() => setActiveQuestDialogue(null)}
          onClaim={() => {
            const q = activeQuestDialogue.quest;
            const completed = completeQuest(q.id, q);
            if (!completed?.ok) {
              setActiveQuestDialogue((current) => current ? { ...current, mode: 'in_progress' } : current);
              return;
            }
            // Milestone unlocks, contribution, reputation and future reward hooks
            grantQuestReward(q);
            // Pay the reward: XP + stat points
            const rewardXP = Math.max(0, Number(q.reward?.xp) || 0);
            const rewardPoints = Math.max(0, Number(q.reward?.points) || 0);
            const levelBeforeReward = playerLevelRef.current;
            let newXP = playerXPRef.current + rewardXP;
            let newLevel = playerLevelRef.current;
            let needed = xpForLevel(newLevel);
            let levelsGained = 0;
            while (newXP >= needed) {
              newXP -= needed;
              newLevel += 1;
              levelsGained += 1;
              needed = xpForLevel(newLevel);
            }
            // The progression store can add rested bonus XP, which may cross
            // additional level thresholds beyond the base quest reward.
            // Sync refs/UI from that final result, not the pre-bonus estimate.
            awardXP({
              newLevel,
              newXP,
              xpForNext: xpForLevel(newLevel),
              levelsGained,
              bonusPoints: rewardPoints,
              xpGained: rewardXP,
            });
            const hudProgression = getPlayerHUD();
            playerXPRef.current = hudProgression.xp;
            playerLevelRef.current = hudProgression.level;
            setPlayerXP(hudProgression.xp);
            setPlayerLevel(hudProgression.level);
            playActionSound('quest_complete');
            if (hudProgression.level > levelBeforeReward) playActionSound('level_up');
            setActiveQuestDialogue(null);
          }}
        />
      )}

      {/* Dialogue box */}
      {activeDialogue && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-[160px] w-[600px] max-w-[90%] rounded-xl bg-black/80 backdrop-blur-md border border-cyan-400/40 p-5 z-[9999]">
          <div className="text-cyan-300 font-bold text-sm tracking-wider uppercase mb-2">{activeDialogue.name}</div>
          <div className="text-white/90 text-sm leading-relaxed mb-3">{activeDialogue.text}</div>
          <button
            onClick={() => setActiveDialogue(null)}
            className="px-4 py-1.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-bold tracking-wider uppercase transition-all"
          >
            Close
          </button>
        </div>
      )}

      {/* I now opens Inventory / Gear inside the unified C Character Hub. */}

      {/* Milestone quest unlock announcements (abilities / class changes) */}
      <QuestRewardToast />

      {/* Event-driven notification trio — live messages, level ups, and earned quests. */}
      {!loading && <Game3DLunarNotifications environmentSystem={envSystem} />}

      {/* Day/night + season + weather HUD */}
      {!loading && envSystem && <WorldEnvironmentHUD system={envSystem} />}
      <PlayerInteractionMenu
        open={!!playerMenu}
        x={playerMenu?.x || 0}
        y={playerMenu?.y || 0}
        player={playerMenu?.target}
        kind={playerMenu?.kind || 'player'}
        onClose={() => setPlayerMenu(null)}
        onAction={(action, p) => {
          if (playerMenu?.kind === 'mount') {
            window.dispatchEvent(new CustomEvent('game3dMountAction',
              { detail:{ action, companionId:p.id, region } }));
            return;
          }
          window.dispatchEvent(new CustomEvent('gamePlayerAction', { detail: { action, playerId: p.id, playerName: p.name, contextType: questNPCSuppressed ? 'boss' : 'exploration', region } }));
        }}
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
            <span className="text-white/70 text-sm tracking-wider">Loading world...</span>
          </div>
        </div>
      )}</>}
    </div>
  );
}