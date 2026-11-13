import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Swords, UserPlus, ArrowLeftRight, Users, MessageCircle, X, Ban,
  ShieldAlert, Flag, Trophy, ChevronLeft, ChevronRight, Footprints,
  Waves, HeartHandshake, Brush, Bone, Compass, Hand, Moon, Sparkles,
} from 'lucide-react';

// One context panel for remote heroes and the local rideable companion.
// It opens from the right edge, leaving the middle of the world visible.
// Existing middle-click lock-on stays separate from this social menu.
const playerActions = [
  { id: 'trade', label: 'Trade request', Icon: ArrowLeftRight },
  { id: 'duel', label: 'Duel', Icon: Swords },
  { id: 'party', label: 'Invite to party', Icon: Users },
  { id: 'clan', label: 'Invite to guild / clan', Icon: Flag },
  { id: 'compete', label: 'Compete', Icon: Trophy, more: true },
  { id: 'friend', label: 'Add friend', Icon: UserPlus },
  { id: 'talk', label: 'Talk / Echo Chronicle', Icon: MessageCircle },
  { id: 'block', label: 'Block messages', Icon: Ban, caution: true },
  { id: 'report', label: 'Report player', Icon: ShieldAlert, caution: true, more: true },
];
const competitionActions = [
  { id: 'race', label: 'Race to a waypoint', Icon: Footprints },
  { id: 'arm_wrestle', label: 'Arm wrestling', Icon: Hand },
  { id: 'kill_contest', label: 'Most enemy kills', Icon: Swords },
  { id: 'checkpoint_sprint', label: 'Checkpoint sprint', Icon: Flag },
  { id: 'survival', label: 'Survival endurance', Icon: ShieldAlert },
  { id: 'treasure_rush', label: 'Treasure rush', Icon: Compass },
];
const reportActions = [
  { id: 'harassment', label: 'Harassment', Icon: ShieldAlert },
  { id: 'spam', label: 'Spam / unwanted messages', Icon: MessageCircle },
  { id: 'cheating', label: 'Cheating / exploits', Icon: Swords },
  { id: 'offensive_name', label: 'Offensive player name', Icon: Flag },
  { id: 'other', label: 'Other concern', Icon: ShieldAlert },
];
const mountActions = [
  { id: 'mount:follow', label: 'Follow me', Icon: Footprints },
  { id: 'mount:fetch', label: 'Fetch a ball', Icon: Bone },
  { id: 'mount:treasure', label: 'Search for treasure', Icon: Compass },
  { id: 'mount:water_play', label: 'Play near water', Icon: Waves },
  { id: 'mount:brush', label: 'Brush / groom', Icon: Brush },
  { id: 'mount:bond', label: 'Spend time together', Icon: HeartHandshake },
  { id: 'mount:rest', label: 'Rest', Icon: Moon },
];

export default function PlayerInteractionMenu({ open, player, kind = 'player', onClose, onAction }) {
  const [submenu, setSubmenu] = useState('');
  useEffect(() => { setSubmenu(''); }, [open, player?.id, kind]);
  // The panel is modal and persistent: clicking the world/backdrop must not
  // dismiss a pet, mount, or player menu. Only X, Escape or choosing an action
  // can close it; submenu navigation itself leaves it open.
  useEffect(() => {
    if (!open) return undefined;
    const escape = event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation?.();
      onClose?.();
    };
    window.addEventListener('keydown', escape, true);
    return () => window.removeEventListener('keydown', escape, true);
  }, [open, onClose]);
  if (!player) return null;
  const isMount = kind === 'mount';
  const choices = isMount ? mountActions : submenu === 'compete' ? competitionActions : submenu === 'report' ? reportActions : playerActions;
  const heading = isMount ? 'Companion interactions' : submenu === 'compete' ? 'Choose a competition' : submenu === 'report' ? 'Report a concern' : 'Player interactions';
  const perform = action => {
    if (action.more) { setSubmenu(action.id); return; }
    onAction?.(submenu === 'compete' ? 'compete:' + action.id : submenu === 'report' ? 'report:' + action.id : action.id, player);
    onClose?.();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[110] bg-black/10"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={event => event.stopPropagation()}
            onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }}
          />
          <div className="fixed z-[111] right-4 sm:right-[5%] top-1/2 -translate-y-1/2 w-[min(360px,calc(100vw-32px))]">
            <motion.section
              role="dialog" aria-label={heading}
              initial={{ x: 110, opacity: 0, filter: 'blur(7px)' }}
              animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
              exit={{ x: 110, opacity: 0, filter: 'blur(7px)' }}
              transition={{ type: 'spring', stiffness: 270, damping: 30 }}
              className="relative max-h-[calc(100vh-56px)] overflow-y-auto rounded-[22px] border border-cyan-200/20 text-white shadow-[0_18px_90px_rgba(0,0,0,.68)]"
              style={{
                background: 'linear-gradient(100deg,rgba(11,22,35,.75),rgba(8,17,30,.97) 26%,rgba(10,23,37,.95) 74%,rgba(8,18,29,.7))',
                backdropFilter: 'blur(24px) saturate(150%)',
                WebkitBackdropFilter: 'blur(24px) saturate(150%)',
              }}
            >
              <div className="pointer-events-none absolute inset-0 rounded-[22px]"
                style={{ background: 'radial-gradient(ellipse at 5% 5%,rgba(90,197,223,.14),transparent 49%),radial-gradient(ellipse at 100% 100%,rgba(61,93,172,.15),transparent 58%)', boxShadow: 'inset 0 0 38px rgba(5,12,22,.7)' }} />
              <div className="relative">
                <header className="flex items-start gap-2 px-5 pt-5 pb-3 border-b border-white/10">
                  {submenu && !isMount && (
                    <button type="button" aria-label="Back to player interactions"
                      onClick={() => setSubmenu('')}
                      className="mt-1 rounded-lg p-1 text-cyan-100/70 hover:text-white hover:bg-white/10">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[.24em] text-cyan-200/65">
                      <Sparkles className="w-3 h-3" /> {heading}
                    </div>
                    <h2 className="mt-1 truncate text-base font-semibold tracking-wide">{player.name || 'Unknown'}</h2>
                  </div>
                  <button type="button" aria-label="Close interactions" onClick={onClose}
                    className="rounded-full border border-white/10 p-1.5 text-white/65 hover:bg-white/10 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </header>
                <div className="px-3 py-3 space-y-0.5">
                  {choices.map(item => (
                    <button key={item.id} type="button"
                      onClick={() => perform(item)}
                      className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-cyan-100/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200"
                    >
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${item.caution ? 'border-rose-200/15 bg-rose-200/[.04] text-rose-200/80' : 'border-cyan-200/10 bg-cyan-200/[.055] text-cyan-100/75'}`}>
                        <item.Icon className="w-4 h-4" />
                      </span>
                      <span className="flex-1 text-[13px] tracking-wide text-white/85 group-hover:text-white">{item.label}</span>
                      {item.more && <ChevronRight className="h-4 w-4 text-white/35 group-hover:text-white/65" />}
                    </button>
                  ))}
                </div>
                <p className="px-5 pb-4 text-[10px] leading-relaxed text-white/35">
                  {isMount ? 'Some mount activities await animation and world placement.' : submenu === 'compete' ? 'Challenges are consensual; their arena and scoring require a future world implementation.' : submenu === 'report' ? 'Reports are private and routed to moderation.' : 'Hold Alt to access the cursor. Right-click a player to reopen.'}
                </p>
              </div>
            </motion.section>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
