// file-graph collector — run inside a signed-in https://claude.ai tab (built-in browser
// or Claude in Chrome javascript tool). Read-only: issues GET requests only.
//
// Usage: set globalThis.FILE_GRAPH_PATTERN (default "*") first, then paste the whole file as one javascript_exec call. The last
// expression evaluates to a JSON string (schema file-graph/v1) to save as data.json.
// Projects whose name is "" are referenced (by a chat) but no name was exposed.
//
// Data source (observed 2026-10-12, undocumented internal API — may change):
//   GET /api/organizations/{org}/account/files?limit=100[&cursor=...]
//       -> { files: [{file_uuid, file_name, size_bytes, mime_type, created_at,
//                     surface, conversation_uuids, conversation_session_ids, project}],
//            next_cursor }
//   GET /api/organizations/{org}/chat_conversations_v2?limit=200&offset=N&archived=...
//       -> { data: [{uuid, name, updated_at, project, ...}], has_more }
await (async (PATTERN) => {
  const MAX_FILE_PAGES = 200;   // 100 files/page -> 20,000 files
  const MAX_CONV_PAGES = 50;    // 200 convs/page -> 10,000 chats
  const get = async (url) => {
    const r = await fetch(url, { credentials: "include", headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(`GET ${url.replace(/[0-9a-f-]{36}/g, "{id}")} -> HTTP ${r.status}`);
    return r.json();
  };

  // Same matching rule as build_graph.py: wildcard (* ?) -> anchored glob;
  // otherwise case-insensitive substring. Case-insensitive in both modes.
  const compile = (p) => {
    p = (p ?? "").trim();
    if (p === "" || p === "*") return () => true;
    if (/[*?]/.test(p)) {
      const src = p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
      const re = new RegExp(`^${src}$`, "is");
      return (n) => re.test(n);
    }
    const needle = p.toLowerCase();
    return (n) => n.toLowerCase().includes(needle);
  };
  const match = compile(PATTERN);

  // 1. Organization: the active-org cookie if readable, else the sole/first chat-capable org.
  const orgs = await get("/api/organizations");
  const cookieOrg = (document.cookie.match(/(?:^|;\s*)lastActiveOrg=([^;]+)/) || [])[1];
  const org = orgs.find((o) => o.uuid === cookieOrg)
    || orgs.find((o) => (o.capabilities || []).includes("chat"))
    || orgs[0];
  if (!org) throw new Error("No organization visible to this session (signed out?)");

  // 2. All uploaded files (cursor pagination).
  const files = [];
  let cursor = null, pages = 0;
  for (; pages < MAX_FILE_PAGES; pages++) {
    const q = `/api/organizations/${org.uuid}/account/files?limit=100` + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : "");
    const j = await get(q);
    files.push(...(j.files || []));
    if (!j.next_cursor) { cursor = null; break; }
    if (j.next_cursor === cursor) throw new Error("Pagination cursor did not advance");
    cursor = j.next_cursor;
  }
  const truncated = cursor !== null;

  const matched = files.filter((f) => match(f.file_name || ""));

  // 3. Titles for the conversations the matched files point to (active + archived lists).
  const want = new Set(matched.flatMap((f) => f.conversation_uuids || []));
  const convs = {};
  const projectNames = {};
  for (const archived of [false, true]) {
    for (let p = 0; p < MAX_CONV_PAGES && Object.keys(convs).length < want.size; p++) {
      const j = await get(`/api/organizations/${org.uuid}/chat_conversations_v2?limit=200&offset=${p * 200}&archived=${archived}&consistency=eventual`);
      for (const c of j.data || []) {
        if (!want.has(c.uuid)) continue;
        const pu = c.project?.uuid || c.project_uuid || null;
        convs[c.uuid] = { n: c.name || "", u: c.updated_at || null, p: pu, a: archived };
        if (pu && c.project?.name) projectNames[pu] = c.project.name;
      }
      if (!j.has_more) break;
    }
  }

  const projects = { ...projectNames };
  for (const f of matched) if (f.project?.uuid) projects[f.project.uuid] = f.project.name || projects[f.project.uuid] || "";
  for (const c of Object.values(convs)) if (c.p && !(c.p in projects)) projects[c.p] = "";

  // Kept on window so large results can be read back in slices:
  //   window.__fileGraphJSON.length ; window.__fileGraphJSON.slice(i, i + 40000)
  return (window.__fileGraphJSON = JSON.stringify({
    schema: "file-graph/v1",
    generated_at: new Date().toISOString(),
    source: "claude.ai account/files API",
    pattern: PATTERN,
    totals: { all_files: files.length, matched: matched.length, file_pages: pages + (truncated ? 0 : 1), truncated,
              convs_wanted: want.size, convs_titled: Object.keys(convs).length },
    files: matched.map((f) => ({
      id: f.file_uuid, n: f.file_name, sz: f.size_bytes ?? null, mt: f.mime_type ?? null,
      at: f.created_at ?? null, sf: f.surface ?? null,
      c: f.conversation_uuids || [], p: f.project?.uuid || null,
    })),
    convs, projects,
  }));
})(globalThis.FILE_GRAPH_PATTERN ?? "*");
