import { useEffect, useMemo, useState, useReducer } from 'react';
import { Link } from 'react-router-dom';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { ShareMenu } from './ShareExport.jsx';
import { ThemeToggle } from './theme.jsx';
import { Logo } from './icons.jsx';
import { touchRecent } from './identity.js';

const uid = () => crypto.randomUUID().slice(0, 8);
const STATUSES = { new: 'חדש', in_progress: 'בעבודה', waiting: 'ממתין לאחר', done: 'בוצע' };
const PRIORITIES = { low: 'נמוכה', normal: 'רגילה', high: 'גבוהה', urgent: 'דחוף' };
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (d) => (d ? new Date(d).toLocaleDateString('he-IL') : '');
const download = (text, name) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

export default function Tasks({ info, user, token }) {
  const editable = info.mode === 'edit';
  const [, force] = useReducer((c) => c + 1, 0);
  const [status, setStatus] = useState('connecting');
  const [title, setTitle] = useState('');
  const [peers, setPeers] = useState([]);
  const [view, setView] = useState('board'); // board | table
  const [open, setOpen] = useState(null);    // task id in modal
  const [filter, setFilter] = useState({ text: '', status: '', assignee: '' });

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
      status: t.get('status') || 'new', priority: t.get('priority') || 'normal',
      due: t.get('due') || '', follow: t.get('follow') || '', assignee: t.get('assignee') || '',
      log: t.get('log') || [],
    }))
    .sort((a, b) => b.ord - a.ord || a.id.localeCompare(b.id));

  const overdue = (t) => t.due && t.status !== 'done' && t.due < today();
  const followDue = (t) => t.follow && t.status !== 'done' && t.follow <= today();
  const assignees = [...new Set(rows.map((t) => t.assignee).filter(Boolean))].sort();

  const set = (id, k, v) => tasks.get(id)?.set(k, v);
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
      t.set('title', ''); t.set('desc', ''); t.set('status', 'new'); t.set('priority', 'normal');
      t.set('due', ''); t.set('follow', ''); t.set('assignee', ''); t.set('log', []);
      tasks.set(id, t);
    });
    setOpen(id);
  }
  function del(t) {
    if (t.title && !confirm(`למחוק את המשימה "${t.title}"?`)) return;
    tasks.delete(t.id);
    if (open === t.id) setOpen(null);
  }

  const exportTxt = () => download(
    `ניהול משימות: ${title || 'ללא שם'}\n\n` + rows.map((t) =>
      `[${STATUSES[t.status]}] ${t.title} | עדיפות: ${PRIORITIES[t.priority]}` +
      `${t.assignee ? ` | אחראי: ${t.assignee}` : ''}${t.due ? ` | יעד: ${fmt(t.due)}` : ''}` +
      `${t.desc ? `\n  ${t.desc.replace(/\n/g, ' / ')}` : ''}`
    ).join('\n'), `${title || 'ניהול משימות'}.txt`);

  const filtered = rows.filter((t) =>
    (!filter.text || (t.title + t.desc).includes(filter.text)) &&
    (!filter.status || t.status === filter.status) &&
    (!filter.assignee || t.assignee === filter.assignee));

  const stat = {
    overdue: rows.filter(overdue).length,
    follow: rows.filter(followDue).length,
    waiting: rows.filter((t) => t.status === 'waiting').length,
    open: rows.filter((t) => t.status !== 'done').length,
  };

  const cur = open && rows.find((t) => t.id === open);

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
          <button className="btn" onClick={exportTxt}>הורדה</button>
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
        <span className={'tk-stat' + (stat.follow ? ' warn' : '')}>👁️ מעקב להיום: {stat.follow}</span>
        <span className="tk-stat">⏳ ממתין לאחר: {stat.waiting}</span>
        <span className="tk-stat">סה״כ פתוחות: {stat.open}</span>
      </div>

      {view === 'board' ? (
        <div className="tk-board">
          {Object.entries(STATUSES).map(([s, label]) => (
            <div key={s} className={'tk-col tk-s-' + s}
              onDragOver={(e) => editable && e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); editable && setStatusLogged(e.dataTransfer.getData('text/plain'), s); }}>
              <h3>{label} <span className="tk-count">{rows.filter((t) => t.status === s).length}</span></h3>
              {rows.filter((t) => t.status === s).map((t) => (
                <div key={t.id} className={'tk-card' + (overdue(t) ? ' overdue' : '')} draggable={editable}
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
                  onClick={() => setOpen(t.id)}>
                  <div className="tk-card-title">{t.title || 'משימה ללא שם'}</div>
                  <div className="tk-card-meta">
                    <span className={'tk-pri tk-p-' + t.priority}>{PRIORITIES[t.priority]}</span>
                    {t.assignee && <span>👤 {t.assignee}</span>}
                    {t.due && <span className="tk-due">📅 {fmt(t.due)}</span>}
                    {followDue(t) && <span className="tk-follow">👁️ מעקב</span>}
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
            <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
              <option value="">כל הסטטוסים</option>
              {Object.entries(STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={filter.assignee} onChange={(e) => setFilter({ ...filter, assignee: e.target.value })}>
              <option value="">כל האחראים</option>
              {assignees.map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>
          <table className="rk-table tk-table">
            <thead><tr><th>כותרת</th><th>סטטוס</th><th>עדיפות</th><th>אחראי</th><th>יעד</th><th>מעקב</th>{editable && <th />}</tr></thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className={overdue(t) ? 'tk-row-late' : ''} onClick={() => setOpen(t.id)}>
                  <td className="rk-name">{t.title || '—'}</td>
                  <td><span className={'tk-chip tk-s-' + t.status}>{STATUSES[t.status]}</span></td>
                  <td>{PRIORITIES[t.priority]}</td>
                  <td>{t.assignee || '—'}</td>
                  <td>{fmt(t.due)}</td>
                  <td>{fmt(t.follow)}</td>
                  {editable && <td className="rk-c"><button className="tlr-del" title="מחיקה" onClick={(e) => { e.stopPropagation(); del(t); }}>✕</button></td>}
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
                <select className="tk-in" value={cur.priority} disabled={!editable} onChange={(e) => set(cur.id, 'priority', e.target.value)}>
                  {Object.entries(PRIORITIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label>תאריך יעד
                <input className="tk-in" type="date" value={cur.due} readOnly={!editable} onChange={(e) => set(cur.id, 'due', e.target.value)} />
              </label>
              <label>מעקב הבא
                <input className="tk-in" type="date" value={cur.follow} readOnly={!editable} onChange={(e) => set(cur.id, 'follow', e.target.value)} />
              </label>
            </div>
            <label className="tk-lbl">אחראי
              <input className="tk-in" list="tk-people" placeholder="שם האחראי" value={cur.assignee} readOnly={!editable}
                onChange={(e) => set(cur.id, 'assignee', e.target.value)} />
              <datalist id="tk-people">{assignees.map((a) => <option key={a} value={a} />)}</datalist>
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
