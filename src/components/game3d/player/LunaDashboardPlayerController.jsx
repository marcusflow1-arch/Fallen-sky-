import * as THREE from 'three';
import { blocksBowMovement, shouldBlendBowFootwork } from './BowMovementRules.mjs';
import { PLAYER_AFK_DELAY_SECONDS } from './playerNativeAnimationClips';
import { UPLOADED_PLAYER_ACTIONS, PLAYER_IDLE_VARIANTS, PLAYER_DEATH_ACTIONS, resolvePlayerAnimationKey } from './playerAnimationActions.mjs';
import {GAME3D_MOBILITY_SECONDS,fitGame3DMobilityTiming} from './game3dMobilityTiming.mjs';

const STATES = {
  IDLE: 'idle',
  AFK: 'afk',
  COMBAT_IDLE: 'combatIdle',
  RUN: 'run',
  SPRINT: 'sprint',
  WALK: 'walk',
  RUN_STOP: 'runStop',
  RUN_BACK: 'runBack',
  DRAW_ARROW: 'drawArrow',
  MELEE_ATTACK: 'meleeAttack',
  MELEE_COMBO_2: 'meleeCombo2',
  MELEE_COMBO_3: 'meleeCombo3',
  HEAVY_ATTACK: 'heavyAttack',
  HIT_REACT: 'hitReact',
  DODGE_RIGHT: 'dodgeRight',
  DODGE_LEFT: 'dodgeLeft',
  DODGE_FORWARD: 'dodgeForward',
  DODGE_BACKWARD: 'dodgeBackward',
  DIVE_FORWARD: 'diveForward',
  JUMP_START: 'jumpStart',
  JUMP_LOOP: 'jumpLoop',
  JUMP_LAND: 'jumpLand',
  ROLL: 'roll',
  AIM_WALK_RIGHT: 'aimWalkRight',
  AIM_WALK_LEFT: 'aimWalkLeft',
  AIM_WALK_FORWARD: 'aimWalkForward',
  AIM_WALK_BACKWARD: 'aimWalkBackward',
};

const LOOP_STATES = new Set([
  STATES.IDLE, STATES.AFK, STATES.COMBAT_IDLE, STATES.WALK, STATES.RUN, STATES.SPRINT, STATES.RUN_BACK, STATES.JUMP_LOOP,
  STATES.AIM_WALK_RIGHT, STATES.AIM_WALK_LEFT, STATES.AIM_WALK_FORWARD, STATES.AIM_WALK_BACKWARD,
  ...UPLOADED_PLAYER_ACTIONS.filter(action => action.loop).map(action => action.key),
]);

const ONE_SHOT_DURATION = {
  [STATES.RUN_STOP]: 0.28,
  [STATES.DRAW_ARROW]: 0.32,
  [STATES.MELEE_ATTACK]: 0.36,
  [STATES.MELEE_COMBO_2]: 0.38,
  [STATES.MELEE_COMBO_3]: 0.40,
  [STATES.HEAVY_ATTACK]: 0.48,
  [STATES.HIT_REACT]: 0.24,
  [STATES.DODGE_RIGHT]: GAME3D_MOBILITY_SECONDS.dodgeRight,
  [STATES.DODGE_LEFT]: GAME3D_MOBILITY_SECONDS.dodgeLeft,
  [STATES.DODGE_FORWARD]: GAME3D_MOBILITY_SECONDS.dodgeForward,
  [STATES.DODGE_BACKWARD]: GAME3D_MOBILITY_SECONDS.dodgeBackward,
  [STATES.DIVE_FORWARD]: 0.68,
  [STATES.JUMP_START]: 0.24,
  [STATES.JUMP_LAND]: 0.22,
  [STATES.ROLL]: GAME3D_MOBILITY_SECONDS.roll,
};

