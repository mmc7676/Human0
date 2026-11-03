// maxey0-context-plane: a read-only MCP server over the SCW1 topic-harness set,
// for Cloudflare Workers (Streamable HTTP, single POST endpoint at /mcp).
//
// Protocol: dual-era.
//   modern  2026-07-28  stateless; version + client info in params._meta on every
//                       request; server/discover; resultType; ttlMs/cacheScope on
//                       cacheable results; MCP-Protocol-Version / Mcp-Method /
//                       Mcp-Name header validation (HeaderMismatch -32020).
//   legacy  2025-11-25, 2025-06-18, 2025-03-26   answered via `initialize`;
//                       no Mcp-Session-Id is ever minted (sessions are optional
//                       in those revisions), so every request stands alone.
import bundleJson from "./scw1.bundle.json";
import ontology from "../../SCW1/ontology.spec.json";
import { Graph, GraphData, ToolError, scopeTo } from "./graph";
import { GENERATOR_PROMPT, generatorText, validatePack } from "./generator";
import { APP_RESOURCE, APP_URI, appHtml, appResourceContents } from "./app";

const SERVER_INFO = { name: "maxey0-context-plane", version: "5.1.0" };
const MODERN = "2026-07-28";
const LEGACY = ["2025-11-25", "2025-06-18", "2025-03-26"];
const SUPPORTED = [MODERN, ...LEGACY];
const LIST_TTL_MS = 3_600_000;

const FULL = bundleJson as unknown as GraphData;
// one Worker, six endpoints: /mcp serves every domain; /mcp/<domain> serves one domain
const SCOPES = ["maxey0-system", "foundations", "work", "finance", "disciplines"] as const;
const GRAPHS: Record<string, Graph> = { all: new Graph(FULL) };
for (const d of SCOPES) GRAPHS[d] = new Graph(scopeTo(FULL, d));
// the graph minus the search index (the index is only needed server-side for search/route_task)
const GRAPH_JSON = JSON.stringify({ ...FULL, similarity: { method: FULL.similarity.method, thresholds: FULL.similarity.thresholds } });
const GRAPH_JSON_INDEX = JSON.stringify(FULL);   // ?index=1: with idf + vectors, so a browser can score tasks the same way

const instructions = (scope: string) =>
  "Maxey0 Context Plane (SCW1), served by Maxey0 and feeding the Human0 app. " +
  (scope === "all" ? "This endpoint serves all " + SCOPES.length + " domains (" + GRAPHS.all.g.topics.length + " topics). "
    : "This endpoint serves only the '" + scope + "' domain (" + GRAPHS[scope].g.topics.length + " topics); /mcp serves all domains. ") +
  "Every thread is domain -> topic -> concept -> skill; each skill has MaxeyN agents (primary/checker/support) and agents hold MCP servers. " +
  "Search, routing, agent->MCP links and related concepts all use one method (TF-IDF cosine). " +
  "Data is fetched on demand: start with list_domains, search or route_task, then pull only the " +
  "concept/skill/agent detail you need. Read-only; routing returns candidate paths, never an authorization. " +
  "Agents here are context records (who should handle a skill, with which tools), not executable agents; " +
  "execution belongs to the orchestrator's agent harness. Concepts, skills and agents are generated hypotheses, not curated knowledge.";

// ---------------------------------------------------------------- tools
type Json = Record<string, unknown>;
const STR = { type: "string" };
const INT = { type: "integer", minimum: 1, maximum: 50 };
const obj = (properties: Json, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });
const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

