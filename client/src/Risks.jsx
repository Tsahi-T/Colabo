import { useEffect, useMemo, useState, useReducer, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { ShareMenu, Menu } from './ShareExport.jsx';
import { ThemeToggle } from './theme.jsx';
import { Logo } from './icons.jsx';
import { touchRecent, bumpDownload, bumpReimport } from './identity.js';
import { printElementImage } from './imageExport.js';
import { RISKS_EXAMPLE_TXT } from './examples.js';

const uid = () => crypto.randomUUID().slice(0, 8);
const level = (score) => (score > 14 ? 'r' : score >= 12 ? 'o' : score >= 7 ? 'y' : 'g');
const LEVEL_COLOR = { g: '#6ee7a0', y: '#fbe14a', o: '#fdac4e', r: '#f76d6d' };
const download = (text, name, mime = 'text/plain;charset=utf-8') => {
  bumpDownload();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: mime }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};
const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
function autoGrow(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}
// a plain <input>/manually-resized <textarea> hides overflow text past its size — this grows
// downward on its own instead.
function GrowingField({ className, rows, value, onChange, placeholder }) {
  const ref = useRef();
  useEffect(() => { autoGrow(ref.current); }, [value]);
  return <textarea ref={ref} className={className} rows={rows} placeholder={placeholder} value={value} onChange={onChange} />;
}