const DODGE_STATE_BY_DIRECTION = {
  right: STATES.DODGE_RIGHT,
  left: STATES.DODGE_LEFT,
  forward: STATES.DODGE_FORWARD,
  backward: STATES.DODGE_BACKWARD,
};

export function createLunaDashboardPlayerController({ mixer, oneShotRef }) {
  const actions = {};
  let currentState = null;
  let previousMoving = false;
  let lastMovement = { moving: false, running: false, direction: 'forward', aiming: false };
  let isBusy = false;
  // Only the ranged release/recoil montage may overlap real locomotion.
  let bowAttackAllowsMovement = false;
  let isAiming = false;
  let isBlocking = false;
  let equipment = { weaponType: 'unarmed', equipped: false };
  let pendingEquipmentTransition = null;
  let idleVariantIndex = 0;
  let externallyAirborne = false;
  let blendTransition = null;
  let isDead = false;
  let isMounted = false;
  let idleStartedAt = null;
  let busyResetAt = 0;
  let specialMoveVelocity = null;
  let specialMoveTimer = 0;
  let lastAttackAt = -Infinity;
  let jumpOffset=0;
  let jumpVelocity=0;
  let jumpPhase=null;
  let jumpPhaseSeconds=0;
  const GRAVITY=18;
  const JUMP_SPEED=5.4;

  const ATTACK_STATES = new Set([
    STATES.DRAW_ARROW, STATES.MELEE_ATTACK, STATES.MELEE_COMBO_2,
    STATES.MELEE_COMBO_3, STATES.HEAVY_ATTACK,
    'kick', 'punch', 'aimRecoil',
  ]);
  const now = () => performance.now() / 1000;
  const hasAction = (state) => !!actions[resolvePlayerAnimationKey(state)];
  const isIdleVariant = state => PLAYER_IDLE_VARIANTS.includes(state);
  const isDeathState = state => PLAYER_DEATH_ACTIONS.includes(state);
  const durationFor = (state, speed = 1) => Math.max(0.01, (actions[state]?.getClip().duration || ONE_SHOT_DURATION[state] || 0.3) / speed);
  const advanceBlend = (sampleTime = mixer.time) => {
    if (!blendTransition) return;
    const { target, weights, startedAt, duration } = blendTransition;
    const amount = duration > 0 ? THREE.MathUtils.clamp((sampleTime - startedAt) / duration, 0, 1) : 1;
    for (const [action, weight] of weights) action.setEffectiveWeight(action === target
      ? weight + (1 - weight) * amount : weight * (1 - amount));
    if (amount === 1) {
      for (const action of weights.keys()) if (action !== target) action.stop();
      blendTransition = null;
    }
  };

  const playState = (state, options = {}) => {
    state = resolvePlayerAnimationKey(state);
    if ((isDead && !isDeathState(state)) || isMounted || !hasAction(state)) return false;
    if (!options.force && currentState === state) return true;
    const nextAction = actions[state];
    const previousAction = currentState ? actions[currentState] : null;
    advanceBlend();
    if (![STATES.IDLE, STATES.AFK, 'idleArmed', ...PLAYER_IDLE_VARIANTS].includes(state)) idleStartedAt = null;
    // Two semantic states can share a fallback clip. Changing the state must
    // not rewind that action or crossfade it against itself.
    if (previousAction === nextAction && !options.force) {
      currentState = state;
      return true;
    }
    // Keep every contributing pose in the same normalized transition. A→B→C
    // or A→B→A must never leave residual weight to the original bind/T-pose.
    const weights = new Map();
    let totalWeight = 0;
    for (const action of new Set(Object.values(actions))) {
      if (!action.isScheduled()) continue;
      const weight = action.getEffectiveWeight();
      if (weight > 0) { weights.set(action, weight); totalWeight += weight; }
    }
    for (const [action, weight] of weights) {
      action.enabled = true;
      action.stopFading().setEffectiveWeight(weight / totalWeight);
      weights.set(action, weight / totalWeight);
    }
    if (!weights.has(nextAction)) weights.set(nextAction, totalWeight > 0 ? 0 : 1);
    nextAction.enabled = true;
    nextAction.stopFading().setEffectiveWeight(weights.get(nextAction));
    nextAction.setEffectiveTimeScale(options.timeScale || 1);
    if (LOOP_STATES.has(state)) {
      nextAction.setLoop(THREE.LoopRepeat, Infinity);
      nextAction.clampWhenFinished = false;
    } else {
      nextAction.setLoop(THREE.LoopOnce, 1);
      nextAction.clampWhenFinished = state !== STATES.DRAW_ARROW;
    }
    const phase = previousAction && LOOP_STATES.has(currentState) && LOOP_STATES.has(state)
      && /^(?:run|walk|aimWalk|sprint)/.test(currentState) && /^(?:run|walk|aimWalk|sprint)/.test(state)
      ? previousAction.time / Math.max(0.001, previousAction.getClip().duration) : null;
    nextAction.reset().play();
    if (phase !== null && !options.resetPhase) nextAction.time = phase * nextAction.getClip().duration;
    blendTransition = { target: nextAction, weights, startedAt: mixer.time, duration: options.fade ?? 0.16 };
    advanceBlend();
    currentState = state;
    return true;
  };

  const combatMovementState = (direction) => {
    if (direction === 'backward' && hasAction(STATES.AIM_WALK_BACKWARD)) return STATES.AIM_WALK_BACKWARD;
    if (direction === 'left' && hasAction(STATES.AIM_WALK_LEFT)) return STATES.AIM_WALK_LEFT;
    if (direction === 'right' && hasAction(STATES.AIM_WALK_RIGHT)) return STATES.AIM_WALK_RIGHT;
    if (hasAction(STATES.AIM_WALK_FORWARD)) return STATES.AIM_WALK_FORWARD;
    return direction === 'backward' && hasAction(STATES.RUN_BACK) ? STATES.RUN_BACK : STATES.RUN;
  };

  const movementStateFor = ({ moving, running, sprinting, direction, aiming, blocking }) => {
    if (blocking && hasAction('block')) return 'block';
    if (blocking && hasAction(STATES.COMBAT_IDLE)) return STATES.COMBAT_IDLE;
    if (externallyAirborne && hasAction('fallLoop')) return 'fallLoop';
    if (!moving) {
      if (aiming && hasAction('aimOverdraw')) return 'aimOverdraw';
      if (aiming && hasAction(STATES.COMBAT_IDLE)) return STATES.COMBAT_IDLE;
      if (!aiming && !blocking && idleStartedAt !== null && now() - idleStartedAt >= PLAYER_AFK_DELAY_SECONDS) {
        const variants = PLAYER_IDLE_VARIANTS.filter(hasAction);
        if (variants.length) return variants[idleVariantIndex++ % variants.length];
        if (hasAction(STATES.AFK)) return STATES.AFK;
      }
      if (equipment.equipped && hasAction('idleArmed')) return 'idleArmed';
      return STATES.IDLE;
    }
    if (aiming) return combatMovementState(direction);
    if (sprinting && hasAction(STATES.SPRINT)) return STATES.SPRINT;
    const suffix = { backward: 'Back', left: 'Left', right: 'Right' }[direction] || '';
    const directional = `${running ? 'run' : 'walk'}${suffix}`;
    if (hasAction(directional)) return directional;
    if (!running && hasAction(STATES.WALK)) return STATES.WALK;
    if (direction === 'backward' && hasAction(STATES.RUN_BACK)) return STATES.RUN_BACK;
    return STATES.RUN;
  };

  const resetBusy = () => {
    isBusy = false;
    bowAttackAllowsMovement = false;
    busyResetAt = 0;
    jumpPhase=null;
    specialMoveTimer=0;
    specialMoveVelocity=null;
    if (oneShotRef) oneShotRef.current = false;
    if (pendingEquipmentTransition) {
      const transition = pendingEquipmentTransition;
      pendingEquipmentTransition = null;
      if (playMontage(transition, { equipmentContext: false })) return;
    }
    handleMovement(lastMovement);
  };

  const handleMovement = ({ moving = lastMovement.moving, running = lastMovement.running, sprinting = false, direction = lastMovement.direction, aiming = isAiming, blocking = isBlocking } = {}) => {
    const wasRunning = lastMovement.running;
    lastMovement = { moving: !!moving, running: !!running || !!sprinting, sprinting: !!sprinting, direction, aiming: !!aiming, blocking: !!blocking };
    if (currentState === STATES.RUN_STOP && moving) { isBusy = false; busyResetAt = 0; if (oneShotRef) oneShotRef.current = false; }
    if (isDead || isMounted) return;
    if (isBusy) {
      // A bow release may keep its short recoil pose while the PLAYER ROOT
      // still walks. After 120ms, the normal aim-walk/strafe clip resumes.
      if (shouldBlendBowFootwork({
        bowAttackActive: bowAttackAllowsMovement,
        moving, elapsedSeconds: now() - lastAttackAt,
      })) {
        const footwork = movementStateFor({ ...lastMovement, aiming:true });
        if (currentState !== footwork) playState(footwork, { fade:0.12 });
      }
      return;
    }
    if (isIdleVariant(currentState) && !moving && !aiming && !blocking) return;
    if (moving || aiming || blocking) idleStartedAt = null;
    else if (idleStartedAt === null) idleStartedAt = now();
    if (previousMoving && wasRunning && !moving && hasAction(STATES.RUN_STOP) && !aiming && !blocking) {
      previousMoving = false;
      isBusy = true;
      busyResetAt = now() + durationFor(STATES.RUN_STOP);
      if (oneShotRef) oneShotRef.current = true;
      playState(STATES.RUN_STOP, { force: true, fade: 0.12 });
      return;
    }
    previousMoving = !!moving;
    playState(movementStateFor(lastMovement), { fade: 0.16 });
  };

  const bindClips = (clipsByKey = {}) => {
    const previousState = currentState;
    const previousAction = actions[previousState];
    const previousDuration = previousAction?.getClip().duration || 0;
    const previousProgress = previousDuration > 0 ? previousAction.time / previousDuration : 0;
    const previousSpeed = previousAction?.getEffectiveTimeScale() || 1;
    // Async uploads replace the initial native/fallback binding. Old actions
    // must release their tracks, including an active generated roll or jump.
    for (const action of new Set(Object.values(actions))) action.stop();
    blendTransition = null;
    for (const key of Object.keys(actions)) delete actions[key];
    currentState = null;
    Object.entries(clipsByKey).forEach(([key, clip]) => {
      const action = mixer.clipAction(clip);
      action.enabled = true;
      action.setEffectiveWeight(1);
      actions[resolvePlayerAnimationKey(key)] = action;
    });
    if (isMounted) return;
    if (isDead && (!isDeathState(previousState) || !hasAction(previousState))) {
      const death = PLAYER_DEATH_ACTIONS.find(hasAction);
      if (death) playState(death, { force: true, fade: 0.12 });
      return;
    }
    if (previousState && hasAction(previousState)) {
      const duration = actions[previousState].getClip().duration;
      const timeScale = previousDuration > 0 && duration > 0 ? previousSpeed * duration / previousDuration : previousSpeed;
      playState(previousState, { force: true, timeScale });
      actions[previousState].time = previousProgress * duration;
    } else {
      playState(STATES.IDLE, { force: true });
    }
  };

  // Explicit commands cover every uploaded filename as well as canonical
  // keys. Cosmetic playback never applies root translation, damage or yaw.
  const playMontage = (name, options = {}) => {
    const state = resolvePlayerAnimationKey(name);
    const config = typeof options === 'number' ? { timeScale: options } : options;
    if (isDeathState(state)) return requestDeath(state);
    if (isDead || isMounted || !hasAction(state) || (isBusy && !config.force)) return false;
    bowAttackAllowsMovement = false;
    const speed = Math.max(0.05, Number(config.timeScale) || 1);
    if (!playState(state, { ...config, force: true, timeScale: speed, fade: config.fade ?? 0.16 })) return false;
    if (config.equipmentContext !== false && state === 'equipBow') equipment = { weaponType: 'bow', equipped: true };
    if (config.equipmentContext !== false && state === 'disarmBow') equipment = { weaponType: 'unarmed', equipped: false };
    if (state === 'block') isBlocking = true;
    if (state === 'aimOverdraw') isAiming = true;
    if (!LOOP_STATES.has(state) && !isIdleVariant(state)) {
      isBusy = true;
      busyResetAt = now() + (Number(config.duration) || durationFor(state, speed));
      if (oneShotRef) oneShotRef.current = true;
    } else if (config.force) {
      isBusy = false;
      busyResetAt = 0;
      if (oneShotRef) oneShotRef.current = false;
    }
    return true;
  };

  const requestDeath = (kind = 'forward') => {
    if (isDead || isMounted) return false;
    const requested = resolvePlayerAnimationKey(kind);
    const state = isDeathState(requested) ? requested : /back/i.test(kind) ? 'deathBackward' : 'deathForward';
    const available = hasAction(state) ? state : PLAYER_DEATH_ACTIONS.find(hasAction);
    isBusy = false;
    bowAttackAllowsMovement = false;
    busyResetAt = 0;
    specialMoveTimer = 0;
    specialMoveVelocity = null;
    const played = available ? playState(available, { force: true, fade: 0.12 }) : false;
    if (!played) {
      // Native boot may precede the death montage. Preserve the last rendered
      // pose while it loads; a dead actor must not keep walking in place.
      blendTransition = null;
      for (const action of new Set(Object.values(actions))) {
        if (action.isScheduled()) action.paused = true;
      }
    }
    isDead = true;
    if (oneShotRef) oneShotRef.current = false;
    return played;
  };

  const revive = () => {
    if (!isDead) return false;
    for (const action of new Set(Object.values(actions))) action.stop();
    blendTransition = null;
    isDead = false;
    isBusy = false;
    bowAttackAllowsMovement = false;
    currentState = null;
    busyResetAt = 0;
    specialMoveTimer = 0;
    specialMoveVelocity = null;
    jumpOffset = 0;
    jumpVelocity = 0;
    jumpPhase = null;
    jumpPhaseSeconds = 0;
    externallyAirborne = false;
    idleStartedAt = null;
    previousMoving = false;
    pendingEquipmentTransition = null;
    isAiming = false;
    isBlocking = false;
    if (oneShotRef) oneShotRef.current = false;
    handleMovement({ moving: false, running: false, aiming: false, blocking: false });
    return true;
  };

  const startSpecialMove = (state, directionVector, speed, duration = ONE_SHOT_DURATION[state]) => {
    if (isDead || isMounted || isBusy || !hasAction(state)) return false;
    const dir = directionVector?.clone?.() || new THREE.Vector3(0, 0, -1);
    if (dir.lengthSq() === 0) dir.set(0, 0, -1);
    dir.y = 0;
    dir.normalize();
    const timing=fitGame3DMobilityTiming(actions[state].getClip()?.duration,duration);
    // Only this clip plays, from its authored initial frame. Its own duration
    // controls recovery, not an arbitrary shorter timer that cuts off Eve.
    if(!playState(state,{force:true,fade:.045,timeScale:timing.timeScale}))return false;
    isBusy = true;
    bowAttackAllowsMovement = false;
    busyResetAt = now() + timing.duration;
    if (oneShotRef) oneShotRef.current = true;
    specialMoveVelocity = dir.multiplyScalar(speed);
    // Move with the real world's collision sweep, not raw animation root
    // translations or teleportation. Bound the dash for unusually long clips.
    specialMoveTimer = Math.min(.68,timing.duration);
    return true;
  };

  const requestDodge = (directionVector, directionName = 'forward') => {
    const state = DODGE_STATE_BY_DIRECTION[directionName] || STATES.DODGE_FORWARD;
    if (hasAction(state)) return startSpecialMove(state, directionVector, 7.0, ONE_SHOT_DURATION[state]);
    return startSpecialMove(STATES.DIVE_FORWARD, directionVector, 6.5, 0.52);
  };

  const requestRoll=(directionVector)=>startSpecialMove(
    hasAction(STATES.ROLL)?STATES.ROLL:STATES.DIVE_FORWARD,
    directionVector,4.8,ONE_SHOT_DURATION[STATES.ROLL]); 

  const requestJump=()=>{
    if(isDead || isMounted || isBusy || jumpPhase || jumpOffset>0 || !hasAction(STATES.JUMP_START))return false;
    jumpOffset=0;
    jumpVelocity=JUMP_SPEED;
    jumpPhase='takeoff';
    jumpPhaseSeconds=ONE_SHOT_DURATION[STATES.JUMP_START];
    isBusy=true;
    bowAttackAllowsMovement=false;
    busyResetAt=0;
    if(oneShotRef)oneShotRef.current=true;
    return playState(STATES.JUMP_START,{force:true,fade:.05});
  };

  // Use the correct melee clip when available. The older bow clip remains
  // a fallback for existing avatars without a registered melee animation.
  // Timed skill combos may restart a compatible attack montage at most once
  // every 90ms; regular clicks still obey the ordinary busy/cooldown gates.
  const requestAttack = (kind = 'attack', options = {}) => {
    const config = typeof options === 'number' ? { speed: options } : (options || {});
    const melee = ['kick', 'punch', 'melee', 'meleeAttack'].includes(kind);
    const comboIndex = Math.max(0, Number(config.hitIndex) || 0);
    const heavy = melee && (config.heavy === true);
    const preferred = heavy ? STATES.HEAVY_ATTACK
      : comboIndex % 3 === 1 ? STATES.MELEE_COMBO_2
      : comboIndex % 3 === 2 ? STATES.MELEE_COMBO_3
      : STATES.MELEE_ATTACK;
    const state = melee
      ? (hasAction(kind) ? kind : hasAction(preferred) ? preferred : hasAction('punch') ? 'punch' : hasAction(STATES.MELEE_ATTACK) ? STATES.MELEE_ATTACK : STATES.DRAW_ARROW)
      : hasAction('aimRecoil') ? 'aimRecoil' : STATES.DRAW_ARROW;
    if (isDead || isMounted || !hasAction(state)) return false;
    const instant = now();
    if (isBusy && (!config.combo || !ATTACK_STATES.has(currentState) || instant - lastAttackAt < 0.09)) return false;
    const speed = Math.max(0.7, Math.min(2.2, Number(config.speed) || 1));
    const played = playState(state, { force: true, fade: 0.045, timeScale: speed });
    if (!played) return false;
    isBusy = true;
    // A true bow release is not a stun. Melee, hit reactions, dodges and
    // authored special attacks keep their original lock semantics.
    bowAttackAllowsMovement = !melee && equipment.weaponType === 'bow';
    lastAttackAt = instant;
    busyResetAt = instant + durationFor(state, speed);
    if (oneShotRef) oneShotRef.current = true;
    return true;
  };

  const requestHitReact = (kind = 'front') => {
    const state = /head/i.test(kind) && hasAction('headshotReact') ? 'headshotReact' : STATES.HIT_REACT;
    if (isDead || isMounted || !hasAction(state)) return false;
    // Do not cancel a dodge or other mobility move for a cosmetic hit reaction.
    if (isBusy && !ATTACK_STATES.has(currentState)) return false;
    if (!playState(state, { force: true, fade: 0.06, timeScale: 1.05 })) return false;
    isBusy = true;
    bowAttackAllowsMovement = false;
    busyResetAt = now() + durationFor(state, 1.05);
    if (oneShotRef) oneShotRef.current = true;
    return true;
  };

  // Motion requests never move directly through unvalidated terrain. The
  // world owns the swept boundary/building/tree/rail collision checks; this
  // callback hands them the requested planar displacement only.
  const updateMotion = (model, delta, groundY = model.position.y, moveWithCollision) => {
    advanceBlend();
    const dt=Number.isFinite(delta)?Math.max(0,Math.min(.08,delta)):0;
    let correctedGroundY=groundY;
    if (specialMoveTimer > 0 && specialMoveVelocity) {
      const step=Math.min(dt,specialMoveTimer);
      if(typeof moveWithCollision==='function' && step>0){
        const corrected=moveWithCollision(specialMoveVelocity.x*step,specialMoveVelocity.z*step);
        if(Number.isFinite(corrected))correctedGroundY=corrected;
      }
      specialMoveTimer=Math.max(0,specialMoveTimer-step);
      if(specialMoveTimer===0)specialMoveVelocity=null;
    }
    if(jumpPhase==='takeoff' || jumpPhase==='airborne'){
      jumpOffset=Math.max(0,jumpOffset+jumpVelocity*dt-.5*GRAVITY*dt*dt);
      jumpVelocity-=GRAVITY*dt;
      jumpPhaseSeconds=Math.max(0,jumpPhaseSeconds-dt);
      if(jumpPhase==='takeoff' && jumpPhaseSeconds===0){
        jumpPhase='airborne';
        if(hasAction(STATES.JUMP_LOOP))playState(STATES.JUMP_LOOP,{force:true,fade:.06});
      }
      if(jumpVelocity<=0 && jumpOffset===0){
        jumpPhase='landing';
        jumpPhaseSeconds=ONE_SHOT_DURATION[STATES.JUMP_LAND];
        if(hasAction(STATES.JUMP_LAND))playState(STATES.JUMP_LAND,{force:true,fade:.07});
        busyResetAt=now()+jumpPhaseSeconds;
      }
    }else if(jumpPhase==='landing'){
      jumpPhaseSeconds=Math.max(0,jumpPhaseSeconds-dt);
      if(jumpPhaseSeconds===0)resetBusy();
    }
    if(busyResetAt>0 && now()>=busyResetAt)resetBusy();
    // The actual world height is sampled again every frame, so jumping follows
    // the same hill/floor baseline and cannot permanently change the spawn Y.
    model.position.y=correctedGroundY+jumpOffset;
  };

  const setAiming = (enabled) => {
    isAiming = !!enabled;
    handleMovement({ ...lastMovement, aiming: isAiming });
    return true;
  };

  const setBlocking = (enabled) => {
    isBlocking = !!enabled;
    handleMovement({ ...lastMovement, blocking: isBlocking });
    return true;
  };

  const setEquipmentContext = (context = {}) => {
    const requested = String(context.weaponType || context.type || 'unarmed').toLowerCase();
    const equipped = context.equipped ?? requested !== 'unarmed';
    const weaponType = !equipped ? 'unarmed' : /bow|ranged|archer/.test(requested) ? 'bow' : 'melee';
    if (equipment.weaponType === weaponType && equipment.equipped === !!equipped) return false;
    const previous = equipment;
    equipment = { weaponType, equipped: !!equipped };
    const transition = weaponType === 'bow' && previous.weaponType !== 'bow' ? 'equipBow'
      : previous.weaponType === 'bow' && weaponType !== 'bow' ? 'disarmBow' : null;
    if (transition && hasAction(transition) && !isMounted && !isDead) {
      if (isBusy) pendingEquipmentTransition = transition;
      else playMontage(transition, { equipmentContext: false });
    } else handleMovement(lastMovement);
    return true;
  };

  const setAirborneState = ({ grounded = true, justLanded = false } = {}) => {
    if (isDead || isMounted || jumpPhase) return false;
    const wasAirborne = externallyAirborne;
    externallyAirborne = !grounded;
    if (externallyAirborne) {
      if (!isBusy && hasAction('fallLoop')) return playState('fallLoop', { fade: 0.14 });
    } else if (wasAirborne || justLanded) {
      const landing = lastMovement.moving && lastMovement.running && hasAction('landRun') ? 'landRun'
        : hasAction('landIdle') ? 'landIdle' : STATES.JUMP_LAND;
      return playMontage(landing, { force: true });
    }
    return false;
  };

  // Riding is posed by the mount's seat/grip runtime. Foot locomotion must
  // release its bone bindings before that runtime seats the rider.
  const setMounted = (enabled) => {
    if (enabled && isDead) return false;
    if (isMounted === !!enabled) return;
    isMounted = !!enabled;
    for (const action of new Set(Object.values(actions))) action.stop();
    blendTransition = null;
    currentState = null;
    isBusy = false;
    bowAttackAllowsMovement = false;
    busyResetAt = 0;
    jumpOffset = 0;
    jumpVelocity = 0;
    jumpPhase = null;
    jumpPhaseSeconds = 0;
    specialMoveTimer = 0;
    specialMoveVelocity = null;
    externallyAirborne = false;
    pendingEquipmentTransition = null;
    previousMoving = false;
    idleStartedAt = null;
    if (oneShotRef) oneShotRef.current = false;
    if (!isMounted) handleMovement(lastMovement);
  };

  mixer.addEventListener('finished', (event) => {
    if (event.action !== actions[currentState]) return;
    if (isDeathState(currentState)) return;
    if (isIdleVariant(currentState)) {
      idleStartedAt = now();
      playState(equipment.equipped && hasAction('idleArmed') ? 'idleArmed' : STATES.IDLE, { force: true, fade: 0.2 });
      return;
    }
    // A jump's takeoff animation can end while the character is still
    // airborne. Landing, not the first finished clip, releases movement.
    if(jumpPhase)return;
    if (!LOOP_STATES.has(currentState)) resetBusy();
  });

  return {
    actions,
    bindClips,
    ChangeState: playMontage,
    PlayAnimation: playMontage,
    HandleMovement: handleMovement,
    HandleCombat: requestAttack,
    HandleJump: requestJump,
    HandleAirborne: setAirborneState,
    HandleDamage: requestHitReact,
    HandleDeath: requestDeath,
    revive,
    playOneShot: (name, speed = 1) => hasAction(name) ? playMontage(name, { timeScale: speed }) : requestAttack(name, speed),
    requestAttack,
    requestCrouch: () => false,
    requestDodge,
    requestHitReact,
    requestJump,
    requestRoll,
    setAiming,
    setBlocking,
    setEquipmentContext,
    setAirborneState,
    setMounted,
    updateActionState: handleMovement,
    updateMotion,
    updateAnimation: (delta = 0) => advanceBlend(mixer.time + Math.max(0, Number(delta) || 0)),
    getCurrent: () => isMounted ? 'mounted' : currentState || STATES.IDLE,
    getIsAiming: () => isAiming,
    getIsBlocking: () => isBlocking,
    getIsCrouching: () => false,
    getJumpOffset:()=>jumpOffset,
    isMovementOverridden: () => blocksBowMovement({busy:isBusy,dead:isDead,bowAttackActive:bowAttackAllowsMovement}),
    has: hasAction,
    getDebugState: () => ({ currentState, ...lastMovement, isBusy, bowAttackAllowsMovement, isAiming, isBlocking, equipment: { ...equipment }, isMounted, isDead, specialMoveTimer,jumpPhase,jumpOffset }),
  };
}
