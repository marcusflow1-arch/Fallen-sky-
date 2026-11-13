import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 WOLFVEIL_IMPORTED_TOWN,WOLFVEIL_IMPORTED_TOWN_FLOOR_Y,
 WOLFVEIL_PLAYER_TOWN_SPAWN,insideWolfveilImportedTown,gradeWolfveilImportedTown,
} from '../src/components/game3d/wolfveil/WolfveilImportedTownLayout.mjs';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('imported assembled town has playable scale and a safe first spawn',()=>{
 assert(WOLFVEIL_IMPORTED_TOWN.width>=110&&WOLFVEIL_IMPORTED_TOWN.width<=180);
 assert(WOLFVEIL_IMPORTED_TOWN.depth>=110&&WOLFVEIL_IMPORTED_TOWN.depth<=180);
 assert(insideWolfveilImportedTown(WOLFVEIL_PLAYER_TOWN_SPAWN.x,
   WOLFVEIL_PLAYER_TOWN_SPAWN.z-70));
 assert(Math.hypot(WOLFVEIL_PLAYER_TOWN_SPAWN.x,WOLFVEIL_PLAYER_TOWN_SPAWN.z)>4.47);
});
test('canonical Wolfveil terrain grades to the town and returns to natural height',()=>{
 assert.equal(gradeWolfveilImportedTown(0,-70,90),WOLFVEIL_IMPORTED_TOWN_FLOOR_Y);
 assert.equal(gradeWolfveilImportedTown(12,-110,3),WOLFVEIL_IMPORTED_TOWN_FLOOR_Y);
 assert.equal(gradeWolfveilImportedTown(1000,1000,9),9);
 const shoulder=gradeWolfveilImportedTown(85,-70,5);
 assert(shoulder>5&&shoulder<WOLFVEIL_IMPORTED_TOWN_FLOOR_Y);
 assert.equal(gradeWolfveilImportedTown(NaN,0,5),5);
});
test('client spawn, real terrain height, old plaza retirement and server fingerprint are wired',()=>{
 assert.match(source('src/components/game3d/GameWorld3D.jsx'),/installWolfveilImportedTown\(scene/);
 assert.match(source('src/components/game3d/GameWorld3D.jsx'),/WOLFVEIL_PLAYER_TOWN_SPAWN/);
 assert.match(source('src/components/game3d/wolfveil/WolfveilLayout.js'),/gradeWolfveilImportedTown\(x,z,/);
 assert.match(source('src/components/game3d/wolfveil/WolfveilTown.js'),/importedTownAtMarket/);
 assert.match(source('server/game3d/mapCollision.mjs'),/townPlateauGradeRevision/);
});
