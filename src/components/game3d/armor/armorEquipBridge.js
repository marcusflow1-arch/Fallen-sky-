// Game 3D armor equip bridge for the modular armor pieces (tools/avatar-armor).
//
// Each character keeps its own equipped pieces (one per slot). useGameAvatar merges them
// into the player's appearance, and the existing AvatarCustomizationRuntime binds, swaps
// and removes the skinned pieces on the live model (body masks, helmet-hides-hair and cape
// springs included). Loot, inventory or equipment code calls equipArmor / unequipArmor,
// or dispatches the window event without importing this module:
//   window.dispatchEvent(new CustomEvent('game3d:armor-equip', { detail: { id: 'nightscale_chest' } }))
//   window.dispatchEvent(new CustomEvent('game3d:armor-equip', { detail: { slot: 'chest', id: null } }))
// Piece ids are <set>_<slot> and the same on both bodies; the manifest supplies the body's file.
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ARMOR_SLOTS, creatorBody } from '@/components/onboarding/avatarCustomization';
import { loadBuiltinLayers } from '@/components/onboarding/creatorBuiltinLayers';
import { getActiveCharacter } from '../characterStore';
import { armorSlotOf as slotOf, withEquippedArmor as mergeArmor } from './armorEquipCore.js';

export const ARMOR_EQUIP_EVENT = 'game3d:armor-equip';
// Fired once when the bridge is first used in a page, so an inventory that loaded earlier
// can re-send what is equipped (no start-up equip is lost).
export const ARMOR_SYNC_REQUEST_EVENT = 'game3d:armor-sync-request';
let syncRequested = false;
const STORAGE_KEY = 'axe.game3d.armor.v1';
const EMPTY = Object.freeze({});
const listeners = new Set();

function readStore() {
  try {
    const value = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}
let store = readStore();
function commit(next) {
  store = next;
  try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(store)); } catch { /* private mode */ }
  listeners.forEach((fn) => fn());
}
const activeCharacterId = () => getActiveCharacter()?.id || 'default';

/** Slot of a piece id (<set>_<slot>), or null. */
export const armorSlotOf = (pieceId) => slotOf(pieceId, ARMOR_SLOTS);

/** Equipped overrides for a character: { slot: pieceId, or '' for explicitly removed }. */
export function getEquippedArmor(characterId = activeCharacterId()) {
  return { ...(store[characterId] || EMPTY) };
}
export function subscribeArmor(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function equipArmor(pieceId, characterId = activeCharacterId()) {
  const slot = armorSlotOf(pieceId);
  if (!slot) return false;
  commit({ ...store, [characterId]: { ...(store[characterId] || EMPTY), [slot]: pieceId } });
  return true;
}
export function unequipArmor(slot, characterId = activeCharacterId()) {
  if (!ARMOR_SLOTS.includes(slot)) return false;
  commit({ ...store, [characterId]: { ...(store[characterId] || EMPTY), [slot]: '' } });
  return true;
}
/** Forget the overrides: the character wears what it was created with again. */
export function resetArmor(characterId = activeCharacterId()) {
  const next = { ...store };
  delete next[characterId];
  commit(next);
}

/** Pure: apply equip overrides to an appearance. pieces = manifest assets for this body. */
export const withEquippedArmor = (appearance, equipped = EMPTY, pieces = []) => mergeArmor(appearance, equipped, pieces, ARMOR_SLOTS);

/** The appearance with this character's equipped armor merged in (fused bodies only). */
export function useArmoredAppearance(appearance, characterId) {
  const id = characterId || 'default';
  const body = creatorBody(appearance);
  const equipped = useSyncExternalStore(subscribeArmor, () => store[id] || EMPTY, () => EMPTY);
  const [pieces, setPieces] = useState([]);
  useEffect(() => {
    if (syncRequested || typeof window === 'undefined') return;
    syncRequested = true;
    window.dispatchEvent(new CustomEvent(ARMOR_SYNC_REQUEST_EVENT));
  }, []);
  useEffect(() => {
    if (!body) { setPieces([]); return undefined; }
    let alive = true;
    loadBuiltinLayers('armor')
      .then((manifest) => { if (alive) setPieces((manifest[body.gender] || []).filter((p) => p.rig_id === body.rig_id)); })
      .catch(() => { if (alive) setPieces([]); });
    return () => { alive = false; };
  }, [body?.id]);
  return useMemo(() => withEquippedArmor(appearance, equipped, pieces), [appearance, equipped, pieces]);
}

if (typeof window !== 'undefined' && !window.__axeArmorEquipBridge) {
  window.__axeArmorEquipBridge = true;
  window.addEventListener(ARMOR_EQUIP_EVENT, (event) => {
    const { id, slot, characterId } = event.detail || {};
    if (id) equipArmor(id, characterId || undefined);
    else if (slot) unequipArmor(slot, characterId || undefined);
  });
  // Console/QA handle: game3dArmor.equip('frostwarden_helmet'), .unequip('helmet'), .equipped(), .reset()
  window.game3dArmor = { equip: equipArmor, unequip: unequipArmor, equipped: getEquippedArmor, reset: resetArmor };
}