interface ToolDef { name: string; title: string; description: string; inputSchema: Json; run: (g: Graph, a: Json) => unknown; _meta?: Json }
let REQ_ORIGIN = "https://maxey0-context-plane-mcp.maxey0.workers.dev";   // origin of the request being served (set per request)
const DOM = { type: "string", description: "optional domain filter: maxey0-system | foundations | work | finance | disciplines" };
const PRIO = { type: "boolean", description: "break exact score ties by the declared topic priority (default true)" };
const TOOLS: ToolDef[] = [
  { name: "open_context_plane_graph", title: "Open the Maxey0 Context Plane Graph",
    description: "Show the interactive 3D Maxey0 Context Plane Graph (domains -> topics -> concepts -> skills -> MaxeyN agents -> MCP servers). Optional 'task' routes a task and highlights its best path; optional 'topic_id' opens on one topic. Hosts without MCP Apps get a link to the same app.",
    inputSchema: obj({ task: STR, topic_id: STR }), _meta: { ui: { resourceUri: APP_URI } },
    run: (g, a) => {
      if (a.topic_id !== undefined && !g.g.topics.some((t) => t.id === a.topic_id)) throw new ToolError(`unknown topic_id '${String(a.topic_id)}'`);
      const route = typeof a.task === "string" && a.task ? g.route_task({ task: a.task, limit: 1 }) as Json : null;
      return { app_url: REQ_ORIGIN + "/app", task: a.task ?? null, topic_id: a.topic_id ?? null, best_route: route ? ((route.paths as Json[])[0] ?? null) : null,
        note: "The graph opens in the conversation where the host supports MCP Apps; otherwise open app_url in a browser." };
    } },
  { name: "validate_topic_pack", title: "Validate a topic pack", description: "Check a generated human0.topic-pack/1 (from the topic-graph-generator prompt) against the schema and the live graph: unique ids, 3-8 concepts, one primary and one checker per skill, MCP rows with a verification source. Also lists the nearest existing topics. Validation only; nothing is written.",
    inputSchema: obj({ pack: { type: "object", description: "the pack JSON object" } }, ["pack"]), run: (g, a) => validatePack(g, a.pack) },
  { name: "list_domains", title: "List domains", description: "The root domains (Maxey0 System, Foundations, Work Domains, Finance, Academic Disciplines) with topic counts.",
    inputSchema: obj({}), run: (g) => g.list_domains() },
  { name: "list_topics", title: "List topics", description: "Topic ids, labels and domain. Optional 'query' filters by id/label, 'domain' by domain.",
    inputSchema: obj({ query: STR, domain: DOM }), run: (g, a) => g.list_topics(a as never) },
  { name: "get_topic", title: "Get topic", description: "One topic: domain, priority, concepts (with skill counts) and MCP servers the topic lists. 'related' links a concept to similar concepts in OTHER topics (cosine >= 0.40); concepts within one topic are not cross-linked, so an empty list is normal.",
    inputSchema: obj({ topic_id: STR }, ["topic_id"]), run: (g, a) => g.get_topic(a as never) },
  { name: "get_harness", title: "Get full topic harness", description: "The complete SCW1 topic harness (human0.topic-harness/2). Large; prefer the narrower tools.",
    inputSchema: obj({ topic_id: STR }, ["topic_id"]), run: (g, a) => g.get_harness(a as never) },
  { name: "get_concept", title: "Get concept", description: "One concept with its path (domain/topic), related concepts, and its skills with agents and their MCP servers.",
    inputSchema: obj({ concept_id: STR }, ["concept_id"]), run: (g, a) => g.get_concept(a as never) },
  { name: "get_skill", title: "Get skill", description: "One skill with its path and its agents (role primary/checker/support) and each agent's MCP servers. Each MCP link has a basis: 'derived' (TF-IDF cosine, needs >= 0.10), 'inherited' (the agent is the checker on the skill named in 'via' and holds that skill's primary's servers so it can re-run the work; carries the primary's score. Links belong to the agent, so an agent shown in another role here may hold servers inherited as checker elsewhere) or 'declared' (set in the ontology spec, no score).",
    inputSchema: obj({ skill_id: STR }, ["skill_id"]), run: (g, a) => g.get_skill(a as never) },
  { name: "get_agent", title: "Get agent", description: "One agent: the topics and skills it serves (with role) and its MCP links. Each MCP link has a basis: 'derived' (TF-IDF cosine, needs >= 0.10), 'inherited' (the agent is the checker on the skill named in 'via' and holds that skill's primary's servers so it can re-run the work; carries the primary's score. Links belong to the agent, so an agent shown in another role here may hold servers inherited as checker elsewhere) or 'declared' (set in the ontology spec, no score).",
    inputSchema: obj({ agent_key: STR }, ["agent_key"]), run: (g, a) => g.get_agent(a as never) },
  { name: "get_mcp_server", title: "Get MCP server", description: "One MCP server row (directory listing, not an installed connector), the agents linked to it, and the topics that list it.",
    inputSchema: obj({ mcp_id: STR }, ["mcp_id"]), run: (g, a) => g.get_mcp_server(a as never) },
  { name: "search", title: "Search", description: "Keyword search over concepts and skills; each hit carries its domain/topic/concept path. Optional domain filter.",
    inputSchema: obj({ query: STR, limit: INT, domain: DOM, use_priority: PRIO }, ["query"]), run: (g, a) => g.search(a as never) },
  { name: "route_task", title: "Route task", description: "Map a task to candidate paths domain -> topic -> concept -> skill -> agents -> MCP. Candidates, not an authorization.",
    inputSchema: obj({ task: STR, limit: INT, domain: DOM, use_priority: PRIO }, ["task"]), run: (g, a) => g.route_task(a as never) },
  { name: "children", title: "Children", description: "Children one level down: domain (no parent), topic (parent=domain), concept (parent=topic), skill (parent=concept), agent (parent=skill), mcp (parent=agent).",
    inputSchema: obj({ level: { type: "string", enum: ["domain", "topic", "concept", "skill", "agent", "mcp"] }, parent_id: STR }, ["level"]), run: (g, a) => g.children(a as never) },
  { name: "trace", title: "Trace", description: "Full parent chain and links for any domain, topic, concept, skill, agent or MCP id.",
    inputSchema: obj({ node_id: STR }, ["node_id"]), run: (g, a) => g.trace(a as never) },
];
const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

