#!/usr/bin/env python3
"""Whole Foods cut-to-order cheese MCP server (stdio, JSON-RPC 2.0, MCP protocol).

Zero third-party dependencies: Python 3.9+ standard library only.
Serves ../data/cheeses.json (override with CHEESE_DATA). Every cheese is sold
by weight (priced per pound) and cut at the cheese counter.
"""
import json
import os
import re
import sys

SERVER_NAME = "wholefoods-cheese"
SERVER_VERSION = "1.0.0"
SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"]
DATA_PATH = os.environ.get(
    "CHEESE_DATA",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "cheeses.json"),
)

with open(DATA_PATH, encoding="utf-8") as _f:
    DOC = json.load(_f)
CHEESES = DOC["cheeses"]
BY_ASIN = {c["asin"].upper(): c for c in CHEESES}
WEIGHTS = {"brand": 3, "name": 4, "style_family": 3, "milk": 2, "country": 2, "form": 1}


def _norm(s):
    return re.sub(r"\s+", " ", str(s or "").lower()).strip()


def _tokens(s):
    return re.findall(r"[a-z0-9À-ɏ']+", _norm(s))


def _stem(t):
    for suf in ("ies", "es", "s"):
        if len(t) > 4 and t.endswith(suf):
            return t[: -len(suf)] + ("y" if suf == "ies" else "")
    return t


def summary(c):
    keys = ("asin", "brand", "name", "price", "price_per_lb_usd", "list_price", "off_pct", "form",
            "age_months", "style_family", "milk", "country", "flavors", "in_stock", "url")
    return {k: c[k] for k in keys}


def _num(args, key):
    v = args.get(key)
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        raise ValueError(f"{key} must be a number")


def _filter(args):
    lo, hi = _num(args, "min_price_per_lb"), _num(args, "max_price_per_lb")
    out = []
    for c in CHEESES:
        if args.get("style_family") and _norm(c["style_family"]) != _norm(args["style_family"]):
            continue
        if args.get("milk") and _norm(args["milk"]) not in _norm(c["milk"]):
            continue
        if args.get("country") and _norm(c["country"]) != _norm(args["country"]):
            continue
        if args.get("form") and _norm(c["form"]) != _norm(args["form"]):
            continue
        if args.get("brand") and _norm(args["brand"]) not in _norm(c["brand"]):
            continue
        if args.get("flavor") and _norm(args["flavor"]) not in [_norm(f) for f in c["flavors"]]:
            continue
        if args.get("on_sale") is not None and bool(c["off_pct"]) != bool(args["on_sale"]):
            continue
        p = c["price_per_lb_usd"]
        if (lo is not None and p < lo) or (hi is not None and p > hi):
            continue
        out.append(c)
    return out


def _limit(args, default=20, cap=200):
    try:
        n = int(args.get("limit", default))
    except (TypeError, ValueError):
        raise ValueError("limit must be an integer")
    if n < 1:
        raise ValueError("limit must be >= 1")
    return min(n, cap)


def _score(c, qtoks):
    s = 0
    for field, wt in WEIGHTS.items():
        ftoks = {_stem(t) for t in _tokens(c.get(field))}
        s += wt * sum(1 for q in qtoks if q in ftoks)
    ftoks = {_stem(t) for t in _tokens(" ".join(c["flavors"]))}
    return s + 2 * sum(1 for q in qtoks if q in ftoks)


def tool_search_cheeses(args):
    pool, limit = _filter(args), _limit(args)
    q = args.get("query")
    if q:
        qt = [_stem(t) for t in _tokens(q)]
        scored = sorted(((_score(c, qt), c) for c in pool), key=lambda sc: (-sc[0], sc[1]["position"]))
        results = [dict(summary(c), score=s) for s, c in scored if s > 0]
    else:
        results = [summary(c) for c in pool]
    return {"total_matches": len(results), "returned": min(len(results), limit), "results": results[:limit]}


def tool_get_cheese(args):
    key = (args.get("asin") or "").strip().upper()
    if not key:
        raise ValueError("provide asin")
    if key not in BY_ASIN:
        raise ValueError(f"no cheese with asin {key!r}")
    return BY_ASIN[key]


SORTS = {
    "position": lambda c: c["position"],
    "price_asc": lambda c: (c["price_per_lb_usd"], c["position"]),
    "price_desc": lambda c: (-c["price_per_lb_usd"], c["position"]),
    "name": lambda c: (_norm(c["name"]), c["position"]),
    "brand": lambda c: (_norm(c["brand"]), c["position"]),
    "discount_desc": lambda c: (-(c["off_pct"] or 0), c["position"]),
}


def tool_list_cheeses(args):
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
    return {"total": len(pool), "offset": offset, "limit": limit,
            "next_offset": offset + limit if offset + limit < len(pool) else None,
            "results": [summary(c) for c in pool[offset: offset + limit]]}


