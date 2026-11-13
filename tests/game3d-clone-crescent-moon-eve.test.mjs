import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AXE_DEV_ARMOR_SETS, AXE_ARMOR_PACK_SETS, makeAXEDevArmorItems, getAXEArmorPiece } from '../src/components/game3d/axe/equipment/AXEArmorPackCatalog.js';
import { isShippedArmorEntry, withEquippedArmor } from '../src/components/game3d/armor/armorEquipCore.js';
const manifest=JSON.parse(fs.readFileSync(new URL('../public/models/characters/fused/armor/manifest.json', import.meta.url)));
const pieces=manifest.female.filter(x=>x.set==='crescent_moon');
test('clone includes Eve-only Crescent Moon assets with original fitted pairings',()=>{
  assert.equal(pieces.length,6);
  assert.equal(manifest.male.filter(x=>x.set==='crescent_moon').length,0);
  assert.equal(manifest.sets.find(x=>x.id==='crescent_moon')?.dev_only,true);
  for(const p of pieces){
    assert.equal(p.dev_only,true);assert.equal(p.gender,'female');
    assert.equal(p.rig_id,'fused-female-v1');
    for(const f of [p.url,p.thumbnail])assert.ok(fs.existsSync(new URL('../public'+f,import.meta.url)),f);
    assert.equal(isShippedArmorEntry(p,false),false);
    assert.equal(isShippedArmorEntry(p,true),true);
  }
});
test('clone inventory provides six separate unequipped dev items, absent from loot catalog',()=>{
  assert.equal(AXE_DEV_ARMOR_SETS.length,1);
  assert.ok(!AXE_ARMOR_PACK_SETS.some(s=>s.id==='crescent_moon'));
  const items=makeAXEDevArmorItems();
  assert.equal(items.length,6);assert.ok(items.every(x=>x.devGrant===true&&!x.equipped&&!x.tradeable));
  for(const x of items){assert.ok(x.iconUrl?.endsWith('.jpg'));assert.ok(getAXEArmorPiece(x));}
});
test('clone equipment overlay respects each slot and cannot dress Adam with Eve-only pieces',()=>{
  const a=pieces.map(x=>({id:x.id,slot:x.slot,rig_id:x.rig_id}));
  const base={selected_assets:{},customization_assets:[]};
  const next=withEquippedArmor(base,{helmet:'crescent_moon_helmet',cape:'crescent_moon_cape'},a,['helmet','cape']);
  assert.equal(next.selected_assets.helmet,'crescent_moon_helmet');
  assert.equal(next.selected_assets.cape,'crescent_moon_cape');
  const adam=withEquippedArmor(base,{helmet:'crescent_moon_helmet'},[],['helmet']);
  assert.equal(adam.selected_assets.helmet,undefined);
});
test('clone keeps DEV-only inventory gate, inventory persistence and active avatar bridge',()=>{
  const inv=fs.readFileSync(new URL('../src/components/game3d/equipment/inventoryData.jsx',import.meta.url),'utf8');
  const store=fs.readFileSync(new URL('../src/components/game3d/axe/equipment/AXEEquipmentInventoryStore.js',import.meta.url),'utf8');
  const avatar=fs.readFileSync(new URL('../src/components/game3d/useGameAvatar.js',import.meta.url),'utf8');
  assert.match(inv,/if \(import\.meta\.env\?\.DEV\)/);
  assert.match(store,/starter\.devGrant \|\| previousCatalogVersion/);
  assert.match(avatar,/useArmoredAppearance/);
  assert.match(avatar,/game3dCharacterModel\(localCharacter\|\|appearance\)/);
});
