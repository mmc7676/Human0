// Observer-lens routing. The observer starts above the topic plane (optionally at one or more domains),
// selects topics, and then reads each lower plane from where it stands: a candidate x is valued from each
// selected node p by
//   a      = cos(x, p)                                 how much of x the observer's position already explains
//   s      = cos(x - a*p, q_p)                         what x adds beyond p, against what is left of the task
//   phi_p  = lam * a + (1 - lam) * s                    s is signed: a residual can point away from the task
//   psi(x) = sum_p w_p * phi_p                          several selected nodes = one superposed observer
// Candidates are ranked by psi itself (never squared) and selected only when psi > 0; up to BEAM nodes within
// KEEP of the best stay selected, with weights normalised so sum w^2 = 1. After each level the task loses the
// part the selected nodes explain. Every selection records each branch's contribution, and the strongest
// task matches that the lens suppressed are listed with the branches that suppressed them.
//
// Levels below the skill (agent, MCP server) are structural: their candidates are only the children of the nodes
// selected above (a skill's agents; an agent's gated servers), and the same psi chooses among them.
//
// Drift. Every selected node also records how far the observer moved it from where it stands seen from above:
//   flat       = cos(x, original task)          its score with no observer
//   flat_rank  = its rank among the level's candidates by flat
//   lens_rank  = its rank by psi
//   drift      = psi - flat                      how much the path above raised (+) or lowered (-) its fit
//   a_obs      = sum_p w_p cos(x, p)             its alignment with the observer that selected it
// and each level records the task it received and the task it passed on (norms) and the share it explained.
// These are exact values in the full TF-IDF space; any 2D/3D picture of them is a projection.
// lam per level (topic, concept, skill) was set by the calibrate-then-test run recorded in docs/ARCHITECTURE.md. The agent
// lam was calibrated the same way (task = a skill's description; hit = the routed skill's primary agent chosen first;
// 300 calibration + 300 held-out skills): calibration 0.5 -> 0.453, 0.9 -> 0.570, 1.0 -> 0.580; held-out 0.5 -> 0.403,
// 0.9 -> 0.463, 1.0 -> 0.493. 0.9 is kept rather than 1.0 so the task residual still counts at this level. The MCP level
// has no ground truth to calibrate against and uses the agent value.
import { Vec, vec } from "./sim";

export const LAMBDA = { topic: 0, concept: 0.5, skill: 0.3, agent: 0.9, mcp: 0.9 } as const;
export type LensLevelName = keyof typeof LAMBDA;
const BEAM = 3, KEEP = 0.6, BRANCH_DAMP = 0.1;
/** With a dense signal, psi is evaluated for the SHORTLIST best candidates of a level by flat hybrid score (all of a
 *  structural level's children are always kept). It bounds the work per route; ranks seen from above still cover all. */
export const SHORTLIST = 300;

const dot = (a: Vec, b: Vec) => { let s = 0; const [x, y] = Object.keys(a).length > Object.keys(b).length ? [b, a] : [a, b];
  for (const w in x) if (Object.hasOwn(y, w)) s += x[w] * y[w]; return s; };   // own keys only ('constructor' is a word here)
const unitS = (a: Vec): Vec => { const n = Math.sqrt(dot(a, a)); if (!n) return a; const o: Vec = {}; for (const w in a) o[w] = a[w] / n; return o; };
const minusS = (a: Vec, b: Vec, k: number): Vec => { const o: Vec = { ...a }; for (const w in b) o[w] = (Object.hasOwn(o, w) ? o[w] : 0) - k * b[w]; return o; };
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

