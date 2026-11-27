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
2. Give the new topic a domain: add `"<topic id>": "<domain id>"` to `regroup.pack_domains` in `SCW1/ontology.spec.json`, or place its concepts in existing topics under `regroup.topics`. The build fails for any concept with no place.
3. Build, run the tests, deploy.

MCP server rows must be real projects whose existence you have checked; record where in the pack's `provenance.mcp_notes`.

## Add a runnable skill

A runnable skill is an Agent Skill that an agent can follow, not only a label in the map.

1. Create `SCW1/skills/<skill id>/SKILL.md`. The folder name is the skill id: lowercase letters, digits and single hyphens, at most 64 characters.
2. Start it with frontmatter: `name` (equal to the folder name), `description` (1 to 1,024 characters, no `<` or `>`; it is also the text routing scores), and a `metadata` block with `context-plane-concept` (an existing concept id), `context-plane-label`, `context-plane-type` and `context-plane-agents` (space-separated `MaxeyN:role` items, with exactly one `primary` and one `checker`).
3. Write the body: inputs, steps with exact commands and values, a check for the checker agent, boundaries, and the sources you read with the date.
4. Build. The build fails on any rule above and on a concept that isn't in the graph. The skill joins its concept, `get_skill` serves the file, and routes to it are marked `runnable`.
5. Route the tasks it is for and check that it comes first; if it doesn't, sharpen the label or the description.

## Release

Raise the server version in `server/src/index.ts`, the plugin version in `plugin/maxey0-context-plane-graph/.claude-plugin/plugin.json`, and add an entry to `CHANGELOG.md`.
