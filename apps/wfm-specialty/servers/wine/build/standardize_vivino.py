"""Put every wine's `vivino` block into one layout (Vivino schema v2), whichever pass wrote it.

Run after the Vivino merges (build/enrich_vivino.py for Nov 19, build/merge_vivino_2026_11_22.py for Nov 22).
Safe to rerun: a block already in v2 comes out unchanged.

Layout:
- Every record has a `vivino` key: null for items that are not wine, a block for every wine.
- Every block has every field in FIELDS, null where the pass did not record it (word_cloud is [] when empty).
- word_cloud_source: "vivino_reviews" (Nov 19, terms counted in up to 10 English reviews),
  "vivino_taste_summary" (Nov 22, flavor keywords from the wine page's taste summary), or null (no cloud).
- taste_summary: null when no taste summary was captured, else
  {"based_on_reviews": int, "groups": [{"group", "group_source", "keywords", "keywords_truncated", "mentions"}]}.
  keywords is always a list. Keywords Vivino cut short with "..." are left out; keywords_truncated says whether
  that happened (true or false for Nov 19, where the shown text was kept; null for Nov 22, where it was not recorded).
  group is Vivino's flavor group name. group_source is "vivino_page" when the page text was saved (Nov 19) or
  "keyword_lookup" when it was matched by keyword (Nov 22): first against the saved page groups, then against
  keywords that sit beside an already matched keyword in another wine's group. group is null when nothing matched.
"""
import collections, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEMA = 2
FIELDS = ["source", "captured", "match_status", "url", "vivino_wine_id",
          "search_query", "search_result_title", "search_confidence", "search_note",
          "page", "verify_note", "match_confidence",
          "rating", "ratings_count", "ratings_count_note", "rating_scope",
          "candidate_rating", "candidate_ratings_count",
          "reviews_counted", "reviews_cap", "reviews_read",
          "word_cloud", "word_cloud_source", "word_cloud_note", "taste_summary",
          "reason", "note", "reused_from", "reuse_note"]
PAGE_FIELDS = ["page_h1", "page_winery", "page_winery_url", "page_grapes", "page_region", "page_type"]


def split_keywords(kw):
    """'citrus, grapefruit, lem...' -> (['citrus', 'grapefruit'], True); a list passes through."""
    if isinstance(kw, list):
        return [k.strip() for k in kw if k and k.strip()], None
    parts = [p.strip() for p in str(kw or "").split(",")]
    cut = any(p.endswith("...") or p.endswith("…") for p in parts)
    return [p for p in parts if p and not (p.endswith("...") or p.endswith("…"))], cut


def keyword_groups(wines, source="vivino_page"):
    """keyword -> Vivino group name, from groups whose name came from `source`."""
    votes = collections.defaultdict(collections.Counter)
    for w in wines:
        ts = (w.get("vivino") or {}).get("taste_summary") or {}
        for g in ts.get("groups") or []:
            if g.get("group") and g.get("group_source", "vivino_page") == source:
                for k in split_keywords(g.get("keywords"))[0]:
                    votes[k.lower()][g["group"]] += 1
    return {k: c.most_common(1)[0][0] for k, c in votes.items()}


def std_taste(ts, lookup, captured):
    if not ts or not ts.get("groups"):
        return None
    groups = []
    for g in ts["groups"]:
        kws, cut = split_keywords(g.get("keywords"))
        if "group_source" in g:  # already v2
            name, src = g.get("group"), g.get("group_source")
            if not name:
                hits = collections.Counter(lookup[k.lower()] for k in kws if k.lower() in lookup)
                name, src = (hits.most_common(1)[0][0], "keyword_lookup") if hits else (None, None)
            groups.append({"group": name, "group_source": src, "keywords": kws,
                           "keywords_truncated": g.get("keywords_truncated"), "mentions": g.get("mentions")})
            continue
        name, src = g.get("group"), "vivino_page"
        if not name:
            hits = collections.Counter(lookup[k.lower()] for k in kws if k.lower() in lookup)
            name, src = (hits.most_common(1)[0][0], "keyword_lookup") if hits else (None, None)
        groups.append({"group": name, "group_source": src, "keywords": kws,
                       "keywords_truncated": cut if captured != "2026-11-22" else None,
                       "mentions": int(g["mentions"]) if g.get("mentions") is not None else None})
    return {"based_on_reviews": ts.get("based_on_reviews"), "groups": groups}


def std_block(v, lookup):
    out = {f: v.get(f) for f in FIELDS}
    out["word_cloud"] = v.get("word_cloud") or []
    if out["word_cloud_source"] is None and out["word_cloud"]:
        out["word_cloud_source"] = "vivino_reviews"
    if out["page"] is not None:
        out["page"] = {f: out["page"].get(f) for f in PAGE_FIELDS}
    out["taste_summary"] = std_taste(v.get("taste_summary"), lookup, v.get("captured"))
    extra = sorted(set(v) - set(FIELDS))
    if extra:
        raise SystemExit("unknown vivino fields %s; add them to FIELDS" % extra)
    return out


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "data", "wines.json")
    doc = json.load(open(path, encoding="utf-8"))
    wines = doc["wines"]
    page_lookup = keyword_groups(wines)
    lookup = dict(page_lookup)
    for _ in range(5):  # a keyword first seen beside a matched one inherits that group; page groups always win
        for w in wines:
            if not w.get("is_wine"):
                w["vivino"] = None
                continue
            if w.get("vivino") is None:
                raise SystemExit(w["scw_id"] + " is a wine with no vivino block; run the merges first")
            w["vivino"] = std_block(w["vivino"], lookup)
        grown = dict(keyword_groups(wines, "keyword_lookup"), **page_lookup)
        if grown == lookup:
            break
        lookup = grown
    stats = collections.Counter()
    for w in wines:
        if not w.get("vivino"):
            continue
        for g in (w["vivino"]["taste_summary"] or {}).get("groups", []):
            stats["groups_" + str(g["group_source"])] += 1
    doc["vivino_schema"] = {"version": SCHEMA, "fields": FIELDS, "page_fields": PAGE_FIELDS,
                            "doc": "build/standardize_vivino.py"}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    scw_dir = os.path.join(os.path.dirname(path), "scw")
    synced = 0
    by_id = {w["scw_id"]: w for w in wines}
    for name in sorted(os.listdir(scw_dir)) if os.path.isdir(scw_dir) else []:
        sid = name[:-5]
        if name.endswith(".json") and sid in by_id:
            p = os.path.join(scw_dir, name)
            rec = json.load(open(p, encoding="utf-8"))
            if "record" in rec and rec["record"] != by_id[sid]:
                rec["record"] = by_id[sid]
                with open(p, "w", encoding="utf-8") as f:
                    json.dump(rec, f, ensure_ascii=False, indent=1)
                synced += 1
    print(json.dumps(dict(stats)), "lookup_keywords", len(lookup), "scw_files_synced", synced)


if __name__ == "__main__":
    main()
