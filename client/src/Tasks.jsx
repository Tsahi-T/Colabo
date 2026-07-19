import { useEffect, useMemo, useState, useReducer, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { ShareMenu } from './ShareExport.jsx';
import { ThemeToggle } from './theme.jsx';
import { Logo } from './icons.jsx';
import { touchRecent } from './identity.js';

const uid = () => crypto.randomUUID().slice(0, 8);
const STATUSES = { new: 'חדש', in_progress: 'בעבודה', waiting: 'ממתין לאחר / בפער', done: 'בוצע' };
const PRIORITIES = { 1: 'רגילה', 2: 'גבוהה', 3: 'דחוף' };
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (d) => (d ? new Date(d).toLocaleDateString('he-IL') : '');
const UPCOMING_DAYS = 3;

const download = (text, name, mime) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: mime }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

// ---- CSV (Excel-compatible: BOM + CRLF), dependency-free ----
const CSV_HEADERS = ['כותרת', 'תיאור', 'סטטוס', 'עדיפות', 'אחראי', 'תאריך יעד', 'תאריך יעד עדכני'];
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

export default function Tasks({ info, user, token }) {
  const editable = info.mode === 'edit';
  const [, force] = useReducer((c) => c + 1, 0);
  const [status, setStatus] = useState('connecting');
  const [title, setTitle] = useState('');
  const [peers, setPeers] = useState([]);
  const [view, setView] = useState('board'); // board | table
  const [open, setOpen] = useState(null);    // task id in modal
  const [filter, setFilter] = useState({ text: '', status: '', priority: '', assignee: '', upcoming: false });
  const [sort, setSort] = useState({ key: null, dir: 1 });
  const fileRef = useRef();

  const ydoc = useMemo(() => new Y.Doc(), []);
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

  useEffect(() => { touchRecent(token, title, info.mode, 'tasks'); }, [title]);

  const rows = [...tasks.entries()]
    .map(([id, t]) => ({
      id, ord: t.get('ord') || 0, title: t.get('title') || '', desc: t.get('desc') || '',
      status: t.get('status') || 'new', priority: t.get('priority') || 1,
      due: t.get('due') || '', dueCurrent: t.get('dueCurrent') || '', assignee: t.get('assignee') || '',
      log: t.get('log') || [],
    }))
    .sort((a, b) => b.ord - a.ord || a.id.localeCompare(b.id));

  const effDue = (t) => t.dueCurrent || t.due;
  const overdue = (t) => { const d = effDue(t); return !!d && t.status !== 'done' && d < today(); };
  const upcoming = (t) => {
    const d = effDue(t);
    if (!d || t.status === 'done' || overdue(t)) return false;
    return (new Date(d) - new Date(today())) / 86400000 <= UPCOMING_DAYS;
  };
  const assignees = [...new Set(rows.map((t) => t.assignee).filter(Boolean))].sort();

  const set = (id, k, v) => tasks.get(id)?.set(k, v);
  function setDue(id, v) {
    const t = tasks.get(id);
    if (!t) return;
    ydoc.transact(() => { t.set('due', v); if (!t.get('dueCurrent')) t.set('dueCurrent', v); });
  }
  function logEntry(id, note, from, to) {
    const t = tasks.get(id);
    if (!t) return;
    t.set('log', [{ at: Date.now(), by: user.name, from, to, note }, ...(t.get('log') || [])].slice(0, 50));
  }
  function setStatusLogged(id, s) {
    const t = tasks.get(id);
    if (!t || t.get('status') === s) return;
    ydoc.transact(() => { logEntry(id, '', t.get('status') || 'new', s); t.set('status', s); });
  }

  function add() {
    const id = uid(), t = new Y.Map();
    ydoc.transact(() => {
      t.set('ord', Math.max(0, ...rows.map((x) => x.ord)) + 1);
      t.set('title', ''); t.set('desc', ''); t.set('status', 'new'); t.set('priority', 1);
      t.set('due', ''); t.set('dueCurrent', ''); t.set('assignee', ''); t.set('log', []);
      tasks.set(id, t);
    });
    setOpen(id);
  }
  function dup(t) {
    const id = uid(), nt = new Y.Map();
    ydoc.transact(() => {
      nt.set('ord', Math.max(0, ...rows.map((x) => x.ord)) + 1);
      nt.set('title', t.title ? `${t.title} (עותק)` : ''); nt.set('desc', t.desc);
      nt.set('status', 'new'); nt.set('priority', t.priority);
      nt.set('due', t.due); nt.set('dueCurrent', t.dueCurrent);
      nt.set('assignee', t.assignee); nt.set('log', []);
      tasks.set(id, nt);
    });
  }
  function del(t) {
    if (t.title && !confirm(`למחוק את המשימה "${t.title}"?`)) return;
    tasks.delete(t.id);
    if (open === t.id) setOpen(null);
  }

  const exportCsv = () => download(
    [csvRow(CSV_HEADERS), ...rows.map((t) => csvRow([t.title, t.desc, STATUSES[t.status], PRIORITIES[t.priority], t.assignee, t.due, t.dueCurrent]))].join('\r\n') + '\r\n',
    `${title || 'ניהול משימות'}.csv`, 'text/csv;charset=utf-8');

  async function importCsv(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const grid = parseCsv((await f.text()).replace(/^﻿/, '')).slice(1); // drop header row
    const revStatus = Object.fromEntries(Object.entries(STATUSES).map(([k, v]) => [v, k]));
    const revPri = Object.fromEntries(Object.entries(PRIORITIES).map(([k, v]) => [v, +k]));
    const parsed = grid.filter((r) => r[0]?.trim()).map((r) => ({
      title: r[0] || '', desc: r[1] || '', status: revStatus[r[2]] || 'new', priority: revPri[r[3]] || 1,
      assignee: r[4] || '', due: r[5] || '', dueCurrent: r[6] || r[5] || '',
    }));
    if (!parsed.length) return alert('לא נמצאו משימות בקובץ');
    if (tasks.size && !confirm('הטעינה תחליף את כל המשימות הקיימות. להמשיך?')) return;
    ydoc.transact(() => {
      [...tasks.keys()].forEach((k) => tasks.delete(k));
      parsed.forEach((p, i) => {
        const t = new Y.Map();
        t.set('ord', i + 1);
        Object.entries(p).forEach(([k, v]) => t.set(k, v));
        t.set('log', []);
        tasks.set(uid(), t);
      });
    });
  }

  let filtered = rows.filter((t) =>
    (!filter.text || (t.title + t.desc).includes(filter.text)) &&
    (!filter.status || t.status === filter.status) &&
    (!filter.priority || t.priority === +filter.priority) &&
    (!filter.assignee || t.assignee === filter.assignee) &&
    (!filter.upcoming || upcoming(t) || overdue(t)));

  const SORTERS = {
    title: (t) => t.title, status: (t) => Object.keys(STATUSES).indexOf(t.status), priority: (t) => t.priority,
    assignee: (t) => t.assignee, due: (t) => t.due || '9999', dueCurrent: (t) => effDue(t) || '9999',
  };
  if (sort.key) {
    const get = SORTERS[sort.key];
    filtered = [...filtered].sort((a, b) => {
      const av = get(a), bv = get(b);
      return (av > bv ? 1 : av < bv ? -1 : 0) * sort.dir;
    });
  }
  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: 1 }));
  const sortArrow = (key) => (sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : '');

  const stat = {
    overdue: rows.filter(overdue).length,
    upcoming: rows.filter(upcoming).length,
    waiting: rows.filter((t) => t.status === 'waiting').length,
    open: rows.filter((t) => t.status !== 'done').length,
  };

  const cur = open && rows.find((t) => t.id === open);
  const rowTone = (t) => (overdue(t) ? ' tk-row-late' : upcoming(t) ? ' tk-row-soon' : '');

  return (
    <div className="doc-page">
      <header className="topbar">
        <Link to="/" className="logo-sm"><Logo size={24} /></Link>
        <input className="title-input" placeholder="ניהול משימות ללא שם" value={title} readOnly={!editable}
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
            <button className="btn" title="ניתן לטעון קובץ CSV בפורמט שיוצא מהמערכת בלבד" onClick={() => fileRef.current.click()}>טעינה</button>
            <input ref={fileRef} type="file" accept=".csv" hidden onChange={importCsv} />
          </>}
          <button className="btn" onClick={exportCsv}>הורדה</button>
          <ShareMenu info={info} />
          <ThemeToggle />
        </div>
      </header>

      <div className="toolbar tk-bar">
        {editable && <button className="btn-primary tk-add" onClick={add}>+ משימה</button>}
        <span className="sep" />
        <button className={'btn tk-tab' + (view === 'board' ? ' sel' : '')} onClick={() => setView('board')}>לוח</button>
        <button className={'btn tk-tab' + (view === 'table' ? ' sel' : '')} onClick={() => setView('table')}>טבלה</button>
        <span className="sep" />
        <span className={'tk-stat' + (stat.overdue ? ' alert' : '')}>⚠️ באיחור: {stat.overdue}</span>
        <span className={'tk-stat' + (stat.upcoming ? ' warn' : '')}>🟡 קרוב ליעד: {stat.upcoming}</span>
        <span className="tk-stat">⏳ ממתין לאחר / בפער: {stat.waiting}</span>
        <span className="tk-stat">סה״כ פתוחות: {stat.open}</span>
      </div>

      <datalist id="tk-people">{assignees.map((a) => <option key={a} value={a} />)}</datalist>

      {view === 'board' ? (
        <div className="tk-board">
          {Object.entries(STATUSES).map(([s, label]) => (
            <div key={s} className={'tk-col tk-s-' + s}
              onDragOver={(e) => editable && e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); editable && setStatusLogged(e.dataTransfer.getData('text/plain'), s); }}>
              <h3>{label} <span className="tk-count">{rows.filter((t) => t.status === s).length}</span></h3>
              {rows.filter((t) => t.status === s).map((t) => (
                <div key={t.id} className={'tk-card' + (overdue(t) ? ' overdue' : upcoming(t) ? ' upcoming' : '')} draggable={editable}
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
                  onClick={() => setOpen(t.id)}>
                  <div className="tk-card-title">{t.title || 'משימה ללא שם'}</div>
                  {t.desc && <div className="tk-card-desc">{t.desc.split('\n')[0]}</div>}
                  <div className="tk-card-meta">
                    <span className={'tk-pri tk-p-' + t.priority} title={'עדיפות ' + t.priority + ' — ' + PRIORITIES[t.priority]}>{t.priority}</span>
                    {t.assignee && <span>👤 {t.assignee}</span>}
                    {effDue(t) && <span className="tk-due">📅 {fmt(effDue(t))}</span>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="tk-table-wrap">
          <div className="tk-filters">
            <input placeholder="🔍 חיפוש…" value={filter.text} onChange={(e) => setFilter({ ...filter, text: e.target.value })} />
            <label className="tk-check">
              <input type="checkbox" checked={filter.upcoming} onChange={(e) => setFilter({ ...filter, upcoming: e.target.checked })} />
              קרוב ליעד / באיחור
            </label>
          </div>
          <table className="rk-table tk-table">
            <thead>
              <tr>
                <th><button className="tk-th-sort" onClick={() => toggleSort('title')}>כותרת{sortArrow('title')}</button></th>
                <th>
                  <button className="tk-th-sort" onClick={() => toggleSort('status')}>סטטוס{sortArrow('status')}</button>
                  <select className="tk-th-filter" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
                    <option value="">הכל</option>
                    {Object.entries(STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </th>
                <th>
                  <button className="tk-th-sort" onClick={() => toggleSort('priority')}>עדיפות{sortArrow('priority')}</button>
                  <select className="tk-th-filter" value={filter.priority} onChange={(e) => setFilter({ ...filter, priority: e.target.value })}>
                    <option value="">הכל</option>
                    {Object.entries(PRIORITIES).map(([v, l]) => <option key={v} value={v}>{v} — {l}</option>)}
                  </select>
                </th>
                <th>
                  <button className="tk-th-sort" onClick={() => toggleSort('assignee')}>אחראי{sortArrow('assignee')}</button>
                  <select className="tk-th-filter" value={filter.assignee} onChange={(e) => setFilter({ ...filter, assignee: e.target.value })}>
                    <option value="">הכל</option>
                    {assignees.map((a) => <option key={a}>{a}</option>)}
                  </select>
                </th>
                <th><button className="tk-th-sort" onClick={() => toggleSort('due')}>תאריך יעד{sortArrow('due')}</button></th>
                <th><button className="tk-th-sort" onClick={() => toggleSort('dueCurrent')}>יעד עדכני{sortArrow('dueCurrent')}</button></th>
                {editable && <th />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className={rowTone(t)}>
                  {editable ? (
                    <>
                      <td>
                        <input className="tk-in" placeholder="כותרת המשימה…" value={t.title} onChange={(e) => set(t.id, 'title', e.target.value)} />
                        {t.desc && <div className="tk-in-desc">{t.desc.split('\n')[0]}</div>}
                      </td>
                      <td><select className="tk-in" value={t.status} onChange={(e) => setStatusLogged(t.id, e.target.value)}>
                        {Object.entries(STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select></td>
                      <td><select className="tk-in" value={t.priority} onChange={(e) => set(t.id, 'priority', +e.target.value)}>
                        {Object.entries(PRIORITIES).map(([v, l]) => <option key={v} value={v}>{v} — {l}</option>)}
                      </select></td>
                      <td><input className="tk-in" list="tk-people" placeholder="אחראי" value={t.assignee} onChange={(e) => set(t.id, 'assignee', e.target.value)} /></td>
                      <td><input className="tk-in" type="date" value={t.due} onChange={(e) => setDue(t.id, e.target.value)} /></td>
                      <td><input className="tk-in" type="date" value={t.dueCurrent} onChange={(e) => set(t.id, 'dueCurrent', e.target.value)} /></td>
                      <td className="rk-c">
                        <div className="tk-row-actions">
                          <button className="tlr-del" title="פרטים והיסטוריה" onClick={() => setOpen(t.id)}>⤢</button>
                          <button className="tlr-del" title="שכפול שורה" onClick={() => dup(t)}>⧉</button>
                          <button className="tlr-del" title="מחיקה" onClick={() => del(t)}>✕</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="rk-name">{t.title || '—'}{t.desc && <div className="tk-in-desc">{t.desc.split('\n')[0]}</div>}</td>
                      <td><span className={'tk-chip tk-s-' + t.status}>{STATUSES[t.status]}</span></td>
                      <td><span className={'tk-pri tk-p-' + t.priority}>{t.priority} — {PRIORITIES[t.priority]}</span></td>
                      <td>{t.assignee || '—'}</td>
                      <td>{fmt(t.due)}</td>
                      <td>{fmt(t.dueCurrent)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <div className="tlr-empty">אין משימות תואמות</div>}
        </div>
      )}

      {cur && (
        <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
          <div className="modal tk-modal">
            <input className="tk-in tk-title-in" placeholder="כותרת המשימה" value={cur.title} readOnly={!editable}
              autoFocus={!cur.title} onChange={(e) => set(cur.id, 'title', e.target.value)} />
            <textarea className="tk-in" rows="3" placeholder="תיאור…" value={cur.desc} readOnly={!editable}
              onChange={(e) => set(cur.id, 'desc', e.target.value)} />
            <div className="tk-grid">
              <label>סטטוס
                <select className="tk-in" value={cur.status} disabled={!editable} onChange={(e) => setStatusLogged(cur.id, e.target.value)}>
                  {Object.entries(STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label>עדיפות
                <select className="tk-in" value={cur.priority} disabled={!editable} onChange={(e) => set(cur.id, 'priority', +e.target.value)}>
                  {Object.entries(PRIORITIES).map(([v, l]) => <option key={v} value={v}>{v} — {l}</option>)}
                </select>
              </label>
              <label>תאריך יעד
                <input className="tk-in" type="date" value={cur.due} readOnly={!editable} onChange={(e) => setDue(cur.id, e.target.value)} />
              </label>
              <label>יעד עדכני
                <input className="tk-in" type="date" value={cur.dueCurrent} readOnly={!editable} onChange={(e) => set(cur.id, 'dueCurrent', e.target.value)} />
              </label>
            </div>
            <label className="tk-lbl">אחראי
              <input className="tk-in" list="tk-people" placeholder="שם האחראי" value={cur.assignee} readOnly={!editable}
                onChange={(e) => set(cur.id, 'assignee', e.target.value)} />
            </label>
            {editable && (
              <form className="tk-note-row" onSubmit={(e) => {
                e.preventDefault();
                const note = e.target.note.value.trim();
                if (note) { logEntry(cur.id, note, cur.status, cur.status); e.target.reset(); }
              }}>
                <input className="tk-in" name="note" placeholder="הערת עדכון — מה קרה?" />
                <button className="btn" type="submit">הוספה</button>
              </form>
            )}
            {cur.log.length > 0 && (
              <div className="tk-log">
                {cur.log.map((l, i) => (
                  <div key={i} className="tk-log-row">
                    <b>{fmt(l.at)}</b> · {l.by}
                    {l.from !== l.to && <> · {STATUSES[l.from]} ← {STATUSES[l.to]}</>}
                    {l.note && <> · {l.note}</>}
                  </div>
                ))}
              </div>
            )}
            <div className="tk-actions">
              {editable && <button className="tlr-del" onClick={() => del(cur)}>🗑 מחיקה</button>}
              <button className="btn-primary" onClick={() => setOpen(null)}>סגירה</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
