import { useEffect, useState } from 'react';
import { subscribeOTSAim } from '../player/otsAimStore';
import './OTSAimReticle.css';

// Bow users always get a precise centre-screen point. Holding aim changes the
// camera framing, not the point the mouse controls. Combat uses the same
// camera-centre ray; the reticle itself never awards hits.
export default function OTSAimReticle() {
  const [aim, setAim] = useState({ aiming: false, side: 1, bowEquipped: false, blocked: false });
  useEffect(() => subscribeOTSAim(setAim), []);
  const visible = (aim.bowEquipped || aim.aiming) && !aim.blocked;
  return (
    <div
      className={`ots-reticle${visible ? ' is-active' : ''}${aim.side < 0 ? ' is-left' : ''}`}
      aria-hidden="true"
    >
      <span className="ots-reticle-dot" />
      <span className="ots-reticle-tick ots-reticle-top" />
      <span className="ots-reticle-tick ots-reticle-right" />
      <span className="ots-reticle-tick ots-reticle-bottom" />
      <span className="ots-reticle-tick ots-reticle-left" />
    </div>
  );
}