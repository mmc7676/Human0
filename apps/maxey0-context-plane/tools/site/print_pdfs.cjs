// Print each docs page (server/public/docs/<slug>.html) to <slug>.pdf with Chromium. Pages reference /logo.png; the
// print stylesheet hides navigation, so the PDFs need no network.
const { chromium } = require("playwright"); const path = require("path");
(async () => {
  const [dir, ...slugs] = process.argv.slice(2), b = await chromium.launch(), p = await b.newPage();
  await p.route(/^https?:/, (r) => r.abort());
  for (const s of slugs) { await p.goto("file://" + path.join(dir, s + ".html")); await p.pdf({ path: path.join(dir, s + ".pdf"), format: "Letter", margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" }, printBackground: false }); }
  await b.close(); console.log(slugs.length);
})().catch((e) => { console.error(e); process.exit(1); });
