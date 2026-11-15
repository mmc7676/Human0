#!/usr/bin/env python3
"""file-graph builder: turn the user's claude.ai uploaded-files data into a
self-contained, clickable graph page (files -> chats -> projects).

Inputs (one of):
  --data data.json   Output of collect.js (schema file-graph/v1). Has chat URLs.
  --csv  export.csv  Copy/paste of Settings > Privacy > Uploaded files
                     (columns Name, Uploaded, Surface, Location). No chat URLs:
                     the page groups by surface/location instead and says so.

  --pattern PAT      'maxey0.csv' (substring), 'maxey0*', '*.tsx', 'img_??.png'.
                     Wildcards * and ? make it an anchored glob; without them it is
                     a substring match. Case-insensitive. Default '*' (everything).
  --out graph.html   Page to write. --print also lists matches on stdout.

Standard library only. Exit codes: 0 ok, 2 bad input, 3 nothing matched (the
page is still written, showing an empty state).
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = "file-graph/v1"
CHAT_URL = "https://claude.ai/chat/{}"
PROJECT_URL = "https://claude.ai/project/{}"
_REGEX_SPECIAL = set(".+^${}()|[]\\")


class InputError(ValueError):
    """Input file is missing, malformed, or of an unknown schema."""


# ---------------------------------------------------------------- matching
def compile_pattern(pattern: str | None):
    """Return a predicate name -> bool. Mirrors compile() in collect.js exactly."""
    p = (pattern or "").strip()
    if p in ("", "*"):
        return lambda name: True
    if "*" in p or "?" in p:
        out = []
        for ch in p:
            if ch == "*":
                out.append(".*")
            elif ch == "?":
                out.append(".")
            elif ch in _REGEX_SPECIAL:
                out.append("\\" + ch)
            else:
                out.append(ch)
        rx = re.compile("^" + "".join(out) + "$", re.IGNORECASE | re.DOTALL)
        return lambda name: rx.match(name or "") is not None
    needle = p.lower()
    return lambda name: needle in (name or "").lower()


# ---------------------------------------------------------------- loaders
_SIZE_TAIL = re.compile(r"^(?P<name>.*?)(?P<num>\d+(?:\.\d+)?)\s?(?P<unit>bytes|B|KB|MB|GB)$")
_UNIT = {"bytes": 1, "B": 1, "KB": 1024, "MB": 1024 ** 2, "GB": 1024 ** 3}


def split_name_size(cell: str) -> tuple[str, int | None]:
    """The privacy-page copy glues the size onto the name: 'view-1.png363.8 KB'.
    Only split when the remainder still looks like a file name (non-empty)."""
    cell = cell.strip()
    m = _SIZE_TAIL.match(cell)
    if not m or not m.group("name").strip():
        return cell, None
    return m.group("name"), int(round(float(m.group("num")) * _UNIT[m.group("unit")]))


def _csv_date(s: str) -> str | None:
    s = (s or "").strip()
    for fmt in ("%d-%b-%y", "%b %d, %Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def load_csv(path: Path) -> dict:
    """CSV fallback. Produces the same normalized model, with synthetic group nodes
    because the copy/paste export carries no chat URLs."""
    try:
        with path.open(encoding="utf-8-sig", newline="") as fh:
            rows = list(csv.DictReader(fh))
    except OSError as e:
        raise InputError(f"cannot read {path}: {e}") from e
    need = {"Name", "Uploaded", "Surface", "Location"}
    if not rows or not need <= set(rows[0].keys()):
        raise InputError(f"{path}: expected columns {sorted(need)}, got {list(rows[0].keys()) if rows else 'no rows'}")

    files, groups = [], {}
    for i, r in enumerate(rows):
        name, size = split_name_size(r["Name"])
        surface = {"chat": "chat", "codecowork": "session", "project": "project"}.get(r["Surface"].strip().lower(), r["Surface"].strip().lower() or "unknown")
        loc = r["Location"].strip()
        if surface == "project" and loc not in ("", "—"):
            gid = f"csvproj:{loc}"
            groups.setdefault(gid, {"kind": "project", "title": loc, "url": None, "note": "Project (name only; CSV has no project link)"})
            chats, project = [], gid
        elif re.fullmatch(r"\d+ chats?", loc):
            gid = f"csvloc:{surface}:{loc}"
            groups.setdefault(gid, {"kind": "chat", "title": f"{surface} · {loc} (URL not in CSV)", "url": None,
                                    "note": "The CSV copy loses the Open chat links. Re-run with the collector for real chat nodes."})
            chats, project = [gid], None
        else:
            chats, project = [], None
        files.append({"id": f"csv:{i}", "name": name, "size": size, "mime": None,
                      "created": _csv_date(r["Uploaded"]), "surface": surface, "chats": chats, "project": project})
    chats = {k: {"title": v["title"], "url": None, "project": None, "updated": None, "archived": False, "note": v["note"]}
             for k, v in groups.items() if v["kind"] == "chat"}
    projects = {k: {"name": v["title"], "url": None} for k, v in groups.items() if v["kind"] == "project"}
    return {"source": f"csv:{path.name}", "has_urls": False, "generated_at": None,
            "all_files": len(files), "files": files, "chats": chats, "projects": projects, "truncated": False}


def load_collector(path: Path) -> dict:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        raise InputError(f"cannot parse {path}: {e}") from e
    if isinstance(raw, str):  # javascript tools sometimes return the JSON string JSON-encoded again
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError as e:
            raise InputError(f"{path}: doubly-encoded payload did not decode: {e}") from e
    if not isinstance(raw, dict) or raw.get("schema") != SCHEMA:
        raise InputError(f"{path}: not a {SCHEMA} payload (schema={raw.get('schema') if isinstance(raw, dict) else type(raw).__name__})")
    files = [{"id": f["id"], "name": f.get("n") or "", "size": f.get("sz"), "mime": f.get("mt") or None,
              "created": f.get("at"), "surface": f.get("sf") or "unknown",
              "chats": list(f.get("c") or []), "project": f.get("p")} for f in raw.get("files", [])]
    chats = {cid: {"title": c.get("n") or "(untitled chat)", "url": CHAT_URL.format(cid), "project": c.get("p"),
                   "updated": c.get("u"), "archived": bool(c.get("a")), "note": None}
             for cid, c in (raw.get("convs") or {}).items()}
    for f in files:  # a file may point at a chat the title lookup did not return
        for cid in f["chats"]:
            chats.setdefault(cid, {"title": "(title not returned)", "url": CHAT_URL.format(cid), "project": None,
                                   "updated": None, "archived": False, "note": "Chat UUID came from the file record; title lookup missed it."})
    projects = {pid: {"name": name or "(unnamed project)", "url": PROJECT_URL.format(pid)}
                for pid, name in (raw.get("projects") or {}).items()}
    for ref in [f["project"] for f in files] + [c["project"] for c in chats.values()]:
        if ref and ref not in projects:
            projects[ref] = {"name": "(unnamed project)", "url": PROJECT_URL.format(ref)}
    totals = raw.get("totals") or {}
    return {"source": raw.get("source") or "collector", "has_urls": True, "generated_at": raw.get("generated_at"),
            "all_files": totals.get("all_files", len(files)), "files": files, "chats": chats, "projects": projects,
            "truncated": bool(totals.get("truncated")), "collector_pattern": raw.get("pattern")}


# ---------------------------------------------------------------- model
def ext_of(name: str) -> str:
    base = name.rsplit("/", 1)[-1]
    return base.rsplit(".", 1)[-1].lower() if "." in base.strip(".") else "(none)"


def build_model(src: dict, pattern: str) -> dict:
    match = compile_pattern(pattern)
    files = [f for f in src["files"] if match(f["name"])]
    used_chats = {c for f in files for c in f["chats"]}
    chats = {k: v for k, v in src["chats"].items() if k in used_chats}
    used_projects = {f["project"] for f in files if f["project"]} | {c["project"] for c in chats.values() if c["project"]}
    projects = {k: v for k, v in src["projects"].items() if k in used_projects}
    for f in files:
        f["ext"] = ext_of(f["name"])
    stats = {
        "matched": len(files),
        "all_files": src["all_files"],
        "chats": len(chats),
        "projects": len(projects),
        "unlinked": sum(1 for f in files if not f["chats"] and not f["project"]),
        "by_surface": dict(Counter(f["surface"] for f in files)),
        "by_ext": dict(Counter(f["ext"] for f in files).most_common()),
    }
    return {"pattern": pattern, "source": src["source"], "has_urls": src["has_urls"],
            "generated_at": src.get("generated_at"), "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "truncated": src.get("truncated", False), "files": files, "chats": chats, "projects": projects, "stats": stats}


def embed_json(obj) -> str:
    """JSON safe to drop inside <script type=application/json>."""
    return (json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
            .replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
            .replace("\u2028", "\\u2028").replace("\u2029", "\\u2029"))


def render_html(model: dict, template: Path) -> str:
    html = template.read_text(encoding="utf-8")
    if "/*__FILE_GRAPH_DATA__*/" not in html:
        raise InputError(f"{template}: data placeholder missing")
    return html.replace("/*__FILE_GRAPH_DATA__*/", embed_json(model), 1)


def print_matches(model: dict, out=sys.stdout) -> None:
    s = model["stats"]
    print(f"{s['matched']} of {s['all_files']} files match {model['pattern']!r} · {s['chats']} chats · "
          f"{s['projects']} projects · {s['unlinked']} with no linked chat", file=out)
    for f in model["files"]:
        where = [model["chats"][c]["url"] or model["chats"][c]["title"] for c in f["chats"]]
        if f["project"]:
            p = model["projects"][f["project"]]
            where.append(p["url"] or f"project:{p['name']}")
        print(f"  {f['name']}\t{(f['created'] or '')[:10]}\t{f['surface']}\t{' | '.join(where) or '(no linked chat)'}", file=out)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--data", type=Path)
    g.add_argument("--csv", type=Path)
    ap.add_argument("--pattern", default="*")
    ap.add_argument("--out", type=Path)
    ap.add_argument("--template", type=Path, default=Path(__file__).with_name("graph_template.html"))
    ap.add_argument("--print", action="store_true", dest="do_print")
    a = ap.parse_args(argv)
    try:
        src = load_collector(a.data) if a.data else load_csv(a.csv)
        model = build_model(src, a.pattern)
        if a.out:
            a.out.write_text(render_html(model, a.template), encoding="utf-8")
    except InputError as e:
        print(f"file-graph: {e}", file=sys.stderr)
        return 2
    if a.do_print or not a.out:
        print_matches(model)
    else:
        s = model["stats"]
        print(f"wrote {a.out}: {s['matched']}/{s['all_files']} files, {s['chats']} chats, {s['projects']} projects, "
              f"{s['unlinked']} unlinked, urls={'yes' if model['has_urls'] else 'no (csv)'}")
    return 0 if model["stats"]["matched"] else 3


if __name__ == "__main__":
    sys.exit(main())
