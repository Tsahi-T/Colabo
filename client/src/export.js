// Export helpers: HTML / Word / PDF. All offline-safe.
import { bumpDownload } from './identity.js';

const DOC_CSS = `
  body{font-family:'Segoe UI',Arial,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;color:#1f2328;line-height:1.7;direction:rtl;text-align:right}
  p,h1,h2,h3,li{unicode-bidi:plaintext;text-align:right}
  table{border-collapse:collapse;width:100%;margin:1em 0}
  td,th{border:1px solid #cbd5e1;padding:6px 10px;text-align:right}
  th{background:#f1f5f9}
  img{max-width:100%}
  blockquote{border-inline-start:3px solid #cbd5e1;margin-inline-start:0;padding-inline-start:1em;color:#57606a}
  mark{padding:0 2px}
  ul[data-type=taskList]{list-style:none;padding-inline-start:0}
`;

// Replace server image URLs with embedded data URIs so exports are self-contained.
async function inlineImages(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  await Promise.all([...doc.querySelectorAll('img')].map(async (img) => {
    try {
      const blob = await (await fetch(img.getAttribute('src'))).blob();
      img.src = await new Promise((ok) => {
        const r = new FileReader();
        r.onload = () => ok(r.result);
        r.readAsDataURL(blob);
      });
    } catch { /* keep original src */ }
  }));
  return doc.body.innerHTML;
}

const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function fullHtml(body, title) {
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${escHtml(title)}</title><style>${DOC_CSS}</style></head><body>${body}</body></html>`;
}

function download(blob, filename) {
  bumpDownload();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function exportHtml(editor, title) {
  const body = await inlineImages(editor.getHTML());
  download(new Blob([fullHtml(body, title)], { type: 'text/html' }), `${title}.html`);
}

// Server-side RTL fixup (see server/index.js) handles alignment + numeral/heading order for
// the docx path — html-to-docx itself ignores stylesheets and has no RTL/bidi support at all.
//
// Longer than the server's own 20s export ceiling on purpose — this is a pure backstop for the
// network itself hanging (dropped connection, unreachable server), not the normal case. The
// server should always answer (success or its own timeout error) well before this fires.
const DOCX_FETCH_TIMEOUT_MS = 25000;

async function postDocx(html, title) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOCX_FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetch('/api/export/docx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, title }),
      signal: controller.signal,
    });
  } catch (e) {
    return alert(e.name === 'AbortError' ? 'הייצוא ארך זמן רב מדי ובוטל. נסו שוב.' : 'הייצוא נכשל — בדקו את החיבור ונסו שוב.');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) return alert(res.status === 504 ? 'הייצוא ארך זמן רב מדי ובוטל. נסו שוב.' : 'הייצוא נכשל');
  download(await res.blob(), `${title}.docx`);
}

export async function exportDocx(editor, title) {
  await postDocx(fullHtml(await inlineImages(editor.getHTML()), title), title);
}

// For screens that build their own HTML body (no editor instance) — e.g. the debrief screen.
export async function exportDocxHtml(bodyHtml, title) {
  await postDocx(fullHtml(bodyHtml, title), title);
}

export async function exportPdf(editor, title) {
  const body = await inlineImages(editor.getHTML());
  const w = window.open('', '_blank');
  w.document.write(fullHtml(body, title));
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
}