// `embed` lets this screen run inside another document (e.g. under a project):
// it then reuses the host's Y.Doc + a supplied map and renders without its own chrome.
export default function Risks({ info, user, token, embed }) {
  const embedded = !!embed;
  const editable = embedded ? embed.editable : info.mode === 'edit';
  const [, force] = useReducer((c) => c + 1, 0);
  const [status, setStatus] = useState('connecting');
  const [title, setTitle] = useState('');
  const [peers, setPeers] = useState([]);
  const [sel, setSel] = useState(null);
  const fileRef = useRef();

  const ydoc = useMemo(() => (embedded ? embed.ydoc : new Y.Doc()), []);
  const risks = useMemo(() => (embedded ? embed.map : ydoc.getMap('risks')), []);
  const provider = useMemo(() => {
    if (embedded) return null; // the host document already owns the connection
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return new HocuspocusProvider({
      url: `${proto}://${location.host}/collab`, name: info.docId, token, document: ydoc,
      onStatus: ({ status }) => setStatus(status),
    });
  }, []);

  useEffect(() => {
    ydoc.on('update', force);
    if (embedded) return () => ydoc.off('update', force);
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

  useEffect(() => { if (!embedded) touchRecent(token, title, info.mode, 'risks'); }, [title]);

  // Stable numbering by creation order; the number is the identity on the matrix.
  const rows = [...risks.entries()]
    .map(([id, r]) => ({
      id, ord: r.get('ord') || 0, name: r.get('name') || '', detail: r.get('detail') || '',
      actions: r.get('actions') || '', sev: r.get('sev') || 3, prob: r.get('prob') || 3,
    }))
    .sort((a, b) => a.ord - b.ord || a.id.localeCompare(b.id))
    .map((r, i) => ({ ...r, num: i + 1, score: r.sev * r.prob }));

  function add() {
    const id = uid(), r = new Y.Map();
    ydoc.transact(() => {
      r.set('ord', Math.max(0, ...rows.map((x) => x.ord)) + 1);
      r.set('name', ''); r.set('detail', ''); r.set('actions', '');
      r.set('sev', 3); r.set('prob', 3);
      risks.set(id, r);
    });
    setSel(id);
  }
  function del(r) {
    if (r.name && !confirm(`למחוק את הסיכון "${r.name}"?`)) return;
    risks.delete(r.id);
    if (sel === r.id) setSel(null);
  }
  const set = (id, k, v) => risks.get(id)?.set(k, v);

  // ---- TXT ----
  const exportTxt = () => download(
    `ניהול סיכונים: ${title || 'ללא שם'}\n\n` + rows.map((r) =>
      `[${r.num}] ${r.name.replace(/\n/g, ' / ')} | חומרה: ${r.sev} | הסתברות: ${r.prob} | משוקלל: ${r.score}\nפירוט: ${r.detail.replace(/\n/g, ' / ')}\nפעולות: ${r.actions.replace(/\n/g, ' / ')}\n`
    ).join('\n'), `${title || 'ניהול סיכונים'}.txt`);
  // The table sits beside the matrix (a wide layout, not a tall one), so landscape wastes far
  // less of the page than the previous portrait default — same content fit noticeably larger
  // and more legible (measured ~30% bigger on the example content).
  const exportPdf = () => printElementImage('.rk-page', { title: title || 'ניהול סיכונים', landscape: true });
  function applyRisksTxt(txt, { skipConfirm = false } = {}) {
    const parsed = [];
    let cur = null;
    for (const line of txt.split(/\r?\n/)) {
      const h = line.match(/^\[\d+\]\s*(.*?)\s*\|\s*חומרה:\s*(\d)\s*\|\s*הסתברות:\s*(\d)/);
      if (h) { cur = { name: h[1], sev: +h[2], prob: +h[3], detail: '', actions: '' }; parsed.push(cur); continue; }
      const d = cur && line.match(/^פירוט:\s*(.*)/);
      if (d) { cur.detail = d[1]; continue; }
      const a = cur && line.match(/^פעולות:\s*(.*)/);
      if (a) { cur.actions = a[1]; continue; }
    }
    if (!parsed.length) return alert('לא נמצאו סיכונים בקובץ');
    if (!skipConfirm && risks.size && !confirm('הטעינה תחליף את הטבלה הנוכחית. להמשיך?')) return;
    ydoc.transact(() => {
      [...risks.keys()].forEach((k) => risks.delete(k));
      parsed.forEach((p, i) => {
        const r = new Y.Map();
        r.set('ord', i + 1); r.set('name', p.name); r.set('detail', p.detail); r.set('actions', p.actions);
        r.set('sev', Math.min(5, Math.max(1, p.sev))); r.set('prob', Math.min(5, Math.max(1, p.prob)));
        risks.set(uid(), r);
      });
    });
  }
  // Excel: a real HTML <table> saved with an .xls extension — Excel opens this natively and
  // renders the inline cell colours (the weighted-score column, matching the matrix's own
  // red/orange/yellow/green), no binary xlsx library needed. Same trick as the Gantt screen.
  const exportExcel = () => {
    const head = ['#', 'נושא הסיכון', 'פירוט הסיכון', 'פעולות לצמצום הסיכון', 'חומרה', 'הסתברות', 'משוקלל'];
    const bodyRows = rows.map((r) => `<tr>
      <td style="border:1px solid #ccc;padding:3px 6px;text-align:center;">${r.num}</td>
      <td style="border:1px solid #ccc;padding:3px 6px;">${escHtml(r.name)}</td>
      <td style="border:1px solid #ccc;padding:3px 6px;">${escHtml(r.detail)}</td>
      <td style="border:1px solid #ccc;padding:3px 6px;">${escHtml(r.actions)}</td>
      <td style="border:1px solid #ccc;padding:3px 6px;text-align:center;">${r.sev}</td>
      <td style="border:1px solid #ccc;padding:3px 6px;text-align:center;">${r.prob}</td>
      <td style="border:1px solid #ccc;padding:3px 6px;text-align:center;background:${LEVEL_COLOR[level(r.score)]};font-weight:bold;">${r.score}</td>
    </tr>`).join('');
    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head>` +
      `<body dir="rtl"><table border="1" style="border-collapse:collapse;font-family:Arial;font-size:12px;">` +
      `<tr>${head.map((h) => `<th style="background:#eef1f5;border:1px solid #ccc;padding:3px 6px;">${escHtml(h)}</th>`).join('')}</tr>` +
      `${bodyRows}</table></body></html>`;
    download(html, `${title || 'ניהול סיכונים'}.xls`, 'application/vnd.ms-excel;charset=utf-8');
  };
  // Reads the exported .xls back — it's a plain HTML <table>, so DOMParser handles it with no
  // library. Columns are located by header text rather than fixed position, so a hand-edited
  // or reordered sheet still imports. "משוקלל" is derived (sev*prob) and skipped on read.
  function applyExcelHtml(text, { skipConfirm = false } = {}) {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const trs = [...doc.querySelectorAll('table tr')];
    const headCells = [...(trs[0]?.children || [])].map((c) => c.textContent.trim());
    const col = (label, fallback) => { const i = headCells.indexOf(label); return i === -1 ? fallback : i; };
    const cName = col('נושא הסיכון', 1), cDetail = col('פירוט הסיכון', 2), cActions = col('פעולות לצמצום הסיכון', 3);
    const cSev = col('חומרה', 4), cProb = col('הסתברות', 5);
    const parsed = [];
    trs.slice(1).forEach((tr) => {
      const cells = [...tr.children].map((td) => td.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim());
      if (!cells.length) return;
      const name = cells[cName] || '', detail = cells[cDetail] || '', actions = cells[cActions] || '';
      if (!name && !detail && !actions) return;
      parsed.push({ name, detail, actions, sev: +cells[cSev] || 3, prob: +cells[cProb] || 3 });
    });
    if (!parsed.length) return alert('לא נמצאו סיכונים בקובץ');
    if (!skipConfirm && risks.size && !confirm('הטעינה תחליף את הטבלה הנוכחית. להמשיך?')) return;
    ydoc.transact(() => {
      [...risks.keys()].forEach((k) => risks.delete(k));
      parsed.forEach((p, i) => {
        const r = new Y.Map();
        r.set('ord', i + 1); r.set('name', p.name); r.set('detail', p.detail); r.set('actions', p.actions);
        r.set('sev', Math.min(5, Math.max(1, p.sev))); r.set('prob', Math.min(5, Math.max(1, p.prob)));
        risks.set(uid(), r);
      });
    });
  }
  async function importTxt(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    bumpReimport();
    const text = await f.text();
    if (/<table/i.test(text)) return applyExcelHtml(text);
    return applyRisksTxt(text);
  }
  function loadExample() {
    if (!confirm('טעינת דוגמה תחליף את התוכן הנוכחי במסמך זה. להמשיך?')) return;
    applyRisksTxt(RISKS_EXAMPLE_TXT, { skipConfirm: true });
    if (!embedded) ydoc.getMap('meta').set('title', 'סיכוני תוכניות המטה 2026');
  }

  const nums15 = [1, 2, 3, 4, 5];

  return (
    <div className={embedded ? 'rk-embed' : 'doc-page'}>
      {!embedded && (
        <header className="topbar">
          <Link to="/" className="logo-sm" title="חזרה לדף הבית"><Logo size={22} /><span className="logo-word">טורבו</span></Link>
          <input className="title-input" title={title || undefined} placeholder="ניהול סיכונים ללא שם" value={title} readOnly={!editable}
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
              <button className="btn" title="ניתן לטעון קובץ TXT או Excel (.xls) בפורמט שיוצא מהמערכת" onClick={() => fileRef.current.click()}>טעינה</button>
              <input ref={fileRef} type="file" accept=".txt,.xls" hidden onChange={importTxt} />
              <button className="btn" title="טעינת טבלת סיכונים לדוגמה, למטרות הכרות עם המערכת" onClick={loadExample}>דוגמה</button>
            </>}
            <Menu label="הורדה">
              <button onClick={exportPdf}>PDF (הדפסה)</button>
              <button onClick={exportExcel}>Excel (טבלה צבעונית) - לטעינה חוזרת</button>
              <button onClick={exportTxt}>TXT - לטעינה חוזרת</button>
            </Menu>
            <ShareMenu info={info} />
            <ThemeToggle />
          </div>
        </header>
      )}
      <div className="rk-page">
        <div className="rk-table-wrap">
          <table className="rk-table">
            <thead>
              <tr>
                <th className="rk-c">#</th><th>נושא הסיכון</th><th>פירוט הסיכון</th><th>פעולות לצמצום הסיכון</th>
                <th className="rk-c">חומרה</th><th className="rk-c">הסתברות</th><th className="rk-c">משוקלל</th>
                {editable && <th />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={sel === r.id ? 'sel' : ''} onClick={() => setSel(r.id)}>
                  <td className="rk-c"><span className="rk-num">{r.num}</span></td>
                  {editable ? (
                    <>
                      <td><GrowingField className="rk-in rk-name" rows={1} placeholder="לוחות זמנים" value={r.name} onChange={(e) => set(r.id, 'name', e.target.value)} /></td>
                      <td><GrowingField className="rk-in" rows={2} placeholder="משהו רע שיקרה בגלל משהו לא צפוי - עיכוב בפרויקט בשל פער כ״א / טכני / ארגוני" value={r.detail} onChange={(e) => set(r.id, 'detail', e.target.value)} /></td>
                      <td><GrowingField className="rk-in" rows={2} placeholder="גיוס עובד זמני, יצירת הסכם פרילנס, גיבוי מקצועי בצוות, רידוד תכולות ופיתוח בשלבים" value={r.actions} onChange={(e) => set(r.id, 'actions', e.target.value)} /></td>
                      <td className="rk-c"><select className="rk-sel" value={r.sev} onChange={(e) => set(r.id, 'sev', +e.target.value)}>{nums15.map((n) => <option key={n}>{n}</option>)}</select></td>
                      <td className="rk-c"><select className="rk-sel" value={r.prob} onChange={(e) => set(r.id, 'prob', +e.target.value)}>{nums15.map((n) => <option key={n}>{n}</option>)}</select></td>
                    </>
                  ) : (
                    <>
                      <td className="rk-name">{r.name || '-'}</td>
                      <td className="rk-ro">{r.detail}</td>
                      <td className="rk-ro">{r.actions}</td>
                      <td className="rk-c">{r.sev}</td>
                      <td className="rk-c">{r.prob}</td>
                    </>
                  )}
                  <td className={'rk-c rk-score rk-' + level(r.score)}>{r.score}</td>
                  {editable && <td className="rk-c"><button className="tlr-del" title="מחיקה" onClick={(e) => { e.stopPropagation(); del(r); }}>✕</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <div className="tlr-empty">אין עדיין סיכונים - מוסיפים בכפתור למטה, והמטריצה נבנית מעצמה</div>}
          {editable && <button className="btn tlr-add" onClick={add}>+ הוספת סיכון</button>}
        </div>

        <div className="rk-matrix-area">
          {title && <div className="tlc-title rk-title">{title}</div>}
          <div className="rk-matrix-box">
            <span className="rk-axis-y"><span>↑</span><span className="rk-axis-y-word">חומרה</span></span>
            <div className="rk-matrix" dir="ltr">
              {[5, 4, 3, 2, 1].map((s) => (
                <div className="rk-row" key={s}>
                  <span className="rk-ax">{s}</span>
                  {nums15.map((p) => {
                    const cell = rows.filter((r) => r.sev === s && r.prob === p);
                    return (
                      <div key={p} className={'rk-cell rk-bg-' + level(s * p)}
                        title={cell.map((r) => `${r.num}. ${r.name}`).join('\n')}>
                        <span className="rk-base">{s * p}</span>
                        {cell.map((r) => (
                          <span key={r.id} className={'rk-chip' + (sel === r.id ? ' sel' : '')}
                            onClick={(e) => { e.stopPropagation(); setSel(r.id); }}>{r.num}</span>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
              <div className="rk-row">
                <span className="rk-ax" />
                {nums15.map((p) => <span key={p} className="rk-ax">{p}</span>)}
              </div>
            </div>
            <span className="rk-axis-x">הסתברות&nbsp;→</span>
          </div>
        </div>
      </div>
    </div>
  );
}
