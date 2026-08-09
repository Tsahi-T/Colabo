import { useEffect, useMemo, useState, useReducer, useRef, useCallback, Fragment } from 'react';
import { Link } from 'react-router-dom';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { ShareMenu, Menu } from './ShareExport.jsx';
import { ThemeToggle } from './theme.jsx';
import { Logo } from './icons.jsx';
import { PASTELS } from './board-io.js';
import { touchRecent, bumpDownload, bumpReimport } from './identity.js';
import { printElementImage } from './imageExport.js';
import { GANTT_EXAMPLE_TXT } from './examples.js';

const DAY = 864e5;
const uid = () => crypto.randomUUID().slice(0, 8);
// Local calendar date, not toISOString()'s UTC one — parseISO below reads dates as local
// midnight, so a UTC-based formatter would drift by a day in any positive-UTC-offset
// timezone (e.g. new Date(localMidnightDec24) is still Dec23 in UTC at UTC+2).
const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseISO = (s) => new Date((s || toISO(new Date())) + 'T00:00:00');
const today = () => toISO(new Date());
const addMonths = (iso, n) => { const d = parseISO(iso); d.setMonth(d.getMonth() + n); return toISO(d); };
const startOfMonth = (iso) => { const d = parseISO(iso); d.setDate(1); return toISO(d); };
const defaultStart = () => startOfMonth(today());
const defaultEnd = () => addMonths(defaultStart(), 18);
const num = (v, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };
const fmt = (iso) => (iso ? parseISO(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const fmtShort = (iso) => (iso ? iso.split('-').reverse().join('.') : ''); // DD.MM.YYYY — compact, for accordion summaries

// ---- layout geometry ----------------------------------------------------------------
const ROW_H = 34, BAR_H = 24, GROUP_GAP = 3, LEFT_W = 148, MS_EXTRA = 22;

// Greedy interval packing: each task gets the first sub-row ("lane") within its module
// whose last-placed task doesn't overlap it, so overlapping tasks stack instead of
// colliding — same idea as the "swimlane" look in the reference screenshots.
function packLanes(tasksSortedByStart) {
  const laneEnds = [];
  const lane = {};
  tasksSortedByStart.forEach((t) => {
    let i = laneEnds.findIndex((endT) => endT <= t.startT);
    if (i === -1) { i = laneEnds.length; laneEnds.push(0); }
    laneEnds[i] = t.endT;
    lane[t.id] = i;
  });
  return { lane, count: Math.max(1, laneEnds.length) };
}

function yearSegments(startISO, endISO, xOf) {
  const segs = [];
  const startY = parseISO(startISO).getFullYear(), endY = parseISO(endISO).getFullYear();
  for (let y = startY; y <= endY; y++) {
    const segStart = Math.max(+parseISO(startISO), +new Date(y, 0, 1));
    const segEnd = Math.min(+parseISO(endISO), +new Date(y + 1, 0, 1));
    if (segEnd <= segStart) continue;
    segs.push({ key: y, label: String(y), x: xOf(segStart), w: xOf(segEnd) - xOf(segStart) });
  }
  return segs;
}
function monthSegments(startISO, endISO, xOf) {
  const segs = [];
  const s = parseISO(startISO), e = parseISO(endISO);
  for (let d = new Date(s.getFullYear(), s.getMonth(), 1); d < e; d.setMonth(d.getMonth() + 1)) {
    const segStart = Math.max(+s, +d);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const segEnd = Math.min(+e, +next);
    if (segEnd <= segStart) continue;
    segs.push({ key: +d, label: d.toLocaleDateString('he-IL', { month: 'short' }), x: xOf(segStart), w: xOf(segEnd) - xOf(segStart) });
  }
  return segs;
}
function weekSegments(startISO, endISO, xOf) {
  const segs = [];
  const s = parseISO(startISO), e = parseISO(endISO);
  const first = new Date(s); first.setDate(first.getDate() - first.getDay());
  for (let d = first; d < e; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)) {
    const segStart = Math.max(+s, +d);
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
    const segEnd = Math.min(+e, +next);
    if (segEnd <= segStart) continue;
    segs.push({ key: +d, label: d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }), x: xOf(segStart), w: xOf(segEnd) - xOf(segStart) });
  }
  return segs;
}
// Whole calendar months in range, for the Excel export's column grid.
function monthList(startISO, endISO) {
  const list = [];
  const s = parseISO(startISO), e = parseISO(endISO);
  for (let d = new Date(s.getFullYear(), s.getMonth(), 1); d < e; d.setMonth(d.getMonth() + 1)) {
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    list.push({ label: d.toLocaleDateString('he-IL', { month: 'short', year: 'numeric' }), start: +d, end: +next });
  }
  return list;
}

// Right-angle "finish-to-start" connector, source-right to target-left. Always makes its
// FINAL approach into the target moving rightward (entering the target's left edge), even
// for a backward/overlapping dependency (target starts before source ends) — a naive router
// that just draws straight to the target's x can end up approaching from the target's right
// side instead, which points the arrowhead the "wrong" way and reads as backwards.
function elbowPath(x1, y1, x2, y2) {
  const GAP = 14;
  if (y1 === y2 && x2 >= x1) return `M ${x1} ${y1} H ${x2}`; // simple same-lane forward case
  const exitX = x1 + GAP; // always leave the source moving right
  const approachX = x2 - GAP; // always arrive at the target moving right, from just left of it
  return `M ${x1} ${y1} H ${exitX} V ${y2} H ${approachX} H ${x2}`;
}
// Rough per-character width estimate (Hebrew UI font, .72rem bold) — used only to decide
// whether a bar is wide enough to hold its own label before rendering it outside instead.
const estLabelW = (name, pct) => name.length * 6.4 + (pct ? 26 : 8) + 14;
// White text reads on a dark module color, dark text on a light one — the old fixed dark
// text was unreadable once dark blues (not just light pastels) became a normal color choice.
function textColorFor(hex) {
  if (!hex || hex[0] !== '#' || hex.length < 7) return '#1f2937';
  const n = parseInt(hex.slice(1, 7), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1f2937' : '#ffffff';
}

function autoGrow(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}
function GrowingField({ className, value, onChange, placeholder, rows }) {
  const ref = useRef();
  useEffect(() => { autoGrow(ref.current); }, [value]);
  return <textarea ref={ref} className={className} rows={rows || 1} placeholder={placeholder} value={value} onChange={onChange} />;
}

const download = (text, name, mime = 'text/plain;charset=utf-8') => {
  bumpDownload();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: mime }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};
