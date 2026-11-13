import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const catalog = read('src/components/game3d/equipment/inventoryData.jsx');
const store = read('src/components/game3d/axe/equipment/AXEEquipmentInventoryStore.js');
const grid = read('src/components/game3d/equipment/GearInventoryGrid.jsx');
const detail = read('src/components/game3d/equipment/GearDetailPanel.jsx');

test('two independent existing armor models are offered as test sets', () => {
 assert.match(catalog, /label: 'Full Set 1', setId: 'nightscale'/);
 assert.match(catalog, /label: 'Full Set 2', setId: 'frostwarden'/);
 assert.match(catalog, /makeAXEArmorTemplate\(set, piece\)/);
 assert.match(catalog, /test_full_set_\$\{index \+ 1\}_\$\{piece.slot\}/);
 assert.match(catalog, /equipped: false/);
});

test('three real ranged inventory weapons use canonical bow identity', () => {
 for (const id of ['test_training_bow', 'test_hunter_bow', 'test_moon_bow'])
   assert.ok(catalog.includes(id), id);
 assert.match(catalog, /masteryWeaponId: 'bow'/);
 assert.match(catalog, /axeWeaponRole: 'ranged'/);
 assert.match(catalog, /slot: 'weapon'/);
});

test('version-two migration does not resurrect destroyed original starters', () => {
 assert.match(store, /CURRENT_STARTER_CATALOG_VERSION = 2/);
 assert.match(store, /previousCatalogVersion < Number\(starter.introducedVersion \|\| 1\)/);
 assert.match(catalog, /introducedVersion: 2/);
});

test('inventory and item details render asset pictures rather than only glyph icons', () => {
 assert.match(grid, /src=\{item.iconUrl\}/);
 assert.match(grid, /onError=/);
 assert.match(detail, /src=\{item.iconUrl\}/);
 for (const name of ['training-bow.svg','hunter-longbow.svg','moon-recurve-bow.svg'])
   assert.ok(catalog.includes(name), name);
});

test('all Game 3D inventory surfaces use the miniature equipment art', () => {
 for (const path of [
  'src/components/game3d/axe/services/AXEGlobalServicesMenu.jsx',
  'src/components/game3d/progression/hub/CharacterInventoryTab.jsx',
  'src/components/game3d/axe/services/AXEGlassLoadoutPane.jsx',
 ]) assert.match(read(path), /iconUrl/);
 assert.match(read('src/components/game3d/axe/services/AXEGlassLoadoutPane.jsx'), /data:image/);
});

test('both fitted armor sets have the male and female GLB files needed for equipment', () => {
 const manifest = JSON.parse(read('public/models/characters/fused/armor/manifest.json'));
 for (const set of ['nightscale','frostwarden']) {
  assert(manifest.sets.some(s=>s.id===set));
  for (const gender of ['male','female']) {
   const entries = manifest[gender].filter(piece => piece.set === set);
   assert.equal(entries.length,6,`${set} ${gender} missing pieces`);
   for (const piece of entries) {
    const filename = new URL('../public'+piece.url, import.meta.url);
    const bytes = readFileSync(filename);
    assert.equal(bytes.toString('ascii',0,4), 'glTF', piece.url);
    assert.equal(bytes.readUInt32LE(4), 2, piece.url);
    assert(piece.thumbnail.startsWith('/models/') || piece.thumbnail.startsWith('data:image/jpeg;base64,'));
   }
  }
 }
});
