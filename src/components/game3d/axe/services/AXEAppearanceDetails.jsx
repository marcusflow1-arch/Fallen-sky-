import { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, Gem, Shirt, Sparkles, X } from 'lucide-react';
import {
  AXE_VANITY_CARD_TYPES, AXE_VANITY_PIECES, AXE_VANITY_SLOTS,
} from '../progression/AXEVanitySystem';
import {
  activateAXEVanityPiece, equipAXEVanityPiece, unequipAXEVanitySlot,
} from '../progression/AXEVanityStore';
import {
  equipAXECostume, unequipAXECostume, setAXECostumeHidden,
  toggleAXECostumeFavorite,
} from '../progression/AXECostumeStore';
import { getAXECostumeBonuses } from '../progression/AXECostumeSystem';

const LABELS = { hp:'HP', maxHP:'HP', damage:'Attack', strength:'Strength',
  defense:'Defense', spirit:'Spirit', focus:'Focus', dexterity:'Dexterity',
  constitution:'Constitution', critChance:'Crit Rate', critDamage:'Crit Damage',
  criticalDefense:'Critical Defense', critDefense:'Critical Defense',
  chi:'Chi', dodge:'Dodge' };
const PERCENT_STATS = new Set(['critChance','critDamage','criticalDefense','critDefense','dodge']);
const nonzeroStats = stats => Object.entries(stats || {}).filter(([,value]) => Number(value));
const statLabel = (key,value) =>
  '+' + Number(value).toLocaleString('en-US',{ maximumFractionDigits:2 }) +
  (PERCENT_STATS.has(key) ? '%' : '');