const esc = (s) => { s = String(s ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const row = (arr) => arr.map(esc).join(',');
const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function parseCsvLine(line) {
  // single-line CSV field splitter (good enough here — no field in this format needs \n)
  const out = []; let f = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { out.push(f); f = ''; }
    else f += c;
  }
  out.push(f);
  return out;
}

// Small popover of color swatches, opened by clicking a color chip. Closes itself on any
// outside click (same convention as SWOT/Discussion's "הצעות ✦" preset menus).
function ColorPop({ value, onPick, onReset }) {
  const ref = useRef();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div className="gt-color-wrap" ref={ref}>
      <button type="button" className="gt-color-chip" style={{ background: value }}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} />
      {open && (
        <div className="gt-color-pop" onClick={(e) => e.stopPropagation()}>
          {onReset && <button type="button" className="swatch-sm gt-swatch-reset" title="ברירת מחדל" onClick={() => { onReset(); setOpen(false); }}>↺</button>}
          {Object.entries(PASTELS).map(([name, hex]) => (
            <button key={hex} type="button" title={name} className={'swatch-sm' + (value === hex ? ' sel' : '')}
              style={{ background: hex }} onClick={() => { onPick(hex); setOpen(false); }} />
          ))}
          <input type="color" value={value || '#3b82f6'} onChange={(e) => onPick(e.target.value)} />
        </div>
      )}
    </div>
  );
}

