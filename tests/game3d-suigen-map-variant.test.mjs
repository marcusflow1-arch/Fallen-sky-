import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  WORLD_VARIANT_CLASSIC,WORLD_VARIANT_SUIGEN,
  WORLD_VARIANT_STORAGE_KEY,SUIGEN_ASSET_PARTS,SUIGEN_WORLD_METADATA,
  readWolfveilWorldVariant,saveWolfveilWorldVariant,
} from '../src/components/game3d/worlds/WolfveilWorldVariants.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Suigen defaults and the Classic fallback persists without mutating a character',()=>{
  const data=new Map();
  const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
  data.set('game3d_saved_character','unchanged');
  assert.equal(readWolfveilWorldVariant(storage),WORLD_VARIANT_SUIGEN);
  assert.equal(saveWolfveilWorldVariant('classic',storage),WORLD_VARIANT_CLASSIC);
  assert.equal(data.get(WORLD_VARIANT_STORAGE_KEY),'classic');
  assert.equal(data.get('game3d_saved_character'),'unchanged');
  assert.equal(readWolfveilWorldVariant(storage),WORLD_VARIANT_CLASSIC);
  assert.equal(saveWolfveilWorldVariant('bad-value',storage),WORLD_VARIANT_SUIGEN);
});

test('Original 2400m GLB geometry is distributed across two registered URLs',()=>{
  assert.equal(SUIGEN_ASSET_PARTS.length,2);
  assert.equal(new Set(SUIGEN_ASSET_PARTS).size,2);
  for(const url of SUIGEN_ASSET_PARTS){
    assert(url.startsWith('https://media.base44.com/files/public/'));
    assert(url.endsWith('.glb'));
  }
  assert.equal(SUIGEN_WORLD_METADATA.sideMeters,2400);
  assert.equal(SUIGEN_WORLD_METADATA.sourceMeshCount,928);
  assert.deepEqual([SUIGEN_WORLD_METADATA.bounds.minX,
    SUIGEN_WORLD_METADATA.bounds.maxX],[-1200,1200]);
});

test('Escape Graphics settings expose both maps and persist changes',()=>{
  const menu=read('src/components/game3d/PauseMenu.jsx');
  for(const expected of ['label="World map"','Dominion of Suigen · New',
    'Wolfveil · Classic Backup','saveWolfveilWorldVariant(next)',
    'WORLD_VARIANT_EVENT','WORLD_VARIANT_STATUS_EVENT'])assert(menu.includes(expected),expected);
});

test('Main Wolfveil scene switches while preserving its existing geometry for backup',()=>{
  const world=read('src/components/game3d/GameWorld3D.jsx');
  for(const expected of ['loadSuigenWorld({scene,signal:worldMapAbort.signal})',
    'suigenRuntime.setVisible(true)','classicWorldRoots)root.visible=false',
    'root.visible=originalVisibility.get(root)??true',
    'const activeGroundMeshes=()=>suigenActive',
    'saveWolfveilWorldVariant(WORLD_VARIANT_CLASSIC)',
    'removeEventListener(WORLD_VARIANT_EVENT,onWorldVariantChange)',
    'createVortexLakeLandmark(scene','createLunarMountainEntrance(scene',
    'createAstralMountainGate(scene','createWolfveilVillage(scene'])
    assert(world.includes(expected),expected);
});

test('Never hide the existing world until both GLB shards successfully load',()=>{
  const loader=read('src/components/game3d/worlds/loadSuigenWorld.mjs');
  const world=read('src/components/game3d/GameWorld3D.jsx');
  assert(loader.includes('Promise.all(SUIGEN_ASSET_PARTS.map'));
  assert(loader.includes('if(signal?.aborted)'));
  assert(loader.includes('scene.add(root)'));
  assert(world.indexOf('const loaded=await suigenLoadPromise')<
    world.indexOf('for(const root of classicWorldRoots)root.visible=false'));
  for(const expected of ['Map_Terrain_2400m','Canal_Bridge_Deck','Abyss_Stair_'])
    assert(loader.includes(expected));
});
