// Shared C-key navigation decision. C belongs to the modern Character tab
// inside Appearance, never the old AXE Character Hub / AttributesTab shell.
export function getAXECharacterShortcutAction({
  activeGroupId = null, legacyHubOpen = false, activeTab = 'Character',
} = {}) {
  if (legacyHubOpen || activeGroupId !== 'character') return 'open';
  // If the player's editing Equipment, Vanity or Aura, the first C returns
  // to Character rather than abruptly closing the entire workspace.
  return activeTab === 'Character' ? 'close' : 'focus';
}
