// Migrated utilities (AT-P2.M4-09)

export function stableStringify(value: any): string {
  const seen = new WeakSet();
  const walk = (v: any): any => {
    if (v === null || typeof v !== 'object') { return v; }
    if (seen.has(v)) { return '__cycle'; }
    seen.add(v);
    if (Array.isArray(v)) { return v.map(walk); }
    const keys = Object.keys(v).sort();
    const out: any = {};
    for (const k of keys) { out[k] = walk((v as any)[k]); }
    return out;
  };
  try { return JSON.stringify(walk(value)); } catch { return '"__err"'; }
}

export function stableHash(obj: any): string {
  try {
    const s = stableStringify(obj);
    let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
    return 'h' + (h >>> 0).toString(16) + ':' + s.length;
  } catch { return 'h0'; }
}

export function deepMerge(base: any, patch: any): any {
  if (patch === undefined) { return base; }
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) { return patch; }
  const out: any = (base && typeof base === 'object' && !Array.isArray(base)) ? { ...base } : {};
  for (const [k,v] of Object.entries(patch)) {
    if (v === null) {
      if (Object.prototype.hasOwnProperty.call(out, k)) { delete out[k]; }
      continue;
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v as any;
    }
  }
  return out;
}

export function computeConfigDiff(a: any, b: any): any | undefined {
  if (a === b) { return undefined; }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length === b.length) {
      let same = true;
      for (let i=0;i<a.length;i++) { if (a[i] !== b[i]) { same = false; break; } }
      if (same) { return undefined; }
    }
    return b;
  }
  const aIsObj = a && typeof a === 'object' && !Array.isArray(a);
  const bIsObj = b && typeof b === 'object' && !Array.isArray(b);
  if (!aIsObj || !bIsObj) { return b; }
  const keys = new Set([...Object.keys(a||{}), ...Object.keys(b||{})]);
  let changed = false; const out: any = {};
  for (const k of keys) {
    const aHas = Object.prototype.hasOwnProperty.call(a, k);
    const bHas = Object.prototype.hasOwnProperty.call(b, k);
    if (aHas && !bHas) { out[k] = null; changed = true; continue; }
    const d = computeConfigDiff(a[k], b[k]);
    if (d !== undefined) { out[k] = d; changed = true; }
  }
  return changed ? out : undefined;
}

export function applyDiff(base: any, diff: any): any {
  if (diff === undefined) { return base; }
  if (diff === null || typeof diff !== 'object' || Array.isArray(diff)) { return diff; }
  const out: any = (base && typeof base === 'object' && !Array.isArray(base)) ? { ...base } : {};
  for (const [k,v] of Object.entries(diff)) { out[k] = applyDiff(out[k], v); }
  return out;
}

if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
  try {
    const a = { x: 1, y: { z: 2, arr: [1,2] } };
    const b = { x: 1, y: { z: 3, arr: [1,2] } };
    const d = computeConfigDiff(a,b);
    const m = applyDiff(a,d);
    if (stableHash(m) !== stableHash(b)) { console.warn('[ai-config-utils] self-test hash mismatch'); }
  } catch {}
}
