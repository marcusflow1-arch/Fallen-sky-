import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readGame3DCommunityHUD,normalizeGame3DCommunityHUD,
  GAME3D_COMMUNITY_HUD_DEFAULTS,saveGame3DCommunityHUD}
from '../src/components/game3d/hud/game3dCommunityHUDSettings.mjs';
import {clearWolfveilTownCenterRisers} from '../src/components/game3d/wolfveil/WolfveilTownCenterRiserRemoval.mjs';
import {WOLFVEIL_IMPORTED_TOWN_FLOOR_Y,WOLFVEIL_IMPORTED_TOWN,
  WOLFVEIL_IMPORTED_TOWN_TREE}
from '../src/components/game3d/wolfveil/WolfveilImportedTownLayout.mjs';

const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const world=source('src/pages/GameView.jsx');
const settings=source('src/components/game3d/PauseMenu.jsx');
const status=source('src/components/game3d/GameWorldServerManager.jsx');
const styles=source('src/components/game3d/hud/Game3DCommunityHUD.css');
const vault=source('src/components/game3d/chronicle/ChronicleBlueprintLibrary.jsx');
const overlay=source('src/components/game3d/debug/RenderStatsOverlay.jsx');
const town=source('src/components/game3d/wolfveil/WolfveilImportedTownScene.mjs');
const floorY=WOLFVEIL_IMPORTED_TOWN_FLOOR_Y+WOLFVEIL_IMPORTED_TOWN.floorLiftMeters;
const identity={elements:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]};
function fakeMesh(name,triangles){
  const pts=triangles.flat(1);const flat=pts.flat();
  const positions={count:pts.length,
    getX:i=>flat[i*3],getY:i=>flat[i*3+1],getZ:i=>flat[i*3+2]};
  const geometry={attributes:{position:positions},groups:[],index:null,
    setIndex(array){this.index={array,count:array.length,getX:i=>array[i]};},
    clearGroups(){this.groups=[];},addGroup(start,count,materialIndex){this.groups.push({start,count,materialIndex});},
    setDrawRange(){},computeBoundingBox(){},computeBoundingSphere(){}};
  return{name,isMesh:true,geometry,matrixWorld:identity,userData:{}};
}
const root=(...meshes)=>({userData:{},updateMatrixWorld(){},traverse(f){for(const m of meshes)f(m);}});
function floorTri(x,z,y=floorY+.025){
  return [[x,y,z],[x+1,y,z],[x,y,z+1]];
}
function wallTri(x,z,top=floorY+1.05){
  return [[x,floorY,z],[x+1,floorY,z],[x+1,top,z]];
}
const frontX=WOLFVEIL_IMPORTED_TOWN_TREE.x+11;
const frontZ=WOLFVEIL_IMPORTED_TOWN_TREE.z+13;

test('online count starts above UNMOVED left portrait, and shares native HUD preferences',()=>{
  assert.equal(GAME3D_COMMUNITY_HUD_DEFAULTS.online,true);
  assert.equal(normalizeGame3DCommunityHUD({online:false}).online,false);
  const store={map:new Map(),getItem(k){return this.map.get(k)},setItem(k,v){this.map.set(k,v)}};
  assert.deepEqual(readGame3DCommunityHUD(store),GAME3D_COMMUNITY_HUD_DEFAULTS);
  assert.equal(saveGame3DCommunityHUD({scale:1.25,online:true},store).scale,1.25);
  assert.match(styles,/game3d-online-pill/);
  assert.match(styles,/position:fixed;top:clamp\(4px,1vh,12px\);left:clamp/);
  assert.match(styles,/Portrait ring stays exactly where JadeSoulHUD/);
  assert.match(world,/showHud=\{communityHUD\.online/);
  assert.match(status,/game3dWorldPresence/);
  assert.match(status,/if\(!showHud\)return null/);
});

test('Echo, Chronicle Library and World chat become compact, independently usable',()=>{
  assert.match(styles,/axe-echo-launch/);
  assert.match(styles,/axe-chronicle-vault-launch/);
  assert.match(styles,/game3d-world-chat/);
  assert.match(vault,/openLibrary/);
  assert.match(world,/showLauncher=\{communityHUD\.echo\}/);
  assert.match(world,/showDock=\{communityHUD\.chat\}/);
  assert.match(settings,/view==='community'/);
  assert.match(settings,/Community UI size/);
  assert.match(settings,/game3dOpenEchoChronicle/);
  assert.match(settings,/game3dOpenWorldChat/);
});

test('ESC AND title graphics share GPU FPS CPU overlay toggle, without duplicate diagnostics',()=>{
  assert.match(settings,/Performance metrics \(FPS \/ GPU \/ CPU\)/);
  assert.match(settings,/game3dRenderStatsChanged/);
  assert.match(settings,/RENDER_STATS_STORAGE_KEY/);
  assert.match(overlay,/game3dRenderStatsChanged/);
  assert.match(overlay,/setEnabled/);
});

test('remove roughly knee-height step walls and high stair treads in the approach to the centre tree',()=>{
  const base=fakeMesh('paving',[wallTri(frontX,frontZ),floorTri(frontX,frontZ)]);
  const step=fakeMesh('stone',[floorTri(frontX+3,frontZ+4,floorY+.81)]);
  const tiles=fakeMesh('Tile_30',[wallTri(frontX-5,frontZ+3)]);
  const result=clearWolfveilTownCenterRisers(root(base,step,tiles));
  assert.equal(result.removedFaces,3);
  assert.equal(result.changedMeshes,3);
  assert.equal(base.geometry.index.count,3,'walkable paving face still exists');
  assert.equal(step.geometry.index.count,0,'raised step tread removed');
  assert.equal(tiles.geometry.index.count,0,'old tile walls removed');
});
test('keep central tree planter, paved flat floor, surrounding square and separate gates',()=>{
  const close=fakeMesh('paving',[wallTri(WOLFVEIL_IMPORTED_TOWN_TREE.x+1,frontZ-12)]);
  const border=fakeMesh('paving',[wallTri(WOLFVEIL_IMPORTED_TOWN.width/2-2,frontZ)]);
  const floor=fakeMesh('grass',[floorTri(frontX,frontZ)]);
  const gate=fakeMesh('South_Gate',[wallTri(frontX,frontZ)]);
  const treeMesh=fakeMesh('Tree_Planter',[wallTri(frontX,frontZ)]);
  const inspected=root(close,border,floor,gate,treeMesh);
  const result=clearWolfveilTownCenterRisers(inspected);
  assert.equal(result.removedFaces,0);
  for(const mesh of [close,border,floor,gate,treeMesh])
    assert.equal(mesh.geometry.index,null,'must not mutate '+mesh.name);
});
test('riser triangles are removed before the SAME town collision bake',()=>{
  const first=town.indexOf('clearWolfveilImportedTownInterior(town)');
  const flatten=town.indexOf('critiqueAndEnhanceWolfveilTown(town');
  const risers=town.indexOf('clearWolfveilTownCenterRisers(town)');
  const bake=town.indexOf('collision=bakeWolfveilTownCollision');
  assert.ok(first>=0&&flatten>first&&risers>flatten&&bake>risers);
  assert.match(town,/const tree=installWolfveilTownTree\(root\)/);
  assert.doesNotMatch(town,/tree\.dispose\(\);\s*\/\/ no center tree/);
});
