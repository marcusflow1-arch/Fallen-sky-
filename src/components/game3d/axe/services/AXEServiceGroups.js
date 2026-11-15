// Navigation groups only: all rules and transactions still use registry IDs.
const group = (id, label, serviceIds, presentation = 'world') => Object.freeze({
  id,
  label,
  presentation,
  defaultServiceId: serviceIds[0],
  serviceIds: Object.freeze(serviceIds),
  // The registry keeps historical direct-action IDs; only current menu
  // operations are shown in the simplified user-approved Blacksmith UI.
  visibleServiceIds: Object.freeze(id === 'blacksmith'
    ? ['enchant', 'over_enchant', 'combine', 'stage', 'sockets', 'core', 'runes']
    : id === 'companion' ? ['companion'] : serviceIds),
});

export const AXE_SERVICE_GROUPS = Object.freeze([
  group('blacksmith', 'Blacksmith', [
    'enchant', 'reinforcement', 'over_enchant', 'combine', 'stage',
    'refine', 'ultimate', 'runes', 'sockets', 'core',
  ]),
  // Character now owns the former Appearance pages. Keep its original menu
  // position and all legacy service IDs so world/service requests still work.
  // The default Character subpage replaces Overview; the outfit rail remains.
  group('character', 'Character',
    ['character', 'cape', 'vanity', 'costume', 'equipment_aura'], 'panel'),
  // The two skill-book subpages reuse the live player/companion loadout stores.
  group('skills', 'Skill Book', ['skills_character', 'skills_companion'], 'panel'),
  group('quest_logbook', 'Quest Logbook', ['quest_logbook'], 'panel'),
  // Stable's pet and mount actions remain registered and accessible from
  // Companion; they are not separate top-level Services destinations.
  group('companion', 'Companion', ['companion', 'pet', 'mount'], 'panel'),
  // Titles lives directly below Wings inside the Spiritual service.
  group('spiritual', 'Spiritual', ['halo', 'wings', 'title', 'ascension', 'elixir'], 'panel'),
]);

export function getAXEServiceGroup(groupId) {
  // Old links, saved buttons, and world requests may still say Appearance.
  // Resolve them to Character without showing a second top-level destination.
  const canonicalId=groupId==='appearance'?'character':groupId;
  return AXE_SERVICE_GROUPS.find((entry) => entry.id === canonicalId) || null;
}

export function getAXEServiceGroupForService(serviceId) {
  return AXE_SERVICE_GROUPS.find((entry) => entry.serviceIds.includes(serviceId)) || null;
}
