// Clone-only Wolfveil map version switch. Never delete the original world.
// The uploader's two 30,327,245-byte .mjs copies contain the same 22,742,008-byte
// glTF2 asset. The geometry-preserving scene shards below were exported from it.
export const WORLD_VARIANT_STORAGE_KEY='game3d_clone_world_variant_v1';
export const WORLD_VARIANT_EVENT='game3dWorldVariantChanged';
export const WORLD_VARIANT_STATUS_EVENT='game3dWorldVariantStatus';
export const WORLD_VARIANT_CLASSIC='classic';
export const WORLD_VARIANT_SUIGEN='suigen';

export const SUIGEN_ASSET_PARTS=Object.freeze([
  'https://media.base44.com/files/public/6ab42219a52fd34656a53b37/70f28504c_wolfveil_suigen_north.glb',
  'https://media.base44.com/files/public/6ab42219a52fd34656a53b37/777b3d50e_wolfveil_suigen_south.glb',
]);
export const SUIGEN_WORLD_METADATA=Object.freeze({
  id:'wolfveil-dominion-of-suigen',
  source:'Wolfveil_Dominion_Of_Suigen_2400m_AAA_Map',
  sideMeters:2400,
  bounds: Object.freeze({minX:-1200,maxX:1200,minZ:-1200,maxZ:1200}),
  worldRegion:'wolfveil',
  sourceMeshCount:928,
  shardCount:2,
  referenceStyle:'original painterly fantasy with physically-based materials',
});

export function normalizeWolfveilWorldVariant(value){
  return value===WORLD_VARIANT_CLASSIC?WORLD_VARIANT_CLASSIC:WORLD_VARIANT_SUIGEN;
}
export function readWolfveilWorldVariant(storage=globalThis?.localStorage){
  try{return normalizeWolfveilWorldVariant(storage?.getItem?.(WORLD_VARIANT_STORAGE_KEY));}
  catch{return WORLD_VARIANT_SUIGEN;}
}
export function saveWolfveilWorldVariant(value,storage=globalThis?.localStorage){
  const variant=normalizeWolfveilWorldVariant(value);
  try{storage?.setItem?.(WORLD_VARIANT_STORAGE_KEY,variant);}catch{}
  return variant;
}
