import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  WOLFVEIL_CAVE_APPROACHES,WOLFVEIL_CAVE_ACCESS_TRAILS,
  getWolfveilCaveApproach,isWolfveilCaveApproachReserved,
  resolveWolfveilCaveEntranceRailCollision,
} from '../src/components/game3d/wolfveil/WolfveilCaveAccessPlan.mjs';
import {appendWolfveilCaveAccessFloor}
  from '../src/components/game3d/wolfveil/WolfveilCaveAccessGeometry.mjs';
import {
  WOLFVEIL_EXPLORABLE_CAVES,WOLFVEIL_CAVE_CORRIDORS,
  sampleWolfveilPlayerCaveFloorY,planWolfveilCaveInteraction,
} from '../src/components/game3d/wolfveil/WolfveilCaveLayout.mjs';
import {WOLFVEIL_ROUTES,WOLFVEIL_BRIDGES,wolfveilHeight}
  from '../src/components/game3d/wolfveil/WolfveilLayout.js';
import {CAVE_RIM_BUFFER_METRES,shouldRejectCaveGroundStep}
  from '../src/components/game3d/dungeons/CaveRimSafety.mjs';

const triangles=[];
const floor={
  quad(a,b,c,d){triangles.push([a,b,c],[a,c,d]);},
  tri(a,b,c){triangles.push([a,b,c]);},
};
const stats=appendWolfveilCaveAccessFloor(floor);
test('four physical cave approach tracks meet the original trails, with different hillside approaches',()=>{
  assert.equal(WOLFVEIL_CAVE_APPROACHES.length,4);
  assert.equal(new Set(WOLFVEIL_CAVE_APPROACHES.map(a=>a.caveId)).size,4);
  assert.ok(Object.keys(WOLFVEIL_CAVE_ACCESS_TRAILS).length===4);
  const junctions=new Set(WOLFVEIL_ROUTES.flatMap(route=>
    route.points.map(point=>point.join(','))));
  for(const bridge of WOLFVEIL_BRIDGES){
    junctions.add(bridge.from.join(','));junctions.add(bridge.to.join(','));
  }
  for(const a of WOLFVEIL_CAVE_APPROACHES){
    assert.ok(junctions.has([a.points[0].x,a.points[0].z].join(',')),
      'approach must connect to a real path, '+a.id);
    assert.equal(a.points.length,4);
    assert.equal(getWolfveilCaveApproach(a.caveId),a);
    assert.ok(a.points.every(point=>Number.isFinite(point.y)));
    assert.ok(isWolfveilCaveApproachReserved(a.points.at(-1).x,a.points.at(-1).z,1));
    assert.ok(a.points.reduce((sum,p,i)=>i?sum+Math.hypot(
      p.x-a.points[i-1].x,p.z-a.points[i-1].z):sum,0)>35);
  }
});
test('outdoor stone ribbons are real finite triangles and meet each sealed-arch threshold',()=>{
  assert.equal(stats.approaches,4);
  assert.equal(stats.surfaceRoofIntact,true);
  assert.equal(stats.shoulderQuads,0,'no false floor covering the mountain roof');
  assert.ok(stats.walkQuads>200);
  assert.ok(triangles.every(t=>t.every(p=>p.length===3&&p.every(Number.isFinite))));
  for(const a of WOLFVEIL_CAVE_APPROACHES){
    const cave=WOLFVEIL_EXPLORABLE_CAVES.find(c=>c.id===a.caveId);
    const threshold=a.points.at(-1);
    assert.ok(Math.hypot(threshold.x-cave.threshold[0],
      threshold.z-cave.threshold[2])<1e-5);
    assert.ok(Math.abs(threshold.y-cave.threshold[1])<1e-5);
    const ramp=WOLFVEIL_CAVE_CORRIDORS.find(c=>c.id==='entry_'+cave.id);
    assert.deepEqual(ramp.waypoints[0],cave.threshold);
    assert.deepEqual(ramp.waypoints.at(-1),[
      cave.chamber.x,cave.chamber.y,cave.chamber.z]);
    assert.ok(Math.abs(wolfveilHeight(cave.threshold[0],
      cave.threshold[2])-cave.threshold[1])<1e-5);
  }
});
test('a player cannot enter from the sealed roof; E at the arch lands inside the real ramp',()=>{
  for(const cave of WOLFVEIL_EXPLORABLE_CAVES){
    const surface={x:cave.threshold[0],y:cave.threshold[1]+.12,z:cave.threshold[2]};
    assert.equal(sampleWolfveilPlayerCaveFloorY(surface.x,surface.y,surface.z),null,
      'standing on surface must never sample underground floor');
    const entry=planWolfveilCaveInteraction(surface,{insideCave:false});
    assert.equal(entry?.action,'enter');
    assert.equal(entry.caveId,cave.id);
    const insideFloor=sampleWolfveilPlayerCaveFloorY(
      entry.x,entry.y,entry.z,{insideCave:true});
    assert.ok(Number.isFinite(insideFloor));
    const exitPoint={x:cave.mouth[0]+cave.dir[0]*3,
      y:entry.y,z:cave.mouth[1]+cave.dir[1]*3};
    const exit=planWolfveilCaveInteraction(exitPoint,{insideCave:true});
    assert.equal(exit?.action,'exit');
    assert.ok(Math.hypot(exit.x-surface.x,exit.z-surface.z)<.0001);
    const away={x:surface.x+16,y:surface.y,z:surface.z+17};
    assert.equal(planWolfveilCaveInteraction(away,{insideCave:false}),null);
  }
});
test('physical outside guard rails block sideways falls but not central entry or departure',()=>{
  for(const cave of WOLFVEIL_EXPLORABLE_CAVES){
    const [mx,mz]=cave.mouth,[dx,dz]=cave.dir;
    const nx=-dz,nz=dx;
    const pt=(f,lat)=>({x:mx+dx*f+nx*lat,z:mz+dz*f+nz*lat});
    assert.equal(resolveWolfveilCaveEntranceRailCollision(
      pt(-4,0),pt(-10,0),.62),false,'central E-arch access is not blocked');
    assert.equal(resolveWolfveilCaveEntranceRailCollision(
      pt(-10,0),pt(-4,0),.62),false,'outward departure is not blocked');
    const from=pt(-7,4.3),now=pt(-7,5.8),actual={...now};
    assert.equal(resolveWolfveilCaveEntranceRailCollision(actual,from,.62),true);
    assert.ok(Math.hypot(actual.x-from.x,actual.z-from.z)<1e-6);
    assert.equal(resolveWolfveilCaveEntranceRailCollision(
      pt(3,5.8),pt(3,4.3),.62),false,
      'underground wall/entry logic owns the inside; surface rail must not interfere');
  }
});
test('seven-foot rim guard rejects discontinuities, keeps normal .3m walking step',()=>{
  const cave=WOLFVEIL_EXPLORABLE_CAVES[0];
  const at={x:cave.mouth[0],z:cave.mouth[1]+70};
  assert.ok(CAVE_RIM_BUFFER_METRES>2.1);
  assert.equal(shouldRejectCaveGroundStep({from:at,to:at,
    fromGroundY:10,toGroundY:null,variant:'classic'}),true);
  assert.equal(shouldRejectCaveGroundStep({from:at,to:at,
    fromGroundY:10,toGroundY:9.7,variant:'classic'}),false);
});
test('full surface mountain is never cut away and E remains the sole cave session gate',()=>{
  const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
  const terrain=read('../src/components/game3d/wolfveil/WolfveilGeometry.js');
  const cave=read('../src/components/game3d/wolfveil/WolfveilCaveSystem.js');
  const play=read('../src/components/game3d/GameWorld3D.jsx');
  const map=read('../src/components/game3d/hud/AXEWorldMapOverlay.jsx');
  assert.match(terrain,/void caveCutouts;/);
  assert.match(terrain,/idx\.push\(p,q,p\+1,q,q\+1,p\+1\)/);
  assert.match(cave,/appendWolfveilCaveAccessFloor\(floorTris\)/);
  assert.match(cave,/world\.walkableSurfaces\.push\(floorMesh\)/);
  assert.match(cave,/if\(!activeCaveId\)/);
  assert.match(cave,/activeCaveId=travel\.action==='enter'\?travel\.caveId:null/);
  assert.match(cave,/resolveWolfveilCaveEntranceRailCollision/);
  assert.match(play,/wolfveilVillage\?\.interactCave\(model\.position\)/);
  assert.match(play,/caveAwareGroundY\(fromX,fromZ,model\.position\.y\)/);
  assert.match(map,/Four cave approach trails and walk-in entrances/);
});
