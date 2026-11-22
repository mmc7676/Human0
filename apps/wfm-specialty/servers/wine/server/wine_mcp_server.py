#!/usr/bin/env python3
"""Whole Foods Wine MCP server (stdio, JSON-RPC 2.0, MCP protocol).

Zero third-party dependencies: Python 3.9+ standard library only.
Serves the standardized dataset in ../data/wines.json (override with WINE_DATA).
"""
import json
import os
import re
import sys

SERVER_NAME = "wholefoods-wine"
SERVER_VERSION = "1.1.0"
SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"]
DATA_PATH = os.environ.get(
    "WINE_DATA",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "wines.json"),
)


def load_dataset(path):
    with open(path, encoding="utf-8") as f:
        doc = json.load(f)
    wines = doc["wines"] if isinstance(doc, dict) else doc
    return doc, wines


DOC, WINES = load_dataset(DATA_PATH)
BY_ASIN = {w["asin"].upper(): w for w in WINES}
BY_SCW = {w["scw_id"].upper(): w for w in WINES}

SEARCH_FIELDS = ("brand", "product_name", "varietal", "color", "vineyard_location",
                 "winemaking", "tasting_notes", "pairing", "vintage", "other_notes")


def _norm(s):
    return re.sub(r"\s+", " ", (s or "").lower()).strip()


def _tokens(s):
    return [t for t in re.findall(r"[a-z0-9À-ɏ']+", _norm(s)) if t]


def _stem(t):
    for suf in ("ies", "es", "s"):
        if len(t) > 4 and t.endswith(suf):
            return t[: -len(suf)] + ("y" if suf == "ies" else "")
    return t


def _contains(hay, needle):
    return _norm(needle) in _norm(hay)


def summary(w):
    return {
        "scw_id": w["scw_id"],
        "asin": w["asin"],
        "brand": w["brand"],
        "product_name": w["product_name"],
        "size": w["size"],
        "price": w["price"],
        "color": w["color"],
        "varietal": w["varietal"],
        "country": w.get("country"),
        "vineyard_location": w["vineyard_location"],
        "url": w["url"],
        "vivino_rating": _viv(w).get("rating"),
        "vivino_ratings_count": _viv(w).get("ratings_count"),
    }


def _viv(w):
    """Vivino block for a wine; {} unless the match was confirmed on the Vivino page."""
    v = w.get("vivino") or {}
    return v if v.get("match_status") == "matched" else {}


def _price_ok(w, lo, hi):
    p = w.get("price_usd")
    if lo is None and hi is None:
        return True
    if p is None:
        return False
    if lo is not None and p < float(lo):
        return False
    if hi is not None and p > float(hi):
        return False
    return True


def _filter(args):
    out = []
    include_non_wine = bool(args.get("include_non_wine", False))
    for w in WINES:
        if not include_non_wine and not w.get("is_wine", True):
            continue
        if args.get("varietal") and not _contains(
                f'{w.get("varietal") or ""} {w["product_name"]}', args["varietal"]):
            continue
        if args.get("color") and _norm(w.get("color")) != _norm(args["color"]):
            continue
        if args.get("region") and not _contains(
                f'{w.get("vineyard_location") or ""} {w["product_name"]} {w.get("other_notes") or ""}',
                args["region"]):
            continue
        if args.get("country") and _norm(w.get("country")) != _norm(args["country"]):
            continue
        if args.get("brand") and not _contains(w["brand"], args["brand"]):
            continue
        if args.get("size") and _norm(w.get("size")) != _norm(args["size"]):
            continue
        if not _price_ok(w, args.get("min_price"), args.get("max_price")):
            continue
        if args.get("min_rating") is not None:
            r = _viv(w).get("rating")
            if r is None or r < float(args["min_rating"]):
                continue
        if args.get("has_vivino") is not None and bool(_viv(w)) != bool(args["has_vivino"]):
            continue
        out.append(w)
    return out


