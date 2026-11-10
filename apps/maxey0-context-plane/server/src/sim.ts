// The one similarity method (mirror of tools/build_scw1.py: tokens / Sim).
// TF-IDF with tf weight 1 + ln(count), idf precomputed by the builder, L2-normalised
// vectors, cosine = dot product. test/sim.test.mjs checks that this tokenizer and
// vectoriser reproduce every stored concept and skill vector.

const STOP = new Set(("a an and the of in on for to with by from as at or into over across its their this that is are be " +
  "using use used via per each all any not no new data").split(" "));

export type Vec = Record<string, number>;

export function tokens(s: string): string[] {
  const out: string[] = [];
  for (const w of String(s).replace(/_/g, " ").toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    if (STOP.has(w) || w.length <= 2) continue;
    out.push(w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
  }
  return out;
}

const round6 = (x: number) => Math.round(x * 1e6) / 1e6;

export function vec(text: string, idf: Record<string, number>, round = true): Vec {
  const tf = new Map<string, number>();
  for (const w of tokens(text)) if (Object.hasOwn(idf, w)) tf.set(w, (tf.get(w) ?? 0) + 1);
  const v: Vec = {};
  let n = 0;
  for (const [w, c] of tf) { const x = (1 + Math.log(c)) * idf[w]; v[w] = x; n += x * x; }
  n = Math.sqrt(n) || 1;
  for (const w of Object.keys(v)) v[w] = round ? round6(v[w] / n) : v[w] / n;
  return v;
}

/** Cosine, counted only when both sides share >= min(2, terms in the shorter side). */
export function cos(a: Vec, b: Vec): number {
  const [x, y] = Object.keys(a).length > Object.keys(b).length ? [b, a] : [a, b];
  let s = 0, shared = 0;
  for (const w in x) if (Object.hasOwn(y, w)) { s += x[w] * y[w]; shared++; }   // own keys only: a word like 'constructor' must not hit Object.prototype
  return shared < Math.min(2, Object.keys(x).length) ? 0 : s;
}
