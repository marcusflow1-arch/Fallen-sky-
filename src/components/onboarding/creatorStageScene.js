// Full-screen creator stage for the fused bodies (public/models/characters/fused).
// The bodies ship without animation clips, so the stage relaxes the T-pose into a
// standing A-pose, adds breathing and blinking, and previews FX_ expression keys.
// Customization (CC_ shapes, skin, hair and tattoo layers) goes through the shared
// AvatarCustomizationRuntime, exactly as on every other body.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { AvatarCustomizationRuntime, inspectCustomization } from './customizationRuntime';
import { prepareFusedCreatorGeometry } from './creatorModelQuality';
import { featherFusedNeckTone } from './creatorNeckTone';
import { normalizeCreatorGazePointer, computeCreatorCursorGaze } from './creatorCursorGaze.mjs';
import { creatorStageLook } from './creatorStyleLighting.mjs';
import { sampleLivingChronicleGaze } from '../game3d/character/livingChronicleIdentity.mjs';
import {originalGame3DModelUrl} from './legacyModelMirror.mjs';

const HEIGHT = 1.72; // the stage normalises every body to this height
const damp = (current, target, lambda, dt) => THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
const bone = (root, name) => root.getObjectByName('mixamorig' + name) || root.getObjectByName('mixamorig:' + name);
// Apply a viewer/world-axis glance to a bone without relying on the Mixamo
// bone's local orientation. The authored rest pose is restored each frame.
function turnGazeBone(node, yaw, pitch) {
  if (!node || (!yaw && !pitch)) return;
  const parent = node.parent?.getWorldQuaternion(new THREE.Quaternion());
  if (!parent) return;
  const worldTurn = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  node.quaternion.premultiply(parent.clone().invert().multiply(worldTurn).multiply(parent));
  node.updateMatrixWorld(true);
}

// Camera shots per creator category: the point looked at (0 feet .. 1 crown), how
// much of the body height fills the view (the camera distance follows from the
// lens, so phones and desktops frame alike), and the yaw the model turns to.
export const CREATOR_SHOTS = {
  face: { y: 0.925, distance: 0.29, yaw: 0.18, lift: 0.0 },
  head: { y: 0.89, distance: 0.4, yaw: 0.5, lift: 0.0 },
  upper: { y: 0.73, distance: 0.42, yaw: 0.32, lift: 0.01 },
  hips: { y: 0.5, distance: 0.46, yaw: Math.PI * 0.82, lift: 0.0 },
  body: { y: 0.51, distance: 1.14, yaw: 0.22, lift: 0.02 },
  back: { y: 0.6, distance: 0.95, yaw: Math.PI, lift: 0.02 },
};

function relaxArms(root) {
  root.updateMatrixWorld(true);
  const turn = (name, childName, target) => {
    const b = bone(root, name), c = bone(root, childName);
    if (!b || !c) return;
    const from = c.getWorldPosition(new THREE.Vector3()).sub(b.getWorldPosition(new THREE.Vector3())).normalize();
    const side = Math.sign(from.x) || 1;
    const to = new THREE.Vector3(target.x * side, target.y, target.z).normalize();
    const delta = new THREE.Quaternion().setFromUnitVectors(from, to);
    const world = b.getWorldQuaternion(new THREE.Quaternion());
    const parent = b.parent.getWorldQuaternion(new THREE.Quaternion());
    b.quaternion.copy(parent.invert().multiply(delta.multiply(world)));
    b.updateMatrixWorld(true);
  };
  for (const side of ['Left', 'Right']) {
    turn(side + 'Arm', side + 'ForeArm', { x: 0.3, y: -0.95, z: 0.02 });
    turn(side + 'ForeArm', side + 'Hand', { x: 0.16, y: -0.96, z: 0.2 });
  }
}

function floorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const g = canvas.getContext('2d');
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(.45, 'rgba(0,0,0,.18)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(214,226,255,.22)'; g.lineWidth = 1;
  g.beginPath(); g.arc(128, 128, 92, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(214,226,255,.1)';
  g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createCreatorStage(container, { url, gender = 'male', rigId = '', ambientGaze = false, onReady = () => {}, onState = () => {}, onError = () => {}, onCapabilities = () => {} } = {}) {
  const motionQuery = typeof window !== 'undefined'
    ? window.matchMedia?.('(prefers-reduced-motion: reduce)') : null;
  // The user can change this preference while the creator remains open.
  // Keep the stage's idle, blink and gaze behavior aligned immediately.
  let reduced = Boolean(motionQuery?.matches);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  scene.environmentIntensity = 0.55;
  const camera = new THREE.PerspectiveCamera(26, 1, 0.02, 60);
  const key = new THREE.DirectionalLight(0xfff2e6, 2.1); key.position.set(1.6, 2.6, 2.2);
  const rim = new THREE.DirectionalLight(0xa9c8ff, 2.4); rim.position.set(-2.2, 2.1, -2.4);
  const fill = new THREE.HemisphereLight(0xdfe8ff, 0x1b1c22, 0.7);
  scene.add(key, rim, fill);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.9, 64), new THREE.MeshBasicMaterial({ map: floorTexture(), transparent: true, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.001; scene.add(floor);

  const pivot = new THREE.Group(); scene.add(pivot);
  let model = null, runtime = null, disposed = false, frame = 0, last = performance.now();
  let modelBounds = null;
  let morphMeshes = [], spine = null, spineRest = null, neck = null, neckRest = null, head = null, headRest = null;
  let appearance = {};
  const fx = { target: {}, current: {} };
  let blinkAt = 2.5, blinkT = -1;
  // camera / framing state
  const view = { y: 0.51, distance: 1.14, lift: 0.02, zoom: 1, yawOffset: 0.22 };
  const goal = { ...view };
  let yaw = 0.22, yawVelocity = 0, dragging = false, userYaw = 0;
  // Mouse position is tracked over the whole creator, including the glass
  // controls overlay. Touch gestures rotate/pinch as before, not eye-track.
  const cursor = { x: 0, y: 0, tracking: false };
  const look = { neckYaw: 0, headYaw: 0, neckPitch: 0, headPitch: 0 };

  const resize = () => {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    // narrow (phone) screens: a wider lens so the full body still fits above the panel
    camera.fov = w / h < 0.8 ? 34 : 26;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize); observer.observe(container); resize();

  // drag to rotate (with inertia), wheel / pinch to zoom
  const pointers = new Map(); let pinch = 0;
  const onDown = (e) => { pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); dragging = true; yawVelocity = 0; renderer.domElement.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => {
    const p = pointers.get(e.pointerId); if (!p) return;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [c, d] = [...pointers.values()];
      const now = Math.hypot(c.x - d.x, c.y - d.y), before = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) goal.zoom = THREE.MathUtils.clamp(goal.zoom * (before / Math.max(1, now)), 0.55, 1.6);
      pinch = now; return;
    }
    const dx = e.clientX - p.x; p.x = e.clientX; p.y = e.clientY;
    userYaw += dx * 0.0105; yawVelocity = dx * 0.0105 * 60;
  };
  const onUp = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = 0; if (!pointers.size) dragging = false; };
  const onWheel = (e) => { e.preventDefault(); goal.zoom = THREE.MathUtils.clamp(goal.zoom * Math.exp(e.deltaY * 0.0011), 0.55, 1.6); };
  const canvas = renderer.domElement;
  const onCursorMove = (event) => {
    if (event.pointerType === 'touch' || reduced || document.hidden) return;
    const next = normalizeCreatorGazePointer(event.clientX, event.clientY, canvas.getBoundingClientRect());
    cursor.x = next.x; cursor.y = next.y; cursor.tracking = next.valid;
  };
  const resetCursor = () => { cursor.x = 0; cursor.y = 0; cursor.tracking = false; };
  const onWindowPointerOut = (event) => {
    // A pointer leaving the app viewport must not leave the character
    // staring at an old mouse location after the browser loses hover.
    if (!event.relatedTarget) resetCursor();
  };
  const onVisibilityChange = () => { if (document.hidden) resetCursor(); };
  const onMotionPreference = (event) => {
    reduced = Boolean(event.matches);
    if (reduced) resetCursor();
  };
  window.addEventListener('pointermove', onCursorMove, { passive: true });
  window.addEventListener('pointerout', onWindowPointerOut, { passive: true });
  window.addEventListener('blur', resetCursor);
  document.addEventListener('visibilitychange', onVisibilityChange);
  if (motionQuery?.addEventListener) motionQuery.addEventListener('change', onMotionPreference);
  else motionQuery?.addListener?.(onMotionPreference);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  const applyStudioLook = () => {
    const style=creatorStageLook(appearance);
    key.color.set(style.key);
    rim.color.set(style.rim).lerp(new THREE.Color(style.accent),style.accentBlend);
    fill.intensity=style.fill;
    scene.environmentIntensity=style.env;
    renderer.toneMappingExposure=style.exposure;
  };
  const applyBody = () => {
    if (!model) return;
    const h = THREE.MathUtils.clamp(Number(appearance.height_scale || 1), 0.84, 1.18);
    const w = THREE.MathUtils.clamp(Number(appearance.body_proportions?.width ?? 1), 0.88, 1.12);
    const d = THREE.MathUtils.clamp(Number(appearance.body_proportions?.depth ?? 1), 0.9, 1.1);
    // Scale around the measured foot-ground center, not the imported GLB's
    // off-axis origin. Height is strictly vertical, frame strictly lateral.
    pivot.scale.set(w, h, d);
    if (modelBounds) {
      model.position.x = -modelBounds.centerX * modelBounds.factor;
      model.position.z = -modelBounds.centerZ * modelBounds.factor;
      model.position.y = -modelBounds.floorY * modelBounds.factor;
    }
  };

  const acceptLoadedModel = (gltf) => {
    if (disposed) { gltf.scene.traverse((n) => { n.geometry?.dispose?.(); }); return; }
    model = gltf.scene;
    relaxArms(model);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model, true);
    const s = HEIGHT / Math.max(0.01, box.max.y - box.min.y);
    modelBounds = { factor:s, floorY:box.min.y,
      centerX:(box.min.x+box.max.x)*0.5,
      centerZ:(box.min.z+box.max.z)*0.5 };
    model.scale.setScalar(s);
    // The imported head/body may not be centered around the model origin.
    // Recenter BEFORE scaling or yaw makes width/height appear to slide.
    model.position.set(-modelBounds.centerX*s,-box.min.y*s,-modelBounds.centerZ*s);
    model.traverse((n) => {
      if (!n.isMesh) return;
      n.frustumCulled = false;
      if (n.morphTargetDictionary && Object.keys(n.morphTargetDictionary).some((k) => k.startsWith('FX_'))) morphMeshes.push(n);
    });
    spine = bone(model, 'Spine2'); spineRest = spine?.quaternion.clone();
    neck = bone(model, 'Neck'); neckRest = neck?.quaternion.clone();
    head = bone(model, 'Head'); headRest = head?.quaternion.clone();
    pivot.add(model);
    // Preserve main's bounded body/neck finishing pass before sliders and
    // attachments, including circumferential belly and seam-tone repairs.
    prepareFusedCreatorGeometry(model);
    featherFusedNeckTone(model);
    applyBody();
    runtime = new AvatarCustomizationRuntime(model, {
      gender, rigId,
      onChange: (caps) => onCapabilities(capabilities(caps)),
      onState,
    });
    runtime.update(appearance);
    onCapabilities(capabilities(inspectCustomization(model)));
    onReady();
  };
  // Use the original authored GLB as a read-only mirror when migration omitted
  // the local binary. Never fall back to a generic primitive replacement.
  const onLocalLoadError = error => {
    if (disposed) return;
    const mirror = originalGame3DModelUrl(url);
    if (!mirror) { onError(error); return; }
    new GLTFLoader(new THREE.LoadingManager()).load(mirror, gltf => {
      console.warn('[Game 3D Creator] Authored model was loaded from the original published site:', url);
      acceptLoadedModel(gltf);
    }, undefined, mirrorError => { if (!disposed) onError(mirrorError); });
  };
  new GLTFLoader().load(url, acceptLoadedModel, undefined, onLocalLoadError);

  const capabilities = (customization) => {
    const expressions = new Set();
    morphMeshes.forEach((m) => Object.keys(m.morphTargetDictionary).forEach((k) => { if (k.startsWith('FX_')) expressions.add(k); }));
    return { customization, expressions: [...expressions], fused: true };
  };

  const tick = (now) => {
    frame = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = now / 1000;
    // framing
    for (const k of ['y', 'distance', 'lift']) view[k] = damp(view[k], goal[k], 4.2, dt);
    view.zoom = damp(view.zoom, goal.zoom, 8, dt);
    view.yawOffset = damp(view.yawOffset, goal.yawOffset, 3.2, dt);
    if (!dragging) { userYaw += yawVelocity * dt; yawVelocity = damp(yawVelocity, 0, 3.5, dt); }
    yaw = view.yawOffset + userYaw;
    pivot.rotation.y = yaw;
    pivot.updateMatrixWorld(true);
    // Use a FIXED studio camera reference while editing height. Scaling the
    // camera distance with the body was cancelling the visual height change,
    // and made the sliders feel as though the character just wandered.
    const H = HEIGHT;
    const target = new THREE.Vector3(0, view.y * H, 0);
    const dist = (view.distance * H) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * view.zoom;
    camera.position.set(0, target.y + view.lift * H + dist * 0.04, dist);
    camera.lookAt(target);
    // breathing and a slow idle sway
    if (spine && spineRest && !reduced) spine.quaternion.copy(spineRest).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(t * 1.6) * 0.012, Math.sin(t * 0.37) * 0.01, 0)));
    if (neck && neckRest) neck.quaternion.copy(neckRest).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(
      reduced ? 0 : Math.sin(t * 0.5) * 0.012, reduced ? 0 : Math.sin(t * 0.29) * 0.03, 0)));
    if (head && headRest) head.quaternion.copy(headRest);
    // The original Getsuga preview turns its face toward the viewer. Give the
    // fused Adam/Eve heads the same presence, now with gentle cursor follow.
    // Drag-to-rotate, back views and reduced-motion requests retain rest pose.
    const targetLook = computeCreatorCursorGaze({
      x: cursor.x, y: cursor.y, tracking: cursor.tracking,
      modelYaw: yaw, dragging, reducedMotion: reduced,
    });
    // Game 3D-only authored living idle: a slow, bounded look around when the
    // player is not dragging the model or using cursor gaze. Nothing touches
    // the camera, root movement, stored appearance, or other creator screens.
    if (ambientGaze && !cursor.tracking && !dragging && !reduced) {
      const glance = sampleLivingChronicleGaze(t, targetLook.weight, false);
      targetLook.neckYaw += glance.yaw * .30;
      targetLook.headYaw += glance.yaw * .70;
      targetLook.neckPitch += glance.pitch * .25;
      targetLook.headPitch += glance.pitch * .75;
    }
    for (const k of Object.keys(look)) look[k] = damp(look[k], targetLook[k], 7, dt);
    // The fused GLBs have Mixamo neck/head bones, but guard older imports that
    // omit one: the available bone receives the full small glance.
    if (neck) turnGazeBone(neck,
      head ? look.neckYaw : look.neckYaw + look.headYaw,
      head ? look.neckPitch : look.neckPitch + look.headPitch);
    if (head) turnGazeBone(head,
      neck ? look.headYaw : look.headYaw + look.neckYaw,
      neck ? look.headPitch : look.headPitch + look.neckPitch);
    // expression preview, eased; an automatic blink keeps the face alive unless blink is being previewed
    const blinkPreview = (fx.target.FX_Blink_L || 0) > 0 || (fx.target.FX_Blink_R || 0) > 0;
    let autoBlink = 0;
    if (!reduced && !blinkPreview) {
      blinkAt -= dt;
      if (blinkAt <= 0 && blinkT < 0) { blinkT = 0; blinkAt = 2.6 + Math.random() * 3.4; }
      if (blinkT >= 0) { blinkT += dt; autoBlink = Math.sin(Math.min(1, blinkT / 0.16) * Math.PI); if (blinkT > 0.16) blinkT = -1; }
    }
    const keys = new Set([...Object.keys(fx.target), ...Object.keys(fx.current), 'FX_Blink_L', 'FX_Blink_R']);
    for (const name of keys) {
      const goalValue = fx.target[name] || 0;
      fx.current[name] = damp(fx.current[name] || 0, goalValue, 12, dt);
      const value = /^FX_Blink_/.test(name) ? Math.max(fx.current[name], autoBlink) : fx.current[name];
      for (const mesh of morphMeshes) {
        const index = mesh.morphTargetDictionary[name];
        if (index !== undefined) mesh.morphTargetInfluences[index] = value;
      }
    }
    renderer.render(scene, camera);
  };
  frame = requestAnimationFrame(tick);

  return {
    appearance(next = {}) { appearance = next; applyBody(); applyStudioLook(); runtime?.update(next); },
    focus(shot = 'body') {
      const s = CREATOR_SHOTS[shot] || CREATOR_SHOTS.body;
      goal.y = s.y; goal.distance = s.distance; goal.lift = s.lift; goal.zoom = 1;
      // a new framing turns the model to that shot's angle by the shortest way round,
      // starting from wherever the user dragged it
      const current = Math.atan2(Math.sin(view.yawOffset + userYaw), Math.cos(view.yawOffset + userYaw));
      view.yawOffset = current; userYaw = 0; yawVelocity = 0;
      goal.yawOffset = s.yaw + Math.round((current - s.yaw) / (Math.PI * 2)) * Math.PI * 2;
    },
    expression(morphs = {}) { fx.target = { ...morphs }; },
    rotate(amount) { yawVelocity += amount * 3; },
    resetView() { view.yawOffset = Math.atan2(Math.sin(view.yawOffset + userYaw), Math.cos(view.yawOffset + userYaw)); userYaw = 0; yawVelocity = 0; goal.zoom = 1; goal.yawOffset = Math.round(view.yawOffset / (Math.PI * 2)) * Math.PI * 2 + 0.22; },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp); canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('pointermove', onCursorMove);
      window.removeEventListener('pointerout', onWindowPointerOut);
      window.removeEventListener('blur', resetCursor);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (motionQuery?.removeEventListener) motionQuery.removeEventListener('change', onMotionPreference);
      else motionQuery?.removeListener?.(onMotionPreference);
      runtime?.dispose();
      scene.traverse((n) => {
        if (!n.isMesh) return;
        n.geometry?.dispose?.();
        (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => { if (!m) return; Object.values(m).forEach((v) => v?.isTexture && v.dispose()); m.dispose(); });
      });
      scene.environment?.dispose(); pmrem.dispose(); room.dispose?.();
      renderer.dispose(); renderer.forceContextLoss?.();
      canvas.remove();
    },
  };
}
