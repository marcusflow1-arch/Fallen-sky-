import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WOLFVEIL_TOWN_TILE_CLEANUP, planWolfveilTownTileTop,
  removeWolfveilTownRaisedTileBodies, wolfveilImportedTownHouseOverlapsTree,
} from '../src/components/game3d/wolfveil/WolfveilTownTileBodyRemoval.mjs';
import {
  WOLFVEIL_PALACE_REAR_MOUNTAIN,gradeWolfveilPalaceRearMountain,
  gradeWolfveilPalaceTerrain,
} from '../src/components/game3d/wolfveil/WolfveilPalaceGround.mjs';
import {WOLFVEIL_PALACE,WOLFVEIL_PALACE_APPROACH} from '../src/components/game3d/wolfveil/WolfveilPalaceLayout.mjs';
import {WOLFVEIL_IMPORTED_TOWN,insideWolfveilImportedTown} from '../src/components/game3d/wolfveil/WolfveilImportedTownLayout.mjs';
import {wolfveilTreePlacements,wolfveilNativeElmPlacements} from '../src/components/game3d/wolfveil/WolfveilForestLayout.js';

const IDENTITY={elements:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]};
const position=v=>({count:v.length,getX:i=>v[i][0],getY:i=>v[i][1],getZ:i=>v[i][2]});
function cube(name='Tile_01'){
  const points=[
    [0,0,0],[2,0,0],[2,0,2],[0,0,2],
    [0,2,0],[2,2,0],[2,2,2],[0,2,2],
  ];
  // First pair is the walkable roof; all other triangles are bottom and side box walls.
  const faces=[
    4,5,6,4,6,7, 0,1,2,0,2,3,
    0,1,5,0,5,4, 1,2,6,1,6,5, 2,3,7,2,7,6, 3,0,4,3,4,7,
  ];
  const geom={
    attributes:{position:position(points)},index:{array:faces},groups:[],
    setIndex(indices){this.index={array:indices};},
    clearGroups(){this.groups=[];},
    addGroup(start,count,materialIndex){this.groups.push({start,count,materialIndex});},
    computeVertexNormals(){},computeBoundingBox(){},computeBoundingSphere(){},
  };
  return {isMesh:true,name,geometry:geom,matrixWorld:IDENTITY,userData:{}};
}

test('removes 10 vertical/underground faces, leaves two top walkable faces',()=>{
  const mesh=cube();
  const result=removeWolfveilTownRaisedTileBodies(mesh);
  assert.equal(result.removedFaces,10);
  assert.equal(result.keptFaces,2);
  assert.deepEqual(mesh.geometry.index.array,[4,5,6,4,6,7]);
  assert.equal(mesh.geometry.attributes.position.getY(4),2);
  assert.equal(mesh.userData.tileTopY,2);
});

test('cleanup applies to every Tile_* mesh, never to house architecture',()=>{
  for(let i=0;i<80;i++){
    const mesh=cube('Tile_'+i);
    assert.equal(removeWolfveilTownRaisedTileBodies(mesh).keptFaces,2);
  }
  const house=cube('roof');
  assert.equal(removeWolfveilTownRaisedTileBodies(house).changed,false);
  assert.equal(house.geometry.index.array.length,36);
});

test('top selection works when normals/winding are inverted and when a tile is offset',()=>{
  const mesh=cube();
  mesh.geometry.index.array.splice(0,6,6,5,4,7,6,4);
  mesh.matrixWorld={elements:[1,0,0,0,0,1,0,0,0,0,1,0,3,7,9,1]};
  const out=planWolfveilTownTileTop(mesh.geometry,mesh.matrixWorld);
  assert.equal(out.keptFaces,2);
  assert.ok(Math.abs(out.topY-9)<1e-8);
});

test('zero-top decorative body becomes empty rather than leaving raised wall polygons',()=>{
  const mesh=cube();
  mesh.geometry.index.array=[0,1,5,0,5,4]; // vertical-only wall
  const out=removeWolfveilTownRaisedTileBodies(mesh);
  assert.equal(out.keptFaces,0);
  assert.equal(mesh.geometry.index.array.length,0);
});

