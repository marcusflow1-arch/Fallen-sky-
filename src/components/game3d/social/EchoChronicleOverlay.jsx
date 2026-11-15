import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, MessageCircle, Hand, Sparkles, X } from 'lucide-react';
import EchoChronicleBook from './EchoChronicleBook';
import toast from 'react-hot-toast';
import { useAuth } from '@/components/auth/AuthContext';
import { callGameServer } from './socialServer';
import { echoConversationCues } from './echoContextualDialogue';
import { getQuestState, subscribeQuests } from '../useQuestStore';
import { echoWorldMoment, getEchoLivingAdventureLeads } from './echoLivingEncounters';
import { createEchoGestureObserver } from './echoGestureEvents';
import {
  getEchoMemories, subscribeEchoMemories, rememberEchoSession,
  getIntroSeenCount, markIntroSeen,
} from './echoChronicleStore';

// This is an invitation-driven conversation with another human player, not an
// NPC simulation. The transparent dock never stops game movement or combat.
// Dialogue suggestions are generated from this confirmed meeting, not a generic script.

// Gestures are visible in the conversation log, but do not claim an animated
// avatar response until matching 3D animations are integrated.
const GESTURES = [
  { id: 'nod', label: 'Nod' },
  { id: 'wave', label: 'Wave' },
  { id: 'bow', label: 'Bow' },
  { id: 'thanks', label: 'Thank' },
  { id: 'farewell', label: 'Farewell' },
];

