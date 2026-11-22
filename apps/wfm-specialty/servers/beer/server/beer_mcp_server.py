#!/usr/bin/env python3
"""Whole Foods Beer MCP server (stdio, JSON-RPC 2.0, MCP protocol).

Zero third-party dependencies: Python 3.9+ standard library only.
Serves the standardized dataset in ../data/beers.json (override with BEER_DATA).
"""
import json
import os
import re
import sys

SERVER_NAME = "wholefoods-beer"
SERVER_VERSION = "1.0.0"
SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"]
DATA_PATH = os.environ.get(
    "BEER_DATA",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "beers.json"),
)


def load_dataset(path):
    with open(path, encoding="utf-8") as f:
        doc = json.load(f)
    beers = doc["beers"] if isinstance(doc, dict) else doc
    return doc, beers


DOC, BEERS = load_dataset(DATA_PATH)
BY_ASIN = {b["asin"].upper(): b for b in BEERS}
BY_SCW = {b["scw_id"].upper(): b for b in BEERS}

WEIGHTS = {"brand": 3, "product_name": 4, "style": 4, "type_family": 2, "country": 2,
           "grid_name": 2, "ingredients": 1, "flavor_selected": 2}


def _norm(s):
    return re.sub(r"\s+", " ", str(s or "").lower()).strip()


def _tokens(s):
    return [t for t in re.findall(r"[a-z0-9À-ɏ']+", _norm(s)) if t]


def _stem(t):
    for suf in ("ies", "es", "s"):
        if len(t) > 4 and t.endswith(suf):
            return t[: -len(suf)] + ("y" if suf == "ies" else "")
    return t


def _contains(hay, needle):
    return _norm(needle) in _norm(hay)


def summary(b):
    return {
        "scw_id": b["scw_id"], "asin": b["asin"], "brand": b["brand"], "product_name": b["product_name"],
        "style": b["style"], "type_family": b["type_family"], "product_type": b["product_type"],
        "non_alcoholic": b["non_alcoholic"], "pack_count": b["pack_count"], "container": b["container"],
        "container_fl_oz": b["container_fl_oz"], "abv_pct": b["abv_pct"], "price": b["price"],
        "list_price": b["list_price"], "discount_note": b["discount_note"],
        "price_per_container_usd": b["price_per_container_usd"], "price_per_fl_oz_usd": b["price_per_fl_oz_usd"],
        "url": b["url"],
    }


def _num(args, key):
    v = args.get(key)
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        raise ValueError(f"{key} must be a number")


def _range_ok(value, lo, hi):
    if lo is None and hi is None:
        return True
    if value is None:
        return False
    return (lo is None or value >= lo) and (hi is None or value <= hi)


def _filter(args):
    lo_p, hi_p = _num(args, "min_price"), _num(args, "max_price")
    lo_a, hi_a = _num(args, "min_abv"), _num(args, "max_abv")
    out = []
    for b in BEERS:
        if args.get("style") and not _contains(f'{b.get("style") or ""} {b["product_name"]}', args["style"]):
            continue
        if args.get("type_family") and _norm(b.get("type_family")) != _norm(args["type_family"]):
            continue
        if args.get("product_type") and _norm(b.get("product_type")) != _norm(args["product_type"]):
            continue
        if args.get("brand") and not _contains(b["brand"], args["brand"]):
            continue
        if args.get("country") and _norm(b.get("country")) != _norm(args["country"]):
            continue
        if args.get("container") and _norm(b.get("container")) != _norm(args["container"]):
            continue
        if args.get("pack_count") is not None:
            try:
                if b.get("pack_count") != int(args["pack_count"]):
                    continue
            except (TypeError, ValueError):
                raise ValueError("pack_count must be an integer")
        if args.get("non_alcoholic") is not None and bool(b["non_alcoholic"]) != bool(args["non_alcoholic"]):
            continue
        if not _range_ok(b.get("price_usd"), lo_p, hi_p):
            continue
        if not _range_ok(b.get("abv_pct"), lo_a, hi_a):
            continue
        out.append(b)
    return out


def _score(b, qtoks):
    score = 0.0
    for field, wt in WEIGHTS.items():
        ftoks = {_stem(t) for t in _tokens(b.get(field) or "")}
        score += wt * sum(1 for q in qtoks if q in ftoks)
    btoks = {_stem(t) for t in _tokens(" ".join(b.get("description_bullets") or []))}
    score += sum(1 for q in qtoks if q in btoks)
    return score


