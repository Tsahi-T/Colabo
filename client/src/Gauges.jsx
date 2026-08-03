import { useEffect, useMemo, useState, useReducer, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { ShareMenu, Menu } from './ShareExport.jsx';
import { ThemeToggle } from './theme.jsx';
import { Logo } from './icons.jsx';
import { touchRecent, bumpDownload, bumpReimport } from './identity.js';
import { printElementImage } from './imageExport.js';
import { gaugesToCsv, csvToGauges } from './gauge-io.js';

const uid = () => crypto.randomUUID().slice(0, 8);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };
const fmtNum = (n) => (Number.isInteger(n) ? n : Math.round(n * 100) / 100).toLocaleString('he-IL');

const defaultGauge = (n) => ({
  title: `מדד ${n}`, min: 0, max: 100, value: 50, th1: 33, th2: 66,
  c0: '#ef4444', c1: '#f59e0b', c2: '#22c55e', unit: '%',
});

const download = (text, name) => {
  bumpDownload();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

// ---- gauge geometry: a semicircle, angle 180° (left/min) sweeping over the top to 0° (right/max) ----
const CX = 100, CY = 104, R = 82, BAND_W = 16;
function polar(angleDeg, radius) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY - radius * Math.sin(rad) };
}
function bandPath(fromV, toV, min, max) {
  const a0 = 180 - ((fromV - min) / (max - min)) * 180;
  const a1 = 180 - ((toV - min) / (max - min)) * 180;
  const p0 = polar(a0, R), p1 = polar(a1, R);
  const largeArc = Math.abs(a0 - a1) > 180 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${R} ${R} 0 ${largeArc} 1 ${p1.x} ${p1.y}`;
}

function GaugeSvg({ g }) {
  const min = num(g.min, 0);
  const max = num(g.max, 100) > min ? num(g.max, 100) : min + 1;
  const value = clamp(num(g.value, min), min, max);
  const t = (value - min) / (max - min);
  const angle = 180 - t * 180;

  let th1 = clamp(num(g.th1, min), min, max);
  let th2 = clamp(num(g.th2, max), min, max);
  if (th1 > th2) [th1, th2] = [th2, th1];

  const bands = [
    { from: min, to: th1, color: g.c0 || '#ef4444' },
    { from: th1, to: th2, color: g.c1 || '#f59e0b' },
    { from: th2, to: max, color: g.c2 || '#22c55e' },
  ].filter((b) => b.to > b.from);

  const minLabel = polar(180, R + 15);
  const maxLabel = polar(0, R + 15);

  return (
    <svg className="gz-svg" viewBox="0 0 200 118">
      <g className="gz-bands">
        {bands.map((b, i) => (
          <path key={i} d={bandPath(b.from, b.to, min, max)} stroke={b.color} strokeWidth={BAND_W} fill="none" strokeLinecap="round" />
        ))}
      </g>
      <text x={minLabel.x} y={minLabel.y + 12} className="gz-tick-label" textAnchor="middle">{fmtNum(min)}</text>
      <text x={maxLabel.x} y={maxLabel.y + 12} className="gz-tick-label" textAnchor="middle">{fmtNum(max)}</text>
      <g className="gz-needle-g" style={{ transform: `rotate(${90 - angle}deg)`, transformOrigin: `${CX}px ${CY}px` }}>
        <line x1={CX} y1={CY} x2={CX} y2={CY - (R - BAND_W - 8)} className="gz-needle" />
      </g>
      <circle cx={CX} cy={CY} r="7" className="gz-hub" />
    </svg>
  );
}

function GaugeCard({ g, editable, onChange, onDelete }) {
  const set = (patch) => onChange(g.id, patch);
  const min = num(g.min, 0);
  const max = num(g.max, 100) > min ? num(g.max, 100) : min + 1;
  const value = fmtNum(clamp(num(g.value, min), min, max));

  return (
    <div className="gz-card">
      <div className="gz-head">
        {editable
          ? <input className="gz-title-in" value={g.title} placeholder="נושא" onChange={(e) => set({ title: e.target.value })} />
          : <h3>{g.title || 'ללא שם'}</h3>}
        {editable && <button className="gz-x" title="מחיקת השעון" onClick={() => onDelete(g)}>✕</button>}
      </div>

      <GaugeSvg g={g} />
      <div className="gz-value">{value}{g.unit ? <span className="gz-unit"> {g.unit}</span> : null}</div>

      {editable && (
        <div className="gz-edit">
          <label className="gz-field gz-field-wide">
            <span>ערך נוכחי</span>
            <input type="number" value={g.value} onChange={(e) => set({ value: e.target.value })} />
          </label>
          <div className="gz-edit-row">
            <label className="gz-field"><span>מינימום</span><input type="number" value={g.min} onChange={(e) => set({ min: e.target.value })} /></label>
            <label className="gz-field"><span>מקסימום</span><input type="number" value={g.max} onChange={(e) => set({ max: e.target.value })} /></label>
          </div>
          <div className="gz-edit-row">
            <label className="gz-field"><span>סף אדום ← צהוב</span><input type="number" value={g.th1} onChange={(e) => set({ th1: e.target.value })} /></label>
            <label className="gz-field"><span>סף צהוב ← ירוק</span><input type="number" value={g.th2} onChange={(e) => set({ th2: e.target.value })} /></label>
          </div>
          <label className="gz-field">
            <span>יחידה</span>
            <input value={g.unit || ''} placeholder="%, ₪, יח'…" onChange={(e) => set({ unit: e.target.value })} />
          </label>
          <div className="gz-colors">
            <label className="gz-color"><input type="color" value={g.c0} onChange={(e) => set({ c0: e.target.value })} /><span>נמוך</span></label>
            <label className="gz-color"><input type="color" value={g.c1} onChange={(e) => set({ c1: e.target.value })} /><span>בינוני</span></label>
            <label className="gz-color"><input type="color" value={g.c2} onChange={(e) => set({ c2: e.target.value })} /><span>גבוה</span></label>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Gauges({ info, user, token }) {
  const editable = info.mode === 'edit';
  const [, force] = useReducer((c) => c + 1, 0);
  const [status, setStatus] = useState('connecting');
  const [title, setTitle] = useState('');
  const [peers, setPeers] = useState([]);
  const fileRef = useRef();

  const ydoc = useMemo(() => new Y.Doc(), []);
  const gauges = ydoc.getMap('gauges');
  const meta = ydoc.getMap('meta');
  const provider = useMemo(() => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return new HocuspocusProvider({
      url: `${proto}://${location.host}/collab`, name: info.docId, token, document: ydoc,
      onStatus: ({ status }) => setStatus(status),
      // Seed 3 starter gauges the first time this doc is opened (post-sync, so we know it's
      // genuinely empty and not just pre-sync local state). Guarded by a meta flag so it only
      // ever runs once per doc, not once per viewer.
      onSynced: ({ state }) => {
        if (!state || !editable) return;
        if (gauges.size === 0 && !meta.get('seeded')) {
          ydoc.transact(() => {
            meta.set('seeded', true);
            [1, 2, 3].forEach((n) => {
              const id = uid(), m = new Y.Map();
              Object.entries(defaultGauge(n)).forEach(([k, v]) => m.set(k, v));
              m.set('ord', n);
              gauges.set(id, m);
            });
          });
        }
      },
    });
  }, []);

  useEffect(() => {
    ydoc.on('update', force);
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

  useEffect(() => { touchRecent(token, title, info.mode, 'gauges'); }, [title]);

  const list = [...gauges.entries()]
    .map(([id, m]) => ({ id, ...m.toJSON() }))
    .sort((a, b) => (a.ord || 0) - (b.ord || 0) || a.id.localeCompare(b.id));

  function addGauge() {
    const id = uid(), m = new Y.Map();
    const ord = Math.max(0, ...list.map((x) => x.ord || 0)) + 1;
    Object.entries(defaultGauge(ord)).forEach(([k, v]) => m.set(k, v));
    m.set('ord', ord);
    gauges.set(id, m);
  }
  function setGauge(id, patch) {
    const m = gauges.get(id);
    if (!m) return;
    ydoc.transact(() => Object.entries(patch).forEach(([k, v]) => m.set(k, v)));
  }
  function delGauge(g) {
    if (!confirm(`למחוק את השעון "${g.title || 'ללא שם'}"?`)) return;
    gauges.delete(g.id);
  }

  const exportCsv = () => download(gaugesToCsv(list), `${title || 'דשבורד הערכת מצב'}.csv`);
  async function importCsv(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    bumpReimport();
    const parsed = csvToGauges(await f.text());
    if (!parsed.length) return alert('לא נמצאו שעונים בקובץ');
    if (gauges.size && !confirm('הטעינה תחליף את כל השעונים הקיימים. להמשיך?')) return;
    ydoc.transact(() => {
      [...gauges.keys()].forEach((k) => gauges.delete(k));
      meta.set('seeded', true);
      parsed.forEach((g, i) => {
        const id = uid(), m = new Y.Map();
        Object.entries({ ...g, ord: i + 1 }).forEach(([k, v]) => m.set(k, v));
        gauges.set(id, m);
      });
    });
  }

  return (
    <div className="doc-page">
      <header className="topbar">
        <Link to="/" className="logo-sm" title="חזרה לדף הבית"><Logo size={22} /><span className="logo-word">טורבו</span></Link>
        <input className="title-input" title={title || undefined} placeholder="דשבורד הערכת מצב ללא שם" value={title} readOnly={!editable}
          onChange={(e) => meta.set('title', e.target.value)} />
        {!editable && <span className="badge">צפייה בלבד</span>}
        <span className={'conn ' + status} />
        <div className="peers">
          {peers.slice(0, 8).map((p, i) => (
            <span key={i} className="peer" style={{ background: p.color }} title={p.name}>{p.name[0]}</span>
          ))}
        </div>
        <div className="actions">
          {editable && <>
            <button className="btn" title="ניתן לטעון קובץ CSV בפורמט שיוצא מהמערכת בלבד" onClick={() => fileRef.current.click()}>טעינה</button>
            <input ref={fileRef} type="file" accept=".csv" hidden onChange={importCsv} />
          </>}
          <Menu label="הורדה">
            <button onClick={exportCsv}>Excel ‏(CSV) - לטעינה חוזרת</button>
            <button onClick={() => printElementImage('.gz-grid', { title: title || 'דשבורד הערכת מצב', landscape: true })}>PDF (הדפסה)</button>
          </Menu>
          <ShareMenu info={info} />
          <ThemeToggle />
        </div>
      </header>

      <div className="gz-page">
        {editable && (
          <div className="gz-bar">
            <button className="btn-primary" onClick={addGauge}>+ שעון חדש</button>
            <span className="hint">כל שעון: נושא, טווח, ערך נוכחי, ספי צבע וצבעים - הכל ניתן לעריכה</span>
          </div>
        )}
        <div className="gz-grid">
          {list.map((g) => (
            <GaugeCard key={g.id} g={g} editable={editable} onChange={setGauge} onDelete={delGauge} />
          ))}
        </div>
        {!list.length && <div className="tlr-empty">אין עדיין שעונים - מוסיפים בכפתור למעלה</div>}
      </div>
    </div>
  );
}
