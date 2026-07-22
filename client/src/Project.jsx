import { useEffect, useMemo, useState, useReducer, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { ShareMenu, Menu } from './ShareExport.jsx';
import { ThemeToggle } from './theme.jsx';
import { Logo, IconSchedule, IconScope, IconResources, IconStar, IconFlag, IconRocket, IconCompass, IconGem, IconBolt } from './icons.jsx';
import { touchRecent } from './identity.js';
import { printElementImage } from './imageExport.js';
import Tasks from './Tasks.jsx';
import Risks from './Risks.jsx';

const uid = () => crypto.randomUUID().slice(0, 8);
const PHASES = ['יזום', 'התנעה', 'מימוש', 'הטמעה', 'שינויים ושיפורים', 'סיום'];
const RAG = { green: 'ירוק', yellow: 'צהוב', red: 'אדום' };
const TRENDS = { up: 'משתפר', flat: 'יציב', down: 'מחמיר' };
const TREND_ARROW = { up: '↑', flat: '→', down: '↓' };
const MS = { done: 'הושלם', active: 'בביצוע', gap: 'בפער', future: 'עתידי' };
const ASPECTS = [
  { k: 'schedule', label: 'לו״ז', Icon: IconSchedule },
  { k: 'scope', label: 'תכולה', Icon: IconScope },
  { k: 'resources', label: 'משאבים', Icon: IconResources },
];
// mirrors of the label maps used by the embedded Tasks/Risks screens, for CSV round-trips
const TK_ST = { new: 'חדש', in_progress: 'בעבודה', waiting: 'ממתין לאחר / בפער', done: 'בוצע' };
const TK_PRI = { 1: 'רגילה', 2: 'גבוהה', 3: 'דחוף' };
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('he-IL') : '');
const byLabel = (obj, val, fallback) => Object.keys(obj).find((k) => obj[k] === val) || fallback;

// Per-project badge: the glyph reflects the project's phase (so it changes as the
// project progresses), the colour is picked at random (blue/green tones) once at
// creation and stored on the project — stable across reloads, not tied to status.
const PHASE_ICON = {
  'יזום': IconCompass, 'התנעה': IconFlag, 'מימוש': IconBolt,
  'הטמעה': IconRocket, 'שינויים ושיפורים': IconGem, 'סיום': IconStar,
};
const BADGE_TONES = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
const randomTone = () => BADGE_TONES[Math.floor(Math.random() * BADGE_TONES.length)];
// legacy fallback for projects saved before the `badge` field existed
function toneFor(p) {
  if (p.badge) return p.badge;
  let h = 0;
  for (let i = 0; i < p.id.length; i++) h = (h * 31 + p.id.charCodeAt(i)) >>> 0;
  return BADGE_TONES[h % BADGE_TONES.length];
}