def _limit(args, default=20, cap=200):
    try:
        n = int(args.get("limit", default))
    except (TypeError, ValueError):
        raise ValueError("limit must be an integer")
    if n < 1:
        raise ValueError("limit must be >= 1")
    return min(n, cap)


def tool_search_beers(args):
    pool = _filter(args)
    q = args.get("query")
    limit = _limit(args)
    if q:
        qtoks = [_stem(t) for t in _tokens(q)]
        scored = [(_score(b, qtoks), b) for b in pool]
        scored = [(s, b) for s, b in scored if s > 0]
        scored.sort(key=lambda sb: (-sb[0], sb[1]["position"]))
        results = [dict(summary(b), score=s) for s, b in scored]
    else:
        results = [summary(b) for b in sorted(pool, key=lambda b: b["position"])]
    return {"total_matches": len(results), "returned": min(len(results), limit), "results": results[:limit]}


def tool_get_beer(args):
    key = (args.get("asin") or args.get("scw_id") or "").strip().upper()
    if not key:
        raise ValueError("provide asin or scw_id")
    b = BY_ASIN.get(key) or BY_SCW.get(key)
    if b is None:
        raise ValueError(f"no beer with asin or scw_id {key!r}")
    return b


def _none_last(key, desc=False):
    def f(b):
        v = b.get(key)
        return (v is None, -(v or 0) if desc else (v or 0), b["position"])
    return f


SORTS = {
    "position": lambda b: b["position"],
    "price_asc": _none_last("price_usd"), "price_desc": _none_last("price_usd", True),
    "price_per_oz_asc": _none_last("price_per_fl_oz_usd"),
    "abv_desc": _none_last("abv_pct", True), "abv_asc": _none_last("abv_pct"),
    "brand": lambda b: (_norm(b["brand"]), b["position"]),
}


def tool_list_beers(args):
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
            "results": [summary(b) for b in page]}


def tool_get_variants(args):
    b = tool_get_beer(args)
    def side(opts):
        return [dict(o, scw_id=(BY_ASIN.get(o["asin"]) or {}).get("scw_id") if o.get("asin") else None) for o in opts]
    return {"scw_id": b["scw_id"], "asin": b["asin"], "product_name": b["product_name"],
            "size_selected": b["size_selected"], "size_options": side(b["size_options"]),
            "flavor_selected": b["flavor_selected"], "flavor_options": side(b["flavor_options"]),
            "other_pickers": b["other_pickers"]}


def tool_dataset_stats(args):
    def count(key):
        out = {}
        for b in BEERS:
            k = b.get(key)
            k = "not stated" if k is None else str(k)
            out[k] = out.get(k, 0) + 1
        return dict(sorted(out.items(), key=lambda kv: -kv[1]))
    fields = ["style", "pack_count", "container", "container_fl_oz", "abv_pct", "country", "ingredients",
              "in_store_location", "price_usd"]
    cov = {f: round(100.0 * sum(1 for b in BEERS if b.get(f) not in (None, "", [])) / max(len(BEERS), 1), 1)
           for f in fields}
    return {"source": DOC.get("source") if isinstance(DOC, dict) else None, "records": len(BEERS),
            "non_beer_grid_items_skipped": len(DOC.get("skipped_non_beer", [])) if isinstance(DOC, dict) else 0,
            "non_alcoholic": sum(1 for b in BEERS if b["non_alcoholic"]),
            "field_coverage_pct": cov, "by_type_family": count("type_family"), "by_style": count("style"),
            "by_product_type": count("product_type"), "by_pack_count": count("pack_count"),
            "by_container": count("container")}


