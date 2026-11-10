"""Build the static site pages served by the Worker as static assets: /docs and /research.

Inputs : docs/*.md, README.md, CHANGELOG.md, PRIVACY.md (docs); research/catalog.json + research/papers/*.pdf (research)
Outputs: server/public/docs/<slug>.{html,md}, server/public/docs/index.html,
         server/public/research/index.html, server/public/research/<slug>.html, server/public/research/<file>.pdf
PDFs of the docs are printed from the HTML pages by print_pdfs.cjs (Chromium), run at the end.
A paper marked "local_only" is not in git: its PDF is copied only if present in research/papers/ on this machine.
"""
import html, json, pathlib, shutil, subprocess, sys
import markdown

ROOT = pathlib.Path(__file__).resolve().parents[2]
PUB = ROOT / "server" / "public"
DOCS = [  # slug, title, source, blurb
    ("readme", "Overview", "README.md", "What Maxey0 is, what it holds, and how to use it."),
    ("user-guide", "User guide", "docs/USER_GUIDE.md", "Every feature of the app, step by step."),
    ("mcp-server", "MCP server and API reference", "docs/MCP_SERVER.md", "Endpoints, the 15 MCP tools, inputs and outputs."),
    ("architecture", "Architecture", "docs/ARCHITECTURE.md", "How the plane is built, served and drawn."),
    ("performance", "Performance budget", "docs/PERFORMANCE.md", "The limits the tests enforce."),
    ("development", "Development", "docs/DEVELOPMENT.md", "Build, test and deploy it yourself."),
    ("changelog", "Changelog", "CHANGELOG.md", "Every release."),
    ("privacy", "Privacy", "PRIVACY.md", "What the server and app keep (nothing about you)."),
]
CSS = """:root{--bg:#071321;--panel:#0c1d30;--ink:#e8f1fb;--dim:#c7d6e0;--acc:#7ee7ff;--line:#ffffff1f;--or:#c2410c}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:980px;margin:0 auto;padding:24px 16px 64px}a{color:var(--acc)}
nav{display:flex;gap:16px;align-items:center;flex-wrap:wrap;padding-bottom:16px;border-bottom:1px solid var(--line);margin-bottom:24px}
nav img{width:44px;height:44px;border-radius:8px}nav b{font-size:20px;margin-right:auto}nav a{text-decoration:none}
h1{font-size:32px;line-height:1.2;margin:8px 0}h2{margin-top:32px}p,li{color:var(--dim)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px;margin:12px 0}
.card h3{margin:0 0 6px}.meta{font-size:13px;color:var(--dim)}
.dl{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}.dl a{padding:8px 16px;border-radius:999px;background:var(--or);color:#fff;text-decoration:none;font-weight:600;font-size:14px}
.dl a.alt{background:transparent;border:1px solid var(--acc);color:var(--acc)}
pre{background:#0006;padding:12px;border-radius:8px;overflow:auto}code{background:#0004;padding:1px 5px;border-radius:4px}pre code{background:none;padding:0}
table{border-collapse:collapse;display:block;overflow:auto}td,th{border:1px solid var(--line);padding:6px 10px}
iframe{width:100%;height:85vh;border:1px solid var(--line);border-radius:8px;background:#fff}
dl.qa dt{font-weight:700;margin-top:12px}dl.qa dd{margin:4px 0 0;color:var(--dim)}
@media print{body{background:#fff;color:#000}nav,.dl{display:none}p,li,dd{color:#000}a{color:#000}pre,code{background:#eee}.card{border-color:#ccc;background:#fff}}"""

