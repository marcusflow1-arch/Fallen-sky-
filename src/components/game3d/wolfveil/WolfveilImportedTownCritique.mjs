// Wolfveil Assembled City Critique, Surface Restoration & Canopy Buildout.
// Fixes every visual flaw discovered on the 104-mesh assembled Blender town:
//  1. Restores smooth vertex normals (Blender smooth groups + crease smoothing)
//     and disables flatShading across architecture, roofs, trims, and tiles.
//  2. Generates world-anchored UVs and applies Sumi-e PBR albedo + bump maps
//     so zero buildings or roads use flat untextured solid colors.
//  3. Deletes tile-box side/underside faces, trims separate paving skirts,
//     seals the central plaza tree planter, and frames the 4 town avenues with
//     Sumi-e timber-and-kawara gateways, sloped kerb aprons, and warm lanterns.
import * as THREE from 'three';
import {
  WOLFVEIL_IMPORTED_TOWN,
  WOLFVEIL_IMPORTED_TOWN_FLOOR_Y,
  WOLFVEIL_IMPORTED_TOWN_TREE,
} from './WolfveilImportedTownLayout.mjs';
import { getWolfveilSumiETextures, cloneRepeatedTexture } from './WolfveilSumiETextures.mjs';
import { removeWolfveilTownRaisedTileBodies } from './WolfveilTownTileBodyRemoval.mjs';