function validateArgs(schema: Json, args: Json): string | null {
  const props = schema.properties as Record<string, Json>;
  for (const r of (schema.required as string[]) ?? []) if (args[r] === undefined || args[r] === null) return `missing required argument '${r}'`;
  for (const [k, v] of Object.entries(args)) {
    const p = props[k];
    if (!p) return `unknown argument '${k}'`;
    if (p.type === "string" && typeof v !== "string") return `'${k}' must be a string`;
    if (p.type === "integer" && !(Number.isInteger(v))) return `'${k}' must be an integer`;
    if (p.type === "boolean" && typeof v !== "boolean") return `'${k}' must be a boolean`;
    if (p.type === "object" && (typeof v !== "object" || v === null || Array.isArray(v))) return `'${k}' must be an object`;
    if (p.enum && !(p.enum as unknown[]).includes(v)) return `'${k}' must be one of ${(p.enum as string[]).join(", ")}`;
  }
  return null;
}

// ---------------------------------------------------------------- resources
const RESOURCES = [
  { uri: "ctxplane://snapshot", name: "snapshot", title: "SCW1 snapshot", mimeType: "application/json",
    description: "Counts, snapshot digest and topic ids of the served SCW1 harness set." },
  { uri: "ctxplane://ontology", name: "ontology", title: "Maxey0 Context Plane ontology spec", mimeType: "application/json",
    description: "Every structural decision the graph was built from (domains, merges, trims, id rules, MCP linking rule)." },
  ...["domain", "topic", "concept", "skill", "agent", "mcp"].map((lv) => ({
    uri: `ctxplane://level/${lv}`, name: `level-${lv}`, title: `All ${lv} nodes`, mimeType: "application/json",
    description: `Every ${lv} node (ids and labels only).` })),
];
const TEMPLATES = [
  { uriTemplate: "ctxplane://topic/{topic_id}", name: "topic-harness", title: "Full topic harness", mimeType: "application/json",
    description: "The complete human0.topic-harness/1 document for one topic." },
];
function readResource(graph: Graph, uri: string): unknown | undefined {
  if (uri === "ctxplane://snapshot") return graph.snapshot();
  if (uri === "ctxplane://ontology") return ontology;
  let m = /^ctxplane:\/\/level\/([a-z]+)$/.exec(uri);
  if (m) { try { return graph.level(m[1]); } catch { return undefined; } }
  m = /^ctxplane:\/\/topic\/([a-z0-9-]+)$/.exec(uri);
  if (m) { try { return graph.get_harness({ topic_id: m[1] }); } catch { return undefined; } }
  return undefined;
}

// ---------------------------------------------------------------- JSON-RPC
type Id = string | number | null;
interface Rpc { jsonrpc?: string; id?: Id; method?: string; params?: Json }
class RpcError { constructor(public code: number, public message: string, public http = 200, public data?: unknown) {} }

const META = (k: string) => `io.modelcontextprotocol/${k}`;

function capabilities() {
  return { tools: { listChanged: false }, resources: { listChanged: false, subscribe: false }, prompts: { listChanged: false } };
}

