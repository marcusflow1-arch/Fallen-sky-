import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  AXE_HUD_WEAPON_ROLES, eligibleRoleWeapons, selectRoleWeapon, roleForCycle,
} from '../src/components/game3d/axe/weapons/AXEWeaponRoleSlots.mjs';

const sword={instanceId:'wp1',name:'True Heart Sword',category:'weapon',slot:'weapon',axeWeaponRole:'offensive'};
const dagger={instanceId:'wp2',name:'Whisper Dagger',category:'weapon',slot:'weapon',axeWeaponRole:'defensive'};
const bow={instanceId:'wp3',name:'Training Bow',category:'weapon',slot:'weapon',axeWeaponRole:'ranged',iconUrl:'/game3d/test-gear/training-bow.svg'};
const owned=[sword,dagger,bow];
const role=item=>item.axeWeaponRole;
const read=p=>fs.readFileSync(p,'utf8');

test('curved sockets keep Damage, Defense and Ranged labels without changing player gear',()=>{
  assert.deepEqual(AXE_HUD_WEAPON_ROLES.map(x=>x.role),['offensive','defensive','ranged']);
  assert.equal(eligibleRoleWeapons(owned,'offensive',role).length,1);
  assert.equal(selectRoleWeapon(owned,'ranged',null,null,role).instanceId,'wp3');
});

test('player may assign ANY owned weapon to ANY socket, with sensible default fallback',()=>{
  assert.equal(selectRoleWeapon(owned,'offensive','wp3','wp1',role).name,'Training Bow');
  assert.equal(selectRoleWeapon(owned,'defensive','wp1','wp2',role).name,'True Heart Sword');
  assert.equal(selectRoleWeapon(owned,'offensive',null,'wp1',role).name,'True Heart Sword');
  assert.equal(selectRoleWeapon(owned,'ranged',null,'wp1',role).name,'Training Bow');
  assert.equal(selectRoleWeapon(owned,'unrecognized','wp1','wp1',role),null);
  assert.equal(selectRoleWeapon([{...bow,category:'armor'}],'ranged','wp3',null,role),null);
});

test('left and right cycle every slot and correctly handle missing/unknown current role',()=>{
  const slots=AXE_HUD_WEAPON_ROLES.map(x=>x.role);
  assert.equal(roleForCycle(slots,'offensive',-1),'ranged');
  assert.equal(roleForCycle(slots,'ranged',1),'offensive');
  assert.equal(roleForCycle(slots,'missing',1),'offensive');
  assert.equal(roleForCycle(slots,'missing',-1),'ranged');
  assert.equal(roleForCycle([],null,1),null);
});

test('three real clickable transparent sockets display actual icon/thumbnail when supplied',()=>{
  const jsx=read('src/components/game3d/axe/weapons/AXECurvedWeaponTemplate.jsx');
  assert.match(jsx,/jade-curved-weapon-template/);
  assert.match(jsx,/jade-weapon-curve-glow/);
  assert.match(jsx,/rows\.map\(row=>/);
  assert.match(jsx,/onClick=\{\(\)=>onDraw\(row\.role\)\}/);
  assert.match(jsx,/onClick=\{\(\)=>onAssign\(row\.role\)\}/);
  assert.match(jsx,/getAXEWeaponHUDArtwork\(item\)/);
  assert.match(jsx,/src=\{artwork\}/);
  assert.match(jsx,/onError=\{event=>/);
  assert.match(jsx,/role="group" aria-label="Weapon quick slots"/);
  assert.match(jsx,/onClick=\{\(\)=>onCycle\(-1\)\}/);
  assert.match(jsx,/onClick=\{\(\)=>onCycle\(1\)\}/);
});

test('arrows, favorite, hover wheel and touch swipe connect to the real inventory switch',()=>{
  const hud=read('src/components/game3d/hud/JadeSoulHUD.jsx');
  const storage=read('src/components/game3d/axe/weapons/AXEWeaponRoleSlots.js');
  assert.match(hud,/key==='ArrowLeft'\)cycleAvailable\(-1\)/);
  assert.match(hud,/key==='ArrowRight'\|\|key==='KeyC'\)cycleAvailable\(1\)/);
  assert.match(hud,/else drawFavorite\(\)/);
  assert.match(hud,/addEventListener\('wheel',onWheel,\{passive:false\}\)/);
  assert.match(hud,/onTouchEnd=\{e=>/);
  assert.match(hud,/window\.__axePauseMenuOpen\|\|window\.__axeUiModalOpen/);
  assert.match(hud,/window\.__axeServiceModeOpen\|\|window\.__axeWorldMapOpen/);
  assert.match(storage,/switchAXEInventoryWeapon\(item\.instanceId,context\)/);
  assert.match(storage,/getAXEInventoryItemsByCategory\('weapon'\)/);
  assert.match(storage,/next\[other\.role\]===instanceId\)next\[other\.role\]=null/);
});

test('CSS builds the blue/gold C-arc about 25% smaller, keeping the rest of the HUD intact',()=>{
  const css=read('src/components/game3d/hud/JadeSoulHUD.css');
  assert.match(css,/Approved FIRST curved blue-gold concept/);
  assert.match(css,/width:clamp\(240px,22vw,308px\)/);
  assert.match(css,/height:clamp\(239px,35vh,320px\)/);
  assert.match(css,/\.jade-weapon-curve-glow\s*\{/);
  assert.match(css,/\.jade-curved-weapon-template \[data-active="true"\]/);
  assert.match(css,/\.jade-curved-weapon-template \.jade-weapon-legend/);
  assert.match(css,/@media \(max-height: 580px\)/);
  assert.match(css,/\.jade-hud \.jade-weapon-position \.jade-weapon-chooser/);
});
