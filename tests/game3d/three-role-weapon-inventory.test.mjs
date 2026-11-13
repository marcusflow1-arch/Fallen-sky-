import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root=process.cwd();
const temp=await mkdtemp(path.join(tmpdir(),'axe-3roles-'));
const dom=new JSDOM('',{url:'http://localhost/'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,
  localStorage:dom.window.localStorage,CustomEvent:dom.window.CustomEvent});
const modules={
  roles:'axe/weapons/AXEWeaponRoleSlots.js',
  inv:'axe/equipment/AXEEquipmentInventoryStore.js',
  storage:'characterStorage.jsx',
  identity:'axe/weapons/AXEWeaponIdentityMount.jsx',
  buffs:'weaponClassBuffStore.jsx',
};
await build({stdin:{contents:Object.entries(modules).map(([name,file])=>
  `export * as ${name} from './src/components/game3d/${file}';`).join('\n'),resolveDir:root},
  bundle:true,jsx:'automatic',format:'esm',platform:'node',outfile:path.join(temp,'role-stores.mjs'),
  alias:{'@':path.join(root,'src')},define:{'import.meta.env':'{}'},
  plugins:[{name:'offline-service-boundary',setup(b){
    b.onResolve({filter:/api\/base44Client/},()=>({path:'base44-test',namespace:'offline'}));
    b.onLoad({filter:/.*/,namespace:'offline'},()=>({contents:
      'export const base44 = {auth:{updateMe:async()=>({}), me:async()=>({})}};'}));
  }}],logLevel:'silent'});
const {roles,inv,storage,identity,buffs}=await import(pathToFileURL(path.join(temp,'role-stores.mjs')));
const unbind=identity.bindAXEWeaponIdentity();
after(async()=>{unbind();dom.window.close();await rm(temp,{recursive:true,force:true});});
const item=(name,axeWeaponRole,extra={})=>({id:name.toLowerCase().replace(/\W+/g,'_'),name,
  slot:'weapon',category:'weapon',axeWeaponRole,rarity:'common',baseStats:{damage:8},...extra});
let serial=0;
function fresh(){
  storage.setStorageUser('role-hud-qa-'+(++serial));
  inv.resetAXEEquipmentInventoryToStarter();
  for(const equipped of inv.getEquippedAXEItemsByCategory('weapon'))
    inv.unequipAXEInventoryItem(equipped.instanceId);
  const sword=inv.addAXEEquipmentItem(item('Crimson Sword','offensive'),{equipped:true}).item;
  const shield=inv.addAXEEquipmentItem(item('Bastion Dual Blades','defensive')).item;
  const bow=inv.addAXEEquipmentItem(item('Moonrise Bow','ranged')).item;
  return {sword,shield,bow};
}
test('three slots retain per-character assignments while only the selected owned weapon drives combat',()=>{
  const {sword,shield,bow}=fresh();
  assert.ok(roles.assignAXEHUDWeaponRole('offensive',sword.instanceId).ok);
  assert.ok(roles.assignAXEHUDWeaponRole('defensive',shield.instanceId).ok);
  assert.ok(roles.assignAXEHUDWeaponRole('ranged',bow.instanceId).ok);
  assert.equal(roles.assignAXEHUDWeaponRole('defensive',bow.instanceId).reason,'WEAPON_NOT_OWNED_OR_WRONG_ROLE');
  assert.equal(roles.getAXEHUDWeaponRoles().ranged,bow.instanceId);
  assert.equal(roles.getAXERoleWeapon('ranged').instanceId,bow.instanceId);

  const damage=roles.drawAXEHUDWeaponRole('offensive',{level:20});
  assert.ok(damage.ok);assert.equal(identity.getActiveAXEWeaponIdentity().role,'offensive');
  assert.equal(buffs.getActiveWeaponPath(),'damage');

  const ranged=roles.drawAXEHUDWeaponRole('ranged',{level:20});
  assert.ok(ranged.ok);assert.equal(inv.getActiveEquippedAXEWeapon().instanceId,bow.instanceId);
  assert.equal(identity.getActiveAXEWeaponIdentity().role,'ranged');
  assert.equal(buffs.getActiveWeaponPath(),'ranged');

  const guard=roles.drawAXEHUDWeaponRole('defensive',{level:20});
  assert.ok(guard.ok);assert.equal(inv.getActiveEquippedAXEWeapon().instanceId,shield.instanceId);
  assert.equal(identity.getActiveAXEWeaponIdentity().role,'defensive');
  assert.equal(buffs.getActiveWeaponPath(),'defense');
  assert.ok(inv.getEquippedAXEItemsByCategory('weapon').length<=2,
    'weapon swapping must never stack the bonuses of all three role slots');

  storage.setStorageUser('role-qa-other');
  assert.deepEqual(roles.getAXEHUDWeaponRoles(),{offensive:null,defensive:null,ranged:null});
  storage.setStorageUser('role-hud-qa-'+serial);
  assert.equal(roles.getAXEHUDWeaponRoles().ranged,bow.instanceId);
});

test('empty and invalid assignments cannot change inventory',()=>{
  fresh();
  assert.equal(roles.drawAXEHUDWeaponRole('invalid',{level:20}).reason,'INVALID_ROLE');
  assert.equal(roles.assignAXEHUDWeaponRole('invalid','x').reason,'INVALID_ROLE');
  assert.equal(roles.assignAXEHUDWeaponRole('ranged','not-owned').reason,'WEAPON_NOT_OWNED_OR_WRONG_ROLE');
  assert.ok(roles.getOwnedWeaponsForAXERole('ranged').length>0);
  assert.equal(roles.getAXEHUDWeaponRoles().ranged,null);
});
