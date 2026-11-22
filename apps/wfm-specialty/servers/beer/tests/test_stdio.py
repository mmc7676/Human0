#!/usr/bin/env python3
"""End-to-end test: spawn the beer server over stdio and exercise every tool with raw JSON-RPC.
Expected values are computed here straight from data/beers.json. Run: python3 tests/test_stdio.py"""
import json
import os
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SERVER = os.path.join(ROOT, "server", "beer_mcp_server.py")
DATA = json.load(open(os.path.join(ROOT, "data", "beers.json"), encoding="utf-8"))
BEERS = DATA["beers"]


class Client:
    def __init__(self):
        self.p = subprocess.Popen([sys.executable, SERVER], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                  stderr=subprocess.PIPE, text=True, encoding="utf-8")
        self.n = 0

    def rpc(self, method, params=None):
        self.n += 1
        self.p.stdin.write(json.dumps({"jsonrpc": "2.0", "id": self.n, "method": method, "params": params or {}}) + "\n")
        self.p.stdin.flush()
        resp = json.loads(self.p.stdout.readline())
        assert resp["id"] == self.n, resp
        return resp

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
    ok(init["serverInfo"]["name"] == "wholefoods-beer", "initialize returns server info")
    ok(c.rpc("ping")["result"] == {}, "ping")
    tools = {t["name"] for t in c.rpc("tools/list")["result"]["tools"]}
    ok(tools == {"search_beers", "get_beer", "list_beers", "get_variants", "dataset_stats"}, "tools/list has 5 tools")

    stats = c.call("dataset_stats")["structuredContent"]
    ok(stats["records"] == len(BEERS), f"dataset_stats records == {len(BEERS)}")
    ok(stats["non_alcoholic"] == sum(1 for b in BEERS if b["non_alcoholic"]), "non_alcoholic count matches")

    allp = c.call("list_beers", {"limit": 200})["structuredContent"]
    ok(allp["total"] == len(BEERS), "list_beers total == record count")
    ok([r["asin"] for r in allp["results"]] == [b["asin"] for b in sorted(BEERS, key=lambda b: b["position"])][:200],
       "list_beers default order == grid order")

    six = c.call("list_beers", {"pack_count": 6, "limit": 200})["structuredContent"]
    ok(six["total"] == sum(1 for b in BEERS if b["pack_count"] == 6), "pack_count=6 filter count")
    cans = c.call("list_beers", {"container": "Can", "limit": 200})["structuredContent"]
    ok(cans["total"] == sum(1 for b in BEERS if b["container"] == "Can"), "container=Can filter count")
    ipa = c.call("list_beers", {"type_family": "IPA", "limit": 200})["structuredContent"]
    ok(ipa["total"] == sum(1 for b in BEERS if b["type_family"] == "IPA"), "type_family=IPA filter count")
    na = c.call("list_beers", {"non_alcoholic": True, "limit": 200})["structuredContent"]
    ok(na["total"] == sum(1 for b in BEERS if b["non_alcoholic"]), "non_alcoholic=true filter count")
    pr = c.call("list_beers", {"min_price": 10, "max_price": 15, "limit": 200})["structuredContent"]
    ok(pr["total"] == sum(1 for b in BEERS if b["price_usd"] is not None and 10 <= b["price_usd"] <= 15), "price 10-15 count")
    ab = c.call("list_beers", {"min_abv": 7, "limit": 200})["structuredContent"]
    ok(ab["total"] == sum(1 for b in BEERS if b["abv_pct"] is not None and b["abv_pct"] >= 7), "min_abv 7 count")

    srt = c.call("list_beers", {"sort": "price_per_oz_asc", "limit": 5})["structuredContent"]["results"]
    exp = sorted([b for b in BEERS], key=lambda b: (b["price_per_fl_oz_usd"] is None, b["price_per_fl_oz_usd"] or 0, b["position"]))[:5]
    ok([r["asin"] for r in srt] == [b["asin"] for b in exp], "sort price_per_oz_asc")

    first = sorted(BEERS, key=lambda b: b["position"])[0]
    got = c.call("get_beer", {"asin": first["asin"]})["structuredContent"]
    ok(got == first, "get_beer by asin returns the full record")
    ok(c.call("get_beer", {"scw_id": first["scw_id"].lower()})["structuredContent"]["asin"] == first["asin"], "get_beer by scw_id")
    bad = c.call("get_beer", {"asin": "B000000000"})
    ok(bad["isError"] is True, "get_beer unknown asin is an error")

    with_opts = [b for b in BEERS if b["size_options"]]
    if with_opts:
        v = c.call("get_variants", {"asin": with_opts[0]["asin"]})["structuredContent"]
        ok(len(v["size_options"]) == len(with_opts[0]["size_options"]), "get_variants returns size options")

    s = c.call("search_beers", {"query": "stella artois", "limit": 5})["structuredContent"]
    ok(s["total_matches"] >= 1 and all("Stella" in r["brand"] for r in s["results"][:1]), "search 'stella artois' finds Stella first")
    s2 = c.call("search_beers", {"query": "hazy ipa", "non_alcoholic": False, "limit": 50})["structuredContent"]
    ok(all(not r["non_alcoholic"] for r in s2["results"]), "search with non_alcoholic=false excludes NA")

    res = c.rpc("resources/read", {"uri": "beers://dataset"})["result"]
    ok(json.loads(res["contents"][0]["text"])["beers"][0]["asin"] == DATA["beers"][0]["asin"], "resources/read returns dataset")
    err = c.rpc("nope/method")
    ok(err["error"]["code"] == -32601, "unknown method -> -32601")
    c.close()
    print(f"\n{passed} passed")


if __name__ == "__main__":
    main()