def _score(w, qtoks):
    score = 0.0
    weights = {"brand": 3, "product_name": 4, "varietal": 4, "color": 2, "vineyard_location": 3,
               "tasting_notes": 2, "pairing": 2, "winemaking": 1, "vintage": 1, "other_notes": 1}
    for field, wt in weights.items():
        ftoks = {_stem(t) for t in _tokens(w.get(field) or "")}
        for q in qtoks:
            if q in ftoks:
                score += wt
    return score


def _limit(args, default=20, cap=200):
    try:
        n = int(args.get("limit", default))
    except (TypeError, ValueError):
        raise ValueError("limit must be an integer")
    if n < 1:
        raise ValueError("limit must be >= 1")
    return min(n, cap)


def tool_search_wines(args):
    pool = _filter(args)
    q = args.get("query")
    limit = _limit(args)
    if q:
        qtoks = [_stem(t) for t in _tokens(q)]
        scored = [(_score(w, qtoks), w) for w in pool]
        scored = [(s, w) for s, w in scored if s > 0]
        scored.sort(key=lambda sw: (-sw[0], sw[1]["position"]))
        results = [dict(summary(w), score=s) for s, w in scored]
    else:
        results = [summary(w) for w in sorted(pool, key=lambda w: w["position"])]
    return {"total_matches": len(results), "returned": min(len(results), limit),
            "results": results[:limit]}


def tool_get_wine(args):
    key = (args.get("asin") or args.get("scw_id") or "").strip().upper()
    if not key:
        raise ValueError("provide asin or scw_id")
    w = BY_ASIN.get(key) or BY_SCW.get(key)
    if w is None:
        raise ValueError(f"no wine with asin or scw_id {key!r}")
    return w


SORTS = {
    "position": lambda w: w["position"],
    "price_asc": lambda w: (w.get("price_usd") is None, w.get("price_usd") or 0, w["position"]),
    "price_desc": lambda w: (w.get("price_usd") is None, -(w.get("price_usd") or 0), w["position"]),
    "brand": lambda w: (_norm(w["brand"]), w["position"]),
    "rating_desc": lambda w: (_viv(w).get("rating") is None, -(_viv(w).get("rating") or 0),
                              -(_viv(w).get("ratings_count") or 0), w["position"]),
}


def tool_get_vivino(args):
    w = tool_get_wine(args)
    v = w.get("vivino")
    if not v:
        return {"scw_id": w["scw_id"], "asin": w["asin"], "match_status": "not_searched"}
    return dict({"scw_id": w["scw_id"], "asin": w["asin"], "brand": w["brand"],
                 "product_name": w["product_name"]}, **v)


def tool_list_wines(args):
    sort = args.get("sort", "position")
    if sort not in SORTS:
        raise ValueError(f"sort must be one of {sorted(SORTS)}")
    try:
        offset = int(args.get("offset", 0))
    except (TypeError, ValueError):
        raise ValueError("offset must be an integer")
    if offset < 0:
        raise ValueError("offset must be >= 0")
    limit = _limit(args, default=50)
    pool = sorted(_filter(args), key=SORTS[sort])
    page = pool[offset: offset + limit]
    return {"total": len(pool), "offset": offset, "limit": limit,
            "next_offset": offset + limit if offset + limit < len(pool) else None,
            "results": [summary(w) for w in page]}


def tool_wines_by_pairing(args):
    food = args.get("food")
    if not food or not str(food).strip():
        raise ValueError("food is required")
    limit = _limit(args)
    ftoks = [_stem(t) for t in _tokens(food)]
    phrase = _norm(food)
    pool = _filter(args)
    hits = []
    for w in pool:
        p = w.get("pairing")
        if not p:
            continue
        ptoks = {_stem(t) for t in _tokens(p)}
        matched = [t for t in ftoks if t in ptoks]
        if not matched:
            continue
        s = len(matched) / len(ftoks) + (1.0 if phrase in _norm(p) else 0.0)
        hits.append((s, w, matched))
    hits.sort(key=lambda h: (-h[0], h[1]["position"]))
    return {"food": food, "total_matches": len(hits), "returned": min(len(hits), limit),
            "results": [dict(summary(w), pairing=w["pairing"], matched_terms=m, score=round(s, 3))
                        for s, w, m in hits[:limit]]}