export default function EchoChronicleOverlay({ suppressed = false, showLauncher = true, onOpenQuestLogbook }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [hiddenId, setHiddenId] = useState(null);
  const [memories, setMemories] = useState(getEchoMemories);
  const [bookOpen, setBookOpen] = useState(false);
  const [questSnapshot, setQuestSnapshot] = useState(getQuestState);
  const [recentWorldMoment, setRecentWorldMoment] = useState(null);
  const [introOpen, setIntroOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const introduced = useRef(new Set());
  const gestureObserver = useRef(createEchoGestureObserver());

  useEffect(() => subscribeEchoMemories(setMemories), []);
  useEffect(() => subscribeQuests(setQuestSnapshot), []);
  useEffect(() => {
    const onWorldQuestEvent = (event) => {
      const moment = echoWorldMoment(event?.detail);
      if (moment) setRecentWorldMoment(moment);
    };
    const onWorldPOI = (event) => {
      const moment = echoWorldMoment({ type: 'location_discovered', id: event?.detail?.id });
      if (moment) setRecentWorldMoment(moment);
    };
    window.addEventListener('axeQuestEvent', onWorldQuestEvent);
    window.addEventListener('echoLocalCombatMoment', onWorldQuestEvent);
    window.addEventListener('axePOIDiscovered', onWorldPOI);
    return () => {
      window.removeEventListener('axeQuestEvent', onWorldQuestEvent);
      window.removeEventListener('echoLocalCombatMoment', onWorldQuestEvent);
      window.removeEventListener('axePOIDiscovered', onWorldPOI);
    };
  }, []);
  useEffect(() => {
    // Different accounts must never share gesture-replay state.
    gestureObserver.current.reset();
    introduced.current.clear();
  }, [userId]);

  const observeGestures = useCallback((sessions, forcePlayback = false) => {
    if (!userId) return;
    gestureObserver.current.observe(sessions, userId, (detail) => {
      // All clients receive the gesture through their server-read transcript.
      // The 3D runtime independently picks a local or remote avatar.
      window.dispatchEvent(new CustomEvent('echoGestureObserved', { detail }));
    }, { forcePlayback });
  }, [userId]);
  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const result = await callGameServer('game3dEchoChronicle', 'get_state');
      const next = result.sessions || [];
      observeGestures(next);
      setSessions(next);
      next.forEach((session) => rememberEchoSession(session, userId));
    } catch (err) {
      // Existing gameplay remains usable if this new backend is not yet deployed.
      console.warn('[Echo Chronicle] could not load conversations:', err?.message);
    }
  }, [userId, observeGestures]);

  useEffect(() => {
    if (!userId) return undefined;
    refresh();
    // Active multiplayer conversations are responsive without requiring a
    // second untrusted P2P gesture channel. Gestures replay at most once.
    const timer = setInterval(refresh, 2500);
    return () => clearInterval(timer);
  }, [userId, refresh]);

  const run = useCallback(async (action, data = {}) => {
    setBusy(true);
    setError('');
    try {
      const result = await callGameServer('game3dEchoChronicle', action, data);
      if (result.session) {
        // Render the initiator's confirmed gesture immediately; other clients
        // discover the same server-authored line during their next refresh.
        if (action === 'gesture') observeGestures([result.session], true);
        setSessions((current) => [result.session, ...current.filter((row) => row.id !== result.session.id)]);
        if (result.session.remembered_at) rememberEchoSession(result.session, userId);
      }
      await refresh();
      return result;
    } catch (err) {
      const detail = err?.message || 'This conversation is unavailable right now';
      setError(detail);
      toast.error(detail);
      return null;
    } finally { setBusy(false); }
  }, [refresh, userId, observeGestures]);

  useEffect(() => {
    if (!userId) return undefined;
    const onAction = async (event) => {
      const detail = event?.detail || {};
      if (detail.action !== 'talk') return;
      if (!detail.playerId || detail.playerId === userId) return;
      const result = await run('start', {
        playerId: detail.playerId,
        contextType: detail.contextType,
        region: detail.region,
      });
      if (result?.session) {
        setSelectedId(result.session.id);
        setHiddenId(null);
        setBookOpen(false);
        if (result.session.status === 'pending') toast('Conversation invitation sent');
      }
    };
    window.addEventListener('gamePlayerAction', onAction);
    return () => window.removeEventListener('gamePlayerAction', onAction);
  }, [userId, run]);

  const openSessions = useMemo(() => sessions.filter((session) =>
    session.status === 'pending' || session.status === 'active' ||
    (session.status === 'finished' && !session.remembered_at)
  ), [sessions]);
  const selected = openSessions.find((session) => session.id === selectedId)
    || openSessions.find((session) => session.status === 'pending' && session.recipient_id === userId)
    || openSessions.find((session) => session.status === 'active');
  const visible = selected && selected.id !== hiddenId && !suppressed;
  const incoming = selected?.status === 'pending' && selected.recipient_id === userId;
  const outgoing = selected?.status === 'pending' && selected.initiator_id === userId;
  const partner = selected?.initiator_id === userId ? selected?.recipient_name : selected?.initiator_name;
  const myConsent = selected?.initiator_id === userId ? selected?.consent_initiator : selected?.consent_recipient;
  const partnerConsent = selected?.initiator_id === userId ? selected?.consent_recipient : selected?.consent_initiator;
  const cues = echoConversationCues(selected || {});
  const adventureLeads = getEchoLivingAdventureLeads(questSnapshot, recentWorldMoment);
  const adventureProposal = selected?.adventure_proposal;
  const pendingAdventure = adventureProposal?.status === 'proposed' &&
    Date.parse(adventureProposal.expires_at || 0) > Date.now();
  const proposingPlayer = adventureProposal?.proposed_by === userId;
  const adventureTitle = ({
    echo_branch_hidden_echo: 'The Hidden Echo',
    echo_branch_broken_road: 'The Broken Road',
  })[adventureProposal?.quest_id] || 'an adventure';
  const transcriptFrozen = !!(myConsent || partnerConsent);
  const lastExchange = selected?.lines?.[(selected.lines?.length || 0) - 1];
  const partnerJustGestured = lastExchange?.kind === 'gesture' && lastExchange.speaker_id !== userId;

  useEffect(() => {
    if (selected?.status !== 'active' || introduced.current.has(selected.id)) return;
    introduced.current.add(selected.id);
    if (getIntroSeenCount() < 2) {
      markIntroSeen();
      setIntroOpen(true);
    }
  }, [selected?.id, selected?.status]);

  const send = async (text) => {
    const value = String(text || '').trim();
    if (!selected || !value || transcriptFrozen) return;
    const result = await run('speak', { sessionId: selected.id, text: value });
    if (result) setMessage('');
  };
  const sendGesture = async (gestureId) => {
    if (!selected || transcriptFrozen) return;
    await run('gesture', { sessionId: selected.id, gestureId });
  };

  // The small HUD launcher is optional; the complete Chronicle remains
  // accessible through the native Escape > HUD & Community page.
  useEffect(() => {
    const openBook=()=>{
      if(suppressed)return;
      setBookOpen(true);
      setHiddenId(null);
      document.exitPointerLock?.();
    };
    window.addEventListener('game3dOpenEchoChronicle',openBook);
    return ()=>window.removeEventListener('game3dOpenEchoChronicle',openBook);
  },[suppressed]);

  if (!userId) return null;

  return (
    <>
      {/* Accessible at any time, without imposing an interaction on solo players. */}
      {!suppressed && showLauncher && (
        <button type="button"
          onClick={() => {
            document.exitPointerLock?.();
            setBookOpen((open) => !open);
            setHiddenId(selected?.id || null);
          }}
          className="axe-echo-launch"
          title={`Open Echo Chronicle · ${memories.length} saved encounters` }
          aria-label="Open Echo Chronicle memory book" aria-expanded={bookOpen}>
          <span className="axe-echo-launch-glyph"><BookOpen size={20} /></span>
          <span className="sr-only">Echo Chronicle · {memories.length} saved encounters</span>
        </button>
      )}
      {!suppressed && openSessions.length > 0 && (
        <button type="button"
          className="fixed right-4 top-[224px] z-[58] pointer-events-auto rounded-lg border border-sky-300/30 bg-slate-950/80 px-3 py-2 text-xs text-sky-100 backdrop-blur-lg"
          onClick={() => { setSelectedId((current) => openSessions.some((item) => item.id === current) ? current : openSessions[0].id); setHiddenId(null); setBookOpen(false); }}>
          <MessageCircle size={13} className="mr-1 inline" /> Conversation {openSessions.length > 1 ? '(' + openSessions.length + ')' : ''}
        </button>
      )}

      {bookOpen && !suppressed && (
        <EchoChronicleBook memories={memories} onClose={() => setBookOpen(false)}
          onOpenQuestLogbook={() => { setBookOpen(false); onOpenQuestLogbook?.(); }} />
      )}

      {visible && (
        <section aria-label="Player conversation"
          className="fixed bottom-[132px] right-4 z-[60] pointer-events-auto w-[min(390px,calc(100vw-32px))] max-h-[55vh] overflow-auto rounded-xl border border-sky-300/35 bg-slate-950/90 text-slate-100 shadow-2xl backdrop-blur-xl">
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2"><MessageCircle size={16} className="text-sky-300" />
              <div><div className="text-sm font-semibold">{partner || 'Another traveler'}</div>
                <div className="text-[11px] text-slate-400">{cues.place} · {selected.context_type || 'encounter'}</div>
              </div>
            </div>
            <button type="button" onClick={() => { setHiddenId(selected.id); setIntroOpen(false); }}
              title="Minimize conversation" aria-label="Minimize conversation"><X size={17} /></button>
          </header>
          <div className="space-y-3 p-4">
            {incoming && (
              <>
                <p className="text-sm">{partner} wants to talk. You can decline or continue your adventure.</p>
                <div className="flex gap-2">
                  <button type="button" disabled={busy} className="rounded bg-sky-600 px-3 py-2 text-xs" onClick={() => run('accept', { sessionId: selected.id })}>Accept</button>
                  <button type="button" disabled={busy} className="rounded border border-white/20 px-3 py-2 text-xs" onClick={() => run('decline', { sessionId: selected.id })}>Decline</button>
                </div>
              </>
            )}
            {outgoing && (
              <>
                <p className="text-xs text-slate-300">Invitation sent. Waiting for the other player to choose.</p>
                <button type="button" disabled={busy} className="text-xs underline text-sky-200" onClick={() => run('decline', { sessionId: selected.id })}>Withdraw invitation</button>
              </>
            )}
            {selected.status === 'active' && (
              <>
                {introOpen ? (
                  <div className="relative overflow-hidden rounded-xl border border-sky-300/35 bg-gradient-to-br from-slate-900 via-sky-950/90 to-slate-950 p-4">
                    <div className="absolute -right-4 -top-5 h-24 w-24 rounded-full border border-sky-300/20 bg-sky-400/10 blur-md" aria-hidden="true" />
                    <div className="relative">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[.18em] text-sky-200">
                        <Sparkles size={14}/> A moment between travelers
                      </div>
                      <div className="mt-2 text-base font-semibold">{cues.heading}</div>
                      <p className="mt-1 text-xs text-slate-300">{cues.place}
                        {selected.previous_encounters > 0 ? ' · You chose to remember an earlier encounter' : ' · A new encounter'}
                      </p>
                      <div className="mt-3 border-l-2 border-sky-300/40 pl-3 text-xs leading-relaxed text-slate-200">
                        This is a real player, not a scripted character. What happens next depends on both of you.
                        You may speak, acknowledge them without words, or continue exploring.
                      </div>
                      <p className="mt-3 text-[11px] text-slate-400">Movement stays available; this introduction is optional.</p>
                      <div className="mt-3 flex gap-3 text-xs">
                        <button type="button" className="rounded bg-sky-700 px-3 py-2" onClick={() => setIntroOpen(false)}>See interaction choices</button>
                        <button type="button" className="underline text-slate-300" onClick={() => setIntroOpen(false)}>Skip</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="max-h-[145px] space-y-1 overflow-auto text-xs" aria-live="polite">
                      {!selected.lines?.length && <p className="italic text-slate-400">No words exchanged yet.</p>}
                      {(selected.lines || []).map((line, index) => (
                        <div key={index} className={'rounded px-2 py-1 ' + (line.kind === 'gesture' ? 'bg-sky-950/70 italic text-slate-300' : 'bg-white/5')}>
                          <span className="font-semibold text-sky-200">{line.speaker_name}: </span>{line.text}
                        </div>
                      ))}
                    </div>
                    {partnerJustGestured && !transcriptFrozen && (
                      <div className="flex items-center justify-between gap-3 rounded border border-sky-300/25 bg-sky-950/40 px-3 py-2 text-xs">
                        <span className="text-sky-100">{partner} {lastExchange.text}. Acknowledge them?</span>
                        <button type="button" disabled={busy} onClick={() => sendGesture('nod')}
                          className="shrink-0 rounded border border-sky-300/40 px-2 py-1 text-sky-200">
                          Nod back
                        </button>
                      </div>
                    )}
                    <p className="text-[11px] text-sky-200">{cues.heading}</p>
                    <p className="text-[11px] text-slate-400">{cues.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {cues.lines.map((line) => (
                        <button key={line} type="button" disabled={transcriptFrozen} onClick={() => setMessage(line)}
                          className="rounded border border-white/15 px-2 py-1 text-[11px] text-slate-200 hover:bg-white/10">{line}</button>
                      ))}
                    </div>
                    {adventureProposal?.status === 'agreed' && (
                      <div className="rounded-lg border border-emerald-300/25 bg-emerald-950/25 px-3 py-2 text-xs">
                        <strong className="text-emerald-200">You both agreed to consider {adventureTitle}.</strong>
                        <p className="mt-1 text-slate-300">This is a shared plan, not a completed quest.
                          Each traveler visits the quest giver and accepts independently.</p>
                      </div>
                    )}
                    {pendingAdventure && (
                      <div className="rounded-lg border border-sky-300/30 bg-sky-950/40 px-3 py-2 text-xs">
                        <strong className="text-sky-200">Adventure invitation: {adventureTitle}</strong>
                        <p className="mt-1 text-slate-300">
                          {proposingPlayer ? 'Waiting for the other traveler to choose.'
                            : 'The other traveler suggested an adventure. You may accept or decline.'}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {!proposingPlayer && (
                            <button type="button" disabled={busy || transcriptFrozen}
                              onClick={() => run('respond_adventure', { sessionId: selected.id, choice: 'accept' })}
                              className="rounded border border-emerald-300/40 px-2 py-1 text-emerald-200">Agree to explore</button>
                          )}
                          <button type="button" disabled={busy || transcriptFrozen}
                            onClick={() => run('respond_adventure', { sessionId: selected.id, choice: 'decline' })}
                            className="rounded border border-white/20 px-2 py-1 text-slate-300">
                            {proposingPlayer ? 'Withdraw offer' : 'Decline'}
                          </button>
                        </div>
                      </div>
                    )}
                    {adventureLeads.length > 0 && !pendingAdventure &&
                      adventureProposal?.status !== 'agreed' && (
                      <div className="rounded-lg border border-sky-300/20 bg-sky-950/30 px-3 py-2">
                        <p className="mb-1 text-xs font-medium text-sky-200">Living Encounter · Optional Adventures</p>
                        <p className="mb-2 text-[11px] text-slate-400">
                          Suggest an adventure while traveling together. Both of you must agree.
                          Each player accepts the quest independently from the NPC.
                        </p>
                        <div className="flex flex-col gap-1">
                          {adventureLeads.map((lead) => (
                            <button key={lead.questId} type="button" disabled={busy || transcriptFrozen}
                              onClick={() => run('propose_adventure', { sessionId: selected.id, questId: lead.questId })}
                              className="rounded border border-white/15 px-2 py-1 text-left text-[11px] text-sky-100 disabled:opacity-40">
                              <strong>{lead.title}</strong> · Suggest visiting {lead.npc}
                              {lead.nearbyHint && <span className="block mt-1 text-sky-300">{lead.nearbyHint} (your experience)</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="border-t border-white/10 pt-2">
                      <p className="mb-2 flex items-center gap-1 text-[11px] text-sky-200"><Hand size={12} /> Acknowledge without words</p>
                      <div className="flex flex-wrap gap-1">
                        {GESTURES.map((gesture) => (
                          <button key={gesture.id} type="button" disabled={busy || transcriptFrozen}
                            onClick={() => sendGesture(gesture.id)}
                            className="rounded border border-sky-300/20 bg-sky-950/30 px-2 py-1.5 text-[11px] hover:bg-sky-900/50 disabled:opacity-40">
                            {gesture.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <form onSubmit={(event) => { event.preventDefault(); send(message); }} className="flex gap-2">
                      <input aria-label="Your response" value={message} disabled={transcriptFrozen}
                        onKeyDown={(event) => event.stopPropagation()} onKeyUp={(event) => event.stopPropagation()}
                        onChange={(event) => setMessage(event.target.value)}
                        maxLength={220} placeholder={transcriptFrozen ? 'Memory requested — conversation paused' : 'Or write your own response...'} className="min-w-0 flex-1 rounded bg-white/10 px-2 py-2 text-xs outline-none focus:ring-1 focus:ring-sky-300" />
                      <button disabled={busy || transcriptFrozen || !message.trim()} type="submit" className="rounded bg-sky-700 px-3 py-2 text-xs disabled:opacity-40">Say</button>
                    </form>
                    <p className="text-[11px] text-slate-400">Keep walking, acknowledge another player, or leave. Gestures are visible in-world and do not grant XP or loot.</p>
                  </>
                )}
              </>
            )}
            {selected.status === 'finished' && (
              <p className="rounded border border-white/10 p-2 text-xs text-slate-300">
                The conversation ended. You can part ways, or ask to remember this encounter together.
              </p>
            )}
            {['active', 'finished'].includes(selected.status) && (
              <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-3 text-xs">
                <button type="button" disabled={busy || myConsent || (!(selected.lines || []).length && adventureProposal?.status !== 'agreed')}
                  className="rounded border border-sky-300/40 px-2 py-1 text-sky-200 disabled:opacity-40"
                  onClick={() => run('remember', { sessionId: selected.id })}>
                  {myConsent ? 'You agreed to remember' : 'Remember together'}
                </button>
                {myConsent && !partnerConsent && <span className="text-slate-400">Waiting for their choice</span>}
                {!myConsent && partnerConsent && <span className="text-slate-400">They asked to remember this exchange; the transcript is now paused.</span>}
                {myConsent && !partnerConsent && !selected.remembered_at && (
                  <button type="button" disabled={busy} className="text-slate-300 underline"
                    onClick={() => run('withdraw_remember', { sessionId: selected.id })}>Withdraw memory request</button>
                )}
                {!myConsent && partnerConsent && !selected.remembered_at && (
                  <button type="button" disabled={busy} className="text-slate-300 underline"
                    onClick={() => run('decline_remember', { sessionId: selected.id })}>Don't save this exchange</button>
                )}
                {selected.remembered_at && <span className="text-emerald-300">Saved to both Chronicles</span>}
                {selected.status === 'active' && <button type="button" disabled={busy} className="text-slate-300 underline"
                  onClick={() => run('finish', { sessionId: selected.id })}>End conversation</button>}
              </div>
            )}
            {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
          </div>
        </section>
      )}
    </>
  );
}
