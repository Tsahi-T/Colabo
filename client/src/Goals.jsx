import { useEffect, useMemo, useState, useReducer, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { ShareMenu, Menu } from './ShareExport.jsx';
import { ThemeToggle } from './theme.jsx';
import { Logo, IconTarget } from './icons.jsx';
import { PRESETS } from './goals-presets.js';
import { touchRecent } from './identity.js';
import { printElementImage } from './imageExport.js';
import Tasks from './Tasks.jsx';

const uid = () => crypto.randomUUID().slice(0, 8);
const TK_ST = { new: 'חדש', in_progress: 'בעבודה', waiting: 'ממתין לאחר / בפער', done: 'בוצע' };
const TK_PRI = { 1: 'רגילה', 2: 'גבוהה', 3: 'דחוף' };
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('he-IL');
};
const byLabel = (obj, val, fallback) => Object.keys(obj).find((k) => obj[k] === val) || fallback;

const BADGE_TONES = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
const randomTone = () => BADGE_TONES[Math.floor(Math.random() * BADGE_TONES.length)];
function toneFor(g) {
  if (g.badge) return g.badge;
  let h = 0;
  for (let i = 0; i < g.id.length; i++) h = (h * 31 + g.id.charCodeAt(i)) >>> 0;
  return BADGE_TONES[h % BADGE_TONES.length];
}

const newGoal = (ord) => ({
  ord,
  name: 'יעד חדש',
  purpose: 'תיאור קצר של מטרת היעד — מה הוא בא להשיג.',
  status: '',
  badge: randomTone(),
  updated: today(),
  metrics: [{ metric: 'מדד לדוגמה', target: '', current: '' }],
});

const download = (text, name, mime = 'text/csv;charset=utf-8') => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: mime }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};
const esc = (s) => { s = String(s ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const row = (arr) => arr.map(esc).join(',');
function parseCsv(text) {
  const rows = []; let r = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { r.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; r.push(f); f = ''; rows.push(r); r = []; }
    else f += c;
  }
  if (f || r.length) { r.push(f); rows.push(r); }
  return rows;
}
function logCellOut(log) {
  return (log || []).map((l) => {
    const parts = [new Date(l.at || Date.now()).toISOString(), l.by || ''];
    if (l.from !== l.to) parts.push(`${TK_ST[l.from] || l.from}→${TK_ST[l.to] || l.to}`);
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
      if (m) { from = byLabel(TK_ST, m[1].trim(), 'new'); to = byLabel(TK_ST, m[2].trim(), 'new'); }
      else note = p;
    });
    return { at, by, from, to, note };
  });
}

// NOTE: module scope on purpose — defining these inside Goals() would remount the subtree on
// every render and every input would lose focus after a single keystroke.
function autoGrow(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}
function GrowingField({ className, rows, value, onChange, placeholder, autoFocus, onBlur }) {
  const ref = useRef();
  useEffect(() => { autoGrow(ref.current); }, [value]);
  return (
    <textarea ref={ref} className={className} rows={rows || 1} placeholder={placeholder}
      value={value} onChange={onChange} autoFocus={autoFocus} onBlur={onBlur} />
  );
}

