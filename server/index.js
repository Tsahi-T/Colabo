import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { Server as Hocuspocus } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import multer from 'multer';
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

const DOC_TYPES = ['doc', 'board', 'timeline', 'risks', 'swot', 'chat', 'tasks', 'sun', 'project'];

app.post('/api/docs', async (req, res) => {
  try {
    const doc = await storage.createDoc(DOC_TYPES.includes(req.body?.type) ? req.body.type : 'doc');
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

const today = () => new Date().toISOString().slice(0, 10);

// Every page load: bumps the raw visit counter, and records the browser as a
// unique-visitor-for-today (idempotent, so repeat loads don't inflate that number).
app.post('/api/track', async (req, res) => {
  try {
    const { vid } = req.body || {};
    const day = today();
    await storage.bumpEvent('visit', '', day);
    if (typeof vid === 'string' && /^[\w-]{8,64}$/.test(vid)) await storage.trackVisit(vid, day);
  } catch (e) {
    console.error('POST /api/track failed:', e);
  }
  res.json({ ok: true }); // never fail the caller — this is fire-and-forget telemetry
});

// One screen opened, counted per tool type.
app.post('/api/open', async (req, res) => {
  try {
    const { type } = req.body || {};
    if (DOC_TYPES.includes(type)) await storage.bumpEvent('open', type, today());
  } catch (e) {
    console.error('POST /api/open failed:', e);
  }
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

app.post('/api/export/docx', async (req, res) => {
  try {
    const { html, title } = req.body;
    if (!html) return res.sendStatus(400);
    // Air-gap guard: html-to-docx downloads <img> URLs; allow only embedded data URIs.
    const safe = html.replace(/<img\b[^>]*>/gi, (tag) => (/\bsrc\s*=\s*["']data:/i.test(tag) ? tag : ''));
    const { default: htmlToDocx } = await import('html-to-docx');
    const buf = await htmlToDocx(safe, null, { lang: 'he-IL', font: 'Arial' });
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      .set('Content-Disposition', `attachment; filename="${encodeURIComponent(title || 'document')}.docx"`)
      .send(Buffer.from(buf));
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
