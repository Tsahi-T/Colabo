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

const uid = () => crypto.randomUUID().slice(0, 8);
const nowTime = () => new Date().toTimeString().slice(0, 8); // "HH:MM:SS", locale-independent
const SECTIONS = [
  { k: 'findings', title: 'ממצאים', hint: 'שורת טקסט חדשה בכל פלוס או Enter' },
  { k: 'lessons', title: 'לקחים', hint: 'שורת טקסט חדשה בכל פלוס או Enter' },
  { k: 'summary', title: 'סיכום ומסקנות', hint: 'שורות מצטרפות בתחתית' },
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

// A single growing list of text lines (ממצאים / לקחים / סיכום) — mirrors the SWOT quadrant UX:
// "+ שורה" or Enter inside a line both open the next one, and a preset menu offers ready phrases.
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
    focusId.current = add(sec.k, presetText);
  }
  return (
    <section className="db-sec">
      <div className="db-sec-head">
        <h2 className="db-sec-title">{sec.title}</h2>
        {sec.hint && <span className="db-hint">{sec.hint}</span>}
      </div>
      <div className="sw-lines">
        {items.map((it) => (
          <div key={it.id} className="sw-line">
            <span className="sw-dot" />
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
  useEffect(() => {
    const el = bgRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [background]);
  useEffect(() => {
    if (chronoFocusId.current && chronoRefs.current[chronoFocusId.current]) {
      chronoRefs.current[chronoFocusId.current].focus();
      chronoFocusId.current = null;
    }
  });

  const chronoRows = [...chrono.entries()]
    .map(([id, m]) => ({ id, time: m.get('time') || nowTime(), text: m.get('text') || '', ord: m.get('ord') || 0 }))
    .sort((a, b) => a.time.localeCompare(b.time) || a.ord - b.ord || a.id.localeCompare(b.id));
  const allLines = [...lines.entries()].map(([id, m]) => ({ id, section: m.get('section'), ord: m.get('ord') || 0, text: m.get('text') || '' }));
  const bySection = (s) => allLines.filter((l) => l.section === s).sort((a, b) => a.ord - b.ord || a.id.localeCompare(b.id));

  function addChrono(presetText = '') {
    const id = uid(), m = new Y.Map();
    const maxOrd = Math.max(0, ...chronoRows.map((x) => x.ord));
    ydoc.transact(() => { m.set('time', nowTime()); m.set('text', presetText); m.set('ord', maxOrd + 1); chrono.set(id, m); });
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

  // ---- exports ----
  function fmtLines(sec) {
    const rows = bySection(sec);
    return rows.length ? rows.map((r) => `- ${r.text}`).join('\n') + '\n' : '(אין שורות)\n';
  }
  const exportTxt = () => {
    let out = `תחקיר: ${title || 'ללא שם'}\n\n`;
    out += `רקע:\n${background}\n\n`;
    out += `כרונולוגיה:\n`;
    out += chronoRows.length ? chronoRows.map((r) => `${r.time} | ${r.text}`).join('\n') + '\n' : '(אין רשומות)\n';
    out += `\nממצאים:\n${fmtLines('findings')}`;
    out += `\nלקחים:\n${fmtLines('lessons')}`;
    out += `\nסיכום ומסקנות:\n${fmtLines('summary')}`;
    download(out, `${title || 'תחקיר'}.txt`);
  };
  const exportChronoCsv = () => download(
    [csvEscape('שעה') + ',' + csvEscape('פירוט'), ...chronoRows.map((r) => csvEscape(r.time) + ',' + csvEscape(r.text))].join('\r\n') + '\r\n',
    `${title || 'תחקיר'} - כרונולוגיה.csv`, 'text/csv;charset=utf-8');
  async function exportWord() {
    const chronoHtml = chronoRows.length
      ? `<table><tr><th>שעה</th><th>פירוט</th></tr>${chronoRows.map((r) => `<tr><td>${esc(r.time)}</td><td>${esc(r.text)}</td></tr>`).join('')}</table>`
      : '<p>(אין רשומות)</p>';
    const linesHtml = (sec) => {
      const rows = bySection(sec);
      return rows.length ? `<ul>${rows.map((r) => `<li>${esc(r.text)}</li>`).join('')}</ul>` : '<p>(אין שורות)</p>';
    };
    const bgHtml = background.split('\n').map((l) => `<p>${esc(l) || '&nbsp;'}</p>`).join('') || '<p>(אין תוכן)</p>';
    const body = `<h1>${esc(title || 'תחקיר ללא שם')}</h1>` +
      `<h2>רקע</h2>${bgHtml}` +
      `<h2>כרונולוגיה</h2>${chronoHtml}` +
      `<h2>ממצאים</h2>${linesHtml('findings')}` +
      `<h2>לקחים</h2>${linesHtml('lessons')}` +
      `<h2>סיכום ומסקנות</h2>${linesHtml('summary')}`;
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
        const m = line.match(/^(\d{2}:\d{2}:\d{2})\s*\|\s*(.*)$/);
        if (m) parsedChrono.push({ time: m[1], text: m[2] });
        continue;
      }
      if (section === 'findings' || section === 'lessons' || section === 'summary') {
        const m = line.match(/^-\s*(.+)/);
        if (m) parsedLines[section].push(m[1]);
      }
    }
    const bgText = bg.join('\n').trim();
    const total = parsedChrono.length + Object.values(parsedLines).flat().length;
    if (!bgText && !total) return alert('לא נמצא תוכן תקין בקובץ (פורמט: זה שיוצא מהמערכת בלבד)');
    if ((chrono.size || lines.size || background) && !confirm('הטעינה תחליף את התחקיר הנוכחי. להמשיך?')) return;
    ydoc.transact(() => {
      meta.set('background', bgText);
      [...chrono.keys()].forEach((k) => chrono.delete(k));
      [...lines.keys()].forEach((k) => lines.delete(k));
      parsedChrono.forEach((c, i) => { const m = new Y.Map(); m.set('time', c.time); m.set('text', c.text); m.set('ord', i + 1); chrono.set(uid(), m); });
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
            <button onClick={exportTxt}>TXT — לטעינה חוזרת</button>
          </Menu>
          <ShareMenu info={info} />
          <ThemeToggle />
        </div>
      </header>
      <div className="db-page">
        <section className="db-sec">
          <div className="db-sec-head"><h2 className="db-sec-title">רקע</h2></div>
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
            <h2 className="db-sec-title">כרונולוגיה</h2>
            <span className="db-hint">שעה נרשמת אוטומטית בפתיחת שורה, ניתנת לשינוי</span>
          </div>
          <div className="db-chrono">
            <div className="db-chrono-head"><span>שעה</span><span>פירוט</span></div>
            <div className="db-chrono-rows">
              {chronoRows.map((r) => (
                <div key={r.id} className="db-chrono-row">
                  {editable ? (
                    <>
                      <input type="time" step="1" className="db-chrono-time" value={r.time}
                        onChange={(e) => e.target.value && chrono.get(r.id)?.set('time', e.target.value)} />
                      <input className="db-chrono-text" placeholder="פירוט האירוע…" value={r.text}
                        ref={(el) => { if (el) chronoRefs.current[r.id] = el; else delete chronoRefs.current[r.id]; }}
                        onChange={(e) => chrono.get(r.id)?.set('text', e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); chronoFocusId.current = addChrono(); } }} />
                      <button className="sw-del" onClick={() => delChrono(r)}>✕</button>
                    </>
                  ) : (
                    <>
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

        {SECTIONS.map((sec) => (
          <LineSection key={sec.k} sec={sec} items={bySection(sec.k)} editable={editable} add={addLine} del={delLine} edit={editLine} />
        ))}
      </div>
    </div>
  );
}
