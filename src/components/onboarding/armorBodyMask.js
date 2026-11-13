// Body masks for armor pieces (tools/avatar-armor). Each piece's glTF extras carry, per body
// primitive, two bitsets of body vertices (little-endian bits, base64):
//   bits  skin the piece covers away from its openings: hidden whenever the piece is worn;
//   band  covered skin next to an opening (cuff, hem, collar): it stays visible when the piece
//         is worn alone, so skin meets the opening, and is hidden once a second worn piece
//         covers it too (glove over sleeve, jacket over waistband, greave over trouser cuff).
// Body triangles whose three vertices are all hidden are dropped from the index, so skin
// cannot show through the armor in any pose. Tattoo and complexion overlays share the body
// geometry and follow it. Taking a piece off restores the original index.
import * as THREE from 'three';

/** The parsed body_mask of a bound layer ({mesh, rig_id, primitives:[{count, hidden, bits}]}), or null. */
export function layerBodyMask(layerRoot) {
  let mask = null;
  layerRoot?.traverse((n) => {
    const raw = n.userData?.body_mask;
    if (mask || !raw) return;
    try { mask = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { mask = null; }
  });
  return mask && Array.isArray(mask.primitives) ? mask : null;
}

const decoded = { bits: new WeakMap(), band: new WeakMap() };
const fromBase64 = (b64) => (typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary'));

/** One byte per vertex (1 = set) for a mask primitive's `bits` (default) or `band`. */
export function decodeMaskBits(primitive, key = 'bits') {
  const cache = decoded[key];
  if (cache.has(primitive)) return cache.get(primitive);
  const count = primitive.count | 0, bin = fromBase64(primitive[key] || ''), out = new Uint8Array(count);
  for (let i = 0; i < count; i++) out[i] = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1;
  cache.set(primitive, out);
  return out;
}

/**
 * Hidden vertices of a body primitive with `count` vertices while every mask's piece is worn:
 * a vertex is hidden when one piece hides it outright, or when two pieces cover it.
 */
export function hiddenVertices(count, masks = []) {
  const solo = new Uint8Array(count), covers = new Uint8Array(count);
  for (const mask of masks) for (const primitive of mask?.primitives || []) {
    if ((primitive.count | 0) !== count) continue;
    const bits = primitive.hidden ? decodeMaskBits(primitive) : null;
    const band = primitive.band_count ? decodeMaskBits(primitive, 'band') : null;
    if (!bits && !band) continue;
    for (let i = 0; i < count; i++) {
      const b = bits ? bits[i] : 0;
      if (b) solo[i] = 1;
      if (b || (band && band[i])) covers[i]++;
    }
  }
  let any = false;
  for (let i = 0; i < count; i++) {
    if (solo[i] || covers[i] >= 2) { solo[i] = 1; any = true; }
  }
  return any ? solo : null;
}

/** Triangle list without the triangles whose three vertices are hidden. */
export function maskedIndex(source, hidden) {
  const keep = [];
  for (let t = 0; t + 2 < source.length; t += 3) {
    const a = source[t], b = source[t + 1], c = source[t + 2];
    if (!(hidden[a] && hidden[b] && hidden[c])) keep.push(a, b, c);
  }
  return keep;
}

/** Apply the union of `masks` to every body mesh under root (layers and overlays excluded). */
export function applyBodyMasks(root, masks = []) {
  const meshes = [];
  root?.traverse((n) => { if (n.isMesh && n.geometry && !n.userData?.creatorLayer && !n.userData?.customizationSurface) meshes.push(n); });
  for (const mesh of meshes) {
    const geometry = mesh.geometry, count = geometry.attributes.position?.count || 0;
    const hidden = hiddenVertices(count, masks);
    const original = geometry.userData.creatorOriginalIndex;
    if (!hidden) {
      if (original) { geometry.setIndex(new THREE.BufferAttribute(original, 1)); delete geometry.userData.creatorOriginalIndex; }
      continue;
    }
    const source = original || (geometry.index ? geometry.index.array.slice() : Uint32Array.from({ length: count }, (_, i) => i));
    geometry.userData.creatorOriginalIndex = source;
    const keep = maskedIndex(source, hidden);
    geometry.setIndex(new THREE.BufferAttribute(count > 65535 ? new Uint32Array(keep) : new Uint16Array(keep), 1));
  }
}
