// The site's front page (GET / from a browser): what Maxey0 is, the live counts, and the ways in — the app, Maxey0
// inside Claude (MCP connector), the docs. Plain HTML and CSS, no scripts, no third-party resources.
export function landingHtml(origin: string, s: { domains: number; topics: number; concepts: number; skills: number; agents: number; mcp: number }, version: string): string {
  const n = (x: number) => x.toLocaleString("en-US");
  const repo = "https://github.com/mmc7676/Human0/tree/main/apps/maxey0-context-plane";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Maxey0 — the Context Plane</title>
<meta name="description" content="Maxey0 maps any task to the domain, topic, concept, skill, agents and MCP servers that fit it — live, in 3D, and inside Claude.">
<link rel="icon" href="/logo.png">
<style>
:root{--bg:#071321;--panel:#0c1d30;--ink:#e8f1fb;--dim:#c7d6e0;--acc:#7ee7ff;--btn:#05697a;--line:#ffffff1f}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:980px;margin:0 auto;padding:40px 16px 64px}
header{display:flex;gap:20px;align-items:center;flex-wrap:wrap}
header img{width:96px;height:96px;border-radius:10px;flex:none}
h1{font-size:40px;line-height:1.1;margin:0}h1 small{display:block;font-size:17px;font-weight:500;color:var(--dim);margin-top:8px}
h2{font-size:20px;margin:0 0 8px}p{margin:0 0 12px;color:var(--dim)}
.cta{display:flex;gap:12px;flex-wrap:wrap;margin:28px 0}
a.btn{display:inline-block;padding:12px 18px;border-radius:8px;background:var(--btn);color:#fff;text-decoration:none;font-weight:600}
a.btn.claude{background:#c2410c;color:#fff;border-radius:999px}a.btn.claude:hover{background:#9a3412}a.btn.alt{background:transparent;border:1px solid var(--acc);color:var(--acc)}
a{color:var(--acc)}a:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:8px 0 32px}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:12px}.stat b{display:block;font-size:24px}.stat span{color:var(--dim);font-size:13px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px}
code{background:#00000040;padding:2px 6px;border-radius:4px;font-size:14px;word-break:break-all}
ol{margin:0;padding-left:20px;color:var(--dim)}footer{margin-top:40px;color:var(--dim);font-size:13px}
</style></head><body><main>
<header><img src="/logo.png" alt="Human0 logo" width="96" height="96">
<h1>Maxey0<small>The Context Plane: where any task belongs, and who should handle it.</small></h1></header>
<div class="cta"><a class="btn" href="/app">Open Maxey0</a><a class="btn claude" href="/app#connect">Use Maxey0 inside Claude</a><a class="btn alt" href="/docs">Docs</a><a class="btn alt" href="/research">Research</a><a class="btn alt" href="${repo}">Source</a></div>
<p>Type a task. Maxey0 places it on one path through six levels — domain, topic, concept, skill, the agents in their roles (primary, checker, support), and the MCP servers they hold — and shows that path in a live 3D map. An observer lens reads each level from the one above it and records how far every chosen node drifted to fit the task.</p>
<div class="stats" aria-label="What the plane holds">
<div class="stat"><b>${n(s.domains)}</b><span>domains</span></div><div class="stat"><b>${n(s.topics)}</b><span>topics</span></div>
<div class="stat"><b>${n(s.concepts)}</b><span>concepts</span></div><div class="stat"><b>${n(s.skills)}</b><span>skills</span></div>
<div class="stat"><b>${n(s.agents)}</b><span>agents</span></div><div class="stat"><b>${n(s.mcp)}</b><span>MCP servers</span></div></div>
<div class="grid">
<section class="card"><h2>Use it here</h2><p>The full map runs in your browser: routing, the observer lens, drift, embeddings, search. No account, nothing to install.</p><a href="/app">Open the app →</a></section>
<section class="card" id="claude"><h2>Use it inside Claude</h2><p>Add Maxey0 as a custom connector, then ask Claude to route a task or open the graph.</p>
<ol><li>In Claude: <b>Customize → Connectors → + Add → Add custom connector</b></li><li>Name: <code>Maxey0 Context Plane</code></li><li>URL: <code>${origin}/mcp</code></li><li>Sign-in: none — the server is read-only</li></ol></section>
<section class="card"><h2>Build it with Claude Code</h2><p>Route a task in the app, then <b>Send to Claude Code</b>: you get a project folder with the route, one subagent per chosen agent and the build instructions. Run <code>claude</code> in it.</p></section>
</div>
<footer>Maxey0 Context Plane ${version} · read-only · routes are candidates, not authorizations · concepts, skills and agents are generated and structurally checked, MCP servers are real · <a href="${repo}">Apache-2.0</a> · <a href="/docs">docs</a> · <a href="/research">research</a> · <a href="/graph.json">graph.json</a> · <a href="/?format=json">server info</a></footer>
</main></body></html>`;
}
