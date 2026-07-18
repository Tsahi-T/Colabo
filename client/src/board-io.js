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
    out += `\n[${num.get(id)}] מיקום: ${Math.round(n.get('x'))},${Math.round(n.get('y'))} | צבע: ${colorName(n.get('color'))} | גודל: ${Math.round(n.get('w'))}x${Math.round(n.get('h'))}\n`;
    if (n.get('title')) out += `# ${n.get('title')}\n`;
    out += (n.get('text') || '').trimEnd() + '\n';
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
    const head = line.match(/^\[(\d+)\] מיקום: (-?\d+),(-?\d+)(?: \| צבע: (\S+))?(?: \| גודל: (\d+)x(\d+))?/);
    if (head) {
      cur = { num: +head[1], x: +head[2], y: +head[3], color: PASTELS[head[4]] || PASTELS['צהוב'], w: +(head[5] || 190), h: +(head[6] || 170), title: '', text: '' };
      notes.push(cur);
      continue;
    }
    if (/^חיבורים:/.test(line)) { inEdges = true; cur = null; continue; }
    const edge = inEdges && line.match(/^(\d+)\s*-\s*(\d+)/);
    if (edge) { edges.push([+edge[1], +edge[2]]); continue; }
    if (cur && line.startsWith('# ') && !cur.title && !cur.text) { cur.title = line.slice(2); continue; }
    if (cur) cur.text += (cur.text ? '\n' : '') + line;
  }
  notes.forEach((n) => { n.text = n.text.trimEnd(); });
  return { notes, edges };
}
