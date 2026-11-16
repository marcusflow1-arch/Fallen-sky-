// Wolfveil Individual 3D Grass Blade Field (Sumi-e Wind & Footstep Parting).
// Builds slender, individually curved and tapered 3D grass blades instanced in
// spatial chunks across the valley meadows, trail verges, riverbanks, and the
// imported town's green park lawns. Pure visual decoration: zero colliders.
import * as THREE from 'three';
import { WOLFVEIL_ROUTES, WOLFVEIL_SITES, wolfveilDistanceToRiver, wolfveilRouteClearance } from './WolfveilLayout.js';
import { insideWolfveilImportedTown } from './WolfveilImportedTownLayout.mjs';
import { isWolfveilCaveMouthCutout } from './WolfveilCaveLayout.mjs';
import {isWolfveilCaveApproachReserved} from './WolfveilCaveAccessPlan.mjs';
import { clearOf } from './WolfveilForestLayout.js';
import { mulberry32 } from './WolfveilGeometry.js';
import { createWolfveilTerrainSurfaceSampler } from './WolfveilTerrainSurfaceSampler.mjs';
import { createWolfveilNearGrassStream } from './WolfveilNearGrassStream.js';

const TAU = Math.PI * 2;
const noRaycast = () => {};

// Single curved, 4-segment tapered 3D blade with root-to-tip Sumi-e vertex shading.
// Each instance is a genuine individual blade (with 2 companion micro-shoots at its
// root crown so close inspection reads as individual rooted blades, never X-cards).
export function createIndividualSumiEBladeGeometry() {
  const positions = [];
  const colors = [];
  const normals = [];
  const indices = [];

  const shoots = [
    { ox: 0, oz: 0, yaw: 0, h: 0.62, w: 0.024, curve: 0.16, shade: 1.0 },
    { ox: 0.032, oz: -0.018, yaw: 1.9, h: 0.48, w: 0.019, curve: 0.13, shade: 0.92 },
    { ox: -0.028, oz: 0.022, yaw: 4.1, h: 0.41, w: 0.017, curve: 0.11, shade: 0.86 },
  ];

  const segs = 4;
  for (const s of shoots) {
    const cos = Math.cos(s.yaw), sin = Math.sin(s.yaw);
    const base = positions.length / 3;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const bend = s.curve * t * t;
      const y = s.h * (t - 0.07 * t * t * t);
      const halfW = s.w * (1 - 0.82 * Math.pow(t, 1.35));
      const cx = s.ox + sin * bend;
      const cz = s.oz + cos * bend;
      // Slight V-fold spine normal so each individual blade catches directional rim light
      const nx = sin * 0.25, ny = 0.45, nz = cos * 0.25;
      const rootDark = 0.44 + 0.72 * Math.pow(t, 0.85);
      const r = rootDark * s.shade * (0.92 + 0.14 * t);
      const g = rootDark * s.shade * (0.98 + 0.08 * t);
      const b = rootDark * s.shade * (0.78 + 0.10 * t);

      if (i < segs) {
        positions.push(
          cx - cos * halfW, y, cz + sin * halfW,
          cx + cos * halfW, y, cz - sin * halfW,
        );
        normals.push(nx - cos * 0.35, ny, nz + sin * 0.35, nx + cos * 0.35, ny, nz - sin * 0.35);
        colors.push(r, g, b, r, g, b);
      } else {
        // Sharp pointed blade tip
        positions.push(cx, y, cz);
        normals.push(0, 0.9, 0.2);
        colors.push(r * 1.08, g * 1.06, b * 0.96);
      }
    }
    for (let i = 0; i < segs - 1; i++) {
      const a = base + i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const last = base + (segs - 1) * 2;
    indices.push(last, base + segs * 2, last + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

const VALLEY_BLADE_PALETTE = [
  0x4f743b, 0x5f8543, 0x6f924b, 0x436738, 0x7e944e, 0x537a47, 0x898f50,
].map(h => new THREE.Color(h));

const TOWN_PARK_PALETTE = [
  0x5a8848, 0x689652, 0x4f7c42, 0x749e59,
].map(h => new THREE.Color(h));

export function createSumiEBladeMaterial(uniforms) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.84,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  mat.name = 'Wolfveil_IndividualSumiEGrassBlades';
  mat.customProgramCacheKey = () => 'wolfveil-individual-sumie-blades-v1';
  mat.onBeforeCompile = shader => {
    shader.uniforms.uBladeTime = uniforms.time;
    shader.uniforms.uBladeGust = uniforms.gust;
    shader.uniforms.uBladeWind = uniforms.wind;
    shader.uniforms.uBladePlayer = uniforms.player;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uBladeTime, uBladeGust;
uniform vec2 uBladeWind;
uniform vec4 uBladePlayer;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 bladeRoot = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#else
  vec3 bladeRoot = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#endif
float bladeFlex = smoothstep(0.02, 0.58, position.y);
vec2 windDir = normalize(uBladeWind + vec2(0.0001));
// Rolling valley wind swells + per-blade flutter
float waveMacro = sin(dot(bladeRoot.xz, windDir) * 0.11 - uBladeTime * 2.15);
float waveMicro = sin(uBladeTime * 3.4 + bladeRoot.x * 1.9 + bladeRoot.z * 2.3);
float bendAmt = (0.065 + 0.19 * uBladeGust) * (0.62 * waveMacro + 0.38 * waveMicro) * bladeFlex;
transformed.xz += windDir * bendAmt;
transformed.y -= abs(bendAmt) * 0.22 * bladeFlex;
// Player footstep parting
vec2 fromActor = bladeRoot.xz - uBladePlayer.xy;
float actorDist = length(fromActor);
float trample = (1.0 - smoothstep(0.0, 1.65, actorDist)) * uBladePlayer.w;
transformed.xz += normalize(fromActor + vec2(0.0001)) * trample * bladeFlex * 0.44;
transformed.y -= trample * bladeFlex * 0.28;`);
  };
  return mat;
}

export function buildWolfveilIndividualGrassField(world, {
  terrainSpan = 1100,
  terrainSegments = 310,
  importedTownAtMarket = false,
  maxBlades = 22000,
  seed = 0x91a55b1d,
} = {}) {
  const rand = mulberry32(seed);
  const sampleY = createWolfveilTerrainSurfaceSampler({ span: terrainSpan, segments: terrainSegments });
  const uniforms = {
    time: { value: 0 },
    gust: { value: 0.28 },
    wind: { value: new THREE.Vector2(0.7, 0.7) },
    player: { value: new THREE.Vector4(99999, 99999, 0, 0) },
  };
  const geometry = createIndividualSumiEBladeGeometry();
  const material = createSumiEBladeMaterial(uniforms);
  world.ownedMaterials.push(material);

  const spots = [];
  const acceptSpot = (x, z, minRouteClear = 0.55) => {
    if (Math.abs(x) > 480 || Math.abs(z) > 480) return false;
    if (importedTownAtMarket && insideWolfveilImportedTown(x, z, 1.8)) return false;
    if (isWolfveilCaveMouthCutout(x, z)||
        (importedTownAtMarket&&isWolfveilCaveApproachReserved(x,z,1.0))) return false;
    if (wolfveilDistanceToRiver(x, z) < 11.2) return false;
    if (wolfveilRouteClearance(x, z) < minRouteClear) return false;
    if (!clearOf({ x, z }, 0.35)) return false;
    const y = sampleY(x, z);
    if (!Number.isFinite(y) || y > 118) return false;
    const slope = Math.hypot(sampleY(x + 1.5, z) - y, sampleY(x, z + 1.5) - y) / 1.5;
    if (slope > 0.46) return false;
    return y;
  };

  // 1. Dense meadow rings around town outskirts, trails, bridges, sanctuary & cave approaches
  for (const route of WOLFVEIL_ROUTES) {
    for (let i = 0; i < route.points.length - 1 && spots.length < maxBlades * 0.55; i++) {
      const [ax, az] = route.points[i], [bx, bz] = route.points[i + 1];
      const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
      if (len < 1) continue;
      const nx = -dz / len, nz = dx / len;
      for (let d = 0; d < len; d += 0.95) {
        for (const side of [-1, 1]) {
          const count = 2 + Math.floor(rand() * 3);
          for (let k = 0; k < count; k++) {
            const off = route.width * 0.5 + 0.55 + Math.pow(rand(), 1.35) * 14.5;
            const slide = (rand() - 0.5) * 1.4;
            const x = ax + (dx / len) * (d + slide) + nx * side * off;
            const z = az + (dz / len) * (d + slide) + nz * side * off;
            const y = acceptSpot(x, z, 0.45);
            if (y === false) continue;
            spots.push({
              x, y, z,
              yaw: rand() * TAU,
              w: 0.85 + rand() * 0.55,
              h: 0.72 + rand() * 0.78,
              shade: Math.floor(rand() * VALLEY_BLADE_PALETTE.length),
            });
          }
        }
      }
    }
  }

  // 2. Broad valley meadow drifts & riverbank lawns
  const half = 420;
  for (let attempt = 0; attempt < maxBlades * 2.4 && spots.length < maxBlades; attempt++) {
    // Concentrate 65% within 240m of central valley, 35% across outer foothills
    const near = rand() < 0.65;
    const spread = near ? 240 : half;
    const x = (rand() * 2 - 1) * spread;
    const z = (near ? WOLFVEIL_SITES.market.z : 0) + (rand() * 2 - 1) * spread;
    const patch = 0.5 + 0.5 * Math.sin(x * 0.037 + Math.cos(z * 0.041) * 1.8);
    if (rand() > 0.28 + 0.65 * patch) continue;
    const y = acceptSpot(x, z, 0.7);
    if (y === false) continue;
    spots.push({
      x, y, z,
      yaw: rand() * TAU,
      w: 0.82 + rand() * 0.60,
      h: 0.68 + rand() * 0.85 * (0.75 + 0.35 * patch),
      shade: Math.floor(rand() * VALLEY_BLADE_PALETTE.length),
    });
  }

  // Spatial 64m chunks so off-camera blades cull in O(chunks) instead of 1 giant draw
  const chunks = new Map();
  for (const s of spots) {
    const key = `${Math.floor(s.x / 64)}:${Math.floor(s.z / 64)}`;
    if (!chunks.has(key)) chunks.set(key, []);
    chunks.get(key).push(s);
  }

  const dummy = new THREE.Object3D();
  const meshes = [];
  for (const [key, list] of chunks) {
    const inst = new THREE.InstancedMesh(geometry, material, list.length);
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      dummy.position.set(p.x, p.y - 0.025, p.z);
      dummy.rotation.set(0, p.yaw, 0);
      dummy.scale.set(p.w, p.h, p.w);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(i, VALLEY_BLADE_PALETTE[p.shade]);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
    inst.name = `SWV_Individual_GrassBlades_${key}`;
    inst.castShadow = false;
    inst.receiveShadow = true;
    inst.frustumCulled = true;
    inst.raycast = noRaycast;
    inst.userData = { decorativeOnly: true, nonCollider: true, individualBlades: true };
    world.mesh(inst);
    meshes.push(inst);
  }

  const nearGrass = createWolfveilNearGrassStream({
    group: world.group, geometry, material, palette: VALLEY_BLADE_PALETTE,
    accept: (x, z) => acceptSpot(x, z, 0.3),
  });

  return {
    nearGrass,
    dispose() { nearGrass.dispose(); },
    bladeInstances: spots.length,
    totalIndividualShoots: spots.length * 3,
    chunks: meshes.length,
    geometry,
    material,
    uniforms,
    update(frame = {}, playerPosition = null) {
      if (Number.isFinite(frame.time)) uniforms.time.value = frame.time;
      if (Number.isFinite(frame.gust)) uniforms.gust.value = Math.max(0.12, Math.min(1, frame.gust));
      if (Array.isArray(frame.wind) && frame.wind.length === 2) {
        uniforms.wind.value.set(frame.wind[0], frame.wind[1]);
      }
      if (playerPosition && Number.isFinite(playerPosition.x) && Number.isFinite(playerPosition.z)) {
        uniforms.player.value.set(playerPosition.x, playerPosition.z, 0, 1);
        nearGrass.update(playerPosition);
      } else {
        uniforms.player.value.set(99999, 99999, 0, 0);
      }
    },
  };
}

/**
 * Plants manicured individual 3D grass blades directly onto the imported town's
 * own green park lawn meshes (`grass` and `Expansion_grass`), keeping paved
 * streets, canals, and building footprints completely clear.
 */
export function plantTownLawnGrassBlades(townRoot, townGroup, { maxBlades = 5200, seed = 0x5eed7044 } = {}) {
  const lawnMeshes = [];
  townRoot.traverse(n => {
    if (n.isMesh && /^(Expansion_)?grass$/i.test(n.name)) lawnMeshes.push(n);
  });
  if (!lawnMeshes.length) return null;

  const rand = mulberry32(seed);
  const tris = [];
  let totalArea = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), cross = new THREE.Vector3();

  for (const mesh of lawnMeshes) {
    const pos = mesh.geometry.attributes.position;
    const idx = mesh.geometry.index ? mesh.geometry.index.array : null;
    const triCount = idx ? idx.length / 3 : Math.floor(pos.count / 3);
    for (let t = 0; t < triCount; t++) {
      const i0 = idx ? idx[t * 3] : t * 3;
      const i1 = idx ? idx[t * 3 + 1] : t * 3 + 1;
      const i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(pos, i1).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(pos, i2).applyMatrix4(mesh.matrixWorld);
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      cross.crossVectors(ab, ac);
      if (cross.y <= 0.05) continue; // upward-facing lawn surfaces only
      const area = cross.length() * 0.5;
      if (area < 0.05) continue;
      totalArea += area;
      tris.push({
        ax: a.x, ay: a.y, az: a.z,
        bx: b.x, by: b.y, bz: b.z,
        cx: c.x, cy: c.y, cz: c.z,
        cumArea: totalArea,
      });
    }
  }
  if (!tris.length || totalArea <= 0) return null;

  const uniforms = {
    time: { value: 0 },
    gust: { value: 0.22 },
    wind: { value: new THREE.Vector2(0.7, 0.7) },
    player: { value: new THREE.Vector4(99999, 99999, 0, 0) },
  };
  const geometry = createIndividualSumiEBladeGeometry();
  const material = createSumiEBladeMaterial(uniforms);

  const pickTri = target => {
    let lo = 0, hi = tris.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tris[mid].cumArea < target) lo = mid + 1;
      else hi = mid;
    }
    return tris[lo];
  };

  const inst = new THREE.InstancedMesh(geometry, material, maxBlades);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < maxBlades; i++) {
    const tri = pickTri(rand() * totalArea);
    let r1 = Math.sqrt(rand()), r2 = rand();
    const w0 = 1 - r1, w1 = r1 * (1 - r2), w2 = r1 * r2;
    const x = tri.ax * w0 + tri.bx * w1 + tri.cx * w2;
    const y = tri.ay * w0 + tri.by * w1 + tri.cy * w2;
    const z = tri.az * w0 + tri.bz * w1 + tri.cz * w2;
    dummy.position.set(x, y - 0.015, z);
    dummy.rotation.set(0, rand() * TAU, 0);
    dummy.scale.set(0.72 + rand() * 0.36, 0.42 + rand() * 0.38, 0.72 + rand() * 0.36);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
    inst.setColorAt(i, TOWN_PARK_PALETTE[Math.floor(rand() * TOWN_PARK_PALETTE.length)]);
  }
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  inst.computeBoundingSphere();
  inst.name = 'Wolfveil_Town_Park_IndividualGrassBlades';
  inst.castShadow = false;
  inst.receiveShadow = true;
  inst.raycast = noRaycast;
  inst.userData = { decorativeOnly: true, nonCollider: true };
  townGroup.add(inst);

  return {
    mesh: inst,
    count: maxBlades,
    update(dt) {
      uniforms.time.value += Math.max(0, Math.min(dt || 0, 0.1));
      const p = typeof window !== 'undefined' ? window.__localPlayerPos : null;
      if (p && Number.isFinite(p.x) && Number.isFinite(p.z)) {
        uniforms.player.value.set(p.x, p.z, 0, 1);
      }
    },
    dispose() {
      townGroup.remove(inst);
      geometry.dispose();
      material.dispose();
    },
  };
}