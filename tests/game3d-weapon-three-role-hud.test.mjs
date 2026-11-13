import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AXE_HUD_WEAPON_ROLES, eligibleRoleWeapons, selectRoleWeapon, roleForCycle,
} from '../src/components/game3d/axe/weapons/AXEWeaponRoleSlots.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const weapon=(instanceId,name,role)=>({instanceId,name,category:'weapon',slot:'weapon',axeWeaponRole:role});
const owned=[
  weapon('sword-1','Amber Sword','offensive'),
  weapon('shield-1','Bastion Twin Blades','defensive'),
  weapon('bow-1','Moon Bow','ranged'),
  weapon('bow-2','Sun Bow','ranged'),
  {instanceId:'cape-1',category:'cape',slot:'cape',axeWeaponRole:'offensive'},
];
const role=item=>item.axeWeaponRole;

test('exactly three identity slots, without invented weapons or simultaneous equips',()=>{
  assert.deepEqual(AXE_HUD_WEAPON_ROLES.map(x=>x.role),['offensive','defensive','ranged']);
  assert.deepEqual(AXE_HUD_WEAPON_ROLES.map(x=>x.label),['Damage','Defense','Ranged']);
  assert.deepEqual(AXE_HUD_WEAPON_ROLES.map(x=>x.icon),['sword','shield','crosshair']);
  assert.equal(eligibleRoleWeapons(owned,'offensive',role).length,1);
  assert.equal(eligibleRoleWeapons(owned,'ranged',role).length,2);
  assert.equal(eligibleRoleWeapons(owned,'nonexistent',role).length,0);
  assert.equal(selectRoleWeapon([], 'ranged',null,null,role),null);
});

test('assignment always respects identity and ownership, with active and one-owned fallback',()=>{
  assert.equal(selectRoleWeapon(owned,'ranged','bow-2','bow-1',role).instanceId,'bow-2');
  assert.equal(selectRoleWeapon(owned,'ranged',null,'bow-1',role).instanceId,'bow-1');
  assert.equal(selectRoleWeapon(owned,'ranged',null,null,role),null);
  assert.equal(selectRoleWeapon(owned,'offensive',null,null,role).instanceId,'sword-1');
  assert.equal(selectRoleWeapon(owned,'defensive','bow-2',null,role).instanceId,'shield-1');
  assert.equal(selectRoleWeapon(owned,'offensive','cape-1',null,role).instanceId,'sword-1');
  assert.equal(eligibleRoleWeapons([weapon('fake','Fake Bow','offensive')],'ranged',role).length,0);
});

test('wheel and C-key cycle all three roles predictably',()=>{
  const roles=AXE_HUD_WEAPON_ROLES.map(r=>r.role);
  assert.equal(roleForCycle(roles,'offensive',1),'defensive');
  assert.equal(roleForCycle(roles,'defensive',1),'ranged');
  assert.equal(roleForCycle(roles,'ranged',1),'offensive');
  assert.equal(roleForCycle(roles,'offensive',-1),'ranged');
});

test('HUD writes assignments through character-scoped store and draws through inventory transaction',()=>{
  const module=read('src/components/game3d/axe/weapons/AXEWeaponRoleSlots.js');
  const ui=read('src/components/game3d/hud/JadeSoulHUD.jsx');
  const css=read('src/components/game3d/hud/JadeSoulHUD.css');
  const world=read('src/components/game3d/GameWorld3D.jsx');
  const identity=read('src/components/game3d/axe/weapons/AXEWeaponIdentityMount.jsx');
  for(const phrase of [
    "characterScopedStorage('axe_hud_weapon_roles_v1')",
    'subscribeCharacterChange(()=>{assignments=read();emit();})',
    'storage.setChecked(JSON.stringify(next))',
    'switchAXEInventoryWeapon(item.instanceId,context)',
    "getAXEInventoryItemsByCategory('weapon')",
  ]) assert.ok(module.includes(phrase),phrase);
  for(const phrase of [
    'AXE_HUD_WEAPON_ROLES.map(row=>','drawAXEHUDWeaponRole(role,{level:playerLevel||1})',
    'assignAXEHUDWeaponRole(role,id)','getOwnedWeaponsForAXERole(assigning)',
    "el.addEventListener('wheel',onWheel,{passive:false})",
    "e.code!=='KeyC'",'aria-pressed={isActive}','onClick={()=>performDraw(row.role)}',
  ]) assert.ok(ui.includes(phrase),phrase);
  assert.match(css,/\.jade-weapon-role-icon/);
  assert.match(css,/\.jade-weapon-card\.is-active/);
  assert.match(css,/\.jade-weapon-chooser/);
  assert.match(world,/getActiveWeaponPath\(\)/);
  assert.match(identity,/subscribeAXEEquipmentInventory\(syncFromEquipment\)/);
});

test('Mixamo montage is enabled by default for both fused models with bound tracks and native fallbacks',()=>{
  const montage=read('src/components/game3d/player/uploadedAnimationMontage.mjs');
  const library=read('src/components/game3d/player/playerAnimationLibrary.jsx');
  assert.match(montage,/\/\^fused-\(\?:female\|male\)\(\?:-\|\$\)\/i/);
  assert.match(montage,/enabled = usesUploadedPlayerMontage\(target\)/);
  assert.match(montage,/Unbound montage track:/);
  assert.match(library,/initialPlayerAnimationClips\(target\)/);
  assert.match(library,/onMontageReady/);
  assert.match(library,/Object\.assign\(clipsByKey,await montagePromise\)/);
});
