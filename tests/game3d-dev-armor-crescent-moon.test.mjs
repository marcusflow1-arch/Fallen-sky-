// Crescent Moon: the owner's test armor (from "SUP DATED.blend"), a DEVELOPMENT-BUILD-ONLY set.
// It must be named piece by piece, sit unequipped in the dev inventory with its picture, equip through the same
// inventory -> armor bridge chain as every other piece, and never reach loot tables or a production build.
// Run: node --test tests/game3d-dev-armor-crescent-moon.test.mjs
/* global EventTarget */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  AXE_ARMOR_PACK_SETS, AXE_ARMOR_PACK_TEMPLATES, AXE_DEV_ARMOR_SETS,
  diffAXEArmorEquip, equippedAXEArmorPieces, getAXEArmorPiece, makeAXEDevArmorItems,
} from '../src/components/game3d/axe/equipment/AXEArmorPackCatalog.js';
import { AXE_ARMOR_DROP_CONFIG, getAXEArmorDropOdds } from '../src/components/game3d/axe/loot/AXEArmorLootSystem.js';
import { isShippedArmorEntry, withEquippedArmor } from '../src/components/game3d/armor/armorEquipCore.js';
import { createAXEArmorEquipForwarder, AXE_ARMOR_EQUIP_EVENT } from '../src/components/game3d/axe/equipment/AXEArmorEquipEvents.js';

const src = (path) => fs.readFileSync(path, 'utf8');
const SLOTS = ['helmet', 'chest', 'pants', 'gloves', 'boots', 'cape'];
const NAMES = {
  helmet: 'Crescent Moon Helmet', chest: 'Crescent Moon Chestplate', pants: 'Crescent Moon Pants',
  gloves: 'Crescent Moon Gloves', boots: 'Crescent Moon Boots', cape: 'Crescent Moon Cape',
};
const manifest = JSON.parse(src('public/models/characters/fused/armor/manifest.json'));

test('every Crescent Moon piece is its own named item', () => {
  assert.equal(AXE_DEV_ARMOR_SETS.length, 1);
  const set = AXE_DEV_ARMOR_SETS[0];
  assert.equal(set.id, 'crescent_moon');
  assert.equal(set.label, 'Crescent Moon');
  assert.deepEqual(set.pieces.map((p) => p.armorSlot), SLOTS);
  for (const piece of set.pieces) {
    assert.equal(piece.label, NAMES[piece.armorSlot]);
    assert.equal(piece.pieceId, `crescent_moon_${piece.armorSlot}`);
  }
  const items = makeAXEDevArmorItems();
  assert.deepEqual(items.map((i) => i.name), SLOTS.map((s) => NAMES[s]));
  assert.equal(new Set(items.map((i) => i.id)).size, 6, 'six distinct items');
});

test('the dev items start in the inventory unequipped, with the piece picture as the icon', () => {
  for (const item of makeAXEDevArmorItems()) {
    assert.equal(item.equipped, false, `${item.name} starts unequipped`);
    assert.equal(item.source, 'dev_loadout');
    assert.equal(item.devGrant, true);
    assert.equal(item.tradeable, false);
    assert.equal(item.setId, 'crescent_moon');
    assert.match(item.iconUrl, /^\/models\/characters\/fused\/armor\/crescent_moon\/female_(helmet|chest|pants|gloves|boots|cape)\.jpg$/);
    assert.ok(fs.existsSync(`public${item.iconUrl}`), `${item.iconUrl} is shipped`);
    assert.equal(fs.readFileSync(`public${item.iconUrl}`).subarray(0, 2).toString('hex'), 'ffd8', 'a JPEG');
    assert.equal(item.appearance.armorSet, 'crescent_moon');
    assert.equal(item.appearance.armorPiece, `crescent_moon_${item.appearance.armorSlot}`);
    // the picture is the one the manifest names for the piece
    const entry = manifest.female.find((m) => m.id === item.appearance.armorPiece);
    assert.equal(entry.thumbnail, item.iconUrl);
  }
});

test('equipping and unequipping a Crescent Moon item reaches the armor bridge like any armor piece', () => {
  const items = makeAXEDevArmorItems();
  const worn = (...names) => items.map((i) => ({ ...i, equipped: names.includes(i.name) }));
  assert.deepEqual(equippedAXEArmorPieces(worn()), {});
  assert.deepEqual(equippedAXEArmorPieces(worn(NAMES.helmet, NAMES.chest, NAMES.pants, NAMES.gloves, NAMES.boots, NAMES.cape)), {
    helmet: 'crescent_moon_helmet', chest: 'crescent_moon_chest', pants: 'crescent_moon_pants',
    gloves: 'crescent_moon_gloves', boots: 'crescent_moon_boots', cape: 'crescent_moon_cape',
  });
  assert.deepEqual(diffAXEArmorEquip({ helmet: 'crescent_moon_helmet' }, {}), [{ slot: 'helmet', id: null }]);

  const target = new EventTarget();
  const events = [];
  target.addEventListener(AXE_ARMOR_EQUIP_EVENT, (e) => events.push(e.detail));
  let push;
  createAXEArmorEquipForwarder({ target, subscribe: (fn) => { push = fn; fn({ items: worn() }); return () => {}; } });
  push({ items: worn(NAMES.helmet) });
  push({ items: worn() });
  assert.deepEqual(events, [
    { id: 'crescent_moon_helmet', source: 'inventory' },
    { slot: 'helmet', id: null, source: 'inventory' },
  ]);
});

