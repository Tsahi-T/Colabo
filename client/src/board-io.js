// Board <-> human-readable TXT.
export const PASTELS = {
  'צהוב': '#fef08a', 'כתום': '#fed7aa', 'ורוד': '#fbcfe8', 'אדום': '#fecaca', 'סגול': '#ddd6fe',
  'כחול': '#bfdbfe', 'תכלת': '#a5f3fc', 'ירוק': '#bbf7d0', 'ליים': '#d9f99d', 'אפור': '#e5e7eb',
};
const colorName = (hex) => Object.keys(PASTELS).find((k) => PASTELS[k] === hex) || 'צהוב';

export function boardToTxt(title, notes, edges) {
  const ids = [...notes.keys()];
  const num = new Map(ids.map((id, i) => [id, i + 1]));
  let out = `לוח חשיבה: ${title || 'ללא שם'}\n`;
  for (const id of ids) {
    const n = notes.get(id);
    out += `\n[${num.get(id)}] מיקום: ${Math.round(n.get('x'))},${Math.round(n.get('y'))} | צבע: ${colorName(n.get('color'))} | גודל: ${Math.round(n.get('w'))}x${Math.round(n.get('h'))} | סיבוב: ${n.get('rot') || 0} | שכבה: ${n.get('z') || num.get(id)}\n`;
    if (n.get('title')) out += `# ${n.get('title')}\n`;
    let body = (n.get('text') || '').trimEnd();
    // a titleless note whose text itself starts with "# " would otherwise be indistinguishable
    // from a title line on re-import — tag it with an invisible marker so it round-trips as text.
    if (!n.get('title') && body.startsWith('# ')) body = '​' + body;
    out += body + '\n';
  }
  const lines = [...edges.values()].map((e) => num.get(e.a) && num.get(e.b) ? `${num.get(e.a)} - ${num.get(e.b)}` : null).filter(Boolean);
  if (lines.length) out += `\nחיבורים:\n${lines.join('\n')}\n`;
  return out;
}

export function txtToBoard(txt) {
  const notes = [];
  const edges = [];
  let cur = null, inEdges = false;
  for (const line of txt.split(/\r?\n/)) {
    // rot/z are optional in the regex — files exported before this fix just don't have them,
    // and the caller (Board.jsx) falls back to its old behavior (random tilt, stacking by
    // file order) exactly like it always did when these come back null.
    const head = line.match(/^\[(\d+)\] מיקום: (-?\d+),(-?\d+)(?: \| צבע: (\S+))?(?: \| גודל: (\d+)x(\d+))?(?: \| סיבוב: (-?[\d.]+))?(?: \| שכבה: (\d+))?/);
    if (head) {
      cur = {
        num: +head[1], x: +head[2], y: +head[3], color: PASTELS[head[4]] || PASTELS['צהוב'],
        w: +(head[5] || 190), h: +(head[6] || 170),
        rot: head[7] !== undefined ? +head[7] : null, z: head[8] !== undefined ? +head[8] : null,
        title: '', text: '',
      };
      notes.push(cur);
      continue;
    }
    if (/^חיבורים:/.test(line)) { inEdges = true; cur = null; continue; }
    const edge = inEdges && line.match(/^(\d+)\s*-\s*(\d+)/);
    if (edge) { edges.push([+edge[1], +edge[2]]); continue; }
    if (cur && line.startsWith('# ') && !cur.title && !cur.text) { cur.title = line.slice(2); continue; }
    if (cur) cur.text += (cur.text ? '\n' : '') + line;
  }
  notes.forEach((n) => {
    if (n.text.startsWith('​')) n.text = n.text.slice(1);
    n.text = n.text.trimEnd();
  });
  return { notes, edges };
}
