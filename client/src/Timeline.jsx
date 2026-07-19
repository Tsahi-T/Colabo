import { useEffect, useMemo, useState, useReducer, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { ShareMenu, Menu } from './ShareExport.jsx';
import { ThemeToggle } from './theme.jsx';
import { Logo } from './icons.jsx';
import { touchRecent } from './identity.js';
import { printDoc, esc } from './printExport.js';

const DAY = 864e5;
const uid = () => crypto.randomUUID().slice(0, 8);
const today = () => new Date().toISOString().slice(0, 10);
export const MARKS = {
  'כחול': '#3b82f6', 'טורקיז': '#06b6d4', 'ירוק': '#22c55e', 'צהוב': '#eab308',
  'כתום': '#f97316', 'אדום': '#ef4444', 'ורוד': '#ec4899', 'סגול': '#8b5cf6',
};
const fmt = (iso) => new Date(iso + 'T00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
const download = (text, name) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

export default function Timeline({ info, user, token }) {
  const editable = info.mode === 'edit';
  const [, force] = useReducer((c) => c + 1, 0);
  const [status, setStatus] = useState('connecting');
  const [title, setTitle] = useState('');
  const [peers, setPeers] = useState([]);
  const [sel, setSel] = useState(null);
  const [zoom, setZoom] = useState(1); // 1 = the whole timeline fits the canvas
  const canvasRef = useRef();
  const fileRef = useRef();
  const [cw, setCw] = useState(1000);
  const tPts = useRef(new Map()); // touch points for pinch-zoom
  const tPinch = useRef(null);

  function cDown(e) {
    if (e.pointerType !== 'touch') return;
    tPts.current.set(e.pointerId, [e.clientX, e.clientY]);
    if (tPts.current.size === 2) {
      const [a, b] = [...tPts.current.values()];
      tPinch.current = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z: zoom };
    }
  }
  function cMove(e) {
    if (e.pointerType !== 'touch' || !tPts.current.has(e.pointerId)) return;
    tPts.current.set(e.pointerId, [e.clientX, e.clientY]);
    const p = tPinch.current;
    if (p && tPts.current.size === 2) {
      const [a, b] = [...tPts.current.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
      setZoom(Math.min(12, Math.max(1, p.z * (d / p.d))));
    }
  }
  function cUp(e) {
    tPts.current.delete(e.pointerId);
    if (tPts.current.size < 2) tPinch.current = null;
  }

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
    const measure = () => setCw(canvasRef.current?.clientWidth || 1000);
    measure();
    window.addEventListener('resize', measure);
    return () => {
      ydoc.off('update', force); meta.unobserve(syncTitle); aw.off('change', syncPeers);
      window.removeEventListener('resize', measure); provider.destroy();
    };
  }, []);

  useEffect(() => { touchRecent(token, title, info.mode, 'timeline'); }, [title]);

  // ---- data ----
  const sorted = [...items.entries()]
    .map(([id, m]) => ({ id, date: m.get('date') || today(), text: m.get('text') || '', color: m.get('color') || MARKS['כחול'] }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  // ---- canvas layout: right-to-left, calendar-proportional, fits by default ----
  const PADS = 100, PADE = 90; // start (right) / end (arrow, left) padding
  const minT = sorted.length ? +new Date(sorted[0].date) : Date.now();
  const maxT = sorted.length ? +new Date(sorted[sorted.length - 1].date) : Date.now();
  const spanDays = Math.max(10, (maxT - minT) / DAY + 2);
  const ppd = Math.min(90, Math.max(0.2, ((cw - PADS - PADE) / spanDays) * zoom));
  const W = Math.max(cw, spanDays * ppd + PADS + PADE);
  const xOf = (t) => W - PADS - ((t - minT) / DAY) * ppd; // earliest on the right
  const laid = sorted.map((m, i) => ({
    ...m, x: xOf(+new Date(m.date)),
    up: i % 2 === 0, far: i % 4 >= 2, // alternate above/below, two distances
  }));

  // adaptive ticks: months, or years for long ranges; thin labels when crowded
  const ticks = [];
  if (sorted.length) {
    const yearly = spanDays > 1100;
    const d = new Date(minT);
    yearly ? (d.setMonth(0, 1)) : d.setDate(1);
    const step = yearly ? 12 : Math.ceil((spanDays / 30) / 14) || 1;
    for (; +d <= maxT + (yearly ? 366 : 31) * DAY; d.setMonth(d.getMonth() + step)) {
      ticks.push({
        x: xOf(+d),
        label: yearly ? String(d.getFullYear()) : d.toLocaleDateString('he-IL', { month: 'short', year: '2-digit' }),
      });
    }
  }
  const todayT = +new Date(today());
  const showToday = sorted.length && todayT >= minT - 5 * DAY && todayT <= maxT + 5 * DAY;

  // ---- mutations ----
  function add() {
    const id = uid(), m = new Y.Map();
    const last = sorted[sorted.length - 1];
    const nextDate = last ? new Date(+new Date(last.date) + 14 * DAY).toISOString().slice(0, 10) : today();
    ydoc.transact(() => {
      m.set('date', nextDate); m.set('text', ''); m.set('color', MARKS['כחול']);
      items.set(id, m);
    });
    setSel(id);
  }
  function del(m) {
    if (m.text && !confirm(`למחוק את "${m.text}"?`)) return;
    items.delete(m.id);
    if (sel === m.id) setSel(null);
  }

  // ---- TXT / PDF ----
  const exportTxt = () => download(
    `ציר זמן: ${title || 'ללא שם'}\n\n` + sorted.map((m) => `${m.date} | ${m.text.replace(/\n/g, ' / ')}`).join('\n') + '\n',
    `${title || 'ציר זמן'}.txt`);
  const exportPdf = () => printDoc(
    `<h1>${esc(title || 'ציר זמן')}</h1>` + (sorted.length
      ? sorted.map((m) => `<div class="pm-item" style="border-color:${m.color}"><div class="pm-date">${esc(fmt(m.date))}</div><div class="pm-text">${esc(m.text) || 'ללא תיאור'}</div></div>`).join('')
      : '<p>אין אבני דרך.</p>'),
    title || 'ציר זמן',
    '.pm-item{border-inline-start:4px solid #ccc;padding:.5rem 1rem;margin-bottom:.7rem;break-inside:avoid}.pm-date{font-weight:700;font-size:.85rem;color:#555}.pm-text{font-size:1.02rem;margin-top:.2rem}');
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
        <Link to="/" className="logo-sm"><Logo size={24} /></Link>
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
            <button className="btn" title="ניתן לטעון קובץ TXT בפורמט שיוצא מהמערכת בלבד" onClick={() => fileRef.current.click()}>טעינה</button>
            <input ref={fileRef} type="file" accept=".txt" hidden onChange={importTxt} />
          </>}
          <Menu label="הורדה">
            <button onClick={exportPdf}>PDF (הדפסה)</button>
            <button onClick={exportTxt}>TXT — לטעינה חוזרת</button>
          </Menu>
          <ShareMenu info={info} />
          <ThemeToggle />
        </div>
      </header>
      {editable && (
        <div className="toolbar board-bar">
          <button className="btn" onClick={add}>+ אבן דרך</button>
          <span className="sep" />
          <button className="tb" title="הקטנה" onClick={() => setZoom((z) => Math.max(1, z / 1.35))}>−</button>
          <button className="tb" title="הגדלה" onClick={() => setZoom((z) => Math.min(12, z * 1.35))}>+</button>
          <button className="btn" onClick={() => setZoom(1)}>התאם למסך</button>
          <span className="sep" />
          {Object.entries(MARKS).map(([name, hex]) => (
            <button key={hex} title={name} className="swatch-sm" style={{ background: hex }}
              onClick={() => sel && items.get(sel)?.set('color', hex)} />
          ))}
          <span className="hint" style={{ marginInlineStart: 'auto' }}>עורכים ברשימה מימין · הזמן זורם מימין לשמאל</span>
        </div>
      )}
      <div className="tl-split">
        <aside className="tl-list">
          <div className="tl-list-head"><span>אבן דרך</span><span>תאריך</span></div>
          <div className="tl-rows">
            {sorted.map((m, i) => (
              <div key={m.id} className={'tlr' + (sel === m.id ? ' sel' : '')} onClick={() => setSel(m.id)}>
                <span className="tlr-idx" style={{ background: m.color }}>{i + 1}</span>
                {editable ? (
                  <>
                    <input className="tlr-text" placeholder="שם אבן הדרך…" value={m.text}
                      onChange={(e) => items.get(m.id)?.set('text', e.target.value)} />
                    <input className="tlr-date" type="date" value={m.date}
                      onChange={(e) => e.target.value && items.get(m.id)?.set('date', e.target.value)} />
                    <button className="tlr-del" title="מחיקה" onClick={(e) => { e.stopPropagation(); del(m); }}>✕</button>
                  </>
                ) : (
                  <>
                    <span className="tlr-text">{m.text || '—'}</span>
                    <span className="tlr-date-ro">{fmt(m.date)}</span>
                  </>
                )}
              </div>
            ))}
            {!sorted.length && <div className="tlr-empty">אין עדיין אבני דרך</div>}
          </div>
          {editable && <button className="btn tlr-add" onClick={add}>+ הוספת אבן דרך</button>}
        </aside>
        <div className="tl-canvas" ref={canvasRef} onClick={() => setSel(null)}
          onPointerDownCapture={cDown} onPointerMoveCapture={cMove} onPointerUpCapture={cUp} onPointerCancelCapture={cUp}>
          <div className="tl-stage" dir="ltr" style={{ width: W }}>
            {title && <div className="tlc-title" dir="rtl">{title}</div>}
            {sorted.length > 0 && <div className="tl-axis" style={{ left: PADE - 46, width: W - PADS - PADE + 46 + 30 }} />}
            {ticks.map((t, i) => (
              <span key={i}>
                <span className="tl-tick" style={{ left: t.x }} />
                <span className="tl-tick-label" style={{ left: t.x }}>{t.label}</span>
              </span>
            ))}
            {showToday && (
              <>
                <div className="tl-today" style={{ left: xOf(todayT) }} />
                <span className="tl-today-label" style={{ left: xOf(todayT) }}>היום</span>
              </>
            )}
            {laid.map((m, i) => (
              <div key={m.id} className={'tl-ms' + (sel === m.id ? ' sel' : '') + (m.up ? ' up' : ' down')}
                style={{ left: m.x }}
                onClick={(e) => { e.stopPropagation(); setSel(m.id); }}>
                <span className="tl-ms-dot" style={{ background: m.color }}>{i + 1}</span>
                <span className="tl-ms-stem" style={{ height: m.far ? 92 : 34, background: m.color }} />
                <div className="tl-ms-label" dir="rtl" style={{ [m.up ? 'bottom' : 'top']: (m.far ? 92 : 34) + 24 }}>
                  <span className="tl-ms-date" style={{ background: m.color }}>{fmt(m.date)}</span>
                  <span className="tl-ms-text">{m.text || 'ללא שם'}</span>
                </div>
              </div>
            ))}
            {!sorted.length && <div className="tl-empty" dir="rtl">מוסיפים אבני דרך ברשימה — והציר נבנה כאן מעצמו ✨</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
