# Changelog

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
