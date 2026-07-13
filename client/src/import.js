// Import a file (.docx / .html / .txt) into the editor.
import { uploadImage } from './images.js';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function fileToHtml(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth');
    const { value } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    return value;
  }
  if (name.endsWith('.html') || name.endsWith('.htm')) {
    const doc = new DOMParser().parseFromString(await file.text(), 'text/html');
    return doc.body.innerHTML;
  }
  if (name.endsWith('.txt') || name.endsWith('.md')) {
    return (await file.text()).split(/\r?\n/).map((l) => `<p>${esc(l)}</p>`).join('');
  }
  return null;
}

// Embedded data-URI images bloat the shared document — upload them and swap to server URLs.
async function externalizeImages(html, token) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  await Promise.all([...doc.querySelectorAll('img[src^="data:"]')].map(async (img) => {
    try {
      const blob = await (await fetch(img.src)).blob();
      const url = await uploadImage(blob, token);
      url ? (img.src = url) : img.remove();
    } catch { img.remove(); }
  }));
  return doc.body.innerHTML;
}

export async function importFile(file, editor, token) {
  const html = await fileToHtml(file);
  if (html === null) return alert('פורמט לא נתמך. אפשר לטעון קבצי Word ‏(.docx), HTML או טקסט.');
  if (!editor.isEmpty && !confirm('הטעינה תחליף את התוכן הנוכחי של המסמך. להמשיך?')) return;
  editor.commands.setContent(await externalizeImages(html, token));
}
