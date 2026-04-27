/** Normalize CSS color strings for comparison (explicit black / theme ink should not read as “custom”). */
export function normalizeCssColorForCompare(raw) {
  if (raw == null || typeof raw !== 'string') return '';
  const s = raw.trim().toLowerCase().replace(/\s/g, '');
  if (s === 'black') return '#000000';
  const hex3 = s.match(/^#([0-9a-f]{3})$/i);
  if (hex3) {
    const x = hex3[1];
    return `#${x[0]}${x[0]}${x[1]}${x[1]}${x[2]}${x[2]}`;
  }
  const hex6 = s.match(/^#([0-9a-f]{6})$/i);
  if (hex6) return `#${hex6[1]}`;
  const rgb = s.match(/^rgba?\((\d+),(\d+),(\d+)\)/i);
  if (rgb) {
    const r = Number(rgb[1]);
    const g = Number(rgb[2]);
    const b = Number(rgb[3]);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
  return s;
}

const DEFAULT_INK_SWATCHES = new Set(['#000000', '#1a1917', '#ffffff', '#f5f5f7']);

export function isDefaultStoredTextColor(color) {
  if (color == null || color === '') return true;
  return DEFAULT_INK_SWATCHES.has(normalizeCssColorForCompare(color));
}
