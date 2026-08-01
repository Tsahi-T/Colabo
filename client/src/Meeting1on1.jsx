import { useEffect, useMemo, useState, useReducer, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { ShareMenu, Menu } from './ShareExport.jsx';
import { ThemeToggle } from './theme.jsx';
import { Logo } from './icons.jsx';
import { PRESETS } from './meeting1on1-presets.js';
import { touchRecent } from './identity.js';
import { exportDocxHtml } from './export.js';
import Tasks from './Tasks.jsx';

const uid = () => crypto.randomUUID().slice(0, 8);
const fmtDate = (iso) => (iso ? new Date(iso + 'T00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const TK_STATUS = { new: 'חדש', in_progress: 'בעבודה', waiting: 'ממתין לאחר / בפער', done: 'בוצע' };
const TK_PRIORITY = { 1: 'רגילה', 2: 'גבוהה', 3: 'דחוף' };
function logCellOut(log) {
  return (log || []).map((l) => {
    const parts = [new Date(l.at || Date.now()).toISOString(), l.by || ''];
    if (l.from !== l.to) parts.push(`${TK_STATUS[l.from] || l.from}→${TK_STATUS[l.to] || l.to}`);
    if (l.note) parts.push(l.note);
    return parts.join(' | ');
  }).join('\n');
}
function logCellIn(cell) {
  if (!cell) return [];
  return cell.split('\n').filter((line) => line.trim()).map((line) => {
    const parts = line.split(' | ');
    const at = new Date(parts[0]).getTime() || Date.now();
    const by = parts[1] || '';
    let from = 'new', to = 'new', note = '';
    parts.slice(2).forEach((p) => {
      const m = p.match(/^(.+)→(.+)$/);
      if (m) { from = byLabel(TK_STATUS, m[1].trim(), 'new'); to = byLabel(TK_STATUS, m[2].trim(), 'new'); }
      else note = p;
    });
    return { at, by, from, to, note };
  });
}
const byLabel = (obj, val, fallback) => Object.keys(obj).find((k) => obj[k] === val) || fallback;
const csvEscape = (s) => { s = String(s ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csvRow = (arr) => arr.map(csvEscape).join(',');
function parseCsv(text) {
  const rows = []; let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = ''; rows.push(row); row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ''));
}
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

const SECTIONS = [
  { k: 'background', num: 2, title: 'רקע', hint: 'שורת טקסט חדשה בכל פלוס או Enter' },
  { k: 'goals', num: 4, title: 'יעדים אישיים', hint: 'שורת טקסט חדשה בכל פלוס או Enter' },
];
// The four "דברי הפרט" categories — plain growing lists, no numbering per item and no
// presets (unlike SECTIONS above); nested inside one db-sec card instead of being their own
// top-level numbered chapter.
const DETAIL_CATS = [
  { k: 'hobbies', sub: '3.1', title: 'תחביבים' },
  { k: 'needs', sub: '3.2', title: 'צרכים מיוחדים' },
  { k: 'issues', sub: '3.3', title: 'סוגיות אישיות' },
  { k: 'requests', sub: '3.4', title: 'בקשות' },
];

function LineSection({ sec, items, editable, add, del, edit }) {
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
            {editable && <button className="sw-del" onClick={() => del(it.id)}>✕</button>}
          </div>
        ))}
        {!items.length && <div className="sw-empty">אין עדיין שורות</div>}
      </div>
      {editable && (
        <div className="sw-add-row" ref={ref}>
          <button className="btn sw-add" onClick={() => doAdd()}>+ שורה</button>
          {PRESETS[sec.k] && <button className="btn sw-add" onClick={() => setShowPresets((v) => !v)}>הצעות ✦</button>}
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

function DetailList({ cat, items, editable, add, del, edit }) {
  const inputRefs = useRef({});
  const focusId = useRef(null);
  useEffect(() => {
    if (focusId.current && inputRefs.current[focusId.current]) {
      inputRefs.current[focusId.current].focus();
      focusId.current = null;
    }
  });
  function doAdd() { focusId.current = add(cat.k); }
  return (
    <div className="db-subsec">
      <div className="db-subsec-head"><span className="db-chnum-sub">{cat.sub}</span><h3 className="db-subsec-title">{cat.title}</h3></div>
      <div className="sw-lines">
        {items.map((it) => (
          <div key={it.id} className="sw-line db-line">
            {editable ? (
              <GrowingField className="sw-grow" value={it.text} placeholder="הקלדה חופשית…"
                registerRef={(el) => { if (el) inputRefs.current[it.id] = el; else delete inputRefs.current[it.id]; }}
                onChange={(e) => edit(it.id, e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } }}
              />
            ) : (
              <span className="sw-text">{it.text || '—'}</span>
            )}
            {editable && <button className="sw-del" onClick={() => del(it.id)}>✕</button>}
          </div>
        ))}
        {!items.length && <div className="sw-empty">אין עדיין שורות</div>}
      </div>
      {editable && <button className="btn sw-add" onClick={doAdd}>+ שורה</button>}
    </div>
  );
}

export default function Meeting1on1({ info, user, token }) {
  const editable = info.mode === 'edit';
  const [, force] = useReducer((c) => c + 1, 0);
  const [status, setStatus] = useState('connecting');
  const [title, setTitle] = useState('');
  const [peers, setPeers] = useState([]);
  const fileRef = useRef();

  const ydoc = useMemo(() => new Y.Doc(), []);
  const meta = ydoc.getMap('meta');
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

  useEffect(() => { touchRecent(token, title, info.mode, 'meeting1on1'); }, [title]);

  const personName = meta.get('personName') || '';
  const meetingDate = meta.get('meetingDate') || '';
  const closing = meta.get('closing') || '';
  const signerName = meta.get('signerName') || '';

  const allLines = [...lines.entries()].map(([id, m]) => ({ id, section: m.get('section'), ord: m.get('ord') || 0, text: m.get('text') || '' }));
  const bySection = (s) => allLines.filter((l) => l.section === s).sort((a, b) => a.ord - b.ord || a.id.localeCompare(b.id));
  const taskRows = [...tasks.entries()]
    .map(([id, t]) => ({ id, ord: t.get('ord') || 0, title: t.get('title') || '', desc: t.get('desc') || '', status: t.get('status') || 'new', priority: t.get('priority') || 1, assignee: t.get('assignee') || '', due: t.get('due') || '', dueCurrent: t.get('dueCurrent') || '', log: t.get('log') || [] }))
    .sort((a, b) => b.ord - a.ord || a.id.localeCompare(b.id));

  function addLine(sec, presetText = '') {
    const id = uid(), m = new Y.Map();
    const rows = bySection(sec);
    const maxOrd = Math.max(0, ...rows.map((x) => x.ord));
    m.set('section', sec); m.set('ord', maxOrd + 1); m.set('text', presetText);
    lines.set(id, m);
    return id;
  }
  function delLine(id) { lines.delete(id); }
  function editLine(id, text) { lines.get(id)?.set('text', text); }

  // ---- exports ----
  const exportCsv = () => {
    const rows = [
      ['כותרת', title],
      ['שם', personName],
      ['תאריך', meetingDate],
      ...bySection('background').map((r) => ['רקע', r.text]),
      ...bySection('hobbies').map((r) => ['תחביב', r.text]),
      ...bySection('needs').map((r) => ['צורך מיוחד', r.text]),
      ...bySection('issues').map((r) => ['סוגיה אישית', r.text]),
      ...bySection('requests').map((r) => ['בקשה', r.text]),
      ...bySection('goals').map((r) => ['יעד', r.text]),
      ['בברכה', closing],
      ['שם חותם', signerName],
      ...taskRows.map((t) => ['משימה', t.title, t.desc, TK_STATUS[t.status], TK_PRIORITY[t.priority], t.assignee, t.due, t.dueCurrent, logCellOut(t.log)]),
    ];
    download(rows.map(csvRow).join('\r\n') + '\r\n', `${title || 'פגישה אישית'}.csv`, 'text/csv;charset=utf-8');
  };
  async function exportWord() {
    // Plain numbered paragraphs, not <ul><li> — html-to-docx's list numbering has no RTL
    // support (bullet always renders on the left), so matching the live UI's own "num.i"
    // labels as plain text sidesteps it (same fix as Debrief/Discussion's exportWord).
    const linesHtml = (sec, num) => {
      const rows = bySection(sec);
      return rows.length ? rows.map((r, i) => `<p>${num}.${i + 1} ${esc(r.text)}</p>`).join('') : '<p>(אין שורות)</p>';
    };
    const detailHtml = (cat) => {
      const rows = bySection(cat.k);
      const list = rows.length ? rows.map((r) => `<p>&nbsp;&nbsp;${esc(r.text)}</p>`).join('') : '<p>(אין שורות)</p>';
      return `<p><b>${cat.sub} ${esc(cat.title)}</b></p>${list}`;
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
    const body = `<h1>${esc(title || 'פגישה אישית ללא שם')}</h1>` +
      `<p>1. סיכום פגישה עם ${esc(personName || '—')} בתאריך ${esc(fmtDate(meetingDate) || '—')}.</p>` +
      `<h2>2. רקע</h2>${linesHtml('background', 2)}` +
      `<h2>3. דברי הפרט</h2>${DETAIL_CATS.map(detailHtml).join('')}` +
      `<h2>4. יעדים אישיים</h2>${linesHtml('goals', 4)}` +
      `<h2>5. משימות</h2>${tasksHtml}` +
      `<p>6. ${esc(closing || 'בברכה,')}</p>` +
      `<p>7. ${esc(signerName || '—')}</p>`;
    await exportDocxHtml(body, title || 'פגישה אישית');
  }
  async function importCsv(f) {
    const rows = parseCsv((await f.text()).replace(/^﻿/, ''));
    let newTitle = '', newPersonName = '', newMeetingDate = '', newClosing = '', newSignerName = '';
    const parsedBg = [], parsedHobbies = [], parsedNeeds = [], parsedIssues = [], parsedRequests = [], parsedGoals = [], parsedTasks = [];
    for (const r of rows) {
      const label = (r[0] || '').trim();
      if (label === 'כותרת') newTitle = (r[1] || '').trim();
      else if (label === 'שם') newPersonName = r[1] || '';
      else if (label === 'תאריך') newMeetingDate = (r[1] || '').trim();
      else if (label === 'רקע') parsedBg.push(r[1] || '');
      else if (label === 'תחביב') parsedHobbies.push(r[1] || '');
      else if (label === 'צורך מיוחד') parsedNeeds.push(r[1] || '');
      else if (label === 'סוגיה אישית') parsedIssues.push(r[1] || '');
      else if (label === 'בקשה') parsedRequests.push(r[1] || '');
      else if (label === 'יעד') parsedGoals.push(r[1] || '');
      else if (label === 'בברכה') newClosing = r[1] || '';
      else if (label === 'שם חותם') newSignerName = r[1] || '';
      else if (label === 'משימה') parsedTasks.push({
        title: r[1] || '', desc: r[2] || '', status: byLabel(TK_STATUS, (r[3] || '').trim(), 'new'),
        priority: +byLabel(TK_PRIORITY, (r[4] || '').trim(), 1), assignee: (r[5] || '').trim(),
        due: (r[6] || '').trim(), dueCurrent: (r[7] || '').trim(), log: logCellIn(r[8]),
      });
    }
    const total = parsedBg.length + parsedHobbies.length + parsedNeeds.length + parsedIssues.length + parsedRequests.length + parsedGoals.length + parsedTasks.length;
    if (!newPersonName && !newMeetingDate && !newClosing && !newSignerName && !total && !newTitle) return alert('לא נמצא תוכן תקין בקובץ (פורמט: זה שיוצא מהמערכת בלבד)');
    if ((lines.size || tasks.size || personName || meetingDate || closing || signerName) && !confirm('הטעינה תחליף את כל תוכן הפגישה, כולל לוח המשימות. להמשיך?')) return;
    ydoc.transact(() => {
      if (newTitle) meta.set('title', newTitle);
      meta.set('personName', newPersonName); meta.set('meetingDate', newMeetingDate);
      meta.set('closing', newClosing); meta.set('signerName', newSignerName);
      [...lines.keys()].forEach((k) => lines.delete(k));
      [...tasks.keys()].forEach((k) => tasks.delete(k));
      const seed = (sec, rows2) => rows2.forEach((text, i) => { const m = new Y.Map(); m.set('section', sec); m.set('text', text); m.set('ord', i + 1); lines.set(uid(), m); });
      seed('background', parsedBg);
      seed('hobbies', parsedHobbies);
      seed('needs', parsedNeeds);
      seed('issues', parsedIssues);
      seed('requests', parsedRequests);
      seed('goals', parsedGoals);
      parsedTasks.forEach((t, i) => {
        const m = new Y.Map();
        m.set('ord', i + 1); m.set('title', t.title); m.set('desc', t.desc);
        m.set('status', t.status); m.set('priority', t.priority); m.set('due', t.due); m.set('dueCurrent', t.dueCurrent);
        m.set('assignee', t.assignee); m.set('log', t.log);
        tasks.set(uid(), m);
      });
    });
  }
  async function importFile(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.csv')) return alert('ניתן לטעון קובץ CSV בפורמט שיוצא מהמערכת בלבד');
    return importCsv(f);
  }

  return (
    <div className="doc-page">
      <header className="topbar">
        <Link to="/" className="logo-sm" title="חזרה לדף הבית"><Logo size={22} /><span className="logo-word">טורבו</span></Link>
        <input className="title-input" title={title || undefined} placeholder="פגישה אישית ללא שם" value={title} readOnly={!editable}
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
            <input ref={fileRef} type="file" accept=".csv" hidden onChange={importFile} />
          </>}
          <Menu label="הורדה">
            <button onClick={exportWord}>Word ‏(.docx) — הכל</button>
            <button onClick={exportCsv}>CSV — לטעינה חוזרת</button>
          </Menu>
          <ShareMenu info={info} />
          <ThemeToggle />
        </div>
      </header>
      <div className="db-page">
        <section className="db-sec">
          <div className="db-sec-head"><span className="db-chnum">1.</span><h2 className="db-sec-title">פתיח</h2></div>
          {editable ? (
            <p className="dc-sentence">
              סיכום פגישה עם{' '}
              <input className="dc-inline" value={personName} placeholder="שם"
                style={{ width: Math.max((personName || 'שם').length + 1, 3) + 'ch' }}
                onChange={(e) => meta.set('personName', e.target.value)} />
              {' '}בתאריך{' '}
              <input type="date" className="dc-inline-date" value={meetingDate} onChange={(e) => meta.set('meetingDate', e.target.value)} />
            </p>
          ) : (
            <p className="db-bg-ro">סיכום פגישה עם {personName || '—'} בתאריך {fmtDate(meetingDate) || '—'}.</p>
          )}
        </section>

        <LineSection sec={SECTIONS[0]} items={bySection('background')} editable={editable} add={addLine} del={delLine} edit={editLine} />

        <section className="db-sec">
          <div className="db-sec-head"><span className="db-chnum">3.</span><h2 className="db-sec-title">דברי הפרט</h2></div>
          {DETAIL_CATS.map((cat) => (
            <DetailList key={cat.k} cat={cat} items={bySection(cat.k)} editable={editable} add={addLine} del={delLine} edit={editLine} />
          ))}
        </section>

        <LineSection sec={SECTIONS[1]} items={bySection('goals')} editable={editable} add={addLine} del={delLine} edit={editLine} />

        <section className="db-sec db-sec-wide">
          <div className="db-sec-head">
            <span className="db-chnum">5.</span>
            <h2 className="db-sec-title">משימות</h2>
          </div>
          <Tasks info={info} user={user} token={token} embed={{ ydoc, map: tasks, editable }} />
        </section>

        <section className="db-sec">
          <div className="db-sec-head"><span className="db-chnum">6.</span><h2 className="db-sec-title">בברכה</h2></div>
          {editable ? (
            <input className="db-field-in" placeholder="בברכה," value={closing} onChange={(e) => meta.set('closing', e.target.value)} />
          ) : (
            <p className="db-bg-ro">{closing || 'בברכה,'}</p>
          )}
        </section>

        <section className="db-sec">
          <div className="db-sec-head"><span className="db-chnum">7.</span><h2 className="db-sec-title">חתימה</h2></div>
          {editable ? (
            <input className="db-field-in" placeholder="שם" value={signerName} onChange={(e) => meta.set('signerName', e.target.value)} />
          ) : (
            <p className="db-bg-ro">{signerName || '—'}</p>
          )}
        </section>
      </div>
    </div>
  );
}
