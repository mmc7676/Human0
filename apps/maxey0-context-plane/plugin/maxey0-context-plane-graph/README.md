# maxey0-context-plane-graph

Connects Claude to the **Maxey0 Context Plane**: a map of 121 topics in five domains that routes any task to the topic, concept and skill it belongs to, the specialised MaxeyN agents who should handle it, and the MCP servers those agents would use. Ask for the graph and Claude opens the **Maxey0 Context Plane Graph**, an interactive 3D view of the map, inside the conversation.

## What it adds

| | |
|---|---|
| **Connector** | The remote MCP server `https://maxey0-context-plane-mcp.maxey0.workers.dev/mcp`: 15 read-only tools, the `topic-graph-generator` prompt, and the graph as an MCP App |
| **Skill: maxey0-context-plane** | Tells Claude which tool to use for routing, browsing and showing the graph, and how to read the results |
| **Skill: topic-graph-generator** | When a task has no route, Claude writes a new topic pack (real MCP servers only), validates it with the server, and returns it for the graph app |

## Try

- *"Open the Maxey0 Context Plane graph for the task: price a call option."*
- *"Use Maxey0 Context Plane to route: reconcile a bank statement."*
- *"Generate a Maxey0 Context Plane topic for falconry."*

## What it runs and sends

- Nothing runs on your computer: the plugin is Markdown instructions and the server's address.
- Tool calls go only to the server above, carrying what each call needs (a task, a search term, a node id, or a topic pack to validate). The server is read-only, needs no account and stores nothing. See the [privacy policy](https://github.com/mmc7676/Human0/blob/main/apps/maxey0-context-plane/PRIVACY.md).
- The graph app inside Claude loads the map from the same server and nothing else.

Documentation: [user guide](https://github.com/mmc7676/Human0/blob/main/apps/maxey0-context-plane/docs/USER_GUIDE.md).
