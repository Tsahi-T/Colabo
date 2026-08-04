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

// Three varied starter gauges — different scales/units on purpose, so a brand-new dashboard
// doesn't look like it only works for 0-100% metrics.
const STARTER_GAUGES = [
  { title: 'לו"ז', min: 0, max: 90, value: 52, th1: 30, th2: 60, c0: '#ef4444', c1: '#f59e0b', c2: '#22c55e', unit: 'ימים', style: 'classic' },
  { title: 'תקציב', min: 0, max: 500000, value: 310000, th1: 200000, th2: 400000, c0: '#22c55e', c1: '#f59e0b', c2: '#ef4444', unit: '₪', style: 'full' },
  { title: 'חוסן', min: 0, max: 100, value: 68, th1: 40, th2: 70, c0: '#ef4444', c1: '#f59e0b', c2: '#22c55e', unit: '%', style: 'bar' },
];
const defaultGauge = (n) => ({
  title: `מדד לדוגמה ${n}`, min: 0, max: 100, value: 50, th1: 33, th2: 66,
  c0: '#ef4444', c1: '#f59e0b', c2: '#22c55e', unit: '%', style: 'classic',
});

const download = (text, name) => {
  bumpDownload();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

function autoGrow(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}
// Title grows downward (capped at ~3 lines via CSS max-height) instead of hiding overflow text.
function GrowingTitle({ value, onChange, placeholder }) {
  const ref = useRef();
  useEffect(() => { autoGrow(ref.current); }, [value]);
  return <textarea ref={ref} className="gz-title-in" rows={1} placeholder={placeholder} value={value} onChange={onChange} />;
}

// ---- gauge geometry ----------------------------------------------------------------
// Each style is a semicircle/arc defined by a start->end sweep (degrees, standard math
// convention: 0°=right, 90°=up, 180°=left) around (cx,cy). t is always a 0..1 fraction of
// the gauge's min..max range, never a raw value, so every helper below is style-agnostic.
// Every style renders a smooth gradient band with tick marks — the only real differences
// between them are the sweep shape (semicircle / 270° dial / full 360° donut) and, for the
// donut, a much thicker band so it reads as solid/full rather than a thin arc.
const STYLES = {
  classic: { shape: 'radial', label: 'קלאסי', start: 180, end: 0, viewBox: '0 0 200 118', cx: 100, cy: 104, r: 82, bandW: 16, labels: true },
  full: { shape: 'radial', label: 'מד מלא', start: 225, end: -45, viewBox: '0 0 200 200', cx: 100, cy: 100, r: 76, bandW: 14, labels: true },
  bar: { shape: 'bar', label: 'סטטוס בר', viewBox: '0 0 200 92', barX: 12, barY: 26, barW: 176, barH: 34, labels: true },
};
const STYLE_KEYS = Object.keys(STYLES);

function polarFor(cfg, angleDeg, radius) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cfg.cx + radius * Math.cos(rad), y: cfg.cy - radius * Math.sin(rad) };
}
function angleFor(cfg, t) { return cfg.start - t * (cfg.start - cfg.end); }
function arcPathFor(cfg, t0, t1, radius) {
  const a0 = angleFor(cfg, t0), a1 = angleFor(cfg, t1);
  const p0 = polarFor(cfg, a0, radius), p1 = polarFor(cfg, a1, radius);
  const largeArc = Math.abs(a0 - a1) > 180 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${radius} ${radius} 0 ${largeArc} 1 ${p1.x} ${p1.y}`;
}

// ---- smooth color blending for the gauge band — pure c0 at t=0, pure c1 at t=t1, pure c2
// at t=t2 (and beyond), blending linearly in between. Rendered as many thin arc segments
// (a real SVG gradient runs in a straight line, which visibly mismatches a curved arc's
// true midpoint) rather than a <linearGradient>.
const hexToRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgbToHex = (rgb) => '#' + rgb.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
function lerpColor(c0, c1, f) {
  const a = hexToRgb(c0), b = hexToRgb(c1);
  return rgbToHex(a.map((v, i) => v + (b[i] - v) * f));
}
function colorAt(g, t, t1, t2) {
  const c0 = g.c0 || '#ef4444', c1 = g.c1 || '#f59e0b', c2 = g.c2 || '#22c55e';
  if (t1 <= 0 && t2 <= 0) return c2; // both thresholds at/below min: the whole range reads as "high"
  if (t1 <= 0) return t2 > 0 && t <= t2 ? lerpColor(c1, c2, t / t2) : c2; // no red zone: blend c1->c2 only
  if (t <= t1) return lerpColor(c0, c1, t / t1);
  if (t2 > t1 && t <= t2) return lerpColor(c1, c2, (t - t1) / (t2 - t1));
  return c2;
}

// Shared by both shapes: clamp/derive min/max/value/t and the two threshold fractions.
function gaugeValues(g) {
  const min = num(g.min, 0);
  const max = num(g.max, 100) > min ? num(g.max, 100) : min + 1;
  const value = clamp(num(g.value, min), min, max);
  const t = (value - min) / (max - min);
  let th1 = clamp(num(g.th1, min), min, max);
  let th2 = clamp(num(g.th2, max), min, max);
  if (th1 > th2) [th1, th2] = [th2, th1];
  const t1 = (th1 - min) / (max - min), t2 = (th2 - min) / (max - min);
  return { min, max, value, t, t1, t2 };
}

function RadialGaugeSvg({ g, cfg }) {
  const { min, max, t, t1, t2 } = gaugeValues(g);
  const angle = angleFor(cfg, t);

  const GRADIENT_SEGMENTS = 48;
  const gradientSegs = [];
  for (let i = 0; i < GRADIENT_SEGMENTS; i++) {
    const from = i / GRADIENT_SEGMENTS, to = (i + 1) / GRADIENT_SEGMENTS;
    gradientSegs.push(
      <path key={i} d={arcPathFor(cfg, from, to, cfg.r)} stroke={colorAt(g, (from + to) / 2, t1, t2)}
        strokeWidth={cfg.bandW} fill="none" strokeLinecap="butt" />
    );
  }

  const needleLen = cfg.r - cfg.bandW - 8;
  const minLabel = polarFor(cfg, cfg.start, cfg.r + 15);
  const maxLabel = polarFor(cfg, cfg.end, cfg.r + 15);

  const ticks = [];
  for (let i = 0; i <= 10; i++) {
    const tt = i / 10;
    const a = angleFor(cfg, tt);
    const p0 = polarFor(cfg, a, cfg.r - cfg.bandW - 2);
    const p1 = polarFor(cfg, a, cfg.r - cfg.bandW - (i % 5 === 0 ? 11 : 7));
    ticks.push(<line key={i} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} className="gz-tick" />);
  }

  return (
    <svg className="gz-svg" viewBox={cfg.viewBox}>
      <g className="gz-bands">{gradientSegs}</g>
      {ticks}
      {cfg.labels && <>
        <text x={minLabel.x} y={minLabel.y + 12} className="gz-tick-label" textAnchor="middle">{fmtNum(min)}</text>
        <text x={maxLabel.x} y={maxLabel.y + 12} className="gz-tick-label" textAnchor="middle">{fmtNum(max)}</text>
      </>}
      <g className="gz-needle-g" style={{ transform: `rotate(${90 - angle}deg)`, transformOrigin: `${cfg.cx}px ${cfg.cy}px` }}>
        <line x1={cfg.cx} y1={cfg.cy} x2={cfg.cx} y2={cfg.cy - needleLen} className="gz-needle" />
        <polygon points={`${cfg.cx - 4},${cfg.cy - needleLen + 9} ${cfg.cx + 4},${cfg.cy - needleLen + 9} ${cfg.cx},${cfg.cy - needleLen}`} className="gz-needle-tip" />
      </g>
      <circle cx={cfg.cx} cy={cfg.cy} r="7" className="gz-hub" />
    </svg>
  );
}

// Horizontal status bar: a solid gradient rect (a real SVG <linearGradient> is fine here —
// unlike the radial styles' curved arc, a straight bar has no curve-vs-gradient mismatch) with
// a thick I-beam marker sliding to the current value's position.
function BarGaugeSvg({ g, cfg }) {
  const { min, max, t, t1, t2 } = gaugeValues(g);
  const gradId = 'gzgrad-' + g.id;
  const barRight = cfg.barX + cfg.barW;
  const markerX = cfg.barX + t * cfg.barW;
  const c0 = g.c0 || '#ef4444', c1 = g.c1 || '#f59e0b', c2 = g.c2 || '#22c55e';

  return (
    <svg className="gz-svg" viewBox={cfg.viewBox}>
      <defs>
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={cfg.barX} y1="0" x2={barRight} y2="0">
          <stop offset="0%" stopColor={c0} />
          <stop offset={`${t1 * 100}%`} stopColor={c1} />
          <stop offset={`${t2 * 100}%`} stopColor={c2} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
      </defs>
      <rect x={cfg.barX} y={cfg.barY} width={cfg.barW} height={cfg.barH} rx="4" fill={`url(#${gradId})`} className="gz-bar-rect" />
      <g className="gz-bar-marker-g" style={{ transform: `translateX(${markerX}px)` }}>
        <rect x="-3.5" y={cfg.barY - 7} width="7" height={cfg.barH + 14} className="gz-bar-marker" />
        <rect x="-10" y={cfg.barY - 7} width="20" height="5" className="gz-bar-marker" />
        <rect x="-10" y={cfg.barY + cfg.barH + 2} width="20" height="5" className="gz-bar-marker" />
      </g>
      {cfg.labels && <>
        <text x={cfg.barX} y={cfg.barY + cfg.barH + 20} className="gz-tick-label" textAnchor="start">{fmtNum(min)}</text>
        <text x={barRight} y={cfg.barY + cfg.barH + 20} className="gz-tick-label" textAnchor="end">{fmtNum(max)}</text>
      </>}
    </svg>
  );
}

