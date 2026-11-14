// First approved blue-gold curved HUD concept, rebuilt as live HTML/CSS/SVG.
// The arc, glass and sockets are a reusable template, not a baked screenshot.
// Exactly one actual inventory weapon is drawn at a time by the parent.
// Every socket is a real button, and its image is the item's owned icon/thumbnail.
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Crosshair, Fan, Settings2, Shield, Sword, Swords } from 'lucide-react';

const ROLE_ICONS = Object.freeze({ offensive:Swords, defensive:Shield, ranged:Crosshair });

function weaponIllustration(item, role) {
  if (!item) return ROLE_ICONS[role] || Sword;
  const text=`${item.masteryWeaponId||''} ${item.weaponFamily||''} ${item.name||''} ${item.type||''}`.toLowerCase();
  if (/bow|archer|rifle|gun/.test(text)) return Crosshair;
  if (/fan|sky/.test(text)) return Fan;
  if (/dagger|dual|blades/.test(text)) return Swords;
  return Sword;
}

export function getAXEWeaponHUDArtwork(item) {
  const candidates=[item?.iconUrl,item?.thumbnailUrl,item?.imageUrl,item?.image,item?.thumbnail];
  // Item icons must come from actual inventory, never from a fabricated model,
  // and never accept script/data URLs as rendered artwork.
  return candidates.find(url=>typeof url==='string' &&
    (/^\/(?!\/)/.test(url)||/^https:\/\//.test(url))) || null;
}

export default function AXECurvedWeaponTemplate({
  rows, getItem, activeId, assigning, wheelRef,
  onDraw, onAssign, onCycle, onFavorite, onTouchStart, onTouchEnd,
}) {
  return (
    <div className="jade-weapon-layout jade-curved-weapon-template"
      ref={wheelRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      aria-label="Curved three-slot weapon selector, mouse wheel to cycle weapons">
      <div className="jade-weapon-sweep">
        <svg className="jade-weapon-curve" viewBox="0 0 200 340" preserveAspectRatio="none" aria-hidden="true">
          <path className="jade-weapon-curve-glow" d="M156 20 C70 20 14 88 12 170 C12 252 70 320 156 320" />
          <path className="jade-weapon-curve-thread" d="M163 27 C81 27 24 92 23 170 C23 249 81 313 163 313" />
          <path className="jade-weapon-curve-gold" d="M145 18 L156 8 L167 18 L156 28 Z M145 322 L156 312 L167 322 L156 332 Z" />
        </svg>
        <button type="button" className="jade-weapon-curve-step jade-weapon-curve-step--top"
          onClick={()=>onCycle(-1)} aria-label="Previous weapon" title="Previous weapon">
          <ArrowUp size={14} aria-hidden="true" />
        </button>
        <div className="jade-weapon-stack" role="group" aria-label="Weapon quick slots">
          {rows.map(row=>{
            const item=getItem(row.role);
            const Icon=weaponIllustration(item,row.role);
            const active=!!item && item.instanceId===activeId;
            const artwork=getAXEWeaponHUDArtwork(item);
            return (
              <div className={`jade-weapon-role-entry jade-weapon-role-entry--${row.role}`}
                key={row.role} data-role={row.role} data-active={active?'true':'false'}>
                <div className="jade-weapon-socket">
                  <button type="button"
                    className={`jade-weapon-card jade-weapon-card--${row.role}${active?' is-active':''}`}
                    onClick={()=>onDraw(row.role)}
                    aria-pressed={active}
                    aria-label={item?`Equip ${item.name} in the ${row.label} slot`:`Choose a weapon for the ${row.label} slot`}
                    title={item?`${row.label}: ${item.name} (click to equip)`:`${row.label}: empty; click to choose`}>
                    <span className="jade-weapon-portrait" aria-hidden="true">
                      <Icon className="jade-weapon-fallback-art" size={27} strokeWidth={1.6} />
                      {artwork && <img key={artwork} className="jade-weapon-item-art" src={artwork} alt=""
                        loading="lazy" onError={event=>{event.currentTarget.style.display='none';}}/>}
                    </span>
                    <span className="jade-weapon-copy">
                      <span className="jade-weapon-role-label">{row.label}</span>
                      <span className="jade-weapon-item-label">{item?.name||'Empty slot'}</span>
                    </span>
                  </button>
                  <button type="button" className="jade-weapon-assign"
                    aria-label={`Assign any owned weapon to ${row.label}`}
                    title={`Choose a weapon for ${row.label}`}
                    aria-expanded={assigning===row.role}
                    onClick={()=>onAssign(row.role)}>
                    <Settings2 size={13} aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <button type="button" className="jade-weapon-curve-step jade-weapon-curve-step--bottom"
          onClick={()=>onCycle(1)} aria-label="Next weapon" title="Next weapon">
          <ArrowDown size={14} aria-hidden="true" />
        </button>
      </div>
      <aside className="jade-weapon-legend" aria-label="Weapon switching shortcuts">
        <span className="jade-weapon-legend-title">Weapon Select</span>
        <div className="jade-weapon-shortcut"><kbd><ArrowLeft size={13}/></kbd><span>Previous</span></div>
        <div className="jade-weapon-shortcut">
          <button type="button" className="jade-weapon-favorite-key" onClick={onFavorite}
            aria-label="Draw primary favorite weapon" title="Primary or favorite weapon"><ArrowUp size={13}/></button>
          <span>Favorite</span>
        </div>
        <div className="jade-weapon-shortcut"><kbd><ArrowRight size={13}/></kbd><span>Next</span></div>
        <div className="jade-weapon-legend-rule" aria-hidden="true" />
        <span className="jade-weapon-wheel-hint">Mouse wheel<br/>Cycle on hover</span>
      </aside>
    </div>
  );
}
