import { useEffect, useMemo, useState, useReducer, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { ShareMenu } from './ShareExport.jsx';
import { ThemeToggle } from './theme.jsx';
import { Logo } from './icons.jsx';
import { touchRecent } from './identity.js';

const uid = () => crypto.randomUUID().slice(0, 8);
const level = (score) => (score >= 12 ? 'r' : score >= 7 ? 'y' : 'g');
const download = (text, name) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

export default function Risks({ info, user, token }) {
  const editable = info.mode === 'edit';
  const [, force] = useReducer((c) => c + 1, 0);
  const [status, setStatus] = useState('connecting');
  const [title, setTitle] = useState('');
  const [peers, setPeers] = useState([]);
  const [sel, setSel] = useState(null);
  const fileRef = useRef();

  const ydoc = useMemo(() => new Y.Doc(), []);
  const risks = ydoc.getMap('risks');
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

  useEffect(() => { touchRecent(token, title, info.mode, 'risks'); }, [title]);

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
      `[${r.num}] ${r.name} | חומרה: ${r.sev} | הסתברות: ${r.prob} | משוקלל: ${r.score}\nפירוט: ${r.detail.replace(/\n/g, ' / ')}\nפעולות: ${r.actions.replace(/\n/g, ' / ')}\n`
    ).join('\n'), `${title || 'ניהול סיכונים'}.txt`);
  async function importTxt(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const parsed = [];
    let cur = null;
    for (const line of (await f.text()).split(/\r?\n/)) {
      const h = line.match(/^\[\d+\]\s*(.*?)\s*\|\s*חומרה:\s*(\d)\s*\|\s*הסתברות:\s*(\d)/);
      if (h) { cur = { name: h[1], sev: +h[2], prob: +h[3], detail: '', actions: '' }; parsed.push(cur); continue; }
      const d = cur && line.match(/^פירוט:\s*(.*)/);
      if (d) { cur.detail = d[1]; continue; }
      const a = cur && line.match(/^פעולות:\s*(.*)/);
      if (a) { cur.actions = a[1]; continue; }
    }
    if (!parsed.length) return alert('לא נמצאו סיכונים בקובץ');
    if (risks.size && !confirm('הטעינה תחליף את הטבלה הנוכחית. להמשיך?')) return;
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

  const nums15 = [1, 2, 3, 4, 5];

  return (
    <div className="doc-page">
      <header className="topbar">
        <Link to="/" className="logo-sm"><Logo size={24} /></Link>
        <input className="title-input" placeholder="ניהול סיכונים ללא שם" value={title} readOnly={!editable}
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
            <button className="btn" onClick={() => fileRef.current.click()}>טעינה</button>
            <input ref={fileRef} type="file" accept=".txt" hidden onChange={importTxt} />
          </>}
          <button className="btn" onClick={exportTxt}>הורדה</button>
          <ShareMenu info={info} />
          <ThemeToggle />
        </div>
      </header>
      <div className="rk-page">
        <div className="rk-table-wrap">
          <table className="rk-table">
            <thead>
              <tr>
                <th className="rk-c">#</th><th>סיכון</th><th>פירוט</th><th>פעולות לצמצום הסיכון</th>
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
                      <td><input className="rk-in rk-name" placeholder="שם הסיכון…" value={r.name} onChange={(e) => set(r.id, 'name', e.target.value)} /></td>
                      <td><textarea className="rk-in" rows="2" placeholder="פירוט…" value={r.detail} onChange={(e) => set(r.id, 'detail', e.target.value)} /></td>
                      <td><textarea className="rk-in" rows="2" placeholder="פעולות…" value={r.actions} onChange={(e) => set(r.id, 'actions', e.target.value)} /></td>
                      <td className="rk-c"><select className="rk-sel" value={r.sev} onChange={(e) => set(r.id, 'sev', +e.target.value)}>{nums15.map((n) => <option key={n}>{n}</option>)}</select></td>
                      <td className="rk-c"><select className="rk-sel" value={r.prob} onChange={(e) => set(r.id, 'prob', +e.target.value)}>{nums15.map((n) => <option key={n}>{n}</option>)}</select></td>
                    </>
                  ) : (
                    <>
                      <td className="rk-name">{r.name || '—'}</td>
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
          {!rows.length && <div className="tlr-empty">אין עדיין סיכונים — מוסיפים בכפתור למטה, והמטריצה נבנית מעצמה</div>}
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
