// The Maxey0 Context Plane Graph app, served two ways from this Worker:
//  - GET /app : a public web page (anyone with the link)
//  - MCP App  : tool open_context_plane_graph + ui:// resource, rendered inside Claude and other MCP Apps hosts
// The page is the tested build app/maxey0-context-plane-graph.html; it reads the graph from this same Worker.
import APP_HTML from "../../app/maxey0-context-plane-graph.html";

export const APP_URI = "ui://maxey0-context-plane/graph.html";
export const APP_MIME = "text/html;profile=mcp-app";
const LIVE = "https://maxey0-context-plane-mcp.maxey0.workers.dev";

/** The page with its graph source pointed at the Worker that serves it. */
export function appHtml(origin: string): string {
  return origin && origin !== LIVE ? APP_HTML.split(LIVE).join(origin) : APP_HTML;
}

export const APP_RESOURCE = {
  uri: APP_URI, name: "context-plane-graph", title: "Maxey0 Context Plane Graph",
  mimeType: APP_MIME, description: "Interactive 3D graph of the Maxey0 Context Plane (MCP App).",
};

export function appResourceContents(origin: string) {
  return [{
    uri: APP_URI, mimeType: APP_MIME, text: appHtml(origin),
    // the page fetches /graph.json from this Worker; nothing else leaves the sandbox
    _meta: { ui: { csp: { connectDomains: [origin] }, prefersBorder: true } },
  }];
}
