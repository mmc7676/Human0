# Privacy Policy

**Maxey0 Context Plane** (the MCP server), **Maxey0 Context Plane Graph** (the app) and the **maxey0-context-plane-graph** plugin.
Effective 2 November 2026.

## Summary

The service is a read-only map. It has no accounts, asks for no personal information, and stores nothing you send it.

## What is collected

**Requests to the server.** When Claude, another MCP client or your browser calls the server, the request contains what the call needs: for example a task you asked to route, a search term, a node id, or a topic pack to validate. The server uses it to compute the answer and keeps nothing after the response is sent. It writes no request content to logs or storage.

**Hosting logs.** The server runs on Cloudflare Workers. Cloudflare records standard request metadata for operating the service, such as time, path, response status, and network information like IP address and approximate location. These logs are kept for a limited period under Cloudflare's own retention and are used only to keep the service running and fix faults. See [Cloudflare's privacy policy](https://www.cloudflare.com/privacypolicy/).

**The app.** The graph app runs in your browser. Anything you save in it (added topics, uploaded skills and agents, layout and view) is stored in your browser's local storage or in files you export, on your own device. It is never sent to the server. The app's only network request is for the map itself (`/graph.json`) from the same server.

**Inside Claude.** When the app runs inside Claude, a generation request you send with **Ask Claude to generate it** goes into your conversation, which is governed by Anthropic's privacy policy, not this one.

## Use and sharing

Data is used only to answer the request it came with. It is not sold, shared, used for advertising, or used to train models. No third party receives it apart from Cloudflare as the host.

## Plugin

The plugin contains instructions for Claude and the address of this server. It runs no code on your computer, reads no local files, and sends data only to this server, as part of the tool calls described above.

## Children

The service is not directed at children under 13 and collects no information about anyone.

## Changes

Changes to this policy are published in this file with a new effective date.

## Contact

Open an issue at https://github.com/mmc7676/Human0/issues.
