# Changelog

## Server 6.2.0 · App 1.6
- Embedding field is now 3D: the builder keeps the third principal axis (`field.z`, with `field.variance_share`). Axes 1–3 carry 8.1%, 7.3% and 6.2% of the variance of the 24-dim SVD space, so 3D shows 21.5% against 15.4% for 2D. `nearest` returns `z` with `xy`.
- Every level is a 3D donut: inner hole at 30% of the radius and a thickness of ±45. Axes 1–2 place a node around and across the ring, axis 3 places it in the thickness. Every node, dragged or not, is kept inside its donut.
- Drag moves a node in 3D parallel to the screen, so it follows the pointer from any angle (it used to stop or jump when a level was seen edge-on) and stays exactly where it is dropped. Saved layouts keep the depth.

## App 1.5
- Level-edge toggles: Domain→Topic, Topic→Concept, Concept→Skill, and Related concepts (dashed, off by default), alongside the Skill→Agent and Agent→MCP gate toggles.
- Domains tab in the side list (11 domains).
- Topics generated in the app get a suggested domain (nearest topic by TF-IDF), shown as suggested.
- Saved state now keeps router mode, field, domain filter, edge toggles and browse filters.
- Related-concept pairs from the graph are drawn when enabled.

## Server 6.1.0 · App 1.4

- **Domains are the sixth level of the graph:** one node per domain on a plane above the topics, linked to its topics, with a Domains count in Metrics and a **D** label button. The floating domain captions are gone.
- **Embedding values are visible:** Details shows each node's field location, its value from the current observer, and its nearest nodes on every level; nodes the observer barely explains fade in the embedding field.
- **Domain vectors** are now the centroid of their topics; a domain ranks in `nearest` as its nearest topic.
- `open_context_plane_graph` takes `domain`, `mode` and `field`, and the app applies them.

## App 1.3

- **Domains in the graph:** each topic carries its domain's colour, domains are labelled where their topics are, and a Domains toggle.
- **Observer lens in the app:** a Flat / Observer lens router in Task, computing the same chain as the server's `route_task` mode `lens` (shared test fixture), with a readout of weights, signed support and ruled-out candidates.
- **Embedding field follows the observer:** above the graph it shows the shared field; after a lens route, or a domain, topic or concept choice, each plane below the observer is laid out from where it stands. The current observer is shown beside the toolbar.

## Server 6.0.0 · App 1.2 · Plugin 0.4.0

- **Domains and topics rebuilt from the concepts up.** 11 new domains replace the 5 old ones; 128 topics were formed from what their concepts, skills, agents and MCP servers have in common (all 711 concepts, 1,998 skills, 1,021 agents and 117 servers unchanged). Domain endpoints are now `/mcp/<domain id>` for the 11 domains. Each concept records the topic it came from (`source_topic`).
- **Observer-lens routing.** `route_task` takes `mode: "lens"`: topics are chosen first, then concepts and skills are valued from the chosen nodes with signed support (several chosen nodes add as one superposed observer), and the answer carries the full observer chain. `domains` starts the observer at one or more domains. Flat ranking stays the default.
- App: a **Domain** filter in Browse & select.
- New topic packs get their domain from `regroup.pack_domains` in the spec.

## Server 5.2.0 · App 1.1

- **Shared embedding field.** Every node on all six levels (domain, topic, concept, skill, agent, MCP server) now has a vector in one TF-IDF space and a location in one 2-D field (truncated SVD, same scale for every level). `graph.json` carries the locations; `?index=1` carries all vectors.
- New tool `nearest`: the nearest nodes of any level to a node or a piece of text in that field.
- App: **Embedding field** places every node at its field location on its level.

## Server 5.1.2

- `get_harness` description states what it returns, without directing the model to other tools.

## Server 5.1.1

- Every tool declares `annotations.title` for directory listings.
- App: the task panel shows the route only (agent, server and model choice happen in the Maxey0 orchestrator); legend explains rotate, roll, pan and node drag.

## Server 5.1.0 · App 1.0 · Plugin 0.3.1

- **MCP App.** `open_context_plane_graph` shows the graph inside the conversation in hosts that support MCP Apps; the app takes the task Claude passes in, can go full screen, and sends topic-generation requests to the conversation.
- **Web app** served by the server at `/app`.
- **Plugin** renamed `maxey0-context-plane-graph`.

## Server 5.0.0

- **Maxey0 is one topic** with eight concepts (was three topics). Former topic ids `maxey0-runtime`, `maxey0-memory-context` and `maxey0-assurance` are replaced by `maxey0`.

## Server 4.0.0

- **Two new domains:** Foundations (Location and Place, Environments and Deployment, Time, State, Systems, Infrastructure) and Finance (16 topics, from Accounting to Crypto).
- **Five new work topics:** UI and Front-End Development, Security and Identity, Real Estate and Property, Simulation and Digital Twins, Travel and Outdoors.
- **30 new MCP servers.**
- **Topic generation:** the `topic-graph-generator` prompt and the `validate_topic_pack` tool.

## App 1.0

- One app: task routing with the server's method, best route highlighted, result panel that hides to one line.
- Level rings, spread paths, node dragging that carries the path below it.
- Rotation in any direction, roll, pan, 720° tumble, Fit view.
- Generated topics: add, validate, keep or remove each, view new topics alone.
- State records the map version and the view.

## Server 3.x

- One endpoint per domain plus one for all; `/graph.json` for browser apps; checker agents inherit their primary's servers; permanent MaxeyN keys.
