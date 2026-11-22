#!/usr/bin/env python3
"""Merge Vivino data into data/wines.json and the per-bottle SCW files.

Run after build/build_dataset.py (which rebuilds wines.json without Vivino data).
Inputs (raw/vivino/):
  match_*.jsonl    per-wine search match (Vivino URL, search confidence)
  extract_*.jsonl  per-wine page read (rating, rating count, taste summary, page facts)
  terms_*.jsonl    per Vivino wine id: descriptor terms from up to REVIEW_CAP English reviews
                   (review texts are never stored; only how many reviews used each term)
Output:
  data/wines.json  each wine record gains a "vivino" block; doc gains "vivino_enrichment"
  data/scw/SCWn.json rewritten from the updated records; SCW0 gains the enrichment summary
  data/vivino_report.json  match buckets and per-wine status

Match rule (no forcing):
  matched         page read ok, page winery = same producer AND page wine = same wine
  low_confidence  a candidate page exists but producer or wine did not verify (or the page was not read)
  not_found       no plausible Vivino page in search results
Ratings and word clouds are stored only for "matched". Review texts and reviewer details are never stored.
"""
import collections
import glob
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RAW = os.path.join(ROOT, "raw", "vivino")
DATA = os.path.join(ROOT, "data")
REVIEW_CAP = 10
CLOUD_SIZE = 40
# Filler that says nothing a seller can use; a phrase made only of these words is dropped.
FILLER = set("good nice great ok okay decent fine wine wines bottle glass none empty non-english unknown unavailable".split())

STOP = set("""
a about above after again against all also am an and any are aren't as at be because been before being below
between both but by can can't cannot could couldn't did didn't do does doesn't doing don't down during each
few for from further get got had hadn't has hasn't have haven't having he her here hers herself him himself his
how i i'd i'll i'm i've if in into is isn't it it's its itself just let's like me more most mustn't my myself
no nor not now of off on once one only or other ought our ours ourselves out over own really same shan't she
should shouldn't so some such than that that's the their theirs them themselves then there there's these they
they'd they'll they're they've this those through to too under until up us very was wasn't we we'd we'll we're
we've were weren't what what's when where which while who whom why with won't would wouldn't you you'd you'll
you're you've your yours yourself yourselves bit little lot much quite still though even well yet maybe pretty
wine wines bottle bottles glass drink drank drinking tasted taste tastes tasting note notes vintage year
will one two three get go going went think thought would make made goes say said back way also im ive
""".split())


def load_jsonl(pattern):
    out = {}
    for path in sorted(glob.glob(os.path.join(RAW, pattern))):
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                rec = json.loads(line)
                prev = out.get(rec["scw_id"])
                # a later "ok" read wins over an earlier failure
                if prev is None or rec.get("status") == "ok" or prev.get("status") != "ok":
                    out[rec["scw_id"]] = rec
    return out


def load_terms():
    """terms_*.jsonl -> {vivino_wine_id: line}; a later ok line wins."""
    out = {}
    for path in sorted(glob.glob(os.path.join(RAW, "terms_*.jsonl"))):
        for line in open(path, encoding="utf-8"):
            if line.strip():
                rec = json.loads(line)
                k = int(rec["vivino_wine_id"])
                if k not in out or rec.get("status") == "ok":
                    out[k] = rec
    return out


def clean_term(t):
    t = re.sub(r"[^a-z' -]", "", (t or "").lower()).strip(" -'")
    return re.sub(r"\s+", " ", t)


def word_cloud(review_terms, name_tokens):
    """review_terms: list (one per review) of term lists. Count = number of reviews using the term."""
    counts = collections.Counter()
    first = {}
    for terms in review_terms[:REVIEW_CAP]:
        seen = set()
        for t in terms:
            t = clean_term(t)
            words = t.split()
            if not t or t in seen or len(t) < 3 or not words:
                continue
            if all(w in STOP or w in FILLER for w in words) or all(w in name_tokens for w in words):
                continue
            seen.add(t)
            counts[t] += 1
            first.setdefault(t, len(first))
    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], first[kv[0]]))[:CLOUD_SIZE]
    return [{"word": w, "count": c} for w, c in ranked]


def name_tokens(w, e):
    """Words of the brand, product and Vivino title: not descriptors of the wine."""
    txt = " ".join(str(x or "") for x in (w.get("brand"), (e or {}).get("page_winery"), (e or {}).get("page_h1")))
    return set(re.findall(r"[a-z]+", txt.lower())) - {"red", "white", "rose", "dry", "sweet", "sparkling"}


