#!/usr/bin/env python3
"""Parity: the page's filter core (node) must give the same counts as Python over data/beers.json.
Run: python3 tests/test_ui_parity.py  (needs node; uses the wine package's ui/core.js and ui/test_core.js)"""
import collections, json, os, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
# Repo layout: apps/wfm-specialty/servers/beer, with the page two folders up.
# Project-files layout: wholefoods-beer-mcp beside wholefoods-wine-mcp/ui.
APP = os.path.abspath(os.path.join(ROOT, "..", ".."))
if os.path.exists(os.path.join(APP, "core.js")):
    UI, SLIM, TEST = APP, os.path.join(APP, "beers.json"), os.path.join(APP, "test", "test_core.js")
else:
    UI = os.path.join(os.path.dirname(ROOT), "wholefoods-wine-mcp", "ui")
    SLIM, TEST = os.path.join(ROOT, "ui", "beers.json"), os.path.join(UI, "test_core.js")
beers = json.load(open(os.path.join(ROOT, "data", "beers.json"), encoding="utf-8"))["beers"]
slim = json.load(open(SLIM, encoding="utf-8"))
out = subprocess.run(["node", TEST, os.path.join(UI, "core.js"), os.path.join(UI, "wines.json"),
                      SLIM], capture_output=True, text=True, check=True).stdout.strip().splitlines()
R = json.loads(out[-1])
NONE = "Not stated"


def pack(n):
    return NONE if n is None else ("Single" if n == 1 else f"{n}-pack")


exp = {
    "total": len(beers),
    "family": dict(collections.Counter(b["type_family"] or NONE for b in beers)),
    "pack": dict(collections.Counter(pack(b["pack_count"]) for b in beers)),
    "container": dict(collections.Counter(b["container"] or NONE for b in beers)),
    "ipa_cans": sum(1 for b in beers if b["type_family"] == "IPA" and b["container"] == "Can"),
    "six_under15": sum(1 for b in beers if b["pack_count"] == 6 and b["price_usd"] is not None and b["price_usd"] <= 15),
    "abv7": sum(1 for b in beers if b["abv_pct"] is not None and b["abv_pct"] >= 7),
    "abv_lt5": sum(1 for b in beers if b["abv_pct"] is not None and b["abv_pct"] < 5),
    "abv5_7": sum(1 for b in beers if b["abv_pct"] is not None and 5 <= b["abv_pct"] < 7),
    "na": sum(1 for b in beers if b["non_alcoholic"]),
    "no_na": sum(1 for b in beers if not b["non_alcoholic"]),
    "has_onSale": False, "per_oz_sorted": True, "style_group_sum": len(beers),
}
fails = 0
for k, v in exp.items():
    ok = R[k] == v
    fails += not ok
    print("PASS" if ok else "FAIL", k, R[k] if ok else f"page={R[k]} python={v}")
ok = len(slim) == len(beers) and [s["asin"] for s in slim] == [b["asin"] for b in sorted(beers, key=lambda b: b["position"])]
fails += not ok
print("PASS" if ok else "FAIL", "page data has every record in grid order")
print(f"\n{len(exp) + 1 - fails} passed, {fails} failed")
sys.exit(1 if fails else 0)