def page(title, body, desc=""):
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)} · Maxey0 by Human0</title><meta name="description" content="{html.escape(desc)}"><link rel="icon" href="/logo.png">
<style>{CSS}</style></head><body><main><nav><a href="https://app.maxey0.com/"><img src="/logo.png" alt="Human0 logo"></a><b>Maxey0</b>
<a href="https://app.maxey0.com/app">App</a><a href="/docs">Docs</a><a href="/research">Research</a><a href="https://github.com/mmc7676/Human0/tree/main/apps/maxey0-context-plane">Source</a></nav>
{body}</main></body></html>"""

def build_docs():
    out = PUB / "docs"; shutil.rmtree(out, ignore_errors=True); out.mkdir(parents=True)
    cards = []
    for slug, title, src, blurb in DOCS:
        text = (ROOT / src).read_text(encoding="utf-8")
        (out / f"{slug}.md").write_text(text, encoding="utf-8")
        body = markdown.markdown(text, extensions=["tables", "fenced_code", "toc"])
        dl = f'<div class="dl"><a href="/docs/{slug}.pdf" download>Download PDF</a><a class="alt" href="/docs/{slug}.md" download>Download .md</a></div>'
        (out / f"{slug}.html").write_text(page(title, dl + body, blurb), encoding="utf-8")
        cards.append(f'<div class="card"><h3><a href="/docs/{slug}">{html.escape(title)}</a></h3><p>{html.escape(blurb)}</p>'
                     f'<div class="dl"><a href="/docs/{slug}.pdf" download>PDF</a><a class="alt" href="/docs/{slug}.md" download>.md</a></div></div>')
    (out / "index.html").write_text(page("Docs", "<h1>Docs</h1><p>Reference for the Maxey0 Context Plane: the app, the MCP server and API, the architecture. Each page downloads as PDF or Markdown.</p>" + "".join(cards), "Maxey0 docs, API reference and MCP spec"), encoding="utf-8")
    return [s for s, *_ in DOCS]

def build_research():
    cat = json.loads((ROOT / "research" / "catalog.json").read_text(encoding="utf-8"))
    out = PUB / "research"
    for p in out.glob("*.html"): p.unlink()
    out.mkdir(parents=True, exist_ok=True)
    groups = {g["id"]: g["title"] for g in cat["groups"]}
    idx = ["<h1>Research</h1><p>Published research from Maxey0 and Human0. Each paper has a summary and a question-and-answer frame; read it in the page or download the PDF.</p>"]
    missing = []
    for gid, gt in groups.items():
        idx.append(f"<h2>{html.escape(gt)}</h2>")
        for p in [p for p in cat["papers"] if p["group"] == gid]:
            src = ROOT / "research" / "papers" / p["file"]
            if src.exists(): shutil.copyfile(src, out / p["file"])
            elif not (out / p["file"]).exists(): missing.append(p["file"])
            meta = f'{html.escape(p["authors"])} · {html.escape(p["date"])} · {p["pages"]} pages'
            qa = "".join(f"<dt>{html.escape(x['q'])}</dt><dd>{html.escape(x['a'])}</dd>" for x in p["qa"])
            body = (f'<p class="meta"><a href="/research">Research</a> · {html.escape(gt)}</p><h1>{html.escape(p["title"])}</h1>'
                    f'<p><i>{html.escape(p["subtitle"])}</i></p><p class="meta">{meta}</p>'
                    f'<div class="dl"><a href="/research/{p["file"]}" download>Download PDF</a><a class="alt" href="/research/{p["file"]}" target="_blank" rel="noopener">Open full screen</a></div>'
                    f'<div class="card"><h3>Summary</h3><p>{html.escape(p["summary"])}</p></div>'
                    f'<div class="card"><h3>Questions and answers</h3><dl class="qa">{qa}</dl></div>'
                    f'<h2>The paper</h2><iframe src="/research/{p["file"]}#view=FitH" title="{html.escape(p["title"])} (PDF)"></iframe>'
                    f'<p class="meta">If the paper does not show here, use Download PDF above.</p>')
            (out / f'{p["slug"]}.html').write_text(page(p["title"], body, p["subtitle"]), encoding="utf-8")
            idx.append(f'<div class="card"><h3><a href="/research/{p["slug"]}">{html.escape(p["title"])}</a></h3><p class="meta">{meta}</p>'
                       f'<p>{html.escape(p["subtitle"])}</p><div class="dl"><a href="/research/{p["slug"]}">Read</a><a class="alt" href="/research/{p["file"]}" download>PDF</a></div></div>')
    (out / "index.html").write_text(page("Research", "".join(idx), "Maxey0 and Human0 research papers"), encoding="utf-8")
    return missing

if __name__ == "__main__":
    slugs = build_docs(); missing = build_research()
    r = subprocess.run(["node", str(pathlib.Path(__file__).with_name("print_pdfs.cjs")), str(PUB / "docs"), *slugs], capture_output=True, text=True)
    if r.returncode: print(r.stderr, file=sys.stderr); sys.exit(1)
    print(json.dumps({"ok": True, "docs": len(slugs), "pdfs": r.stdout.strip(), "missing_local_pdfs": missing}))