def main():
    path = os.path.join(DATA, "wines.json")
    doc = json.load(open(path, encoding="utf-8"))
    wines = [w for w in doc["wines"] if w["is_wine"]]
    matches = load_jsonl("match_*.jsonl")
    extracts = load_jsonl("extract_*.jsonl")
    terms = load_terms()
    # wines found by Vivino's on-site search (extract_s*.jsonl) carry their own match line
    for sid, e in load_jsonl("extract_s*.jsonl").items():
        if sid not in matches:
            matches[sid] = {"scw_id": sid, "query": e.get("query"), "vivino_url": e.get("vivino_url"),
                            "status": "not_found" if e.get("status") == "not_found" else "matched",
                            "confidence": "high" if e.get("producer_match") and e.get("wine_match") else "low",
                            "note": "found with vivino.com site search", "result_title": e.get("page_h1")}
    buckets = collections.Counter()
    per = []
    for w in wines:
        m = matches.get(w["scw_id"])
        e = extracts.get(w["scw_id"])
        brand_tokens = set(re.findall(r"[a-z]+", (w["brand"] or "").lower())) - {"red", "white", "rose"}
        v = {"source": "vivino.com", "captured": "2026-11-19"}
        if m is None:
            v.update(match_status="not_searched")
        elif m.get("status") == "not_found" or not m.get("vivino_url"):
            v.update(match_status="not_found", search_query=m.get("query"), note=m.get("note"))
        else:
            v.update(url=m["vivino_url"], vivino_wine_id=m.get("vivino_wine_id"),
                     search_query=m.get("query"), search_result_title=m.get("result_title"),
                     search_confidence=m.get("confidence"), search_note=m.get("note"))
            ok = e is not None and e.get("status") == "ok"
            verified = ok and e.get("producer_match") and e.get("wine_match")
            # a search that already doubted the cuvee stays low confidence, even if the page checks out
            search_doubt = m.get("status") == "low_confidence"
            if ok:
                v["page"] = {k: e.get(k) for k in ("page_h1", "page_winery", "page_winery_url", "page_grapes",
                                                     "page_region", "page_type")}
                v["verify_note"] = e.get("verify_note")
            if verified and search_doubt:
                v.update(match_status="low_confidence",
                         reason="search could not confirm the exact cuvee: " + (m.get("note") or ""),
                         candidate_rating=e.get("rating"), candidate_ratings_count=e.get("ratings_count"))
            elif verified:
                wid = int(re.search(r"/w/(\d+)", m["vivino_url"]).group(1))
                t = terms.get(wid)
                rt = (t or {}).get("review_terms") or []
                v.update(match_status="matched",
                         match_confidence=("high" if m.get("confidence") == "high" else "medium")
                         if e.get("rating") is not None else "medium",
                         rating=round(float(e["rating"]), 1) if e.get("rating") is not None else None,
                         ratings_count=e.get("ratings_count"),
                         ratings_count_note=e.get("ratings_count_note"),
                         rating_scope="all vintages (wine page header)",
                         reviews_counted=len(rt[:REVIEW_CAP]), reviews_cap=REVIEW_CAP,
                         reviews_read=(t or {}).get("reviews_in_list"),
                         word_cloud=word_cloud(rt, name_tokens(w, e)),
                         word_cloud_note=("terms from the English reviews on the first page of Vivino's reviews list (Vivino's own order); "
                                          "count = number of reviews that used the term")
                         if t and t.get("status") == "ok" else
                         ("reviews not read: " + str((t or {}).get("status") or "not fetched")),
                         taste_summary={"based_on_reviews": e.get("taste_based_on"),
                                        "groups": e.get("taste_groups") or []})
                if e.get("rating") is None:
                    v["note"] = "Vivino shows no average rating for this wine yet"
            else:
                why = ("page not read: " + (e.get("verify_note") or e.get("status") or "")) if e and not ok else \
                      ("page read but did not verify: " + (e.get("verify_note") or "")) if ok else \
                      "page not read"
                v.update(match_status="low_confidence", reason=why)
        w["vivino"] = v
        buckets[v["match_status"]] += 1
        per.append({"scw_id": w["scw_id"], "brand": w["brand"], "product_name": w["product_name"],
                    "status": v["match_status"], "url": v.get("url"), "rating": v.get("rating"),
                    "ratings_count": v.get("ratings_count"), "reviews_counted": v.get("reviews_counted", 0),
                    "cloud_terms": len(v.get("word_cloud") or []),
                    "reason": v.get("reason") or v.get("note")})
    summary = {"captured": "2026-11-19", "wines": len(wines), "buckets": dict(buckets),
               "review_cap_per_wine": REVIEW_CAP, "word_cloud_size": CLOUD_SIZE,
               "method": ("Per-wine web search restricted to vivino.com (brand + wine name), then a read of each "
                          "candidate wine page: rating, rating count, title, winery, grapes and region from the page "
                          "header and facts. A match is kept only when the page names the same producer and the same "
                          "wine as the Whole Foods listing (build/vivino_fetch_to_extract.py), and the search did not "
                          "doubt the cuvee. The grapes listing was used to learn the site structure, not crawled. "
                          "robots.txt-disallowed paths (/reviews/, /users/) were not visited. Word clouds come from "
                          "the first page (up to 10) of each wine's public reviews JSON (/api/wines/<id>/reviews, "
                          "not disallowed by robots.txt): descriptor terms per English review, counted in code. "
                          "Review texts, reviewer names and profiles are never stored."),
               "reviews_note": "Only term counts are kept; see reviews_counted and word_cloud per wine."}
    doc["vivino_enrichment"] = summary
    with open(path, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    scw_dir = os.path.join(DATA, "scw")
    for w in doc["wines"]:
        p = os.path.join(scw_dir, f'{w["scw_id"]}.json')
        rec = json.load(open(p, encoding="utf-8"))
        rec["record"] = w
        with open(p, "w", encoding="utf-8") as f:
            json.dump(rec, f, ensure_ascii=False, indent=1)
    p0 = os.path.join(scw_dir, "SCW0.json")
    s0 = json.load(open(p0, encoding="utf-8"))
    s0["vivino_enrichment"] = summary
    with open(p0, "w", encoding="utf-8") as f:
        json.dump(s0, f, ensure_ascii=False, indent=1)
    with open(os.path.join(DATA, "vivino_report.json"), "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "wines": per}, f, ensure_ascii=False, indent=1)
    print(json.dumps(summary["buckets"]), "matches read:", len(matches), "extracts read:", len(extracts))


if __name__ == "__main__":
    sys.exit(main())
