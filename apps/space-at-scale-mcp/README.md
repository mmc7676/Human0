# Space-at-Scale hosted MCP server (Cloudflare Worker)

Serves the Space-at-Scale MCP server at `https://space-at-scale-mcp.maxey0.workers.dev/mcp` for the directory edition of the plugin (`plugins/space-at-scale-directory`).

## One source of truth

The tools, the inline app and the physics come from `plugins/space-at-scale/server`. `src/worker.js` collects the same tool definitions that the local plugin registers and serves them over Streamable HTTP. `build.mjs` bundles everything into `dist/worker.js`, which is committed, so deploying needs no build step.

## Plans

| `SCW_TIER` in `wrangler.jsonc` | Cloudflare plan | Tools |
|---|---|---|
| `"free"` (default) | Workers Free, 10 ms CPU per request | 22 |
| `"paid"` | Workers Paid, 30 s CPU per request by default | all 25 |

Which tool needs which plan is data in `plugins/space-at-scale/server/tiers.json`. The local plugin always has every tool.

The test (`npm test`) runs every tool and fails if a free-plan tool uses 6 ms of CPU or more in Node, which leaves room under Cloudflare's 10 ms. If a change pushes a tool over, move it to `paid` in `tiers.json`.

## Deploy (free plan)

```
cd apps/space-at-scale-mcp
npm ci
npx wrangler deploy
```

Check: `https://space-at-scale-mcp.maxey0.workers.dev/healthz` shows `"tier":"free","tools":22`.

## Upgrade to the paid plan later

1. In the Cloudflare dashboard, switch the account to Workers Paid.
2. In `wrangler.jsonc`, change `"SCW_TIER": "free"` to `"SCW_TIER": "paid"`.
3. Run `npx wrangler deploy`.

Check: `/healthz` shows `"tier":"paid","tools":25`.

## Rebuild after changing the plugin server

```
cd apps/space-at-scale-mcp
npm ci
npm run build
npm test
```
