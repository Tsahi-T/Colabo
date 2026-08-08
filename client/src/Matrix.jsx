import { useEffect, useMemo, useState, useReducer, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { ShareMenu, Menu } from './ShareExport.jsx';
import { ThemeToggle } from './theme.jsx';
import { Logo } from './icons.jsx';
import { PASTELS } from './board-io.js';
import { touchRecent, bumpDownload, bumpReimport } from './identity.js';
import { printElementImage } from './imageExport.js';
import { MATRIX_EXAMPLE_TXT } from './examples.js';

const uid = () => crypto.randomUUID().slice(0, 8);
const colorName = (hex) => Object.keys(PASTELS).find((k) => PASTELS[k] === hex) || 'כחול';
const clamp50 = (n) => Math.min(50, Math.max(-50, Math.round(+n || 0)));
const clampWeight = (n) => Math.min(10, Math.max(1, Math.round(+n || 0)));
const STYLES = { dots: 'נקודות', target: 'מעגלי מיקוד', quadrant: 'רבעים' };
const STYLE_KEYS = Object.keys(STYLES);

const download = (text, name) => {
  bumpDownload();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/plain;charset=utf-8' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};
function autoGrow(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}
// a plain <input>/manually-resized <textarea> hides overflow text past its size — this grows
// downward on its own instead, same convention used by every other screen.
function GrowingField({ className, rows, value, onChange, placeholder }) {
  const ref = useRef();
  useEffect(() => { autoGrow(ref.current); }, [value]);
  return <textarea ref={ref} className={className} rows={rows || 1} placeholder={placeholder} value={value} onChange={onChange} />;
}

// The same underlying x/y data, rendered three different ways — switching "תצוגה" just
// swaps which of these three markers gets drawn, no data changes.
function Marker({ r, sel, onSelect }) {
  const weight = clampWeight(r.weight);
  const style = { left: `${50 + r.x}%`, top: `${50 - r.y}%` };
  if (r.chartStyle === 'dots') {
    const size = 22 + weight * 2.6;
    return (
      <div className={'xy-mark xy-mark-dots' + (sel ? ' sel' : '')} style={{ ...style, width: size, height: size, background: r.color }}
        title={r.name} onClick={(e) => { e.stopPropagation(); onSelect(r.id); }}>
        <span className="xy-mark-num">{r.num}</span>
      </div>
    );
  }
  if (r.chartStyle === 'target') {
    return (
      <div className={'xy-mark xy-mark-target' + (sel ? ' sel' : '')} style={{ ...style, borderInlineStartColor: r.color }}
        onClick={(e) => { e.stopPropagation(); onSelect(r.id); }}>
        <span className="xy-mark-num" style={{ background: r.color }}>{r.num}</span>
        <span className="xy-mark-text">{r.name || '-'}</span>
      </div>
    );
  }
  return (
    <div className={'xy-mark xy-mark-quadrant' + (sel ? ' sel' : '')} style={{ ...style, background: r.color }}
      onClick={(e) => { e.stopPropagation(); onSelect(r.id); }}>
      <span className="xy-mark-num">{r.num}</span>
      <span className="xy-mark-text">{r.name || '-'}</span>
    </div>
  );
}

export default function Matrix({ info, user, token }) {
  const editable = info.mode === 'edit';
  const [, force] = useReducer((c) => c + 1, 0);
  const [status, setStatus] = useState('connecting');
  const [title, setTitle] = useState('');
  const [peers, setPeers] = useState([]);
  const [sel, setSel] = useState(null);
  const fileRef = useRef();

  const ydoc = useMemo(() => new Y.Doc(), []);
  const items = ydoc.getMap('items');
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

  useEffect(() => { touchRecent(token, title, info.mode, 'matrix'); }, [title]);

  const chartStyle = STYLE_KEYS.includes(meta.get('style')) ? meta.get('style') : 'quadrant';
  const axisTop = meta.get('axisTop') || 'ערך גבוה';
  const axisBottom = meta.get('axisBottom') || 'ערך נמוך';
  const axisRight = meta.get('axisRight') || 'ערך גבוה';
  const axisLeft = meta.get('axisLeft') || 'ערך נמוך';

  const rows = [...items.entries()]
    .map(([id, m]) => ({
      id, ord: m.get('ord') || 0, name: m.get('name') || '', x: clamp50(m.get('x')), y: clamp50(m.get('y')),
      weight: clampWeight(m.get('weight')), color: m.get('color') || PASTELS['כחול'], text: m.get('text') || '',
    }))
    .sort((a, b) => a.ord - b.ord || a.id.localeCompare(b.id))
    .map((r, i) => ({ ...r, num: i + 1, chartStyle }));

  function add() {
    const id = uid(), m = new Y.Map();
    ydoc.transact(() => {
      m.set('ord', Math.max(0, ...rows.map((x) => x.ord)) + 1);
      m.set('name', ''); m.set('x', 0); m.set('y', 0); m.set('weight', 3); m.set('color', PASTELS['כחול']); m.set('text', '');
      items.set(id, m);
    });
    setSel(id);
  }
  function del(r) {
    if (r.name && !confirm(`למחוק את "${r.name}"?`)) return;
    items.delete(r.id);
    if (sel === r.id) setSel(null);
  }
  const set = (id, patch) => {
    const m = items.get(id);
    if (!m) return;
    ydoc.transact(() => Object.entries(patch).forEach(([k, v]) => m.set(k, v)));
  };

  // ---- TXT export/import ----
  const exportTxt = () => download(
    `מטריצה: ${title || 'ללא שם'}\n` +
    `תווית עליונה: ${axisTop}\nתווית תחתונה: ${axisBottom}\nתווית ימנית: ${axisRight}\nתווית שמאלית: ${axisLeft}\n` +
    `תצוגה: ${STYLES[chartStyle]}\n\n` +
    rows.map((r) =>
      `[${r.num}] ${r.name.replace(/\n/g, ' / ')} | X: ${r.x} | Y: ${r.y} | משקל: ${r.weight} | צבע: ${colorName(r.color)}\n` +
      `תיאור: ${r.text.replace(/\n/g, ' / ')}\n`
    ).join('\n'), `${title || 'מטריצה'}.txt`);
  const exportPdf = () => printElementImage('.xy-page', { title: title || 'מטריצה', landscape: true });
  function applyMatrixTxt(txt, { skipConfirm = false } = {}) {
    const lines = txt.split(/\r?\n/);
    const parsed = [];
    let cur = null;
    let newAxisTop = '', newAxisBottom = '', newAxisRight = '', newAxisLeft = '', newStyle = '';
    for (const line of lines) {
      const at = line.match(/^תווית עליונה:\s*(.*)/); if (at) { newAxisTop = at[1]; continue; }
      const ab = line.match(/^תווית תחתונה:\s*(.*)/); if (ab) { newAxisBottom = ab[1]; continue; }
      const ar = line.match(/^תווית ימנית:\s*(.*)/); if (ar) { newAxisRight = ar[1]; continue; }
      const al = line.match(/^תווית שמאלית:\s*(.*)/); if (al) { newAxisLeft = al[1]; continue; }
      const st = line.match(/^תצוגה:\s*(.*)/); if (st) { newStyle = st[1].trim(); continue; }
      const h = line.match(/^\[\d+\]\s*(.*?)\s*\|\s*X:\s*(-?\d+)\s*\|\s*Y:\s*(-?\d+)\s*\|\s*משקל:\s*(-?\d+(?:\.\d+)?)\s*\|\s*צבע:\s*(.*)/);
      if (h) { cur = { name: h[1], x: +h[2], y: +h[3], weight: +h[4], color: PASTELS[h[5].trim()] || PASTELS['כחול'], text: '' }; parsed.push(cur); continue; }
      const d = cur && line.match(/^תיאור:\s*(.*)/);
      if (d) { cur.text = d[1]; continue; }
    }
    if (!parsed.length) return alert('לא נמצאו שורות בקובץ');
    if (!skipConfirm && items.size && !confirm('הטעינה תחליף את המטריצה הנוכחית. להמשיך?')) return;
    ydoc.transact(() => {
      if (newAxisTop) meta.set('axisTop', newAxisTop);
      if (newAxisBottom) meta.set('axisBottom', newAxisBottom);
      if (newAxisRight) meta.set('axisRight', newAxisRight);
      if (newAxisLeft) meta.set('axisLeft', newAxisLeft);
      const styleKey = Object.keys(STYLES).find((k) => STYLES[k] === newStyle);
      if (styleKey) meta.set('style', styleKey);
      [...items.keys()].forEach((k) => items.delete(k));
      parsed.forEach((p, i) => {
        const m = new Y.Map();
        m.set('ord', i + 1); m.set('name', p.name); m.set('x', clamp50(p.x)); m.set('y', clamp50(p.y));
        m.set('weight', clampWeight(p.weight)); m.set('color', p.color); m.set('text', p.text);
        items.set(uid(), m);
      });
    });
    setSel(null);
  }
  async function importTxt(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    bumpReimport();
    applyMatrixTxt(await f.text());
  }
  function loadExample() {
    if (!confirm('טעינת דוגמה תחליף את התוכן הנוכחי במסמך זה. להמשיך?')) return;
    applyMatrixTxt(MATRIX_EXAMPLE_TXT, { skipConfirm: true });
    meta.set('title', 'מטריצת תעדוף השפעה/מאמץ - יוזמות 2026');
  }

  return (
    <div className="doc-page">
      <header className="topbar">
        <Link to="/" className="logo-sm" title="חזרה לדף הבית"><Logo size={22} /><span className="logo-word">טורבו</span></Link>
        <input className="title-input" title={title || undefined} placeholder="מטריצה ללא שם" value={title} readOnly={!editable}
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
            <button className="btn" title="טעינת מטריצה לדוגמה, למטרות הכרות עם המערכת" onClick={loadExample}>דוגמה</button>
          </>}
          <Menu label="הורדה">
            <button onClick={exportPdf}>PDF (הדפסה)</button>
            <button onClick={exportTxt}>TXT - לטעינה חוזרת</button>
          </Menu>
          <ShareMenu info={info} />
          <ThemeToggle />
        </div>
      </header>

      <div className="xy-page">
        {editable && (
          <div className="toolbar xy-style-bar">
            <span className="xy-style-l">תצוגה:</span>
            <div className="gz-style-picker xy-style-picker">
              {STYLE_KEYS.map((k) => (
                <button key={k} type="button" className={'gz-style-btn' + (chartStyle === k ? ' sel' : '')}
                  onClick={() => meta.set('style', k)}>{STYLES[k]}</button>
              ))}
            </div>
            <span className="hint" style={{ marginInlineStart: 'auto' }}>ציר X ו-Y בטווח 50- עד 50+, אפס במרכז</span>
          </div>
        )}

        <div className={'xy-stage-wrap xy-style-' + chartStyle}>
          {title && <div className="tlc-title xy-title">{title}</div>}
          <div className="xy-axis-label xy-axis-top">
            {editable ? <GrowingField className="xy-axis-in" value={axisTop} placeholder="תווית עליונה" onChange={(e) => meta.set('axisTop', e.target.value)} /> : <span>{axisTop}</span>}
          </div>
          <div className="xy-axis-label xy-axis-bottom">
            {editable ? <GrowingField className="xy-axis-in" value={axisBottom} placeholder="תווית תחתונה" onChange={(e) => meta.set('axisBottom', e.target.value)} /> : <span>{axisBottom}</span>}
          </div>
          <div className="xy-axis-label xy-axis-right">
            {editable ? <GrowingField className="xy-axis-in" value={axisRight} placeholder="תווית ימנית" onChange={(e) => meta.set('axisRight', e.target.value)} /> : <span>{axisRight}</span>}
          </div>
          <div className="xy-axis-label xy-axis-left">
            {editable ? <GrowingField className="xy-axis-in" value={axisLeft} placeholder="תווית שמאלית" onChange={(e) => meta.set('axisLeft', e.target.value)} /> : <span>{axisLeft}</span>}
          </div>
          <div className="xy-stage" dir="ltr" onClick={() => setSel(null)}>
            <div className="xy-cross xy-cross-v" /><div className="xy-cross xy-cross-h" />
            {chartStyle === 'target' && <><span className="xy-ring xy-ring-1" /><span className="xy-ring xy-ring-2" /><span className="xy-ring xy-ring-3" /></>}
            {rows.map((r) => <Marker key={r.id} r={r} sel={sel === r.id} onSelect={setSel} />)}
            {!rows.length && <div className="sun-empty">{editable ? 'מוסיפים שורה למטה כדי למקם אותה על הגרף' : 'המטריצה ריקה עדיין'}</div>}
          </div>
        </div>

        <div className="xy-rows">
          {rows.map((r) => (
            <div key={r.id} className={'pj-metric-card xy-row-card' + (sel === r.id ? ' sel' : '')} onClick={() => setSel(r.id)}>
              <div className="pj-metric-row1">
                <span className="xy-row-num" style={{ background: r.color }}>{r.num}</span>
                {editable
                  ? <GrowingField className="pj-metric-name-in" value={r.name} placeholder="שם הפריט" onChange={(e) => set(r.id, { name: e.target.value })} />
                  : <b>{r.name || '-'}</b>}
                {editable && <button className="pj-x" onClick={(e) => { e.stopPropagation(); del(r); }}>✕</button>}
              </div>
              <div className="xy-row-row2">
                <label>X ({-50} עד {50}){editable
                  ? <input type="number" min={-50} max={50} className="xy-num-in" value={r.x} onChange={(e) => set(r.id, { x: +e.target.value })} onBlur={(e) => set(r.id, { x: clamp50(e.target.value) })} />
                  : <span>{r.x}</span>}</label>
                <label>Y ({-50} עד {50}){editable
                  ? <input type="number" min={-50} max={50} className="xy-num-in" value={r.y} onChange={(e) => set(r.id, { y: +e.target.value })} onBlur={(e) => set(r.id, { y: clamp50(e.target.value) })} />
                  : <span>{r.y}</span>}</label>
                <label>משקל (1-10){editable
                  ? <input type="number" min={1} max={10} className="xy-num-in" value={r.weight} onChange={(e) => set(r.id, { weight: +e.target.value })} onBlur={(e) => set(r.id, { weight: clampWeight(e.target.value) })} />
                  : <span>{r.weight}</span>}</label>
                <label>צבע
                  {editable ? (
                    <span className="xy-swatches">
                      {Object.entries(PASTELS).map(([name, hex]) => (
                        <button key={hex} type="button" title={name} className={'swatch-sm' + (r.color === hex ? ' sel' : '')}
                          style={{ background: hex }} onClick={(e) => { e.stopPropagation(); set(r.id, { color: hex }); }} />
                      ))}
                    </span>
                  ) : <span className="swatch-sm" style={{ background: r.color }} />}
                </label>
              </div>
              <div className="pj-metric-row3">
                <span className="pj-metric-dod-l">תיאור</span>
                {editable
                  ? <GrowingField rows={2} value={r.text} placeholder="פירוט חופשי על הפריט" onChange={(e) => set(r.id, { text: e.target.value })} />
                  : <p>{r.text || '-'}</p>}
              </div>
            </div>
          ))}
          {!rows.length && <div className="sw-empty">אין עדיין שורות</div>}
          {editable && <button className="btn tlr-add" onClick={add}>+ הוספת שורה</button>}
        </div>
      </div>
    </div>
  );
}
