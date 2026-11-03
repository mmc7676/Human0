# Development

Requirements: Node.js 20+, Python 3.10+, and for the browser tests Playwright with Chromium.

## Layout

```
SCW1/      the map: sources/, ontology.spec.json, maxey_registry.json, built graph and harnesses
tools/     build_scw1.py (the map builder), new_packs_v4.py (generates the v4 topic packs)
server/    the MCP server (Cloudflare Worker) and its tests
app/       build_ui.py, source/ (fixed input page), the built app, browser tests, screenshots.cjs
plugin/    the Claude plugin
docs/      documentation and images
```

## Build

```bash
python tools/build_scw1.py build      # the map → SCW1/ and server/src/scw1.bundle.json
python app/build_ui.py                # the app → app/maxey0-context-plane-graph.html
```

Both are deterministic: the same inputs give byte-identical outputs.

## Test

```bash
cd server
npm install
npm test                               # server and map tests

npx wrangler dev --port 8794           # in a second terminal: the server locally
cd ../app
node test_ui.cjs                       # the app in Chromium
node test_host.cjs                     # the app inside a simulated MCP Apps host
node screenshots.cjs                   # refresh docs/images
```

## Deploy

```bash
cd server
npx wrangler login                     # once
npx wrangler deploy
```

The Worker bundles the map and the app page at deploy time; rebuild both first when either changed. Check with `GET /` (version and digest) and `GET /app`.

## Add or change a topic

1. Add or edit a pack in `SCW1/sources/packs/` (format: `human0.topic-pack/1`; the `topic-graph-generator` prompt describes it, and `validate_topic_pack` checks it).
2. If the topic belongs to a domain other than Academic Disciplines, list it in `domain_topics` or `work_topics` in `SCW1/ontology.spec.json`.
3. Build, run the tests, deploy.

MCP server rows must be real projects whose existence you have checked; record where in the pack's `provenance.mcp_notes`.

## Release

Raise the server version in `server/src/index.ts`, the plugin version in `plugin/maxey0-context-plane-graph/.claude-plugin/plugin.json`, and add an entry to `CHANGELOG.md`.
