#!/usr/bin/env python3
"""Build Vivino winery profiles for the producers of the Whole Foods wines.

LINKTREE shape (root -> winery page -> its 2nd-level links):
  depth 0  https://www.vivino.com/en/wineries            (root; read once, not paged through)
  depth 1  https://www.vivino.com/en/wineries/<slug>      (one per producer, fetched)
  depth 2  links found on each winery page                (recorded, NOT fetched)

The root list (222,366 wineries, 25 per page) was not crawled. Each producer was found
directly by a web search restricted to vivino.com, then its winery page was read once.

Inputs (read-only):
  raw/wineries/queue.json      producers normalized from data/wines.json brand fields
  raw/wineries/match_*.jsonl   one record per producer from the lookup workers
  data/wines.json              read only, for the wine id list per producer
  raw/vivino/match_*.jsonl     read only, optional: per-wine Vivino URLs from the ratings task
Outputs (new files only):
  data/wineries/wineries.json  linktree contract fields + profile index + buckets
  data/wineries/<slug>.json    one profile per matched or low-confidence winery
"""
import datetime
import glob
import json
import os
import re
import sys
import urllib.parse

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RAW = os.path.join(ROOT, "raw", "wineries")
OUT = os.path.join(ROOT, "data", "wineries")
ROOT_URL = "https://www.vivino.com/en/wineries"
TRACKING = re.compile(r"^(utm_|fbclid$|gclid$|mc_|ref_?$)", re.I)


def canon(url):
    """Canonical URL for dedupe: lowercase host, drop fragment and tracking params, no trailing slash,
    and the language-less /wineries/<slug> form mapped to /en/wineries/<slug>."""
    if not url:
        return None
    p = urllib.parse.urlsplit(url.strip())
    if p.scheme not in ("http", "https"):
        return None
    q = [(k, v) for k, v in urllib.parse.parse_qsl(p.query, keep_blank_values=True) if not TRACKING.match(k)]
    path = p.path.rstrip("/") or "/"
    host = p.netloc.lower()
    if host == "vivino.com":
        host = "www.vivino.com"
    if host == "www.vivino.com":
        m = re.match(r"^/(?:[a-z]{2}(?:-[a-z]{2})?/)?wineries/([^/]+)$", path, re.I)
        if m:
            path = "/en/wineries/" + m.group(1).lower()
    return urllib.parse.urlunsplit(("https", host, path, urllib.parse.urlencode(q, doseq=True), ""))


def slug_of(url):
    m = re.search(r"/wineries/([^/?#]+)", url or "")
    return m.group(1).lower() if m else None


def wine_id(url):
    m = re.search(r"/w/(\d+)", url or "")
    return int(m.group(1)) if m else None


