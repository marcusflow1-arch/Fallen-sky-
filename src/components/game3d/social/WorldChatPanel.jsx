import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { partyStore } from './socialStores';
import { WORLD_CHAT_CHANNEL, fetchChatHistory, partyChatChannel, sendChatMessage } from './worldChat';
import { listGame3DBlockedPlayers } from './game3dWorldInteractions';

/**
 * WorldChatPanel — the world's chat box, docked above the left Jade HUD skill diamond.
 *
 * World chat reaches everyone in the world; party chat only the party. Enter opens the
 * input and sends; Esc closes it. While typing, keys never reach the game: the input
 * stops them, so WASD, skill numbers or F do nothing until the chat closes.
 * Messages go through worldChat (server rules); new ones arrive live.
 */
const MAX_LINES = 80;
const CHANNEL_STYLE = {
  world: { label: 'World', tag: 'text-amber-200/80', name: 'text-amber-100' },
  party: { label: 'Party', tag: 'text-cyan-200/80', name: 'text-cyan-100' },
};

export default function WorldChatPanel({ userId, suppressed = false, showDock = true }) {
  const [party, setParty] = useState(partyStore.get());
  const [tab, setTab] = useState('world');
  const [lines, setLines] = useState({ world: [], party: [] });
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [blockedIds, setBlockedIds] = useState(() => new Set());
  const inputRef = useRef(null);
  const listRef = useRef(null);
  useEffect(() => partyStore.subscribe(setParty), []);
  useEffect(() => {
    if (!userId) { setBlockedIds(new Set()); return undefined; }
    let live = true;
    const reload = async () => {
      try {
        const result = await listGame3DBlockedPlayers();
        if (live) setBlockedIds(new Set(result.blockedUserIds || []));
      } catch { /* private chat server still enforces blocks if the HUD is offline */ }
    };
    void reload();
    window.addEventListener('game3dBlockedListChanged', reload);
    return () => { live = false; window.removeEventListener('game3dBlockedListChanged', reload); };
  }, [userId]);
  const partyChannel = party.partyId ? partyChatChannel(party.partyId) : null;
  const inParty = !!party.partyId && (party.members || []).length > 1;
  useEffect(() => { if (!inParty && tab === 'party') setTab('world'); }, [inParty, tab]);

  const addLines = useCallback((channel, messages) => {
    setLines((prev) => {
      const seen = new Set(prev[channel].map((m) => m.id));
      const merged = [...prev[channel], ...messages.filter((m) => m && !m.is_deleted && !seen.has(m.id))];
      return { ...prev, [channel]: merged.slice(-MAX_LINES) };
    });
  }, []);

  // history for the world, and for the party while in one
  useEffect(() => {
    if (!userId) return;
    fetchChatHistory('world').then((r) => addLines('world', r.messages || [])).catch(() => {});
  }, [userId, addLines]);
  useEffect(() => {
    setLines((prev) => ({ ...prev, party: [] }));
    if (!userId || !inParty) return;
    fetchChatHistory('party').then((r) => addLines('party', r.messages || [])).catch(() => {});
  }, [userId, inParty, partyChannel, addLines]);

  // new messages, live
  useEffect(() => {
    if (!userId) return undefined;
    return base44.entities.ChatMessage.subscribe((event) => {
      const m = event?.data;
      if (!m || event.type === 'delete') return;
      if (m.channel_id === WORLD_CHAT_CHANNEL) addLines('world', [m]);
      else if (partyChannel && m.channel_id === partyChannel) addLines('party', [m]);
    });
  }, [userId, partyChannel, addLines]);

  // Opening chat from Settings uses the exact same real world/party channel.
  useEffect(() => {
    const open = () => { if (!suppressed) setTyping(true); };
    window.addEventListener('game3dOpenWorldChat',open);
    return () => window.removeEventListener('game3dOpenWorldChat',open);
  },[suppressed]);
  // Enter (outside any field) opens the chat
  useEffect(() => {
    const onKey = (e) => {
      if (suppressed || window.__axeServiceModeOpen) return;
      if (e.key !== 'Enter' || typing || e.target?.matches?.('input, textarea, [contenteditable="true"]')) return;
      e.preventDefault();
      setTyping(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [typing, suppressed]);
  useEffect(() => {
    if (suppressed) inputRef.current?.blur();
    else if (typing) inputRef.current?.focus();
  }, [typing, suppressed]);
  useEffect(() => { listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight }); }, [lines, tab]);

  const close = () => { setTyping(false); setDraft(''); inputRef.current?.blur(); };
  const send = async () => {
    const text = draft.trim();
    if (!text) { close(); return; }
    try {
      const { message } = await sendChatMessage(tab, text);
      if (message) addLines(tab, [message]);
      setNotice('');
      close();
    } catch (e) {
      setNotice(e?.code === 'rate_limit' ? 'Slow down a little.' : e?.code === 'conflict' ? 'You just said that.' : e?.message || 'Message not sent.');
    }
  };
  // keys typed into the chat never reach the game's hotkeys
  const onInputKey = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); send(); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  };

  if (!userId || (!showDock && !typing)) return null;
  const shown = (lines[tab] || []).filter(line => !blockedIds.has(line.sender_id));
  const style = CHANNEL_STYLE[tab];
  return (
    <div
      className={`game3d-world-chat fixed z-[40] rounded-xl transition-colors ${typing ? 'pointer-events-auto' : 'pointer-events-none'}`}
      style={{ background: typing ? 'rgba(10, 14, 22, 0.78)' : 'rgba(10, 14, 22, 0.32)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)' }}
      aria-label="Chat"
    >
      <div className="pointer-events-auto flex items-center gap-1 px-2 pt-1.5">
        <MessageSquare className="h-3 w-3 text-white/45" />
        {['world', ...(inParty ? ['party'] : [])].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => { setTab(key); setTyping(true); }}
            className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${tab === key ? 'bg-white/10 text-white/85' : 'text-white/40 hover:text-white/70'}`}
          >
            {CHANNEL_STYLE[key].label}
          </button>
        ))}
        {!typing && <span className="ml-auto text-[9px] text-white/35">Enter to chat</span>}
      </div>
      <div ref={listRef} className="game3d-chat-messages max-h-[110px] overflow-y-auto px-2 py-1 text-[11px] leading-snug">
        {shown.length === 0 && <div className="text-white/30">No messages yet.</div>}
        {shown.map((m) => (
          <div key={m.id} className="break-words text-white/80">
            <span className={`${style.tag} mr-1`}>[{style.label}]</span>
            <span className={`${style.name} font-semibold`}>{m.sender_id === userId ? 'You' : (m.sender_name || 'Player')}:</span>{' '}
            <span>{m.content}</span>
          </div>
        ))}
      </div>
      {typing && (
        <div className="border-t border-white/10 px-2 py-1.5">
          <input
            ref={inputRef}
            value={draft}
            maxLength={200}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onInputKey}
            onKeyUp={(e) => e.stopPropagation()}
            onBlur={() => { if (!draft.trim()) setTyping(false); }}
            placeholder={`Message ${style.label.toLowerCase()} chat`}
            className="w-full rounded bg-black/30 px-2 py-1 text-[11px] text-white placeholder:text-white/30 focus:outline-none"
          />
          {notice && <div className="mt-1 text-[10px] text-amber-200/80">{notice}</div>}
        </div>
      )}
    </div>
  );
}
