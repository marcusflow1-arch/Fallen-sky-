import { useEffect, useMemo, useState } from 'react';
import CreatorStage from '@/components/onboarding/CreatorStage';
import { ARMOR_SLOTS, creatorBody } from '@/components/onboarding/avatarCustomization';
import { loadBuiltinLayers } from '@/components/onboarding/creatorBuiltinLayers';
import { getActiveId, getStorageUser } from '../characterStorage';
import {
  getEquippedAXEItems, subscribeAXEEquipmentInventory,
} from '../axe/equipment/AXEEquipmentInventoryStore';
import {
  equippedAXEArmorPieces, AXE_ARMOR_PACK_SETS, AXE_DEV_ARMOR_SETS,
} from '../axe/equipment/AXEArmorPackCatalog';
import {
  withEquippedArmor, reconcileInventoryArmorOverrides,
} from '../armor/armorEquipCore';

const PACKS = [...AXE_ARMOR_PACK_SETS, ...AXE_DEV_ARMOR_SETS].map(x => x.id);

// Character selection shows the saved gear belonging to the SELECTED roster
// slot, not whichever character last entered the world. This read never sets
// an active character, grants an item, or rewrites the inventory.
export function readSelectedCharacterArmor(characterId) {
  if (!characterId) return {};
  if (characterId === getActiveId()) return equippedAXEArmorPieces(getEquippedAXEItems());
  try {
    const key = 'axe_equipment_inventory_v2::' + getStorageUser() + '::' + characterId;
    const saved = JSON.parse(globalThis.localStorage?.getItem(key) || 'null');
    return equippedAXEArmorPieces(Array.isArray(saved?.items) ? saved.items : []);
  } catch { return {}; }
}

export default function SelectedCharacterArmorPreview({ character, ...stageProps }) {
  const [equipped, setEquipped] = useState(() => readSelectedCharacterArmor(character?.id));
  const [assets, setAssets] = useState([]);
  const body = creatorBody(character);
  useEffect(() => {
    const update = () => setEquipped(readSelectedCharacterArmor(character?.id));
    update();
    const unsubscribe = subscribeAXEEquipmentInventory(update);
    globalThis.window?.addEventListener?.('storage', update);
    return () => {
      unsubscribe?.();
      globalThis.window?.removeEventListener?.('storage', update);
    };
  }, [character?.id]);

  useEffect(() => {
    if (!body) { setAssets([]); return undefined; }
    let live = true;
    loadBuiltinLayers('armor')
      .then(manifest => {
        if (live) setAssets((manifest[body.gender] || []).filter(asset => asset.rig_id === body.rig_id));
      })
      .catch(() => { if (live) setAssets([]); });
    return () => { live = false; };
  }, [body?.id]);

  const config = useMemo(() => {
    if (!body) return character;
    const savedPieces = Object.fromEntries(ARMOR_SLOTS
      .filter(slot => character?.selected_assets?.[slot])
      .map(slot => [slot, character.selected_assets[slot]]));
    const resolved = reconcileInventoryArmorOverrides(savedPieces, equipped, PACKS);
    return withEquippedArmor(character, resolved, assets, ARMOR_SLOTS);
  }, [character, body, equipped, assets]);
  return <CreatorStage config={config} {...stageProps} />;
}
