"""Merge the Nov 22, 2026 Vivino pass into data/wines.json for wines that have no vivino block yet.

Inputs: raw/vivino/search_2026-11-22.jsonl (one Vivino search per wine, read in a browser),
raw/vivino/reuse_2026-11-22.json (new wine -> earlier record of the same wine in another size).
Existing vivino blocks are never changed. Wines left unsearched are marked not_searched.
Word clouds are empty for this pass: Vivino's reviews feed refused the browser, so no terms were counted.
"""
import json, os, re, sys, copy, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
RAW = os.path.join(ROOT, "raw", "vivino")
CAPTURED = "2026-11-22"


def main():
    path = os.path.join(DATA, "wines.json")
    doc = json.load(open(path, encoding="utf-8"))
    by_id = {w["scw_id"]: w for w in doc["wines"]}
    found = {}
    for line in open(os.path.join(RAW, "search_2026-11-22.jsonl"), encoding="utf-8"):
        if line.strip():
            r = json.loads(line)
            found[r["scw_id"]] = r
    reuse = json.load(open(os.path.join(RAW, "reuse_2026-11-22.json"), encoding="utf-8"))
    touched, buckets = [], collections.Counter()
    for w in doc["wines"]:
        if not w.get("is_wine") or w.get("vivino") is not None:
            continue
        sid = w["scw_id"]
        v = {"source": "vivino.com", "captured": CAPTURED}
        if sid in reuse:
            src = by_id[reuse[sid]].get("vivino")
            v = copy.deepcopy(src)
            v["reused_from"] = reuse[sid]
            v["reuse_note"] = ("same wine as " + reuse[sid] + " in another bottle size; Vivino rates the wine, "
                               "not the bottle size, so the earlier match is reused")
        elif sid in found:
            r = found[sid]
            st = r["status"]
            url = ("https://www.vivino.com" + r["path"]) if r.get("path") else None
            wid = int(re.search(r"/w/(\d+)", r["path"]).group(1)) if r.get("path") else None
            if st == "matched":
                v.update(url=url, vivino_wine_id=wid, search_query=r.get("query") or w.get("product_name"),
                         search_result_title=r.get("title"),
                         page={"page_h1": r.get("title"), "page_winery": r.get("winery"), "page_winery_url": None,
                               "page_grapes": r.get("grapes"), "page_region": r.get("region"),
                               "page_type": r.get("type")},
                         verify_note=r.get("note"), match_status="matched",
                         match_confidence=r.get("conf") or "medium",
                         rating=round(float(r["rating"]), 1) if r.get("rating") is not None else None,
                         ratings_count=r.get("count"), ratings_count_note=None,
                         rating_scope=r.get("scope") or "all vintages (Vivino search result or wine page header)",
                         reviews_counted=0, reviews_cap=10, reviews_read=0, word_cloud=[],
                         word_cloud_note="reviews not read: Vivino's reviews feed refused the browser in this pass")
            elif st == "low_confidence":
                v.update(match_status="low_confidence", url=url, vivino_wine_id=wid,
                         search_result_title=r.get("title"),
                         reason="search could not confirm the exact wine: " + (r.get("note") or ""))
            elif st == "not_found":
                v.update(match_status="not_found", note=r.get("note"))
            else:
                v.update(match_status="not_searched", note=r.get("note"))
        else:
            v.update(match_status="not_searched",
                     note="not searched in the Nov 22 pass; held back to limit usage")
        w["vivino"] = v
        buckets[v["match_status"] + (" (reused)" if v.get("reused_from") else "")] += 1
        touched.append(sid)
    doc["vivino_enrichment_2026_11_22"] = {
        "captured": CAPTURED, "wines_without_vivino_before": len(touched), "buckets": dict(buckets),
        "method": ("One Vivino search per wine in a browser, one wine at a time; the wine page was opened only when "
                   "the search card did not settle the match. Same-wine bottle sizes reuse the earlier match. "
                   "Low-confidence matches carry no rating. No review text was read or kept."),
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    scw_dir = os.path.join(DATA, "scw")
    for sid in touched:
        p = os.path.join(scw_dir, sid + ".json")
        if os.path.exists(p):
            rec = json.load(open(p, encoding="utf-8"))
            rec["record"] = by_id[sid]
            with open(p, "w", encoding="utf-8") as f:
                json.dump(rec, f, ensure_ascii=False, indent=1)
    print(json.dumps(dict(buckets)), "touched", len(touched))


if __name__ == "__main__":
    sys.exit(main())