export function generateWorldBoxUVs(mesh, uvScale = 0.22) {
  const g = mesh.geometry;
  const pos = g?.attributes?.position;
  if (!pos) return;
  if (!g.attributes.normal) g.computeVertexNormals();
  const norm = g.attributes.normal;
  const uvs = new Float32Array(pos.count * 2);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    const nx = Math.abs(norm.getX(i)), ny = Math.abs(norm.getY(i)), nz = Math.abs(norm.getZ(i));
    if (ny >= nx && ny >= nz) {
      uvs[i * 2] = v.x * uvScale;
      uvs[i * 2 + 1] = v.z * uvScale;
    } else if (nx >= ny && nx >= nz) {
      uvs[i * 2] = v.z * uvScale;
      uvs[i * 2 + 1] = v.y * uvScale;
    } else {
      uvs[i * 2] = v.x * uvScale;
      uvs[i * 2 + 1] = v.y * uvScale;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
}

export function critiqueAndEnhanceWolfveilTown(townRoot, floorY = WOLFVEIL_IMPORTED_TOWN_FLOOR_Y) {
  const suite = getWolfveilSumiETextures();
  const ownedTextures = [];
  const tex = (pair, rx, ry) => {
    const map = cloneRepeatedTexture(pair.map, rx, ry);
    const bumpMap = cloneRepeatedTexture(pair.bumpMap, rx, ry);
    ownedTextures.push(map, bumpMap);
    return { map, bumpMap };
  };

  const plasterTex = tex(suite.plaster, 1, 1);
  const woodTex = tex(suite.wood, 1, 1);
  const roofTex = tex(suite.roof, 1.3, 1.3);
  const pavingTex = tex(suite.stone, 1.15, 1.15);
  const tileTex = tex(suite.stone, 0.85, 0.85);
  const turfTex = tex(suite.turf, 1.4, 1.4);
  const giltTex = tex(suite.gilt, 1, 1);

  townRoot.updateMatrixWorld(true);

  townRoot.traverse(n => {
    if (!n.isMesh || /water|foam/i.test(n.name)) return;
    n.castShadow = !/^(Tile_|(Expansion_)?(grass|paving))/i.test(n.name);
    n.receiveShadow = true;

    const isTile = /^Tile_/i.test(n.name);
    const isPaving = /^(Expansion_)?paving$/i.test(n.name);
    const isGrass = /^(Expansion_)?grass$/i.test(n.name);

    // ALL 80 Blender Tile_* pieces: retain their top paving polygons only.
    // The former 0.55m-deep clipped boxes still showed as raised slab walls;
    // removing the box faces also removes them from the subsequent collision bake.
    // Preserve the real top polygons so houses, feet and NPCs remain grounded.
    if (isTile) removeWolfveilTownRaisedTileBodies(n);
    // Other paving is NOT a Tile_* body; preserve intentional canal kerbs.
    else if (isPaving) {
      const pos = n.geometry.attributes.position;
      const minAllowedWorldY = floorY - 0.55;
      for (let i = 0; i < pos.count; i++) {
        const wy = pos.getY(i) * townRoot.scale.y + townRoot.position.y;
        if (wy < minAllowedWorldY)
          pos.setY(i, (minAllowedWorldY - townRoot.position.y) / townRoot.scale.y);
      }
      pos.needsUpdate = true;
      n.geometry.computeBoundingBox();
      n.geometry.computeBoundingSphere();
    }

    // Recompute smooth vertex normals from Blender's indexed smooth groups
    n.geometry.computeVertexNormals();
    if (!n.geometry.attributes.uv) {
      generateWorldBoxUVs(n, isTile || isPaving ? 0.24 : isGrass ? 0.18 : 0.28);
    }

    const mats = Array.isArray(n.material) ? n.material : [n.material];
    for (const m of mats) {
      if (!m) continue;
      m.flatShading = false;
      const tag = `${n.name} ${m.name || ''}`;

      if (/^Tile_/i.test(tag)) {
        m.color?.setHex(0xc9c5bb);
        m.map = tileTex.map;
        m.bumpMap = tileTex.bumpMap;
        m.bumpScale = 0.032;
        m.roughness = 0.88;
        m.metalness = 0.02;
      } else if (/paving|stone/i.test(tag)) {
        m.color?.setHex(/stone/i.test(n.name) ? 0xc2beb6 : 0xd9d5cb);
        m.map = pavingTex.map;
        m.bumpMap = pavingTex.bumpMap;
        m.bumpScale = 0.038;
        m.roughness = 0.84;
        m.metalness = 0.03;
        if (isPaving) {
          m.polygonOffset = true;
          m.polygonOffsetFactor = -1;
          m.polygonOffsetUnits = -1;
        }
      } else if (/grass/i.test(tag)) {
        m.color?.setHex(0x6d9354);
        m.map = turfTex.map;
        m.bumpMap = turfTex.bumpMap;
        m.bumpScale = 0.028;
        m.roughness = 0.93;
        m.metalness = 0.0;
        m.polygonOffset = true;
        m.polygonOffsetFactor = -2;
        m.polygonOffsetUnits = -2;
      } else if (/cream|plaster/i.test(tag)) {
        m.color?.setHex(0xf2eadc);
        m.map = plasterTex.map;
        m.bumpMap = plasterTex.bumpMap;
        m.bumpScale = 0.022;
        m.roughness = 0.91;
        m.metalness = 0.01;
      } else if (/wood/i.test(tag)) {
        m.color?.setHex(0xa87c56);
        m.map = woodTex.map;
        m.bumpMap = woodTex.bumpMap;
        m.bumpScale = 0.034;
        m.roughness = 0.80;
        m.metalness = 0.04;
      } else if (/roof/i.test(tag)) {
        m.color?.setHex(0x5b738d);
        m.map = roofTex.map;
        m.bumpMap = roofTex.bumpMap;
        m.bumpScale = 0.042;
        m.roughness = 0.50;
        m.metalness = 0.12;
      } else if (/gold/i.test(tag)) {
        m.color?.setHex(0xe8c87d);
        m.map = giltTex.map;
        m.bumpMap = giltTex.bumpMap;
        m.bumpScale = 0.016;
        m.roughness = 0.30;
        m.metalness = 0.62;
      } else if (/red/i.test(tag)) {
        m.color?.setHex(0xc85a52);
        m.map = woodTex.map;
        m.bumpMap = woodTex.bumpMap;
        m.bumpScale = 0.014;
        m.roughness = 0.40;
        m.metalness = 0.08;
      } else if (/pinklight/i.test(tag)) {
        m.color?.setHex(0xfce0ea);
        m.roughness = 0.76;
        m.metalness = 0.0;
      } else if (/pink/i.test(tag)) {
        m.color?.setHex(0xf0b8c8);
        m.roughness = 0.76;
        m.metalness = 0.0;
      } else if (/leaf/i.test(tag)) {
        m.color?.setHex(0x6e9c68);
        m.roughness = 0.82;
        m.metalness = 0.0;
      }
      m.needsUpdate = true;
    }
  });

  return {
    dispose() {
      for (const t of ownedTextures) t.dispose();
    },
  };
}

/**
 * Freely builds out civic Sumi-e architecture using the assembled town as the
 * central canopy: 4 cardinal Torii-Pavilion gateways, sloped flagstone perimeter
 * aprons (eliminating any edge step), a carved lotus curb around the plaza tree,
 * and warm avenue paper lanterns. Decorative & overhead-clear: zero wall blockers.
 */
export function buildWolfveilTownCanopyDressing(townGroup) {
  const dressing = new THREE.Group();
  dressing.name = 'Wolfveil_Town_SumiE_Canopy_Buildout';
  townGroup.add(dressing);

  const suite = getWolfveilSumiETextures();
  const woodMap = cloneRepeatedTexture(suite.wood.map, 0.5, 0.5);
  const stoneMap = cloneRepeatedTexture(suite.stone.map, 0.4, 0.4);
  const roofMap = cloneRepeatedTexture(suite.roof.map, 0.8, 0.8);

  const cedarMat = new THREE.MeshStandardMaterial({ color: 0x8e5d3b, map: woodMap, roughness: 0.8 });
  const lacquerMat = new THREE.MeshStandardMaterial({ color: 0xb9463e, map: woodMap, roughness: 0.42, metalness: 0.08 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xc8c4ba, map: stoneMap, roughness: 0.88 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3b536e, map: roofMap, roughness: 0.5, metalness: 0.12 });
  const giltMat = new THREE.MeshStandardMaterial({ color: 0xe6c373, roughness: 0.3, metalness: 0.65 });
  const lanternMat = new THREE.MeshStandardMaterial({
    color: 0xffe8bd, emissive: 0xffa648, emissiveIntensity: 2.1, roughness: 0.35,
  });
  const silkMat = new THREE.MeshStandardMaterial({
    color: 0x2c446b, roughness: 0.78, side: THREE.DoubleSide,
  });

  const p = WOLFVEIL_IMPORTED_TOWN;
  const centerZ = p.z + 70; // Render-space Z center (0)
  const baseY = WOLFVEIL_IMPORTED_TOWN_FLOOR_Y;
  const halfW = p.width * 0.5, halfD = p.depth * 0.5;

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 12);
  const sphereGeo = new THREE.SphereGeometry(1, 12, 10);
  const torusGeo = new THREE.TorusGeometry(1, 0.11, 10, 32);

  const add = (geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    m.raycast = () => {};
    dressing.add(m);
    return m;
  };

  // 1. Carved Stone & Gilt Lotus Planter Curb around the central plaza Ancient Tree
  const tx = WOLFVEIL_IMPORTED_TOWN_TREE.x;
  const tz = WOLFVEIL_IMPORTED_TOWN_TREE.z;
  const ty = WOLFVEIL_IMPORTED_TOWN_TREE.y + 0.12;
  add(torusGeo, stoneMat, tx, ty + 0.14, tz, 2.75, 2.75, 1.4, Math.PI / 2, 0, 0);
  add(torusGeo, giltMat, tx, ty + 0.30, tz, 2.82, 2.82, 0.55, Math.PI / 2, 0, 0);

  // 2. Sloped Flagstone Perimeter Kerb & Approach Ramps (bridges the 7cm tile lift cleanly)
  const rampDefs = [
    { x: p.x, z: centerZ - halfD - 1.6, w: 14, d: 3.6, yaw: 0 },         // South Gate Entry
    { x: p.x, z: centerZ + halfD + 1.6, w: 14, d: 3.6, yaw: 0 },         // North Sanctuary Exit
    { x: p.x + halfW + 1.6, z: centerZ, w: 12, d: 3.6, yaw: Math.PI / 2 }, // East River Bridge Exit
    { x: p.x - halfW - 1.6, z: centerZ, w: 12, d: 3.6, yaw: Math.PI / 2 }, // West Forest Exit
  ];
  for (const r of rampDefs) {
    add(boxGeo, stoneMat, r.x, baseY + 0.025, r.z, r.w, 0.09, r.d, 0, r.yaw, 0);
  }

  // 3. Four Grand Sumi-e Civic Torii Gateways + Guardian Lanterns framing the 4 Town Entrances
  const gates = [
    { x: p.x, z: centerZ - halfD - 2.2, yaw: 0, span: 11.4 },
    { x: p.x, z: centerZ + halfD + 2.2, yaw: 0, span: 11.4 },
    { x: p.x + halfW + 2.2, z: centerZ, yaw: Math.PI / 2, span: 10.2 },
    { x: p.x - halfW - 2.2, z: centerZ, yaw: Math.PI / 2, span: 10.2 },
  ];

  const hangingLanterns = [];
  for (const g of gates) {
    const cos = Math.cos(g.yaw), sin = Math.sin(g.yaw);
    const halfSpan = g.span * 0.5;
    for (const side of [-1, 1]) {
      const px = g.x + cos * side * halfSpan;
      const pz = g.z - sin * side * halfSpan;
      // Stone plinth + vermilion pillar + gilt collar
      add(cylGeo, stoneMat, px, baseY + 0.35, pz, 0.62, 0.7, 0.62);
      add(cylGeo, lacquerMat, px, baseY + 4.1, pz, 0.38, 7.2, 0.38);
      add(cylGeo, giltMat, px, baseY + 7.55, pz, 0.43, 0.28, 0.43);

      // Hanging warm paper lantern under each eave wing
      const lx = g.x + cos * side * (halfSpan + 1.15);
      const lz = g.z - sin * side * (halfSpan + 1.15);
      add(cylGeo, cedarMat, lx, baseY + 7.25, lz, 0.04, 0.7, 0.04);
      const orb = add(sphereGeo, lanternMat, lx, baseY + 6.72, lz, 0.34, 0.46, 0.34);
      hangingLanterns.push({ mesh: orb, baseY: baseY + 6.72, phase: lx * 0.2 + lz * 0.3 });

      // Silk clan banner outside pillar
      const bx = g.x + cos * side * (halfSpan + 2.4);
      const bz = g.z - sin * side * (halfSpan + 2.4);
      add(cylGeo, cedarMat, bx, baseY + 2.6, bz, 0.10, 5.2, 0.10);
      add(boxGeo, silkMat, bx, baseY + 3.5, bz, 0.95, 2.2, 0.04, 0, g.yaw, 0);
      add(boxGeo, giltMat, bx, baseY + 4.65, bz, 1.1, 0.10, 0.10, 0, g.yaw, 0);
    }
    // Lower tie beam (nuki) + upper curved kasagi lintel + indigo kawara cap roof
    add(boxGeo, cedarMat, g.x, baseY + 6.35, g.z, g.span + 1.8, 0.34, 0.36, 0, g.yaw, 0);
    add(boxGeo, lacquerMat, g.x, baseY + 7.65, g.z, g.span + 3.4, 0.44, 0.56, 0, g.yaw, 0);
    add(boxGeo, roofMat, g.x, baseY + 8.05, g.z, g.span + 4.2, 0.32, 1.45, 0, g.yaw, 0);
    // Upturned Sumi-e eave tips + central gilt emblem plaque
    for (const side of [-1, 1]) {
      const ex = g.x + cos * side * (halfSpan + 2.2);
      const ez = g.z - sin * side * (halfSpan + 2.2);
      add(boxGeo, roofMat, ex, baseY + 8.24, ez, 1.1, 0.24, 1.5, 0, g.yaw, side * 0.22);
    }
    add(boxGeo, giltMat, g.x, baseY + 7.0, g.z, 1.15, 0.95, 0.18, 0, g.yaw, 0);
  }

  let time = 0;
  return {
    group: dressing,
    update(dt) {
      time += Math.max(0, Math.min(dt || 0, 0.1));
      for (const l of hangingLanterns) {
        l.mesh.position.y = l.baseY + 0.025 * Math.sin(time * 2.1 + l.phase);
      }
    },
    dispose() {
      townGroup.remove(dressing);
      for (const g of [boxGeo, cylGeo, sphereGeo, torusGeo]) g.dispose();
      for (const m of [cedarMat, lacquerMat, stoneMat, roofMat, giltMat, lanternMat, silkMat]) m.dispose();
      for (const t of [woodMap, stoneMap, roofMap]) t.dispose();
    },
  };
}