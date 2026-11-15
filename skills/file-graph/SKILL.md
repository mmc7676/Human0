---
name: file-graph
description: Find files the user uploaded to Claude by name or wildcard (maxey0.csv, maxey0*, *.tsx) and return a clickable graph of each file linked to the chat or project it was uploaded to. Use for /file-graph, "which chat did I upload X to", or browsing uploads beyond Settings > Privacy > Uploaded files.
---

# /file-graph

Turns the user's own upload history (the data behind Settings → Privacy → Uploaded
files → Manage) into a private, navigable graph: **file → chat → project**, every chat
and project node a real link.

## Input

`/file-graph <pattern>` — one argument. Matching is case-insensitive:

| Pattern | Rule | Example matches |
|---|---|---|
| no `*` or `?` | substring (covers exact and partial names) | `maxey0.csv` → `maxey0.csv`, `my_maxey0.csv` |
| contains `*` / `?` | anchored glob; `*` any run, `?` one char | `maxey0*`, `*.tsx`, `img_??.png` |
| empty or `*` | everything | all uploads |

Other characters are literal (`(1).pdf` is not a regex). `collect.js`,
`build_graph.py` and the page use the same rule; a test enforces JS/Python parity.

## Procedure

Scripts live in `scripts/` next to this file. Work in the scratchpad directory.

### 1. Collect (needs a signed-in claude.ai tab)

Source of truth is `GET /api/organizations/{org}/account/files` (cursor-paginated;
each record carries `conversation_uuids` and `project`), plus
`chat_conversations_v2` for chat titles. This is an **undocumented internal API**
observed 2026-10-12. Read-only GETs only.

1. Use the user's preferred browser (built-in browser, else Claude in Chrome). Open
   `https://claude.ai/` in a tab. If it shows a sign-in page, stop and ask the user
   to sign in there; never enter credentials.
2. Run one `javascript_exec` whose text is
   `globalThis.FILE_GRAPH_PATTERN = "<pattern>";` followed by the full contents of
   `scripts/collect.js`. It returns a JSON string (schema `file-graph/v1`) and keeps
   it at `window.__fileGraphJSON`.
3. Size: about 260 characters per matched file. Over ~40,000 characters, read it back
   with `window.__fileGraphJSON.slice(i, i + 40000)` and concatenate. Over ~400
   matches, tell the user the count first and offer a narrower pattern; a huge
   payload round-trips through the conversation twice.
4. Save the exact string to `data.json` with Write.
5. Check `totals`: `truncated: true` → say older uploads may be missing;
   `convs_titled < convs_wanted` → those chats show "(title not returned)" but still
   link correctly.

**API drift.** If a response lacks `files` / `next_cursor`, or a GET is non-200,
report BLOCKED with the status and the keys you saw. Do not guess a new endpoint
shape. Re-discover with the network reader on the Uploaded files page
(`read_network_requests`, urlPattern `/account/files`) and update `collect.js`.

**No browser / signed out / user prefers not to:** use the CSV the user can copy
from the Privacy page (columns Name, Uploaded, Surface, Location) with `--csv`.
The copy/paste loses the "Open chat" links, so the page groups by surface/location
and shows a notice. Say this plainly; do not present CSV output as linked.

### 2. Build

```
python3 scripts/build_graph.py --data data.json --pattern "<pattern>" --out file-graph-<slug>.html
python3 scripts/build_graph.py --data data.json --pattern "<pattern>" --print   # text list with URLs
```
Exit 0 ok · 2 bad input (message on stderr) · 3 no matches (page still written with
an empty state). Standard library only.

### 3. Deliver

- Publish the HTML with the Artifact tool (private by default; icon `graph`). To
  refresh later, publish the same file path, or pass the existing artifact URL.
- Reply: one line of counts (files · chats · projects · no linked chat), then up to
  10 chats as markdown links with their file counts. Do not paste the whole list;
  the page has it.

## The page

Chats are teal squares, projects amber hexagons, files dots coloured by type
(images, documents, data, code, archives, text). Click a node for the inspector
(Open chat ↗ / Open project ↗, file size, upload time, surface). Drag to pan, scroll
to zoom, drag a node to pin it, Fit and Re-layout buttons. "Narrow" re-filters the
embedded set with the same pattern rule. Below the graph, every match is listed by
chat with real links, so nothing depends on the canvas. "No linked chat" collects
uploads whose record lists no chat or project (deleted chats; many Code/Cowork
session uploads). Chat links use `https://claude.ai/chat/{uuid}`, project links
`https://claude.ai/project/{uuid}`.

## Boundaries

- Read-only. Never call DELETE or any write endpoint; never click Delete on the
  Privacy page. Deleting uploads is the user's action.
- The data is the user's private history. Publish only as a private artifact; do
  not share, post or send it anywhere.
- Never invent chat UUIDs, titles or URLs; every link comes from the API record.

## Verify

```
python3 -m unittest discover -s tests -v
```
17 tests: pattern semantics and JS parity, CSV name/size splitting, URL/project
linking, missing titles, schema rejection, HTML-embedding escape, CLI exit codes.