def tool_dataset_stats(args):
    wines_only = [w for w in WINES if w.get("is_wine", True)]
    fields = ["brand", "product_name", "size", "price", "vineyard_location", "winemaking",
              "tasting_notes", "pairing", "vintage"]
    cov = {f: round(100.0 * sum(1 for w in wines_only if w.get(f)) / max(len(wines_only), 1), 1)
           for f in fields}
    by_color = {}
    for w in wines_only:
        by_color[w.get("color") or "unknown"] = by_color.get(w.get("color") or "unknown", 0) + 1
    vstat = {}
    for w in wines_only:
        k = (w.get("vivino") or {}).get("match_status", "not_searched")
        vstat[k] = vstat.get(k, 0) + 1
    rated = [_viv(w)["rating"] for w in wines_only if _viv(w).get("rating") is not None]
    return {"source": DOC.get("source") if isinstance(DOC, dict) else None,
            "vivino": {"enrichment": DOC.get("vivino_enrichment") if isinstance(DOC, dict) else None,
                       "match_status": vstat, "rated_wines": len(rated),
                       "mean_rating": round(sum(rated) / len(rated), 2) if rated else None,
                       "wines_with_word_cloud": sum(1 for w in wines_only if _viv(w).get("word_cloud"))},
            "records": len(WINES), "wines": len(wines_only),
            "non_wine_records": len(WINES) - len(wines_only),
            "field_coverage_pct": cov, "by_color": by_color}


COMMON_FILTERS = {
    "varietal": {"type": "string", "description": "Grape or style, e.g. 'Pinot Noir', 'Prosecco'"},
    "color": {"type": "string", "enum": ["red", "white", "rosé", "sparkling", "dessert", "orange", "other"],
              "description": "Wine color/style class"},
    "region": {"type": "string", "description": "Place text, e.g. 'Napa', 'France', 'Marlborough'"},
    "country": {"type": "string", "description": "Exact country, e.g. 'France', 'United States' (from the Whole Foods listing, else the matched Vivino page's region)"},
    "brand": {"type": "string", "description": "Vineyard/brand substring"},
    "size": {"type": "string", "description": "Exact size, e.g. '750 mL', '1.5 L'"},
    "min_price": {"type": "number", "description": "Minimum current price in USD"},
    "max_price": {"type": "number", "description": "Maximum current price in USD"},
    "include_non_wine": {"type": "boolean", "description": "Include non-wine grid items (default false)"},
    "min_rating": {"type": "number", "minimum": 0, "maximum": 5,
                   "description": "Minimum Vivino average rating (confirmed matches only), e.g. 4.0"},
    "has_vivino": {"type": "boolean", "description": "true: only wines with a confirmed Vivino match; false: only without"},
}

