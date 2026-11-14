import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {game3dPauseGraphicsDefaults} from '../src/components/game3d/game3dPauseMenuModel.mjs';
import {
  ATOMIC_WORLD_VERTEX,ATOMIC_GRASS_VERTEX,ATOMIC_WORLD_FRAGMENT,
  ATOMIC_SOBEL_FRAGMENT,ATOMIC_HEAT_FRAGMENT,ATOMIC_SPARK_VERTEX,
  ATOMIC_HULL_VERTEX,ATOMIC_HULL_FRAGMENT,
} from '../src/components/game3d/render/atomicUltraSumiShaders.mjs';

const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const world=source('src/components/game3d/GameWorld3D.jsx');
const mode=source('src/components/game3d/render/atomicUltraSumiMode.mjs');
const menu=source('src/components/game3d/PauseMenu.jsx');

test('Classic, Sumi-e and Ultra Max are independent saved graphics styles',()=>{
  assert.equal(game3dPauseGraphicsDefaults({artStyle:'original'}).artStyle,'original');
  assert.equal(game3dPauseGraphicsDefaults({artStyle:'ink'}).artStyle,'ink');
  assert.equal(game3dPauseGraphicsDefaults({artStyle:'atomic-ultra-sumi'}).artStyle,'atomic-ultra-sumi');
  assert.equal(game3dPauseGraphicsDefaults({artStyle:'made-up'}).artStyle,'ink');
  assert.match(menu,/id:'atomic-ultra-sumi'/);
  assert.match(menu,/onPick=\{artStyle=>changeGraphics\(\{\.\.\.graphics,artStyle\}\)\}/);
  assert.match(world,/atomicLook\?\.setEnabled\(g\.artStyle==='atomic-ultra-sumi'\)/);
});

test('four procedural GLSL layers have cel, white rim, Voronoi, ink, streak and grass dissolution',()=>{
  assert.match(ATOMIC_WORLD_FRAGMENT,/floor\(light\*4\.\)/);
  assert.match(ATOMIC_WORLD_FRAGMENT,/pow\(1\.0-clamp\(dot\(eye,n\),0\.0,1\.0\),3\.5\)/);
  assert.match(ATOMIC_WORLD_FRAGMENT,/voronoi3\(p\*1\.25\)/);
  assert.match(ATOMIC_WORLD_FRAGMENT,/voronoi3\(p\*2\.5\)/);
  assert.match(ATOMIC_WORLD_FRAGMENT,/vec3\(\.102,\.4,1\.\)/);
  assert.match(ATOMIC_WORLD_FRAGMENT,/vec3\(0\.,\.898,1\.\)/);
  assert.match(ATOMIC_WORLD_FRAGMENT,/vec3\(\.357,\.18,1\.\)/);
  assert.match(ATOMIC_WORLD_FRAGMENT,/vec3\(\.006,\.010,\.02\)/);
  assert.match(ATOMIC_WORLD_FRAGMENT,/vUv\.y\*25\.0-uTime\*4\.0/);
  assert.match(ATOMIC_WORLD_FRAGMENT,/smoothstep\(\.65,1\.,vUv\.y\)/);
  assert.match(ATOMIC_GRASS_VERTEX,/instanceMatrix/);
  assert.match(ATOMIC_GRASS_VERTEX,/uWindStrength/);
  assert.match(ATOMIC_WORLD_VERTEX,/#include <begin_vertex>/);
  assert.match(ATOMIC_SPARK_VERTEX,/gl_PointSize/);
});

test('procedural mode is texture-free and finite GPU budget is stated',()=>{
  assert.match(mode,/blades:60000/);
  assert.match(mode,/segments:5/);
  assert.match(mode,/meadowArea:1000/);
  assert.match(mode,/new THREE\.InstancedMesh/);
  assert.match(mode,/new THREE\.Points/);
  assert.match(mode,/MAX|sparks:2048/);
  assert.doesNotMatch(mode,/new GLTFLoader|new FBXLoader|TextureLoader|ImageLoader|fetch\(/);
  assert.doesNotMatch(ATOMIC_WORLD_FRAGMENT,/sampler2D|texture2D/);
  assert.match(mode,/meadow\?\.step\(sampleHeight,allowGrass,2600,budget\)/);
});

test('Sobel, selective bloom and heat haze use a post-processing pass',()=>{
  assert.match(mode,/new EffectComposer/);
  assert.match(mode,/new RenderPass/);
  assert.match(mode,/new ShaderPass/);
  assert.match(mode,/new UnrealBloomPass/);
  assert.match(mode,/new OutputPass/);
  assert.match(mode,/bloomThreshold:\.72/);
  assert.match(mode,/bloomStrength:1\.35/);
  assert.match(mode,/bloomRadius:\.55/);
  assert.match(ATOMIC_HULL_VERTEX,/position\+normal\*\.055/);
  assert.match(ATOMIC_HULL_FRAGMENT,/vHullWorld\.y\*11\.0/);
  assert.match(mode,/side:THREE\.BackSide/);
  assert.match(mode,/hulls\.length>=24/);
  assert.match(ATOMIC_SOBEL_FRAGMENT,/texture2D/);
  assert.match(ATOMIC_HEAT_FRAGMENT,/vUv\.y\*25\.0-uTime\*4\.0/);
});

test('switching back disposes the extra grass and restores original materials',()=>{
  assert.match(mode,/originals\.set\(mesh,mesh\.material\)/);
  assert.match(mode,/if\(owned\.has\(mesh\.material\)\)mesh\.material=original/);
  assert.match(mode,/meadow\?\.dispose\(\)/);
  assert.match(mode,/sparks\?\.dispose\(\)/);
  assert.match(mode,/composer\?\.dispose\(\)/);
  assert.match(world,/atomicLook\?\.dispose\(\)/);
  assert.match(world,/atomicLook\?\.resize\(\)/);
  assert.match(world,/if\(!atomicLook\?\.render\(activeCamera\)\)inkLook\.render\(scene,activeCamera\)/);
  assert.match(world,/!insideWolfveilImportedTown\(x,z,3\)/);
  assert.match(world,/wolfveilRouteClearance\(x,z-70\)>4/);
});