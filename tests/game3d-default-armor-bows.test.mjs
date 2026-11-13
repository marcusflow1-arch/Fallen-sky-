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
