import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bakeWolfveilTownCollision, WOLFVEIL_TOWN_COLLISION } from '../src/components/game3d/wolfveil/WolfveilImportedTownCollision.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const floor = (x0,x1,z0,z1,y,role='floor') => ({
  role, index:null,position:new Float32Array([
    x0,y,z0, x1,y,z0, x1,y,z1,
    x0,y,z0, x1,y,z1, x0,y,z1,
  ]),
});
const verticalWall = (x,z0,z1,y0,y1) => ({
  role:'hybrid',index:null,position:new Float32Array([
    x,y0,z0, x,y1,z0, x,y1,z1,
    x,y0,z0, x,y1,z1, x,y0,z1,
  ]),
});
const bake = meshes => bakeWolfveilTownCollision({
  meshes,minX:-2,minZ:-1,maxX:4,maxZ:2,baseY:0,
});

test('precision rules do not jump full kerbs or multiple risers at once', () => {
  assert.ok(WOLFVEIL_TOWN_COLLISION.cell <= .25);
  assert.ok(WOLFVEIL_TOWN_COLLISION.stepUp <= .30);
  const surface=bake([
    floor(-2,.5,0,1,0),floor(.5,1,0,1,.22),
    floor(1,1.5,0,1,1.24),floor(1.5,3,0,1,1.24),
  ]);
  const actor={x:1.8,z:.5};
  assert.equal(surface.resolve(actor,{x:0,z:.5}),true);
  assert.ok(actor.x<1.25,'character may reach the first tread, not leap onto a high ledge');
});

test('walkable successive modest treads remain accessible, not solid', () => {
  const surface=bake([
    floor(-2,.5,0,1,0),floor(.5,1,0,1,.2),
    floor(1,1.5,0,1,.4),floor(1.5,2,0,1,.6),
  ]);
  assert.ok(surface.groundAt(.75,.5)>0.1);
  const actor={x:1.7,z:.5};
  surface.resolve(actor,{x:0,z:.5});
  assert.ok(actor.x>1.25,'character can climb consecutive reachable steps');
});

test('upright triangles in mixed tile meshes block the torso, flat ones remain walkable', () => {
  const surface=bake([floor(-2,4,0,1,0,'hybrid'),verticalWall(.85,0,1,0,2)]);
  assert.equal(surface.isSolid(.85,.5),true);
  const actor={x:2,z:.5};
  assert.equal(surface.resolve(actor,{x:-1,z:.5}),true);
  assert.ok(actor.x<.85,'wall blocks travel across the tile');
});

test('live NPC quest visor is wired to the real encounter, not a video file or still image',()=>{
  const box=read('src/components/game3d/QuestDialogueBox.jsx');
  const live=read('src/components/game3d/QuestNpcLivePortrait.jsx');
  const world=read('src/components/game3d/GameWorld3D.jsx');
  assert.match(box,/QuestNpcLivePortrait npcObject=\{npcObject\}/);
  assert.match(box,/mode === 'offer'/);
  assert.match(world,/npcObject: closestQuestNPC.group/);
  assert.match(world,/npcObject=\{activeQuestDialogue.npcObject\}/);
  assert.match(live,/cloneSkinnedModel\(npcObject\)/);
  assert.match(live,/originalNodes\[i\]/);
  assert.match(live,/cancelAnimationFrame\(frame\)/);
});

test('the town color pass is optional and never paints the flowing water',()=>{
 const finish=read('src/components/game3d/wolfveil/WolfveilTownVisualFinish.mjs');
 const scene=read('src/components/game3d/wolfveil/WolfveilImportedTownScene.mjs');
 assert.match(finish,/WATER.test\(name\)/);
 assert.match(finish,/source.map/);
 assert.match(scene,/finishWolfveilTownMaterials\(town,/);
 assert.match(scene,/bakeWolfveilTownCollision/);
});
