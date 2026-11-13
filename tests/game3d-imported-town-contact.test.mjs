import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const town=source('src/components/game3d/wolfveil/WolfveilImportedTownScene.mjs');
const world=source('src/components/game3d/GameWorld3D.jsx');

test('imported town collision uses rendered mesh triangles and preserves plaza walkways',()=>{
 assert.match(town,/function buildTownObstacles\(town\)/);
 assert.match(town,/box\.max\.y-box\.min\.y<\.75/);
 assert.match(town,/function sweepTownContact\(/);
 assert.match(town,/intersectObject\(obstacle\.mesh,false\)/);
 assert.match(town,/position\.x=previous\.x;position\.z=previous\.z/);
 assert.match(world,/importedSpawnTown\?\.resolveCollision\(model\.position,mounted \? \.90 : \.62/);
});
test('water is bounded to low horizontal blue surfaces, not roofs or walls',()=>{
 assert.match(town,/function isImportedTownWaterTile\(/);
 assert.match(town,/const horizontal=box\.max\.y-box\.min\.y<\.45/);
 assert.match(town,/WOLFVEIL_IMPORTED_TOWN_FLOOR_Y\+1\.3/);
 assert.match(town,/function installImportedTownWater\(/);
 assert.match(town,/get waterTileCount\(\)/);
 assert.match(world,/importedSpawnTown\?\.update\(delta\)/);
});
test('shared real ground remains and importer disposes its water/contact cache',()=>{
 assert.match(world,/groundMeshes\.push\(grassGround\)/);
 assert.match(town,/obstacles=\[\];state='disposed'/);
 assert.match(town,/water\?\.dispose\(\)/);
 assert.doesNotMatch(town,/buildWolfveilTerrain\(/);
});
