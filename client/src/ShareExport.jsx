import { useState, useEffect, useRef } from 'react';
import { exportHtml, exportDocx, exportPdf } from './export.js';
import { importFile } from './import.js';

function Menu({ label, children }) {
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

export default function ShareExport({ info, editor, title }) {
  const [copied, setCopied] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();
  const name = title || 'מסמך';

  function copy(token, kind) {
    navigator.clipboard.writeText(`${location.origin}/d/${token}`);
    setCopied(kind);
    setTimeout(() => setCopied(''), 1800);
  }

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
      {info.mode === 'edit' && (
        <Menu label={copied ? '✓ הועתק!' : 'שיתוף'}>
          <button onClick={() => copy(info.editToken, 'edit')}>קישור לעריכה</button>
          <button onClick={() => copy(info.viewToken, 'view')}>קישור לצפייה בלבד</button>
        </Menu>
      )}
      <Menu label="הורדה">
        <button onClick={() => exportDocx(editor, name)}>Word ‏(.docx)</button>
        <button onClick={() => exportPdf(editor, name)}>PDF (הדפסה)</button>
        <button onClick={() => exportHtml(editor, name)}>HTML</button>
      </Menu>
    </div>
  );
}
