// Wolfveil 4-Cave & Interconnected Subterranean Tunnel System (Three.js).
// Every chamber, ramp, and winding tunnel shares exact geometry with
// WolfveilCaveLayout.mjs so walkable floors, overhead ceilings, and swept walls
// match 1:1. Includes unique themed interiors and a 6-light proximity pool.
import * as THREE from 'three';
import {
  WOLFVEIL_EXPLORABLE_CAVES,
  WOLFVEIL_CAVE_HUB,
  WOLFVEIL_CAVE_CORRIDORS,
  sampleWolfveilPlayerCaveFloorY,
  sampleWolfveilCaveSpace,
  planWolfveilCaveInteraction,
  buildWolfveilCaveTravelGraph,
  resolveWolfveilCaveWallCollision,
} from './WolfveilCaveLayout.mjs';
import { WolfveilTriangles, mulberry32 } from './WolfveilGeometry.js';
import {appendWolfveilCaveAccessFloor,appendWolfveilCaveAccessProps} from './WolfveilCaveAccessGeometry.mjs';
import {WOLFVEIL_CAVE_APPROACHES,resolveWolfveilCaveEntranceRailCollision} from './WolfveilCaveAccessPlan.mjs';

import { getWolfveilSumiETextures, cloneRepeatedTexture } from './WolfveilSumiETextures.mjs';

const TAU = Math.PI * 2;
const LIGHT_POOL_SIZE = 6;

function rockDisplacement(x, y, z) {
  return (
    0.42 * Math.sin(x * 0.37 + y * 0.51 + Math.cos(z * 0.29) * 1.6) +
    0.24 * Math.cos(z * 0.63 - x * 0.41 + y * 0.77)
  );
}