COMMON_FILTERS = {
    "style": {"type": "string", "description": "Style text, e.g. 'IPA', 'Hazy IPA', 'Pilsner', 'Stout'"},
    "type_family": {"type": "string", "description": "Family, e.g. 'IPA', 'Lager & pilsner', 'Wheat', 'Cider', 'Hard seltzer'"},
    "product_type": {"type": "string", "enum": ["beer", "hard_cider", "hard_seltzer", "hard_kombucha", "hard_tea", "hard_other"]},
    "brand": {"type": "string", "description": "Brand substring"},
    "country": {"type": "string", "description": "Country named on the page, e.g. 'Belgium'"},
    "container": {"type": "string", "enum": ["Can", "Bottle"]},
    "pack_count": {"type": "integer", "description": "Containers per pack, e.g. 6 or 12; 1 for singles"},
    "non_alcoholic": {"type": "boolean", "description": "true: only non-alcoholic; false: only alcoholic"},
    "min_price": {"type": "number"}, "max_price": {"type": "number"},
    "min_abv": {"type": "number"}, "max_abv": {"type": "number"},
}

TOOLS = [
    {"name": "search_beers",
     "description": "Search Whole Foods beers, ciders and hard seltzers by free text (brand, name, style, ingredients, description) with optional filters.",
     "inputSchema": {"type": "object", "properties": dict(
         {"query": {"type": "string"}, "limit": {"type": "integer", "minimum": 1, "maximum": 200, "default": 20}},
         **COMMON_FILTERS)}},
    {"name": "get_beer",
     "description": "Full standardized record for one product by ASIN (e.g. B007C62Q20) or SCW id (e.g. SCW2).",
     "inputSchema": {"type": "object", "properties": {"asin": {"type": "string"}, "scw_id": {"type": "string"}}}},
    {"name": "list_beers",
     "description": "List products in pages, optionally filtered and sorted.",
     "inputSchema": {"type": "object", "properties": dict(
         {"offset": {"type": "integer", "minimum": 0, "default": 0},
          "limit": {"type": "integer", "minimum": 1, "maximum": 200, "default": 50},
          "sort": {"type": "string", "enum": sorted(SORTS), "default": "position"}}, **COMMON_FILTERS)}},
    {"name": "get_variants",
     "description": "Size (pack and container) and flavor options shown on a product's page, with prices and links to the matching records.",
     "inputSchema": {"type": "object", "properties": {"asin": {"type": "string"}, "scw_id": {"type": "string"}}}},
    {"name": "dataset_stats",
     "description": "Record counts, field coverage and breakdowns by family, style, pack and container.",
     "inputSchema": {"type": "object", "properties": {}}},
]

HANDLERS = {"search_beers": tool_search_beers, "get_beer": tool_get_beer, "list_beers": tool_list_beers,
            "get_variants": tool_get_variants, "dataset_stats": tool_dataset_stats}

RESOURCES = [{"uri": "beers://dataset", "name": "beers.json", "mimeType": "application/json",
              "description": "The full standardized Whole Foods beer dataset"}]


def handle(msg):
    method = msg.get("method")
    params = msg.get("params") or {}
    if method == "initialize":
        requested = params.get("protocolVersion")
        version = requested if requested in SUPPORTED_PROTOCOLS else SUPPORTED_PROTOCOLS[0]
        return {"protocolVersion": version,
                "capabilities": {"tools": {"listChanged": False}, "resources": {"listChanged": False}},
                "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
                "instructions": "Whole Foods beer catalog (beer, non-alcoholic beer, cider, hard seltzer, hard kombucha). "
                                "Use search_beers / list_beers to browse, get_beer for one record, get_variants for pack and flavor options."}
    if method == "ping":
        return {}
    if method == "tools/list":
        return {"tools": TOOLS}
    if method == "tools/call":
        fn = HANDLERS.get(params.get("name"))
        if fn is None:
            raise LookupError(f"unknown tool {params.get('name')!r}")
        try:
            result = fn(params.get("arguments") or {})
        except (ValueError, TypeError) as e:
            return {"content": [{"type": "text", "text": f"Error: {e}"}], "isError": True}
        return {"content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False, indent=2)}],
                "structuredContent": result, "isError": False}
    if method == "resources/list":
        return {"resources": RESOURCES}
    if method == "resources/read":
        if params.get("uri") != "beers://dataset":
            raise LookupError(f"unknown resource {params.get('uri')!r}")
        with open(DATA_PATH, encoding="utf-8") as f:
            text = f.read()
        return {"contents": [{"uri": "beers://dataset", "mimeType": "application/json", "text": text}]}
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
            out.write(json.dumps({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}}) + "\n")
            out.flush()
            continue
        if "id" not in msg:
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