// A small "הצעות ✦" dropdown reused by both free-text fields (מטרה/עמידה ביעד) — appends the
// chosen phrase onto whatever's already there (own line), same convention as Debrief/Discussion.
function PresetsButton({ presetKey, value, onPick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  if (!PRESETS[presetKey]) return null;
  return (
    <div className="sw-add-row" ref={ref}>
      <button type="button" className="btn sw-add" onClick={() => setOpen((v) => !v)}>הצעות ✦</button>
      {open && (
        <div className="menu-items sw-presets">
          {PRESETS[presetKey].map((p) => (
            <button key={p} onClick={() => { onPick(value ? value + '\n' + p : p); setOpen(false); }}>{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function GoalRow({ g, clickable, editable, set, onOpen, onDelete }) {
  const rw = editable && !clickable; // writable only in the detail header
  return (
    <div className={'pj-row' + (clickable ? ' clickable' : '')} onClick={clickable ? onOpen : undefined}>
      <span className={'pj-badge pj-badge-' + toneFor(g)}><IconTarget /></span>
      <div className="pj-row-main">
        {rw
          ? <GrowingField className="pj-name-in" value={g.name} onChange={(e) => set(g.id, { name: e.target.value })} />
          : <h3>{g.name}</h3>}
        <div className="pj-purpose-l">מטרה:</div>
        {rw
          ? <>
              <GrowingField className="pj-purpose-in" rows={2} value={g.purpose} onChange={(e) => set(g.id, { purpose: e.target.value })} />
              <PresetsButton presetKey="purpose" value={g.purpose} onPick={(v) => set(g.id, { purpose: v })} />
            </>
          : <p className="pj-purpose">{g.purpose}</p>}
      </div>
      <div className="pj-side">
        <div><span className="pj-col-l">📅 עדכון אחרון</span>
          {rw
            ? <input type="date" className="pj-mgr-in pj-date-in" value={g.updated || ''}
                onChange={(e) => set(g.id, { updated: e.target.value, updatedManual: true })} />
            : <b>{fmtDate(g.updated) || '—'}</b>}
        </div>
      </div>
      {editable && (
        <button className="pj-edit" title={clickable ? 'פתיחה' : 'מחיקת היעד'}
          onClick={(e) => { e.stopPropagation(); clickable ? onOpen() : onDelete(); }}>
          {clickable ? '✎' : '🗑'}
        </button>
      )}
    </div>
  );
}

export default function Goals({ info, user, token }) {
  const editable = info.mode === 'edit';
  const [, force] = useReducer((c) => c + 1, 0);
  const [status, setStatus] = useState('connecting');
  const [title, setTitle] = useState('');
  const [peers, setPeers] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [tasksOpen, setTasksOpen] = useState({});
  const fileRef = useRef();

  const ydoc = useMemo(() => new Y.Doc(), []);
  const goals = ydoc.getMap('goals');
  const meta = ydoc.getMap('meta');
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

  useEffect(() => { touchRecent(token, title, info.mode, 'goals'); }, [title]);

  const list = [...goals.entries()]
    .map(([id, m]) => {
      const o = m.toJSON ? m.toJSON() : { ...m };
      delete o.tasksMap; // nested section read through getSub, not cloned
      return { id, ...o };
    })
    .sort((a, b) => (a.ord || 0) - (b.ord || 0) || a.id.localeCompare(b.id));

  const getSub = (gid) => goals.get(gid)?.get('tasksMap');
  function ensureTasksMap(gid) {
    const m = goals.get(gid);
    if (!m) return null;
    let sub = m.get('tasksMap');
    if (!(sub instanceof Y.Map)) { sub = new Y.Map(); m.set('tasksMap', sub); }
    return sub;
  }

  function set(id, patch) {
    const m = goals.get(id);
    if (!m) return;
    ydoc.transact(() => {
      Object.entries(patch).forEach(([k, v]) => m.set(k, v));
      if (!('updated' in patch) && !m.get('updatedManual')) m.set('updated', today());
    });
  }
  function addGoal(data) {
    const id = uid(), m = new Y.Map();
    const g = data || newGoal(Math.max(0, ...list.map((x) => x.ord || 0)) + 1);
    ydoc.transact(() => { Object.entries(g).forEach(([k, v]) => m.set(k, v)); goals.set(id, m); });
    return id;
  }
  function delGoal(g) {
    if (!confirm(`למחוק את היעד "${g.name}"?`)) return;
    goals.delete(g.id);
    if (openId === g.id) setOpenId(null);
  }

  // ---- CSV: vertical label/value blocks, one goal after another (same shape as Project.jsx) ----
  const exportCsv = () => {
    const lines = [row(['שדה', 'תוכן', '', ''])];
    list.forEach((g) => {
      lines.push(row(['יעד', g.name]));
      lines.push(row(['מטרה', g.purpose]));
      lines.push(row(['עמידה ביעד', g.status]));
      lines.push(row(['עדכון אחרון', g.updated]));
      lines.push(row(['עדכון ידני', g.updatedManual ? 'כן' : 'לא']));
      lines.push(row(['תגית', g.badge || '']));
      (g.metrics || []).forEach((m) => lines.push(row(['מדד', m.metric, m.target, m.current])));
      const tm = getSub(g.id);
      if (tm) [...tm.values()].map((t) => t.toJSON()).sort((a, b) => (a.ord || 0) - (b.ord || 0))
        .forEach((t) => lines.push(row(['משימה', t.title, TK_ST[t.status] || 'חדש', TK_PRI[t.priority] || 'רגילה', t.assignee || '', t.due || '', t.dueCurrent || '', t.desc || '', logCellOut(t.log)])));
      lines.push('');
    });
    download(lines.join('\r\n') + '\r\n', `${title || 'יעדים'}.csv`);
  };

  async function importCsv(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const rows = parseCsv((await f.text()).replace(/^﻿/, ''));
    const parsed = [];
    let cur = null;
    for (const r of rows) {
      const label = (r[0] || '').trim();
      const v = (r[1] || '').trim();
      if (!label || label === 'שדה') continue;
      if (label === 'יעד') { cur = { ...newGoal(parsed.length + 1), name: v || 'יעד חדש', metrics: [], _tasks: [] }; parsed.push(cur); continue; }
      if (!cur) continue;
      if (label === 'מטרה') cur.purpose = v;
      else if (label === 'עמידה ביעד') cur.status = v;
      else if (label === 'עדכון אחרון') cur.updated = v || today();
      else if (label === 'עדכון ידני') cur.updatedManual = v === 'כן';
      else if (label === 'תגית') cur.badge = BADGE_TONES.includes(v) ? v : cur.badge;
      else if (label === 'מדד') cur.metrics.push({ metric: v, target: (r[2] || '').trim(), current: (r[3] || '').trim() });
      else if (label === 'משימה') cur._tasks.push({
        title: v, status: byLabel(TK_ST, (r[2] || '').trim(), 'new'),
        priority: +byLabel(TK_PRI, (r[3] || '').trim(), 1), assignee: (r[4] || '').trim(),
        due: (r[5] || '').trim(), dueCurrent: (r[6] || r[5] || '').trim(), desc: (r[7] || '').trim(), log: logCellIn(r[8]),
      });
    }
    if (!parsed.length) return alert('לא נמצאו יעדים בקובץ');
    if (goals.size && !confirm('הטעינה תחליף את כל היעדים הקיימים. להמשיך?')) return;
    ydoc.transact(() => {
      [...goals.keys()].forEach((k) => goals.delete(k));
      parsed.forEach((g, i) => {
        const { _tasks, ...rest } = g;
        const gid = addGoal({ ...rest, ord: i + 1 });
        if (_tasks?.length) {
          const tm = ensureTasksMap(gid);
          _tasks.forEach((t, j) => { const m = new Y.Map(); Object.entries({ ...t, ord: j + 1 }).forEach(([k2, v2]) => m.set(k2, v2)); tm.set(uid(), m); });
        }
      });
    });
    setOpenId(null);
  }

  const open = openId && list.find((g) => g.id === openId);

  return (
    <div className="doc-page">
      <header className="topbar">
        <Link to="/" className="logo-sm" title="חזרה לדף הבית"><Logo size={22} /><span className="logo-word">טורבו</span></Link>
        <input className="title-input" title={title || undefined} placeholder="תיק יעדים ללא שם" value={title} readOnly={!editable}
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
            <button onClick={exportCsv}>Excel ‏(CSV)</button>
            <button onClick={() => printElementImage(open ? '.pj-detail' : '.pj-list', { title: title || 'יעדים' })}>PDF (הדפסה)</button>
          </Menu>
          <ShareMenu info={info} />
          <ThemeToggle />
        </div>
      </header>

      <div className="pj-page">
        {!open ? (
          <div className="pj-list">
            {editable && (
              <div className="pj-list-bar">
                <button className="btn-primary" onClick={() => setOpenId(addGoal())}>+ יעד חדש</button>
                <span className="hint">לחיצה על יעד פותחת אותו</span>
              </div>
            )}
            {list.map((g) => (
              <GoalRow key={g.id} g={g} clickable editable={editable} set={set}
                onOpen={() => setOpenId(g.id)} onDelete={() => delGoal(g)} />
            ))}
            {!list.length && <div className="tlr-empty">אין עדיין יעדים — מוסיפים בכפתור למעלה</div>}
          </div>
        ) : (
          <div className="pj-detail">
            <button className="btn pj-back" onClick={() => setOpenId(null)}>← חזרה לרשימה</button>
            <GoalRow g={open} editable={editable} set={set} onDelete={() => delGoal(open)} />

            <div className="pj-grid2">
              <div className="pj-card pj-soft">
                <div className="pj-card-head"><h3>עמידה ביעד</h3></div>
                {editable ? (
                  <>
                    <GrowingField rows={3} placeholder="תיאור מצב העמידה ביעד." value={open.status || ''}
                      onChange={(e) => set(open.id, { status: e.target.value })} />
                    <PresetsButton presetKey="status" value={open.status} onPick={(v) => set(open.id, { status: v })} />
                  </>
                ) : <p>{open.status || '—'}</p>}
              </div>

              <div className="pj-card pj-metrics-card">
                <div className="pj-card-head"><h3>יעדים מדידים</h3></div>
                <div className="pj-metrics-table">
                  <div className="pj-metrics-head"><span>מדד</span><span>יעד</span><span>נוכחי</span></div>
                  {(open.metrics || []).map((m, i) => (
                    <div key={i} className="pj-metrics-row">
                      {editable ? (
                        <>
                          <GrowingField value={m.metric} placeholder="שם המדד" onChange={(e) => {
                            const ms = [...open.metrics]; ms[i] = { ...m, metric: e.target.value }; set(open.id, { metrics: ms });
                          }} />
                          <GrowingField value={m.target} placeholder="יעד" onChange={(e) => {
                            const ms = [...open.metrics]; ms[i] = { ...m, target: e.target.value }; set(open.id, { metrics: ms });
                          }} />
                          <GrowingField value={m.current} placeholder="נוכחי" onChange={(e) => {
                            const ms = [...open.metrics]; ms[i] = { ...m, current: e.target.value }; set(open.id, { metrics: ms });
                          }} />
                          <button className="pj-x" onClick={() => set(open.id, { metrics: open.metrics.filter((_, j) => j !== i) })}>✕</button>
                        </>
                      ) : (
                        <><span>{m.metric}</span><span>{m.target}</span><span>{m.current}</span></>
                      )}
                    </div>
                  ))}
                  {!(open.metrics || []).length && <div className="sw-empty">אין עדיין מדדים</div>}
                </div>
                {editable && <button className="pj-add-sm" onClick={() => set(open.id, { metrics: [...(open.metrics || []), { metric: '', target: '', current: '' }] })}>+ מדד</button>}
              </div>
            </div>

            <div className={'pj-acc' + (tasksOpen[open.id] ? ' open' : '')}>
              <button className="pj-acc-head" onClick={() => {
                if (!tasksOpen[open.id]) ensureTasksMap(open.id);
                setTasksOpen((s) => ({ ...s, [open.id]: !s[open.id] }));
              }}>
                <span>📋 משימות מפורטות</span>
                <span className="pj-acc-chevron">{tasksOpen[open.id] ? '⌃' : '⌄'}</span>
              </button>
              {tasksOpen[open.id] && getSub(open.id) && (
                <div className="pj-acc-body">
                  <Tasks info={info} user={user} token={token} embed={{ ydoc, map: getSub(open.id), editable }} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
