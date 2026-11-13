/**
 * The faction IDs and selectable names remain owned by AXEFactionWeaponConfig.
 * The entries below are ORIGINAL, presentation-only faction visions, not world
 * coordinates, class restrictions, starter-armor grants or confirmed lore.
 * Animal identities correspond to the existing faction-specific mount GLBs:
 * Faction 1 Bear, Faction 2 Armored Wolf, Faction 3 Fantasy Tiger.
 * Armor names reference real loot-set templates for visual identity only:
 * those armor sets are not faction-locked or automatically granted.
 */
export const FACTION_DOSSIERS = Object.freeze({
  AXE_Faction_1: Object.freeze({
    beast: 'bear', beastName: 'Fantasy Bear',
    title: 'The Resolute',
    motto: 'Endurance is the beginning of strength.',
    description: 'A tradition of steadfast guardians, ancient stone and patient strength. Their emblem is the bear: grounded, protective and powerful.',
    armorSetId: 'nightscale', armorName: 'Nightscale',
    armorNote: 'Dark layered armor, gilded edges, and the weight of a seasoned guardian.',
    homelandName: 'Highland Forests',
    homelandNote: 'A concept of high valleys, cedar forests and fortified mountain halls.',
    scene: 'mountain',
    accent: '#dcb58a', rgb: '220,181,138',
  }),
  AXE_Faction_2: Object.freeze({
    beast: 'wolf', beastName: 'Armored Wolf',
    title: 'The Vigilant',
    motto: 'A shared path, guarded beneath the moon.',
    description: 'A disciplined alliance that values loyalty, precision and unity. Its symbol is the armored wolf, watchful at every frontier.',
    armorSetId: 'frostwarden', armorName: 'Frostwarden',
    armorNote: 'Silver-blue plating and a restrained, frost-bright warrior silhouette.',
    homelandName: 'Northern Citadels',
    homelandNote: 'A concept of moonlit fortresses above misty evergreen valleys.',
    scene: 'moonwood',
    accent: '#a5cbe9', rgb: '165,203,233',
  }),
  AXE_Faction_3: Object.freeze({
    beast: 'tiger', beastName: 'Fantasy Tiger',
    title: 'The Radiant',
    motto: 'Courage moves where the sun rises.',
    description: 'An enterprising people of explorers and fierce defenders. The tiger represents agility, confidence and the strength to press onward.',
    armorSetId: 'dune_scavenger', armorName: 'Dune Scavenger',
    armorNote: 'Bronze-gold lines and flexible desert-traveler armor accents.',
    homelandName: 'Sunlit Expanse',
    homelandNote: 'A concept of sandstone shrines, desert gardens and ancient riverways.',
    scene: 'desert',
    accent: '#edc18a', rgb: '237,193,138',
  }),
});
export function getFactionDossier(id) {
  return FACTION_DOSSIERS[id] || null;
}