function GaugeSvg({ g }) {
  const cfg = STYLES[g.style] || STYLES.classic;
  return cfg.shape === 'bar' ? <BarGaugeSvg g={g} cfg={cfg} /> : <RadialGaugeSvg g={g} cfg={cfg} />;
}

function StylePicker({ value, onChange }) {
  return (
    <div className="gz-style-picker">
      {STYLE_KEYS.map((k) => (
        <button key={k} type="button" className={'gz-style-btn' + (value === k || (!value && k === 'classic') ? ' sel' : '')}
          onClick={() => onChange(k)}>{STYLES[k].label}</button>
      ))}
    </div>
  );
}

function GaugeCard({ g, editable, open, onToggleOpen, onChange, onDelete }) {
  const set = (patch) => onChange(g.id, patch);
  const min = num(g.min, 0);
  const max = num(g.max, 100) > min ? num(g.max, 100) : min + 1;
  const value = fmtNum(clamp(num(g.value, min), min, max));

  return (
    <div className="gz-card">
      <div className="gz-head">
        {editable
          ? <GrowingTitle value={g.title} placeholder="נושא" onChange={(e) => set({ title: e.target.value })} />
          : <h3>{g.title || 'ללא שם'}</h3>}
        {editable && <button className="gz-x" title="מחיקת השעון" onClick={() => onDelete(g)}>✕</button>}
      </div>

      <GaugeSvg g={g} />
      <div className="gz-value">{value}{g.unit ? <span className="gz-unit"> {g.unit}</span> : null}</div>

      {editable && (
        <div className="gz-acc">
          <button type="button" className="gz-acc-head" onClick={onToggleOpen}>
            <span>פרטי עריכה</span>
            <span className="gz-acc-chevron">{open ? '⌃' : '⌄'}</span>
          </button>
          {open && (
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
              <label className="gz-field">
                <span>עיצוב השעון</span>
                <StylePicker value={g.style} onChange={(style) => set({ style })} />
              </label>
            </div>
          )}
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
  const [closedIds, setClosedIds] = useState(() => new Set());
  const fileRef = useRef();

  const ydoc = useMemo(() => new Y.Doc(), []);
  const gauges = ydoc.getMap('gauges');
  const meta = ydoc.getMap('meta');
  const provider = useMemo(() => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return new HocuspocusProvider({
      url: `${proto}://${location.host}/collab`, name: info.docId, token, document: ydoc,
      onStatus: ({ status }) => setStatus(status),
      // Seed 3 varied starter gauges the first time this doc is opened (post-sync, so we know
      // it's genuinely empty and not just pre-sync local state). Guarded by a meta flag so it
      // only ever runs once per doc, not once per viewer.
      onSynced: ({ state }) => {
        if (!state || !editable) return;
        if (gauges.size === 0 && !meta.get('seeded')) {
          ydoc.transact(() => {
            meta.set('seeded', true);
            STARTER_GAUGES.forEach((sg, i) => {
              const id = uid(), m = new Y.Map();
              Object.entries(sg).forEach(([k, v]) => m.set(k, v));
              m.set('ord', i + 1);
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
  function toggleOpen(id) {
    setClosedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  const anyOpen = list.some((g) => !closedIds.has(g.id));
  function toggleAllOpen() {
    setClosedIds(anyOpen ? new Set(list.map((g) => g.id)) : new Set());
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
            {list.length > 0 && (
              <button className="btn" onClick={toggleAllOpen}>{anyOpen ? 'הסתרת פרטי עריכה בכולם' : 'הצגת פרטי עריכה בכולם'}</button>
            )}
            <span className="hint">כל שעון: נושא, טווח, ערך נוכחי, ספי צבע, צבעים ועיצוב - הכל ניתן לעריכה</span>
          </div>
        )}
        <div className="gz-grid">
          {list.map((g) => (
            <GaugeCard key={g.id} g={g} editable={editable} open={!closedIds.has(g.id)}
              onToggleOpen={() => toggleOpen(g.id)} onChange={setGauge} onDelete={delGauge} />
          ))}
        </div>
        {!list.length && <div className="tlr-empty">אין עדיין שעונים - מוסיפים בכפתור למעלה</div>}
      </div>
    </div>
  );
}
