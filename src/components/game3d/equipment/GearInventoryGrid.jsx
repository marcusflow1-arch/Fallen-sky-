import React, { useEffect, useState } from 'react';
import { CATEGORY_ICONS } from './inventoryData';
import {
  getAXEInventoryItemsByCategory,
  subscribeAXEEquipmentInventory,
} from '../axe/equipment/AXEEquipmentInventoryStore';

/**
 * Live per-category inventory grid backed by the canonical AXE equipment
 * inventory. This is real owned-instance state, not the static seed catalog.
 */
export default function GearInventoryGrid({
  categoryId,
  categoryLabel,
  selectedItemId,
  onSelectItem,
  onContextItem,
}) {
  const [items, setItems] = useState(() => getAXEInventoryItemsByCategory(categoryId));

  useEffect(() => subscribeAXEEquipmentInventory(() => {
    setItems(getAXEInventoryItemsByCategory(categoryId));
  }), [categoryId]);

  const Icon = CATEGORY_ICONS[categoryId];
  const totalSlots = Math.max(35, items.length);

  return (
    <div>
      <div className="flex items-center justify-center gap-3 mb-3">
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-white/60 text-[12px] tracking-[0.25em] uppercase">
          {categoryLabel} · {items.length}
        </span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <div className="grid grid-cols-7 gap-1.5 max-h-[300px] overflow-y-auto pr-1">
        {Array.from({ length: totalSlots }).map((_, i) => {
          const item = items[i];
          const itemId = item?.instanceId || item?.id;
          const isSelected = item && itemId === selectedItemId;
          return (
            <button
              key={itemId || i}
              onClick={() => item && onSelectItem(itemId)}
              onContextMenu={(e) => {
                if (!item) return;
                e.preventDefault();
                onContextItem?.(item, e.clientX, e.clientY);
              }}
              disabled={!item}
              title={item?.name || ''}
              className={`relative aspect-square rounded-sm transition-all flex items-center justify-center ${
                isSelected
                  ? 'border-2 border-white/70 bg-white/[0.12]'
                  : item
                  ? 'border border-white/15 bg-white/[0.06] hover:bg-white/[0.10] hover:border-white/30 cursor-pointer'
                  : 'border border-white/10 bg-white/[0.03]'
              }`}
            >
              {item && Icon && <Icon aria-hidden="true" className="w-5 h-5 text-white/70" />}
              {item?.iconUrl && (
                <img
                  src={item.iconUrl}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  className="absolute inset-[7%] w-[86%] h-[86%] object-contain rounded-sm pointer-events-none"
                  onError={(event) => { event.currentTarget.hidden = true; }}
                />
              )}
              {item?.equipped && (
                <span
                  className="absolute top-0.5 right-0.5 w-0 h-0"
                  style={{
                    borderLeft: '3px solid transparent',
                    borderRight: '3px solid transparent',
                    borderBottom: '4px solid #86efac',
                  }}
                />
              )}
              {item?.locked && (
                <span className="absolute bottom-0.5 right-0.5 text-[8px] text-amber-200">🔒</span>
              )}
              {item && (
                <span className="absolute bottom-0 left-0 right-0 truncate text-center text-[7px] text-white/85 bg-black/70 px-0.5 py-[1px]">
                  {item.name}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
