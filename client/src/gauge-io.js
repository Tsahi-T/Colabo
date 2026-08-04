// Gauge dashboard <-> CSV (Excel-compatible), one row per gauge.
const esc = (s) => { s = String(s ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const row = (arr) => arr.map(esc).join(',');

function parseCsv(text) {
  const rows = []; let r = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { r.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; r.push(f); f = ''; rows.push(r); r = []; }
    else f += c;
  }
  if (f || r.length) { r.push(f); rows.push(r); }
  return rows;
}

const HEADERS = ['נושא', 'מינימום', 'מקסימום', 'ערך נוכחי', 'סף אדום-צהוב', 'סף צהוב-ירוק', 'צבע נמוך', 'צבע בינוני', 'צבע גבוה', 'יחידה', 'עיצוב'];
const STYLE_KEYS = ['classic', 'full', 'bar'];

export function gaugesToCsv(list) {
  const lines = [row(HEADERS)];
  list.forEach((g) => lines.push(row([g.title, g.min, g.max, g.value, g.th1, g.th2, g.c0, g.c1, g.c2, g.unit || '', g.style || 'classic'])));
  return lines.join('\r\n') + '\r\n';
}

const HEX = /^#[0-9a-f]{6}$/i;

export function csvToGauges(text) {
  const rows = parseCsv(text.replace(/^﻿/, ''));
  return rows.slice(1)
    .filter((r) => r.some((c) => (c || '').trim()))
    .map((r) => ({
      title: (r[0] || '').trim() || 'ללא שם',
      min: Number(r[1]) || 0,
      max: Number(r[2]) || 100,
      value: Number(r[3]) || 0,
      th1: Number(r[4]) || 0,
      th2: Number(r[5]) || 0,
      c0: HEX.test(r[6]) ? r[6] : '#ef4444',
      c1: HEX.test(r[7]) ? r[7] : '#f59e0b',
      c2: HEX.test(r[8]) ? r[8] : '#22c55e',
      unit: (r[9] || '').trim(),
      style: STYLE_KEYS.includes((r[10] || '').trim()) ? r[10].trim() : 'classic',
    }));
}
