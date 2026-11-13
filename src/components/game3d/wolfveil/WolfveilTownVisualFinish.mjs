import * as THREE from 'three';

// Conservative runtime color pass for the owner's imported 80-piece town.
// Material names and physical mesh placement, not arbitrary tile numbers,
// choose a palette. Existing Blender textures, vertex colors, and blue
// water are preserved; the original .blend remains the art source of truth.
const WATER = /water|foam|river|canal|stream|pond|lake/i;
const BOTANICAL = /pink|pinklight|leaf|foliage|branch/i;
const MATERIAL_RULES = Object.freeze([
  [/grass|meadow|lawn|moss|turf|plant/i, 0x627b59, .95],
  [/stone|pav|path|road|stair|step|brick|cobble/i, 0xa79c89, .85],
  [/wood|beam|timber|post|door|fence/i, 0x7b5841, .79],
  [/roof|shingle|tile_roof|slate/i, 0x566a79, .8],
  [/wall|plaster|facade|house|building/i, 0xc8b69c, .92],
  [/metal|iron|rail|gate/i, 0x9c9986, .45],
  [/gold|trim|bell|lantern|emblem/i, 0xc3a56c, .48],
]);
const mixColor = (a, b, t) => a.clone().lerp(b, t);

/**
 * Returns the number of genuinely untextured material slots recolored.
 * No geometry is replaced, no authored materials shared across mesh roles
 * are mutated, and water remains owned by the dedicated water shader.
 */
export function finishWolfveilTownMaterials(town, { floorY = 0 } = {}) {
  if (!town) return { recolored: 0, preserved: 0 };
  let recolored = 0, preserved = 0;
  town.updateMatrixWorld(true);
  town.traverse(mesh => {
    if (!mesh.isMesh || !mesh.material || !mesh.geometry) return;
    const box = new THREE.Box3().setFromObject(mesh);
    const height = (box.min.y + box.max.y) * .5 - floorY;
    const original = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const painted = original.map(source => {
      if (!source) return source;
      const name = `${mesh.name || ''} ${source.name || ''}`;
      // Water may have animated mesh-specific shader attributes; do not touch.
      if (WATER.test(name) || BOTANICAL.test(name) || source.map ||
          source.vertexColors || source.isShaderMaterial || source.isRawShaderMaterial ||
          source.color === undefined) { preserved++; return source; }
      const rgb = source.color;
      const spread = Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b);
      // Don't overwrite already-authored saturated materials.
      if (spread > .17) { preserved++; return source; }
      const hit = MATERIAL_RULES.find(([pattern]) => pattern.test(name));
      const palette = hit ? hit[1] :
        /^Tile[_ .-]/i.test(mesh.name) ? (height < .7 ? 0xb2a693 : height > 3.8 ? 0x657887 : 0xc0b09c) : null;
      if (palette === null) { preserved++; return source; }
      const out = source.clone();
      out.color.copy(mixColor(rgb, new THREE.Color(palette), .84));
      if ('roughness' in out) out.roughness = hit ? hit[2] : .86;
      if ('metalness' in out && !/metal|gold|trim/i.test(name)) out.metalness = 0.03;
      out.needsUpdate = true;
      recolored++;
      return out;
    });
    mesh.material = Array.isArray(mesh.material) ? painted : painted[0];
    mesh.receiveShadow = true;
  });
  return { recolored, preserved };
}
