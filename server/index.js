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
const storage = await createStorage();

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

app.post('/api/docs', async (req, res) => {
  const doc = await storage.createDoc(req.body?.type === 'board' ? 'board' : 'doc');
  res.json({ editToken: doc.editToken, viewToken: doc.viewToken });
});

app.get('/api/docs/:token', async (req, res) => {
  const r = await storage.resolveToken(req.params.token);
  if (!r) return res.status(404).json({ error: 'not found' });
  res.json(r);
});

app.post('/api/images', upload.single('image'), async (req, res) => {
  const r = await storage.resolveToken(req.query.token || '');
  if (!r || r.mode !== 'edit') return res.status(403).json({ error: 'forbidden' });
  if (!req.file || !req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: 'bad image' });
  const id = await storage.saveImage(r.docId, req.file.mimetype, req.file.buffer);
  res.json({ url: `/api/images/${id}` });
});

app.get('/api/images/:id', async (req, res) => {
  const img = await storage.loadImage(req.params.id);
  if (!img) return res.sendStatus(404);
  res.set('Content-Type', img.mime).set('Cache-Control', 'public, max-age=31536000, immutable').send(img.data);
});

app.post('/api/track', async (req, res) => {
  const { vid } = req.body || {};
  if (typeof vid === 'string' && /^[\w-]{8,64}$/.test(vid)) {
    await storage.trackVisit(vid, new Date().toISOString().slice(0, 10));
  }
  res.json({ ok: true });
});

app.get('/api/stats', async (req, res) => {
  const s = await storage.getStats();
  res.json({ ...s, online: hocuspocus.getConnectionsCount() });
});

app.post('/api/export/docx', async (req, res) => {
  const { html, title } = req.body;
  if (!html) return res.sendStatus(400);
  // Air-gap guard: html-to-docx downloads <img> URLs; allow only embedded data URIs.
  const safe = html.replace(/<img\b[^>]*>/gi, (tag) => (/\bsrc\s*=\s*["']data:/i.test(tag) ? tag : ''));
  const { default: htmlToDocx } = await import('html-to-docx');
  const buf = await htmlToDocx(safe, null, { lang: 'he-IL', font: 'Arial' });
  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    .set('Content-Disposition', `attachment; filename="${encodeURIComponent(title || 'document')}.docx"`)
    .send(Buffer.from(buf));
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

server.listen(PORT, () => console.log(`COLABO on http://localhost:${PORT}`));
