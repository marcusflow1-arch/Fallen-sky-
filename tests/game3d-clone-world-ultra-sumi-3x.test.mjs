import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {
  game3dPauseGraphicsDefaults,activateCloneUltraWorldGraphics,
  CLONE_ULTRA_WORLD_MIGRATION_KEY,
} from '../src/components/game3d/game3dPauseMenuModel.mjs';
import {createAtomicUltraSumiMode,ATOMIC_ULTRA_SUMI}
  from '../src/components/game3d/render/atomicUltraSumiMode.mjs';
import {BLAZE_ANKLE_MIN_METERS,BLAZE_ANKLE_MAX_METERS}
  from '../src/components/game3d/render/BlazeBiomeLandscaping.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('clone defaults to safe Ultra Max world mode and existing saved settings migrate once',()=>{
  const kv=new Map([['game_graphics_settings',JSON.stringify({
    artStyle:'ink',quality:'ultra',fpsCap:144,shadows:false,
    customInventorySetting:'retain',
  })]]);
  const storage={getItem:key=>kv.get(key)??null,
    setItem:(key,v)=>kv.set(key,v)};
  assert.equal(game3dPauseGraphicsDefaults(null).artStyle,'atomic-ultra-sumi');
  const first=activateCloneUltraWorldGraphics(storage);
  assert.equal(first.artStyle,'atomic-ultra-sumi');
  assert.equal(first.quality,'ultra');
  assert.equal(first.fpsCap,144);
  assert.equal(first.shadows,false);
  assert.equal(first.customInventorySetting,'retain');
  assert.equal(kv.get(CLONE_ULTRA_WORLD_MIGRATION_KEY),'1');
  storage.setItem('game_graphics_settings',
    JSON.stringify({...first,artStyle:'original'}));
  assert.equal(activateCloneUltraWorldGraphics(storage).artStyle,'original');
  assert.equal(game3dPauseGraphicsDefaults({artStyle:'ink'}).artStyle,'ink');
});

test('real world-wide clone mode consumes one renderer, no whiteout or game colliders',()=>{
  const scene=new THREE.Scene();
  function add(name,material){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),material);
    mesh.name=name;scene.add(mesh);return mesh;
  }
  const skinMat=new THREE.MeshStandardMaterial({color:0xa8754e});
  const stoneMat=new THREE.MeshStandardMaterial({color:0x7d7770});
  const leafMat=new THREE.MeshStandardMaterial({color:0x447c4c});
  leafMat.name='Owner Elm Leaves';
  const owner=add('Game 1 ORIGINAL uploaded elm / elm-broad / leaves',leafMat);
  owner.userData.blazeTreeFamily='foliage';owner.userData.blazeTreeUpAxis='z';
  const actor=add('PlayableCharacter',skinMat);
  const building=add('TownHouse_01',stoneMat);
  let renderCalls=0;
  const guard={isAlive:()=>true,render:(s,c)=>{
    assert.equal(s,scene);renderCalls++;return true;}};
  const renderer={debug:{onShaderError:null},getSize:v=>v.set(640,360)};
  const mode=createAtomicUltraSumiMode({
    scene,renderer,camera:new THREE.PerspectiveCamera(),guard,
    sampleHeight:()=>0,allowGrass:()=>false,
    worldRegion:'wolfveil',quality:'low',enabled:true,
  });
  assert.equal(mode.enabled,true);
  assert.equal(ATOMIC_ULTRA_SUMI.grassScale,3);
  assert.equal(mode.stats.materialReplacements,0);
  assert.equal(mode.stats.heroEmitters,0);
  assert.equal(actor.material,skinMat);
  assert.equal(building.material,stoneMat);
  assert.notEqual(leafMat.onBeforeCompile,THREE.Material.prototype.onBeforeCompile);
  mode.update(.016,new THREE.Vector3(12,0,15),{windStrength:.65});
  assert.equal(mode.render(),true);
  assert.equal(renderCalls,1);
  mode.setEnabled(false);
  assert.equal(owner.material,leafMat);
  assert.equal(leafMat.onBeforeCompile,THREE.Material.prototype.onBeforeCompile);
  mode.dispose();
  for(const mesh of [owner,actor,building]){
    mesh.geometry.dispose();mesh.material.dispose();
  }
});

test('procedural blades and climbing tips are triple the prior game mode size',()=>{
  const grass=read('src/components/game3d/render/BlazeGrassStream.mjs');
  const shaders=read('src/components/game3d/render/BlazeGrassShaders.mjs');
  const surface=read('src/components/game3d/render/BlazeOfGrassWorld.mjs');
  assert.equal(BLAZE_ANKLE_MIN_METERS,1.15);
  assert.equal(BLAZE_ANKLE_MAX_METERS,1.65);
  assert.match(grass,/const y=1\.41\*h/);
  assert.match(grass,/vertices\.push\(-\.094,y,z,\.094,y,z\)/);
  assert.match(grass,/const sy=macro\?1\.08\+rng\(\)\*\.06:\.82\+rng\(\)\*\.30/);
  assert.match(shaders,/wp\.y\+=\.39\+life\*1\.95/);
  assert.match(surface,/1\.65\/max\(\.001,blazeYScale\)/);
  assert.match(surface,/if\(mesh\.isSkinnedMesh\)return null/);
  assert.match(surface,/config\.blazePostFX=false/);
});

test('the ONLY migration from main is the clone graphics style, not gameplay state',()=>{
  const world=read('src/components/game3d/GameWorld3D.jsx');
  const pause=read('src/components/game3d/PauseMenu.jsx');
  const mode=read('src/components/game3d/render/atomicUltraSumiMode.mjs');
  assert.match(world,/activateCloneUltraWorldGraphics/);
  assert.match(world,/createAtomicUltraSumiMode\(\{/);
  assert.match(world,/meadowGroundHeight\(x,z-70\)/);
  assert.match(world,/guard:rendererGuard/);
  assert.match(world,/worldRegion:region/);
  assert.match(pause,/ULTRA MAX · Living Ultra-Sumi/);
  assert.match(mode,/blazeGroundCover:true/);
  assert.match(mode,/blazeFusionStrength:\.82/);
  assert.match(mode,/blazePostFX:false/);
  assert.match(mode,/blazePerimeterFire:false/);
  assert.doesNotMatch(mode,/mesh\.material\s*=|THREE\.BackSide|syncHeroEmitter/);
  assert.doesNotMatch(mode,/UnrealBloomPass|EffectComposer/);
  const elm=read('src/components/game3d/render/forestOwnerElmAssets.js');
  assert.match(elm,/blazeTreeUpAxis='z'/);
  assert.match(elm,/axe:owner-tree-ready/);
});
