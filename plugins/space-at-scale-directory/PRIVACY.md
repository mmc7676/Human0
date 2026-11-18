# Space-at-Scale — Privacy Policy

Last updated: November 17, 2026

This plugin connects Claude to the Space-at-Scale MCP server that Human0 hosts on Cloudflare Workers at https://space-at-scale-mcp.maxey0.workers.dev/mcp. The server computes simulation answers and the inline 3D app.

- What is sent: when Claude calls a Space-at-Scale tool, the tool name and its arguments (for example "plan a trip to Mars" or a distance in kiloparsecs) are sent to the server. Claude decides what goes into those arguments; the tools never ask for personal information.
- What is kept: nothing. The server has no database and no storage. Comets and generated universes are computed, returned and discarded. Request logging is turned off for this server.
- Accounts: none. The server needs no sign-in, API key or cookie.
- The inline app loads no remote resources; its links to papers and catalogs open only when you click them.
- No data is sold or shared with Human0's partners or any third party. Cloudflare carries the traffic as the hosting provider under its own privacy policy (https://www.cloudflare.com/privacypolicy/).
- The separate web version at https://app.maxey0.com/apps/space-at-scale/ is not part of this plugin and has its own privacy page.

Your conversation with Claude is governed by Anthropic's privacy policy (https://www.anthropic.com/legal/privacy), not this one.

Questions: https://github.com/mmc7676/Human0/issues
