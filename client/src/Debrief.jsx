import { useEffect, useMemo, useState, useReducer, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { ShareMenu, Menu } from './ShareExport.jsx';
import { ThemeToggle } from './theme.jsx';
import { Logo } from './icons.jsx';
import { PRESETS } from './debrief-presets.js';
import { touchRecent } from './identity.js';
import { exportDocxHtml } from './export.js';
import Tasks from './Tasks.jsx';

const uid = () => crypto.randomUUID().slice(0, 8);
const today = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 8); // "HH:MM:SS", locale-independent
const fmtDate = (iso) => (iso ? new Date(iso + 'T00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
// mirrors of the label maps used by the embedded Tasks screen (kept local, same pattern as Project.jsx)
const TK_STATUS = { new: 'חדש', in_progress: 'בעבודה', waiting: 'ממתין לאחר / בפער', done: 'בוצע' };
const TK_PRIORITY = { 1: 'רגילה', 2: 'גבוהה', 3: 'דחוף' };
// same one-cell-per-log serialization as Tasks.jsx's own CSV export — this screen has no task
// CSV *import*, but the export should still carry the full update history, not just the
// current fields.
function logCellOut(log) {
  return (log || []).map((l) => {
    const parts = [new Date(l.at || Date.now()).toISOString(), l.by || ''];
    if (l.from !== l.to) parts.push(`${TK_STATUS[l.from] || l.from}→${TK_STATUS[l.to] || l.to}`);
    if (l.note) parts.push(l.note);
    return parts.join(' | ');
  }).join('\n');
}
const SECTIONS = [
  { k: 'findings', num: 3, title: 'ממצאים', hint: 'שורת טקסט חדשה בכל פלוס או Enter' },
  { k: 'lessons', num: 4, title: 'לקחים', hint: 'שורת טקסט חדשה בכל פלוס או Enter · כל לקח הופך אוטומטית למשימה (☑ ← לחיצה לביטול)', taskLinked: true, taskLabel: 'לקח' },
  { k: 'summary', num: 5, title: 'סיכום ומסקנות', hint: 'שורות מצטרפות בתחתית · כל שורה הופכת אוטומטית למשימה (☑ ← לחיצה לביטול)', taskLinked: true, taskLabel: 'המלצה' },
];
// the task's title is the short type label ("לקח"/"המלצה"); the line's full text goes in the
// task's own description field instead — a title long enough to hold a whole sentence was
// what made kanban cards blow up in the first place.
const TASK_LABEL = Object.fromEntries(SECTIONS.filter((s) => s.taskLinked).map((s) => [s.k, s.taskLabel]));
const csvEscape = (s) => { s = String(s ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const download = (text, name, type = 'text/plain;charset=utf-8') => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};
function autoGrow(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

// A growing single-line-turned-multiline field — a plain <input> hides overflow text past
// its width; this expands downward instead. Used for every free-text entry field on this
// screen (chronology details, and the ממצאים/לקחים/סיכום lines below).
function GrowingField({ value, onChange, onKeyDown, registerRef, placeholder, className }) {
  const ref = useRef();
  useEffect(() => { autoGrow(ref.current); }, [value]);
  return (
    <textarea
      ref={(el) => { ref.current = el; registerRef?.(el); }}
      className={className} rows={1} placeholder={placeholder}
      value={value} onChange={onChange} onKeyDown={onKeyDown}
    />
  );
}

// A single growing list of text lines (ממצאים / לקחים / סיכום) — mirrors the SWOT quadrant UX:
// "+ שורה" or Enter inside a line both open the next one, and a preset menu offers ready phrases.
// Each item is numbered "<chapter>.<item>" to match the document's chapter/clause numbering.
// sec.taskLinked sections (לקחים/סיכום) show a "☑/☐ משימה" badge — checked when the line has
// a live linked task (auto-created the moment the line was added), unchecked otherwise. It's
// a toggle: click to remove the task and leave the line task-free, click again to re-create
// one from the line's current text. The line's own ✕ still deletes the line and its task together.
function LineSection({ sec, items, editable, add, del, edit, toggleTask, taskIdSet }) {
  const [showPresets, setShowPresets] = useState(false);
  const ref = useRef();
  const inputRefs = useRef({});
  const focusId = useRef(null);
  useEffect(() => {
    const close = (e) => !ref.current?.contains(e.target) && setShowPresets(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  useEffect(() => {
    if (focusId.current && inputRefs.current[focusId.current]) {
      inputRefs.current[focusId.current].focus();
      focusId.current = null;
    }
  });
  function doAdd(presetText = '') {
    // A preset click reuses an already-open empty line instead of leaving it stranded and
    // opening a second one — "+ שורה" itself (presetText === '') always opens a fresh line.
    const last = items[items.length - 1];
    if (presetText && last && !last.text) {
      edit(last.id, presetText);
      focusId.current = last.id;
      return;
    }
    focusId.current = add(sec.k, presetText);
  }
  return (
    <section className="db-sec">
      <div className="db-sec-head">
        <span className="db-chnum">{sec.num}.</span>
        <h2 className="db-sec-title">{sec.title}</h2>
        {sec.hint && <span className="db-hint">{sec.hint}</span>}
      </div>
      <div className="sw-lines">
        {items.map((it, i) => (
          <div key={it.id} className="sw-line db-line">
            <span className="db-num">{sec.num}.{i + 1}</span>
            {editable ? (
              <GrowingField className="sw-grow" value={it.text} placeholder="הקלדה חופשית…"
                registerRef={(el) => { if (el) inputRefs.current[it.id] = el; else delete inputRefs.current[it.id]; }}
                onChange={(e) => edit(it.id, e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } }}
              />
            ) : (
              <span className="sw-text">{it.text || '—'}</span>
            )}
            {sec.taskLinked && (() => {
              const hasTask = it.taskId && taskIdSet.has(it.taskId);
              const label = (hasTask ? '☑' : '☐') + ' משימה';
              if (!editable) return <span className={'db-task-badge' + (hasTask ? '' : ' off')}>{label}</span>;
              const title = hasTask ? 'יש משימה מקושרת — לחיצה תסיר אותה' : 'אין משימה מקושרת — לחיצה תיצור אחת';
              return (
                <button className={'db-task-badge' + (hasTask ? '' : ' off')} title={title} onClick={() => toggleTask(it.id)}>
                  {label}
                </button>
              );
            })()}
            {editable && <button className="sw-del" onClick={() => del(it.id)}>✕</button>}
          </div>
        ))}
        {!items.length && <div className="sw-empty">אין עדיין שורות</div>}
      </div>
      {editable && (
        <div className="sw-add-row" ref={ref}>
          <button className="btn sw-add" onClick={() => doAdd()}>+ שורה</button>
          <button className="btn sw-add" onClick={() => setShowPresets((v) => !v)}>הצעות ✦</button>
          {showPresets && (
            <div className="menu-items sw-presets">
              {PRESETS[sec.k].map((p) => (
                <button key={p} onClick={() => { doAdd(p); setShowPresets(false); }}>{p}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default function Debrief({ info, user, token }) {
  const editable = info.mode === 'edit';
  const [, force] = useReducer((c) => c + 1, 0);
  const [status, setStatus] = useState('connecting');
  const [title, setTitle] = useState('');
  const [peers, setPeers] = useState([]);
  const [showBgPresets, setShowBgPresets] = useState(false);
  const [showChronoPresets, setShowChronoPresets] = useState(false);
  const [showChronoNotesPresets, setShowChronoNotesPresets] = useState(false);
  const bgRef = useRef();
  const bgMenuRef = useRef();
  const chronoNotesRef = useRef();
  const chronoNotesMenuRef = useRef();
  const chronoMenuRef = useRef();
  const chronoRefs = useRef({});
  const chronoFocusId = useRef(null);
  const fileRef = useRef();

  const ydoc = useMemo(() => new Y.Doc(), []);
  const meta = ydoc.getMap('meta');
  const chrono = ydoc.getMap('chrono');
  const lines = ydoc.getMap('lines');
  const tasks = ydoc.getMap('tasks');
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
    return () => { ydoc.off('update', force); meta.unobserve(syncTitle); aw.off('change', syncPeers); provider.destroy(); };
  }, []);

  useEffect(() => { touchRecent(token, title, info.mode, 'debrief'); }, [title]);

  useEffect(() => {
    document.addEventListener('mousedown', closeBg);
    document.addEventListener('mousedown', closeChronoNotes);
    document.addEventListener('mousedown', closeChrono);
    return () => {
      document.removeEventListener('mousedown', closeBg);
      document.removeEventListener('mousedown', closeChronoNotes);
      document.removeEventListener('mousedown', closeChrono);
    };
    function closeBg(e) { if (!bgMenuRef.current?.contains(e.target)) setShowBgPresets(false); }
    function closeChronoNotes(e) { if (!chronoNotesMenuRef.current?.contains(e.target)) setShowChronoNotesPresets(false); }
    function closeChrono(e) { if (!chronoMenuRef.current?.contains(e.target)) setShowChronoPresets(false); }
  }, []);

  const background = meta.get('background') || '';
  useEffect(() => { autoGrow(bgRef.current); }, [background]);
  const chronoNotes = meta.get('chronoNotes') || '';
  useEffect(() => { autoGrow(chronoNotesRef.current); }, [chronoNotes]);
  useEffect(() => {
    if (chronoFocusId.current && chronoRefs.current[chronoFocusId.current]) {
      chronoRefs.current[chronoFocusId.current].focus();
      chronoFocusId.current = null;
    }
  });

  const chronoRows = [...chrono.entries()]
    .map(([id, m]) => ({ id, date: m.get('date') || today(), time: m.get('time') || nowTime(), text: m.get('text') || '', ord: m.get('ord') || 0 }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.ord - b.ord || a.id.localeCompare(b.id));
  const allLines = [...lines.entries()].map(([id, m]) => ({ id, section: m.get('section'), ord: m.get('ord') || 0, text: m.get('text') || '', taskId: m.get('taskId') || null }));
  const bySection = (s) => allLines.filter((l) => l.section === s).sort((a, b) => a.ord - b.ord || a.id.localeCompare(b.id));
  const taskRows = [...tasks.entries()]
    .map(([id, t]) => ({ id, ord: t.get('ord') || 0, title: t.get('title') || '', desc: t.get('desc') || '', status: t.get('status') || 'new', priority: t.get('priority') || 1, assignee: t.get('assignee') || '', due: t.get('due') || '', dueCurrent: t.get('dueCurrent') || '', log: t.get('log') || [] }))
    .sort((a, b) => b.ord - a.ord || a.id.localeCompare(b.id));
  const taskIdSet = new Set(taskRows.map((t) => t.id));

  function addChrono(presetText = '') {
    const id = uid(), m = new Y.Map();
    const maxOrd = Math.max(0, ...chronoRows.map((x) => x.ord));
    ydoc.transact(() => { m.set('date', today()); m.set('time', nowTime()); m.set('text', presetText); m.set('ord', maxOrd + 1); chrono.set(id, m); });
    return id;
  }
  // A preset click reuses an already-open empty row (by creation order, since chronoRows is
  // sorted by date/time) instead of leaving it stranded and opening a second one.
  function doAddChrono(presetText = '') {
    if (presetText) {
      const empties = chronoRows.filter((r) => !r.text);
      if (empties.length) {
        const mostRecent = empties.reduce((a, b) => (b.ord > a.ord ? b : a));
        chrono.get(mostRecent.id)?.set('text', presetText);
        return mostRecent.id;
      }
    }
    return addChrono(presetText);
  }
  function delChrono(r) {
    if (r.text && !confirm(`למחוק את הרשומה "${r.text}"?`)) return;
    chrono.delete(r.id);
  }
  // לקחים/סיכום lines auto-create (and stay in sync with, and get deleted alongside) a linked
  // task — see SECTIONS' taskLinked/taskLabel and TASK_LABEL above. The link can also be
  // toggled off/on per line (toggleLineTask) for the rare case someone wants a lesson or
  // recommendation without a task.
  function createLinkedTask(label, text) {
    const taskId = uid(), t = new Y.Map();
    const maxTaskOrd = Math.max(0, ...taskRows.map((x) => x.ord));
    t.set('ord', maxTaskOrd + 1); t.set('title', label); t.set('desc', text);
    t.set('status', 'new'); t.set('priority', 1); t.set('due', ''); t.set('dueCurrent', '');
    t.set('assignee', ''); t.set('log', []);
    tasks.set(taskId, t);
    return taskId;
  }
  function addLine(sec, presetText = '') {
    const id = uid(), m = new Y.Map();
    const rows = bySection(sec);
    const maxOrd = Math.max(0, ...rows.map((x) => x.ord));
    const label = TASK_LABEL[sec];
    ydoc.transact(() => {
      m.set('section', sec); m.set('ord', maxOrd + 1); m.set('text', presetText);
      if (label) m.set('taskId', createLinkedTask(label, presetText));
      lines.set(id, m);
    });
    return id;
  }
  function delLine(id) {
    const m = lines.get(id);
    const taskId = m?.get('taskId');
    ydoc.transact(() => {
      lines.delete(id);
      if (taskId) tasks.delete(taskId);
    });
  }
  function toggleLineTask(id) {
    const m = lines.get(id);
    const label = m && TASK_LABEL[m.get('section')];
    if (!label) return;
    const existingTaskId = m.get('taskId');
    ydoc.transact(() => {
      if (existingTaskId && tasks.get(existingTaskId)) {
        tasks.delete(existingTaskId);
        m.set('taskId', null);
      } else {
        m.set('taskId', createLinkedTask(label, m.get('text') || ''));
      }
    });
  }
  function editLine(id, text) {
    const m = lines.get(id);
    if (!m) return;
    ydoc.transact(() => {
      m.set('text', text);
      const taskId = m.get('taskId');
      if (taskId) tasks.get(taskId)?.set('desc', text);
    });
  }

  // ---- exports ----
  function fmtLines(sec, num) {
    const rows = bySection(sec);
    return rows.length ? rows.map((r, i) => `- ${num}.${i + 1} ${r.text}`).join('\n') + '\n' : '(אין שורות)\n';
  }
  const exportTxt = () => {
    let out = `תחקיר: ${title || 'ללא שם'}\n\n`;
    out += `רקע:\n${background}\n\n`;
    out += `פירוט וזמנים:\n`;
    out += chronoNotes ? chronoNotes + '\n\n' : '';
    out += chronoRows.length ? chronoRows.map((r) => `${r.date} ${r.time} | ${r.text}`).join('\n') + '\n' : '(אין רשומות)\n';
    out += `\nממצאים:\n${fmtLines('findings', 3)}`;
    out += `\nלקחים:\n${fmtLines('lessons', 4)}`;
    out += `\nסיכום ומסקנות:\n${fmtLines('summary', 5)}`;
    download(out, `${title || 'תחקיר'}.txt`);
  };
  const exportChronoCsv = () => download(
    [csvEscape('תאריך') + ',' + csvEscape('שעה') + ',' + csvEscape('פירוט'),
      ...chronoRows.map((r) => csvEscape(r.date) + ',' + csvEscape(r.time) + ',' + csvEscape(r.text))].join('\r\n') + '\r\n',
    `${title || 'תחקיר'} - פירוט וזמנים.csv`, 'text/csv;charset=utf-8');
  const exportTasksCsv = () => download(
    [csvEscape('כותרת') + ',' + csvEscape('תיאור') + ',' + csvEscape('סטטוס') + ',' + csvEscape('עדיפות') + ',' + csvEscape('אחראי') + ',' + csvEscape('תאריך יעד') + ',' + csvEscape('יעד עדכני') + ',' + csvEscape('היסטוריית עדכונים'),
      ...taskRows.map((t) => [t.title, t.desc, TK_STATUS[t.status], TK_PRIORITY[t.priority], t.assignee, t.due, t.dueCurrent, logCellOut(t.log)].map(csvEscape).join(','))].join('\r\n') + '\r\n',
    `${title || 'תחקיר'} - משימות.csv`, 'text/csv;charset=utf-8');
  async function exportWord() {
    const chronoNotesHtml = chronoNotes ? chronoNotes.split('\n').map((l) => `<p>${esc(l) || '&nbsp;'}</p>`).join('') : '';
    const chronoTableHtml = chronoRows.length
      ? `<table><tr><th>תאריך</th><th>שעה</th><th>פירוט</th></tr>${chronoRows.map((r) => `<tr><td>${esc(fmtDate(r.date))}</td><td>${esc(r.time)}</td><td>${esc(r.text)}</td></tr>`).join('')}</table>`
      : '<p>(אין רשומות)</p>';
    const chronoHtml = chronoNotesHtml + chronoTableHtml;
    const linesHtml = (sec, num) => {
      const rows = bySection(sec);
      return rows.length ? `<ul>${rows.map((r, i) => `<li>${num}.${i + 1} ${esc(r.text)}</li>`).join('')}</ul>` : '<p>(אין שורות)</p>';
    };
    const logHtmlOut = (log) => (log || []).map((l) => {
      const bits = [fmtDate(new Date(l.at).toISOString().slice(0, 10)), l.by].filter(Boolean);
      if (l.from !== l.to) bits.push(`${TK_STATUS[l.from] || l.from}→${TK_STATUS[l.to] || l.to}`);
      if (l.note) bits.push(l.note);
      return esc(bits.join(' · '));
    }).join('<br>');
    const tasksHtml = taskRows.length
      ? `<table><tr><th>כותרת</th><th>תיאור</th><th>סטטוס</th><th>עדיפות</th><th>אחראי</th><th>תאריך יעד</th><th>יעד עדכני</th><th>היסטוריית עדכונים</th></tr>${taskRows.map((t) => `<tr><td>${esc(t.title)}</td><td>${esc(t.desc)}</td><td>${esc(TK_STATUS[t.status])}</td><td>${esc(TK_PRIORITY[t.priority])}</td><td>${esc(t.assignee)}</td><td>${esc(fmtDate(t.due))}</td><td>${esc(fmtDate(t.dueCurrent))}</td><td>${logHtmlOut(t.log) || '—'}</td></tr>`).join('')}</table>`
      : '<p>(אין משימות)</p>';
    const bgHtml = background.split('\n').map((l) => `<p>${esc(l) || '&nbsp;'}</p>`).join('') || '<p>(אין תוכן)</p>';
    const body = `<h1>${esc(title || 'תחקיר ללא שם')}</h1>` +
      `<h2>1. רקע</h2>${bgHtml}` +
      `<h2>2. פירוט וזמנים</h2>${chronoHtml}` +
      `<h2>3. ממצאים</h2>${linesHtml('findings', 3)}` +
      `<h2>4. לקחים</h2>${linesHtml('lessons', 4)}` +
      `<h2>5. סיכום ומסקנות</h2>${linesHtml('summary', 5)}` +
      `<h2>6. משימות</h2>${tasksHtml}`;
    await exportDocxHtml(body, title || 'תחקיר');
  }
  async function importTxt(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const rawLines = (await f.text()).split(/\r?\n/);
    let section = null;
    const bg = [];
    const chronoNotesLines = [];
    const parsedChrono = [];
    const parsedLines = { findings: [], lessons: [], summary: [] };
    for (const line of rawLines) {
      if (line.startsWith('רקע:')) { section = 'background'; continue; }
      // "כרונולוגיה:" is the old marker (pre free-text-notes) — still accepted so older exports reload fine
      if (line.startsWith('פירוט וזמנים:') || line.startsWith('כרונולוגיה:')) { section = 'chrono'; continue; }
      if (line.startsWith('ממצאים:')) { section = 'findings'; continue; }
      if (line.startsWith('לקחים:')) { section = 'lessons'; continue; }
      if (line.startsWith('סיכום ומסקנות:')) { section = 'summary'; continue; }
      if (section === 'background') { bg.push(line); continue; }
      if (section === 'chrono') {
        const m = line.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s*\|\s*(.*)$/);
        if (m) parsedChrono.push({ date: m[1], time: m[2], text: m[3] });
        else if (line !== '(אין רשומות)') chronoNotesLines.push(line);
        continue;
      }
      if (section === 'findings' || section === 'lessons' || section === 'summary') {
        const m = line.match(/^-\s*(?:\d+\.\d+\s+)?(.+)/);
        if (m) parsedLines[section].push(m[1]);
      }
    }
    const bgText = bg.join('\n').trim();
    const chronoNotesText = chronoNotesLines.join('\n').trim();
    const total = parsedChrono.length + Object.values(parsedLines).flat().length;
    if (!bgText && !chronoNotesText && !total) return alert('לא נמצא תוכן תקין בקובץ (פורמט: זה שיוצא מהמערכת בלבד)');
    if ((chrono.size || lines.size || background || chronoNotes) && !confirm('הטעינה תחליף את התחקיר הנוכחי (למעט המשימות). להמשיך?')) return;
    ydoc.transact(() => {
      meta.set('background', bgText);
      meta.set('chronoNotes', chronoNotesText);
      [...chrono.keys()].forEach((k) => chrono.delete(k));
      [...lines.keys()].forEach((k) => lines.delete(k));
      parsedChrono.forEach((c, i) => { const m = new Y.Map(); m.set('date', c.date); m.set('time', c.time); m.set('text', c.text); m.set('ord', i + 1); chrono.set(uid(), m); });
      Object.entries(parsedLines).forEach(([sec, rows]) => rows.forEach((text, i) => {
        const m = new Y.Map(); m.set('section', sec); m.set('text', text); m.set('ord', i + 1);
        const label = TASK_LABEL[sec];
        if (label) {
          const taskId = uid(), t = new Y.Map();
          t.set('ord', i + 1); t.set('title', label); t.set('desc', text);
          t.set('status', 'new'); t.set('priority', 1); t.set('due', ''); t.set('dueCurrent', '');
          t.set('assignee', ''); t.set('log', []);
          tasks.set(taskId, t);
          m.set('taskId', taskId);
        }
        lines.set(uid(), m);
      }));
    });
  }

  return (
    <div className="doc-page">
      <header className="topbar">
        <Link to="/" className="logo-sm" title="חזרה לדף הבית"><Logo size={22} /><span className="logo-word">טורבו</span></Link>
        <input className="title-input" title={title || undefined} placeholder="תחקיר ללא שם" value={title} readOnly={!editable}
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
          </>}
          <Menu label="הורדה">
            <button onClick={exportWord}>Word ‏(.docx) — הכל</button>
            <button onClick={exportChronoCsv}>פירוט וזמנים — CSV</button>
            <button onClick={exportTasksCsv}>משימות — CSV</button>
            <button onClick={exportTxt}>TXT — לטעינה חוזרת</button>
          </Menu>
          <ShareMenu info={info} />
          <ThemeToggle />
        </div>
      </header>
      <div className="db-page">
        <section className="db-sec">
          <div className="db-sec-head"><span className="db-chnum">1.</span><h2 className="db-sec-title">רקע</h2></div>
          {editable ? (
            <textarea ref={bgRef} className="db-bg" placeholder="רקע חופשי לתחקיר…" value={background} rows={3}
              onChange={(e) => meta.set('background', e.target.value)} />
          ) : (
            <p className="db-bg-ro">{background || '—'}</p>
          )}
          {editable && (
            <div className="sw-add-row" ref={bgMenuRef}>
              <button className="btn sw-add" onClick={() => setShowBgPresets((v) => !v)}>הצעות ✦</button>
              {showBgPresets && (
                <div className="menu-items sw-presets">
                  {PRESETS.background.map((p) => (
                    <button key={p} onClick={() => { meta.set('background', background ? background + '\n' + p : p); setShowBgPresets(false); bgRef.current?.focus(); }}>{p}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="db-sec">
          <div className="db-sec-head">
            <span className="db-chnum">2.</span>
            <h2 className="db-sec-title">פירוט וזמנים</h2>
          </div>
          {editable ? (
            <textarea ref={chronoNotesRef} className="db-bg" placeholder="פירוט חופשי — ניסוח האירוע, העמקה במקרה…" rows={3}
              value={chronoNotes} onChange={(e) => meta.set('chronoNotes', e.target.value)} />
          ) : (
            <p className="db-bg-ro">{chronoNotes || '—'}</p>
          )}
          {editable && (
            <div className="sw-add-row" ref={chronoNotesMenuRef}>
              <button className="btn sw-add" onClick={() => setShowChronoNotesPresets((v) => !v)}>הצעות ✦</button>
              {showChronoNotesPresets && (
                <div className="menu-items sw-presets">
                  {PRESETS.chronoDetails.map((p) => (
                    <button key={p} onClick={() => {
                      meta.set('chronoNotes', chronoNotes ? chronoNotes + '\n' + p : p);
                      setShowChronoNotesPresets(false); chronoNotesRef.current?.focus();
                    }}>{p}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="db-chrono db-chrono-timeline">
            <div className="db-hint db-chrono-timeline-hint">ציר זמן — תאריך ושעה נרשמים אוטומטית בפתיחת שורה, ניתנים לשינוי</div>
            <div className="db-chrono-head"><span>תאריך</span><span>שעה</span><span>פירוט</span></div>
            <div className="db-chrono-rows">
              {chronoRows.map((r, i) => (
                <div key={r.id} className="db-chrono-row">
                  <span className="db-num">2.{i + 1}</span>
                  {editable ? (
                    <>
                      <input type="date" className="db-chrono-date" value={r.date}
                        onChange={(e) => e.target.value && chrono.get(r.id)?.set('date', e.target.value)} />
                      <input type="time" step="1" className="db-chrono-time" value={r.time}
                        onChange={(e) => e.target.value && chrono.get(r.id)?.set('time', e.target.value)} />
                      <GrowingField className="db-chrono-text" value={r.text} placeholder="פירוט האירוע…"
                        registerRef={(el) => { if (el) chronoRefs.current[r.id] = el; else delete chronoRefs.current[r.id]; }}
                        onChange={(e) => chrono.get(r.id)?.set('text', e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); chronoFocusId.current = addChrono(); } }} />
                      <button className="sw-del" onClick={() => delChrono(r)}>✕</button>
                    </>
                  ) : (
                    <>
                      <span className="db-chrono-date-ro">{fmtDate(r.date)}</span>
                      <span className="db-chrono-time-ro">{r.time}</span>
                      <span className="db-chrono-text-ro">{r.text || '—'}</span>
                    </>
                  )}
                </div>
              ))}
              {!chronoRows.length && <div className="sw-empty">אין עדיין רשומות</div>}
            </div>
          </div>
          {editable && (
            <div className="sw-add-row" ref={chronoMenuRef}>
              <button className="btn sw-add" onClick={() => { chronoFocusId.current = addChrono(); }}>+ שורה</button>
              <button className="btn sw-add" onClick={() => setShowChronoPresets((v) => !v)}>הצעות ✦</button>
              {showChronoPresets && (
                <div className="menu-items sw-presets">
                  {PRESETS.chronology.map((p) => (
                    <button key={p} onClick={() => { chronoFocusId.current = doAddChrono(p); setShowChronoPresets(false); }}>{p}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <LineSection sec={SECTIONS[0]} items={bySection('findings')} editable={editable} add={addLine} del={delLine} edit={editLine} taskIdSet={taskIdSet} />
        <LineSection sec={SECTIONS[1]} items={bySection('lessons')} editable={editable} add={addLine} del={delLine} edit={editLine} toggleTask={toggleLineTask} taskIdSet={taskIdSet} />
        <LineSection sec={SECTIONS[2]} items={bySection('summary')} editable={editable} add={addLine} del={delLine} edit={editLine} toggleTask={toggleLineTask} taskIdSet={taskIdSet} />

        <section className="db-sec db-sec-wide">
          <div className="db-sec-head">
            <span className="db-chnum">6.</span>
            <h2 className="db-sec-title">משימות</h2>
            <span className="db-hint">נוצרות אוטומטית מלקחים/המלצות (☑ משימה), וניתן להוסיף עוד באופן חופשי</span>
          </div>
          <Tasks info={info} user={user} token={token} embed={{ ydoc, map: tasks, editable }} />
        </section>
      </div>
    </div>
  );
}