function dispatch(scope: string, method: string, p: Json, modern: boolean, legacyVersion: string): Json {
  const graph = GRAPHS[scope];
  const cache = modern ? { ttlMs: LIST_TTL_MS, cacheScope: "public" } : {};
  switch (method) {
    case "server/discover":
      if (!modern) throw new RpcError(-32601, "server/discover is a 2026-07-28 method; legacy clients use initialize");
      return { supportedVersions: SUPPORTED, capabilities: capabilities(), instructions: instructions(scope), ...cache };
    case "initialize": {
      if (modern) throw new RpcError(-32601, "initialize is not part of 2026-07-28; send requests directly with _meta");
      const asked = String(p.protocolVersion ?? "");
      return { protocolVersion: LEGACY.includes(asked) ? asked : LEGACY[0], capabilities: capabilities(),
        serverInfo: SERVER_INFO, instructions: instructions(scope) };
    }
    case "ping":
      if (modern) throw new RpcError(-32601, "ping was removed in 2026-07-28");
      return {};
    case "tools/list":
      return { tools: TOOLS.map(({ name, title, description, inputSchema, _meta }) => ({ name, title, description, inputSchema, annotations: RO, ...(_meta ? { _meta } : {}) })), ...cache };
    case "tools/call": {
      const name = p.name;
      const t = typeof name === "string" ? TOOL_BY_NAME.get(name) : undefined;
      if (!t) throw new RpcError(-32602, `unknown tool '${String(name)}'`);
      const args = (p.arguments ?? {}) as Json;
      if (typeof args !== "object" || Array.isArray(args)) throw new RpcError(-32602, "arguments must be an object");
      const bad = validateArgs(t.inputSchema, args);
      if (bad) return { content: [{ type: "text", text: `invalid arguments: ${bad}` }], isError: true };
      try {
        const res = t.run(graph, args);
        return { content: [{ type: "text", text: JSON.stringify(res) }], structuredContent: res, isError: false };
      } catch (e) {
        if (e instanceof ToolError) return { content: [{ type: "text", text: e.message }], isError: true };
        throw e;
      }
    }
    case "prompts/list":
      return { prompts: [GENERATOR_PROMPT], ...cache };
    case "prompts/get": {
      if (p.name !== GENERATOR_PROMPT.name) throw new RpcError(-32602, `unknown prompt '${String(p.name)}'`);
      const a = (p.arguments ?? {}) as Record<string, string>;
      if (!a.topic) throw new RpcError(-32602, "missing required argument 'topic'");
      return { description: GENERATOR_PROMPT.description, messages: [{ role: "user", content: { type: "text", text: generatorText(graph, a) } }] };
    }
    case "resources/list":
      return { resources: [...RESOURCES, APP_RESOURCE], ...cache };
    case "resources/templates/list":
      return { resourceTemplates: TEMPLATES, ...cache };
    case "resources/read": {
      const uri = String(p.uri ?? "");
      if (uri === APP_URI) return { contents: appResourceContents(REQ_ORIGIN), ...cache };
      const v = readResource(graph, uri);
      // 2026-07-28 uses -32602 for not-found; legacy revisions used -32002
      if (v === undefined) throw new RpcError(modern ? -32602 : -32002, `resource not found: ${uri}`, 200, { uri });
      return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(v) }], ...cache };
    }
    default:
      void legacyVersion;
      throw new RpcError(-32601, `method not found: ${method}`, modern ? 404 : 200);
  }
}

function decodeHeader(v: string | null): string | null {
  if (v === null) return null;
  const m = /^=\?base64\?(.*)\?=$/.exec(v);
  if (!m) return v;
  try { return new TextDecoder().decode(Uint8Array.from(atob(m[1]), (ch) => ch.charCodeAt(0))); } catch { return "\u0000invalid"; }
}

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...extra } });
const rpcErr = (id: Id, e: RpcError) =>
  json({ jsonrpc: "2.0", id, error: { code: e.code, message: e.message, ...(e.data !== undefined ? { data: e.data } : {}) } }, e.http);

interface Env { ALLOWED_ORIGINS?: string }