// Every field starts with real placeholder copy so an exported sheet is never blank.
const newProject = (ord) => ({
  ord,
  name: 'פרויקט חדש',
  purpose: 'תיאור קצר של מטרת הפרויקט — מה הוא בא להשיג.',
  phase: 'יזום',
  status: 'green',
  badge: randomTone(),
  manager: 'שם מנהל הפרויקט',
  updated: today(),
  schedule: { st: 'green', trend: 'flat', text: 'תיאור מצב לוח הזמנים.' },
  scope: { st: 'green', trend: 'flat', text: 'תיאור מצב התכולה.' },
  resources: { st: 'green', trend: 'flat', text: 'תיאור מצב המשאבים.' },
  milestones: [
    { name: 'אבן דרך ראשונה', date: today(), st: 'active' },
    { name: 'אבן דרך שנייה', date: '', st: 'future' },
  ],
  gaps: [{ title: 'פער מרכזי', desc: 'תיאור הפער והשפעתו.' }],
  decisions: ['החלטה שנדרשת מההנהלה.'],
  info: 'מידע נוסף על הפרויקט.',
  links: 'קישורים רלוונטיים.',
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

// NOTE: these live at module scope on purpose. Defining them inside Project() would
// create a new component type on every render, so React would remount the subtree and
// every input would lose focus after a single keystroke.
function HeadRow({ p, clickable, editable, set, onOpen, onDelete }) {
  const rw = editable && !clickable; // writable only in the detail header
  return (
    <div className={'pj-row' + (clickable ? ' clickable' : '')} onClick={clickable ? onOpen : undefined}>
      {(() => { const Icon = PHASE_ICON[p.phase] || IconCompass; return <span className={'pj-badge pj-badge-' + toneFor(p)}><Icon /></span>; })()}
      <div className="pj-row-main">
        {rw
          ? <input className="pj-name-in" value={p.name} onChange={(e) => set(p.id, { name: e.target.value })} />
          : <h3>{p.name}</h3>}
        <div className="pj-purpose-l">משפט קיום (מטרה):</div>
        {rw
          ? <textarea className="pj-purpose-in" rows="2" value={p.purpose} onChange={(e) => set(p.id, { purpose: e.target.value })} />
          : <p className="pj-purpose">{p.purpose}</p>}
      </div>
      <div className="pj-col">
        <span className="pj-col-l">שלב הפרויקט</span>
        {rw
          ? <select className="pj-phase pj-phase-in" value={p.phase} onChange={(e) => set(p.id, { phase: e.target.value })}>
              {PHASES.map((x) => <option key={x}>{x}</option>)}
            </select>
          : <span className="pj-phase">{p.phase}</span>}
      </div>
      <div className="pj-col">
        <span className="pj-col-l">סטטוס כללי</span>
        <span className={'pj-pill pj-rag-' + (p.status || 'green')}>
          {rw
            ? <select value={p.status} onChange={(e) => set(p.id, { status: e.target.value })}>
                {Object.entries(RAG).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            : RAG[p.status]}
          <i />
        </span>
      </div>
      <div className="pj-side">
        <div><span className="pj-col-l">📅 עדכון אחרון</span><b>{fmtDate(p.updated)}</b></div>
        <div><span className="pj-col-l">👤 מנהל פרויקט</span>
          {rw
            ? <input className="pj-mgr-in" value={p.manager} onChange={(e) => set(p.id, { manager: e.target.value })} />
            : <b>{p.manager}</b>}
        </div>
      </div>
      {editable && (
        <button className="pj-edit" title={clickable ? 'פתיחה' : 'מחיקת הפרויקט'}
          onClick={(e) => { e.stopPropagation(); clickable ? onOpen() : onDelete(); }}>
          {clickable ? '✎' : '🗑'}
        </button>
      )}
    </div>
  );
}

function BulletList({ values, editable, onChange, onDelete, onAdd, placeholder }) {
  return (
    <div className="pj-bullets">
      {values.map((v, i) => (
        <div key={i} className="pj-li">
          <span className="pj-li-dot" />
          {editable
            ? <><input value={v} placeholder={placeholder} onChange={(e) => onChange(i, e.target.value)} />
                <button className="pj-x" onClick={() => onDelete(i)}>✕</button></>
            : <span>{v}</span>}
        </div>
      ))}
      {editable && <button className="pj-add-sm" onClick={onAdd}>+ הוספה</button>}
    </div>
  );
}

export default function Project({ info, user, token }) {
  const editable = info.mode === 'edit';
  const [, force] = useReducer((c) => c + 1, 0);
  const [status, setStatus] = useState('connecting');
  const [title, setTitle] = useState('');
  const [peers, setPeers] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [sections, setSections] = useState({}); // accordion open-state, keyed by projectId+section
  const fileRef = useRef();

  const ydoc = useMemo(() => new Y.Doc(), []);
  const projects = ydoc.getMap('projects');
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

  useEffect(() => { touchRecent(token, title, info.mode, 'project'); }, [title]);

  const list = [...projects.entries()]
    .map(([id, m]) => {
      const o = m.toJSON ? m.toJSON() : { ...m };
      delete o.tasksMap; delete o.risksMap; // nested sections are read through subMap, not cloned
      return { id, ...o };
    })
    .sort((a, b) => (a.ord || 0) - (b.ord || 0) || a.id.localeCompare(b.id));

  // Nested collaborative maps backing the embedded tasks/risks sections.
  const getSub = (pid, key) => projects.get(pid)?.get(key);
  function ensureSub(pid, key) {
    const m = projects.get(pid);
    if (!m) return null;
    let sub = m.get(key);
    if (!(sub instanceof Y.Map)) { sub = new Y.Map(); m.set(key, sub); }
    return sub;
  }

  // Any edit stamps "last updated" so the list column stays truthful for free.
  function set(id, patch) {
    const m = projects.get(id);
    if (!m) return;
    ydoc.transact(() => {
      Object.entries(patch).forEach(([k, v]) => m.set(k, v));
      m.set('updated', today());
    });
  }
  const setAspect = (id, ak, patch) => {
    const m = projects.get(id);
    if (m) set(id, { [ak]: { ...(m.get(ak) || {}), ...patch } });
  };
  function addProject(data) {
    const id = uid(), m = new Y.Map();
    const p = data || newProject(Math.max(0, ...list.map((x) => x.ord || 0)) + 1);
    ydoc.transact(() => { Object.entries(p).forEach(([k, v]) => m.set(k, v)); projects.set(id, m); });
    return id;
  }
  function delProject(p) {
    if (!confirm(`למחוק את הפרויקט "${p.name}"?`)) return;
    projects.delete(p.id);
    if (openId === p.id) setOpenId(null);
  }

  // ---- CSV: vertical label/value blocks, one project after another ----
  const exportCsv = () => {
    const lines = [row(['שדה', 'תוכן', '', ''])];
    list.forEach((p) => {
      lines.push(row(['פרויקט', p.name]));
      lines.push(row(['משפט קיום', p.purpose]));
      lines.push(row(['שלב הפרויקט', p.phase]));
      lines.push(row(['סטטוס כללי', RAG[p.status] || 'ירוק']));
      lines.push(row(['מנהל פרויקט', p.manager]));
      lines.push(row(['עדכון אחרון', p.updated]));
      ASPECTS.forEach((a) => {
        const v = p[a.k] || {};
        lines.push(row([`${a.label} סטטוס`, RAG[v.st] || 'ירוק']));
        lines.push(row([`${a.label} מגמה`, TRENDS[v.trend] || 'יציב']));
        lines.push(row([`${a.label} תיאור`, v.text || '']));
      });
      (p.milestones || []).forEach((m) => lines.push(row(['אבן דרך', m.name, m.date, MS[m.st] || 'עתידי'])));
      (p.gaps || []).forEach((g) => lines.push(row(['פער', g.title, g.desc])));
      (p.decisions || []).forEach((d) => lines.push(row(['החלטה נדרשת', d])));
      lines.push(row(['מידע נוסף', p.info]));
      lines.push(row(['קישורים חשובים', p.links]));
      // embedded sections — same label/value template so the sheet stays one consistent shape
      const tm = getSub(p.id, 'tasksMap');
      if (tm) [...tm.values()].map((t) => t.toJSON()).sort((a, b) => (a.ord || 0) - (b.ord || 0))
        .forEach((t) => lines.push(row(['משימה', t.title, TK_ST[t.status] || 'חדש', TK_PRI[t.priority] || 'רגילה', t.assignee || '', t.dueCurrent || t.due || ''])));
      const rm = getSub(p.id, 'risksMap');
      if (rm) [...rm.values()].map((x) => x.toJSON()).sort((a, b) => (a.ord || 0) - (b.ord || 0))
        .forEach((x) => lines.push(row(['סיכון', x.name, x.sev ?? 3, x.prob ?? 3, x.detail || '', x.actions || ''])));
      lines.push('');
    });
    download(lines.join('\r\n') + '\r\n', `${title || 'פרויקטים'}.csv`);
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
      if (label === 'פרויקט') { cur = { ...newProject(parsed.length + 1), name: v || 'פרויקט חדש', milestones: [], gaps: [], decisions: [], _tasks: [], _risks: [] }; parsed.push(cur); continue; }
      if (!cur) continue;
      if (label === 'משפט קיום') cur.purpose = v;
      else if (label === 'שלב הפרויקט') cur.phase = PHASES.includes(v) ? v : 'יזום';
      else if (label === 'סטטוס כללי') cur.status = byLabel(RAG, v, 'green');
      else if (label === 'מנהל פרויקט') cur.manager = v;
      else if (label === 'עדכון אחרון') cur.updated = v || today();
      else if (label === 'מידע נוסף') cur.info = v;
      else if (label === 'קישורים חשובים') cur.links = v;
      else if (label === 'אבן דרך') cur.milestones.push({ name: v, date: (r[2] || '').trim(), st: byLabel(MS, (r[3] || '').trim(), 'future') });
      else if (label === 'פער') cur.gaps.push({ title: v, desc: (r[2] || '').trim() });
      else if (label === 'החלטה נדרשת') cur.decisions.push(v);
      else if (label === 'משימה') cur._tasks.push({
        title: v, status: byLabel(TK_ST, (r[2] || '').trim(), 'new'),
        priority: +byLabel(TK_PRI, (r[3] || '').trim(), 1), assignee: (r[4] || '').trim(),
        due: (r[5] || '').trim(), dueCurrent: (r[5] || '').trim(), desc: '', log: [],
      });
      else if (label === 'סיכון') cur._risks.push({
        name: v, sev: Math.min(5, Math.max(1, +(r[2] || 3) || 3)), prob: Math.min(5, Math.max(1, +(r[3] || 3) || 3)),
        detail: (r[4] || '').trim(), actions: (r[5] || '').trim(),
      });
      else {
        const a = ASPECTS.find((x) => label.startsWith(x.label));
        if (!a) continue;
        if (label.endsWith('סטטוס')) cur[a.k] = { ...cur[a.k], st: byLabel(RAG, v, 'green') };
        else if (label.endsWith('מגמה')) cur[a.k] = { ...cur[a.k], trend: byLabel(TRENDS, v, 'flat') };
        else if (label.endsWith('תיאור')) cur[a.k] = { ...cur[a.k], text: v };
      }
    }
    if (!parsed.length) return alert('לא נמצאו פרויקטים בקובץ');
    if (projects.size && !confirm('הטעינה תחליף את כל הפרויקטים הקיימים. להמשיך?')) return;
    ydoc.transact(() => {
      [...projects.keys()].forEach((k) => projects.delete(k));
      parsed.forEach((p, i) => {
        const { _tasks, _risks, ...rest } = p;
        const pid = addProject({ ...rest, ord: i + 1 });
        if (_tasks?.length) {
          const tm = ensureSub(pid, 'tasksMap');
          _tasks.forEach((t, j) => { const m = new Y.Map(); Object.entries({ ...t, ord: j + 1 }).forEach(([k2, v2]) => m.set(k2, v2)); tm.set(uid(), m); });
        }
        if (_risks?.length) {
          const rm = ensureSub(pid, 'risksMap');
          _risks.forEach((x, j) => { const m = new Y.Map(); Object.entries({ ...x, ord: j + 1 }).forEach(([k2, v2]) => m.set(k2, v2)); rm.set(uid(), m); });
        }
      });
    });
    setOpenId(null);
  }

  const open = openId && list.find((p) => p.id === openId);

  return (
    <div className="doc-page">
      <header className="topbar">
        <Link to="/" className="logo-sm"><Logo size={24} /></Link>
        <input className="title-input" placeholder="תיק פרויקטים ללא שם" value={title} readOnly={!editable}
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
            <button onClick={() => printElementImage(open ? '.pj-detail' : '.pj-list', { title: title || 'פרויקטים' })}>PDF (הדפסה)</button>
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
                <button className="btn-primary" onClick={() => setOpenId(addProject())}>+ פרויקט חדש</button>
                <span className="hint">לחיצה על פרויקט פותחת אותו</span>
              </div>
            )}
            {list.map((p) => (
              <HeadRow key={p.id} p={p} clickable editable={editable} set={set}
                onOpen={() => setOpenId(p.id)} onDelete={() => delProject(p)} />
            ))}
            {!list.length && <div className="tlr-empty">אין עדיין פרויקטים — מוסיפים בכפתור למעלה</div>}
          </div>
        ) : (
          <div className="pj-detail">
            <button className="btn pj-back" onClick={() => setOpenId(null)}>← חזרה לרשימה</button>
            <HeadRow p={open} editable={editable} set={set} onDelete={() => delProject(open)} />

            <div className="pj-aspects">
              {ASPECTS.map((a) => {
                const v = open[a.k] || {};
                return (
                  <div key={a.k} className={'pj-aspect pj-rag-' + (v.st || 'green')}>
                    <span className={'pj-dot pj-rag-' + (v.st || 'green')} />
                    <div className="pj-aspect-head">
                      <span className="pj-aspect-icon"><a.Icon /></span>
                      <h3>{a.label}</h3>
                    </div>
                    {editable
                      ? <textarea rows="3" value={v.text || ''} onChange={(e) => setAspect(open.id, a.k, { text: e.target.value })} />
                      : <p>{v.text}</p>}
                    <div className="pj-aspect-foot">
                      <span className="pj-col-l">מגמה:</span>
                      {editable ? (
                        <>
                          <select value={v.trend || 'flat'} onChange={(e) => setAspect(open.id, a.k, { trend: e.target.value })}>
                            {Object.entries(TRENDS).map(([k2, l]) => <option key={k2} value={k2}>{l}</option>)}
                          </select>
                          <select value={v.st || 'green'} onChange={(e) => setAspect(open.id, a.k, { st: e.target.value })}>
                            {Object.entries(RAG).map(([k2, l]) => <option key={k2} value={k2}>{l}</option>)}
                          </select>
                        </>
                      ) : <b>{TRENDS[v.trend]}</b>}
                      <span className={'pj-trend pj-t-' + (v.trend || 'flat')}>{TREND_ARROW[v.trend || 'flat']}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pj-card pj-ms-card">
              <div className="pj-card-head">
                <h3>אבני דרך מרכזיות</h3>
                <div className="pj-legend">
                  {Object.entries(MS).map(([k2, l]) => <span key={k2}><i className={'pj-ms-' + k2} />{l}</span>)}
                </div>
              </div>
              <div className="pj-ms-track">
                <div className="pj-ms-line" />
                {(open.milestones || []).map((m, i) => (
                  <div key={i} className="pj-ms">
                    {editable
                      ? <input className="pj-ms-name" value={m.name} onChange={(e) => {
                          const ms = [...open.milestones]; ms[i] = { ...m, name: e.target.value }; set(open.id, { milestones: ms });
                        }} />
                      : <span className="pj-ms-name">{m.name}</span>}
                    <span className={'pj-ms-mark pj-ms-' + m.st} title={MS[m.st]}>
                      <span className="pj-ms-dot" />
                      {editable && (
                        <select value={m.st} onChange={(e) => {
                          const ms = [...open.milestones]; ms[i] = { ...m, st: e.target.value }; set(open.id, { milestones: ms });
                        }}>
                          {Object.entries(MS).map(([k2, l]) => <option key={k2} value={k2}>{l}</option>)}
                        </select>
                      )}
                    </span>
                    <span className={'pj-ms-label pj-ms-' + m.st}>{MS[m.st]}</span>
                    {editable
                      ? <input type="date" className="pj-ms-date" value={m.date || ''} onChange={(e) => {
                          const ms = [...open.milestones]; ms[i] = { ...m, date: e.target.value }; set(open.id, { milestones: ms });
                        }} />
                      : <span className="pj-ms-date">{fmtDate(m.date)}</span>}
                    {editable && <button className="pj-x" onClick={() => set(open.id, { milestones: open.milestones.filter((_, j) => j !== i) })}>✕</button>}
                  </div>
                ))}
              </div>
              {editable && <button className="pj-add-sm" onClick={() => set(open.id, { milestones: [...(open.milestones || []), { name: 'אבן דרך', date: '', st: 'future' }] })}>+ אבן דרך</button>}
            </div>

            <div className="pj-grid3">
              <div className="pj-card">
                <div className="pj-card-head"><h3>⚠️ TOP 3 פערים</h3></div>
                {(open.gaps || []).map((g, i) => (
                  <div key={i} className={'pj-gap pj-gap-' + Math.min(i + 1, 3)}>
                    <span className="pj-gap-n">{i + 1}</span>
                    <div className="pj-gap-body">
                      {editable ? (
                        <>
                          <input value={g.title} placeholder="כותרת הפער" onChange={(e) => {
                            const gs = [...open.gaps]; gs[i] = { ...g, title: e.target.value }; set(open.id, { gaps: gs });
                          }} />
                          <textarea rows="2" value={g.desc} placeholder="תיאור והשפעה" onChange={(e) => {
                            const gs = [...open.gaps]; gs[i] = { ...g, desc: e.target.value }; set(open.id, { gaps: gs });
                          }} />
                        </>
                      ) : <><b>{g.title}</b><p>{g.desc}</p></>}
                    </div>
                    {editable && <button className="pj-x" onClick={() => set(open.id, { gaps: open.gaps.filter((_, j) => j !== i) })}>✕</button>}
                  </div>
                ))}
                {editable && (open.gaps || []).length < 3 && (
                  <button className="pj-add-sm" onClick={() => set(open.id, { gaps: [...(open.gaps || []), { title: 'פער', desc: '' }] })}>+ פער</button>
                )}
              </div>

              <div className="pj-card">
                <div className="pj-card-head"><h3>👤 החלטות נדרשות</h3></div>
                <BulletList
                  values={open.decisions || []} editable={editable} placeholder="החלטה שנדרשת"
                  onChange={(i, val) => { const ds = [...open.decisions]; ds[i] = val; set(open.id, { decisions: ds }); }}
                  onDelete={(i) => set(open.id, { decisions: open.decisions.filter((_, j) => j !== i) })}
                  onAdd={() => set(open.id, { decisions: [...(open.decisions || []), ''] })} />
              </div>

              <div className="pj-side-col">
                {[{ k: 'info', t: 'מידע נוסף' }, { k: 'links', t: 'קישורים חשובים' }].map((s) => (
                  <div key={s.k} className="pj-card pj-soft">
                    <div className="pj-card-head"><h3>{s.t}</h3></div>
                    {editable
                      ? <textarea rows="3" value={open[s.k] || ''} onChange={(e) => set(open.id, { [s.k]: e.target.value })} />
                      : <p>{open[s.k]}</p>}
                  </div>
                ))}
              </div>
            </div>

            {[
              { k: 'tasksMap', label: '📋 ניהול משימות', Comp: Tasks },
              { k: 'risksMap', label: '🛡️ ניהול סיכונים', Comp: Risks },
            ].map(({ k, label, Comp }) => {
              const isOpen = sections[open.id + k];
              return (
                <div key={k} className={'pj-acc' + (isOpen ? ' open' : '')}>
                  <button className="pj-acc-head" onClick={() => {
                    if (!isOpen) ensureSub(open.id, k); // create lazily on open, never during render
                    setSections((s) => ({ ...s, [open.id + k]: !isOpen }));
                  }}>
                    <span>{label}</span>
                    <span className="pj-acc-chevron">{isOpen ? '⌃' : '⌄'}</span>
                  </button>
                  {isOpen && getSub(open.id, k) && (
                    <div className="pj-acc-body">
                      <Comp info={info} user={user} token={token}
                        embed={{ ydoc, map: getSub(open.id, k), editable }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