export function createWolfveilCaveSystem(world, { offsetZ = 0 } = {}) {
  const group = new THREE.Group();
  group.name = 'SWV_FourCave_Interconnected_TunnelSystem';
  world.mesh(group);

  const texSuite = getWolfveilSumiETextures();
  const ownedTextures = [
    cloneRepeatedTexture(texSuite.caveRock.map, 0.16, 0.16),
    cloneRepeatedTexture(texSuite.caveRock.bumpMap, 0.16, 0.16),
    cloneRepeatedTexture(texSuite.stone.map, 0.28, 0.28),
    cloneRepeatedTexture(texSuite.stone.bumpMap, 0.28, 0.28),
    cloneRepeatedTexture(texSuite.wood.map, 0.4, 0.4),
    cloneRepeatedTexture(texSuite.wood.bumpMap, 0.4, 0.4),
    cloneRepeatedTexture(texSuite.rope.map, 1, 4),
  ];

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x6f7987,
    map: ownedTextures[0],
    bumpMap: ownedTextures[1],
    bumpScale: 0.08,
    roughness: 0.91,
    metalness: 0.05,
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  wallMat.name = 'SWV_Cave_BasaltRockWall';

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x8e8b84,
    map: ownedTextures[2],
    bumpMap: ownedTextures[3],
    bumpScale: 0.045,
    roughness: 0.88,
    metalness: 0.03,
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  floorMat.name = 'SWV_Cave_WalkableStoneFloor';

  const timberMat = new THREE.MeshStandardMaterial({
    color: 0x8d6342,
    map: ownedTextures[4],
    bumpMap: ownedTextures[5],
    bumpScale: 0.03,
    roughness: 0.84,
  });
  const ropeMat = new THREE.MeshStandardMaterial({
    color: 0xc2a173,
    map: ownedTextures[6],
    roughness: 0.9,
  });
  const bronzeMat = new THREE.MeshStandardMaterial({
    color: 0x4b433b,
    roughness: 0.45,
    metalness: 0.62,
  });
  const jadeCrystalMat = new THREE.MeshStandardMaterial({
    color: 0x5eead4,
    emissive: 0x14b8a6,
    emissiveIntensity: 1.55,
    roughness: 0.24,
    metalness: 0.18,
  });
  const amethystCrystalMat = new THREE.MeshStandardMaterial({
    color: 0xc4b5fd,
    emissive: 0x7c3aed,
    emissiveIntensity: 1.65,
    roughness: 0.22,
    metalness: 0.22,
  });
  const warmLanternMat = new THREE.MeshStandardMaterial({
    color: 0xffe4b5,
    emissive: 0xff9f43,
    emissiveIntensity: 2.35,
    roughness: 0.32,
  });
  const inkRuneMat = new THREE.MeshStandardMaterial({
    color: 0xbae6fd,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.9,
    roughness: 0.28,
  });

  const cisternUniforms = { uTime: { value: 0 } };
  const cisternWaterMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: cisternUniforms,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vW;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vW;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float rippleA = sin(r * 22.0 - uTime * 2.2 + sin(vW.x * 0.7) * 1.4);
        float rippleB = cos(vW.x * 1.6 + vW.z * 1.5 + uTime * 1.5);
        float caustic = smoothstep(0.35, 0.95, 0.5 + 0.3 * rippleA + 0.2 * rippleB);
        vec3 deep = vec3(0.05, 0.18, 0.26);
        vec3 shallow = vec3(0.18, 0.58, 0.66);
        vec3 col = mix(deep, shallow, 0.35 + 0.45 * (1.0 - r));
        col += vec3(0.28, 0.68, 0.75) * caustic * 0.35;
        float edgeFoam = smoothstep(0.84, 0.99, r);
        col = mix(col, vec3(0.78, 0.93, 0.96), edgeFoam * 0.55);
        gl_FragColor = vec4(col, 0.86);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });

  world.ownedMaterials.push(
    wallMat, floorMat, timberMat, ropeMat, bronzeMat,
    jadeCrystalMat, amethystCrystalMat, warmLanternMat, inkRuneMat, cisternWaterMat,
  );

  const floorTris = new WolfveilTriangles();
  const navigationGraph=buildWolfveilCaveTravelGraph();
  const shellTris = new WolfveilTriangles();
  const lightAnchors = [];
  const animatedFlames = [];
  const rand = mulberry32(0xc47e2026);

  const registerLight = (x, y, z, color, intensity = 22, distance = 28) => {
    lightAnchors.push({ x, y, z, color: new THREE.Color(color), intensity, distance });
  };

  // Shared decorative prop builders
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
  const coneGeo = new THREE.ConeGeometry(1, 1, 7);
  const sphereGeo = new THREE.SphereGeometry(1, 10, 8);
  const octaGeo = new THREE.OctahedronGeometry(1, 0);
  const torusGeo = new THREE.TorusGeometry(1, 0.18, 7, 18);

  const addProp = (geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.rotation.set(rx, ry, rz);
    m.castShadow = false;
    m.receiveShadow = true;
    m.raycast = () => {};
    group.add(m);
    return m;
  };

  const addBrazier = (x, y, z, lightHex = 0xffa64d, crystal = false) => {
    addProp(cylGeo, bronzeMat, x, y + 0.42, z, 0.46, 0.84, 0.46);
    addProp(cylGeo, bronzeMat, x, y + 0.92, z, 0.68, 0.22, 0.68);
    const flameMat = crystal ? jadeCrystalMat : warmLanternMat;
    const flame = addProp(crystal ? octaGeo : coneGeo, flameMat, x, y + 1.32, z, 0.34, 0.68, 0.34);
    animatedFlames.push({ mesh: flame, baseY: y + 1.32, phase: x * 0.37 + z * 0.23 });
    registerLight(x, y + 1.85, z, lightHex, 24, 30);
  };

  const addHangingLantern = (x, y, z, mat = warmLanternMat, lightHex = 0xffb35c) => {
    addProp(cylGeo, ropeMat, x, y + 0.65, z, 0.03, 1.3, 0.03);
    addProp(cylGeo, timberMat, x, y + 0.05, z, 0.36, 0.08, 0.36);
    const body = addProp(sphereGeo, mat, x, y - 0.28, z, 0.34, 0.44, 0.34);
    addProp(cylGeo, timberMat, x, y - 0.62, z, 0.28, 0.07, 0.28);
    animatedFlames.push({ mesh: body, baseY: y - 0.28, phase: x * 0.19 - z * 0.31, gentle: true });
    registerLight(x, y - 0.3, z, lightHex, 20, 26);
  };

  // 1. Build continuous tunnel corridors (walkable stone floor + vaulted ceiling + timber ribs)
  const archAngles = Array.from({ length: 11 }, (_, i) => (i / 10) * Math.PI); // 0..PI vault

  for (const cor of WOLFVEIL_CAVE_CORRIDORS) {
    let distAcc = 0;
    for (let sIdx = 0; sIdx < cor.segments.length; sIdx++) {
      const seg = cor.segments[sIdx];
      const steps = Math.max(2, Math.ceil(seg.lenXZ / 2.6));
      const nx = -seg.dz / seg.lenXZ, nz = seg.dx / seg.lenXZ;
      const hw = cor.halfWidth + 0.55;
      const ceil = cor.ceiling;

      for (let i = 0; i < steps; i++) {
        const t0 = i / steps, t1 = (i + 1) / steps;
        const x0 = seg.ax + seg.dx * t0, y0 = seg.ay + seg.dy * t0, z0 = seg.az + seg.dz * t0;
        const x1 = seg.ax + seg.dx * t1, y1 = seg.ay + seg.dy * t1, z1 = seg.az + seg.dz * t1;
        const d0 = distAcc + seg.lenXZ * t0, d1 = distAcc + seg.lenXZ * t1;

        // Walkable dressed-stone & packed-earth floor strip (3 lanes across width)
        const lanes = [-hw, -hw * 0.45, hw * 0.45, hw];
        for (let l = 0; l < lanes.length - 1; l++) {
          const la = lanes[l], lb = lanes[l + 1];
          const isCenter = l === 1;
          const col = isCenter ? [0.76, 0.73, 0.68] : [0.55, 0.54, 0.52];
          floorTris.quad(
            [x0 + nx * la, y0, z0 + nz * la],
            [x0 + nx * lb, y0, z0 + nz * lb],
            [x1 + nx * lb, y1, z1 + nz * lb],
            [x1 + nx * la, y1, z1 + nz * la],
            col,
            [[la, d0], [lb, d0], [lb, d1], [la, d1]],
          );
        }

        // Sculpted vaulted rock arch enclosing both walls + ceiling
        const ringPoint = (cx, cy, cz, aIdx) => {
          const ang = archAngles[aIdx];
          const c = Math.cos(ang), s = Math.sin(ang);
          const rx = cx + nx * c * (hw + 0.35);
          const rz = cz + nz * c * (hw + 0.35);
          const ry = cy - 0.35 + s * (ceil + 0.45);
          const jag = s > 0.15 ? rockDisplacement(rx, ry, rz) * 0.48 : 0;
          return [rx + nx * c * jag, ry + s * jag * 0.65, rz + nz * c * jag];
        };

        for (let a = 0; a < archAngles.length - 1; a++) {
          const p00 = ringPoint(x0, y0, z0, a);
          const p01 = ringPoint(x0, y0, z0, a + 1);
          const p11 = ringPoint(x1, y1, z1, a + 1);
          const p10 = ringPoint(x1, y1, z1, a);
          const crownShade = 0.52 + 0.34 * Math.sin(archAngles[a]);
          const col = [crownShade * 0.88, crownShade * 0.93, crownShade];
          shellTris.quad(p00, p01, p11, p10, col, [
            [a * 1.4, d0 * 0.25],
            [(a + 1) * 1.4, d0 * 0.25],
            [(a + 1) * 1.4, d1 * 0.25],
            [a * 1.4, d1 * 0.25],
          ]);
        }
      }

      // Timber support ribs & rope lashings + tunnel sconces every ~18m
      if (cor.kind === 'tunnel') {
        const ribCount = Math.max(1, Math.floor(seg.lenXZ / 17));
        for (let r = 1; r <= ribCount; r++) {
          const t = r / (ribCount + 1);
          const rx = seg.ax + seg.dx * t;
          const ry = seg.ay + seg.dy * t;
          const rz = seg.az + seg.dz * t;
          const yaw = Math.atan2(seg.dx, seg.dz);
          for (const side of [-1, 1]) {
            const px = rx + nx * side * (cor.halfWidth + 0.15);
            const pz = rz + nz * side * (cor.halfWidth + 0.15);
            addProp(boxGeo, timberMat, px, ry + cor.ceiling * 0.42, pz, 0.32, cor.ceiling * 0.84, 0.32, 0, yaw, 0);
            // Rope lashing collar near top of timber post
            addProp(torusGeo, ropeMat, px, ry + cor.ceiling * 0.76, pz, 0.24, 0.24, 0.28, Math.PI / 2, 0, 0);
          }
          // Overhead crossbeam + hanging lantern
          addProp(boxGeo, timberMat, rx, ry + cor.ceiling * 0.82, rz, cor.halfWidth * 2.05, 0.30, 0.30, 0, yaw + Math.PI / 2, 0);
          if (r % 2 === 1) {
            addHangingLantern(rx, ry + cor.ceiling * 0.78, rz, warmLanternMat, 0xffaa55);
          }
        }
      } else if (cor.kind === 'entry' && sIdx > 0) {
        // Clear return route: warm lanterns and side posts in each real ramp
        // segment. The already-connected cave chamber floors are unchanged.
        const marks=Math.max(1,Math.floor(seg.lenXZ/9));
        for(let j=1;j<=marks;j++){
          const t=j/(marks+1),px=seg.ax+seg.dx*t,
            py=seg.ay+seg.dy*t,pz=seg.az+seg.dz*t;
          for(const side of [-1,1]){
            const lx=px+nx*side*(cor.halfWidth+.35),
              lz=pz+nz*side*(cor.halfWidth+.35);
            addProp(boxGeo,timberMat,lx,py+.76,lz,.17,1.45,.17);
            addProp(boxGeo,bronzeMat,lx,py+1.5,lz,.32,.17,.32);
          }
          addHangingLantern(px,py+cor.ceiling*.72,pz,warmLanternMat,0xffc588);
        }
      }
      distAcc += seg.lenXZ;
    }

    // Seal corridor elbow bends so 35-degree turns never expose tiny corner cracks
    for (let w = 1; w < cor.waypoints.length - 1; w++) {
      const [wx, wy, wz] = cor.waypoints[w];
      const domeR = cor.halfWidth + 1.4;
      const segs = 12;
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * TAU, a1 = ((i + 1) / segs) * TAU;
        const b0 = [wx + Math.cos(a0) * domeR, wy - 0.35, wz + Math.sin(a0) * domeR];
        const b1 = [wx + Math.cos(a1) * domeR, wy - 0.35, wz + Math.sin(a1) * domeR];
        const m0 = [wx + Math.cos(a0) * domeR * 0.92, wy + cor.ceiling * 0.72, wz + Math.sin(a0) * domeR * 0.92];
        const m1 = [wx + Math.cos(a1) * domeR * 0.92, wy + cor.ceiling * 0.72, wz + Math.sin(a1) * domeR * 0.92];
        const top = [wx, wy + cor.ceiling + 0.6, wz];
        shellTris.quad(b0, b1, m1, m0, [0.52, 0.56, 0.62]);
        shellTris.tri(m0, m1, top, [0.46, 0.50, 0.56]);
        floorTris.tri([wx, wy, wz], [wx + Math.cos(a1) * domeR, wy, wz + Math.sin(a1) * domeR], [wx + Math.cos(a0) * domeR, wy, wz + Math.sin(a0) * domeR], [0.68, 0.66, 0.62]);
      }
    }
  }

  // Walkable exterior stone trails from the valley's existing paths to the
  // four sealed stone-mouth E entries. NO surface roof or collider cutout.
  const caveAccessStats=appendWolfveilCaveAccessFloor(floorTris);
  const caveAccessProps=appendWolfveilCaveAccessProps({
    addProp,addBrazier,stoneGeo:boxGeo,beamGeo:boxGeo,
    stoneMat:floorMat,timberMat,bronzeMat,
  });
  // 2. Existing physical stone-mouth arches on the untouched mountain roof
  for (const cave of WOLFVEIL_EXPLORABLE_CAVES) {
    const [mx, mz] = cave.mouth;
    const [dx, dz] = cave.dir;
    const nx = -dz, nz = dx;
    const my = cave.mouthY;
    const yaw = Math.atan2(dx, dz);

    // Sculpted rock arch hood & side buttresses framing the open mouth
    const archSteps = 14;
    const spanR = 5.4, depthR = 9.8;
    for (let s = 0; s < 5; s++) {
      const f0 = -1.6 + (s / 5) * depthR;
      const f1 = -1.6 + ((s + 1) / 5) * depthR;
      for (let i = 0; i < archSteps; i++) {
        const a0 = (i / archSteps) * Math.PI;
        const a1 = ((i + 1) / archSteps) * Math.PI;
        const pt = (f, a) => {
          const c = Math.cos(a), sn = Math.sin(a);
          const w = spanR + (f > 2 ? 0.6 : 1.35);
          const h = 6.6 - f * 0.12;
          const px = mx + dx * f + nx * c * w;
          const pz = mz + dz * f + nz * c * w;
          const py = my - 1.4 + sn * h + (sn > 0.2 ? rockDisplacement(px, my + sn * h, pz) * 0.55 : 0);
          return [px, py, pz];
        };
        shellTris.quad(pt(f0, a0), pt(f0, a1), pt(f1, a1), pt(f1, a0), [0.58, 0.62, 0.66]);
      }
    }

    // Sumi-e Cedar Torii Lintel + Paired Entrance Stone Lanterns outside each cave mouth
    const frontX = mx - dx * 1.4, frontZ = mz - dz * 1.4;
    for (const side of [-1, 1]) {
      const px = frontX + nx * side * 4.4, pz = frontZ + nz * side * 4.4;
      addProp(cylGeo, timberMat, px, my + 2.5, pz, 0.28, 5.4, 0.28);
      addProp(torusGeo, ropeMat, px, my + 4.4, pz, 0.32, 0.32, 0.35, Math.PI / 2, 0, 0);
      // Exterior stone lantern welcoming explorers
      const lx = mx - dx * 3.4 + nx * side * 5.2;
      const lz = mz - dz * 3.4 + nz * side * 5.2;
      addBrazier(lx, my - 0.1, lz, cave.lightColor, cave.theme === 'crystal_geode');
    }
    addProp(boxGeo, timberMat, frontX, my + 5.15, frontZ, 10.4, 0.36, 0.42, 0, yaw, 0);
    addHangingLantern(frontX, my + 4.95, frontZ, warmLanternMat, cave.lightColor);
  }

  // 3. Build the 5 Domed Subterranean Chambers + Unique Themed Designs Inside!
  const allChambers = [
    ...WOLFVEIL_EXPLORABLE_CAVES.map(c => ({ ...c.chamber, cave: c })),
    { ...WOLFVEIL_CAVE_HUB, cave: WOLFVEIL_CAVE_HUB },
  ];

  // Check if a wall azimuth aligns with an incoming tunnel so chamber walls stay open at doorways
  const isCorridorOpening = (ch, angle) => {
    const wx = ch.x + Math.cos(angle) * ch.radius;
    const wz = ch.z + Math.sin(angle) * ch.radius;
    for (const cor of WOLFVEIL_CAVE_CORRIDORS) {
      for (const seg of cor.segments) {
        const len2 = seg.lenXZ * seg.lenXZ;
        const t = Math.max(0, Math.min(1, ((wx - seg.ax) * seg.dx + (wz - seg.az) * seg.dz) / len2));
        const d = Math.hypot(wx - (seg.ax + seg.dx * t), wz - (seg.az + seg.dz * t));
        if (d < cor.halfWidth + 1.35) return true;
      }
    }
    return false;
  };

  for (const ch of allChambers) {
    const R = ch.radius + 0.9;
    const H = ch.ceiling;
    const radialSegs = 28;
    const rings = [
      { r: 1.02, y: -0.5 },
      { r: 1.04, y: H * 0.34 },
      { r: 0.88, y: H * 0.68 },
      { r: 0.52, y: H * 0.92 },
      { r: 0.0, y: H * 1.05 },
    ];
    const openSkylight = ch.theme === 'skylight_roots';

    // Walkable radial stone floor with concentric Sumi-e medallion rings
    for (let i = 0; i < radialSegs; i++) {
      const a0 = (i / radialSegs) * TAU, a1 = ((i + 1) / radialSegs) * TAU;
      const innerR = R * 0.45;
      const c0 = [ch.x, ch.y, ch.z];
      const m0 = [ch.x + Math.cos(a0) * innerR, ch.y + 0.04, ch.z + Math.sin(a0) * innerR];
      const m1 = [ch.x + Math.cos(a1) * innerR, ch.y + 0.04, ch.z + Math.sin(a1) * innerR];
      const e0 = [ch.x + Math.cos(a0) * R, ch.y + 0.24, ch.z + Math.sin(a0) * R];
      const e1 = [ch.x + Math.cos(a1) * R, ch.y + 0.24, ch.z + Math.sin(a1) * R];
      floorTris.tri(c0, m1, m0, [0.74, 0.72, 0.67], [[0, 0], [Math.cos(a1) * 4, Math.sin(a1) * 4], [Math.cos(a0) * 4, Math.sin(a0) * 4]]);
      floorTris.quad(m0, m1, e1, e0, [0.58, 0.57, 0.54], [[0, 0], [3, 0], [3, 3], [0, 3]]);
    }

    // Domed rock walls & ceiling (leaving arch openings where tunnels join!)
    for (let tier = 0; tier < rings.length - 1; tier++) {
      if (openSkylight && tier === rings.length - 2) continue; // Oculus skylight at apex!
      const ra = rings[tier], rb = rings[tier + 1];
      for (let i = 0; i < radialSegs; i++) {
        const aMid = ((i + 0.5) / radialSegs) * TAU;
        if (tier <= 1 && isCorridorOpening(ch, aMid)) continue;
        const a0 = (i / radialSegs) * TAU, a1 = ((i + 1) / radialSegs) * TAU;
        const vtx = (ring, ang) => {
          if (ring.r === 0) return [ch.x, ch.y + ring.y, ch.z];
          const px = ch.x + Math.cos(ang) * R * ring.r;
          const pz = ch.z + Math.sin(ang) * R * ring.r;
          const py = ch.y + ring.y;
          const jag = tier > 0 ? rockDisplacement(px, py, pz) * 0.7 : 0;
          return [px + Math.cos(ang) * jag, py + jag * 0.4, pz + Math.sin(ang) * jag];
        };
        const p00 = vtx(ra, a0), p01 = vtx(ra, a1), p11 = vtx(rb, a1), p10 = vtx(rb, a0);
        const shade = 0.48 + 0.36 * (tier / (rings.length - 1));
        if (rb.r === 0) shellTris.tri(p00, p01, p10, [shade * 0.86, shade * 0.92, shade]);
        else shellTris.quad(p00, p01, p11, p10, [shade * 0.86, shade * 0.92, shade]);
      }
    }

    // Hanging ceiling stalactites around every chamber perimeter
    for (let s = 0; s < 12; s++) {
      const ang = (s / 12) * TAU + 0.2;
      const sr = R * (0.45 + (s % 3) * 0.16);
      const sx = ch.x + Math.cos(ang) * sr;
      const sz = ch.z + Math.sin(ang) * sr;
      const len = 1.4 + (s % 4) * 0.55;
      addProp(coneGeo, wallMat, sx, ch.y + H * 0.88 - len * 0.5, sz, 0.36 + (s % 2) * 0.14, len, 0.36, Math.PI, ang, 0);
    }

    // ─── UNIQUE INTERIOR DESIGN PER CAVERN ───
    if (ch.theme === 'lantern_shrine') {
      // Cave 1: Jade Lantern Grotto — overhead cedar rafters hung with warm & jade lanterns + Wolf-Spirit altar
      for (const zOff of [-4.5, 4.5]) {
        addProp(boxGeo, timberMat, ch.x, ch.y + H * 0.68, ch.z + zOff, R * 1.55, 0.28, 0.28);
        for (const xOff of [-6, -2, 2, 6]) {
          const isJade = Math.abs(xOff) === 2;
          addHangingLantern(
            ch.x + xOff, ch.y + H * 0.66, ch.z + zOff,
            isJade ? jadeCrystalMat : warmLanternMat,
            isJade ? 0x4fd4a8 : 0xffb35c,
          );
        }
      }
      // Low stepped meditation altar dais (walk-around / low step)
      addProp(cylGeo, floorMat, ch.x, ch.y + 0.18, ch.z, 3.2, 0.36, 3.2);
      addProp(octaGeo, jadeCrystalMat, ch.x, ch.y + 1.35, ch.z, 0.62, 1.15, 0.62);
      registerLight(ch.x, ch.y + 1.8, ch.z, 0x4fd4a8, 28, 34);
    } else if (ch.theme === 'skylight_roots') {
      // Cave 2: Whispering Root Hollow — twisting giant cedar roots descending around a glowing skylight shaft
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xd9f99d, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false,
      });
      world.ownedMaterials.push(beamMat);
      addProp( new THREE.CylinderGeometry(2.2, 5.4, H * 1.02, 16, 1, true), beamMat, ch.x, ch.y + H * 0.5, ch.z, 1, 1, 1);
      for (let k = 0; k < 7; k++) {
        const ang = (k / 7) * TAU;
        const rx = ch.x + Math.cos(ang) * (R * 0.58);
        const rz = ch.z + Math.sin(ang) * (R * 0.58);
        addProp(cylGeo, timberMat, rx, ch.y + H * 0.48, rz, 0.34, H * 0.98, 0.28, Math.sin(ang) * 0.22, ang, Math.cos(ang) * 0.22);
        addProp(octaGeo, jadeCrystalMat, rx * 0.98 + ch.x * 0.02, ch.y + 0.55, rz * 0.98 + ch.z * 0.02, 0.55, 0.42, 0.55, 0, ang, 0);
      }
      registerLight(ch.x, ch.y + H * 0.72, ch.z, 0xbef264, 34, 38);
      addBrazier(ch.x - 5.5, ch.y, ch.z, 0x86efac, true);
      addBrazier(ch.x + 5.5, ch.y, ch.z, 0x86efac, true);
    } else if (ch.theme === 'ink_spring') {
      // Cave 3: Sunken Inkstone Cistern — luminous subterranean spring pool + stepping stones + ink rune steles
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(R * 1.55, R * 1.55), cisternWaterMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(ch.x, ch.y + 0.09, ch.z);
      pool.renderOrder = 3;
      pool.raycast = () => {};
      group.add(pool);
      // Stepping-stone causeway + inkstone calligraphy steles around rim
      for (let s = -3; s <= 3; s++) {
        addProp(cylGeo, floorMat, ch.x + s * 2.1, ch.y + 0.13, ch.z + Math.sin(s) * 0.6, 0.88, 0.22, 0.88);
      }
      for (let k = 0; k < 5; k++) {
        const ang = (k / 5) * TAU + 0.4;
        const sx = ch.x + Math.cos(ang) * (R * 0.68);
        const sz = ch.z + Math.sin(ang) * (R * 0.68);
        addProp(boxGeo, wallMat, sx, ch.y + 1.55, sz, 0.95, 3.1, 0.34, 0, -ang, 0);
        addProp(boxGeo, inkRuneMat, sx - Math.cos(ang) * 0.19, ch.y + 1.65, sz - Math.sin(ang) * 0.19, 0.18, 2.1, 0.06, 0, -ang, 0);
      }
      registerLight(ch.x, ch.y + 2.4, ch.z, 0x38bdf8, 30, 36);
      addBrazier(ch.x, ch.y + 0.15, ch.z - 6.2, 0xfbbf24, false);
    } else if (ch.theme === 'crystal_geode') {
      // Cave 4: Echoing Crystal Vault — towering amethyst & cyan crystal clusters + warm fire braziers
      for (let k = 0; k < 9; k++) {
        const ang = (k / 9) * TAU + 0.15;
        if (isCorridorOpening(ch, ang)) continue;
        const cr = R * 0.72;
        const cx = ch.x + Math.cos(ang) * cr;
        const cz = ch.z + Math.sin(ang) * cr;
        const mat = k % 2 === 0 ? amethystCrystalMat : jadeCrystalMat;
        for (let shard = 0; shard < 3; shard++) {
          const h = 1.8 + shard * 0.85 + (k % 2) * 0.5;
          addProp(
            cylGeo, mat,
            cx + (shard - 1) * 0.45, ch.y + h * 0.45, cz + ((shard % 2) - 0.5) * 0.4,
            0.28, h, 0.28,
            (shard - 1) * 0.22, ang + shard, -Math.cos(ang) * 0.26,
          );
        }
        if (k % 3 === 0) {
          registerLight(cx, ch.y + 2.2, cz, k % 2 === 0 ? 0xa855f7 : 0x2dd4bf, 26, 32);
        }
      }
      addBrazier(ch.x - 4.2, ch.y, ch.z, 0xffa64d, false);
      addBrazier(ch.x + 4.2, ch.y, ch.z, 0xffa64d, false);
    } else if (ch.theme === 'ancient_rotunda') {
      // Central 5-Way Subterranean Wolf-Spirit Rotunda Hub
      addProp(torusGeo, inkRuneMat, ch.x, ch.y + 0.08, ch.z, 4.6, 4.6, 0.35, Math.PI / 2, 0, 0);
      addBrazier(ch.x, ch.y + 0.12, ch.z, 0xffb35c, false);
      for (let k = 0; k < 5; k++) {
        const ang = (k / 5) * TAU;
        const px = ch.x + Math.cos(ang) * (R * 0.62);
        const pz = ch.z + Math.sin(ang) * (R * 0.62);
        addHangingLantern(px, ch.y + H * 0.68, pz, k % 2 ? jadeCrystalMat : warmLanternMat, k % 2 ? 0x5eead4 : 0xffb35c);
      }
    }
  }

  // Lightweight, camera-facing cave wayfinding: the stone arches now have
  // deliberate E entry/exit and the central rotunda signs point to EACH
  // of the four physically connected corridors. Sprites never raycast and
  // do not create additional walkable/collision floors.
  const wayfindingMaterials=[];
  const addWayfinding=(label,x,y,z,width=8.2)=>{
    if(typeof document==='undefined')return;
    const canvas=document.createElement('canvas');
    canvas.width=768;canvas.height=128;
    const ctx=canvas.getContext('2d');
    if(!ctx)return;
    ctx.fillStyle='rgba(9,27,43,.92)';
    ctx.fillRect(6,7,756,112);
    ctx.strokeStyle='#e5bf83';ctx.lineWidth=5;ctx.strokeRect(10,10,748,108);
    ctx.fillStyle='#ffe1ab';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font='bold 39px Georgia,serif';
    ctx.fillText(label,384,65,712);
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    ownedTextures.push(texture);
    const mat=new THREE.SpriteMaterial({map:texture,transparent:true,
      depthWrite:false,depthTest:true});
    wayfindingMaterials.push(mat);
    const sprite=new THREE.Sprite(mat);
    sprite.name='SWV_CaveWayfinding_'+label.replace(/[^a-z0-9]/gi,'_');
    sprite.position.set(x,y,z);sprite.scale.set(width,1.45,1);
    sprite.raycast=()=>{};
    group.add(sprite);
    return sprite;
  };
  for(const cave of WOLFVEIL_EXPLORABLE_CAVES) {
    const [mx,mz]=cave.mouth,[dx,dz]=cave.dir;
    addWayfinding('E · '+cave.name,
      cave.threshold[0],cave.threshold[1]+3.4,cave.threshold[2],10.2);
    const ix=mx+dx*3,iz=mz+dz*3;
    const inside=sampleWolfveilCaveSpace(ix,iz,.62);
    if(inside)addWayfinding('E · Return Outside',ix,inside.floorY+3,iz,9);
  }
  const rotunda=WOLFVEIL_CAVE_HUB;
  for(const edge of navigationGraph.edges) {
    if(edge.from!==rotunda.id&&edge.to!==rotunda.id)continue;
    const nextId=edge.from===rotunda.id?edge.to:edge.from;
    const next=navigationGraph.nodes.find(node=>node.id===nextId);
    if(!next)continue;
    const dx=next.x-rotunda.x,dz=next.z-rotunda.z;
    const len=Math.hypot(dx,dz)||1;
    addWayfinding(next.name,rotunda.x+dx/len*7,
      rotunda.y+3.3,rotunda.z+dz/len*7,10.2);
  }

  const floorMesh = new THREE.Mesh(floorTris.geometry(), floorMat);
  floorMesh.name = 'SWV_CaveSystem_WalkableStoneFloor';
  floorMesh.receiveShadow = true;
  floorMesh.userData = {
    walkable: true,
    caveFloor: true,
    clientGroundRaycast: true,
    notServerAuthority: true,
  };
  group.add(floorMesh);
  world.walkableSurfaces ??= [];
  world.walkableSurfaces.push(floorMesh);

  const shellMesh = new THREE.Mesh(shellTris.geometry(), wallMat);
  shellMesh.name = 'SWV_CaveSystem_VaultedRockShell';
  shellMesh.castShadow = true;
  shellMesh.receiveShadow = true;
  shellMesh.raycast = () => {}; // Never intercept downward sky foot-rays from y=1500!
  group.add(shellMesh);

  // Bounded 6-PointLight proximity pool: illuminates whichever cavern/tunnel the player explores
  const lightPool = Array.from({ length: LIGHT_POOL_SIZE }, (_, idx) => {
    const l = new THREE.PointLight(0xffb35c, 0, 30, 1.6);
    l.name = `SWV_Cave_DynamicLight_${idx}`;
    group.add(l);
    return l;
  });

  let elapsed = 0;
  // A fresh login never implicitly authorizes an underground cave session:
  // old fall-through checkpoints are rescued onto the intact surface instead
  // of restoring the very collision bug the owner is reporting.
  let activeCaveId = null; // set ONLY by pressing E at an actual cave arch
  return {
    group,
    floorMesh,
    shellMesh,
    caves: WOLFVEIL_EXPLORABLE_CAVES,
    hub: WOLFVEIL_CAVE_HUB,
    corridors: WOLFVEIL_CAVE_CORRIDORS,
    approaches:WOLFVEIL_CAVE_APPROACHES,
    approachBuild:{...caveAccessStats,waymarks:caveAccessProps.length},
    navigationGraph,
    lightAnchorCount: lightAnchors.length,
    isActive(){return activeCaveId!==null;},
    playerGroundY(worldPos) {
      if (!worldPos) return null;
      // Outdoor players must NEVER be snapped to the cave floor merely
      // because they are standing over the Crystal Vault/waterfall roof.
      if(!activeCaveId)return null;
      return sampleWolfveilPlayerCaveFloorY(
        worldPos.x,worldPos.y,worldPos.z-offsetZ,{insideCave:true});
    },
    interact(worldPos) {
      if(!worldPos)return null;
      const travel=planWolfveilCaveInteraction({
        x:worldPos.x,y:worldPos.y,z:worldPos.z-offsetZ,
      },{insideCave:!!activeCaveId});
      if(!travel)return null;
      // A single committed X/Y/Z teleport never leaves half a frame on an
      // unsupported cliff or samples the underside as the outdoor surface.
      activeCaveId=travel.action==='enter'?travel.caveId:null;
      worldPos.x=travel.x;worldPos.y=travel.y;worldPos.z=travel.z+offsetZ;
      return {action:travel.action,name:travel.name,caveId:travel.caveId};
    },
    resolveCollision(worldPos, prevWorldPos, radius = 0.62) {
      if (!worldPos || !prevWorldPos) return false;
      const localNow={x:worldPos.x,y:worldPos.y,z:worldPos.z-offsetZ};
      const localPrev={x:prevWorldPos.x,
        y:prevWorldPos.y??worldPos.y,z:prevWorldPos.z-offsetZ};
      // Outdoor rock rails are solid, but they do not activate a cave session.
      const railHit=resolveWolfveilCaveEntranceRailCollision(localNow,localPrev,radius);
      if(!activeCaveId){
        if(railHit){worldPos.x=localNow.x;worldPos.z=localNow.z+offsetZ;}
        return railHit;
      }
      let hit=resolveWolfveilCaveWallCollision(localNow,localPrev,radius)||railHit;
      // Preserve the newly sealed roof: only explicit E arch interaction
      // can enter or exit the underground region.
      if(!sampleWolfveilCaveSpace(localNow.x,localNow.z,radius)){
        localNow.x=localPrev.x;localNow.z=localPrev.z;
        hit=true;
      }
      if(hit){worldPos.x=localNow.x;worldPos.z=localNow.z+offsetZ;}
      return hit;
    },
    update(dt, playerWorldPos = null) {
      elapsed += Math.max(0, Math.min(dt || 0, 0.1));
      cisternUniforms.uTime.value = elapsed;
      for (const f of animatedFlames) {
        const s = f.gentle
          ? 1 + 0.04 * Math.sin(elapsed * 2.4 + f.phase)
          : 0.88 + 0.18 * Math.sin(elapsed * 8.5 + f.phase);
        f.mesh.scale.y = Math.abs(f.mesh.scale.y) * (0.96 + 0.04 * s);
        f.mesh.position.y = f.baseY + (f.gentle ? 0.03 * Math.sin(elapsed * 1.9 + f.phase) : 0);
      }

      if (!playerWorldPos || !Number.isFinite(playerWorldPos.x) || !Number.isFinite(playerWorldPos.z)) {
        for (const l of lightPool) l.intensity = 0;
        return;
      }
      const lx = playerWorldPos.x, lz = playerWorldPos.z - offsetZ;
      const ranked = lightAnchors
        .map(a => ({ a, d2: (a.x - lx) * (a.x - lx) + (a.z - lz) * (a.z - lz) }))
        .sort((p, q) => p.d2 - q.d2);

      for (let i = 0; i < LIGHT_POOL_SIZE; i++) {
        const pick = ranked[i];
        const light = lightPool[i];
        if (!pick || pick.d2 > 95 * 95) {
          light.intensity = 0;
          continue;
        }
        const fade = 1 - Math.min(1, Math.max(0, (Math.sqrt(pick.d2) - 48) / 47));
        const flicker = 0.92 + 0.08 * Math.sin(elapsed * 6.2 + i * 1.7);
        light.position.set(pick.a.x, pick.a.y, pick.a.z);
        light.color.copy(pick.a.color);
        light.distance = pick.a.distance;
        light.intensity = pick.a.intensity * fade * flicker;
      }
    },
    dispose() {
      for (const mat of wayfindingMaterials) mat.dispose();
      for (const t of ownedTextures) t.dispose();
      boxGeo.dispose();
      cylGeo.dispose();
      coneGeo.dispose();
      sphereGeo.dispose();
      octaGeo.dispose();
      torusGeo.dispose();
    },
  };
}