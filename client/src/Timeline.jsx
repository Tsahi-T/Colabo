import { useEffect, useMemo, useState, useReducer, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { ShareMenu } from './ShareExport.jsx';
import { ThemeToggle } from './theme.jsx';
import { PASTELS } from './board-io.js';
import { touchRecent } from './identity.js';

const DAY = 864e5;
const uid = () => crypto.randomUUID().slice(0, 8);
const today = () => new Date().toISOString().slice(0, 10);
const MARKS = { 'צהוב': '#eab308', 'ורוד': '#ec4899', 'כחול': '#3b82f6', 'ירוק': '#22c55e', 'סגול': '#8b5cf6' };
const fmt = (iso) => new Date(iso + 'T00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
const download = (text, name) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

// Lanes: alternate above/below the axis, two stem lengths each side, to reduce card collisions.
const LANES = [
  { dir: -1, stem: 46 }, { dir: 1, stem: 46 }, { dir: -1, stem: 150 }, { dir: 1, stem: 150 },
];

export default function Timeline({ info, user, token }) {
  const editable = info.mode === 'edit';
  const [, force] = useReducer((c) => c + 1, 0);
  const [status, setStatus] = useState('connecting');
  const [title, setTitle] = useState('');
  const [peers, setPeers] = useState([]);
  const [sel, setSel] = useState(null);
  const [editing, setEditing] = useState(null);
  const [ppd, setPpd] = useState(12); // pixels per day
  const fileRef = useRef();

  const ydoc = useMemo(() => new Y.Doc(), []);
  const items = ydoc.getMap('items');
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
      [...aw.getStates().entries()].filter(([id]) => id !== aw.clientID).map(([, s]) => s.user).filter(Boolean)
    );
    aw.on('change', syncPeers);
    return () => { ydoc.off('update', force); meta.unobserve(syncTitle); aw.off('change', syncPeers); provider.destroy(); };
  }, []);

  useEffect(() => { touchRecent(token, title, info.mode, 'timeline'); }, [title]);

  useEffect(() => {
    const onKey = (e) => {
      if (!editable || editing || !sel) return;
      if (e.key === 'Delete') { del(sel); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---- layout: time-proportional, right-to-left ----
  const sorted = [...items.entries()]
    .map(([id, m]) => ({ id, date: m.get('date') || today(), text: m.get('text') || '', color: m.get('color') || MARKS['כחול'] }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  const PAD = 130;
  const minT = sorted.length ? +new Date(sorted[0].date) : Date.now();
  const maxT = sorted.length ? +new Date(sorted[sorted.length - 1].date) : Date.now();
  const spanDays = Math.max(7, (maxT - minT) / DAY);
  const W = Math.max(940, spanDays * ppd + PAD * 2);
  const xOf = (iso) => W - PAD - ((+new Date(iso) - minT) / DAY) * ppd; // newest at the left
  const laid = sorted.map((m, i) => ({ ...m, x: xOf(m.date), lane: LANES[i % LANES.length] }));

  // month ticks
  const ticks = [];
  if (sorted.length) {
    const d = new Date(minT); d.setDate(1);
    for (; +d <= maxT + 31 * DAY; d.setMonth(d.getMonth() + 1)) {
      ticks.push({ x: xOf(d.toISOString().slice(0, 10)), label: d.toLocaleDateString('he-IL', { month: 'short', year: '2-digit' }) });
    }
  }

  // ---- mutations ----
  function add() {
    const id = uid(), m = new Y.Map();
    ydoc.transact(() => {
      m.set('date', today()); m.set('text', ''); m.set('color', MARKS['כחול']);
      items.set(id, m);
    });
    setSel(id); setEditing(id);
  }
  const del = (id) => { items.delete(id); setSel(null); setEditing(null); };

  // ---- TXT ----
  const exportTxt = () => download(
    `ציר זמן: ${title || 'ללא שם'}\n\n` + sorted.map((m) => `${m.date} | ${m.text.replace(/\n/g, ' / ')}`).join('\n') + '\n',
    `${title || 'ציר זמן'}.txt`);
  async function importTxt(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const rows = (await f.text()).split(/\r?\n/)
      .map((l) => l.match(/^(\d{4}-\d{2}-\d{2})\s*\|\s*(.*)$/)).filter(Boolean);
    if (!rows.length) return alert('לא נמצאו אבני דרך בקובץ (פורמט: YYYY-MM-DD | תיאור)');
    if (items.size && !confirm('הטעינה תחליף את ציר הזמן הנוכחי. להמשיך?')) return;
    ydoc.transact(() => {
      [...items.keys()].forEach((k) => items.delete(k));
      rows.forEach(([, date, text]) => {
        const m = new Y.Map();
        m.set('date', date); m.set('text', text); m.set('color', MARKS['כחול']);
        items.set(uid(), m);
      });
    });
  }

  return (
    <div className="doc-page">
      <header className="topbar">
        <Link to="/" className="logo-sm">📝</Link>
        <input className="title-input" placeholder="ציר זמן ללא שם" value={title} readOnly={!editable}
          onChange={(e) => ydoc.getMap('meta').set('title', e.target.value)} />
        {!editable && <span className="badge">צפייה בלבד</span>}
        <span className={'conn ' + status} />
        <div className="peers">
          {peers.slice(0, 8).map((p, i) => (
            <span key={i} className="peer" style={{ background: p.color }} title={p.name}>{p.name[0]}</span>
          ))}
        </div>
        <div className="actions">
          {editable && <>
            <button className="btn" onClick={() => fileRef.current.click()}>טעינה</button>
            <input ref={fileRef} type="file" accept=".txt" hidden onChange={importTxt} />
          </>}
          <button className="btn" onClick={exportTxt}>הורדה</button>
          <ShareMenu info={info} />
          <ThemeToggle />
        </div>
      </header>
      {editable && (
        <div className="toolbar board-bar">
          <button className="btn" onClick={add}>+ אבן דרך</button>
          <span className="sep" />
          <button className="tb" title="הקטנה" onClick={() => setPpd((p) => Math.max(2, p / 1.4))}>−</button>
          <button className="tb" title="הגדלה" onClick={() => setPpd((p) => Math.min(60, p * 1.4))}>+</button>
          <span className="sep" />
          {Object.entries(MARKS).map(([name, hex]) => (
            <button key={hex} title={name} className="swatch-sm" style={{ background: hex }}
              onClick={() => sel && items.get(sel)?.set('color', hex)} />
          ))}
          {sel && <><span className="sep" /><button className="tb" title="מחיקה" onClick={() => del(sel)}>🗑</button></>}
          <span className="hint" style={{ marginInlineStart: 'auto' }}>הזמן זורם מימין לשמאל · המרחק בין אבני הדרך יחסי ללוח השנה</span>
        </div>
      )}
      <div className="tl-wrap" onClick={() => { setSel(null); editing && setEditing(null); }}>
        <div className="tl-inner" dir="ltr" style={{ width: W }}>
          <div className="tl-axis" style={{ left: 40, width: W - PAD + 40 }} />
          {ticks.map((t, i) => (
            <span key={i}>
              <span className="tl-tick" style={{ left: t.x }} />
              <span className="tl-tick-label" style={{ right: W - t.x }}>{t.label}</span>
            </span>
          ))}
          {laid.map((m) => (
            <div key={m.id} className="tl-node" style={{ right: W - m.x }}>
              <div className="tl-dot" style={{ background: m.color }}
                onClick={(e) => { e.stopPropagation(); editable && setSel(m.id); }} />
              <div className="tl-stem" style={m.lane.dir < 0 ? { bottom: 8, height: m.lane.stem } : { top: 8, height: m.lane.stem }} />
              <div dir="rtl"
                className={'tl-card' + (sel === m.id ? ' sel' : '')}
                style={{ borderTopColor: m.color, ...(m.lane.dir < 0 ? { bottom: m.lane.stem + 10 } : { top: m.lane.stem + 10 }) }}
                onClick={(e) => { e.stopPropagation(); if (editable) { setSel(m.id); } }}
                onDoubleClick={(e) => { e.stopPropagation(); editable && setEditing(m.id); }}>
                {editing === m.id ? (
                  <>
                    <input type="date" value={m.date} onClick={(e) => e.stopPropagation()}
                      onChange={(e) => e.target.value && items.get(m.id)?.set('date', e.target.value)} />
                    <textarea autoFocus defaultValue={m.text} placeholder="תיאור אבן הדרך…"
                      onInput={(e) => items.get(m.id)?.set('text', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                      onBlur={(e) => { if (!e.relatedTarget || !e.currentTarget.parentElement.contains(e.relatedTarget)) setEditing(null); }} />
                  </>
                ) : (
                  <>
                    <div className="tl-date">{fmt(m.date)}</div>
                    <div className="tl-text">{m.text || <i style={{ color: 'var(--ink3)' }}>ללא תיאור</i>}</div>
                  </>
                )}
                {editable && <button className="tl-del" title="מחיקה" onClick={(e) => { e.stopPropagation(); del(m.id); }}>✕</button>}
              </div>
            </div>
          ))}
          {!sorted.length && (
            <div className="tl-empty" dir="rtl">
              {editable ? 'לוחצים "+ אבן דרך" כדי להתחיל לבנות את ציר הזמן' : 'ציר הזמן ריק עדיין'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
