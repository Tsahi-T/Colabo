import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { Server as Hocuspocus } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import multer from 'multer';
import JSZip from 'jszip';
import { createStorage } from './storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const RETENTION_DAYS = 30;
const storage = await createStorage();

// Retention: purge docs with no edit activity for RETENTION_DAYS — checked once a day.
function cleanupStale() {
  storage.deleteStale(RETENTION_DAYS)
    .then((n) => n && console.log(`Retention: removed ${n} inactive doc(s) (>${RETENTION_DAYS}d)`))
    .catch((e) => console.error('Retention cleanup failed:', e));
}
cleanupStale();
setInterval(cleanupStale, 24 * 60 * 60 * 1000);

// ---------- Realtime sync (Hocuspocus over WebSocket) ----------
const hocuspocus = Hocuspocus.configure({
  debounce: 2000,
  maxDebounce: 10000,
  async onAuthenticate({ token, documentName, connection }) {
    const r = await storage.resolveToken(token);
    if (!r || r.docId !== documentName) throw new Error('unauthorized');
    if (r.mode === 'view') connection.readOnly = true;
  },
  extensions: [
    new Database({
      fetch: ({ documentName }) => storage.loadDoc(documentName),
      store: ({ documentName, state }) => storage.saveDoc(documentName, state),
    }),
  ],
});

