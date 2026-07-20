import { useEffect, useMemo, useState, useReducer, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { ShareMenu } from './ShareExport.jsx';
import { ThemeToggle } from './theme.jsx';
import { Logo } from './icons.jsx';
import { touchRecent, getRecents } from './identity.js';

const uid = () => crypto.randomUUID().slice(0, 8);
const EMOJIS = ['😀','😂','🤣','😊','😉','😍','🥰','😎','🤔','😐','😴','😢','😭','😡','🤯','🥳','🤝','👍','👎','👏','🙏','💪','👌','✌️','❤️','💔','🔥','⭐','✨','🎉','🎯','✅','❌','⚠️','❓','💡','📌','🚀','☕','🎈'];
const fmtTime = (ts) => new Date(ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
const fmtDay = (ts) => new Date(ts).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
const dayKey = (ts) => new Date(ts).toDateString();
const SIDE_MIN = 180, SIDE_MAX = 420, SIDE_DEFAULT = 250;
const POLL_MS = 20000;

// Right-hand panel: chats visited on this browser. Polls each doc's updatedAt to sort by
// last activity (newest message rises to top) and flag unread. The open chat is always
// injected into the list so it can never vanish while recents lag a poll behind.
function ChatSidebar({ currentToken, currentTitle, width, onDragStart }) {
  const nav = useNavigate();
  const [recents, setRecents] = useState(() => getRecents().filter((r) => r.type === 'chat'));
  const [activity, setActivity] = useState({}); // token -> server updatedAt (ms)

  useEffect(() => {
    let stopped = false;
    async function poll() {
      const list = getRecents().filter((r) => r.type === 'chat');
      if (!stopped) setRecents(list);
      const results = await Promise.all(list.map(async (c) => {
        try { const info = await (await fetch('/api/docs/' + c.token)).json(); return [c.token, info.updatedAt || 0]; }
        catch { return [c.token, null]; } // null → keep the previous value, don't drop the chat
      }));
      if (stopped) return;
      setActivity((prev) => {
        const next = { ...prev };
        results.forEach(([t, v]) => { if (v !== null) next[t] = v; });
        return next;
      });
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { stopped = true; clearInterval(id); };
  }, [currentToken]);

  const map = new Map(recents.map((r) => [r.token, r]));
  if (currentToken && !map.has(currentToken)) map.set(currentToken, { token: currentToken, title: currentTitle, type: 'chat', at: Date.now() });
  const items = [...map.values()].map((c) => {
    const isCurrent = c.token === currentToken;
    return {
      token: c.token,
      title: (isCurrent ? currentTitle : '') || c.title || "צ'אט ללא שם",
      unread: !isCurrent && (activity[c.token] || 0) > (c.at || 0),
      act: Math.max(c.at || 0, activity[c.token] || 0),
      isCurrent,
    };
  }).sort((a, b) => b.act - a.act);

  return (
    <aside className="ch-side" style={{ width }}>
      <div className="ch-side-head">צ'אטים אחרונים</div>
      <div className="ch-side-list">
        {items.map((c) => (
          <button key={c.token} className={'ch-side-item' + (c.isCurrent ? ' active' : '')}
            onClick={() => !c.isCurrent && nav('/d/' + c.token)}>
            {c.unread && <span className="ch-side-dot" title="הודעות חדשות" />}
            <span className="ch-side-title">{c.title}</span>
          </button>
        ))}
        {!items.length && <div className="ch-side-empty">הצ'אטים שביקרת בהם יופיעו כאן</div>}
      </div>
      <div className="ch-side-resizer" onPointerDown={onDragStart} />
    </aside>
  );
}

export default function Chat({ info, user, token }) {
  const editable = info.mode === 'edit';
  const [, force] = useReducer((c) => c + 1, 0);
  const [status, setStatus] = useState('connecting');
  const [title, setTitle] = useState('');
  const [peers, setPeers] = useState([]);
  const [draft, setDraft] = useState('');
  const [reply, setReply] = useState(null);   // {id, name, text}
  const [emojiOpen, setEmojiOpen] = useState(false);
  const listRef = useRef();
  const inputRef = useRef();
  const typingTimer = useRef();
  const vid = useMemo(() => localStorage.getItem('colabo.vid') || 'me', []);
  const [sideW, setSideW] = useState(() => {
    const saved = +localStorage.getItem('colabo.chatSideW');
    return saved >= SIDE_MIN && saved <= SIDE_MAX ? saved : SIDE_DEFAULT;
  });
  const latestSideW = useRef(sideW);

  function startResize(e) {
    e.preventDefault();
    const startX = e.clientX, startW = sideW;
    function move(ev) {
      const w = Math.min(SIDE_MAX, Math.max(SIDE_MIN, startW + (startX - ev.clientX)));
      latestSideW.current = w;
      setSideW(w);
    }
    function up() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      localStorage.setItem('colabo.chatSideW', String(latestSideW.current));
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  const ydoc = useMemo(() => new Y.Doc(), []);
  const messages = ydoc.getArray('messages');
  const provider = useMemo(() => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return new HocuspocusProvider({
      url: `${proto}://${location.host}/collab`, name: info.docId, token, document: ydoc,
      onStatus: ({ status }) => setStatus(status),
    });
  }, []);

  useEffect(() => {
    ydoc.on('update', force);
    const meta = ydoc.getMap('meta');
    const syncTitle = () => setTitle(meta.get('title') || '');
    meta.observe(syncTitle);
    syncTitle();
    provider.setAwarenessField('user', user);
    const aw = provider.awareness;
    const syncPeers = () => setPeers(
      [...aw.getStates().entries()].filter(([id]) => id !== aw.clientID).map(([, s]) => s).filter((s) => s.user)
    );
    aw.on('change', syncPeers);
    return () => { ydoc.off('update', force); meta.unobserve(syncTitle); aw.off('change', syncPeers); provider.destroy(); };
  }, []);

  useEffect(() => { touchRecent(token, title, info.mode, 'chat'); }, [title]);

  const msgs = messages.toArray();

  // stick to bottom on new messages
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  function onType(v) {
    setDraft(v);
    provider.setAwarenessField('typing', true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => provider.setAwarenessField('typing', false), 1800);
  }
  function send() {
    const text = draft.trim();
    if (!text) return;
    messages.push([{ id: uid(), vid, name: user.name, color: user.color, text, ts: Date.now(), replyTo: reply?.id || null }]);
    setDraft('');
    setReply(null);
    setEmojiOpen(false);
    provider.setAwarenessField('typing', false);
    inputRef.current?.focus();
  }
  const byId = (id) => msgs.find((m) => m.id === id);
  function jumpTo(id) {
    const el = document.getElementById('msg-' + id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1200);
  }

  const typers = peers.filter((p) => p.typing && p.user).map((p) => p.user.name);
  const exportTxt = () => {
    const out = `צ'אט: ${title || 'ללא שם'}\n\n` + msgs.map((m) =>
      `[${fmtDay(m.ts)} ${fmtTime(m.ts)}] ${m.name}: ${m.text}`).join('\n') + '\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + out], { type: 'text/plain;charset=utf-8' }));
    a.download = `${title || 'צאט'}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="doc-page">
      <header className="topbar">
        <Link to="/" className="logo-sm"><Logo size={24} /></Link>
        <input className="title-input" placeholder="צ'אט ללא שם" value={title} readOnly={!editable}
          onChange={(e) => ydoc.getMap('meta').set('title', e.target.value)} />
        {!editable && <span className="badge">צפייה בלבד</span>}
        <span className={'conn ' + status} />
        <div className="peers">
          {peers.slice(0, 8).map((p, i) => (
            <span key={i} className="peer" style={{ background: p.user.color }} title={p.user.name}>{p.user.name[0]}</span>
          ))}
        </div>
        <div className="actions">
          <button className="btn" onClick={exportTxt}>הורדה</button>
          <ShareMenu info={info} />
          <ThemeToggle />
        </div>
      </header>

      <div className="ch-body">
      <ChatSidebar currentToken={token} currentTitle={title} width={sideW} onDragStart={startResize} />
      <div className="ch-main">
      <div className="ch-list" ref={listRef}>
        {!msgs.length && <div className="ch-empty">עוד אין הודעות — תכתבו את הראשונה 💬</div>}
        {msgs.map((m, i) => {
          const mine = m.vid === vid;
          const prev = msgs[i - 1];
          const chain = prev && prev.vid === m.vid && m.ts - prev.ts < 5 * 60e3;
          const newDay = !prev || dayKey(prev.ts) !== dayKey(m.ts);
          const q = m.replyTo && byId(m.replyTo);
          return (
            <div key={m.id}>
              {newDay && <div className="ch-day"><span>{fmtDay(m.ts)}</span></div>}
              <div id={'msg-' + m.id} className={'ch-row' + (mine ? ' mine' : '')}>
                <div className="ch-bubble" style={mine ? {} : { borderInlineStartColor: m.color }}>
                  {!mine && !chain && <div className="ch-name" style={{ color: m.color }}>{m.name}</div>}
                  {q && (
                    <div className="ch-quote" onClick={() => jumpTo(q.id)}>
                      <b style={{ color: q.color }}>{q.name}</b>
                      <span>{q.text.length > 90 ? q.text.slice(0, 90) + '…' : q.text}</span>
                    </div>
                  )}
                  {m.replyTo && !q && <div className="ch-quote gone">ההודעה המקורית לא נמצאה</div>}
                  <div className="ch-text">{m.text}</div>
                  <span className="ch-time">{fmtTime(m.ts)}</span>
                  {editable && (
                    <button className="ch-reply" title="תגובה"
                      onClick={() => { setReply({ id: m.id, name: m.name, text: m.text }); inputRef.current?.focus(); }}>↩</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {typers.length > 0 && (
          <div className="ch-typing">
            <span className="ch-typing-dots"><i /><i /><i /></span>
            {typers.join(', ')} {typers.length > 1 ? 'מקלידים' : 'מקליד/ה'}…
          </div>
        )}
      </div>

      {editable && (
        <div className="ch-input-wrap">
          {reply && (
            <div className="ch-reply-bar">
              <span>בתגובה ל<b>{reply.name}</b>: {reply.text.length > 60 ? reply.text.slice(0, 60) + '…' : reply.text}</span>
              <button onClick={() => setReply(null)}>✕</button>
            </div>
          )}
          <div className="ch-input-row">
            <button className="ch-emoji-btn" title="אימוג'י" onClick={() => setEmojiOpen((v) => !v)}>😊</button>
            <textarea ref={inputRef} rows="1" placeholder="כתיבת הודעה…" value={draft}
              onChange={(e) => onType(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <button className="ch-send" disabled={!draft.trim()} onClick={send} title="שליחה">➤</button>
            {emojiOpen && (
              <div className="ch-emojis">
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => { onType(draft + e); inputRef.current?.focus(); }}>{e}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
      </div>
    </div>
  );
}
