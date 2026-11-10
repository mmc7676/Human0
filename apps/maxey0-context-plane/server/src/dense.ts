// Dense second signal: BAAI bge-m3 embeddings from Cloudflare Workers AI, next to the TF-IDF signal in one inner-product
// space (see lens.ts, Space). Node embeddings are computed once per graph digest and kept in KV; the task is embedded per
// route. All embeddings are centred on the mean node embedding and normalised, so a dense cosine is centred near 0 like a
// TF-IDF cosine and the two can be mixed by one weight beta.
//
// Storage (KV namespace DENSE): `bge-m3:<digest>:c<i>` = Float32 raw embeddings of chunk i (CHUNK nodes, in sorted key
// order); `bge-m3:<digest>:full` = Float32 centred, normalised embeddings of every node followed by the mean (one extra
// row). A warm step embeds up to STEP missing chunks; when every chunk exists it assembles `full`. Reads use `full` only,
// cached per isolate. Nothing here is required: with no AI or KV binding, or before `full` exists, routing is TF-IDF only.
import type { GraphData } from "./graph";

export const DENSE_MODEL = "@cf/baai/bge-m3";
export const DIMS = 1024;
const CHUNK = 50, STEP = 8, MAXCHARS = 900;

export interface AiLike { run(model: string, input: { text: string[] }): Promise<unknown> }
export interface KvLike {
  get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
  put(key: string, value: ArrayBuffer): Promise<void>;
  list(opts: { prefix: string }): Promise<{ keys: { name: string }[]; list_complete?: boolean }>;
}
export interface DenseEnv { AI?: AiLike; DENSE?: KvLike }
export interface DenseIndex { keys: string[]; pos: Map<string, number>; M: Float32Array; mean: Float32Array }

/** The text each node is embedded from: what defines it (as for its TF-IDF vector), capped to the model's input. */
export function nodeTexts(g: GraphData): { keys: string[]; text: Map<string, string> } {
  const text = new Map<string, string>(), cap = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, MAXCHARS);
  for (const d of g.domains) text.set("d:" + d.id, cap(`${d.label}. ${d.desc ?? ""}`));
  for (const t of g.topics) text.set("t:" + t.id, cap(`${t.label}. ${t.desc ?? ""}`));
  for (const c of g.concepts) text.set("c:" + c.id, cap(`${c.label}. ${c.desc ?? ""}`));
  for (const s of g.skills) text.set("s:" + s.id, cap(`${s.label}. ${s.desc ?? ""}`));
  const served = new Map<string, string[]>();
  for (const s of g.skills) for (const a of s.agents) { const x = served.get(a.key) ?? []; if (x.length < 8) x.push(s.label); served.set(a.key, x); }
  for (const a of g.agents) text.set("a:" + a.key, cap(`${a.name}. Serves: ${(served.get(a.key) ?? []).join("; ")}`));
  for (const m of g.mcp) text.set("m:" + m.id, cap(`${m.name}. ${m.desc ?? ""} Tools: ${(m.tools ?? []).slice(0, 12).join(", ")}`));
  return { keys: [...text.keys()].sort(), text };
}

const prefix = (digest: string) => `bge-m3:${digest}:`;
const chunkCount = (n: number) => Math.ceil(n / CHUNK);

async function embed(ai: AiLike, texts: string[]): Promise<Float32Array[]> {
  const r = (await ai.run(DENSE_MODEL, { text: texts })) as { data?: number[][] };
  if (!r || !Array.isArray(r.data) || r.data.length !== texts.length) throw new Error("embedding response has no data for every text");
  return r.data.map((v) => { if (v.length !== DIMS) throw new Error(`embedding has ${v.length} dims, expected ${DIMS}`); return Float32Array.from(v); });
}

