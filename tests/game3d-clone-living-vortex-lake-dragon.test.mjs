import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {VORTEX_LAKE,gradeVortexLakeBasin,vortexLakeNormalizedRadius,
  vortexLakePortalCrossing,vortexLakeBridgeContains,isVortexLakeWetSurface}
  from '../src/components/game3d/wolfveil/VortexLakeLayout.mjs';
import {createVortexLakeLandmark}
  from '../src/components/game3d/wolfveil/VortexLakeScene.mjs';
import {DRAGON_FIRE_PATTERNS,pointSegmentDistance,isDragonFireHit,
  dragonFirePhase}
  from '../src/components/game3d/boss/DragonLivingFirePatterns.mjs';
import {createDragonLivingFireAttacks}
  from '../src/components/game3d/boss/DragonLivingFireAttacks.mjs';
import {createBossEncounterController}
  from '../src/components/game3d/boss/BossEncounterController.js';
import {addVortexDungeonEcho}
  from '../src/components/game3d/dungeons/VortexDungeonEcho.mjs';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('lake is attached to real river, physical basin and large sunlit mountain mouth',()=>{
  assert.equal(VORTEX_LAKE.centerX,205);
  assert.equal(VORTEX_LAKE.centerZ,320);
  assert.equal(VORTEX_LAKE.waterY,82.6);
  assert(VORTEX_LAKE.mouthWidth>=30 && VORTEX_LAKE.mouthHeight>=20);
  assert.equal(vortexLakeNormalizedRadius(205,320),0);
  assert(gradeVortexLakeBasin(205,320,95)<VORTEX_LAKE.waterY-3.5);
  assert(gradeVortexLakeBasin(215,365,121)<VORTEX_LAKE.waterY+2);
  assert.equal(gradeVortexLakeBasin(-300,30,76),76);
  assert.equal(gradeVortexLakeBasin(205,480,122),122);
  assert(isVortexLakeWetSurface(205,320));
  assert(isVortexLakeWetSurface(215,365));
  assert(!isVortexLakeWetSurface(310,300));
  const terrain=source('src/components/game3d/wolfveil/WolfveilLayout.js');
  assert.match(terrain,/gradeVortexLakeBasin\(x,z,y\)/);
  assert.match(terrain,/vortexLake:\{id:/);
  assert.match(source('src/components/game3d/wolfveil/WolfveilGeometry.js'),
    /heights\[zi\*row\+xi\]=wolfveilHeight/);
});

test('world gateway only triggers while entering and returns to a real bridge',()=>{
  const outside={x:205,z:320+70-8};
  const inside={x:205,z:320+70-4};
  assert.equal(vortexLakePortalCrossing(outside,inside),true);
  assert.equal(vortexLakePortalCrossing(inside,inside),false);
  assert.equal(vortexLakePortalCrossing(null,inside),false);
  assert.equal(vortexLakePortalCrossing(outside,{x:260,z:390}),false);
  assert(vortexLakeBridgeContains(205,320+70-20));
  assert(vortexLakeBridgeContains(VORTEX_LAKE.safeReturn.x,VORTEX_LAKE.safeReturn.z));
  assert(!vortexLakeBridgeContains(260,390));
});

test('vortex scene creates one real 3D water body, walkable bridge and travel trigger',()=>{
  const scene=new THREE.Scene();
  const added=[],removed=[];
  const landmark=createVortexLakeLandmark(scene,{
    addGroundMesh:m=>added.push(m),removeGroundMesh:m=>removed.push(m),
  });
  assert.equal(added.length,2);
  assert.equal(added[0],landmark.bridge);
  assert.equal(added[0].userData.bridgeWalkable,true);
  assert(landmark.water.geometry.getAttribute('position').count>3000);
  const mouth=scene.getObjectByName('Wolfveil_SunlitMountainWaterMouth');
  const ribbons=scene.getObjectByName('LivingUltraSumi_WaterEnergyVortex');
  assert(mouth && ribbons && ribbons.children.length>=16);
  const origin={x:205,z:320+70-8};
  const core={x:205,z:320+70-4};
  landmark.update(.016,origin);
  const event=landmark.update(.016,core);
  assert.deepEqual(event,{target:'lunar-cave',sourcePortal:'vortex'});
  assert.equal(landmark.update(.016,origin),null);
  assert.equal(landmark.update(.016,core),null);
  assert(landmark.status.entered);
  landmark.dispose();
  assert.deepEqual(removed,added);
  assert.equal(scene.getObjectByName('Wolfveil_LivingPerspectivesLakeVortex'),undefined);
});

test('dragon fire patterns have distinct warnings and stable hit math',()=>{
  for(const kind of ['rain','breath','cyclone']){
    const p=DRAGON_FIRE_PATTERNS[kind];
    assert(p.warning>=1);
    assert.equal(dragonFirePhase(kind,0),'telegraph');
    assert.equal(dragonFirePhase(kind,p.warning+.01),'active');
    assert.equal(dragonFirePhase(kind,p.warning+p.active+.01),'recover');
    assert.equal(dragonFirePhase(kind,p.warning+p.active+p.recovery+.1),'done');
  }
  assert.equal(pointSegmentDistance(5,1,0,0,10,0),1);
  assert(isDragonFireHit('breath',{x:5,z:1},{x:10,z:0},{x:0,z:0}));
  assert(!isDragonFireHit('breath',{x:5,z:7},{x:10,z:0},{x:0,z:0}));
  assert(isDragonFireHit('rain',{x:5,z:1},{x:0,z:0}));
  assert(!isDragonFireHit('cyclone',{x:20,z:1},{x:0,z:0}));
});

test('dragon rains, breathes and drops a sky tornado with exactly one hit per telegraph',()=>{
  const scene=new THREE.Scene(),damage=[],target={x:10,z:20};
  const player={x:10,z:20,alive:true};
  const attacks=createDragonLivingFireAttacks({
    scene,groundAt:()=>0,getPlayer:()=>player,
    applyPlayerDamage:(d,meta)=>damage.push({d,...meta}),
    bossId:'wolfveil_quarry_dragon',
  });
  for(const kind of ['rain','breath','cyclone']){
    assert(attacks.start(kind,target,{x:8,y:3,z:18}));
    assert.equal(attacks.phase,'telegraph');
    for(let i=0;i<75;i++)attacks.update(.085);
    assert.equal(attacks.active,false);
  }
  assert.equal(damage.length,3);
  assert.deepEqual(damage.map(d=>d.attack),[
    'living_fire_rain','living_fire_breath','living_fire_cyclone']);
  attacks.dispose();
  assert.equal(scene.getObjectByName('Dragon_LivingUltraSumi_FirePatterns'),undefined);
});

test('dungeon echo follows existing five halls, not a fake duplicated dungeon',()=>{
  const scene=new THREE.Scene(),echo=addVortexDungeonEcho(scene);
  assert.equal(scene.getObjectByName('LivingPerspectives_VortexDungeonMemory'),echo.root);
  assert(echo.root.children.length>=5);
  echo.update(.025);
  const src=source('src/components/game3d/dungeons/LunarCaveScene.js');
  assert.match(src,/addVortexDungeonEcho\(root\)/);
  assert.match(src,/vortexMemory\.update\(dt\)/);
  scene.remove(echo.root);
});

test('actual clone routes into dungeon and back to its lake bridge',()=>{
  const world=source('src/components/game3d/GameWorld3D.jsx');
  const page=source('src/pages/GameView.jsx');
  assert.match(world,/createVortexLakeLandmark\(scene/);
  assert.match(world,/vortexLake\?\.update\(delta,modelRef\.current\?\.position\)/);
  assert.match(world,/window\.dispatchEvent\(new CustomEvent\('game3dPortalTravel',\{detail:vortexTravel\}\)\)/);
  assert.match(world,/portalReturn==='vortex'/);
  assert.match(world,/!isVortexLakeWetSurface\(x,z-70,2\)/);
  assert.match(source('src/components/game3d/wolfveil/WolfveilLivingMeadow.js'),
    /isVortexLakeWetSurface\(x,z,\.75\)/);
  assert.match(source('src/components/game3d/wolfveil/WolfveilForestLayout.js'),
    /if\(isVortexLakeWetSurface\(x,z,r\)\)return false/);
  assert.match(world,/vortexLake\?\.dispose\(\)/);
  assert.match(page,/vortexOriginRef\.current==='vortex'/);
  assert.match(page,/setPortalReturn\(fromVortex\?'vortex'/);
  assert.match(source('src/components/game3d/workflow/workflowDestinations.mjs'),
    /WORKFLOW_VORTEX_LAKE_ID='vortex-lake'/);
});

test('dragon inherits original imported GLB boss and original preview-only damage path',()=>{
  const dragon=source('src/components/game3d/boss/QuarryDragonAerialSlam.js');
  assert.match(dragon,/createDragonLivingFireAttacks/);
  assert.match(dragon,/instanceId=DRAGON_BOSS_ID/);
  const world=source('src/components/game3d/GameWorld3D.jsx');
  assert.match(world,/instanceId:'wolfveil_living_lake_storm_dragon'/);
  assert.match(world,/lakeStormDragon\?\.update\(delta\)/);
  assert.match(world,/lakeStormDragon\?\.dispose\(\)/);
  assert.match(dragon,/\['rain','breath','cyclone','slam'\]/);
  assert.match(dragon,/if\(livingFire\.update\(dt\)\)/);
  assert.match(dragon,/livingFire\.dispose\(\)/);
  assert.match(dragon,/DRAGON_BOSS_MODEL_URL/);
  assert.match(dragon,/xpReward: 0/);
  const effects=source('src/components/game3d/boss/DragonLivingFireAttacks.mjs');
  assert.doesNotMatch(effects,/renderer\.toneMapping|scene\.background|scene\.fog|player\.position\.set|serverGrantXP/);
});

test('two dragon boss instances keep separate IDs, HP targeting and encounter lifecycle',()=>{
  const oldWindow=globalThis.window;
  const quarry={id:'wolfveil_quarry_dragon',name:'Quarry Dragon',
    group:{visible:true},alive:true,dying:false,defeated:false,hp:100};
  const lake={id:'wolfveil_living_lake_storm_dragon',
    name:'Dragon of Living Perspectives',
    group:{visible:true},alive:true,dying:false,defeated:false,hp:400};
  globalThis.window={__gw3dBosses:[quarry,lake]};
  try{
    const controller=createBossEncounterController();
    assert.equal(controller.start({bossId:lake.id}),true);
    assert.equal(controller.getState().bossId,lake.id);
    assert.equal(controller.beginCombat(),true);
    assert.equal(controller.isActive(),true);
    lake.hp=0;controller.update();
    assert.equal(controller.isActive(),false);
    assert.equal(quarry.hp,100);
    assert.equal(controller.start({bossId:quarry.id}),true);
    assert.equal(controller.getState().bossId,quarry.id);
    controller.end({suppressOutro:true});
  }finally{
    if(oldWindow===undefined)delete globalThis.window;
    else globalThis.window=oldWindow;
  }
});
