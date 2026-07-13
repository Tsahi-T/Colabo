import { useState, useEffect, useRef } from 'react';
import { exportHtml, exportDocx, exportPdf } from './export.js';

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
  const name = title || 'מסמך';

  function copy(token, kind) {
    navigator.clipboard.writeText(`${location.origin}/d/${token}`);
    setCopied(kind);
    setTimeout(() => setCopied(''), 1800);
  }

  return (
    <div className="actions">
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
