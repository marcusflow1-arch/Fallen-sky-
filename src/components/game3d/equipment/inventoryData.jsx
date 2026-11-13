// AXE Prompt 018 inventory seed data.
// Existing UI reads this object directly; each entry now includes enough metadata
// for the AXE equipment adapter to validate/evaluate item instances.

import { Swords, Shield, Shirt, HardHat, Footprints, Hand, Gem, Sparkles, Wind, Layers3 } from 'lucide-react';
import { AXE_ARMOR_PACK_SETS, makeAXEArmorTemplate } from '../axe/equipment/AXEArmorPackCatalog';

export const CATEGORY_ICONS = {
  weapon: Swords,
  helm: HardHat,
  chest: Shirt,
  gloves: Hand,
  legs: Shield,
  boots: Footprints,
  accessory: Gem,
  trinket: Sparkles,
  cape: Layers3,
  wings: Wind,
  costume: Shirt,
  auxiliary: Sparkles,
};

const gear = (item) => ({
  rarity: 'common',
  qualityBand: 0,
  baseStats: {},
  rolledStats: {},
  reinforcement: { level: 0, percent: 0 },
  enchantment: { level: 0 },
  sockets: [],
  aura: null,
  core: null,
  bindState: 'unbound',
  tradeable: true,
  ...item,
});

export const INVENTORY = {
  weapon: [
    gear({ id: 'wp_truesword', name: 'True Heart — Sword', type: 'Weapon — Sword', slot: 'weapon', masteryWeaponId: 'sword', axeWeaponRole: 'offensive', mastery: 7, tier: 1, atk: '2-3', durability: '99/100', level: 1, equipped: true, locked: false, rarity: 'rare', qualityBand: 10, baseStats: { attack: 6 } }),
    gear({ id: 'wp_dagger', name: 'Whisper Dagger', type: 'Weapon — Dagger', slot: 'weapon', masteryWeaponId: 'dual_blades', axeWeaponRole: 'defensive', mastery: 3, tier: 1, atk: '1-2', durability: '88/100', level: 1, equipped: false, locked: false, baseStats: { attack: 6 } }),
    gear({ id: 'wp_fan', name: 'Painted Fan', type: 'Weapon — Fan', slot: 'weapon', masteryWeaponId: 'sky', axeWeaponRole: 'offensive', mastery: 2, tier: 1, atk: '1-2', durability: '92/100', level: 1, equipped: false, locked: false, baseStats: { attack: 6, spirit: 2 } }),
  ],
  helm: [
    gear({ id: 'hl_hood', name: "Wanderer's Hood", type: 'Helm', slot: 'helm', mastery: 1, tier: 1, atk: '—', durability: '70/100', level: 1, equipped: true, locked: false, baseStats: { defense: 1, maxHP: 8 } }),
  ],
  chest: [
    gear({ id: 'ch_robe', name: 'Linen Robe', type: 'Chest', slot: 'chest', mastery: 1, tier: 1, atk: '—', durability: '95/100', level: 1, equipped: true, locked: false, baseStats: { defense: 3, maxHP: 20 } }),
  ],
  gloves: [
    gear({ id: 'gl_wraps', name: 'Cloth Wraps', type: 'Gloves', slot: 'gloves', mastery: 1, tier: 1, atk: '—', durability: '80/100', level: 1, equipped: true, locked: false, baseStats: { attack: 2 } }),
  ],
  legs: [
    gear({ id: 'lg_pants', name: 'Travel Pants', type: 'Legs', slot: 'legs', mastery: 1, tier: 1, atk: '—', durability: '78/100', level: 1, equipped: true, locked: false, baseStats: { defense: 2, maxHP: 12 } }),
  ],
  boots: [
    gear({ id: 'bt_boots', name: 'Soft Boots', type: 'Boots', slot: 'boots', mastery: 1, tier: 1, atk: '—', durability: '82/100', level: 1, equipped: true, locked: false, baseStats: { evasion: 2, maxHP: 6 } }),
  ],
  accessory: [
    gear({ id: 'ac_ring1', name: 'Brass Ring', type: 'Ring', slot: 'ring', mastery: 1, tier: 1, atk: '—', durability: '100/100', level: 1, equipped: true, locked: false, baseStats: { critChance: 0.5 } }),
    gear({ id: 'ac_ring2', name: 'Silver Ring', type: 'Ring', slot: 'ring', mastery: 2, tier: 1, atk: '—', durability: '100/100', level: 1, equipped: false, locked: false, rarity: 'uncommon', qualityBand: 5, baseStats: { critChance: 0.75 } }),
    gear({ id: 'ac_neck', name: 'Jade Necklace', type: 'Necklace', slot: 'necklace', mastery: 1, tier: 1, atk: '—', durability: '100/100', level: 1, equipped: false, locked: false, baseStats: { spirit: 1, maxChi: 5, maxHP: 6 } }),
  ],
  trinket: [
    gear({ id: 'tr_coin', name: 'Lucky Coin', type: 'Trinket', slot: 'trinket', mastery: 1, tier: 1, atk: '—', durability: '—', level: 1, equipped: true, locked: false, baseStats: { luck: 1 } }),
  ],
  cape: [
    gear({ id: 'cape_trainee', name: 'Trainee Cape', type: 'Cape', slot: 'cape', mastery: 1, tier: 1, atk: '—', durability: '—', level: 1, equipped: false, locked: false, baseStats: { defense: 1, critDefense: 0.5 }, appearance: { assetId: 'axe_cape_trainee' } }),
  ],
  wings: [
    gear({ id: 'wing_starter', name: 'Starter Wings', type: 'Wings', slot: 'wings', mastery: 1, tier: 1, atk: '—', durability: '—', level: 1, equipped: false, locked: false, baseStats: { maxHP: 5 }, appearance: { assetId: 'axe_wings_starter' } }),
  ],
  costume: [
    gear({ id: 'costume_wanderer', name: 'Wanderer Outfit', type: 'Costume', slot: 'costume', mastery: 1, tier: 1, atk: '—', durability: '—', level: 1, equipped: false, locked: false, baseStats: {}, appearance: { assetId: 'axe_costume_wanderer' } }),
  ],
  auxiliary: [
    gear({ id: 'aux_skyguard_sig', name: 'Skyguard Sigil', type: 'Auxiliary I', slot: 'auxiliary', rarity: 'rare', qualityBand: 10, level: 1, equipped: true, locked: false, auxSetId: 'AXE_AuxSet_Skyguard', baseStats: { defense: 2, maxHP: 8 } }),
    gear({ id: 'aux_skyguard_talisman', name: 'Skyguard Talisman', type: 'Auxiliary II', slot: 'auxiliary', rarity: 'rare', qualityBand: 10, level: 1, equipped: true, locked: false, auxSetId: 'AXE_AuxSet_Skyguard', baseStats: { critDefense: 0.5, spirit: 1 } }),
    gear({ id: 'aux_skyguard_emblem', name: 'Skyguard Emblem', type: 'Auxiliary III', slot: 'auxiliary', rarity: 'elite', qualityBand: 15, level: 1, equipped: false, locked: false, auxSetId: 'AXE_AuxSet_Skyguard', baseStats: { attack: 2, defense: 2 } }),
    gear({ id: 'aux_skyguard_relic', name: 'Skyguard Relic', type: 'Auxiliary IV', slot: 'auxiliary', rarity: 'heroic', qualityBand: 20, level: 1, equipped: false, locked: false, auxSetId: 'AXE_AuxSet_Skyguard', baseStats: { attack: 3, maxHP: 12 } }),
  ],
};