// ---- one inner-product space for both signals. A vector is (s, d): s the sparse TF-IDF part, d the dense part (unit,
// centred embedding) or null. <x, y> = (1 - beta) <x.s, y.s> + beta <x.d, y.d>. With no dense signal the space is exactly
// the TF-IDF space (no arithmetic is added), so every route without dense is bit-for-bit what it was.
interface HV { s: Vec; d: Float32Array | null }
class Space {
  constructor(readonly beta: number, readonly dense: boolean) {}
  dot(a: HV, b: HV): number {
    if (!this.dense) return dot(a.s, b.s);
    let t = 0; if (a.d && b.d) { const x = a.d, y = b.d; for (let i = 0; i < x.length; i++) t += x[i] * y[i]; }
    return (1 - this.beta) * dot(a.s, b.s) + this.beta * t;
  }
  norm(a: HV) { return Math.sqrt(Math.max(0, this.dot(a, a))); }
  unit(a: HV): HV { const n = this.norm(a); if (!n) return a;
    const s: Vec = {}; for (const w in a.s) s[w] = a.s[w] / n;
    let d: Float32Array | null = null; if (a.d) { d = new Float32Array(a.d.length); for (let i = 0; i < d.length; i++) d[i] = a.d[i] / n; }
    return { s, d }; }
  minus(a: HV, b: HV, k: number): HV {
    const s = minusS(a.s, b.s, k);
    if (!this.dense || (!a.d && !b.d)) return { s, d: a.d };
    const L = (a.d ?? b.d)!.length, d = new Float32Array(L);
    for (let i = 0; i < L; i++) d[i] = (a.d ? a.d[i] : 0) - k * (b.d ? b.d[i] : 0);
    return { s, d };
  }
}

/** The dense second signal for one route: the task's embedding and a lookup of each node's (unit, centred) embedding. */
export interface DenseSignal { beta: number; q: Float32Array; get: (key: string) => Float32Array | undefined; model: string }

export interface LensDrift { flat: number; flat_rank: number; lens_rank: number; drift: number; a_obs: number }
export interface LensLevel {
  level: LensLevelName; lambda: number; candidates: number;
  task_in: number; task_out: number; explained: number;
  selected: { id: string; weight: number; psi: number; contributions: Record<string, number>; drift: LensDrift }[];
  suppressed: { id: string; task_match: number; psi: number; opposed_by: string[] }[];
}
export interface LensResult { chain: LensLevel[]; skills: string[]; agents: string[]; mcp: string[]; remaining_task: number; dense?: { model: string; beta: number; shortlist: number } }
export interface LensLevelSpec { level: LensLevelName; prefix: string; ids: string[]; children?: (parent: string) => string[] }

