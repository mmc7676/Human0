// Produces the listing screenshots in docs/images (PNG, >= 1000 px wide, cropped to the app).
// Needs the server running: (cd ../server && npx wrangler dev --port 8794)   then: node screenshots.cjs
const { chromium } = require("playwright");
const path = require("path");
const API = process.env.API || "http://127.0.0.1:8794";
const OUT = path.join(__dirname, "..", "docs", "images");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await p.goto(API + "/app"); await p.waitForFunction(() => window.__l5 && window.__l5.nodes() > 0, null, { timeout: 60000 });
  const graph = await p.$("#cs_graph");
  // 1. a task routed to its best path
  await p.fill("#taskIn", "quantum entanglement of two qubits"); await p.click("#taskGo"); await p.waitForTimeout(300);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.screenshot({ path: path.join(OUT, "01-route-a-task.png"), clip: { x: 0, y: 0, width: 1440, height: 1000 } });
  // 2. the isolated path spread on the level rings
  await p.click("#taskClr"); await p.click("#iso"); await p.evaluate(() => window.__cpv.select("c:mx-infrastructure"));
  await graph.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  await (await p.$("#g")).screenshot({ path: path.join(OUT, "02-isolated-path.png") });
  // 3. any-angle rotation
  await p.evaluate(() => { window.__cpv.track(140, -70, false); window.__cpv.track(40, 0, true) }); await p.waitForTimeout(200);
  await (await p.$("#g")).screenshot({ path: path.join(OUT, "03-rotate-any-angle.png") });
  // 4. the full map
  await p.click("#iso"); await p.evaluate(() => { window.__cpv.select(null); window.__cpv.fit() }); 
  await p.waitForTimeout(300); await (await p.$("#g")).screenshot({ path: path.join(OUT, "04-full-map.png") });
  await b.close();
})().catch(e => { console.log("ERR", e.message); process.exit(1) });
