// Space-at-Scale hosted MCP server for Cloudflare Workers (Streamable HTTP, one POST endpoint at /mcp).
//
// Single source of truth: the tool and resource definitions come from the plugin's own server.js
// (plugins/space-at-scale/server), collected here with a recorder instead of the Node MCP SDK.
//
// Plan switch: env.SCW_TIER = "free" (default) serves only tools that fit the Workers Free 10 ms CPU limit;
// "paid" serves every tool. Which tool needs which plan is data, in server/tiers.json. Moving to Workers Paid is
// one change in wrangler.jsonc (SCW_TIER) and a redeploy; no code changes.
//
// Public mode is fixed on at build time (SCW_PUBLIC=1): comets and generated universes are computed and returned,
// never stored, and the shared clock cannot be changed. Nothing is written anywhere.
import S from "../../../plugins/space-at-scale/server/server.js";
import APP_HTML from "../../../plugins/space-at-scale/server/dist/space-at-scale.html";

const VERSION = "0.16.0";
const SERVER_INFO = { name: "space-at-scale", title: "Space-at-Scale", version: VERSION };
const MODERN = "2026-07-28";
const LEGACY = ["2025-11-25", "2025-06-18", "2025-03-26"];
const SUPPORTED = [MODERN, ...LEGACY];
const LIST_TTL_MS = 3_600_000;
const META = (k) => `io.modelcontextprotocol/${k}`;
const INSTRUCTIONS =
  "Space-at-Scale: call open_space_at_scale first to show the inline 3D app, then answer from the tools, not memory. " +
  "This is the public hosted server: comets and generated universes are returned but not stored, and the clock rate cannot be changed. " +
  "Numbers are computed by the simulation; mining prices are model estimates, not market quotes.";

// ---- collect definitions once per isolate ----
const TITLES = { scw_get: "Get SCW", scw_children: "SCW children", scw_search: "Search SCWs", scw_laws: "SCW laws", scw_inheritance_rules: "SCW inheritance rules",
  scw_relations: "SCW relations", sim_state: "Simulation state", sim_clock: "Simulation clock", run_evals: "Run evals", open_space_at_scale: "Open Space-at-Scale",
  find_mining_targets_parallel: "Find mining targets (parallel universe)", validate_app_dropin: "Validate app drop-in" };
const { z } = S;
function collect(tier) {
  const tools = [], resources = [];
  S.buildServer({
    tier, appHtml: APP_HTML,
    recorder: {
      registerTool(name, config, handler) {
        const schema = z.object(config.inputSchema || {});
        const json = z.toJSONSchema(schema, { io: "input" });
        delete json.$schema;
        // Directory connectors require a title on every tool; derive it from the name unless one is given.
        const title = config.title || TITLES[name] || name.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
        tools.push({ name, config, handler, schema, listed: {
          name, title, description: config.description, inputSchema: json,
          annotations: { title, ...(config.annotations || {}) },
          ...(config._meta ? { _meta: config._meta } : {}) } });
      },
      registerResource(name, uri, meta, handler) { resources.push({ name, uri, meta, handler }); },
    },
  });
  return { tools, byName: new Map(tools.map((t) => [t.name, t])), resources };
}
const TIERS = { free: collect("free"), paid: collect("paid") };
const tierOf = (env) => (env && env.SCW_TIER === "paid" ? "paid" : "free");

class RpcError { constructor(code, message, http = 200, data) { this.code = code; this.message = message; this.http = http; this.data = data; } }
const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...extra } });
const capabilities = () => ({ tools: { listChanged: false }, resources: { listChanged: false, subscribe: false } });

async function dispatch(set, method, p, modern) {
  const cache = modern ? { ttlMs: LIST_TTL_MS, cacheScope: "public" } : {};
  switch (method) {
    case "server/discover":
      if (!modern) throw new RpcError(-32601, "server/discover is a 2026-07-28 method; legacy clients use initialize");
      return { supportedVersions: SUPPORTED, capabilities: capabilities(), instructions: INSTRUCTIONS, ...cache };
    case "initialize": {
      if (modern) throw new RpcError(-32601, "initialize is not part of 2026-07-28; send requests directly with _meta");
      const asked = String(p.protocolVersion ?? "");
      return { protocolVersion: LEGACY.includes(asked) ? asked : LEGACY[0], capabilities: capabilities(), serverInfo: SERVER_INFO, instructions: INSTRUCTIONS };
    }
    case "ping":
      if (modern) throw new RpcError(-32601, "ping was removed in 2026-07-28");
      return {};
    case "tools/list":
      return { tools: set.tools.map((t) => t.listed), ...cache };
    case "tools/call": {
      const t = typeof p.name === "string" ? set.byName.get(p.name) : undefined;
      if (!t) {
        const paidOnly = typeof p.name === "string" && TIERS.paid.byName.has(p.name);
        throw new RpcError(-32602, paidOnly ? `tool '${p.name}' is not offered on this server's current plan` : `unknown tool '${String(p.name)}'`);
      }
      const args = p.arguments ?? {};
      if (typeof args !== "object" || Array.isArray(args)) throw new RpcError(-32602, "arguments must be an object");
      const parsed = t.schema.safeParse(args);
      if (!parsed.success) return { content: [{ type: "text", text: "invalid arguments: " + parsed.error.issues.map((i) => (i.path.join(".") || "(root)") + ": " + i.message).join("; ") }], isError: true };
      const r = await t.handler(parsed.data);
      return { ...r, isError: !!r.isError };
    }
    case "resources/list":
      return { resources: set.resources.map((r) => ({ uri: r.uri, name: r.name, ...(r.meta.description ? { description: r.meta.description } : {}), ...(r.meta.mimeType ? { mimeType: r.meta.mimeType } : {}) })), ...cache };
    case "resources/templates/list":
      return { resourceTemplates: [], ...cache };
    case "resources/read": {
      const uri = String(p.uri ?? "");
      const r = set.resources.find((x) => x.uri === uri);
      if (!r) throw new RpcError(modern ? -32602 : -32002, `resource not found: ${uri}`, 200, { uri });
      return { ...(await r.handler(new URL(uri))), ...cache };
    }
    default:
      throw new RpcError(-32601, `method not found: ${method}`, modern ? 404 : 200);
  }
}