// ---------- REST API ----------
const app = express();
app.use(express.json({ limit: '30mb' }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// Liveness/readiness target: intentionally touches nothing (no DB, no Hocuspocus) so a
// storage-layer blip can't fail the probe and cause an unnecessary pod restart — this
// only answers "is the Node process itself alive and serving HTTP".
app.get('/healthz', (req, res) => res.status(200).send('ok'));

const DOC_TYPES = ['doc', 'board', 'timeline', 'risks', 'swot', 'chat', 'tasks', 'sun', 'project', 'debrief', 'discussion', 'meeting1on1', 'goals'];

app.post('/api/docs', async (req, res) => {
  try {
    const type = DOC_TYPES.includes(req.body?.type) ? req.body.type : 'doc';
    const doc = await storage.createDoc(type);
    storage.bump('create:' + type).catch(() => {}); // per-type creation counter (fire-and-forget)
    res.json({ editToken: doc.editToken, viewToken: doc.viewToken });
  } catch (e) {
    console.error('POST /api/docs failed:', e);
    res.status(500).json({ error: 'create failed' });
  }
});

app.get('/api/docs/:token', async (req, res) => {
  try {
    const r = await storage.resolveToken(req.params.token);
    if (!r) return res.status(404).json({ error: 'not found' });
    res.json(r);
  } catch (e) {
    console.error('GET /api/docs/:token failed:', e);
    res.status(500).json({ error: 'lookup failed' });
  }
});

app.post('/api/images', upload.single('image'), async (req, res) => {
  try {
    const r = await storage.resolveToken(req.query.token || '');
    if (!r || r.mode !== 'edit') return res.status(403).json({ error: 'forbidden' });
    if (!req.file || !req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: 'bad image' });
    const id = await storage.saveImage(r.docId, req.file.mimetype, req.file.buffer);
    res.json({ url: `/api/images/${id}` });
  } catch (e) {
    console.error('POST /api/images failed:', e);
    res.status(500).json({ error: 'upload failed' });
  }
});

app.get('/api/images/:id', async (req, res) => {
  try {
    const img = await storage.loadImage(req.params.id);
    if (!img) return res.sendStatus(404);
    res.set('Content-Type', img.mime).set('Cache-Control', 'public, max-age=31536000, immutable').send(img.data);
  } catch (e) {
    console.error('GET /api/images/:id failed:', e);
    res.sendStatus(500);
  }
});

// Anonymous cumulative counters — fire-and-forget telemetry, never fails the caller.
app.post('/api/track', async (req, res) => {
  try { await storage.bump('visit'); } catch (e) { console.error('POST /api/track failed:', e); }
  res.json({ ok: true });
});

// A share link was copied — counted separately for edit vs view-only.
app.post('/api/share', async (req, res) => {
  try {
    const mode = req.body?.mode;
    if (mode === 'edit' || mode === 'view') await storage.bump('share:' + mode);
  } catch (e) { console.error('POST /api/share failed:', e); }
  res.json({ ok: true });
});

app.get('/api/stats', async (req, res) => {
  try {
    const s = await storage.getStats();
    res.json({ ...s, online: hocuspocus.getConnectionsCount() });
  } catch (e) {
    console.error('GET /api/stats failed:', e);
    res.status(500).json({ error: 'stats unavailable' });
  }
});

// html-to-docx has no RTL/bidi support and completely ignores <style> stylesheets (only
// inline style="" survives, and even that only ever produces w:jc — never w:bidi). Every
// paragraph it emits is plain LTR, which is why "text-align:right" alone still rendered
// numerals/headings on the wrong side. Fix it after the fact by editing the OOXML directly:
// every paragraph gets marked bidi + right-justified, every run gets marked rtl, and every
// table gets right-to-left column order — this is exactly how Word itself authors a Hebrew
// RTL document. Also normalizes table borders: html-to-docx gives each cell a 0.125pt border
// (all but invisible once rendered) and only puts a border around a table's outer edge, never
// between rows/columns — replaced with a single visible weight and a full inside grid.
const BORDER_ATTRS = 'w:val="single" w:sz="4" w:space="0" w:color="000000"';
function ensureTableBorders(tblPrInner) {
  if (/<w:tblBorders/.test(tblPrInner)) {
    return tblPrInner.replace(/<w:tblBorders>([\s\S]*?)<\/w:tblBorders>/, (full, sides) =>
      /<w:insideH/.test(sides) ? full : `<w:tblBorders>${sides}<w:insideH ${BORDER_ATTRS}/><w:insideV ${BORDER_ATTRS}/></w:tblBorders>`);
  }
  const sides = ['top', 'bottom', 'left', 'right', 'insideH', 'insideV']
    .map((side) => `<w:${side} ${BORDER_ATTRS}/>`).join('');
  return `<w:tblBorders>${sides}</w:tblBorders>${tblPrInner}`;
}
// html-to-docx emits <w:sectPr> as the FIRST child of <w:body> instead of the last — its only
// schema-valid position there. Word treats a body that doesn't end with sectPr as structurally
// broken and silently "repairs" the file on open, which discards direct paragraph formatting
// wholesale — this is why bidi/jc="right" showed up correctly in the raw XML but never actually
// rendered: Word never got that far before the repair pass stripped it. A section also needs
// its own <w:bidi/> (confirmed by diffing against a Word-native RTL document — every one of
// Word's own RTL docs carries this on the section, not just on each paragraph); without it
// Word doesn't treat the document as fundamentally RTL even with per-paragraph bidi present.
function fixSectPrPosition(xml) {
  const m = xml.match(/<w:sectPr>([\s\S]*?)<\/w:sectPr>/);
  if (!m) return xml;
  const sectPr = /<w:bidi\/>/.test(m[1]) ? m[0] : `<w:sectPr>${m[1]}<w:bidi/></w:sectPr>`;
  const withoutSectPr = xml.replace(m[0], '');
  return withoutSectPr.replace('</w:body>', `${sectPr}</w:body>`);
}
function rtlifyDocumentXml(xml) {
  xml = fixSectPrPosition(xml);
  // Bidi only — NOT jc="right". This looks backwards (jc is literally "alignment: right"), but
  // it's empirically what works: verified by round-tripping through actual Word (COM automation
  // reading ParagraphFormat.Alignment/ReadingOrder back out, then rendering to PDF) that adding
  // an explicit jc="right" alongside bidi makes Word report Alignment=0 (left) for EVERY
  // paragraph carrying it, while bidi alone makes Word report Alignment=2 (right) — Word
  // resolves an RTL paragraph's unset alignment to right on its own, and something about the
  // combination of both properties together breaks that resolution instead of just being
  // redundant. Confirmed the same effect on a minimal 2-paragraph docx, isolating it to this
  // exact combination.
  xml = xml.replace(/<w:jc\s+w:val="[^"]*"\s*\/>/g, ''); // strip any jc html-to-docx already added
  xml = xml.replace(/<w:pPr\s*\/>/g, '<w:pPr><w:bidi/></w:pPr>');
  // schema order for CT_PPrBase: pStyle MUST be the very first child. Unconditionally
  // prepending <w:bidi/> pushed it ahead of pStyle on every styled paragraph — Word doesn't
  // error on that, it just silently drops the whole out-of-order pPr.
  xml = xml.replace(/<w:pPr>([\s\S]*?)<\/w:pPr>/g, (full, inner) => {
    const m = inner.match(/^\s*<w:pStyle[^>]*\/>/);
    const pStyle = m ? m[0] : '';
    const rest = m ? inner.slice(m[0].length) : inner;
    return `<w:pPr>${pStyle}<w:bidi/>${rest}</w:pPr>`;
  });
  // CT_RPr: rtl slots in near the end, right before cs/lang — appending is close enough for
  // the simple runs this converter emits, and Word is tolerant of minor property reordering.
  xml = xml.replace(/<w:rPr\s*\/>/g, '<w:rPr><w:rtl/></w:rPr>');
  xml = xml.replace(/<w:rPr>([\s\S]*?)<\/w:rPr>/g, (full, inner) => (/<w:rtl\/>/.test(inner) ? full : `<w:rPr>${inner}<w:rtl/></w:rPr>`));
  xml = xml.replace(/<w:tblPr\s*\/>/g, () => `<w:tblPr><w:bidiVisual/>${ensureTableBorders('')}</w:tblPr>`);
  xml = xml.replace(/<w:tblPr>([\s\S]*?)<\/w:tblPr>/g, (full, inner) => `<w:tblPr><w:bidiVisual/>${ensureTableBorders(inner)}</w:tblPr>`);
  // normalize the per-cell borders html-to-docx already adds — same weight/color as the table grid
  xml = xml.replace(/<w:(top|bottom|left|right)\s+w:val="[^"]*"\s+w:sz="[^"]*"\s+w:space="[^"]*"\s+w:color="[^"]*"\s*\/>/g,
    (full, side) => `<w:${side} ${BORDER_ATTRS}/>`);
  return xml;
}
async function makeDocxRtl(buf) {
  const zip = await JSZip.loadAsync(buf);
  const docPath = 'word/document.xml';
  const xml = await zip.file(docPath).async('string');
  zip.file(docPath, rtlifyDocumentXml(xml));
  return zip.generateAsync({ type: 'nodebuffer' });
}

app.post('/api/export/docx', async (req, res) => {
  try {
    const { html, title } = req.body;
    if (!html) return res.sendStatus(400);
    // Air-gap guard: html-to-docx downloads <img> URLs; allow only embedded data URIs.
    const safe = html.replace(/<img\b[^>]*>/gi, (tag) => (/\bsrc\s*=\s*["']data:/i.test(tag) ? tag : ''));
    const { default: htmlToDocx } = await import('html-to-docx');
    // html-to-docx always splits a table's width evenly across its column count (no per-column
    // sizing), so a wide task table (8 columns) needs all the horizontal room it can get —
    // narrower side margins than the library's 1.25in portrait default buy real breathing room.
    const buf = await htmlToDocx(safe, null, {
      lang: 'he-IL', font: 'Arial',
      margins: { top: 1440, right: 1080, bottom: 1440, left: 1080, header: 720, footer: 720, gutter: 0 },
      // Default lets a tall row (e.g. a task with a multi-line update-log cell) split across
      // a page break — Word then renders the overflow as an orphaned fragment on the next page
      // with every other cell blank. Forcing rows to stay whole pushes the entire row over
      // instead.
      table: { row: { cantSplit: true } },
    });
    const rtlBuf = await makeDocxRtl(Buffer.from(buf));
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      .set('Content-Disposition', `attachment; filename="${encodeURIComponent(title || 'document')}.docx"`)
      .send(rtlBuf);
  } catch (e) {
    console.error('POST /api/export/docx failed:', e);
    res.status(500).json({ error: 'export failed' });
  }
});

// ---------- Static frontend (client/dist) + SPA fallback ----------
const dist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(dist));
app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));

// ---------- HTTP + WebSocket upgrade ----------
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/collab')) {
    wss.handleUpgrade(req, socket, head, (ws) => hocuspocus.handleConnection(ws, req));
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () => console.log(`טורבו on http://localhost:${PORT}`));