def load_records(warnings):
    recs = {}
    for path in sorted(glob.glob(os.path.join(RAW, "match_*.jsonl"))):
        with open(path, encoding="utf-8") as f:
            for n, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    r = json.loads(line)
                except json.JSONDecodeError:
                    warnings.append({"type": "bad_record", "file": os.path.basename(path), "line": n})
                    continue
                # each batch file owns a slice of 29 idx values; a record that landed in another
                # batch's file (a worker mix-up) only counts when the owning file has none
                m = re.search(r"match_(\d+)\.jsonl$", path)
                r["_own_file"] = os.path.basename(path).startswith(("match_retry", "match_new")) or (bool(m) and int(m.group(1)) == r.get("idx", -1) // 29 + 1)
                prev = recs.get(r.get("idx"))
                rank = {"matched": 3, "low_confidence": 2, "fetch_failed": 1, "not_found": 0}
                if prev is None or (r["_own_file"], rank.get(r.get("status"), -1)) >= \
                        (prev["_own_file"], rank.get(prev.get("status"), -1)):
                    recs[r["idx"]] = r
    return recs


def links_of(r):
    seen, out = set(), []
    for field in ("links_level2", "extra_links", "links"):
        for l in r.get(field) or []:
            if not isinstance(l, dict):
                continue
            u = l.get("url") or ""
            if u.startswith(("mailto:", "tel:", "javascript:")):
                continue
            c = canon(u)
            if not c or c in seen:
                continue
            seen.add(c)
            out.append({"url": c, "text": l.get("text"), "kind": l.get("kind") or "other"})
    for w in wines_of(r):
        c = canon(w["url"])
        if c and c not in seen:
            seen.add(c)
            out.append({"url": c, "text": w["name"], "kind": "wine"})
    return out


def wines_of(r):
    out, seen = [], set()
    for w in (r.get("wines_on_page") or r.get("wines") or []):
        if not isinstance(w, dict) or not w.get("url"):
            continue
        wid = w.get("vivino_wine_id") or wine_id(w["url"])
        if wid in seen:
            continue
        seen.add(wid)
        out.append({"name": w.get("name"), "url": canon(re.sub(r"\?.*$", "", w["url"])), "vivino_wine_id": wid})
    return out


def main():
    warnings = []
    queue = json.load(open(os.path.join(RAW, "queue.json"), encoding="utf-8"))
    recs = load_records(warnings)
    wines_doc = json.load(open(os.path.join(ROOT, "data", "wines.json"), encoding="utf-8"))
    wf = {w["scw_id"]: w for w in wines_doc["wines"] if w["is_wine"]}

    # per-wine Vivino URLs from the ratings task, read only; used as extra match evidence
    wine_vivino = {}
    for path in glob.glob(os.path.join(ROOT, "raw", "vivino", "match_*.jsonl")):
        for line in open(path, encoding="utf-8"):
            try:
                m = json.loads(line)
            except json.JSONDecodeError:
                continue
            if m.get("vivino_url"):
                wine_vivino[m["scw_id"]] = wine_id(m["vivino_url"])

    wineries = {}        # canonical winery url -> profile
    buckets = {"matched": [], "low_confidence": [], "not_found": [], "fetch_failed": [], "not_searched": []}
    wine_to_winery = {}
    for g in queue:
        r = recs.get(g["idx"])
        scw_ids = [w["scw_id"] for w in g["wines"]]
        base = {"producer": g["producer"], "brand_fields": g["brand_fields"], "wf_wine_ids": scw_ids,
                "normalization_notes": g["notes"]}
        if r is None and g.get("skip_search"):
            base.update(note="not searched: " + "; ".join(g["notes"]))
            buckets["not_found"].append(base)
            continue
        if r is None:
            buckets["not_searched"].append(base)
            continue
        status = r.get("status")
        url = canon(r.get("vivino_winery_url"))
        if status in ("not_found", "fetch_failed") or not url:
            base.update(search_queries=r.get("search_queries"), note=r.get("verify_note"),
                        candidate_url=url)
            buckets["fetch_failed" if status == "fetch_failed" else "not_found"].append(base)
            continue
        page = r.get("page") or {}
        # description_summary is our own paraphrase, so it follows American spelling
        # (wine names and page titles stay exactly as Vivino shows them)
        if page.get("description_summary"):
            s = page["description_summary"]
            for uk, us in (("centred", "centered"), ("centre", "center"), ("favourite", "favorite"),
                           ("flavour", "flavor"), ("colour", "color"), ("honour", "honor"),
                           ("metres", "meters"), ("organised", "organized"), ("recognised", "recognized")):
                s = re.sub(r"\b%s" % uk, us, s)
                s = re.sub(r"\b%s" % uk.capitalize(), us.capitalize(), s)
            page["description_summary"] = s
        if page.get("website_url"):
            page["website_url"] = canon(page["website_url"])
        wines = wines_of(r)
        listed_ids = {w["vivino_wine_id"] for w in wines}
        evidence = sorted(s for s in scw_ids if wine_vivino.get(s) and wine_vivino[s] in listed_ids)
        prof = wineries.get(url)
        if prof is None:
            prof = {
                "vivino_winery_url": url, "winery_slug": slug_of(url),
                "vivino_winery_id": r.get("vivino_winery_id"),
                "match_status": status, "match_confidence": r.get("confidence"),
                "found_via": r.get("found_via"), "search_queries": r.get("search_queries"),
                "verify_note": r.get("verify_note"),
                "profile": {k: page.get(k) for k in (
                    "name", "badges", "wines_count", "avg_rating", "ratings_count", "country", "country_url",
                    "region", "region_url", "owned_by", "website_url", "social_urls", "founded", "winemaker",
                    "description_summary", "wine_list_pages", "see_all_url")},
                "page_title": page.get("title"),
                "wines_on_page": wines,
                "links_level2": links_of(r),
                "producers": [], "wf_wine_ids": [], "wf_wines_listed_on_page": [],
                "warnings": r.get("warnings") or [],
                "source": "vivino.com", "captured": "2026-11-19",
                "captured_note": "Winery page read once; level-2 links recorded, not fetched. Phone and email dropped.",
            }
            wineries[url] = prof
        elif {"matched": 1}.get(status, 0) > {"matched": 1}.get(prof["match_status"], 0):
            prof["match_status"], prof["match_confidence"] = status, r.get("confidence")
        prof["producers"].append({"producer": g["producer"], "brand_fields": g["brand_fields"],
                                  "normalization_notes": g["notes"], "status": status,
                                  "confidence": r.get("confidence")})
        prof["wf_wine_ids"].extend(scw_ids)
        prof["wf_wines_listed_on_page"].extend(evidence)
        bucket = "matched" if status == "matched" else "low_confidence"
        buckets[bucket].append({**base, "vivino_winery_url": url, "confidence": r.get("confidence"),
                                "note": r.get("verify_note")})
        for s in scw_ids:
            wine_to_winery[s] = {"vivino_winery_url": url, "match_status": status,
                                 "confidence": r.get("confidence")}

    os.makedirs(OUT, exist_ok=True)
    # remove only profile files this script wrote before (marked by "source": "vivino.com")
    for old in glob.glob(os.path.join(OUT, "*.json")):
        if os.path.basename(old) == "wineries.json":
            continue
        try:
            if json.load(open(old, encoding="utf-8")).get("source") == "vivino.com":
                os.remove(old)
        except Exception:
            pass
    nodes = [{"id": ROOT_URL, "url": ROOT_URL, "depth": 0, "title": "Wineries | Vivino",
              "status": "fetched", "note": "root read once; list of 222,366 wineries not paged through"}]
    edges, tree_children, outline = [], [], ["- [Wineries | Vivino](%s) (root, not paged)" % ROOT_URL]
    seen_nodes = {ROOT_URL}
    for url, p in sorted(wineries.items(), key=lambda kv: (kv[1]["profile"].get("name") or kv[0]).lower()):
        p["wf_wine_ids"] = sorted(set(p["wf_wine_ids"]), key=lambda s: int(s[3:]))
        p["wf_wines_listed_on_page"] = sorted(set(p["wf_wines_listed_on_page"]), key=lambda s: int(s[3:]))
        p["wf_wines"] = [{"scw_id": s, "product_name": wf[s]["product_name"]} for s in p["wf_wine_ids"] if s in wf]
        fname = (p["winery_slug"] or re.sub(r"\W+", "-", url)) + ".json"
        p["file"] = fname
        json.dump(p, open(os.path.join(OUT, fname), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        title = p["page_title"] or p["profile"].get("name")
        nodes.append({"id": url, "url": url, "depth": 1, "title": title, "status": "fetched",
                      "match_status": p["match_status"]})
        edges.append({"from": ROOT_URL, "to": url, "type": "tree"})
        kids = []
        for l in p["links_level2"]:
            if l["url"] not in seen_nodes:
                seen_nodes.add(l["url"])
                nodes.append({"id": l["url"], "url": l["url"], "depth": 2, "title": l["text"],
                              "kind": l["kind"], "status": "listed, not fetched", "parent": url})
                edges.append({"from": url, "to": l["url"], "type": "tree"})
                kids.append({"url": l["url"], "title": l["text"], "kind": l["kind"]})
            else:
                edges.append({"from": url, "to": l["url"], "type": "cross"})
        tree_children.append({"url": url, "title": title, "match_status": p["match_status"], "children": kids})
        counts = {}
        for l in p["links_level2"]:
            counts[l["kind"]] = counts.get(l["kind"], 0) + 1
        outline.append("  - [%s](%s) %s; %d level-2 links (%s); WF wines %d" % (
            p["profile"].get("name") or title, url, p["match_status"], len(p["links_level2"]),
            ", ".join("%s %d" % kv for kv in sorted(counts.items())), len(p["wf_wine_ids"])))

    mtimes = [os.path.getmtime(f) for f in glob.glob(os.path.join(RAW, "match_*.jsonl"))]
    iso = lambda t: datetime.datetime.fromtimestamp(t, datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    covered = set(wine_to_winery)
    doc = {
        "root": ROOT_URL,
        "startedAt": iso(os.path.getmtime(os.path.join(RAW, "queue.json"))),
        "finishedAt": iso(max(mtimes)) if mtimes else None,
        "config": {"max_depth": 2, "fetch_depth": 1, "same_origin": True, "robots": "respected",
                   "root_paging": "none (direct lookup per producer)",
                   "discovery": "web search restricted to vivino.com, then one fetch of each winery page",
                   "dropped": ["mailto", "tel", "user reviews", "user names"],
                   "robots_rules_noted": ["/wineries/*/most_popular_vintages disallowed (not visited)",
                                          "/reviews/ and /users disallowed (not visited)"]},
        "stats": {"producers": len(queue), "wf_wines": len(wf),
                  "wf_wines_linked_to_winery": len(covered),
                  "winery_pages_fetched": len(wineries),
                  "level2_links_recorded": sum(len(p["links_level2"]) for p in wineries.values()),
                  "buckets": {k: len(v) for k, v in buckets.items()}},
        "warnings": warnings + [{"type": "page_warning", "winery": u, "text": w}
                                for u, p in wineries.items() for w in p["warnings"]],
        "nodes": nodes,
        "edges": edges,
        "tree": {"url": ROOT_URL, "title": "Wineries | Vivino", "children": tree_children},
        "outline": "\n".join(outline),
        "wineries": [{"name": p["profile"].get("name"), "vivino_winery_url": u, "file": p["file"],
                      "match_status": p["match_status"], "match_confidence": p["match_confidence"],
                      "country": p["profile"].get("country"), "region": p["profile"].get("region"),
                      "avg_rating": p["profile"].get("avg_rating"), "ratings_count": p["profile"].get("ratings_count"),
                      "wines_count": p["profile"].get("wines_count"), "wf_wine_ids": p["wf_wine_ids"]}
                     for u, p in sorted(wineries.items(), key=lambda kv: (kv[1]["profile"].get("name") or "").lower())],
        "buckets": buckets,
        "wine_to_winery": dict(sorted(wine_to_winery.items(), key=lambda kv: int(kv[0][3:]))),
    }
    json.dump(doc, open(os.path.join(OUT, "wineries.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps(doc["stats"], indent=1))
    missing = [g["idx"] for g in queue if g["idx"] not in recs]
    print("missing idx:", missing)
    return 0


if __name__ == "__main__":
    sys.exit(main())