async function handleMcp(req: Request, env: Env, scope: string): Promise<Response> {
  REQ_ORIGIN = new URL(req.url).origin;
  // DNS-rebinding guard: an Origin header, when present, must be allow-listed.
  const origin = req.headers.get("origin");
  if (origin) {
    const allowed = (env.ALLOWED_ORIGINS ?? "https://claude.ai,https://claude.com").split(",").map((s) => s.trim()).filter(Boolean);
    if (!allowed.includes(origin)) return json({ jsonrpc: "2.0", error: { code: -32600, message: `origin not allowed: ${origin}` } }, 403);
  }
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });

  let msg: Rpc;
  try { msg = (await req.json()) as Rpc; } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }, 400);
  }
  if (!msg || typeof msg !== "object" || Array.isArray(msg) || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return json({ jsonrpc: "2.0", id: (msg as Rpc)?.id ?? null, error: { code: -32600, message: "invalid request" } }, 400);
  }
  const isNotification = !("id" in msg);
  if (isNotification) return new Response(null, { status: 202 });

  const id = msg.id as Id;
  const method = msg.method;
  const params = (msg.params ?? {}) as Json;
  const meta = (params._meta ?? {}) as Json;
  const bodyVersion = meta[META("protocolVersion")];
  const hdrVersion = req.headers.get("mcp-protocol-version");
  const modern = typeof bodyVersion === "string";

  try {
    if (modern) {
      if (!SUPPORTED.includes(bodyVersion) || LEGACY.includes(bodyVersion)) {
        // a legacy version string inside modern _meta is not a mode we serve
        throw new RpcError(-32022, "Unsupported protocol version", 400, { supported: SUPPORTED, requested: bodyVersion });
      }
      const mismatch = (h: string, got: string | null, want: string) =>
        new RpcError(-32020, got === null ? `Header mismatch: required header ${h} is missing`
          : `Header mismatch: ${h} header value '${got}' does not match body value '${want}'`, 400);
      if (hdrVersion !== bodyVersion) throw mismatch("MCP-Protocol-Version", hdrVersion, bodyVersion);
      const hm = req.headers.get("mcp-method");
      if (hm !== method) throw mismatch("Mcp-Method", hm, method);
      const nameField = method === "resources/read" ? params.uri : params.name;
      if (["tools/call", "resources/read", "prompts/get"].includes(method)) {
        const hn = decodeHeader(req.headers.get("mcp-name"));
        if (hn !== String(nameField ?? "")) throw mismatch("Mcp-Name", hn, String(nameField ?? ""));
      }
    } else if (hdrVersion === MODERN) {
      throw new RpcError(-32020, `Header mismatch: MCP-Protocol-Version is ${MODERN} but params._meta lacks ${META("protocolVersion")}`, 400);
    } else if (hdrVersion !== null && !LEGACY.includes(hdrVersion) && method !== "initialize") {
      throw new RpcError(-32022, "Unsupported protocol version", 400, { supported: SUPPORTED, requested: hdrVersion });
    }
    const result = dispatch(scope, method, params, modern, hdrVersion ?? LEGACY[LEGACY.length - 1]);
    if (modern) {
      result.resultType = "complete";
      result._meta = { ...((result._meta as Json) ?? {}), [META("serverInfo")]: SERVER_INFO };
    }
    return json({ jsonrpc: "2.0", id, result });
  } catch (e) {
    if (e instanceof RpcError) return rpcErr(id, e);
    return rpcErr(id, new RpcError(-32603, "internal error", 500));
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/mcp") return handleMcp(req, env, "all");
    const m = /^\/mcp\/([a-z0-9-]+)$/.exec(url.pathname);
    if (m) return GRAPHS[m[1]] && m[1] !== "all" ? handleMcp(req, env, m[1]) : new Response("unknown MCP endpoint; use /mcp or /mcp/<domain>", { status: 404 });
    // read-only graph for browser UIs (the Human0 app): no MCP headers, any origin may read
    if (url.pathname === "/graph.json") {
      const cors = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS" };
      if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
      if (req.method !== "GET") return new Response(null, { status: 405, headers: { allow: "GET, OPTIONS", ...cors } });
      return new Response(url.searchParams.get("index") === "1" ? GRAPH_JSON_INDEX : GRAPH_JSON, { headers: { "content-type": "application/json", "cache-control": "public, max-age=300", ...cors } });
    }
    if (url.pathname === "/app" || url.pathname === "/app/") {
      if (req.method !== "GET" && req.method !== "HEAD") return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
      return new Response(appHtml(url.origin), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300",
        "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors *" } });
    }
    if (url.pathname === "/" && req.method === "GET") {
      return json({ server: SERVER_INFO, supported_versions: SUPPORTED, graph_json: "/graph.json", app: "/app", mcp_app: APP_URI,
        endpoints: { "/mcp": "all domains", ...Object.fromEntries(SCOPES.map((d) => ["/mcp/" + d, d + " only"])) },
        ...GRAPHS.all.snapshot() });
    }
    return new Response("not found", { status: 404 });
  },
};
