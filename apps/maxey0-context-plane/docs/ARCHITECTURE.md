# Architecture

One data set, built once, served three ways.

```
 SCW1/sources/packs/*.pack.json ─┐
 SCW1/sources/maxey0_base.json ──┤
 SCW1/ontology.spec.json ────────┤   tools/build_scw1.py
                                 ▼
          SCW1/scw1.graph.json · SCW1/harnesses/*.harness.json · SCW1/maxey_registry.json
                                 │
                                 ▼   server/src/scw1.bundle.json (graph + TF-IDF index)
 ┌───────────────────── Cloudflare Worker (server/) ──────────────────────┐
 │  /mcp, /mcp/<domain>   MCP tools · prompt · resources · ui:// app       │
 │  /graph.json           the map for browser apps                          │
 │  /app                  the graph app (app/maxey0-context-plane-graph.html)│
 └──────────────────────────────────────────────────────────────────────────┘
          ▲                         ▲                          ▲
     Claude / MCP clients     Claude MCP Apps host          browsers
     (connector, plugin)      (app in the conversation)    (app on the web)
```

## The map

### Sources

Each topic starts as a **topic pack** (`human0.topic-pack/1`): a topic, its concepts, skills with their agents and roles, agent names, MCP server rows, a lexicon and provenance. The Maxey0 base graph adds the Maxey0 system's own concepts and agents. Sources are inputs and are never edited by the build.

### The ontology spec

`SCW1/ontology.spec.json` holds every structural decision: which domain each topic belongs to, topics and concepts that are merged, moved, renamed or dropped, id rules, the similarity method and its thresholds, declared links, topic priority, role overrides, and open questions. Changing the map means changing the spec or a pack and rebuilding.

### The builder

`tools/build_scw1.py build` applies the spec to the sources and refuses to write anything if a rule breaks. It checks, among others:

- every node has exactly one parent, and every thread reaches the skill level;
- each topic has 3–8 concepts and no concept is named like a topic;
- labels and ids are unique;
- every skill has a primary agent;
- every agent key is a MaxeyN key from `SCW1/maxey_registry.json`, which keeps keys permanent across builds (new agents get the next free number);
- every link meets its threshold.

It writes the graph, one harness per topic, a manifest and build report, and the server bundle. The graph carries a SHA-256 digest; the app records it in saved state.

### One similarity method

Search, routing, agent→server links and related concepts all use TF-IDF cosine over one tokenizer (lower case, `[a-z0-9]+` words, stop words and words of two letters or fewer removed, trailing plural *s* folded). Weight = (1 + ln tf) · idf, idf = ln((N + 1)/(df + 1)) + 1, vectors L2-normalised. A pair counts only when it shares at least min(2, terms in the shorter side) words.

| Use | Rule |
|---|---|
| Search and routing | cosine ≥ 0.08 |
| Agent → MCP server | each agent scored by its single best skill; cosine ≥ 0.10; top 2 agents per server |
| Related concepts | different topics, cosine ≥ 0.40 |
| Checker inheritance | a checker holds every server its primary holds on the same skill (`via` records the source) |

The server's `sim.ts` mirrors the builder's tokenizer and vectoriser exactly; a test checks it reproduces every stored vector.

## The server

`server/src/` — TypeScript on Cloudflare Workers, no runtime dependencies.

| File | Role |
|---|---|
| `index.ts` | HTTP routing, MCP JSON-RPC (2026-07-28 stateless and the earlier `initialize`), header validation, tools, resources, prompt, `/graph.json`, `/app` |
| `graph.ts` | The map in memory, scoped per domain endpoint; every tool's logic |
| `sim.ts` | Tokenizer, vectors, cosine with the coverage rule |
| `generator.ts` | The `topic-graph-generator` prompt and `validate_topic_pack` |
| `app.ts` | The graph app as an MCP App resource and as the `/app` page |

The bundle is imported at build time, so the server has no storage and no network calls. A domain endpoint serves a copy of the map trimmed to that domain.

## The app

`app/maxey0-context-plane-graph.html` is one self-contained page (HTML, CSS, JavaScript; no libraries, no external requests other than the map).

It is produced by `app/build_ui.py` from a fixed source page (`app/source/`). Each change is a named replacement at an anchor that must occur exactly once, so the build either applies every change or stops. On load the page fetches `/graph.json?index=1` from the server it came from, converts it to its internal shapes, and uses the server's gates and TF-IDF index, so the page and `route_task` give the same answers.

Rendering is a 2D canvas with its own 3D projection: one 3×3 orientation matrix maps world coordinates to the view, so rotation has no limits. Levels are rings on one vertical axis; a spread path is laid out in world coordinates on each ring; a dragged node's offset is solved in its level's plane and applied to everything downstream of it on the path.

Inside an MCP Apps host the page talks to the host over `postMessage` (Part *The MCP App* in [MCP_SERVER.md](MCP_SERVER.md)); in a browser that code stays idle.

## The plugin

`plugin/maxey0-context-plane-graph/` contains `.claude-plugin/plugin.json`, `.mcp.json` (the remote server, `type: http`) and two skills in Markdown. It runs no code locally.

## Tests

| Suite | Covers |
|---|---|
| `server/test/mcp.test.mjs` | Protocol (both eras), every tool, domain endpoints, resources, prompt, validator, MCP App resource, `/app` |
| `server/test/ontology.test.mjs` | The built map against the spec: structure, keys, thresholds, checker rule, decisions |
| `server/test/sim.test.mjs` | `sim.ts` reproduces every stored vector |
| `app/test_ui.cjs` | The page in Chromium against a local server: load, counts, gates equal the server's, routing equals `route_task`, isolation, spread, drag, rotation, topics, state |
| `app/test_host.cjs` | The page inside a simulated MCP Apps host: handshake, sizing, tool input, full screen, messages |