test('multi-material face groups remain correctly bounded after removing lower faces',()=>{
  const mesh=cube();
  mesh.geometry.groups=[{start:0,count:6,materialIndex:1},{start:6,count:30,materialIndex:2}];
  removeWolfveilTownRaisedTileBodies(mesh);
  assert.deepEqual(mesh.geometry.groups,[{start:0,count:6,materialIndex:1}]);
});

test('actual house wall or roof mesh proximity removes only conflicting town tree',()=>{
  const makeRoot=(name,x,z)=>({
    traverse(fn){fn({isMesh:true,name,
      geometry:{attributes:{position:position([[x,6,z]])}},matrixWorld:IDENTITY});},
  });
  const tree={x:0,z:0,radius:2.4};
  assert.equal(wolfveilImportedTownHouseOverlapsTree(makeRoot('roof',1,1),tree),true);
  assert.equal(wolfveilImportedTownHouseOverlapsTree(makeRoot('roof',11,11),tree),false);
  assert.equal(wolfveilImportedTownHouseOverlapsTree(makeRoot('grass',1,1),tree),false);
});

test('a large house roof face overlapping the tree is detected even without close vertices',()=>{
  const triangle=[[-10,5,-10],[10,5,-10],[0,5,10]];
  const root={traverse(fn){fn({isMesh:true,name:'roof',
    geometry:{attributes:{position:position(triangle)},index:{array:[0,1,2]}},
    matrixWorld:IDENTITY});}};
  assert.equal(wolfveilImportedTownHouseOverlapsTree(root,{x:0,z:0,radius:2}),true);
});

test('town houses/pavers sit within 2.5cm of their shared physical ground datum',()=>{
  assert.ok(WOLFVEIL_IMPORTED_TOWN.floorLiftMeters>=0);
  assert.ok(WOLFVEIL_IMPORTED_TOWN.floorLiftMeters<=0.03);
  assert.ok(WOLFVEIL_TOWN_TILE_CLEANUP.topBandMeters<0.55);
});

test('rear mountain is half height gain in core, no changes to mansion or front stairs',()=>{
  const s=WOLFVEIL_PALACE_REAR_MOUNTAIN;
  assert.equal(s.reduction,0.5);
  assert.ok(s.startZ>WOLFVEIL_PALACE.z+WOLFVEIL_PALACE.depth/2);
  assert.ok(s.fullZ<s.fadeStartZ);
  assert.equal(gradeWolfveilPalaceRearMountain(0,s.fullZ+12,100,70),85);
  assert.equal(gradeWolfveilPalaceRearMountain(0,WOLFVEIL_PALACE_APPROACH.toZ,100,70),100);
  assert.equal(gradeWolfveilPalaceRearMountain(0,WOLFVEIL_PALACE.z,100,70),100);
  assert.equal(gradeWolfveilPalaceRearMountain(200,200,100,70),100);
  assert.equal(gradeWolfveilPalaceRearMountain(0,s.endZ,100,70),100);
});

test('rear grade joins continuously with protected mansion ground pad',()=>{
  const s=WOLFVEIL_PALACE_REAR_MOUNTAIN;
  assert.ok(Math.abs(gradeWolfveilPalaceRearMountain(0,s.startZ+0.0001,100,70)-100)<1e-5);
  assert.ok(Math.abs(gradeWolfveilPalaceRearMountain(0,s.endZ-0.0001,100,70)-100)<1e-5);
  const front=gradeWolfveilPalaceTerrain(0,WOLFVEIL_PALACE.z,100,72,60);
  assert.equal(gradeWolfveilPalaceTerrain(0,WOLFVEIL_PALACE.z,
    gradeWolfveilPalaceRearMountain(0,WOLFVEIL_PALACE.z,100,70),72,60),front);
});

test('existing authored forest trees are clear of the houses inside the imported town',()=>{
  const trees=[...wolfveilTreePlacements(),...wolfveilNativeElmPlacements()];
  for(const tree of trees)assert.equal(insideWolfveilImportedTown(tree.x,tree.z,0),false);
  for(const tree of trees)assert.ok(
    Math.abs(tree.x-WOLFVEIL_PALACE.x)>WOLFVEIL_PALACE.width/2+2 ||
    Math.abs(tree.z-WOLFVEIL_PALACE.z)>WOLFVEIL_PALACE.depth/2+2,
    'A shared tree may not stand inside the manor footprint');
});