TOOLS = [
    {"name": "search_wines",
     "description": "Search Whole Foods wines by free text (brand, name, varietal, region, tasting notes, pairing) with optional filters.",
     "inputSchema": {"type": "object", "properties": dict(
         {"query": {"type": "string", "description": "Free-text query"},
          "limit": {"type": "integer", "minimum": 1, "maximum": 200, "default": 20}}, **COMMON_FILTERS)}},
    {"name": "get_wine",
     "description": "Get the full standardized record for one wine by ASIN (e.g. B06XDCLG7X) or SCW id (e.g. SCW1).",
     "inputSchema": {"type": "object", "properties": {
         "asin": {"type": "string"}, "scw_id": {"type": "string"}}}},
    {"name": "list_wines",
     "description": "List wines in pages, optionally filtered and sorted.",
     "inputSchema": {"type": "object", "properties": dict(
         {"offset": {"type": "integer", "minimum": 0, "default": 0},
          "limit": {"type": "integer", "minimum": 1, "maximum": 200, "default": 50},
          "sort": {"type": "string", "enum": sorted(SORTS), "default": "position"}}, **COMMON_FILTERS)}},
    {"name": "wines_by_pairing",
     "description": "Find wines whose producer pairing notes mention a food (e.g. 'salmon', 'goat cheese', 'grilled steak').",
     "inputSchema": {"type": "object", "required": ["food"], "properties": dict(
         {"food": {"type": "string"},
          "limit": {"type": "integer", "minimum": 1, "maximum": 200, "default": 20}}, **COMMON_FILTERS)}},
    {"name": "get_vivino",
     "description": "Vivino data for one wine by ASIN or SCW id: match status and confidence, Vivino URL, average rating, rating count, up to 10 community review texts (no user names), the review word cloud and the taste summary.",
     "inputSchema": {"type": "object", "properties": {
         "asin": {"type": "string"}, "scw_id": {"type": "string"}}}},
    {"name": "dataset_stats",
     "description": "Record counts, field coverage percentages and color breakdown of the dataset.",
     "inputSchema": {"type": "object", "properties": {}}},
]

HANDLERS = {
    "search_wines": tool_search_wines,
    "get_wine": tool_get_wine,
    "list_wines": tool_list_wines,
    "wines_by_pairing": tool_wines_by_pairing,
    "dataset_stats": tool_dataset_stats,
    "get_vivino": tool_get_vivino,
}

RESOURCES = [
    {"uri": "wines://dataset", "name": "wines.json", "mimeType": "application/json",
     "description": "The full standardized Whole Foods wine dataset"},
]


def handle(msg):
    method = msg.get("method")
    params = msg.get("params") or {}
    if method == "initialize":
        requested = params.get("protocolVersion")
        version = requested if requested in SUPPORTED_PROTOCOLS else SUPPORTED_PROTOCOLS[0]
        return {"protocolVersion": version,
                "capabilities": {"tools": {"listChanged": False}, "resources": {"listChanged": False}},
                "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
                "instructions": "Whole Foods wine catalog. Use search_wines / list_wines to browse, "
                                "get_wine for one record, wines_by_pairing to match food against producer pairing notes."}
    if method == "ping":
        return {}
    if method == "tools/list":
        return {"tools": TOOLS}
    if method == "tools/call":
        name = params.get("name")
        fn = HANDLERS.get(name)
        if fn is None:
            raise LookupError(f"unknown tool {name!r}")
        try:
            result = fn(params.get("arguments") or {})
        except (ValueError, TypeError) as e:
            return {"content": [{"type": "text", "text": f"Error: {e}"}], "isError": True}
        return {"content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False, indent=2)}],
                "structuredContent": result, "isError": False}
    if method == "resources/list":
        return {"resources": RESOURCES}
    if method == "resources/read":
        if params.get("uri") != "wines://dataset":
            raise LookupError(f"unknown resource {params.get('uri')!r}")
        with open(DATA_PATH, encoding="utf-8") as f:
            text = f.read()
        return {"contents": [{"uri": "wines://dataset", "mimeType": "application/json", "text": text}]}
    raise NotImplementedError(method)


def main():
    out = sys.stdout
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            out.write(json.dumps({"jsonrpc": "2.0", "id": None,
                                  "error": {"code": -32700, "message": "Parse error"}}) + "\n")
            out.flush()
            continue
        if "id" not in msg:  # notification (e.g. notifications/initialized)
            continue
        resp = {"jsonrpc": "2.0", "id": msg["id"]}
        try:
            resp["result"] = handle(msg)
        except NotImplementedError as e:
            resp["error"] = {"code": -32601, "message": f"Method not found: {e}"}
        except LookupError as e:
            resp["error"] = {"code": -32602, "message": str(e)}
        except Exception as e:  # noqa: BLE001
            resp["error"] = {"code": -32603, "message": f"Internal error: {e}"}
        out.write(json.dumps(resp, ensure_ascii=False) + "\n")
        out.flush()


if __name__ == "__main__":
    main()
