#!/usr/bin/env python3
"""End-to-end test: spawn the server over stdio and exercise every tool with raw JSON-RPC.
Standard library only. Run: python3 tests/test_stdio.py"""
import json
import os
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SERVER = os.path.join(ROOT, "server", "wine_mcp_server.py")
DATA = json.load(open(os.path.join(ROOT, "data", "wines.json"), encoding="utf-8"))
WINES = DATA["wines"]
ONLY_WINES = [w for w in WINES if w["is_wine"]]


class Client:
    def __init__(self):
        self.p = subprocess.Popen([sys.executable, SERVER], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                  stderr=subprocess.PIPE, text=True, encoding="utf-8")
        self.n = 0

    def rpc(self, method, params=None):
        self.n += 1
        self.p.stdin.write(json.dumps({"jsonrpc": "2.0", "id": self.n, "method": method,
                                       "params": params or {}}) + "\n")
        self.p.stdin.flush()
        resp = json.loads(self.p.stdout.readline())
        assert resp["id"] == self.n, resp
        return resp

    def notify(self, method):
        self.p.stdin.write(json.dumps({"jsonrpc": "2.0", "method": method}) + "\n")
        self.p.stdin.flush()

    def call(self, name, args=None):
        r = self.rpc("tools/call", {"name": name, "arguments": args or {}})
        assert "result" in r, r
        return r["result"]

    def close(self):
        self.p.stdin.close()
        self.p.wait(timeout=10)


