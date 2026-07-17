import { useState, useEffect, useRef } from 'react';
import { exportHtml, exportDocx, exportPdf } from './export.js';
import { importFile } from './import.js';

export function Menu({ label, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div className="menu" ref={ref}>
      <button className="btn" onClick={() => setOpen(!open)}>{label}</button>
      {open && <div className="menu-items" onClick={() => setOpen(false)}>{children}</div>}
    </div>
  );
}

export function ShareMenu({ info }) {
  const [copied, setCopied] = useState('');
  if (info.mode !== 'edit') return null;
  function copy(token) {
    navigator.clipboard.writeText(`${location.origin}/d/${token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <Menu label={copied ? '✓ הועתק!' : 'שיתוף'}>
      <button onClick={() => copy(info.editToken)}>קישור לעריכה</button>
      <button onClick={() => copy(info.viewToken)}>קישור לצפייה בלבד</button>
    </Menu>
  );
}

export default function ShareExport({ info, editor, title }) {
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();
  const name = title || 'מסמך';

  async function pickFile(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    setLoading(true);
    try { await importFile(f, editor, info.editToken); } finally { setLoading(false); }
  }

  return (
    <div className="actions">
      {info.mode === 'edit' && (
        <>
          <button className="btn" disabled={loading} onClick={() => fileRef.current.click()}>
            {loading ? 'טוען…' : 'טעינה'}
          </button>
          <input ref={fileRef} type="file" accept=".docx,.html,.htm,.txt,.md" hidden onChange={pickFile} />
        </>
      )}
      <ShareMenu info={info} />
      <Menu label="הורדה">
        <button onClick={() => exportDocx(editor, name)}>Word ‏(.docx)</button>
        <button onClick={() => exportPdf(editor, name)}>PDF (הדפסה)</button>
        <button onClick={() => exportHtml(editor, name)}>HTML</button>
      </Menu>
    </div>
  );
}
