// Live performance measurement of the deployed app and server (Human0 item 11).
const { chromium } = require("playwright");
const B = process.env.BASE || "https://maxey0-context-plane-mcp.maxey0.workers.dev";
(async () => {
  const px = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const b = await chromium.launch({ proxy: px }); const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, ignoreHTTPSErrors: true });
  const out = {};
  for (const run of [1, 2]) {
    const p = await ctx.newPage(); const t0 = Date.now();
    await p.goto(B + "/app", { waitUntil: "domcontentloaded", timeout: 90000 }); const dcl = Date.now() - t0;
    await p.waitForFunction(() => window.__l5 && window.__l5.nodes() > 0, null, { timeout: 90000 }); const ready = Date.now() - t0;
    const nav = await p.evaluate(() => { const n = performance.getEntriesByType("navigation")[0], r = performance.getEntriesByType("resource").filter(x => /graph\.json/.test(x.name))[0];
      return { html_kb: Math.round((n.encodedBodySize || 0) / 1024), html_ms: Math.round(n.responseEnd - n.requestStart), graph_kb: r ? Math.round(r.encodedBodySize / 1024) : null, graph_raw_kb: r ? Math.round(r.decodedBodySize / 1024) : null, graph_ms: r ? Math.round(r.responseEnd - r.requestStart) : null } });
    const fr = await p.evaluate(async () => { const v = window.__cpv; const t = []; for (let i = 0; i < 20; i++) { const a = performance.now(); v.rotate(0.01); t.push(performance.now() - a) } t.sort((x, y) => x - y); return { median: +t[10].toFixed(1), p90: +t[18].toFixed(1) } });
    await p.evaluate(() => document.getElementById('cpFieldBtn').click());
    const frF = await p.evaluate(async () => { const v = window.__cpv; const t = []; for (let i = 0; i < 20; i++) { const a = performance.now(); v.rotate(0.01); t.push(performance.now() - a) } t.sort((x, y) => x - y); return { median: +t[10].toFixed(1), p90: +t[18].toFixed(1) } });
    const lens = await p.evaluate(() => { const v = window.__cpv, T = 'Design a marketing email campaign, segment the customer list, A/B test subject lines, and measure attribution in a dashboard'; v.lens(T); const t = []; for (let i = 0; i < 5; i++) { const a = performance.now(); v.lens(T); t.push(performance.now() - a) } t.sort((x, y) => x - y); return +t[2].toFixed(1) });
    const heap = await p.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);
    out["load " + run] = { dom_content_loaded_ms: dcl, graph_ready_ms: ready, ...nav, frame_ms: fr, frame_field_ms: frF, app_lens_ms: lens, heap_mb: heap };
    await p.close();
  }
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
