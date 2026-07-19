// Shared print-to-PDF for the non-editor screens (timeline / SWOT / risks).
// Opens a plain, styled HTML doc and triggers the browser's print dialog — "Save as PDF" there
// produces the file. No library, works fully offline.
export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function printDoc(bodyHtml, title, extraCss = '') {
  const w = window.open('', '_blank');
  if (!w) return alert('הדפדפן חסם את חלון ההדפסה — יש לאשר חלונות קופצים ולנסות שוב');
  w.document.write(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    body{font-family:'Segoe UI',Arial,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem;color:#1f2328;line-height:1.6}
    h1{font-size:1.5rem;margin:0 0 1rem}
    ${extraCss}
  </style></head><body>${bodyHtml}</body></html>`);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
}