/** Warm one step: embed up to STEP missing chunks; assemble `full` when all chunks exist. Returns progress. */
export async function warmStep(env: DenseEnv, g: GraphData): Promise<{ ready: boolean; chunks: number; total: number; embedded_now: number }> {
  if (!env.AI || !env.DENSE) return { ready: false, chunks: 0, total: 0, embedded_now: 0 };
  const P = prefix(g.snapshot_digest), { keys, text } = nodeTexts(g), total = chunkCount(keys.length);
  if (await env.DENSE.get(P + "full", "arrayBuffer")) return { ready: true, chunks: total, total, embedded_now: 0 };
  // which chunks exist: a progress bitmap written with each step (read-your-write in the same location), joined with a
  // KV list (eventually consistent, so it can lag behind recent writes)
  const have = new Set<string>();
  const prog = await env.DENSE.get(P + "progress", "arrayBuffer"); if (prog) new Uint8Array(prog).forEach((x, i) => { if (x) have.add(P + "c" + i); });
  const lst = await env.DENSE.list({ prefix: P + "c" }); for (const k of lst.keys) have.add(k.name);
  let now = 0;
  for (let i = 0; i < total && now < STEP; i++) {
    if (have.has(P + "c" + i)) continue;
    const vs = await embed(env.AI, keys.slice(i * CHUNK, (i + 1) * CHUNK).map((k) => text.get(k)!));
    const buf = new Float32Array(vs.length * DIMS); vs.forEach((v, j) => buf.set(v, j * DIMS));
    await env.DENSE.put(P + "c" + i, buf.buffer); have.add(P + "c" + i); now++;
  }
  if (now) { const bm = new Uint8Array(total); for (let i = 0; i < total; i++) bm[i] = have.has(P + "c" + i) ? 1 : 0; await env.DENSE.put(P + "progress", bm.buffer); }
  const done = [...Array(total).keys()].filter((i) => have.has(P + "c" + i)).length;
  if (done < total) return { ready: false, chunks: done, total, embedded_now: now };
  // assemble: centre on the mean node embedding, normalise each row; append the mean as the last row
  const M = new Float32Array((keys.length + 1) * DIMS);
  for (let i = 0; i < total; i++) { const b = await env.DENSE.get(P + "c" + i, "arrayBuffer"); if (!b) return { ready: false, chunks: i, total, embedded_now: now }; M.set(new Float32Array(b), i * CHUNK * DIMS); }
  const mean = new Float32Array(DIMS); for (let r = 0; r < keys.length; r++) for (let j = 0; j < DIMS; j++) mean[j] += M[r * DIMS + j] / keys.length;
  for (let r = 0; r < keys.length; r++) { let n = 0; for (let j = 0; j < DIMS; j++) { const x = M[r * DIMS + j] - mean[j]; M[r * DIMS + j] = x; n += x * x; }
    n = Math.sqrt(n) || 1; for (let j = 0; j < DIMS; j++) M[r * DIMS + j] /= n; }
  M.set(mean, keys.length * DIMS);
  await env.DENSE.put(P + "full", M.buffer);
  return { ready: true, chunks: total, total, embedded_now: now };
}

let CACHE: { digest: string; idx: DenseIndex } | null = null;
/** The index for this graph, or null if it is not built yet. Cached per isolate. */
export async function loadIndex(env: DenseEnv, g: GraphData): Promise<DenseIndex | null> {
  if (CACHE && CACHE.digest === g.snapshot_digest) return CACHE.idx;
  if (!env.DENSE) return null;
  const b = await env.DENSE.get(prefix(g.snapshot_digest) + "full", "arrayBuffer"); if (!b) return null;
  const { keys } = nodeTexts(g), all = new Float32Array(b);
  if (all.length !== (keys.length + 1) * DIMS) return null;
  const idx: DenseIndex = { keys, pos: new Map(keys.map((k, i) => [k, i])), M: all.subarray(0, keys.length * DIMS), mean: all.subarray(keys.length * DIMS) };
  CACHE = { digest: g.snapshot_digest, idx }; return idx;
}
export const rowOf = (idx: DenseIndex, key: string): Float32Array | undefined => { const i = idx.pos.get(key); return i === undefined ? undefined : idx.M.subarray(i * DIMS, (i + 1) * DIMS); };

const QCACHE = new Map<string, Float32Array>();
/** The task's embedding, centred on the same mean and normalised. */
export async function embedTask(env: DenseEnv, idx: DenseIndex, task: string): Promise<Float32Array> {
  const k = task.slice(0, 2000); const hit = QCACHE.get(k); if (hit) return hit;
  const [v] = await embed(env.AI!, [k]); let n = 0; for (let j = 0; j < DIMS; j++) { v[j] -= idx.mean[j]; n += v[j] * v[j]; }
  n = Math.sqrt(n) || 1; for (let j = 0; j < DIMS; j++) v[j] /= n;
  if (QCACHE.size > 256) QCACHE.delete(QCACHE.keys().next().value as string); QCACHE.set(k, v); return v;
}
export const ddot = (a: Float32Array, b: Float32Array) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
