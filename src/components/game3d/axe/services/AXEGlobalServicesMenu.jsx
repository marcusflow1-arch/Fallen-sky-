import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Backpack,
  Check,
  ChevronRight,
  Gem,
  Lock,
  Shield,
  Swords,
} from 'lucide-react';

import HaloSubTab from '../../progression/hub/HaloSubTab';
import TitleSubTab from '../../progression/hub/TitleSubTab';
import WingsSubTab from '../../progression/hub/WingsSubTab';
import CapeSubTab from '../../progression/hub/CapeSubTab';
import CoreSubTab from '../../progression/hub/CoreSubTab';
import ElixirSubTab from '../../progression/hub/ElixirSubTab';
import PetSubTab from '../../progression/hub/PetSubTab';
import MountSubTab from '../../progression/hub/MountSubTab';
import AscensionSubTab from '../../progression/hub/AscensionSubTab';
import VanitySubTab from '../../progression/hub/VanitySubTab';
import CostumeSubTab from '../../progression/hub/CostumeSubTab';
import AXECompanionWorkspace from './AXECompanionWorkspace';
import AXESkillBookWorkspace from './AXESkillBookWorkspace';
import AXEQuestLogbookWorkspace from './AXEQuestLogbookWorkspace';

import {
  getItemEnchantments,
  getItemOverEnchant,
  getItemReinforcement,
  getMaterials,
  getCostForNextLevel,
  MAX_ENCH_LEVEL,
  subscribeEnchantments,
} from '../../equipment/enchantmentStore';
import {
  getAXEAdvancementState,
  subscribeAXEItemAdvancement,
} from '../equipment/AXEItemAdvancementStore';
import {
  getAXESocketState,
  subscribeAXESockets,
} from '../equipment/AXESocketGemStore';
import { AXE_GEM_DEFINITIONS } from '../equipment/AXESocketGemSystem';
import {
  getAXEItemAura,
  subscribeAXEAura,
} from '../equipment/AXEEquipmentAuraStore';
import {
  getAllAXEEquipmentItems,
  subscribeAXEEquipmentInventory,
} from '../equipment/AXEEquipmentInventoryStore';
import {
  getLootInventory,
  getLootItemCount,
  subscribeLootInventory,
} from '../../lootStore';
import {
  AXE_SERVICE_REGISTRY,
  getAXEService,
  normalizeAXEServiceRequest,
} from './AXEServiceRegistry';
import { AXE_SERVICE_GROUPS } from './AXEServiceGroups';
import { executeAXEServiceTransaction } from './AXEServiceTransactionGateway';
import { getAXEServiceResourceCount } from './AXEServiceResources';
import { filterAXEItemsForService, getAXEServiceEligibility, describeAXEServiceEligibility } from './AXEServiceEligibility';
import { AXE_SERVICE_DRAG_TYPE, getAXEServiceOperationPreview, isAXECompatibleDonor, readAXEServiceDrop } from './AXEServiceWorkspaceModel';
import './AXEEquipmentWorkspace.css';

const PROGRESSION_PANELS = {
  companion: AXECompanionWorkspace,
  skills_character: AXESkillBookWorkspace,
  skills_companion: AXESkillBookWorkspace,
  quest_logbook: AXEQuestLogbookWorkspace,
  halo: HaloSubTab,
  title: TitleSubTab,
  wings: WingsSubTab,
  cape: CapeSubTab,
  core: CoreSubTab,
  elixir: ElixirSubTab,
  pet: PetSubTab,
  mount: MountSubTab,
  ascension: AscensionSubTab,
  vanity: VanitySubTab,
  costume: CostumeSubTab,
};

const INVENTORY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'weapon', label: 'Weapons' },
  { id: 'armor', label: 'Armor' },
  { id: 'accessory', label: 'Accessories' },
  { id: 'prestige', label: 'Prestige' },
  { id: 'auxiliary', label: 'Auxiliary' },
];

const ARMOR_SLOTS = new Set(['helm', 'chest', 'gloves', 'legs', 'boots']);
const ACCESSORY_SLOTS = new Set(['ring', 'necklace', 'accessory', 'trinket']);
const PRESTIGE_SLOTS = new Set(['cape', 'wings', 'costume']);

function matchesInventoryFilter(item, filterId) {
  if (filterId === 'all') return true;
  if (filterId === 'weapon') return item.slot === 'weapon' || item.category === 'weapon';
  if (filterId === 'armor') return ARMOR_SLOTS.has(item.slot || item.category);
  if (filterId === 'accessory') return ACCESSORY_SLOTS.has(item.slot || item.category);
  if (filterId === 'prestige') return PRESTIGE_SLOTS.has(item.slot || item.category);
  if (filterId === 'auxiliary') return item.slot === 'auxiliary' || item.category === 'auxiliary';
  return true;
}