// Collapsed by default — a compact one-line summary (name + dates) — and expands to the
// full field set (dates/%/milestone + predecessor/successor lists) on demand, so a long
// task list stays scannable instead of showing every field for every row at once.
function TaskCard({ t, num, groupColor, editable, sel, open, onToggleOpen, onSelect, onChange, onDelete, showPct, predecessors, successors, taskOptions, onAddLink, onDelLink }) {
  return (
    <div className={'gt-tcard' + (sel ? ' sel' : '')} data-taskcard={t.id}>
      <div className="gt-tcard-row1" onClick={() => onSelect(t.id)}>
        {editable
          ? <ColorPop value={t.color || groupColor} onPick={(hex) => onChange({ color: hex })} onReset={() => onChange({ color: '' })} />
          : <span className="gt-color-chip" style={{ background: t.color || groupColor }} />}
        <span className="gt-num">{num}</span>
        {editable
          ? <GrowingField className="gt-tcard-name-in" value={t.name} placeholder="שם המשימה" onChange={(e) => onChange({ name: e.target.value })} />
          : <b className="gt-tcard-name-ro">{t.name || '-'}</b>}
        <button type="button" className="gt-tcard-expand" title={open ? 'כיווץ' : 'הרחבה'} onClick={(e) => { e.stopPropagation(); onToggleOpen(); }}>
          {open ? '︿' : '﹀'}
        </button>
        {editable && <button className="pj-x" onClick={(e) => { e.stopPropagation(); onDelete(); }}>✕</button>}
      </div>
      {!open && (
        <div className="gt-tcard-summary" onClick={() => onSelect(t.id)}>
          {t.milestone ? `◆ ${fmtShort(t.start)}` : `${fmtShort(t.start)} - ${fmtShort(t.end)}`}
          {!t.milestone && showPct ? ` · ${t.progress}%` : ''}
        </div>
      )}
      {open && (
        <>
          <div className="gt-tcard-row2">
            <label>התחלה
              {editable
                ? <input type="date" value={t.start} onClick={(e) => e.stopPropagation()} onChange={(e) => e.target.value && onChange({
                    start: e.target.value,
                    end: t.milestone ? e.target.value : (e.target.value >= t.end ? toISO(new Date(+parseISO(e.target.value) + DAY)) : t.end),
                  })} />
                : <span>{fmt(t.start)}</span>}
            </label>
            {!t.milestone && (
              <label>סיום
                {editable
                  ? <input type="date" value={t.end} onClick={(e) => e.stopPropagation()} onChange={(e) => e.target.value && e.target.value > t.start && onChange({ end: e.target.value })} />
                  : <span>{fmt(t.end)}</span>}
              </label>
            )}
            {!t.milestone && showPct && (
              <label>%
                {editable
                  ? <input type="number" min={0} max={100} className="gt-pct-in" value={t.progress} onClick={(e) => e.stopPropagation()}
                      onChange={(e) => onChange({ progress: e.target.value })}
                      onBlur={(e) => onChange({ progress: Math.min(100, Math.max(0, num(e.target.value, 0))) })} />
                  : <span>{t.progress}%</span>}
              </label>
            )}
            {editable && (
              <label className="gt-tcard-cb" title="אבן דרך מעוינת" onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={t.milestone} onChange={(e) => onChange({
                  milestone: e.target.checked,
                  end: e.target.checked ? t.start : (t.end > t.start ? t.end : toISO(new Date(+parseISO(t.start) + 7 * DAY))),
                })} />◆
              </label>
            )}
          </div>
          <div className="gt-deps" onClick={(e) => e.stopPropagation()}>
            <div className="gt-deps-col">
              <span className="gt-deps-l">תלות מקדימה</span>
              {predecessors.map((p) => (
                <div key={p.linkId} className="gt-dep-row">
                  <span>{p.name || 'ללא שם'}</span>
                  {editable && <button className="pj-x" onClick={() => onDelLink(p.linkId)}>✕</button>}
                </div>
              ))}
              {editable && taskOptions.length > 0 && (
                <select className="gt-dep-add" value="" onChange={(e) => { if (e.target.value) onAddLink(e.target.value, t.id); }}>
                  <option value="">+ הוספת תלות מקדימה</option>
                  {taskOptions.map((o) => <option key={o.id} value={o.id}>{o.name || 'ללא שם'}</option>)}
                </select>
              )}
              {!predecessors.length && !editable && <span className="gt-deps-empty">אין</span>}
            </div>
            <div className="gt-deps-col">
              <span className="gt-deps-l">תלות מאוחרת</span>
              {successors.map((s) => (
                <div key={s.linkId} className="gt-dep-row">
                  <span>{s.name || 'ללא שם'}</span>
                  {editable && <button className="pj-x" onClick={() => onDelLink(s.linkId)}>✕</button>}
                </div>
              ))}
              {editable && taskOptions.length > 0 && (
                <select className="gt-dep-add" value="" onChange={(e) => { if (e.target.value) onAddLink(t.id, e.target.value); }}>
                  <option value="">+ הוספת תלות מאוחרת</option>
                  {taskOptions.map((o) => <option key={o.id} value={o.id}>{o.name || 'ללא שם'}</option>)}
                </select>
              )}
              {!successors.length && !editable && <span className="gt-deps-empty">אין</span>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function GroupCard({ g, num, editable, sel, open, onToggleOpen, taskCount, onSelect, onChange, onDelete, onAddTask, children }) {
  return (
    <div className={'gt-gcard' + (sel ? ' sel' : '')} data-groupcard={g.id}>
      <div className="gt-gcard-head" style={{ borderInlineStartColor: g.color }} onClick={() => onSelect(g.id)}>
        {editable
          ? <ColorPop value={g.color} onPick={(hex) => onChange({ color: hex })} />
          : <span className="gt-color-chip" style={{ background: g.color }} />}
        <span className="gt-num">{num}</span>
        {editable
          ? <GrowingField className="gt-gcard-name-in" value={g.name} placeholder="שם המודול" onChange={(e) => onChange({ name: e.target.value })} />
          : <b>{g.name}</b>}
        <button type="button" className="gt-tcard-expand" title={open ? 'כיווץ המודול' : 'הרחבת המודול'} onClick={(e) => { e.stopPropagation(); onToggleOpen(); }}>
          {open ? '︿' : `﹀ ${taskCount}`}
        </button>
        {editable && <button className="pj-x" onClick={(e) => { e.stopPropagation(); onDelete(); }}>✕</button>}
      </div>
      {open && (
        <div className="gt-gcard-tasks">
          {children}
          {editable && <button type="button" className="btn gt-add-task-btn" onClick={onAddTask}>+ משימה</button>}
        </div>
      )}
    </div>
  );
}

export default function Gantt({ info, user, token }) {
  const editable = info.mode === 'edit';
  const [, force] = useReducer((c) => c + 1, 0);
  const [status, setStatus] = useState('connecting');
  const [title, setTitle] = useState('');
  const [peers, setPeers] = useState([]);
  const [sel, setSel] = useState(null); // {kind:'task'|'group', id}
  const [tableOpen, setTableOpen] = useState(true);
  const [closedGroupIds, setClosedGroupIds] = useState(() => new Set()); // collapsed modules, per-viewer — open by default
  const [openTaskIds, setOpenTaskIds] = useState(() => new Set()); // accordion state, per-viewer
  const [zoom, setZoom] = useState(1);
  const [connect, setConnect] = useState(null); // {from, x, y} — live link-drag preview, grid-local coords
  const canvasRef = useRef();
  const gridRef = useRef();
  const fileRef = useRef();
  const drag = useRef(null);
  const [cw, setCw] = useState(900);
  const tPts = useRef(new Map());
  const tPinch = useRef(null);

  const ydoc = useMemo(() => new Y.Doc(), []);
  const meta = ydoc.getMap('meta');
  const groups = ydoc.getMap('groups');
  const tasks = ydoc.getMap('tasks');
  const links = ydoc.getMap('links');
  const provider = useMemo(() => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return new HocuspocusProvider({
      url: `${proto}://${location.host}/collab`, name: info.docId, token, document: ydoc,
      onStatus: ({ status }) => setStatus(status),
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
    const measure = () => setCw(canvasRef.current?.clientWidth || 900);
    measure();
    window.addEventListener('resize', measure);
    return () => {
      ydoc.off('update', force); meta.unobserve(syncTitle); aw.off('change', syncPeers);
      window.removeEventListener('resize', measure); provider.destroy();
    };
  }, []);

  useEffect(() => { touchRecent(token, title, info.mode, 'gantt'); }, [title]);

  // Selecting a task or module on the canvas (click a bar/diamond/label) also brings it into
  // view in the table — expanding its module and its own accordion if they were collapsed,
  // then scrolling the card into view — so a canvas click is a real shortcut into editing,
  // not just a highlight the user then has to go hunt for in a long list.
  useEffect(() => {
    if (!sel) return;
    if (sel.kind === 'task') {
      const t = tasks.get(sel.id);
      const gid = t?.get('groupId');
      if (gid) setClosedGroupIds((prev) => (prev.has(gid) ? (() => { const n = new Set(prev); n.delete(gid); return n; })() : prev));
      setOpenTaskIds((prev) => (prev.has(sel.id) ? prev : new Set(prev).add(sel.id)));
    } else if (sel.kind === 'group') {
      setClosedGroupIds((prev) => (prev.has(sel.id) ? (() => { const n = new Set(prev); n.delete(sel.id); return n; })() : prev));
    }
    const selector = sel.kind === 'task' ? `[data-taskcard="${sel.id}"]` : `[data-groupcard="${sel.id}"]`;
    // wait a tick for the expand-state changes above to actually render before scrolling
    const id = setTimeout(() => document.querySelector(selector)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60);
    return () => clearTimeout(id);
  }, [sel]);

  // touch pinch-zoom — same pattern as Timeline.jsx
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
      setZoom(Math.min(8, Math.max(0.4, p.z * (d / p.d))));
    }
  }
  function cUp(e) {
    tPts.current.delete(e.pointerId);
    if (tPts.current.size < 2) tPinch.current = null;
  }
  function toggleTaskOpen(id) {
    setOpenTaskIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleGroupOpen(id) {
    setClosedGroupIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ---- data ----
  const rangeStart = meta.get('start') || defaultStart();
  const rangeEnd = meta.get('end') || defaultEnd();
  const gran = meta.get('gran') === 'week' ? 'week' : 'month';
  const showToday = meta.get('showToday') !== false;
  const showLinks = meta.get('showLinks') !== false;
  const showPct = meta.get('showPct') !== false;

  const groupList = [...groups.entries()]
    .map(([id, m]) => ({ id, name: m.get('name') || 'מודול', color: m.get('color') || PASTELS['אפור'], ord: m.get('ord') || 0 }))
    .sort((a, b) => a.ord - b.ord || a.id.localeCompare(b.id));

  const allTasks = [...tasks.entries()].map(([id, m]) => ({
    id, groupId: m.get('groupId'), name: m.get('name') || '',
    start: m.get('start') || today(), end: m.get('end') || m.get('start') || today(),
    progress: Math.min(100, Math.max(0, num(m.get('progress'), 0))),
    color: m.get('color') || '', milestone: !!m.get('milestone'),
    ord: m.get('ord') || 0,
  }));
  const taskNameById = new Map(allTasks.map((t) => [t.id, t.name]));

  const startT = +parseISO(rangeStart), endT = +parseISO(rangeEnd);
  const spanDays = Math.max(1, (endT - startT) / DAY);
  // basePpd (the zoom=1 default) has its own floor so a long plan starts out readable
  // instead of squeezing every label into unreadable overlaps. The zoom multiplier itself
  // is deliberately NOT floored at that same value — it used to be, which silently disabled
  // the "−" button below the default spacing; a user asking to zoom out for a small-screen
  // overview should get exactly that, even if labels get tight or hidden as a result.
  // Narrower than the very first fix (4.5) — the external-label fallback and the
  // milestone's own reserved row space now do most of the overlap-avoidance work, so the
  // raw per-day spacing needed for a readable *default* view is smaller than it used to be.
  const basePpd = Math.max(2.8, (cw - LEFT_W - 8) / spanDays);
  const ppd = Math.min(240, Math.max(0.6, basePpd * zoom));
  const stageW = spanDays * ppd;
  const xOf = (t) => ((t - startT) / DAY) * ppd;

  // Per-module lane packing — a lane that hosts a milestone gets extra height reserved
  // below it for the milestone's own label, so the label never has to spill sideways into
  // a neighboring bar or swimlane (its old failure mode).
  let cumTop = 0;
  const groupsLaid = groupList.map((g) => {
    const gTasks = allTasks
      .filter((t) => t.groupId === g.id)
      .map((t) => {
        const sT = +parseISO(t.start);
        const eT = t.milestone ? sT + DAY : Math.max(+parseISO(t.end), sT + DAY);
        return { ...t, startT: sT, endT: eT };
      })
      .sort((a, b) => a.startT - b.startT || a.ord - b.ord);
    const { lane, count } = packLanes(gTasks);
    const laneHasMs = Array.from({ length: count }, (_, i) => gTasks.some((t) => lane[t.id] === i && t.milestone));
    const laneH = laneHasMs.map((has) => (has ? ROW_H + MS_EXTRA : ROW_H));
    const laneTop = []; let acc = 0;
    for (let i = 0; i < count; i++) { laneTop.push(acc); acc += laneH[i]; }
    const laid = gTasks.map((t) => ({ ...t, lane: lane[t.id], top: cumTop + laneTop[lane[t.id]] }));
    const gLaid = { ...g, top: cumTop, height: acc };
    cumTop += acc + GROUP_GAP;
    return { group: gLaid, tasks: laid };
  });
  const totalHeight = Math.max(cumTop - GROUP_GAP, 0);
  const laidTasks = groupsLaid.flatMap((x) => x.tasks);
  const taskById = new Map(laidTasks.map((t) => [t.id, t]));
  // "1", "2.3" style reference numbers — module order, then the task's position within its
  // module (same display order already used everywhere) — so a module/task can be pointed
  // to precisely in conversation instead of only by its (often-truncated) name.
  const groupNumById = new Map(groupList.map((g, i) => [g.id, i + 1]));
  const taskNumById = new Map();
  groupsLaid.forEach(({ group: g, tasks: gTasks }) => {
    gTasks.forEach((t, i) => taskNumById.set(t.id, `${groupNumById.get(g.id)}.${i + 1}`));
  });
  // An outside label (for a bar too narrow to hold its own text) used to only cap its width
  // at a fixed 150px — fine on a spacious view, but at the new narrower default spacing that
  // fixed cap can still reach past the START of the next task sharing the same lane, painting
  // over its bar/label. Cap it dynamically at the actual pixel gap to that next task instead.
  const nextInLaneXById = new Map();
  groupsLaid.forEach(({ tasks: gTasks }) => {
    const byLane = new Map();
    gTasks.forEach((t) => { if (!byLane.has(t.lane)) byLane.set(t.lane, []); byLane.get(t.lane).push(t); });
    byLane.forEach((arr) => {
      for (let i = 0; i < arr.length - 1; i++) nextInLaneXById.set(arr[i].id, xOf(arr[i + 1].startT));
    });
  });

  const yearSegs = yearSegments(rangeStart, rangeEnd, xOf);
  const unitSegs = gran === 'week' ? weekSegments(rangeStart, rangeEnd, xOf) : monthSegments(rangeStart, rangeEnd, xOf);
  const todayT = +parseISO(today());
  const todayVisible = showToday && todayT >= startT && todayT <= endT;

  const linkList = [...links.entries()].map(([id, m]) => ({ id, from: m.get('from'), to: m.get('to') }));

  // ---- mutations ----
  function addGroup() {
    const id = uid(), m = new Y.Map();
    const ord = Math.max(0, ...groupList.map((g) => g.ord)) + 1;
    const palette = Object.values(PASTELS);
    ydoc.transact(() => {
      m.set('name', 'מודול חדש'); m.set('color', palette[groupList.length % palette.length]); m.set('ord', ord);
      groups.set(id, m);
    });
    setSel({ kind: 'group', id });
  }
  function setGroup(id, patch) {
    const m = groups.get(id);
    if (!m) return;
    ydoc.transact(() => Object.entries(patch).forEach(([k, v]) => m.set(k, v)));
  }
  function delGroup(g) {
    const count = allTasks.filter((t) => t.groupId === g.id).length;
    const msg = count ? `למחוק את המודול "${g.name}" ואת ${count} המשימות שבו?` : `למחוק את המודול "${g.name}"?`;
    if (!confirm(msg)) return;
    ydoc.transact(() => {
      allTasks.filter((t) => t.groupId === g.id).forEach((t) => tasks.delete(t.id));
      groups.delete(g.id);
      [...links.entries()].forEach(([lid, m]) => {
        const f = m.get('from'), tId = m.get('to');
        if (!tasks.has(f) || !tasks.has(tId)) links.delete(lid);
      });
    });
    if (sel?.id === g.id) setSel(null);
  }
  function addTaskToGroup(gid) {
    if (!gid) return alert('קודם מוסיפים מודול, ואז משימות בתוכו');
    const id = uid(), m = new Y.Map();
    const gTasks = allTasks.filter((t) => t.groupId === gid);
    const ord = Math.max(0, ...gTasks.map((t) => t.ord)) + 1;
    const s = gTasks.length ? gTasks[gTasks.length - 1].end : rangeStart;
    ydoc.transact(() => {
      m.set('groupId', gid); m.set('name', ''); m.set('start', s); m.set('end', toISO(new Date(+parseISO(s) + 14 * DAY)));
      m.set('progress', 0); m.set('color', ''); m.set('milestone', false); m.set('ord', ord);
      tasks.set(id, m);
    });
    setSel({ kind: 'task', id }); // the sel-effect below opens its module + accordion and scrolls to it
  }
  function setTask(id, patch) {
    const m = tasks.get(id);
    if (!m) return;
    ydoc.transact(() => Object.entries(patch).forEach(([k, v]) => m.set(k, v)));
  }
  function delTask(t) {
    if (t.name && !confirm(`למחוק את "${t.name}"?`)) return;
    ydoc.transact(() => {
      tasks.delete(t.id);
      [...links.entries()].forEach(([lid, m]) => { if (m.get('from') === t.id || m.get('to') === t.id) links.delete(lid); });
    });
    if (sel?.id === t.id) setSel(null);
  }
  function addLink(from, to) {
    if (from === to) return;
    const dup = linkList.some((l) => l.from === from && l.to === to);
    if (dup) return;
    const id = uid(), m = new Y.Map();
    m.set('from', from); m.set('to', to);
    links.set(id, m);
  }
  function delLink(id) { links.delete(id); }

  // ---- pointer interactions ----
  const gx = useCallback((e) => {
    const r = gridRef.current.getBoundingClientRect();
    return e.clientX - r.left;
  }, []);
  const gy = useCallback((e) => {
    const r = gridRef.current.getBoundingClientRect();
    return e.clientY - r.top;
  }, []);
  const capture = (e) => { try { gridRef.current.setPointerCapture(e.pointerId); } catch { /* touch/pen edge cases */ } };

  // Drag distance uses raw clientX deltas, not grid-relative coordinates re-measured on
  // every move: selecting a task can shift the layout mid-drag (accordion open/close,
  // panel widths) — re-measuring against the grid's rect on each move would then read a
  // corrupted delta for that same gesture. A plain screen-space delta between two pointer
  // events is immune to any layout shift in between.
  function downBar(e, t) {
    if (!editable) return;
    e.stopPropagation();
    setSel({ kind: 'task', id: t.id });
    drag.current = { mode: 'move', id: t.id, startX: e.clientX, origStart: t.start, origEnd: t.end, moved: false };
    capture(e);
  }
  function downResize(e, t, side) {
    if (!editable) return;
    e.stopPropagation();
    setSel({ kind: 'task', id: t.id });
    drag.current = { mode: 'resize-' + side, id: t.id, startX: e.clientX, origStart: t.start, origEnd: t.end };
    capture(e);
  }
  function downLinkAnchor(e, t) {
    if (!editable) return;
    e.stopPropagation();
    setConnect({ from: t.id, x: gx(e), y: gy(e) });
    drag.current = { mode: 'link', from: t.id };
    capture(e);
  }
  function moveGrid(e) {
    const d = drag.current;
    if (!d) return;
    if (d.mode === 'link') { setConnect({ from: d.from, x: gx(e), y: gy(e) }); return; }
    const dxDays = Math.round((e.clientX - d.startX) / ppd);
    if (d.mode === 'move') {
      if (!d.moved && Math.abs(dxDays) < 1) return;
      d.moved = true;
      const dur = +parseISO(d.origEnd) - +parseISO(d.origStart);
      const newStart = toISO(new Date(+parseISO(d.origStart) + dxDays * DAY));
      const newEnd = toISO(new Date(+parseISO(newStart) + dur));
      setTask(d.id, { start: newStart, end: newEnd });
    } else if (d.mode === 'resize-start') {
      let newStart = toISO(new Date(+parseISO(d.origStart) + dxDays * DAY));
      if (newStart >= d.origEnd) newStart = toISO(new Date(+parseISO(d.origEnd) - DAY));
      setTask(d.id, { start: newStart });
    } else if (d.mode === 'resize-end') {
      let newEnd = toISO(new Date(+parseISO(d.origEnd) + dxDays * DAY));
      if (newEnd <= d.origStart) newEnd = toISO(new Date(+parseISO(d.origStart) + DAY));
      setTask(d.id, { end: newEnd });
    }
  }
  function upGrid(e) {
    const d = drag.current;
    drag.current = null;
    if (d?.mode === 'link') {
      setConnect(null);
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-task]');
      const to = el?.dataset.task;
      if (to) addLink(d.from, to);
    }
  }

  // ---- TXT export/import (full round-trip, incl. links) ----
  const boolHe = (b) => (b ? 'כן' : 'לא');
  const exportTxt = () => {
    const gNum = new Map(groupList.map((g, i) => [g.id, i + 1]));
    const tNum = new Map(allTasks.map((t, i) => [t.id, i + 1]));
    const lines = [
      row(['כותרת', title]),
      row(['טווח התחלה', rangeStart]),
      row(['טווח סיום', rangeEnd]),
      row(['רמת פירוט', gran === 'week' ? 'שבועות' : 'חודשים']),
      row(['הצגת היום', boolHe(showToday)]),
      row(['הצגת קשרים', boolHe(showLinks)]),
      row(['הצגת אחוזים', boolHe(showPct)]),
      '',
      ...groupList.map((g) => `[G${gNum.get(g.id)}] מודול,${esc(g.name)},${esc(g.color)}`),
      '',
      ...allTasks.map((t) => `[T${tNum.get(t.id)}] משימה,${row([gNum.get(t.groupId) || '', t.name, t.start, t.end, t.progress, t.color, boolHe(t.milestone)])}`),
      '',
      ...linkList.filter((l) => tNum.has(l.from) && tNum.has(l.to)).map((l) => row(['קשר', tNum.get(l.from), tNum.get(l.to)])),
    ];
    download(lines.join('\r\n') + '\r\n', `${title || 'לוח גאנט'}.txt`);
  };
  const exportPdf = () => printElementImage('.gt-canvas', { title: title || 'לוח גאנט', landscape: true, clip: true });
  // Excel: a real HTML <table> saved with an .xls extension — Excel opens this natively and
  // renders the inline cell colors, no binary xlsx library needed. Leading columns carry the
  // same structured fields as the TXT format (minus link IDs, which don't survive a human
  // editing colored cells by hand) so the file re-imports cleanly; the month columns are the
  // colored "Gantt in a spreadsheet" view this was asked for.
  const exportExcel = () => {
    const months = monthList(rangeStart, rangeEnd);
    const head = ['מודול', 'משימה', 'התחלה', 'סיום', '%', 'אבן דרך', 'תלות מקדימה', 'תלות מאוחרת', ...months.map((m) => m.label)];
    const bodyRows = allTasks.map((t) => {
      const g = groupList.find((x) => x.id === t.groupId);
      const sT = +parseISO(t.start), eT = t.milestone ? sT + DAY : +parseISO(t.end);
      const preds = linkList.filter((l) => l.to === t.id).map((l) => taskNameById.get(l.from)).filter(Boolean).join('; ');
      const succs = linkList.filter((l) => l.from === t.id).map((l) => taskNameById.get(l.to)).filter(Boolean).join('; ');
      const color = t.color || g?.color || '#3b82f6';
      const monthCells = months.map((m) => {
        const active = sT < m.end && eT > m.start;
        return `<td style="background:${active ? color : '#ffffff'};border:1px solid #ccc;width:24px;"></td>`;
      }).join('');
      return `<tr>
        <td style="background:${g?.color || '#fff'};font-weight:bold;border:1px solid #ccc;padding:3px 6px;">${escHtml(g?.name || '')}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;">${escHtml(t.name)}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;">${t.start}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;">${t.milestone ? '' : t.end}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;">${t.milestone ? '' : t.progress}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;">${t.milestone ? 'כן' : 'לא'}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;">${escHtml(preds)}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;">${escHtml(succs)}</td>
        ${monthCells}
      </tr>`;
    }).join('');
    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head>` +
      `<body dir="rtl"><table border="1" style="border-collapse:collapse;font-family:Arial;font-size:12px;">` +
      `<tr>${head.map((h) => `<th style="background:#eef1f5;border:1px solid #ccc;padding:3px 6px;">${escHtml(h)}</th>`).join('')}</tr>` +
      `${bodyRows}</table></body></html>`;
    download(html, `${title || 'לוח גאנט'}.xls`, 'application/vnd.ms-excel;charset=utf-8');
  };
  function applyGanttTxt(txt, { skipConfirm = false } = {}) {
    const lines = txt.split(/\r?\n/);
    let newTitle = '', newStart = '', newEnd = '', newGran = 'month', newShowToday = true, newShowLinks = true, newShowPct = true;
    const parsedGroups = [], parsedTasks = [], parsedLinks = [];
    for (const line of lines) {
      const g = line.match(/^\[G(\d+)\]\s*מודול,(.*)/); if (g) { const f = parseCsvLine(g[2]); parsedGroups.push({ num: +g[1], name: f[0] || 'מודול', color: f[1] || PASTELS['אפור'] }); continue; }
      const t = line.match(/^\[T(\d+)\]\s*משימה,(.*)/);
      if (t) {
        const f = parseCsvLine(t[2]);
        parsedTasks.push({
          num: +t[1], groupNum: +f[0], name: f[1] || '', start: f[2] || today(), end: f[3] || today(),
          progress: +f[4] || 0, color: f[5] || '', milestone: f[6] === 'כן',
        });
        continue;
      }
      const l = line.match(/^קשר,(\d+),(\d+)/); if (l) { parsedLinks.push({ from: +l[1], to: +l[2] }); continue; }
      const rowFields = parseCsvLine(line);
      const label = (rowFields[0] || '').trim();
      if (label === 'כותרת') newTitle = rowFields[1] || '';
      else if (label === 'טווח התחלה') newStart = (rowFields[1] || '').trim();
      else if (label === 'טווח סיום') newEnd = (rowFields[1] || '').trim();
      else if (label === 'רמת פירוט') newGran = (rowFields[1] || '').trim() === 'שבועות' ? 'week' : 'month';
      else if (label === 'הצגת היום') newShowToday = (rowFields[1] || '').trim() !== 'לא';
      else if (label === 'הצגת קשרים') newShowLinks = (rowFields[1] || '').trim() !== 'לא';
      else if (label === 'הצגת אחוזים') newShowPct = (rowFields[1] || '').trim() !== 'לא';
    }
    if (!parsedGroups.length && !parsedTasks.length) return alert('לא נמצא תוכן תקין בקובץ');
    if (!skipConfirm && (groups.size || tasks.size) && !confirm('הטעינה תחליף את לוח הגאנט הנוכחי. להמשיך?')) return;
    ydoc.transact(() => {
      if (newTitle) meta.set('title', newTitle);
      if (newStart) meta.set('start', newStart);
      if (newEnd) meta.set('end', newEnd);
      meta.set('gran', newGran); meta.set('showToday', newShowToday); meta.set('showLinks', newShowLinks); meta.set('showPct', newShowPct);
      [...groups.keys()].forEach((k) => groups.delete(k));
      [...tasks.keys()].forEach((k) => tasks.delete(k));
      [...links.keys()].forEach((k) => links.delete(k));
      const groupIdByNum = new Map();
      parsedGroups.forEach((g, i) => {
        const id = uid(), m = new Y.Map();
        m.set('name', g.name); m.set('color', g.color); m.set('ord', i + 1);
        groups.set(id, m);
        groupIdByNum.set(g.num, id);
      });
      const taskIdByNum = new Map();
      parsedTasks.forEach((t, i) => {
        const id = uid(), m = new Y.Map();
        m.set('groupId', groupIdByNum.get(t.groupNum) || ''); m.set('name', t.name);
        m.set('start', t.start); m.set('end', t.end); m.set('progress', t.progress);
        m.set('color', t.color); m.set('milestone', t.milestone); m.set('ord', i + 1);
        tasks.set(id, m);
        taskIdByNum.set(t.num, id);
      });
      parsedLinks.forEach((l) => {
        const from = taskIdByNum.get(l.from), to = taskIdByNum.get(l.to);
        if (!from || !to) return;
        const id = uid(), m = new Y.Map();
        m.set('from', from); m.set('to', to);
        links.set(id, m);
      });
    });
    setSel(null);
  }
  // Reads the exported .xls back — it's a plain HTML <table>, so DOMParser handles it with no
  // library. Reconstructs modules (one per distinct name, in first-seen order) and tasks from
  // the leading structured columns; the colored month cells are decorative and ignored on
  // read, and — since a human may have hand-edited names in Excel — predecessor/successor
  // links are matched best-effort by name rather than reconstructed (the TXT format remains
  // the fully reliable round-trip for links).
  function applyExcelHtml(text, { skipConfirm = false } = {}) {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const trs = [...doc.querySelectorAll('table tr')].slice(1); // skip header row
    const groupNames = [];
    const parsed = [];
    trs.forEach((tr) => {
      const cells = [...tr.children].map((td) => td.textContent.trim());
      if (!cells.length) return;
      const [groupName, name, start, end, pctStr, msStr, predsStr, succsStr] = cells;
      if (!groupName && !name) return;
      let gi = groupNames.indexOf(groupName);
      if (gi === -1) { gi = groupNames.length; groupNames.push(groupName || 'מודול'); }
      const milestone = msStr === 'כן';
      parsed.push({
        groupIdx: gi, name: name || '', start: start || today(),
        end: milestone ? (start || today()) : (end || start || today()),
        progress: +pctStr || 0, milestone,
        preds: (predsStr || '').split(/[;,]/).map((s) => s.trim()).filter(Boolean),
        succs: (succsStr || '').split(/[;,]/).map((s) => s.trim()).filter(Boolean),
      });
    });
    if (!parsed.length) return alert('לא נמצאו משימות בקובץ');
    if (!skipConfirm && (groups.size || tasks.size) && !confirm('הטעינה תחליף את לוח הגאנט הנוכחי. להמשיך?')) return;
    ydoc.transact(() => {
      [...groups.keys()].forEach((k) => groups.delete(k));
      [...tasks.keys()].forEach((k) => tasks.delete(k));
      [...links.keys()].forEach((k) => links.delete(k));
      const palette = Object.values(PASTELS);
      const groupIds = groupNames.map((name, i) => {
        const id = uid(), m = new Y.Map();
        m.set('name', name); m.set('color', palette[i % palette.length]); m.set('ord', i + 1);
        groups.set(id, m);
        return id;
      });
      const taskIdByName = new Map();
      const createdIds = parsed.map((t, i) => {
        const id = uid(), m = new Y.Map();
        m.set('groupId', groupIds[t.groupIdx]); m.set('name', t.name);
        m.set('start', t.start); m.set('end', t.end); m.set('progress', t.progress);
        m.set('color', ''); m.set('milestone', t.milestone); m.set('ord', i + 1);
        tasks.set(id, m);
        if (t.name) taskIdByName.set(t.name, id);
        return id;
      });
      // Each link appears twice in the sheet — as a "successor" on the source row and a
      // "predecessor" on the target row — so this pass needs its own seen-set; the from|to
      // pairs already created within this same loop aren't reflected in the component's
      // stale linkList closure.
      const seenPairs = new Set();
      const addOnce = (fromId, toId) => {
        if (!fromId || !toId || fromId === toId) return;
        const key = fromId + '|' + toId;
        if (seenPairs.has(key)) return;
        seenPairs.add(key);
        const id = uid(), m = new Y.Map();
        m.set('from', fromId); m.set('to', toId);
        links.set(id, m);
      };
      parsed.forEach((t, i) => {
        const toId = createdIds[i];
        t.preds.forEach((predName) => addOnce(taskIdByName.get(predName), toId));
        t.succs.forEach((succName) => addOnce(toId, taskIdByName.get(succName)));
      });
    });
    setSel(null);
  }
  async function importFile(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    bumpReimport();
    const text = await f.text();
    if (/<table/i.test(text)) return applyExcelHtml(text);
    return applyGanttTxt(text);
  }
  function loadExample() {
    if (!confirm('טעינת דוגמה תחליף את לוח הגאנט הנוכחי. להמשיך?')) return;
    applyGanttTxt(GANTT_EXAMPLE_TXT, { skipConfirm: true });
    meta.set('title', 'לוח גאנט - פרויקט 2026-2027');
  }

  function fitAll() {
    setZoom(1);
    canvasRef.current?.scrollTo({ left: 0, top: 0 });
  }

  const selTask = sel?.kind === 'task' ? taskById.get(sel.id) : null;
  const selGroup = sel?.kind === 'group' ? groupList.find((g) => g.id === sel.id) : null;

  return (
    <div className="doc-page">
      <header className="topbar">
        <Link to="/" className="logo-sm" title="חזרה לדף הבית"><Logo size={22} /><span className="logo-word">טורבו</span></Link>
        <input className="title-input" title={title || undefined} placeholder="לוח גאנט ללא שם" value={title} readOnly={!editable}
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
            <button className="btn" title="ניתן לטעון קובץ TXT או Excel (.xls) בפורמט שיוצא מהמערכת" onClick={() => fileRef.current.click()}>טעינה</button>
            <input ref={fileRef} type="file" accept=".txt,.xls" hidden onChange={importFile} />
            <button className="btn" title="טעינת לוח גאנט לדוגמה, למטרות הכרות עם המערכת" onClick={loadExample}>דוגמה</button>
          </>}
          <Menu label="הורדה">
            <button onClick={exportPdf}>PDF (הדפסה)</button>
            <button onClick={exportExcel}>Excel (טבלה צבעונית)</button>
            <button onClick={exportTxt}>TXT - לטעינה חוזרת</button>
          </Menu>
          <ShareMenu info={info} />
          <ThemeToggle />
        </div>
      </header>

      {editable && (
        <div className="toolbar gt-toolbar">
          <button className="btn" onClick={addGroup}>+ מודול</button>
          <span className="sep" />
          <label className="gt-range-l">מ-<input type="date" value={rangeStart} onChange={(e) => e.target.value && meta.set('start', e.target.value)} /></label>
          <label className="gt-range-l">עד <input type="date" value={rangeEnd} onChange={(e) => e.target.value && meta.set('end', e.target.value)} /></label>
          <div className="gz-style-picker gt-gran-picker">
            <button type="button" className={'gz-style-btn' + (gran === 'month' ? ' sel' : '')} onClick={() => meta.set('gran', 'month')}>חודשים</button>
            <button type="button" className={'gz-style-btn' + (gran === 'week' ? ' sel' : '')} onClick={() => meta.set('gran', 'week')}>שבועות</button>
          </div>
          <span className="sep" />
          <label className="tl-check" title="הצגה/הסתרה של קו התאריך הנוכחי">
            <input type="checkbox" checked={showToday} onChange={(e) => meta.set('showToday', e.target.checked)} /> היום
          </label>
          <label className="tl-check" title="הצגה/הסתרה של חצי התלות בין משימות">
            <input type="checkbox" checked={showLinks} onChange={(e) => meta.set('showLinks', e.target.checked)} /> קשרים
          </label>
          <label className="tl-check" title="הצגה/הסתרה של אחוזי ההשלמה על גבי המשימות">
            <input type="checkbox" checked={showPct} onChange={(e) => meta.set('showPct', e.target.checked)} /> אחוזים
          </label>
          <span className="sep" />
          <button className="tb" title="הקטנה" onClick={() => setZoom((z) => Math.max(0.4, z / 1.3))}>−</button>
          <button className="tb" title="הגדלה" onClick={() => setZoom((z) => Math.min(8, z * 1.3))}>+</button>
          <button className="btn" onClick={fitAll}>הצג הכל</button>
          <span className="hint" style={{ marginInlineStart: 'auto' }}>גרירת משימה - הזזה · גרירת קצה - שינוי משך · גרירת הנקודה בקצה - קישור בין משימות</span>
        </div>
      )}

      <div className="gt-page">
        <div className="gt-split">
          {tableOpen && (
            <aside className="gt-table-wrap">
              {editable && <button type="button" className="btn gt-add-group-btn" onClick={addGroup}>+ מודול</button>}
              {groupsLaid.map(({ group: g, tasks: gTasks }) => (
                <GroupCard key={g.id} g={g} num={groupNumById.get(g.id)} editable={editable} sel={sel?.kind === 'group' && sel.id === g.id}
                  open={!closedGroupIds.has(g.id)} onToggleOpen={() => toggleGroupOpen(g.id)} taskCount={gTasks.length}
                  onSelect={(id) => setSel({ kind: 'group', id })} onChange={(patch) => setGroup(g.id, patch)}
                  onDelete={() => delGroup(g)} onAddTask={() => addTaskToGroup(g.id)}>
                  {gTasks.map((t) => {
                    const predecessors = linkList.filter((l) => l.to === t.id).map((l) => ({ linkId: l.id, name: taskNameById.get(l.from) }));
                    const successors = linkList.filter((l) => l.from === t.id).map((l) => ({ linkId: l.id, name: taskNameById.get(l.to) }));
                    const taskOptions = allTasks.filter((o) => o.id !== t.id).map((o) => ({ id: o.id, name: o.name }));
                    return (
                      <TaskCard key={t.id} t={t} num={taskNumById.get(t.id)} groupColor={g.color} editable={editable}
                        sel={sel?.kind === 'task' && sel.id === t.id} open={openTaskIds.has(t.id)} onToggleOpen={() => toggleTaskOpen(t.id)}
                        onSelect={(id) => setSel({ kind: 'task', id })} onChange={(patch) => setTask(t.id, patch)} onDelete={() => delTask(t)}
                        showPct={showPct} predecessors={predecessors} successors={successors} taskOptions={taskOptions}
                        onAddLink={addLink} onDelLink={delLink} />
                    );
                  })}
                  {!gTasks.length && <div className="gt-empty-table">אין עדיין משימות במודול הזה</div>}
                </GroupCard>
              ))}
              {!groupList.length && <div className="gt-empty-table">{editable ? 'מוסיפים מודול כדי להתחיל' : 'אין עדיין תוכן'}</div>}
            </aside>
          )}
          <div className="gt-canvas-col">
            <div className="gt-canvas-topbar">
              <button type="button" className="btn gt-table-toggle" onClick={() => setTableOpen((v) => !v)}>
                {tableOpen ? '‹ הסתרת טבלה' : 'הצגת טבלה ›'}
              </button>
              <span className="gt-canvas-title">{title || 'לוח גאנט'}</span>
            </div>
            <div className="gt-canvas" ref={canvasRef}
              onPointerDownCapture={cDown} onPointerMoveCapture={cMove} onPointerUpCapture={cUp} onPointerCancelCapture={cUp}>
              <div className="gt-stage" dir="ltr" style={{ width: LEFT_W + stageW }}>
                <div className="gt-header-row gt-header-years">
                  <div className="gt-corner" />
                  <div className="gt-header-track" style={{ width: stageW }}>
                    {yearSegs.map((s) => <div key={s.key} className="gt-seg gt-seg-year" style={{ left: s.x, width: s.w }}>{s.label}</div>)}
                  </div>
                </div>
                <div className="gt-header-row gt-header-units">
                  <div className="gt-corner gt-corner-sub" />
                  <div className="gt-header-track" style={{ width: stageW }}>
                    {unitSegs.map((s) => <div key={s.key} className="gt-seg gt-seg-unit" style={{ left: s.x, width: s.w }}>{s.label}</div>)}
                  </div>
                </div>
                <div className="gt-body" style={{ minHeight: totalHeight || ROW_H }}>
                  <div className="gt-left">
                    {groupsLaid.map(({ group: g }) => (
                      <div key={g.id} className={'gt-group-label' + (sel?.kind === 'group' && sel.id === g.id ? ' sel' : '')}
                        style={{ top: g.top, height: g.height, background: g.color, color: textColorFor(g.color) }}
                        onClick={() => editable && setSel({ kind: 'group', id: g.id })}>
                        <span className="gt-num">{groupNumById.get(g.id)}</span>{g.name}
                      </div>
                    ))}
                    {!groupList.length && <div className="gt-empty-left">מוסיפים מודול כדי להתחיל</div>}
                  </div>
                  <div className="gt-grid" ref={gridRef} style={{ width: stageW, minHeight: totalHeight || ROW_H }}
                    onClick={(e) => { if (e.target === e.currentTarget) setSel(null); }}
                    onPointerMove={moveGrid} onPointerUp={upGrid} onPointerCancel={upGrid}>
                    {unitSegs.map((s) => <div key={s.key} className="gt-gridline" style={{ left: s.x }} />)}
                    {groupsLaid.map(({ group: g }, i) => (
                      <div key={g.id} className={'gt-band' + (i % 2 ? ' alt' : '')} style={{ top: g.top, height: g.height }} />
                    ))}
                    {todayVisible && <div className="gt-today" style={{ left: xOf(todayT) }} title="היום" />}
                    {showLinks && (
                      <svg className="gt-links-svg" style={{ width: stageW, height: totalHeight || ROW_H }}>
                        <defs>
                          <marker id="gt-arrow" markerWidth="9" markerHeight="9" refX="6.5" refY="3.5" orient="auto">
                            <path d="M0.5,0.5 L6.5,3.5 L0.5,6.5 Z" className="gt-arrowhead" />
                          </marker>
                        </defs>
                        {linkList.map((l) => {
                          const from = taskById.get(l.from), to = taskById.get(l.to);
                          if (!from || !to) return null;
                          const x1 = xOf(from.endT), y1 = from.top + ROW_H / 2;
                          const x2 = xOf(to.startT), y2 = to.top + ROW_H / 2;
                          const d = elbowPath(x1, y1, x2 - 1, y2);
                          return (
                            <g key={l.id} className="gt-link-g">
                              <path d={d} className="gt-link" style={{ stroke: from.color || PASTELS['אפור'] }} markerEnd="url(#gt-arrow)" />
                              {editable && <path d={d} className="gt-link-hit" onClick={(e) => { e.stopPropagation(); delLink(l.id); }} />}
                            </g>
                          );
                        })}
                        {connect && (() => {
                          const from = taskById.get(connect.from);
                          if (!from) return null;
                          const x1 = xOf(from.endT), y1 = from.top + ROW_H / 2;
                          return <line x1={x1} y1={y1} x2={connect.x} y2={connect.y} className="gt-link-preview" />;
                        })()}
                      </svg>
                    )}
                    {laidTasks.map((t) => {
                      const color = t.color || groupList.find((g) => g.id === t.groupId)?.color || PASTELS['כחול'];
                      const tnum = taskNumById.get(t.id);
                      if (t.milestone) {
                        // The diamond sits exactly at its date (its own centered transform);
                        // the label renders BELOW it, in the extra row-height reserved for
                        // milestone lanes — not beside it, which used to spill sideways into
                        // whatever bar or swimlane happened to be nearby.
                        const x = xOf(t.startT);
                        return (
                          <Fragment key={t.id}>
                            <div className={'gt-milestone' + (sel?.kind === 'task' && sel.id === t.id ? ' sel' : '')}
                              data-task={t.id} style={{ left: x, top: t.top + ROW_H / 2 }}
                              onPointerDown={(e) => downBar(e, t)}>
                              <span className="gt-diamond" style={{ background: color }} />
                              {editable && <span className="gt-link-anchor" onPointerDown={(e) => downLinkAnchor(e, t)} />}
                            </div>
                            <span className="gt-milestone-label" data-task={t.id} style={{ left: x, top: t.top + ROW_H + MS_EXTRA / 2 }}
                              onPointerDown={(e) => downBar(e, t)}>
                              <span className="gt-num">{tnum}</span>{t.name || 'אבן דרך'}
                            </span>
                          </Fragment>
                        );
                      }
                      const x = xOf(t.startT), w = Math.max(6, xOf(t.endT) - xOf(t.startT));
                      // A bar too narrow for its own text hides the label entirely (overflow:
                      // hidden) — instead render it just past the bar's end, always readable.
                      const outside = w < estLabelW(t.name, showPct) + 22;
                      return (
                        <Fragment key={t.id}>
                          <div className={'gt-bar' + (sel?.kind === 'task' && sel.id === t.id ? ' sel' : '')}
                            data-task={t.id} style={{ left: x, top: t.top + (ROW_H - BAR_H) / 2, width: w, height: BAR_H, background: color }}
                            onPointerDown={(e) => downBar(e, t)}>
                            {editable && <span className="gt-handle gt-handle-s" onPointerDown={(e) => downResize(e, t, 'start')} />}
                            {!outside && <span className="gt-num gt-num-bar">{tnum}</span>}
                            {!outside && <span className="gt-bar-label">{t.name}</span>}
                            {!outside && showPct && <span className="gt-bar-pct">{t.progress}%</span>}
                            {editable && <span className="gt-handle gt-handle-e" onPointerDown={(e) => downResize(e, t, 'end')} />}
                            {editable && <span className="gt-link-anchor" onPointerDown={(e) => downLinkAnchor(e, t)} />}
                          </div>
                          {outside && (() => {
                            const nextX = nextInLaneXById.get(t.id);
                            const maxW = nextX != null ? Math.max(20, Math.min(150, nextX - (x + w + 6) - 4)) : 150;
                            return (
                              <span className="gt-bar-label-ext" data-task={t.id} style={{ left: x + w + 6, top: t.top + ROW_H / 2, maxWidth: maxW }}
                                onPointerDown={(e) => downBar(e, t)}>
                                <span className="gt-num">{tnum}</span>{t.name || 'ללא שם'}{showPct && t.progress ? ` · ${t.progress}%` : ''}
                              </span>
                            );
                          })()}
                        </Fragment>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