export function lensRoute(task: string, idf: Record<string, number>, vectors: Record<string, Vec>,
                          levels: LensLevelSpec[], topicAllowed?: (id: string) => boolean,
                          lambda: Partial<Record<LensLevelName, number>> = {}, dense?: DenseSignal): LensResult {
  const S = new Space(dense ? dense.beta : 0, !!dense);
  const nodeV = (key: string): HV => dense ? S.unit({ s: unitS(vectors[key] ?? {}), d: dense.get(key) ?? null }) : { s: unitS(vectors[key] ?? {}), d: null };
  const qs = unitS(vec(task, idf, false));
  const chain: LensLevel[] = [];
  const empty: LensResult = { chain, skills: [], agents: [], mcp: [], remaining_task: 0 };
  if (!Object.keys(qs).length && !dense) return empty;
  const q0: HV = dense ? S.unit({ s: qs, d: dense.q }) : { s: qs, d: null };
  let q = q0; let state: { id: string; w: number; v: HV; q: HV }[] | null = null;
  for (const L of levels) {
    const base = lambda[L.level] ?? LAMBDA[L.level];
    const lam = state && state.length > 1 ? base * (1 - BRANCH_DAMP * (state.length - 1)) : base;
    let ids = L.ids;
    if (state && L.children) { const seen = new Set<string>(); ids = [];
      for (const p of state) for (const c of L.children(p.id)) if (!seen.has(c)) { seen.add(c); ids.push(c); } }
    if (!state && topicAllowed) ids = ids.filter((id) => topicAllowed(id));
    // every candidate's flat score (seen from above); with dense, psi only for the shortlist
    const all = ids.map((id) => { const v = nodeV(L.prefix + ":" + id); return { id, v, flat: S.dot(v, q0) }; });
    const flatOrder = [...all].sort((x, y) => y.flat - x.flat || (x.id < y.id ? -1 : 1));
    const flatRank = new Map(flatOrder.map((r, i) => [r.id, i + 1]));
    const pool = dense && !L.children && all.length > SHORTLIST ? flatOrder.slice(0, SHORTLIST) : all;
    const rows: { id: string; psi: number; flat: number; aobs: number; parts: Record<string, number> }[] = [];
    for (const { id, v, flat } of pool) {
      if (!state) { rows.push({ id, psi: S.dot(v, q), flat, aobs: 0, parts: {} }); continue; }
      let psi = 0, aobs = 0; const parts: Record<string, number> = {};
      for (const p of state) {
        const a = S.dot(v, p.v), rn = Math.sqrt(Math.max(1 - a * a, 1e-12)), qn = S.norm(p.q);
        const s = qn > 1e-9 ? (S.dot(v, p.q) - a * S.dot(p.v, p.q)) / (rn * qn) : 0;
        const phi = p.w * (lam * a + (1 - lam) * s); psi += phi; parts[p.id] = phi; aobs += p.w * a;
      }
      rows.push({ id, psi, flat, aobs, parts });
    }
    rows.sort((x, y) => y.psi - x.psi || (x.id < y.id ? -1 : 1));
    if (!rows.length || rows[0].psi <= 0) break;
    const best = rows[0].psi;
    const sel = rows.slice(0, BEAM).filter((r) => r.psi > 0 && r.psi >= KEEP * best);
    const n = Math.sqrt(sel.reduce((s, r) => s + r.psi * r.psi, 0));
    const taskIn = S.norm(q);
    const next = sel.map((r) => { const v = nodeV(L.prefix + ":" + r.id); return { id: r.id, w: r.psi / n, v, q: S.minus(q, v, S.dot(q, v)) }; });
    for (const p of next) q = S.minus(q, p.v, p.w * p.w * S.dot(q, p.v));
    const taskOut = S.norm(q);
    const rowOf = new Map(rows.map((r) => [r.id, r]));
    const suppressed = state ? flatOrder.slice(0, 15).map((r) => rowOf.get(r.id)).filter((r): r is NonNullable<typeof r> => !!r)
      .filter((r) => r.psi <= 0.5 * best && Object.values(r.parts).some((x) => x < 0)).slice(0, 3)
      .map((r) => ({ id: r.id, task_match: r4(r.flat), psi: r4(r.psi), opposed_by: Object.keys(r.parts).filter((k) => r.parts[k] < 0) })) : [];
    chain.push({ level: L.level, lambda: r4(lam), candidates: all.length, task_in: r4(taskIn), task_out: r4(taskOut),
      explained: taskIn > 1e-9 ? r4(1 - taskOut / taskIn) : 0,
      selected: sel.map((r, i) => ({ id: r.id, weight: r4(next[i].w), psi: r4(r.psi),
        contributions: Object.fromEntries(Object.entries(r.parts).map(([k, x]) => [k, r4(x)])),
        drift: { flat: r4(r.flat), flat_rank: flatRank.get(r.id)!, lens_rank: i + 1, drift: r4(r.psi - r.flat), a_obs: r4(r.aobs) } })),
      suppressed });
    state = next;
  }
  const pick = (lv: LensLevelName) => { const l = chain.find((x) => x.level === lv); return l ? l.selected.map((s) => s.id) : []; };
  const skillDone = chain.some((l) => l.level === "skill");
  return { chain, skills: skillDone ? pick("skill") : [], agents: pick("agent"), mcp: pick("mcp"), remaining_task: r4(S.norm(q)),
    ...(dense ? { dense: { model: dense.model, beta: dense.beta, shortlist: SHORTLIST } } : {}) };
}
