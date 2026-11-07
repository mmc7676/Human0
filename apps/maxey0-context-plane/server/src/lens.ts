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
// lam per level (topic, concept, skill) was set by the calibrate-then-test run recorded in docs/ARCHITECTURE.md.
import { Vec, vec } from "./sim";

export const LAMBDA = { topic: 0, concept: 0.5, skill: 0.3 } as const;
const BEAM = 3, KEEP = 0.6, BRANCH_DAMP = 0.1;

const dot = (a: Vec, b: Vec) => { let s = 0; const [x, y] = Object.keys(a).length > Object.keys(b).length ? [b, a] : [a, b];
  for (const w in x) { const v = y[w]; if (v !== undefined) s += x[w] * v; } return s; };
const norm = (a: Vec) => Math.sqrt(dot(a, a));
const unit = (a: Vec): Vec => { const n = norm(a); if (!n) return a; const o: Vec = {}; for (const w in a) o[w] = a[w] / n; return o; };
const minus = (a: Vec, b: Vec, k: number): Vec => { const o: Vec = { ...a }; for (const w in b) o[w] = (o[w] ?? 0) - k * b[w]; return o; };
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

export interface LensLevel {
  level: "topic" | "concept" | "skill"; lambda: number;
  selected: { id: string; weight: number; psi: number; contributions: Record<string, number> }[];
  suppressed: { id: string; task_match: number; psi: number; opposed_by: string[] }[];
}
export interface LensResult { chain: LensLevel[]; skills: string[]; remaining_task: number }

export function lensRoute(task: string, idf: Record<string, number>, vectors: Record<string, Vec>,
                          levels: { level: "topic" | "concept" | "skill"; prefix: string; ids: string[] }[],
                          topicAllowed?: (id: string) => boolean): LensResult {
  const q0 = unit(vec(task, idf, false));
  const chain: LensLevel[] = [];
  if (!Object.keys(q0).length) return { chain, skills: [], remaining_task: 0 };
  let q = q0; let state: { id: string; w: number; v: Vec; q: Vec }[] | null = null;
  for (const L of levels) {
    const lam = state && state.length > 1 ? LAMBDA[L.level] * (1 - BRANCH_DAMP * (state.length - 1)) : LAMBDA[L.level];
    const rows: { id: string; psi: number; flat: number; parts: Record<string, number> }[] = [];
    for (const id of L.ids) {
      if (!state && topicAllowed && !topicAllowed(id)) continue;
      const v = unit(vectors[L.prefix + ":" + id] ?? {});
      const flat = dot(v, q0);
      if (!state) { rows.push({ id, psi: dot(v, q), flat, parts: {} }); continue; }
      let psi = 0; const parts: Record<string, number> = {};
      for (const p of state) {
        const a = dot(v, p.v), rn = Math.sqrt(Math.max(1 - a * a, 1e-12)), qn = norm(p.q);
        const s = qn > 1e-9 ? (dot(v, p.q) - a * dot(p.v, p.q)) / (rn * qn) : 0;
        const phi = p.w * (lam * a + (1 - lam) * s); psi += phi; parts[p.id] = phi;
      }
      rows.push({ id, psi, flat, parts });
    }
    rows.sort((x, y) => y.psi - x.psi || (x.id < y.id ? -1 : 1));
    if (!rows.length || rows[0].psi <= 0) break;
    const best = rows[0].psi;
    const sel = rows.slice(0, BEAM).filter((r) => r.psi > 0 && r.psi >= KEEP * best);
    const n = Math.sqrt(sel.reduce((s, r) => s + r.psi * r.psi, 0));
    const next = sel.map((r) => { const v = unit(vectors[L.prefix + ":" + r.id]); return { id: r.id, w: r.psi / n, v, q: minus(q, v, dot(q, v)) }; });
    for (const p of next) q = minus(q, p.v, p.w * p.w * dot(q, p.v));
    const suppressed = state ? [...rows].sort((x, y) => y.flat - x.flat).slice(0, 15)
      .filter((r) => r.psi <= 0.5 * best && Object.values(r.parts).some((x) => x < 0)).slice(0, 3)
      .map((r) => ({ id: r.id, task_match: r4(r.flat), psi: r4(r.psi), opposed_by: Object.keys(r.parts).filter((k) => r.parts[k] < 0) })) : [];
    chain.push({ level: L.level, lambda: r4(lam),
      selected: sel.map((r, i) => ({ id: r.id, weight: r4(next[i].w), psi: r4(r.psi), contributions: Object.fromEntries(Object.entries(r.parts).map(([k, x]) => [k, r4(x)])) })),
      suppressed });
    state = next;
  }
  const done = chain.length === levels.length;
  return { chain, skills: done ? chain[chain.length - 1].selected.map((s) => s.id) : [], remaining_task: r4(norm(q)) };
}
