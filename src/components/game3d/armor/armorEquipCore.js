// Pure armor-equip rules shared by the Game 3D bridge (armorEquipBridge.js) and tests.
// Piece ids are <set>_<slot> (tools/avatar-armor manifest), identical on both bodies.

/** Slot of a piece id, or null when the id is malformed or names no armor slot. */
export function armorSlotOf(pieceId, slots) {
  const id = String(pieceId || '');
  if (!/^[a-z0-9_]{3,100}$/.test(id)) return null;
  const slot = id.slice(id.lastIndexOf('_') + 1);
  return slots.includes(slot) ? slot : null;
}

/**
 * Whether a manifest entry is available in this build. A set marked "dev_only" in
 * tools/avatar-armor/armor.config.json (Crescent Moon) is flagged on every manifest entry and is
 * for development builds only: a production build never lists, loads or equips it.
 */
export const isShippedArmorEntry = (entry, isDevBuild = false) => !entry?.dev_only || isDevBuild === true;

/**
 * Apply equip overrides ({ slot: pieceId, or '' for removed }) to an appearance.
 * pieces: manifest assets for the appearance's body. A piece that was not made for this
 * body is ignored (what is worn stays); other slots (hair, tattoos) are untouched.
 */
export function withEquippedArmor(appearance, equipped, pieces, slots) {
  const overrides = Object.entries(equipped || {}).filter(([slot]) => slots.includes(slot));
  if (!appearance || !overrides.length) return appearance;
  const selected = { ...(appearance.selected_assets || {}) };
  const byId = new Map((appearance.customization_assets || []).map((asset) => [asset.id, asset]));
  for (const [slot, id] of overrides) {
    if (!id) { delete selected[slot]; continue; }
    const piece = (pieces || []).find((p) => p.id === id && p.slot === slot);
    if (!piece) continue;
    selected[slot] = id;
    byId.set(id, piece);
  }
  return {
    ...appearance,
    selected_assets: selected,
    customization_assets: Object.values(selected).map((id) => byId.get(id)).filter(Boolean),
  };
}