function describeResult(result) {
  if (!result) return '';
  if (result.ok) {
    if (result.outcome) return `Success — ${String(result.outcome).replaceAll('_', ' ')}`;
    return 'Transaction completed.';
  }
  return `Not completed — ${String(result.reason || result.outcome || 'unknown result').replaceAll('_', ' ')}`;
}

function rarityClass(rarity) {
  switch (String(rarity || '').toLowerCase()) {
    case 'heroic': return 'text-rose-200';
    case 'legendary': return 'text-amber-200';
    case 'elite':
    case 'epic': return 'text-violet-200';
    case 'rare': return 'text-sky-200';
    case 'uncommon': return 'text-emerald-200';
    default: return 'text-white/60';
  }
}

function InventoryItemCard({ item, selected, picked, onClick, onDoubleClick, disabled }) {
  const reinforcement = getItemReinforcement(item.instanceId);
  const enchantments = getItemEnchantments(item.instanceId);
  const totalEnchant = enchantments.reduce((sum, value) => sum + Number(value || 0), 0);

  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      disabled={disabled}
      draggable={!disabled}
      aria-pressed={selected || picked}
      onDragStart={(event) => {
        event.dataTransfer.setData(AXE_SERVICE_DRAG_TYPE, JSON.stringify({ instanceId: item.instanceId }));
        event.dataTransfer.effectAllowed = 'copy';
      }}
      className={`w-full rounded-xl border p-3 text-left transition ${
        selected || picked
          ? 'border-white/30 bg-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
          : 'border-white/8 bg-black/[0.10] hover:border-white/18 hover:bg-white/[0.06]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
          {item.slot === 'weapon' ? (
            <Swords className="h-4 w-4 text-white/55" />
          ) : item.slot === 'ring' || item.slot === 'necklace' ? (
            <Gem className="h-4 w-4 text-white/55" />
          ) : (
            <Shield className="h-4 w-4 text-white/55" />
          )}
          {typeof item.iconUrl === 'string' &&
            (/^\/(models\/|game3d\/)/.test(item.iconUrl) || item.iconUrl.startsWith('data:image/jpeg;base64,')) && (
              <img
                src={item.iconUrl}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full rounded-lg object-contain"
                onError={(event) => { event.currentTarget.hidden = true; }}
              />
            )}
          {item.equipped && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-emerald-200/30 bg-emerald-300/15">
              <Check className="h-2.5 w-2.5 text-emerald-100" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-white/85">{item.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[9px] uppercase tracking-wider">
            <span className={rarityClass(item.rarity)}>{item.rarity || 'common'}</span>
            <span className="text-white/25">·</span>
            <span className="text-white/35">{item.slot || item.category}</span>
            {item.locked && <Lock className="h-2.5 w-2.5 text-amber-200/70" />}
          </div>
          <div className="mt-1 text-[9px] text-white/35">
            Reinforce {reinforcement.percent || 0}% · Enchant +{totalEnchant} · Qty {item.quantity ?? 1}
          </div>
        </div>

        <ChevronRight className="mt-2 h-3.5 w-3.5 text-white/20" />
      </div>
    </button>
  );
}

function MaterialPill({ id, need = null }) {
  const have = getAXEServiceResourceCount(id);
  const ok = need == null || have >= need;
  return (
    <span className={`rounded-md border px-2 py-1 text-[9px] ${
      ok
        ? 'border-white/10 bg-white/[0.04] text-white/55'
        : 'border-rose-300/20 bg-rose-300/[0.04] text-rose-200/75'
    }`}>
      {id.replaceAll('_', ' ')}: <b>{have}{need != null ? `/${need}` : ''}</b>
    </span>
  );
}

export function EquipmentServicePanel({
  serviceId,
  requestedItemId = null,
  worldIntegrated = false,
  onSelectedItem,
  onTransaction,
}) {
  const [inventoryState, setInventoryState] = useState(() => ({
    items: getAllAXEEquipmentItems(),
  }));
  const [lootState, setLootState] = useState(() => getLootInventory());
  const [selectedId, setSelectedId] = useState(() => getAllAXEEquipmentItems()[0]?.instanceId || '');
  const [targetCleared, setTargetCleared] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [pickedId, setPickedId] = useState('');
  const [donorId, setDonorId] = useState('');
  const [selectedGemId, setSelectedGemId] = useState('');
  const [selectedSocket, setSelectedSocket] = useState(0);
  const [lastResult, setLastResult] = useState(null);
  const [review, setReview] = useState(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const mountedRef = useRef(true);
  const selectedCallback = useRef(onSelectedItem);
  const transactionCallback = useRef(onTransaction);
  const consumedRequest = useRef(null);
  selectedCallback.current = onSelectedItem;
  transactionCallback.current = onTransaction;
  const [backendVersion, setBackendVersion] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; selectedCallback.current?.(null); };
  }, []);

  useEffect(() => subscribeAXEEquipmentInventory((snapshot) => {
    setInventoryState(snapshot);
    setBackendVersion((v) => v + 1);
  }), []);
  useEffect(() => subscribeLootInventory((snapshot) => {
    setLootState(snapshot);
    setBackendVersion((v) => v + 1);
  }), []);
  useEffect(() => subscribeEnchantments(() => setBackendVersion((v) => v + 1)), []);
  useEffect(() => subscribeAXEItemAdvancement(() => setBackendVersion((v) => v + 1)), []);
  useEffect(() => subscribeAXESockets(() => setBackendVersion((v) => v + 1)), []);
  useEffect(() => subscribeAXEAura(() => setBackendVersion((v) => v + 1)), []);

  const allItems = inventoryState.items || [];
  const items = useMemo(
    () => filterAXEItemsForService(serviceId, allItems),
    [serviceId, allItems],
  );

  useEffect(() => {
    if (targetCleared) return;
    if (!items.length) {
      setSelectedId('');
      return;
    }
    if (!items.some((item) => item.instanceId === selectedId)) {
      setSelectedId(items[0].instanceId);
    }
  }, [items, selectedId, targetCleared]);

  useEffect(() => {
    setDonorId('');
    setPickedId('');
    setReview(null);
    setSelectedSocket(0);
  }, [serviceId, selectedId]);
  useEffect(() => { setLastResult(null); }, [serviceId]);

  useEffect(() => {
    const selected = allItems.find((entry) => entry.instanceId === selectedId) || null;
    selectedCallback.current?.(selected);
  }, [selectedId, allItems, backendVersion]);

  useEffect(() => {
    if (!requestedItemId) { consumedRequest.current = null; return; }
    const requestKey = `${serviceId}::${requestedItemId}`;
    if (consumedRequest.current === requestKey) return;
    const requested = allItems.find((entry) => entry.instanceId === requestedItemId);
    if (!requested) return;
    consumedRequest.current = requestKey;
    const eligibility = getAXEServiceEligibility(serviceId, requested);
    if (eligibility.eligible) { setSelectedId(requested.instanceId); setTargetCleared(false); }
    else setLastResult({ ok: false, reason: describeAXEServiceEligibility(eligibility) });
  }, [requestedItemId, serviceId, allItems]);

  const filteredItems = useMemo(
    () => allItems.filter((entry) => matchesInventoryFilter(entry, filter)
      && `${entry.name} ${entry.rarity} ${entry.slot || entry.category}`.toLowerCase().includes(search.trim().toLowerCase())),
    [allItems, filter, search],
  );

  const item = targetCleared ? null : items.find((entry) => entry.instanceId === selectedId) || items[0] || null;
  const service = getAXEService(serviceId);

  const reinforcement = item ? getItemReinforcement(item.instanceId) : {};
  const enchantments = item ? getItemEnchantments(item.instanceId) : [];
  const overEnchant = item ? getItemOverEnchant(item.instanceId) : {};
  const advancement = item ? getAXEAdvancementState(item.instanceId) : {};
  const sockets = item ? getAXESocketState(item.instanceId) : {};
  const aura = item ? getAXEItemAura(item.instanceId) : null;

  const compatibleDonors = allItems.filter((candidate) => isAXECompatibleDonor(item, candidate, advancement));
  const donor = compatibleDonors.find((candidate) => candidate.instanceId === donorId) || null;

  const ownedGems = (lootState.gem || [])
    .map((lootItem) => AXE_GEM_DEFINITIONS[lootItem.id])
    .filter(Boolean);
  const uniqueOwnedGems = [...new Map(ownedGems.map((gem) => [gem.id, gem])).values()];
  const selectedGem = AXE_GEM_DEFINITIONS[selectedGemId] || uniqueOwnedGems[0] || null;

  const openSocketIndexes = (sockets.sockets || [])
    .map((socket, index) => ({ socket, index }))
    .filter(({ socket }) => socket?.open && !socket?.gemId);

  const previewFor = (transactionServiceId, payload = {}) => getAXEServiceOperationPreview(transactionServiceId, {
    item, reinforcement, enchantments, overEnchant, advancement, sockets, aura,
    protectedAttempt: !!payload.options?.protectedAttempt,
    donor: payload.donorId ? allItems.find((candidate) => candidate.instanceId === payload.donorId) || null : donor,
    slotIndex: payload.slotIndex ?? 0,
    enchantCost: getCostForNextLevel(enchantments[payload.slotIndex ?? 0] || 0),
    gemId: payload.gemId,
    socketIndex: payload.socketIndex ?? selectedSocket,
  });
  const execute = (transactionServiceId, payload = {}) => {
    if (pendingRef.current || !item) return;
    const preview = previewFor(transactionServiceId, payload);
    setReview({ transactionServiceId, payload, preview, itemId: item.instanceId });
  };
  const confirmTransaction = async () => {
    if (pendingRef.current || !review || !item || review.itemId !== item.instanceId) return;
    const preview = previewFor(review.transactionServiceId, review.payload);
    if (!preview.canAdvance || Object.entries(preview.cost).some(([id, count]) => getAXEServiceResourceCount(id) < count)) {
      setLastResult({ ok: false, reason: preview.reason || 'INSUFFICIENT_MATERIALS_OR_MAX_LEVEL' });
      setReview(null);
      return;
    }
    // A ref closes the gap before React paints the disabled buttons. The gateway
    // also locks the real item/donor across all simultaneously open local panels.
    pendingRef.current = true;
    setPending(true);
    setReview(null);
    const result = await executeAXEServiceTransaction(review.transactionServiceId, {
      itemId: item.instanceId, ...review.payload,
    });
    pendingRef.current = false;
    if (mountedRef.current) { setPending(false); setLastResult(result); }
    transactionCallback.current?.(result);
  };
  const placeItem = (instanceId, slot = 'target') => {
    if (pendingRef.current) return;
    const candidate = allItems.find((entry) => entry.instanceId === instanceId);
    if (!candidate) return;
    if (slot === 'donor') {
      if (isAXECompatibleDonor(item, candidate, advancement)) { setDonorId(candidate.instanceId); setReview(null); }
      else setLastResult({ ok: false, reason: 'Choose a different, unlocked, unequipped instance of the same template and grade.' });
    } else {
      const eligibility = getAXEServiceEligibility(serviceId, candidate);
      if (eligibility.eligible) { setSelectedId(candidate.instanceId); setTargetCleared(false); setReview(null); setLastResult(null); }
      else setLastResult({ ok: false, reason: describeAXEServiceEligibility(eligibility) });
    }
    setPickedId('');
  };
  const onSlotDrop = (event, slot) => {
    event.preventDefault();
    const instanceId = readAXEServiceDrop(event.dataTransfer);
    if (instanceId) placeItem(instanceId, slot);
  };

  // The active operation preview is the single source of truth for current
  // costs, including Reinforcement/Enchant/Over-Enchant (which are not in the
  // advancement-only economy table).
  const basePreview = previewFor(serviceId);
  const serviceCost = basePreview.cost;
  // Show each owned material once; additional operation requirements use the
  // same pill with a have/need count instead of duplicating that material.
  const basicMaterials = getMaterials();
  const visibleResources = [...new Set([
    ...Object.keys(basicMaterials).filter(id => basicMaterials[id] > 0),
    ...Object.keys(serviceCost),
  ])];


  const materialItems = Object.entries(lootState).filter(([category]) => ['material', 'gem', 'evolution'].includes(category))
    .flatMap(([, entries]) => entries || []).reduce((map, entry) => {
      const prior = map.get(entry.id);
      map.set(entry.id, { ...entry, quantity: (prior?.quantity || 0) + 1 });
      return map;
    }, new Map());
  return (
    <div className={`axe-equipment-workspace ${worldIntegrated ? 'axe-equipment-workspace--world' : ''}`} data-pending={pending || undefined}>
      {/* Real inventory browser */}
      <aside className="axe-service-inventory min-h-0 overflow-y-auto border-r border-white/10 bg-black/[0.10] p-4" aria-label="Owned equipment and materials">
        <div className="flex items-center gap-2">
          <Backpack className="h-4 w-4 text-white/55" />
          <div>
            <div className="text-[9px] uppercase tracking-[0.30em] text-white/35">Owned Equipment</div>
            <div className="text-sm font-semibold text-white/80">{allItems.length} Items</div>
          </div>
        </div>

        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
          placeholder="Search owned equipment" aria-label="Search owned equipment" className="axe-service-search" />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {INVENTORY_FILTERS.map((entry) => (
            <button
              key={entry.id}
              onClick={() => setFilter(entry.id)}
              className={`rounded-md border px-2 py-1 text-[9px] uppercase tracking-wider ${
                filter === entry.id
                  ? 'border-white/25 bg-white/[0.10] text-white'
                  : 'border-white/8 bg-white/[0.025] text-white/35 hover:text-white/60'
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {filteredItems.map((entry) => (
            <InventoryItemCard
              key={entry.instanceId}
              item={entry}
              selected={entry.instanceId === item?.instanceId}
              picked={entry.instanceId === pickedId}
              disabled={pending}
              onClick={() => setPickedId(entry.instanceId)}
              onDoubleClick={() => placeItem(entry.instanceId,
                serviceId === 'combine' && item && entry.instanceId !== item.instanceId
                  && isAXECompatibleDonor(item, entry, advancement) ? 'donor' : 'target')}
            />
          ))}
        </div>
        {!allItems.length && <p className="mt-3 text-xs text-white/50">No owned equipment exists yet.</p>}
        {allItems.length > 0 && !filteredItems.length && <p className="mt-3 text-xs text-white/50">No equipment matches this filter.</p>}
        <p className="mt-3 text-[10px] leading-4 text-white/40">Select an item, then tap a slot. Double-click to place, or drag to a slot.</p>
        <div className="mt-5 border-t border-white/10 pt-3">
          <h3 className="text-[10px] uppercase tracking-widest text-white/55">Materials &amp; Gems</h3>
          <div className="mt-2 space-y-1">
            {[...materialItems.values()].map((entry) => <div key={entry.id} className="flex justify-between gap-2 text-[10px] text-white/55">
              <span>{entry.name || entry.id.replaceAll('_', ' ')}</span><span>×{entry.quantity}</span>
            </div>)}
            {!materialItems.size && <p className="text-[10px] text-white/40">No materials or gems owned.</p>}
          </div>
        </div>
      </aside>

      {/* Service action workspace */}
      <section className="axe-service-actions min-h-0 overflow-y-auto p-5" aria-label={`${service?.label || serviceId} controls`}>
          <div className="axe-service-slots">
            <button type="button" className="axe-service-item-slot" disabled={pending}
              onDragOver={(event) => event.preventDefault()} onDrop={(event) => onSlotDrop(event, 'target')}
              onClick={() => {
                if (pickedId) placeItem(pickedId);
                else { setSelectedId(''); setTargetCleared(true); }
              }}>
              <span>Equipment target</span><strong>{item?.name || 'Place owned equipment'}</strong><small>{pickedId ? 'Tap to place selected inventory item' : item ? 'Tap to remove, or select an inventory item to replace' : 'Select an inventory item, then tap here'}</small>
            </button>
            {serviceId === 'combine' && item && <button type="button" className="axe-service-item-slot" disabled={pending}
              onDragOver={(event) => event.preventDefault()} onDrop={(event) => onSlotDrop(event, 'donor')}
              onClick={() => pickedId ? placeItem(pickedId, 'donor') : setDonorId('')}>
              <span>Donor · consumed on success</span><strong>{donor?.name || 'Place a matching donor'}</strong><small>{donor ? 'Tap without a picked item to remove' : 'Separate unlocked, unequipped instance'}</small>
            </button>}
          </div>
        {!item ? <div className="py-6 text-sm text-white/50">{targetCleared ? 'Select equipment from inventory and place it in the target slot.' : 'No owned equipment is eligible for this operation. Choose another operation or obtain compatible equipment.'}</div> : <>
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-3 border-b border-white/10 pb-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[9px] uppercase tracking-[0.34em] text-white/35">
                Services · {service?.label || serviceId}
              </div>
              <h2 className="mt-1 text-2xl font-semibold text-white/90">{item.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-white/40">
                <span>{item.slot || item.category}</span>
                <span>·</span>
                <span className={rarityClass(item.rarity)}>{item.rarity}</span>
                {item.equipped && <span className="text-emerald-200/70">Equipped</span>}
                {item.locked && <span className="text-amber-200/70">Locked</span>}
              </div>
            </div>
            <div className="text-right text-[10px] text-white/35">
              Instance<br/>
              <span className="font-mono text-white/55">{item.instanceId}</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label="Reinforcement" value={`${reinforcement.percent || 0}%`} />
            <Stat label="Enchant" value={`+${enchantments.reduce((s, v) => s + Number(v || 0), 0)}`} />
            <Stat label="Over-Enchant" value={`+${overEnchant.level || 0}`} />
            <Stat label="Stage" value={advancement.stage?.label || 'Base'} />
            <Stat label="Refine" value={`+${advancement.refine?.level || 0}`} />
            <Stat label="Ultimate" value={`+${advancement.ultimate?.level || 0}`} />
            <Stat label="Sockets" value={`${sockets.sockets?.length || 0}/${sockets.maxSockets || 0}`} />
            <Stat label="Aura" value={aura ? `Tier ${aura.tierRank || 1}` : 'None'} />
          </div>

          {/* Real resource inventory */}
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-4" data-service-resource-summary>
            <div className="flex items-center justify-between">
              <div className="text-[9px] uppercase tracking-[0.25em] text-white/35">Inventory Resources</div>
              <div className="text-[9px] text-white/25">Consumed directly from Materials / Gems inventory</div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {visibleResources.map(id => (
                <MaterialPill key={id} id={id} need={serviceCost[id] ?? null} />
              ))}
              {!visibleResources.length && (
                <span className="text-[10px] text-white/40">No relevant materials owned.</span>
              )}
            </div>
          </div>

          {lastResult && (
            <div role="status" className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
              lastResult.ok
                ? 'border-emerald-300/15 bg-emerald-300/[0.04] text-emerald-100/80'
                : 'border-rose-300/15 bg-rose-300/[0.04] text-rose-100/80'
            }`}>
              {describeResult(lastResult)}
            </div>
          )}

          <div className="axe-service-preview">
            <b>{basePreview.outcome}</b>
            {basePreview.chance != null && <span>Success chance: {(basePreview.chance * 100).toFixed(1).replace('.0', '')}%</span>}
            <p>{basePreview.risk}</p>
            {item.locked && <p>Locked: this item cannot be used as a consumed donor.</p>}
          </div>

          {review && <div className="axe-service-confirm" role="group" aria-label="Review service transaction">
            <h3>Review {getAXEService(review.transactionServiceId)?.label || 'Gem insertion'}</h3>
            <p>{review.preview.confirmation || review.preview.outcome}</p>
            <p>{review.preview.risk}</p>
            <div className="flex flex-wrap gap-1.5">{Object.entries(review.preview.cost).map(([id, count]) => <MaterialPill key={id} id={id} need={count} />)}</div>
            {!Object.keys(review.preview.cost).length && <p>No material cost for this operation.</p>}
            {review.preview.chance != null && <p>Success chance: {(review.preview.chance * 100).toFixed(1).replace('.0', '')}%</p>}
            <div className="mt-2 flex gap-2">
              <Action label={review.preview.confirmation ? 'Confirm irreversible risk' : 'Confirm operation'}
                disabled={pending || !review.preview.canAdvance || Object.entries(review.preview.cost).some(([id, count]) => getAXEServiceResourceCount(id) < count)} onClick={confirmTransaction} />
              <Action label="Cancel" disabled={pending} onClick={() => setReview(null)} />
            </div>
            {!review.preview.canAdvance && <p>{review.preview.reason || 'This equipment has reached the operation limit.'}</p>}
          </div>}
          {pending && <p className="mt-3 text-xs text-sky-100" role="status">Processing the equipment transaction…</p>}

          <fieldset className="mt-5 min-w-0" disabled={pending}>
            {serviceId === 'reinforcement' && (
              <ActionGrid>
                <Action label="Reinforce Item" onClick={() => execute('reinforcement')} />
                <Action label="Protected Reinforcement" onClick={() => execute('reinforcement', { options: { protectedAttempt: true } })} />
              </ActionGrid>
            )}

            {serviceId === 'enchant' && (
              <div>
                <div className="mb-3 text-[10px] uppercase tracking-[0.28em] text-white/35">
                  Enchantment Slots
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {enchantments.map((level, index) => {
                    const cost = getCostForNextLevel(level);
                    return (
                      <button
                        key={index}
                        type="button"
                        disabled={level >= MAX_ENCH_LEVEL}
                        onClick={() => execute('enchant', { slotIndex: index })}
                        className="rounded-xl border border-white/12 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.08]"
                      >
                        <div className="text-[9px] uppercase tracking-[0.25em] text-white/30">Slot {index + 1}</div>
                        <div className="mt-1 text-xl font-semibold text-white/85">+{level}</div>
                        <div className="mt-3 space-y-1 text-[9px] text-white/35">
                          {Object.entries(cost).map(([id, need]) => (
                            <div key={id} className="flex justify-between gap-2">
                              <span>{id.replaceAll('_', ' ')}</span>
                              <span className={getAXEServiceResourceCount(id) >= need ? 'text-emerald-200/65' : 'text-rose-200/70'}>
                                {getAXEServiceResourceCount(id)}/{need}
                              </span>
                            </div>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {enchantments.length > 0 && enchantments.every(level => Number(level) >= MAX_ENCH_LEVEL) &&
                  <div className="mt-4">
                    <Action label="Overenchant" onClick={() => execute('over_enchant')} />
                  </div>}
              </div>
            )}

            {serviceId === 'over_enchant' && (
              <ActionGrid>
                <Action label="Over-Enchant Item" onClick={() => execute('over_enchant')} />
                <Action label="Protected Over-Enchant" onClick={() => execute('over_enchant', { options: { protectedAttempt: true } })} />
              </ActionGrid>
            )}

            {serviceId === 'combine' && (
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <div className="text-[9px] uppercase tracking-[0.28em] text-white/35">Matching Donor Item</div>
                {compatibleDonors.length ? (
                  <>
                    <select
                      value={donorId}
                      onChange={(event) => setDonorId(event.target.value)}
                      className="mt-3 w-full rounded-lg border border-white/10 bg-neutral-900/90 px-3 py-2 text-sm text-white"
                    >
                      <option value="">Choose a donor from inventory</option>
                      {compatibleDonors.map((candidate) => (
                        <option key={candidate.instanceId} value={candidate.instanceId}>
                          {candidate.name} · {candidate.rarity}
                        </option>
                      ))}
                    </select>
                    <Action
                      className="mt-3"
                      label={donor ? `Combine and consume ${donor.name}` : 'Select a donor first'}
                      disabled={!donor}
                      onClick={() => execute('combine', { donorId: donor.instanceId, donor })}
                    />
                  </>
                ) : (
                  <div className="mt-3 text-sm text-white/40">
                    No unequipped, unlocked matching duplicate is owned. Combine requires a real matching donor item.
                  </div>
                )}
              </div>
            )}

            {serviceId === 'stage' && (
              <ActionGrid>
                <Action label="Advance Item Stage" onClick={() => execute('stage')} />
              </ActionGrid>
            )}

            {serviceId === 'refine' && (
              <ActionGrid>
                <Action label="Refine Item" onClick={() => execute('refine')} />
                <Action label="Protected Refine" onClick={() => execute('refine', { options: { protectedAttempt: true } })} />
              </ActionGrid>
            )}

            {serviceId === 'ultimate' && (
              <ActionGrid>
                <Action label="Ultimate Reinforcement" onClick={() => execute('ultimate')} />
                <Action label="Protected Ultimate" onClick={() => execute('ultimate', { options: { protectedAttempt: true } })} />
              </ActionGrid>
            )}

            {serviceId === 'sockets' && (
              <div className="space-y-4">
                <ActionGrid>
                  <Action label="Drill New Socket" onClick={() => execute('sockets')} />
                  <Action label="Protected Drill" onClick={() => execute('sockets', { options: { protectedAttempt: true } })} />
                </ActionGrid>

                <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                  <div className="text-[9px] uppercase tracking-[0.28em] text-white/35">Insert Owned Gem</div>
                  <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                    <select
                      value={selectedGem?.id || ''}
                      onChange={(event) => setSelectedGemId(event.target.value)}
                      className="rounded-lg border border-white/10 bg-neutral-900/90 px-3 py-2 text-sm text-white"
                    >
                      {uniqueOwnedGems.length === 0 && <option value="">No owned gems</option>}
                      {uniqueOwnedGems.map((gem) => (
                        <option key={gem.id} value={gem.id}>
                          {gem.name} · owned {getLootItemCount(gem.id, 'gem')}
                        </option>
                      ))}
                    </select>
                    <Action
                      label={openSocketIndexes.length && selectedGem ? 'Insert Gem' : 'Need open socket + owned gem'}
                      disabled={!openSocketIndexes.some(({ index }) => index === selectedSocket) || !selectedGem}
                      onClick={() => execute('insert_gem', {
                        socketIndex: selectedSocket,
                        gemId: selectedGem?.id,
                      })}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                    {Array.from({ length: sockets.maxSockets || 4 }).map((_, index) => {
                      const socket = sockets.sockets?.[index];
                      return (
                        <button type="button" key={index} aria-pressed={selectedSocket === index}
                          onClick={() => { setSelectedSocket(index); setReview(null); }}
                          className={`rounded-lg border bg-black/[0.10] px-3 py-2 text-left text-xs ${selectedSocket === index ? 'border-sky-200/70' : 'border-white/10'}`}>
                          <div className="text-[9px] uppercase tracking-wider text-white/30">Socket {index + 1}</div>
                          <div className="mt-1 text-white/65">
                            {!socket ? 'Closed' : socket.gemId ? AXE_GEM_DEFINITIONS[socket.gemId]?.name || socket.gemId : 'Open'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {serviceId === 'equipment_aura' && (
              <ActionGrid>
                <Action label={aura ? 'Reroll Equipment Aura' : 'Apply Equipment Aura'} onClick={() => execute('equipment_aura')} />
              </ActionGrid>
            )}
          </fieldset>

          <div className="mt-6 rounded-xl border border-white/8 bg-black/[0.10] p-4 text-xs leading-5 text-white/35">
            Uses the same owned equipment and materials as Character Hub. Every operation is submitted once through the existing transaction gateway.
          </div>
        </div>
        </>}
      </section>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[9px] uppercase tracking-widest text-white/30">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white/80">{value}</div>
    </div>
  );
}

function ActionGrid({ children }) {
  return <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{children}</div>;
}

function Action({ label, onClick, disabled = false, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${className} rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-white/[0.10] disabled:cursor-not-allowed disabled:opacity-30`}
    >
      {label}
    </button>
  );
}

export function AXEProgressionServicePanel({ serviceId, onClose }) {
  const Panel = PROGRESSION_PANELS[serviceId];
  return Panel ? <Panel onClose={onClose} /> : <p role="status">This service is unavailable.</p>;
}

export default function AXEGlobalServicesMenu({
  isOpen = true,
  onClose,
  requestedService = null,
  requestedItemId = null,
  embedded = false,
}) {
  const [activeServiceId, setActiveServiceId] = useState(() =>
    normalizeAXEServiceRequest(requestedService || 'enchant')
  );

  useEffect(() => {
    if (requestedService) setActiveServiceId(normalizeAXEServiceRequest(requestedService));
  }, [requestedService]);

  if (!embedded && !isOpen) return null;

  const active = getAXEService(activeServiceId) || AXE_SERVICE_REGISTRY[0];
  const ProgressionPanel = PROGRESSION_PANELS[active.id] || null;

  return (
    <div className={embedded ? 'axe-services-hub-root h-full w-full' : 'axe-services-hub-root fixed inset-0 z-[190] bg-black/75 p-4 backdrop-blur-md'}>
      <div
        className={embedded
          ? 'relative flex h-full w-full overflow-hidden'
          : 'relative mx-auto flex h-full max-w-[1500px] overflow-hidden rounded-[28px] border border-white/10 shadow-2xl'}
        style={{
          background: embedded
            ? 'linear-gradient(105deg, rgba(99,103,110,0.24) 0%, rgba(48,52,59,0.16) 38%, rgba(15,18,23,0.08) 100%)'
            : 'linear-gradient(105deg, rgba(82,86,93,0.88) 0%, rgba(42,46,53,0.92) 44%, rgba(14,17,22,0.96) 100%)',
          backdropFilter: 'blur(26px) saturate(120%)',
          WebkitBackdropFilter: 'blur(26px) saturate(120%)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              'radial-gradient(circle at 13% 18%, rgba(255,255,255,0.16), transparent 16%), radial-gradient(circle at 70% 10%, rgba(255,255,255,0.10), transparent 13%), radial-gradient(circle at 88% 72%, rgba(255,255,255,0.07), transparent 18%)',
          }}
        />

        <aside className="relative z-10 w-[230px] shrink-0 overflow-y-auto border-r border-white/10 bg-black/[0.10] p-4 backdrop-blur-xl">
          <div className="px-2 pb-4">
            <div className="text-[9px] uppercase tracking-[0.35em] text-white/45">Character Hub</div>
            <div className="mt-1 text-xl font-semibold text-white">Services</div>
            <div className="mt-1 text-xs leading-5 text-white/35">
              Inventory-backed equipment and progression services.
            </div>
          </div>

          {AXE_SERVICE_GROUPS.map((group) => (
            <div key={group.id} className="mb-5">
              <div className="px-2 pb-2 text-[9px] uppercase tracking-[0.24em] text-white/40">
                {group.label}
              </div>
              <div className="space-y-1">
                {(group.visibleServiceIds || group.serviceIds).map((id) => {
                  const entry = getAXEService(id);
                  return entry && (
                    <button
                      key={id}
                      onClick={() => setActiveServiceId(id)}
                      title={entry.description}
                      aria-pressed={active.id === id}
                      className={`w-full rounded-xl px-3 py-2 text-left text-xs transition ${
                        active.id === id
                          ? 'bg-white/[0.12] text-white ring-1 ring-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                          : 'text-white/50 hover:bg-white/[0.06] hover:text-white/80'
                      }`}
                    >
                      {group.id === 'blacksmith' && id === 'combine' ? 'Combine Stage' : entry.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </aside>

        <section className="relative z-10 min-w-0 flex-1">
          {!embedded && (
            <div className="absolute right-4 top-4 z-20">
              <button
                onClick={onClose}
                className="rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs text-white/65 backdrop-blur-xl hover:bg-white/[0.10] hover:text-white"
              >
                Close
              </button>
            </div>
          )}

          <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 border-b border-white/10 px-6 py-3">
              <div className="text-xs font-semibold text-white/80">{active.label}</div>
              <p className="mt-1 text-xs leading-5 text-white/55" role="note">{active.description}</p>
              {(active.id === 'combine' || active.id === 'stage') && <div className="mt-2 flex gap-2">
                <button type="button" aria-pressed={active.id === 'combine'}
                  onClick={() => setActiveServiceId('combine')}>Combine</button>
                <button type="button" aria-pressed={active.id === 'stage'}
                  onClick={() => setActiveServiceId('stage')}>Stage</button>
              </div>}
            </div>
            <div className={embedded ? 'min-h-0 flex-1' : 'min-h-0 flex-1 pt-2'}>
            {active.kind === 'equipment_action' && (
              <EquipmentServicePanel serviceId={active.id} requestedItemId={requestedItemId} />
            )}
            {active.kind === 'progression_panel' && ProgressionPanel && (
              <div className="h-full pt-6">
                <ProgressionPanel serviceId={active.id} onClose={onClose} />
              </div>
            )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