def main():
    c = Client()
    passed = 0

    def ok(cond, label):
        nonlocal passed
        if not cond:
            raise AssertionError(label)
        passed += 1
        print("PASS", label)

    init = c.rpc("initialize", {"protocolVersion": "2025-06-18", "capabilities": {},
                                "clientInfo": {"name": "test", "version": "1"}})["result"]
    ok(init["serverInfo"]["name"] == "wholefoods-wine", "initialize returns server info")
    c.notify("notifications/initialized")
    ok(c.rpc("ping")["result"] == {}, "ping")
    tools = {t["name"] for t in c.rpc("tools/list")["result"]["tools"]}
    ok(tools == {"search_wines", "get_wine", "list_wines", "wines_by_pairing", "dataset_stats", "get_vivino"}, "tools/list")

    st = c.call("dataset_stats")["structuredContent"]
    ok(st["records"] == len(WINES) and st["wines"] == len(ONLY_WINES), f"dataset_stats counts {st['records']}/{st['wines']}")

    first = WINES[0]
    g = c.call("get_wine", {"asin": first["asin"].lower()})["structuredContent"]
    ok(g["asin"] == first["asin"] and g["scw_id"] == "SCW1", "get_wine by asin (case-insensitive)")
    g2 = c.call("get_wine", {"scw_id": WINES[-1]["scw_id"]})["structuredContent"]
    ok(g2["asin"] == WINES[-1]["asin"], "get_wine by scw_id (last record)")
    bad = c.call("get_wine", {"asin": "B000000000"})
    ok(bad["isError"] is True, "get_wine unknown asin -> isError")

    # paging walks every wine exactly once
    seen, offset = [], 0
    while offset is not None:
        page = c.call("list_wines", {"offset": offset, "limit": 200})["structuredContent"]
        seen += [r["asin"] for r in page["results"]]
        offset = page["next_offset"]
    ok(len(seen) == len(ONLY_WINES) == len(set(seen)), f"list_wines pages cover all {len(seen)} wines once")

    lo, hi = 10, 20
    pr = c.call("list_wines", {"min_price": lo, "max_price": hi, "limit": 200, "sort": "price_asc"})["structuredContent"]
    expected = sum(1 for w in ONLY_WINES if w["price_usd"] is not None and lo <= w["price_usd"] <= hi)
    prices = [r["price"] for r in pr["results"]]
    ok(pr["total"] == expected, f"price filter total {pr['total']} == {expected}")
    vals = [float(p.replace("$", "").replace(",", "")) for p in prices]
    ok(vals == sorted(vals) and all(lo <= v <= hi for v in vals), "price_asc sorted and in range")

    s = c.call("search_wines", {"query": first["brand"], "limit": 5})["structuredContent"]
    ok(s["total_matches"] >= 1 and any(r["asin"] == first["asin"] for r in s["results"]) or
       s["results"][0]["brand"].lower() == first["brand"].lower(), "search_wines finds first brand")

    vt = c.call("search_wines", {"varietal": "Pinot Noir", "limit": 200})["structuredContent"]
    ok(vt["total_matches"] > 0 and all("pinot noir" in ((r["varietal"] or "") + r["product_name"]).lower()
                                        for r in vt["results"]), f"varietal filter ({vt['total_matches']} Pinot Noir)")

    for food in ["seafood", "cheese", "steak"]:
        p = c.call("wines_by_pairing", {"food": food, "limit": 200})["structuredContent"]
        exp = [w for w in ONLY_WINES if w["pairing"] and food[:-1] in w["pairing"].lower()]
        ok(p["total_matches"] >= 1 and all(food[:4] in r["pairing"].lower() for r in p["results"]),
           f"wines_by_pairing {food!r}: {p['total_matches']} matches (substring check {len(exp)})")

    # Vivino: tool answers must equal what data/wines.json stores
    MATCHED = [w for w in ONLY_WINES if (w.get("vivino") or {}).get("match_status") == "matched"]
    RATED = [w for w in MATCHED if w["vivino"].get("rating") is not None]
    hv = c.call("list_wines", {"has_vivino": True, "limit": 200})["structuredContent"]
    ok(hv["total"] == len(MATCHED), f"has_vivino=true -> {hv["total"]} (stored {len(MATCHED)})")
    for th in (3.5, 4.0, 4.2):
        mr = c.call("list_wines", {"min_rating": th, "limit": 200})["structuredContent"]
        exp = sum(1 for w in RATED if w["vivino"]["rating"] >= th)
        ok(mr["total"] == exp, f"min_rating {th} -> {mr['total']} (stored {exp})")
    rs = c.call("list_wines", {"sort": "rating_desc", "has_vivino": True, "limit": 200})["structuredContent"]["results"]
    vals = [c.call("get_vivino", {"scw_id": r["scw_id"]})["structuredContent"].get("rating") for r in rs]
    num = [v for v in vals if v is not None]
    ok(num == sorted(num, reverse=True) and vals[:len(num)] == num, "rating_desc sorts rated wines high to low, unrated last")
    errs = 0
    for w in MATCHED:
        gv = c.call("get_vivino", {"scw_id": w["scw_id"]})["structuredContent"]
        if (gv.get("rating"), gv.get("ratings_count"), gv.get("reviews_counted"), gv.get("word_cloud"), gv.get("url")) != \
           (w["vivino"].get("rating"), w["vivino"].get("ratings_count"), w["vivino"].get("reviews_counted"),
            w["vivino"].get("word_cloud"), w["vivino"].get("url")) or "reviews" in gv:
            errs += 1
    ok(errs == 0, f"get_vivino rating, count, reviews counted, word cloud and URL equal stored values (no review texts) for all {len(MATCHED)} matched wines")
    un = [w for w in ONLY_WINES if (w.get("vivino") or {}).get("match_status") != "matched"][0]
    gu = c.call("get_vivino", {"scw_id": un["scw_id"]})["structuredContent"]
    ok(gu.get("rating") is None and not gu.get("word_cloud"), "unmatched wine has no rating and no word cloud")
    st = c.call("dataset_stats")["structuredContent"]["vivino"]
    ok(st["rated_wines"] == len(RATED), f"dataset_stats rated_wines {st['rated_wines']}")

    ok(c.call("wines_by_pairing", {"food": ""})["isError"] is True, "wines_by_pairing empty food -> isError")
    ok(c.call("list_wines", {"limit": 0})["isError"] is True, "limit 0 -> isError")
    ok("error" in c.rpc("tools/call", {"name": "nope", "arguments": {}}), "unknown tool -> JSON-RPC error")
    ok("error" in c.rpc("does/not/exist"), "unknown method -> JSON-RPC error")
    res = c.rpc("resources/read", {"uri": "wines://dataset"})["result"]["contents"][0]
    ok(json.loads(res["text"])["count"] == len(WINES), "resources/read wines://dataset")
    c.close()
    print(f"\nALL {passed} CHECKS PASSED")


if __name__ == "__main__":
    main()
