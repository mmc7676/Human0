#!/usr/bin/env python3
"""Spawn the cheese server over stdio and check every tool against data/cheeses.json.
Run: python3 tests/test_stdio.py"""
import json, os, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA = json.load(open(os.path.join(ROOT, "data", "cheeses.json"), encoding="utf-8"))
CH = DATA["cheeses"]
p = subprocess.Popen([sys.executable, os.path.join(ROOT, "server", "cheese_mcp_server.py")],
                     stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, encoding="utf-8")
n = 0
passed = 0


def rpc(method, params=None):
    global n
    n += 1
    p.stdin.write(json.dumps({"jsonrpc": "2.0", "id": n, "method": method, "params": params or {}}) + "\n")
    p.stdin.flush()
    r = json.loads(p.stdout.readline())
    assert r["id"] == n, r
    return r


def call(name, args=None):
    r = rpc("tools/call", {"name": name, "arguments": args or {}})["result"]
    return r


def ok(cond, label):
    global passed
    if not cond:
        raise AssertionError(label)
    passed += 1
    print("PASS", label)


ok(rpc("initialize", {"protocolVersion": "2025-06-18"})["result"]["serverInfo"]["name"] == "wholefoods-cheese", "initialize")
ok(rpc("ping")["result"] == {}, "ping")
ok({t["name"] for t in rpc("tools/list")["result"]["tools"]} ==
   {"search_cheeses", "get_cheese", "list_cheeses", "list_excluded", "dataset_stats"}, "tools/list has 5 tools")
st = call("dataset_stats")["structuredContent"]
ok(st["records"] == len(CH), f"records == {len(CH)}")
ok(sum(st["excluded_by_reason"].values()) == len(DATA["excluded"]), "excluded counts add up")
allc = call("list_cheeses", {"limit": 200})["structuredContent"]
ok(allc["total"] == len(CH) and [r["asin"] for r in allc["results"]] == [c["asin"] for c in CH], "list order == grid order")
for key, val in [("style_family", "Blue"), ("country", "France"), ("form", "Cubes")]:
    got = call("list_cheeses", {key: val, "limit": 200})["structuredContent"]["total"]
    ok(got == sum(1 for c in CH if c[key] == val), f"{key}={val} count")
got = call("list_cheeses", {"milk": "Sheep", "limit": 200})["structuredContent"]["total"]
ok(got == sum(1 for c in CH if c["milk"] and "sheep" in c["milk"].lower()), "milk=Sheep includes mixed milk")
got = call("list_cheeses", {"on_sale": True, "limit": 200})["structuredContent"]["total"]
ok(got == sum(1 for c in CH if c["off_pct"]), "on_sale count")
got = call("list_cheeses", {"min_price_per_lb": 20, "max_price_per_lb": 30, "limit": 200})["structuredContent"]["total"]
ok(got == sum(1 for c in CH if 20 <= c["price_per_lb_usd"] <= 30), "price 20-30 count")
srt = call("list_cheeses", {"sort": "price_desc", "limit": 1})["structuredContent"]["results"][0]
ok(srt["price_per_lb_usd"] == max(c["price_per_lb_usd"] for c in CH), "price_desc first is the priciest")
s = call("search_cheeses", {"query": "humboldt fog"})["structuredContent"]
ok(s["results"][0]["asin"] == "B086V2MPLK", "search finds Humboldt Fog first")
s = call("search_cheeses", {"query": "truffle"})["structuredContent"]
ok(s["total_matches"] >= sum(1 for c in CH if "Truffle" in c["flavors"]), "search truffle covers truffle flavors")
g = call("get_cheese", {"asin": CH[0]["asin"].lower()})["structuredContent"]
ok(g == CH[0], "get_cheese is case-insensitive and returns the full record")
ok(call("get_cheese", {"asin": "B000000000"})["isError"], "unknown asin is an error result")
ok(call("list_cheeses", {"sort": "bogus"})["isError"], "bad sort is an error result")
ok(rpc("tools/call", {"name": "nope"})["error"]["code"] == -32602, "unknown tool -> -32602")
ok(rpc("bogus/method").get("error", {}).get("code") == -32601, "unknown method -> -32601")
res = rpc("resources/read", {"uri": "cheeses://dataset"})["result"]["contents"][0]
ok(json.loads(res["text"])["cheeses"] == CH, "resource returns the dataset")
ok(all(c["price"].endswith("/lb") for c in CH), "every record is priced per pound")
ok(all(c["url"].startswith("https://www.wholefoodsmarket.com/grocery/product/") and c["url"].lower().endswith(c["asin"].lower())
       for c in CH), "every url is a product page ending in its asin")
ok(all(c["image_url"] is None for c in CH), "no invented image urls")
p.stdin.close()
p.wait(timeout=10)
print(f"{passed} passed")
