import { useEffect, useMemo, useState, useReducer, useRef, useCallback } from 'react';
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
const clampDate = (iso, lo, hi) => (iso < lo ? lo : iso > hi ? hi : iso);
const num = (v, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };
const fmt = (iso) => (iso ? parseISO(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

// ---- layout geometry ----------------------------------------------------------------
const ROW_H = 34, BAR_H = 24, GROUP_GAP = 3, LEFT_W = 148;

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

const download = (text, name) => {
  bumpDownload();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};
const esc = (s) => { s = String(s ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const row = (arr) => arr.map(esc).join(',');
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

export default function Gantt({ info, user, token }) {
  const editable = info.mode === 'edit';
  const [, force] = useReducer((c) => c + 1, 0);
  const [status, setStatus] = useState('connecting');
  const [title, setTitle] = useState('');
  const [peers, setPeers] = useState([]);
  const [sel, setSel] = useState(null); // {kind:'task'|'group', id}
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

  // ---- data ----
  const rangeStart = meta.get('start') || defaultStart();
  const rangeEnd = meta.get('end') || defaultEnd();
  const gran = meta.get('gran') === 'week' ? 'week' : 'month';
  const showToday = meta.get('showToday') !== false;
  const showLinks = meta.get('showLinks') !== false;

  const groupList = [...groups.entries()]
    .map(([id, m]) => ({ id, name: m.get('name') || 'מודול', color: m.get('color') || PASTELS['אפור'], ord: m.get('ord') || 0 }))
    .sort((a, b) => a.ord - b.ord || a.id.localeCompare(b.id));

  const allTasks = [...tasks.entries()].map(([id, m]) => ({
    id, groupId: m.get('groupId'), name: m.get('name') || '',
    start: m.get('start') || today(), end: m.get('end') || m.get('start') || today(),
    progress: Math.min(100, Math.max(0, num(m.get('progress'), 0))),
    color: m.get('color') || '', texture: !!m.get('texture'), milestone: !!m.get('milestone'),
    ord: m.get('ord') || 0,
  }));

  const startT = +parseISO(rangeStart), endT = +parseISO(rangeEnd);
  const spanDays = Math.max(1, (endT - startT) / DAY);
  const basePpd = Math.max(2, (cw - LEFT_W - 8) / spanDays);
  const ppd = Math.min(240, Math.max(1.5, basePpd * zoom));
  const stageW = spanDays * ppd;
  const xOf = (t) => ((t - startT) / DAY) * ppd;

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
    const laid = gTasks.map((t) => ({ ...t, lane: lane[t.id], top: cumTop + lane[t.id] * ROW_H }));
    const gLaid = { ...g, top: cumTop, height: count * ROW_H };
    cumTop += count * ROW_H + GROUP_GAP;
    return { group: gLaid, tasks: laid };
  });
  const totalHeight = Math.max(cumTop - GROUP_GAP, 0);
  const laidTasks = groupsLaid.flatMap((x) => x.tasks);
  const taskById = new Map(laidTasks.map((t) => [t.id, t]));

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
  function addTask() {
    const gid = (sel?.kind === 'group' && sel.id) || (sel?.kind === 'task' && taskById.get(sel.id)?.groupId) || groupList[0]?.id;
    if (!gid) return alert('קודם מוסיפים מודול, ואז משימות בתוכו');
    const id = uid(), m = new Y.Map();
    const gTasks = allTasks.filter((t) => t.groupId === gid);
    const ord = Math.max(0, ...gTasks.map((t) => t.ord)) + 1;
    const s = gTasks.length ? gTasks[gTasks.length - 1].end : rangeStart;
    ydoc.transact(() => {
      m.set('groupId', gid); m.set('name', ''); m.set('start', s); m.set('end', addMonths(s, 0) === s ? toISO(new Date(+parseISO(s) + 14 * DAY)) : s);
      m.set('progress', 0); m.set('color', ''); m.set('texture', false); m.set('milestone', false); m.set('ord', ord);
      tasks.set(id, m);
    });
    setSel({ kind: 'task', id });
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
  // every move: selecting a task opens the edit panel, which shrinks the canvas and shifts
  // the grid's on-screen position mid-drag — re-measuring against the grid's rect on each
  // move would then read a corrupted delta for that same gesture. A plain screen-space
  // delta between two pointer events is immune to any layout shift in between.
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

  // ---- TXT export/import ----
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
      '',
      ...groupList.map((g) => `[G${gNum.get(g.id)}] מודול,${esc(g.name)},${esc(g.color)}`),
      '',
      ...allTasks.map((t) => `[T${tNum.get(t.id)}] משימה,${row([gNum.get(t.groupId) || '', t.name, t.start, t.end, t.progress, t.color, boolHe(t.texture), boolHe(t.milestone)])}`),
      '',
      ...linkList.filter((l) => tNum.has(l.from) && tNum.has(l.to)).map((l) => row(['קשר', tNum.get(l.from), tNum.get(l.to)])),
    ];
    download(lines.join('\r\n') + '\r\n', `${title || 'לוח גאנט'}.txt`);
  };
  const exportPdf = () => printElementImage('.gt-canvas', { title: title || 'לוח גאנט', landscape: true, clip: true });
  function applyGanttTxt(txt, { skipConfirm = false } = {}) {
    const lines = txt.split(/\r?\n/);
    let newTitle = '', newStart = '', newEnd = '', newGran = 'month', newShowToday = true, newShowLinks = true;
    const parsedGroups = [], parsedTasks = [], parsedLinks = [];
    for (const line of lines) {
      const g = line.match(/^\[G(\d+)\]\s*מודול,(.*)/); if (g) { const f = parseCsvLine(g[2]); parsedGroups.push({ num: +g[1], name: f[0] || 'מודול', color: f[1] || PASTELS['אפור'] }); continue; }
      const t = line.match(/^\[T(\d+)\]\s*משימה,(.*)/);
      if (t) {
        const f = parseCsvLine(t[2]);
        parsedTasks.push({
          num: +t[1], groupNum: +f[0], name: f[1] || '', start: f[2] || today(), end: f[3] || today(),
          progress: +f[4] || 0, color: f[5] || '', texture: f[6] === 'כן', milestone: f[7] === 'כן',
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
    }
    if (!parsedGroups.length && !parsedTasks.length) return alert('לא נמצא תוכן תקין בקובץ');
    if (!skipConfirm && (groups.size || tasks.size) && !confirm('הטעינה תחליף את לוח הגאנט הנוכחי. להמשיך?')) return;
    ydoc.transact(() => {
      if (newTitle) meta.set('title', newTitle);
      if (newStart) meta.set('start', newStart);
      if (newEnd) meta.set('end', newEnd);
      meta.set('gran', newGran); meta.set('showToday', newShowToday); meta.set('showLinks', newShowLinks);
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
        m.set('color', t.color); m.set('texture', t.texture); m.set('milestone', t.milestone); m.set('ord', i + 1);
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
  async function importTxt(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    bumpReimport();
    applyGanttTxt(await f.text());
  }
  function loadExample() {
    if (!confirm('טעינת דוגמה תחליף את לוח הגאנט הנוכחי. להמשיך?')) return;
    applyGanttTxt(GANTT_EXAMPLE_TXT, { skipConfirm: true });
    meta.set('title', 'לוח גאנט - תוכנית העבודה 2026');
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
            <button className="btn" title="ניתן לטעון קובץ TXT בפורמט שיוצא מהמערכת בלבד" onClick={() => fileRef.current.click()}>טעינה</button>
            <input ref={fileRef} type="file" accept=".txt" hidden onChange={importTxt} />
            <button className="btn" title="טעינת לוח גאנט לדוגמה, למטרות הכרות עם המערכת" onClick={loadExample}>דוגמה</button>
          </>}
          <Menu label="הורדה">
            <button onClick={exportPdf}>PDF (הדפסה)</button>
            <button onClick={exportTxt}>TXT - לטעינה חוזרת</button>
          </Menu>
          <ShareMenu info={info} />
          <ThemeToggle />
        </div>
      </header>

      {editable && (
        <div className="toolbar gt-toolbar">
          <button className="btn" onClick={addGroup}>+ מודול</button>
          <button className="btn" onClick={addTask}>+ משימה</button>
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
          <span className="sep" />
          <button className="tb" title="הקטנה" onClick={() => setZoom((z) => Math.max(0.4, z / 1.3))}>−</button>
          <button className="tb" title="הגדלה" onClick={() => setZoom((z) => Math.min(8, z * 1.3))}>+</button>
          <button className="btn" onClick={fitAll}>הצג הכל</button>
          <span className="hint" style={{ marginInlineStart: 'auto' }}>גרירת משימה - הזזה · גרירת קצה - שינוי משך · גרירת הנקודה בקצה - קישור בין משימות</span>
        </div>
      )}

      <div className="gt-page">
        <div className="gt-canvas" ref={canvasRef}
          onPointerDownCapture={cDown} onPointerMoveCapture={cMove} onPointerUpCapture={cUp} onPointerCancelCapture={cUp}>
          <div className="gt-stage" dir="ltr" style={{ width: LEFT_W + stageW }}>
            <div className="gt-header-row gt-header-years">
              <div className="gt-corner">{title || 'לוח גאנט'}</div>
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
            <div className="gt-body" style={{ height: totalHeight || ROW_H }}>
              <div className="gt-left">
                {groupsLaid.map(({ group: g }) => (
                  <div key={g.id} className={'gt-group-label' + (sel?.kind === 'group' && sel.id === g.id ? ' sel' : '')}
                    style={{ top: g.top, height: g.height, background: g.color }}
                    onClick={() => editable && setSel({ kind: 'group', id: g.id })}>
                    {g.name}
                  </div>
                ))}
                {!groupList.length && <div className="gt-empty-left">מוסיפים מודול כדי להתחיל</div>}
              </div>
              <div className="gt-grid" ref={gridRef} style={{ width: stageW, height: totalHeight || ROW_H }}
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
                      <marker id="gt-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                        <path d="M0,0 L6,3 L0,6 Z" className="gt-arrowhead" />
                      </marker>
                    </defs>
                    {linkList.map((l) => {
                      const from = taskById.get(l.from), to = taskById.get(l.to);
                      if (!from || !to) return null;
                      const x1 = xOf(from.endT), y1 = from.top + (from.lane + 0.5) * ROW_H;
                      const x2 = xOf(to.startT), y2 = to.top + (to.lane + 0.5) * ROW_H;
                      const midX = Math.max(x1 + 14, (x1 + x2) / 2);
                      const d = `M ${x1} ${y1} H ${midX} V ${y2} H ${x2 - 8}`;
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
                      const x1 = xOf(from.endT), y1 = from.top + (from.lane + 0.5) * ROW_H;
                      return <line x1={x1} y1={y1} x2={connect.x} y2={connect.y} className="gt-link-preview" />;
                    })()}
                  </svg>
                )}
                {laidTasks.map((t) => {
                  const color = t.color || groupList.find((g) => g.id === t.groupId)?.color || PASTELS['כחול'];
                  if (t.milestone) {
                    const x = xOf(t.startT);
                    return (
                      <div key={t.id} className={'gt-milestone' + (sel?.kind === 'task' && sel.id === t.id ? ' sel' : '')}
                        data-task={t.id} style={{ left: x, top: t.top + ROW_H / 2 }}
                        onPointerDown={(e) => downBar(e, t)}>
                        <span className="gt-diamond" style={{ background: color }} />
                        <span className="gt-milestone-label">{t.name || 'אבן דרך'}</span>
                        {editable && <span className="gt-link-anchor" onPointerDown={(e) => downLinkAnchor(e, t)} />}
                      </div>
                    );
                  }
                  const x = xOf(t.startT), w = Math.max(6, xOf(t.endT) - xOf(t.startT));
                  return (
                    <div key={t.id} className={'gt-bar' + (t.texture ? ' texture' : '') + (sel?.kind === 'task' && sel.id === t.id ? ' sel' : '')}
                      data-task={t.id} style={{ left: x, top: t.top + (ROW_H - BAR_H) / 2, width: w, height: BAR_H, background: color }}
                      onPointerDown={(e) => downBar(e, t)}>
                      {editable && <span className="gt-handle gt-handle-s" onPointerDown={(e) => downResize(e, t, 'start')} />}
                      <span className="gt-bar-label">{t.name}</span>
                      <span className="gt-bar-pct">{t.progress}%</span>
                      {editable && <span className="gt-handle gt-handle-e" onPointerDown={(e) => downResize(e, t, 'end')} />}
                      {editable && <span className="gt-link-anchor" onPointerDown={(e) => downLinkAnchor(e, t)} />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {editable && (selTask || selGroup) && (
          <div className="gt-panel">
            {selGroup && (
              <>
                <div className="gt-panel-head"><h3>מודול</h3><button className="gz-x" onClick={() => setSel(null)}>✕</button></div>
                <label className="gz-field"><span>שם המודול</span>
                  <GrowingField value={selGroup.name} placeholder="שם המודול" onChange={(e) => setGroup(selGroup.id, { name: e.target.value })} />
                </label>
                <label className="gz-field"><span>צבע</span>
                  <span className="xy-swatches">
                    {Object.entries(PASTELS).map(([name, hex]) => (
                      <button key={hex} type="button" title={name} className={'swatch-sm' + (selGroup.color === hex ? ' sel' : '')}
                        style={{ background: hex }} onClick={() => setGroup(selGroup.id, { color: hex })} />
                    ))}
                    <input type="color" value={selGroup.color} onChange={(e) => setGroup(selGroup.id, { color: e.target.value })} />
                  </span>
                </label>
                <button className="btn gt-del-btn" onClick={() => delGroup(selGroup)}>מחיקת המודול</button>
              </>
            )}
            {selTask && (
              <>
                <div className="gt-panel-head"><h3>{selTask.milestone ? 'אבן דרך' : 'משימה'}</h3><button className="gz-x" onClick={() => setSel(null)}>✕</button></div>
                <label className="gz-field"><span>שם</span>
                  <GrowingField value={selTask.name} placeholder="שם המשימה" onChange={(e) => setTask(selTask.id, { name: e.target.value })} />
                </label>
                <label className="gz-field"><span>מודול</span>
                  <select value={selTask.groupId} onChange={(e) => setTask(selTask.id, { groupId: e.target.value })}>
                    {groupList.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </label>
                <div className="gz-edit-row">
                  <label className="gz-field"><span>התחלה</span>
                    <input type="date" value={selTask.start} onChange={(e) => e.target.value && setTask(selTask.id, { start: e.target.value, end: selTask.milestone ? e.target.value : (e.target.value >= selTask.end ? toISO(new Date(+parseISO(e.target.value) + DAY)) : selTask.end) })} />
                  </label>
                  {!selTask.milestone && (
                    <label className="gz-field"><span>סיום</span>
                      <input type="date" value={selTask.end} onChange={(e) => e.target.value && e.target.value > selTask.start && setTask(selTask.id, { end: e.target.value })} />
                    </label>
                  )}
                </div>
                {!selTask.milestone && (
                  <label className="gz-field gz-field-wide"><span>אחוז השלמה</span>
                    <input type="number" min={0} max={100} value={selTask.progress}
                      onChange={(e) => setTask(selTask.id, { progress: e.target.value })}
                      onBlur={(e) => setTask(selTask.id, { progress: Math.min(100, Math.max(0, num(e.target.value, 0))) })} />
                  </label>
                )}
                <label className="gz-field"><span>צבע (ריק = צבע המודול)</span>
                  <span className="xy-swatches">
                    <button type="button" title="ברירת מחדל" className={'swatch-sm gt-swatch-reset' + (!selTask.color ? ' sel' : '')} onClick={() => setTask(selTask.id, { color: '' })}>↺</button>
                    {Object.entries(PASTELS).map(([name, hex]) => (
                      <button key={hex} type="button" title={name} className={'swatch-sm' + (selTask.color === hex ? ' sel' : '')}
                        style={{ background: hex }} onClick={() => setTask(selTask.id, { color: hex })} />
                    ))}
                    <input type="color" value={selTask.color || '#3b82f6'} onChange={(e) => setTask(selTask.id, { color: e.target.value })} />
                  </span>
                </label>
                <label className="tl-check">
                  <input type="checkbox" checked={selTask.texture} onChange={(e) => setTask(selTask.id, { texture: e.target.checked })} /> מרקם (פסים)
                </label>
                <label className="tl-check">
                  <input type="checkbox" checked={selTask.milestone}
                    onChange={(e) => setTask(selTask.id, { milestone: e.target.checked, end: e.target.checked ? selTask.start : (selTask.end > selTask.start ? selTask.end : toISO(new Date(+parseISO(selTask.start) + 7 * DAY))) })} /> אבן דרך מעוינת
                </label>
                {linkList.some((l) => l.from === selTask.id || l.to === selTask.id) && (
                  <div className="gt-links-list">
                    <span className="pj-metric-dod-l">קשרים</span>
                    {linkList.filter((l) => l.from === selTask.id || l.to === selTask.id).map((l) => {
                      const other = taskById.get(l.from === selTask.id ? l.to : l.from);
                      return (
                        <div key={l.id} className="gt-link-row">
                          <span>{l.from === selTask.id ? '→ ' : '← '}{other?.name || '-'}</span>
                          <button className="pj-x" onClick={() => delLink(l.id)}>✕</button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <button className="btn gt-del-btn" onClick={() => delTask(selTask)}>מחיקת המשימה</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