function decodeHeader(v) {
  if (v === null) return null;
  const m = /^=\?base64\?(.*)\?=$/.exec(v);
  if (!m) return v;
  try { return new TextDecoder().decode(Uint8Array.from(atob(m[1]), (ch) => ch.charCodeAt(0))); } catch { return "\u0000invalid"; }
}

async function handleMcp(req, env) {
  const origin = req.headers.get("origin");
  if (origin) {
    const allowed = (env.ALLOWED_ORIGINS ?? "https://claude.ai,https://claude.com").split(",").map((s) => s.trim()).filter(Boolean);
    if (!allowed.includes(origin)) return json({ jsonrpc: "2.0", error: { code: -32600, message: `origin not allowed: ${origin}` } }, 403);
  }
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });
  let msg;
  try { msg = await req.json(); } catch { return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }, 400); }
  if (!msg || typeof msg !== "object" || Array.isArray(msg) || msg.jsonrpc !== "2.0" || typeof msg.method !== "string")
    return json({ jsonrpc: "2.0", id: msg?.id ?? null, error: { code: -32600, message: "invalid request" } }, 400);
  if (!("id" in msg)) return new Response(null, { status: 202 });

  const id = msg.id, method = msg.method, params = msg.params ?? {}, meta = params._meta ?? {};
  const bodyVersion = meta[META("protocolVersion")], hdrVersion = req.headers.get("mcp-protocol-version");
  const modern = typeof bodyVersion === "string";
  try {
    if (modern) {
      if (!SUPPORTED.includes(bodyVersion) || LEGACY.includes(bodyVersion))
        throw new RpcError(-32022, "Unsupported protocol version", 400, { supported: SUPPORTED, requested: bodyVersion });
      const mismatch = (h, got, want) => new RpcError(-32020, got === null ? `Header mismatch: required header ${h} is missing`
        : `Header mismatch: ${h} header value '${got}' does not match body value '${want}'`, 400);
      if (hdrVersion !== bodyVersion) throw mismatch("MCP-Protocol-Version", hdrVersion, bodyVersion);
      const hm = req.headers.get("mcp-method");
      if (hm !== method) throw mismatch("Mcp-Method", hm, method);
      if (["tools/call", "resources/read"].includes(method)) {
        const want = String((method === "resources/read" ? params.uri : params.name) ?? ""), hn = decodeHeader(req.headers.get("mcp-name"));
        if (hn !== want) throw mismatch("Mcp-Name", hn, want);
      }
    } else if (hdrVersion === MODERN) {
      throw new RpcError(-32020, `Header mismatch: MCP-Protocol-Version is ${MODERN} but params._meta lacks ${META("protocolVersion")}`, 400);
    } else if (hdrVersion !== null && !LEGACY.includes(hdrVersion) && method !== "initialize") {
      throw new RpcError(-32022, "Unsupported protocol version", 400, { supported: SUPPORTED, requested: hdrVersion });
    }
    const result = await dispatch(TIERS[tierOf(env)], method, params, modern);
    if (modern) { result.resultType = "complete"; result._meta = { ...(result._meta ?? {}), [META("serverInfo")]: SERVER_INFO }; }
    return json({ jsonrpc: "2.0", id, result });
  } catch (e) {
    const err = e instanceof RpcError ? e : new RpcError(-32603, "internal error", 500);
    return json({ jsonrpc: "2.0", id, error: { code: err.code, message: err.message, ...(err.data !== undefined ? { data: err.data } : {}) } }, err.http);
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/mcp") return handleMcp(req, env || {});
    if (url.pathname === "/healthz") {
      const t = tierOf(env);
      return json({ ok: true, server: SERVER_INFO, tier: t, tools: TIERS[t].tools.length, all_tools: TIERS.paid.tools.length,
        paid_only: TIERS.paid.tools.map((x) => x.name).filter((n) => !TIERS[t].byName.has(n)) });
    }
    if (url.pathname === "/") return new Response("Space-at-Scale MCP server. Connect an MCP client to /mcp. Health: /healthz\n", { headers: { "content-type": "text/plain; charset=utf-8" } });
    return new Response("not found", { status: 404 });
  },
};