function PieceIcon({ item }) {
  const image = item?.appearanceImage || item?.iconUrl;
  return image ? <img src={image} alt="" loading="lazy"/> :
    item?.kind === 'costume' ? <Shirt size={30}/> : <Gem size={30}/>;
}
function Stats({ stats }) {
  const values = nonzeroStats(stats);
  return values.length ? values.map(([key,value]) => <div className="axe-app-bonus-row" key={key}>
    <span>{LABELS[key] || key}</span><b>{statLabel(key,value)}</b></div>) :
    <p className="axe-app-description">No stat bonuses defined for this item.</p>;
}
export default function AXEAppearanceDetails({
  tab, selectedItem, vanity, costumes, onSelectPiece, onNotice,
}) {
  const [reviewId,setReviewId] = useState(null);
  const [cardType,setCardType] = useState('silver');
  useEffect(() => { setReviewId(null); }, [selectedItem?.id, tab]);
  const chosenVanity = selectedItem?.kind === 'vanity' ? selectedItem : null;
  const chosenCostume = selectedItem?.kind === 'costume' ? selectedItem : null;
  const active = chosenVanity
    ? vanity.equippedBySlot?.[chosenVanity.slot] === chosenVanity.id
    : !!chosenCostume && costumes.equippedCostumeId === chosenCostume.id;
  const activated = chosenVanity && vanity.activationByPieceId?.[chosenVanity.id]?.active;
  const statPackage = chosenVanity?.baseBonus || (chosenCostume ? getAXECostumeBonuses(chosenCostume.id) : {});
  const setPieces = chosenVanity ? Object.values(AXE_VANITY_PIECES)
    .filter(piece => piece.setId === chosenVanity.setId) : [];
  const wornSet = setPieces.filter(piece => vanity.equippedBySlot?.[piece.slot] === piece.id);
  const complete = setPieces.length > 0 && wornSet.length === setPieces.length;
  const setName = chosenVanity?.setId?.replace(/^axe_vanity_/,'').replaceAll('_',' ') || '';
  const notify = (outcome, message) => {
    onNotice(outcome?.ok === false ? String(outcome.message || outcome.reason || 'Unavailable')
      .replaceAll('_',' ') : message);
    setReviewId(null);
  };
  const equip = () => notify(chosenVanity
    ? active ? unequipAXEVanitySlot(chosenVanity.slot) : equipAXEVanityPiece(chosenVanity.id)
    : active ? unequipAXECostume() : equipAXECostume(chosenCostume.id),
    active ? 'Appearance unequipped.' : 'Appearance equipped.');

  // The only currently valid "Enchant" mechanic for Vanity is its existing
  // Silver/Gold card activation. Costumes do not have an enchant transaction.
  const enchantEnabled = !!chosenVanity && !activated;
  const finishEnchant = () => notify(activateAXEVanityPiece(chosenVanity.id,cardType),
    'Vanity card enchantment activated.');


  return <section className="axe-app-card axe-app-unified-details" aria-label="Selected appearance details">
    {selectedItem ? <>
      <header className="axe-app-unified-header">
        <div className="axe-app-selected-medallion"><PieceIcon item={selectedItem}/></div>
        <div className="axe-app-unified-identity">
          <h3>{selectedItem.name}</h3>
          <span>{chosenVanity ? 'Vanity · ' +
            (AXE_VANITY_SLOTS[chosenVanity.slot]?.label || chosenVanity.slot) : 'Costume'}</span>
          <small>{active ? 'Equipped' : 'Not Equipped'}</small>
        </div>
        <span className={'axe-app-rarity axe-app-rarity--' + (selectedItem.rarity || 'common')}>
          {selectedItem.rarity || 'Common'}</span>
      </header>
      {chosenCostume && <p className="axe-app-description">Source: {chosenCostume.source || 'Unknown'}</p>}
      <div className="axe-app-detail-heading">Stats</div>
      <div className="axe-app-unified-stats">
        <Stats stats={statPackage}/>
        {activated && <div className="axe-app-bonus-row axe-app-active">
          <span>Card Enchant · {AXE_VANITY_SLOTS[chosenVanity.slot]?.mappedStatLabel}</span>
          <b>+{vanity.activationByPieceId[chosenVanity.id].percent}%</b>
        </div>}
      </div>
      {chosenVanity && <div className="axe-app-unified-set" aria-label="Vanity set equipment">
        <div className="axe-app-detail-heading axe-app-unified-set-heading">
          <span>Vanity Set ({setName})</span>
          <strong>{wornSet.length} / {setPieces.length} Equipped</strong>
        </div>
        <p className="axe-app-set-description">{complete
          ? 'Set complete. All four equipped pieces provide their existing bonuses.'
          : 'Equip the matching pieces to complete this four-piece set.'}</p>
        <div className="axe-app-unified-set-slots">
          {setPieces.map(piece => {
            const wearing = vanity.equippedBySlot?.[piece.slot] === piece.id;
            const owned = vanity.ownedPieceIds.includes(piece.id);
            return <button type="button" key={piece.id} disabled={!owned}
              title={piece.name + (wearing ? ' · Equipped' : owned ? ' · Owned' : ' · Not owned')}
              aria-pressed={wearing} onClick={() => { setReviewId(null); onSelectPiece(piece.id); }}>
              <PieceIcon item={piece}/>
              <small>{AXE_VANITY_SLOTS[piece.slot]?.label || piece.slot}</small>
              {wearing && <Check className="axe-app-unified-set-check" size={15}/>}
            </button>;
          })}
        </div>
        <div className="axe-app-unified-set-benefits">
          <div className="axe-app-bonus-row"><span>Set Completion</span>
            <b>{complete ? 'Complete' : 'Incomplete'}</b></div>
          {wornSet.map(piece => <div className="axe-app-bonus-row" key={piece.id}>
            <span>{AXE_VANITY_SLOTS[piece.slot]?.label || piece.slot}</span>
            <b>{nonzeroStats(piece.baseBonus).map(([key,value]) =>
              (LABELS[key] || key) + ' ' + statLabel(key,value)).join(', ') || 'No bonus'}</b>
          </div>)}

        </div>
      </div>}
      <div className="axe-app-unified-actions">
        <button className="axe-app-unified-equip" type="button" onClick={equip}>
          <Shirt size={18}/>{active ? 'Unequip' : 'Equip'}</button>
        <button className="axe-app-unified-enchant" type="button" disabled={!enchantEnabled}
          title={chosenCostume ? 'Costume enchantment is not configured'
            : activated ? 'Already enchanted' : 'Activate this Vanity piece using a Silver or Gold Card'}
          onClick={() => { setCardType('silver'); setReviewId(chosenVanity.id); }}>
          <Sparkles size={18}/>{activated ? 'Enchanted' : 'Enchant'}</button>
      </div>
      {chosenCostume && <div className="axe-app-unified-extras">
        <button type="button" onClick={() => notify(toggleAXECostumeFavorite(chosenCostume.id),
          'Favorites updated.')}>
          {costumes.favorites.includes(chosenCostume.id) ? '★ Favorite' : '☆ Favorite'}</button>
        <button type="button" onClick={() => notify(setAXECostumeHidden(!costumes.hidden),
          costumes.hidden ? 'Costume shown.' : 'Costume hidden.')}>
          {costumes.hidden ? <Eye size={16}/> : <EyeOff size={16}/>}
          {costumes.hidden ? 'Show Costume' : 'Hide Costume'}</button>
      </div>}
      {chosenVanity && reviewId === chosenVanity.id &&
        <div className="axe-app-review" role="group" aria-label="Review Vanity Card activation">
          <p>Enchant {chosenVanity.name} by activating its mapped stat bonus?
            One owned Vanity Card will be spent only after confirmation.</p>
          <div>{Object.values(AXE_VANITY_CARD_TYPES).map(card => <button type="button"
            key={card.id} aria-pressed={cardType === card.id}
            onClick={() => setCardType(card.id)}>
            {card.label} ({vanity.cards?.[card.id] || 0})</button>)}</div>
          <button type="button" disabled={!vanity.cards?.[cardType]} onClick={finishEnchant}>
            Confirm Enchant</button>
          <button type="button" onClick={() => setReviewId(null)}>Cancel</button>
        </div>}
    </> : <div className="axe-app-unified-empty">
      <Gem size={34}/><h3>Appearance Details</h3>
      <p>No owned {tab === 'Costumes' ? 'outfits' : 'pieces'} available.
        Select an item from Inventory to inspect its real stats.</p>
    </div>}
  </section>;
}
