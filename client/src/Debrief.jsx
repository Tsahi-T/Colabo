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
const SECTIONS = [
  { k: 'findings', num: 3, title: 'ממצאים', hint: 'שורת טקסט חדשה בכל פלוס או Enter' },
  { k: 'lessons', num: 4, title: 'לקחים', hint: 'שורת טקסט חדשה בכל פלוס או Enter · אפשר להפוך לקח למשימה' },
  { k: 'summary', num: 6, title: 'סיכום ומסקנות', hint: 'שורות מצטרפות בתחתית' },
];
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

// A growing single-line-turned-multiline field, used for the chronology "details" column —
// a plain <input> hides overflow text past its width; this expands downward instead.
function GrowingField({ value, onChange, onKeyDown, registerRef, placeholder }) {
  const ref = useRef();
  useEffect(() => { autoGrow(ref.current); }, [value]);
  return (
    <textarea
      ref={(el) => { ref.current = el; registerRef?.(el); }}
      className="db-chrono-text" rows={1} placeholder={placeholder}
      value={value} onChange={onChange} onKeyDown={onKeyDown}
    />
  );
}

// A single growing list of text lines (ממצאים / לקחים / סיכום) — mirrors the SWOT quadrant UX:
// "+ שורה" or Enter inside a line both open the next one, and a preset menu offers ready phrases.
// Each item is numbered "<chapter>.<item>" to match the document's chapter/clause numbering.
function LineSection({ sec, items, editable, add, del, edit, onTaskify }) {
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
    focusId.current = add(sec.k, presetText);
  }
  return (
    <section className="db-sec">
      <div className="db-sec-head">
        <h2 className="db-sec-title">{sec.num}. {sec.title}</h2>
        {sec.hint && <span className="db-hint">{sec.hint}</span>}
      </div>
      <div className="sw-lines">
        {items.map((it, i) => (
          <div key={it.id} className="sw-line">
            <span className="db-num">{sec.num}.{i + 1}</span>
            {editable ? (
              <input
                ref={(el) => { if (el) inputRefs.current[it.id] = el; else delete inputRefs.current[it.id]; }}
                value={it.text} placeholder="הקלדה חופשית…"
                onChange={(e) => edit(it.id, e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } }}
              />
            ) : (
              <span className="sw-text">{it.text || '—'}</span>
            )}
            {editable && onTaskify && (
              <button className="db-taskify" title="יצירת משימה למימוש לקח זה" onClick={() => onTaskify(it.text)}>☑ משימה</button>
            )}
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
  const bgRef = useRef();
  const bgMenuRef = useRef();
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
    document.addEventListener('mousedown', closeChrono);
    return () => {
      document.removeEventListener('mousedown', closeBg);
      document.removeEventListener('mousedown', closeChrono);
    };
    function closeBg(e) { if (!bgMenuRef.current?.contains(e.target)) setShowBgPresets(false); }
    function closeChrono(e) { if (!chronoMenuRef.current?.contains(e.target)) setShowChronoPresets(false); }
  }, []);

  const background = meta.get('background') || '';
  useEffect(() => { autoGrow(bgRef.current); }, [background]);
  useEffect(() => {
    if (chronoFocusId.current && chronoRefs.current[chronoFocusId.current]) {
      chronoRefs.current[chronoFocusId.current].focus();
      chronoFocusId.current = null;
    }
  });

  const chronoRows = [...chrono.entries()]
    .map(([id, m]) => ({ id, date: m.get('date') || today(), time: m.get('time') || nowTime(), text: m.get('text') || '', ord: m.get('ord') || 0 }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.ord - b.ord || a.id.localeCompare(b.id));
  const allLines = [...lines.entries()].map(([id, m]) => ({ id, section: m.get('section'), ord: m.get('ord') || 0, text: m.get('text') || '' }));
  const bySection = (s) => allLines.filter((l) => l.section === s).sort((a, b) => a.ord - b.ord || a.id.localeCompare(b.id));
  const taskRows = [...tasks.entries()]
    .map(([id, t]) => ({ id, ord: t.get('ord') || 0, title: t.get('title') || '', status: t.get('status') || 'new', priority: t.get('priority') || 1, assignee: t.get('assignee') || '', due: t.get('due') || '', dueCurrent: t.get('dueCurrent') || '' }))
    .sort((a, b) => b.ord - a.ord || a.id.localeCompare(b.id));

  function addChrono(presetText = '') {
    const id = uid(), m = new Y.Map();
    const maxOrd = Math.max(0, ...chronoRows.map((x) => x.ord));
    ydoc.transact(() => { m.set('date', today()); m.set('time', nowTime()); m.set('text', presetText); m.set('ord', maxOrd + 1); chrono.set(id, m); });
    return id;
  }
  function delChrono(r) {
    if (r.text && !confirm(`למחוק את הרשומה "${r.text}"?`)) return;
    chrono.delete(r.id);
  }
  function addLine(sec, presetText = '') {
    const id = uid(), m = new Y.Map();
    const rows = bySection(sec);
    const maxOrd = Math.max(0, ...rows.map((x) => x.ord));
    ydoc.transact(() => { m.set('section', sec); m.set('ord', maxOrd + 1); m.set('text', presetText); lines.set(id, m); });
    return id;
  }
  const delLine = (id) => lines.delete(id);
  const editLine = (id, text) => lines.get(id)?.set('text', text);

  function addTaskFromLesson(lessonText) {
    const id = uid(), t = new Y.Map();
    const maxOrd = Math.max(0, ...taskRows.map((x) => x.ord));
    ydoc.transact(() => {
      t.set('ord', maxOrd + 1); t.set('title', `משימה למימוש לקח - ${lessonText}`); t.set('desc', '');
      t.set('status', 'new'); t.set('priority', 1); t.set('due', ''); t.set('dueCurrent', '');
      t.set('assignee', ''); t.set('log', []);
      tasks.set(id, t);
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
    out += `כרונולוגיה:\n`;
    out += chronoRows.length ? chronoRows.map((r) => `${r.date} ${r.time} | ${r.text}`).join('\n') + '\n' : '(אין רשומות)\n';
    out += `\nממצאים:\n${fmtLines('findings', 3)}`;
    out += `\nלקחים:\n${fmtLines('lessons', 4)}`;
    out += `\nסיכום ומסקנות:\n${fmtLines('summary', 6)}`;
    download(out, `${title || 'תחקיר'}.txt`);
  };
  const exportChronoCsv = () => download(
    [csvEscape('תאריך') + ',' + csvEscape('שעה') + ',' + csvEscape('פירוט'),
      ...chronoRows.map((r) => csvEscape(r.date) + ',' + csvEscape(r.time) + ',' + csvEscape(r.text))].join('\r\n') + '\r\n',
    `${title || 'תחקיר'} - כרונולוגיה.csv`, 'text/csv;charset=utf-8');
  const exportTasksCsv = () => download(
    [csvEscape('כותרת') + ',' + csvEscape('סטטוס') + ',' + csvEscape('עדיפות') + ',' + csvEscape('אחראי') + ',' + csvEscape('תאריך יעד'),
      ...taskRows.map((t) => [t.title, TK_STATUS[t.status], TK_PRIORITY[t.priority], t.assignee, t.dueCurrent || t.due].map(csvEscape).join(','))].join('\r\n') + '\r\n',
    `${title || 'תחקיר'} - משימות.csv`, 'text/csv;charset=utf-8');
  async function exportWord() {
    const chronoHtml = chronoRows.length
      ? `<table><tr><th>תאריך</th><th>שעה</th><th>פירוט</th></tr>${chronoRows.map((r) => `<tr><td>${esc(fmtDate(r.date))}</td><td>${esc(r.time)}</td><td>${esc(r.text)}</td></tr>`).join('')}</table>`
      : '<p>(אין רשומות)</p>';
    const linesHtml = (sec, num) => {
      const rows = bySection(sec);
      return rows.length ? `<ul>${rows.map((r, i) => `<li>${num}.${i + 1} ${esc(r.text)}</li>`).join('')}</ul>` : '<p>(אין שורות)</p>';
    };
    const tasksHtml = taskRows.length
      ? `<table><tr><th>כותרת</th><th>סטטוס</th><th>עדיפות</th><th>אחראי</th><th>תאריך יעד</th></tr>${taskRows.map((t) => `<tr><td>${esc(t.title)}</td><td>${esc(TK_STATUS[t.status])}</td><td>${esc(TK_PRIORITY[t.priority])}</td><td>${esc(t.assignee)}</td><td>${esc(fmtDate(t.dueCurrent || t.due))}</td></tr>`).join('')}</table>`
      : '<p>(אין משימות)</p>';
    const bgHtml = background.split('\n').map((l) => `<p>${esc(l) || '&nbsp;'}</p>`).join('') || '<p>(אין תוכן)</p>';
    const body = `<h1>${esc(title || 'תחקיר ללא שם')}</h1>` +
      `<h2>1. רקע</h2>${bgHtml}` +
      `<h2>2. כרונולוגיה</h2>${chronoHtml}` +
      `<h2>3. ממצאים</h2>${linesHtml('findings', 3)}` +
      `<h2>4. לקחים</h2>${linesHtml('lessons', 4)}` +
      `<h2>5. משימות</h2>${tasksHtml}` +
      `<h2>6. סיכום ומסקנות</h2>${linesHtml('summary', 6)}`;
    await exportDocxHtml(body, title || 'תחקיר');
  }
  async function importTxt(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const rawLines = (await f.text()).split(/\r?\n/);
    let section = null;
    const bg = [];
    const parsedChrono = [];
    const parsedLines = { findings: [], lessons: [], summary: [] };
    for (const line of rawLines) {
      if (line.startsWith('רקע:')) { section = 'background'; continue; }
      if (line.startsWith('כרונולוגיה:')) { section = 'chrono'; continue; }
      if (line.startsWith('ממצאים:')) { section = 'findings'; continue; }
      if (line.startsWith('לקחים:')) { section = 'lessons'; continue; }
      if (line.startsWith('סיכום ומסקנות:')) { section = 'summary'; continue; }
      if (section === 'background') { bg.push(line); continue; }
      if (section === 'chrono') {
        const m = line.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s*\|\s*(.*)$/);
        if (m) parsedChrono.push({ date: m[1], time: m[2], text: m[3] });
        continue;
      }
      if (section === 'findings' || section === 'lessons' || section === 'summary') {
        const m = line.match(/^-\s*(?:\d+\.\d+\s+)?(.+)/);
        if (m) parsedLines[section].push(m[1]);
      }
    }
    const bgText = bg.join('\n').trim();
    const total = parsedChrono.length + Object.values(parsedLines).flat().length;
    if (!bgText && !total) return alert('לא נמצא תוכן תקין בקובץ (פורמט: זה שיוצא מהמערכת בלבד)');
    if ((chrono.size || lines.size || background) && !confirm('הטעינה תחליף את התחקיר הנוכחי (למעט המשימות). להמשיך?')) return;
    ydoc.transact(() => {
      meta.set('background', bgText);
      [...chrono.keys()].forEach((k) => chrono.delete(k));
      [...lines.keys()].forEach((k) => lines.delete(k));
      parsedChrono.forEach((c, i) => { const m = new Y.Map(); m.set('date', c.date); m.set('time', c.time); m.set('text', c.text); m.set('ord', i + 1); chrono.set(uid(), m); });
      Object.entries(parsedLines).forEach(([sec, rows]) => rows.forEach((text, i) => {
        const m = new Y.Map(); m.set('section', sec); m.set('text', text); m.set('ord', i + 1); lines.set(uid(), m);
      }));
    });
  }

  return (
    <div className="doc-page">
      <header className="topbar">
        <Link to="/" className="logo-sm" title="חזרה לדף הבית"><Logo size={22} /><span className="logo-word">טורבו</span></Link>
        <input className="title-input" placeholder="תחקיר ללא שם" value={title} readOnly={!editable}
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
            <button onClick={exportChronoCsv}>כרונולוגיה — CSV</button>
            <button onClick={exportTasksCsv}>משימות — CSV</button>
            <button onClick={exportTxt}>TXT — לטעינה חוזרת</button>
          </Menu>
          <ShareMenu info={info} />
          <ThemeToggle />
        </div>
      </header>
      <div className="db-page">
        <section className="db-sec">
          <div className="db-sec-head"><h2 className="db-sec-title">1. רקע</h2></div>
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
            <h2 className="db-sec-title">2. כרונולוגיה</h2>
            <span className="db-hint">תאריך ושעה נרשמים אוטומטית בפתיחת שורה, ניתנים לשינוי</span>
          </div>
          <div className="db-chrono">
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
                      <GrowingField value={r.text} placeholder="פירוט האירוע…"
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
                    <button key={p} onClick={() => { chronoFocusId.current = addChrono(p); setShowChronoPresets(false); }}>{p}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <LineSection sec={SECTIONS[0]} items={bySection('findings')} editable={editable} add={addLine} del={delLine} edit={editLine} />
        <LineSection sec={SECTIONS[1]} items={bySection('lessons')} editable={editable} add={addLine} del={delLine} edit={editLine} onTaskify={addTaskFromLesson} />

        <section className="db-sec db-sec-wide">
          <div className="db-sec-head">
            <h2 className="db-sec-title">5. משימות</h2>
            <span className="db-hint">נוצרות אוטומטית מלקחים (☑ משימה), וניתן להוסיף עוד באופן חופשי</span>
          </div>
          <Tasks info={info} user={user} token={token} embed={{ ydoc, map: tasks, editable }} />
        </section>

        <LineSection sec={SECTIONS[2]} items={bySection('summary')} editable={editable} add={addLine} del={delLine} edit={editLine} />
      </div>
    </div>
  );
}