/**
 * Owner-approved inventory test gear, available to existing and new characters
 * once through the versioned starter migration. These are genuine separate
 * equippable items, not fake all-slot items that bypass equipment validation.
 * The fitted 3D models are indexed by AXEArmorPackCatalog; no rarity/drop
 * tables, combat grants, or market records are altered.
 */
export const AXE_TEST_FULL_SETS = Object.freeze([
  Object.freeze({ label: 'Full Set 1', setId: 'nightscale' }),
  Object.freeze({ label: 'Full Set 2', setId: 'frostwarden' }),
]);

for (const [index, preview] of AXE_TEST_FULL_SETS.entries()) {
  const set = AXE_ARMOR_PACK_SETS.find((entry) => entry.id === preview.setId);
  if (!set) continue;
  for (const piece of set.pieces) {
    const template = makeAXEArmorTemplate(set, piece);
    const label = piece.armorSlot === 'helmet' ? 'Helmet'
      : piece.armorSlot === 'pants' ? 'Legguards'
      : piece.armorSlot.charAt(0).toUpperCase() + piece.armorSlot.slice(1);
    INVENTORY[piece.slot].push(gear({
      ...template,
      id: `test_full_set_${index + 1}_${piece.slot}`,
      name: `${preview.label} — ${label}`,
      type: `${preview.label} / ${set.label}`,
      setId: set.id,
      iconUrl: `/models/characters/fused/armor/${set.id}/male_${piece.armorSlot}.jpg`,
      iconUrlFemale: `/models/characters/fused/armor/${set.id}/female_${piece.armorSlot}.jpg`,
      introducedVersion: 2,
      source: 'test_loadout',
      tradeable: false,
      equipped: false,
    }));
  }
}

INVENTORY.weapon.push(...[
  { id: 'test_training_bow', name: 'Training Bow', iconUrl: '/game3d/test-gear/training-bow.svg', baseStats: { attack: 3 }, atk: '2-4' },
  { id: 'test_hunter_bow', name: 'Hunter Longbow', iconUrl: '/game3d/test-gear/hunter-longbow.svg', baseStats: { attack: 5 }, atk: '4-6' },
  { id: 'test_moon_bow', name: 'Moon Recurve Bow', iconUrl: '/game3d/test-gear/moon-recurve-bow.svg', baseStats: { attack: 7 }, atk: '5-8' },
].map((bow) => gear({
  ...bow,
  type: 'Weapon — Bow',
  slot: 'weapon',
  category: 'weapon',
  masteryWeaponId: 'bow',
  weaponFamily: 'bow',
  axeWeaponRole: 'ranged',
  rarity: 'common',
  mastery: 1,
  tier: 1,
  level: 1,
  durability: '100/100',
  introducedVersion: 2,
  tradeable: false,
  equipped: false,
})));

// Armor pack (fitted armor layers): loot-only templates, deliberately NOT part of INVENTORY above, so
// new and existing characters are never granted them as starters. They drop from monsters
// (axe/loot/AXEArmorLootSystem.js) and enter AXEEquipmentInventoryStore on pickup.
export { AXE_ARMOR_PACK_GEAR as ARMOR_PACK_GEAR } from '../axe/equipment/AXEArmorPackCatalog.js';

export const getEquippedItem = (categoryId) =>
  (INVENTORY[categoryId] || []).find((it) => it.equipped) || null;

export const getAllEquippedInCategory = (categoryId) =>
  (INVENTORY[categoryId] || []).filter((it) => it.equipped);
