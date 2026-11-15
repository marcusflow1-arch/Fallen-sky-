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
import { getEquippedAXEItems, subscribeAXEEquipmentInventory } from '../axe/equipment/AXEEquipmentInventoryStore';
import { equippedAXEArmorPieces, AXE_ARMOR_PACK_SETS, AXE_DEV_ARMOR_SETS } from '../axe/equipment/AXEArmorPackCatalog';
import {
  armorSlotOf as slotOf,
  withEquippedArmor as mergeArmor,
  reconcileInventoryArmorOverrides,
} from './armorEquipCore.js';

export const ARMOR_EQUIP_EVENT = 'game3d:armor-equip';
// Fired once when the bridge is first used in a page, so an inventory that loaded earlier
// can re-send what is equipped (no start-up equip is lost).
export const ARMOR_SYNC_REQUEST_EVENT = 'game3d:armor-sync-request';
let syncRequested = false;
const STORAGE_KEY = 'axe.game3d.armor.v1';
const EMPTY = Object.freeze({});
const PACK_SET_IDS = [...AXE_ARMOR_PACK_SETS, ...AXE_DEV_ARMOR_SETS].map(set => set.id);
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
  // Inventory stays authoritative even when equipment is changed outside the
  // world, when the event bridge is not mounted. Character switching is
  // propagated by subscribeAXEEquipmentInventory.
  const [inventoryWorn, setInventoryWorn] = useState(
    () => equippedAXEArmorPieces(getEquippedAXEItems()),
  );
  useEffect(() => subscribeAXEEquipmentInventory((snapshot) => {
    const next = equippedAXEArmorPieces(snapshot?.items || []);
    setInventoryWorn((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
  }), []);
  const [pieces, setPieces] = useState([]);
  const [manifestState, setManifestState] = useState({bodyId:null,ready:false,error:''});
  const equippedPieceIds = Object.values(inventoryWorn).filter(Boolean).sort().join('|');
  useEffect(() => {
    if (syncRequested || typeof window === 'undefined') return;
    syncRequested = true;
    window.dispatchEvent(new CustomEvent(ARMOR_SYNC_REQUEST_EVENT));
  }, []);
  useEffect(() => {
    if (!body) {
      setPieces([]);
      setManifestState({bodyId:null,ready:true,error:''});
      return undefined;
    }
    let alive = true;
    setManifestState({bodyId:body.id,ready:false,error:''});
    loadBuiltinLayers('armor',{equippedIds:equippedPieceIds.split('|').filter(Boolean)})
      .then((manifest) => {
        if (!alive) return;
        setPieces((manifest[body.gender] || []).filter((p) => p.rig_id === body.rig_id));
        setManifestState({bodyId:body.id,ready:true,error:''});
      })
      .catch(error => {
        if (!alive) return;
        setPieces([]);
        setManifestState({bodyId:body.id,ready:false,error:error?.message||'Armor manifest could not load'});
      });
    return () => { alive = false; };
  }, [body?.id,equippedPieceIds]);
  const resolved = useMemo(() => {
    // Some old creator saves still contain a fitted armor pick even after the
    // actual equipment instance was unequipped. Reconcile both sources of
    // saved cosmetics against the canonical per-character inventory, not
    // merely the bridge's legacy override map.
    const creatorSelected = Object.fromEntries(ARMOR_SLOTS
      .filter(slot=>appearance?.selected_assets?.[slot])
      .map(slot=>[slot,appearance.selected_assets[slot]]));
    return reconcileInventoryArmorOverrides(
      {...creatorSelected,...equipped},inventoryWorn,PACK_SET_IDS,
    );
  },[appearance?.selected_assets,equipped,inventoryWorn]);
  return useMemo(() => {
    const result=withEquippedArmor(appearance,resolved,pieces);
    // The inventory owns the equipment. If a GLB was never authored for a
    // particular armor set/body, report that specific gap instead of silently
    // showing an unchanged character in the world and every 3D viewer.
    const equippedParts=Object.entries(inventoryWorn).filter(([,id])=>Boolean(id));
    if(!equippedParts.length)return result;
    let warnings=[];
    if(!body){
      warnings=['Equipped fitted armor needs a compatible fused Eve/Adam body.'];
    }else if(manifestState.error){
      warnings=['Armor assets unavailable: '+manifestState.error];
    }else if(manifestState.bodyId===body.id&&manifestState.ready){
      warnings=equippedParts.filter(([slot,id])=>!
        pieces.some(piece=>piece.slot===slot&&piece.id===id))
        .map(([slot,id])=>slot+': no fitted 3D model for '+id);
    }
    return warnings.length?{...result,game3d_armor_visual_warnings:warnings}:result;
  },[appearance,resolved,pieces,inventoryWorn,body,manifestState]);
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