def tool_dataset_stats(args):
    def count(key):
        out = {}
        for c in CHEESES:
            k = "not certain" if c.get(key) is None else str(c[key])
            out[k] = out.get(k, 0) + 1
        return dict(sorted(out.items(), key=lambda kv: -kv[1]))
    reasons = {}
    for e in DOC.get("excluded", []):
        reasons[e["reason"]] = reasons.get(e["reason"], 0) + 1
    prices = [c["price_per_lb_usd"] for c in CHEESES]
    return {"source": DOC.get("source"), "records": len(CHEESES), "on_sale": sum(1 for c in CHEESES if c["off_pct"]),
            "price_per_lb_usd": {"min": min(prices), "max": max(prices)},
            "excluded_by_reason": reasons, "by_style_family": count("style_family"),
            "by_milk": count("milk"), "by_country": count("country"), "by_form": count("form")}


def tool_list_excluded(args):
    return {"total": len(DOC.get("excluded", [])), "results": DOC.get("excluded", [])}


FILTERS = {
    "style_family": {"type": "string", "description": "e.g. 'Blue', 'Soft-ripened', 'Alpine & Swiss', 'Cheddar & British'"},
    "milk": {"type": "string", "description": "'Cow', 'Goat' or 'Sheep' (matches mixed-milk cheeses too)"},
    "country": {"type": "string", "description": "e.g. 'France', 'Italy', 'United States'"},
    "form": {"type": "string", "enum": ["Wedge", "Cubes", "Grated", "Rinds"]},
    "brand": {"type": "string", "description": "Brand substring"},
    "flavor": {"type": "string", "description": "e.g. 'Truffle', 'Smoked', 'Herbs', 'Fruit'"},
    "on_sale": {"type": "boolean"},
    "min_price_per_lb": {"type": "number"}, "max_price_per_lb": {"type": "number"},
}
TOOLS = [
    {"name": "search_cheeses", "description": "Search cut-to-order Whole Foods cheeses by free text (name, brand, style, milk, country, flavor) with optional filters.",
     "inputSchema": {"type": "object", "properties": dict({"query": {"type": "string"},
         "limit": {"type": "integer", "minimum": 1, "maximum": 200, "default": 20}}, **FILTERS)}},
    {"name": "get_cheese", "description": "Full record for one cheese by ASIN (e.g. B086V2MPLK).",
     "inputSchema": {"type": "object", "properties": {"asin": {"type": "string"}}, "required": ["asin"]}},
    {"name": "list_cheeses", "description": "List cheeses in pages, optionally filtered and sorted.",
     "inputSchema": {"type": "object", "properties": dict({"offset": {"type": "integer", "minimum": 0, "default": 0},
         "limit": {"type": "integer", "minimum": 1, "maximum": 200, "default": 50},
         "sort": {"type": "string", "enum": sorted(SORTS), "default": "position"}}, **FILTERS)}},
    {"name": "list_excluded", "description": "Grid items left out (prepackaged, deli-sliced, or unpriced) with the reason for each.",
     "inputSchema": {"type": "object", "properties": {}}},
    {"name": "dataset_stats", "description": "Record counts and breakdowns by style, milk, country and form.",
     "inputSchema": {"type": "object", "properties": {}}},
]
HANDLERS = {"search_cheeses": tool_search_cheeses, "get_cheese": tool_get_cheese, "list_cheeses": tool_list_cheeses,
            "list_excluded": tool_list_excluded, "dataset_stats": tool_dataset_stats}
RESOURCE_URI = "cheeses://dataset"


def handle(msg):
    method, params = msg.get("method"), msg.get("params") or {}
    if method == "initialize":
        v = params.get("protocolVersion")
        return {"protocolVersion": v if v in SUPPORTED_PROTOCOLS else SUPPORTED_PROTOCOLS[0],
                "capabilities": {"tools": {"listChanged": False}, "resources": {"listChanged": False}},
                "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
                "instructions": "Whole Foods cut-to-order cheeses (sold by the pound at the cheese counter). "
                                "Use search_cheeses / list_cheeses to browse and get_cheese for one record."}
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
        return {"resources": [{"uri": RESOURCE_URI, "name": "cheeses.json", "mimeType": "application/json",
                               "description": "The full Whole Foods cut-to-order cheese dataset"}]}
    if method == "resources/read":
        if params.get("uri") != RESOURCE_URI:
            raise LookupError(f"unknown resource {params.get('uri')!r}")
        with open(DATA_PATH, encoding="utf-8") as f:
            return {"contents": [{"uri": RESOURCE_URI, "mimeType": "application/json", "text": f.read()}]}
    raise NotImplementedError(method)


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}}) + "\n")
            sys.stdout.flush()
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
        sys.stdout.write(json.dumps(resp, ensure_ascii=False) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
