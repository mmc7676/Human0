// Builds dist/worker.js from src/worker.js and the plugin's server sources (one source of truth).
// Run after any change to plugins/space-at-scale/server. Deploy uses the committed dist/worker.js as-is.
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
const SRV = new URL("../../plugins/space-at-scale/server/", import.meta.url);
const sha = createHash("sha256").update(readFileSync(new URL("physics-core.js", SRV))).digest("hex");
await build({
  entryPoints: ["src/worker.js"], outfile: "dist/worker.js", bundle: true, format: "esm", platform: "node", target: "es2022",
  minify: true, legalComments: "eof", loader: { ".html": "text" },
  // The Worker never starts the Node MCP SDK (it passes a recorder); keep it out of the bundle.
  external: ["@modelcontextprotocol/sdk/*", "express"],
  define: { "process.env.SCW_PUBLIC": '"1"', "process.env.SCW_PHYSICS_SHA": JSON.stringify(sha) },
  logLevel: "warning",
  // Resolve the plugin server's dependencies (zod) from this package, so a build needs only `npm ci` here.
  nodePaths: [new URL("node_modules", import.meta.url).pathname],
});
console.log("built dist/worker.js " + statSync("dist/worker.js").size + " bytes; physics-core sha256 " + sha.slice(0, 12));
