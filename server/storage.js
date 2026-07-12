// Storage layer: Postgres when DATABASE_URL is set, local files otherwise (zero-setup dev).
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const token = () => crypto.randomBytes(12).toString('base64url');

// ---------- Postgres ----------
async function pgStorage(url) {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    connectionString: url,
    ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
  });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS docs(
      id uuid PRIMARY KEY,
      edit_token text UNIQUE NOT NULL,
      view_token text UNIQUE NOT NULL,
      state bytea,
      updated_at timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS images(
      id uuid PRIMARY KEY,
      doc_id uuid REFERENCES docs(id) ON DELETE CASCADE,
      mime text NOT NULL,
      data bytea NOT NULL
    );`);
  return {
    async createDoc() {
      const doc = { id: crypto.randomUUID(), editToken: token(), viewToken: token() };
      await pool.query('INSERT INTO docs(id, edit_token, view_token) VALUES($1,$2,$3)', [doc.id, doc.editToken, doc.viewToken]);
      return doc;
    },
    async resolveToken(t) {
      const { rows } = await pool.query('SELECT id, edit_token, view_token FROM docs WHERE edit_token=$1 OR view_token=$1', [t]);
      if (!rows[0]) return null;
      const r = rows[0], mode = r.edit_token === t ? 'edit' : 'view';
      return { docId: r.id, mode, editToken: mode === 'edit' ? r.edit_token : undefined, viewToken: r.view_token };
    },
    async loadDoc(id) {
      const { rows } = await pool.query('SELECT state FROM docs WHERE id=$1', [id]);
      return rows[0]?.state || null;
    },
    async saveDoc(id, buf) {
      await pool.query('UPDATE docs SET state=$2, updated_at=now() WHERE id=$1', [id, buf]);
    },
    async saveImage(docId, mime, buf) {
      const id = crypto.randomUUID();
      await pool.query('INSERT INTO images(id, doc_id, mime, data) VALUES($1,$2,$3,$4)', [id, docId, mime, buf]);
      return id;
    },
    async loadImage(id) {
      const { rows } = await pool.query('SELECT mime, data FROM images WHERE id=$1', [id]);
      return rows[0] ? { mime: rows[0].mime, data: rows[0].data } : null;
    },
  };
}

// ---------- Local files (dev fallback) ----------
function fsStorage(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const idxFile = path.join(dir, 'docs.json');
  const idx = fs.existsSync(idxFile) ? JSON.parse(fs.readFileSync(idxFile, 'utf8')) : {};
  const save = () => fs.writeFileSync(idxFile, JSON.stringify(idx));
  const p = (name) => path.join(dir, name);
  return {
    async createDoc() {
      const doc = { id: crypto.randomUUID(), editToken: token(), viewToken: token() };
      idx[doc.id] = { editToken: doc.editToken, viewToken: doc.viewToken };
      save();
      return doc;
    },
    async resolveToken(t) {
      for (const [id, d] of Object.entries(idx)) {
        if (d.editToken === t) return { docId: id, mode: 'edit', editToken: d.editToken, viewToken: d.viewToken };
        if (d.viewToken === t) return { docId: id, mode: 'view', viewToken: d.viewToken };
      }
      return null;
    },
    async loadDoc(id) {
      const f = p(`doc_${id}.bin`);
      return fs.existsSync(f) ? fs.readFileSync(f) : null;
    },
    async saveDoc(id, buf) { fs.writeFileSync(p(`doc_${id}.bin`), buf); },
    async saveImage(docId, mime, buf) {
      const id = crypto.randomUUID();
      fs.writeFileSync(p(`img_${id}`), buf);
      fs.writeFileSync(p(`img_${id}.json`), JSON.stringify({ mime }));
      return id;
    },
    async loadImage(id) {
      if (!/^[\w-]+$/.test(id) || !fs.existsSync(p(`img_${id}`))) return null;
      return { mime: JSON.parse(fs.readFileSync(p(`img_${id}.json`), 'utf8')).mime, data: fs.readFileSync(p(`img_${id}`)) };
    },
  };
}

export async function createStorage() {
  if (process.env.DATABASE_URL) {
    console.log('Storage: PostgreSQL');
    return pgStorage(process.env.DATABASE_URL);
  }
  console.log('Storage: local files (./data) — dev mode');
  return fsStorage(path.resolve('data'));
}