// ---------- Graceful shutdown ----------
// OpenShift sends SIGTERM before killing a pod (rolling deploy, reschedule, scale-down).
// hocuspocus.destroy() force-flushes every open document's pending debounced save to
// Postgres before resolving, so a pod replacement doesn't lose the last few edits.
let shuttingDown = false;
async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received — flushing documents and closing…`);
  const timeout = setTimeout(() => { console.error('Shutdown timed out — forcing exit'); process.exit(1); }, 8000);
  try {
    await hocuspocus.destroy();
    server.close();
  } catch (e) {
    console.error('Error during shutdown:', e);
  } finally {
    clearTimeout(timeout);
    process.exit(exitCode);
  }
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Last-resort safety net: an uncaught error anywhere (a route handler without its own
// try/catch, a stray promise rejection) used to kill the process silently and leave it
// however Node/OpenShift happened to handle it. Now it's logged with a real stack trace,
// and the process exits cleanly so OpenShift's normal pod-restart-on-crash brings it back
// — instead of the process wedging in an undefined state.
process.on('unhandledRejection', (err) => { console.error('Unhandled rejection:', err); shutdown('unhandledRejection', 1); });
process.on('uncaughtException', (err) => { console.error('Uncaught exception:', err); shutdown('uncaughtException', 1); });