test('a Crescent Moon piece on the wrong item slot is ignored (a doctored save cannot put a cape on a helm)', () => {
  const cape = makeAXEDevArmorItems().find((i) => i.appearance.armorSlot === 'cape');
  assert.equal(getAXEArmorPiece({ ...cape, slot: 'helm', category: 'helm' }), null);
  assert.deepEqual(getAXEArmorPiece(cape), { slot: 'cape', id: 'crescent_moon_cape' });
});

test('Crescent Moon never enters the loot catalog or the drop tables', () => {
  assert.ok(!AXE_ARMOR_PACK_SETS.some((s) => s.id === 'crescent_moon'));
  assert.ok(!AXE_ARMOR_PACK_TEMPLATES.some((t) => /crescent/.test(t.id)));
  for (const tier of Object.keys(AXE_ARMOR_DROP_CONFIG.chanceByTier)) {
    for (const isBoss of [false, true]) {
      const { odds } = getAXEArmorDropOdds(tier, isBoss);
      assert.ok(!Object.keys(odds).some((id) => /crescent/.test(id)), `${tier}${isBoss ? ' boss' : ''}: no Crescent Moon odds`);
    }
  }
  assert.equal(AXE_ARMOR_PACK_SETS.length, 8, 'the production loot catalog is unchanged');
  assert.equal(AXE_ARMOR_PACK_TEMPLATES.length, 37);
});

test('only the dev-build inventory seed can hand the set out', () => {
  const data = src('src/components/game3d/equipment/inventoryData.jsx');
  const grants = [...data.matchAll(/makeAXEDevArmorItems\(\)/g)];
  assert.equal(grants.length, 1, 'one call');
  const at = grants[0].index;
  const guard = data.slice(0, at).lastIndexOf('if (import.meta.env?.DEV)');
  assert.ok(guard > 0 && at - guard < 200, 'the grant sits directly inside an import.meta.env?.DEV block');
  assert.ok(!/AXE_DEV_ARMOR_SETS/.test(data), 'the seed file does not read the dev set list itself');
  // nothing else in the app grants or lists the dev sets
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(`${dir}/${d.name}`) : [`${dir}/${d.name}`]));
  const users = walk('src').filter((f) => /\.(js|jsx|ts|tsx)$/.test(f)).filter((f) => /AXE_DEV_ARMOR_SETS|makeAXEDevArmorItems/.test(src(f)));
  assert.deepEqual(users.sort(), [
    'src/components/game3d/axe/equipment/AXEArmorPackCatalog.js',
    'src/components/game3d/equipment/inventoryData.jsx',
  ]);
  // the store puts a missing dev piece back, so an existing dev save also gets the test armor
  const store = src('src/components/game3d/axe/equipment/AXEEquipmentInventoryStore.js');
  assert.match(store, /if \(starter\.devGrant \|\| shouldAddNewStarters\) byId\.set\(starter\.instanceId, starter\);/);
});

test('the creator and the equip bridge drop dev_only manifest entries outside a development build', () => {
  assert.equal(isShippedArmorEntry({ id: 'nightscale_helmet' }, false), true);
  assert.equal(isShippedArmorEntry({ id: 'crescent_moon_helmet', dev_only: true }, false), false);
  assert.equal(isShippedArmorEntry({ id: 'crescent_moon_helmet', dev_only: true }, undefined), false);
  assert.equal(isShippedArmorEntry({ id: 'crescent_moon_helmet', dev_only: true }, true), true);
  const layers = src('src/components/onboarding/creatorBuiltinLayers.js');
  assert.match(layers, /isShippedArmorEntry\(entry,import\.meta\.env\?\.DEV===true\)/);
  assert.equal((layers.match(/\.filter\(isShipped\)/g) || []).length, 2, 'both bodies are filtered');
  // every Crescent Moon manifest entry (and its set) carries the flag
  assert.equal(manifest.sets.find((s) => s.id === 'crescent_moon')?.dev_only, true);
  const entries = [...manifest.female, ...manifest.male].filter((m) => m.set === 'crescent_moon');
  assert.equal(entries.length, 6);
  assert.ok(entries.every((m) => m.dev_only === true && m.gender === 'female'), 'Eve only, all flagged dev_only');
  assert.ok([...manifest.female, ...manifest.male].filter((m) => m.set !== 'crescent_moon').every((m) => !m.dev_only), 'other sets are not flagged');
});

test('a Crescent Moon equip applies on Eve and is ignored on Adam (not fitted to him)', () => {
  const pieces = manifest.female.filter((m) => m.set === 'crescent_moon').map((m) => ({ ...m }));
  const eve = { selected_assets: {}, customization_assets: [] };
  const dressed = withEquippedArmor(eve, { helmet: 'crescent_moon_helmet', cape: 'crescent_moon_cape' }, pieces, SLOTS);
  assert.deepEqual(Object.keys(dressed.selected_assets).sort(), ['cape', 'helmet']);
  assert.equal(dressed.customization_assets.length, 2);
  assert.equal(withEquippedArmor(eve, { helmet: 'crescent_moon_helmet' }, [], SLOTS).selected_assets.helmet, undefined, 'no piece for this body: nothing worn');
  assert.deepEqual(withEquippedArmor(dressed, { helmet: '' }, pieces, SLOTS).selected_assets, { cape: 'crescent_moon_cape' }, 'unequip removes only that slot');
});
