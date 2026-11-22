#!/usr/bin/env python3
"""Build data/cheeses.json and data/coverage_report.json from the saved
Whole Foods search-grid capture (raw/grid_cheese.psv) and product paths.

Rule: a tile is a cut-to-order (cheese counter) cheese when its price is
quoted per pound ("/lb"), i.e. it is sold by variable weight. Deli-sliced
per-lb items are excluded. Fixed-price tiles are prepackaged and excluded.
Derived fields (style_family, milk, country) come from a curated table and
are null wherever the source text and the cheese's name do not make them
certain. Nothing is invented: price, name and brand are verbatim.
"""
import json, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://www.wholefoodsmarket.com"
CAPTURED = "2026-11-22"

# asin: (style_family, milk, country, origin_basis)
# origin_basis: "PDO name" (protected name fixes the country), "producer"
# (maker's home country is well known), or None when country is null.
C = {
 "B07N3FGDZ5": ("Soft-ripened", "Cow, goat & sheep", "Italy", "producer"),
 "B0787W93CJ": ("Fresh & brined", None, None, None),
 "B07YFTHN89": ("Gouda & Dutch", "Cow", "Netherlands", "producer"),
 "B079M8CKXF": ("Gouda & Dutch", "Cow", "Netherlands", "producer"),
 "B0787Y5F15": ("Cheddar & British", "Cow", "England", "producer"),
 "B0787SPNW6": ("Cheddar & British", "Cow", "England", "producer"),
 "B0CKBYNZ5Y": ("Cheddar & British", "Cow", "England", "producer"),
 "B07FDJ6QWX": ("Cheddar & British", "Cow", "England", "producer"),
 "B07TX14TZ6": ("Cheddar & British", "Cow", "England", "producer"),
 "B078TGDR6H": ("Cheddar & British", "Cow", "England", "producer"),
 "B0CWH56WLZ": ("Cheddar & British", "Cow", "England", "producer"),
 "B0787Z9PZH": ("Gouda & Dutch", None, None, None),
 "B07DHTZPW5": ("Washed rind", "Cow", "France", "PDO name"),
 "B078F6XTW4": ("Washed rind", "Cow", "Italy", "PDO name"),
 "B079VN8J9P": ("Blue", "Cow", "Germany", "producer"),
 "B0787TNQQX": ("Spanish", "Sheep", "Spain", "PDO name"),
 "B086V2MPLK": ("Goat", "Goat", "United States", "producer"),
 "B07B4MMXSY": ("Goat", "Goat", "Netherlands", "producer"),
 "B0787Y5PVL": ("Sheep", "Sheep", "Netherlands", "producer"),
 "B0933T9VYY": ("Cheddar & British", "Cow", "United States", "producer"),
 "B08TSKZ1BW": ("Cheddar & British", "Cow", "United States", "producer"),
 "B0933SDZ2Q": ("Cheddar & British", "Cow", "United States", "producer"),
 "B08TSHX913": ("Cheddar & British", "Cow", "United States", "producer"),
 "B079VMPXLF": ("Semi-soft", "Cow", "Denmark", "producer"),
 "B0787W3QTD": ("Spanish", "Sheep", "Spain", "PDO name"),
 "B07887281X": ("Alpine & Swiss", "Cow", "Switzerland", "producer"),
 "B079VWL7B4": ("Alpine & Swiss", "Cow", "Switzerland", "producer"),
 "B07881H2ML": ("Alpine & Swiss", "Cow", "Switzerland", "producer"),
 "B0787XSH45": ("Alpine & Swiss", "Cow", "Switzerland", "producer"),
 "B07D6TFR7J": ("Goat", "Goat", "United States", "producer"),
 "B07883H8YV": ("Soft-ripened", "Cow", "France", "producer"),
 "B0787W1GHQ": ("Soft-ripened", "Cow", "France", "producer"),
 "B0787Y45T2": ("Soft-ripened", "Goat", "France", "producer"),
 "B0789WH7CS": ("Soft-ripened", "Cow", "France", "producer"),
 "B0787THH7Z": ("Soft-ripened", "Sheep", "France", "producer"),
 "B078TGLRKF": ("Soft-ripened", "Cow", "France", "producer"),
 "B079LDX4TC": ("Soft-ripened", "Cow", "France", "producer"),
 "B079VMFCCJ": ("Blue", "Sheep", "France", "PDO name"),
 "B078F7M6GJ": ("Hard Italian", "Sheep", "Italy", "PDO name"),
 "B0787VGWS3": ("Hard Italian", "Sheep", "Italy", "PDO name"),
 "B0787W922S": ("Washed rind", None, "France", "producer"),
 "B079VKPYSL": ("Blue", None, "France", "producer"),
 "B079LD2HPM": ("Sheep", "Sheep", "France", "producer"),
 "B079M6YMWF": ("Alpine & Swiss", "Cow", "France", "PDO name"),
 "B07DKKBB99": ("Cheddar & British", "Cow", "United States", "producer"),
 "B07881ML7Z": ("Blue", "Cow", "Italy", "PDO name"),
 "B0CWPF9KPJ": ("Semi-soft", "Cow", "Italy", "producer"),
 "B078TFZ1ZW": ("Blue", "Cow", "Italy", "PDO name"),
 "B0787W68G5": ("Hard & aged", "Cow", "France", "producer"),
 "B078F6W7WR": ("Sheep", "Sheep", "France", "producer"),
 "B079VNKTVM": ("Alpine & Swiss", "Cow", None, None),
 "B07BDG5DPB": ("Alpine & Swiss", "Cow", "United States", "producer"),
 "B0D813ND8M": ("Semi-soft", "Cow", "France", "PDO name"),
 "B0787VN38Y": ("Alpine & Swiss", "Cow", "France", "PDO name"),
 "B079VFMRCB": ("Gouda & Dutch", "Cow", "Netherlands", "producer"),
 "B0787Y4N3R": ("Gouda & Dutch", "Cow", "Netherlands", "producer"),
 "B07BYRJLXZ": ("Cheddar & British", "Cow", "Ireland", "producer"),
 "B0FJCBS8ZZ": ("Cheddar & British", "Cow", "Ireland", "producer"),
 "B07FQGZYSW": ("Fresh & brined", None, "Greece", "producer"),
 "B0787Y2C4M": ("Soft-ripened", "Cow", None, None),
 "B0787WZ863": ("Soft-ripened", "Cow", None, None),
 "B0787Y5D9Z": ("Other", None, None, None),
 "B0787Z9JWV": ("Soft-ripened", "Cow", "France", "producer"),
 "B0789NS3P4": ("Cheddar & British", "Cow", "England", "producer"),
 "B0DVSTPSK2": ("Gouda & Dutch", "Cow", "United States", "producer"),
 "B07DKCB4V4": ("Gouda & Dutch", "Cow", "United States", "producer"),
 "B0787W8LRW": ("Hard Italian", "Cow", "Italy", "PDO name"),
 "B07DHQXNJJ": ("Hard Italian", "Sheep", "Italy", "producer"),
 "B07S9DQ61J": ("Other", None, None, None),
 "B0787W5WWD": ("Semi-soft", "Cow", "Italy", "producer"),
 "B07C3P9N8W": ("Hard Italian", "Sheep", "Italy", "PDO name"),
 "B0787W67R5": ("Goat", "Goat", "Spain", "producer"),
 "B0787W9B9K": ("Alpine & Swiss", "Cow", "Italy", "PDO name"),
 "B0787XL77T": ("Goat", "Goat", "Spain", "producer"),
 "B07TJK5JRM": ("Other", None, None, None),
 "B07881HQP8": ("Spanish", "Cow", "Spain", "PDO name"),
 "B0787Y4Z2X": ("Spanish", "Sheep", "Spain", "producer"),
 "B0789MYKSZ": ("Spanish", "Cow", "Spain", "PDO name"),
 "B0788727ZH": ("Goat", "Goat", "Spain", "producer"),
 "B0787Y34ZG": ("Goat", "Goat", "Spain", "producer"),
 "B07SHBWJHZ": ("Goat", "Goat", "Spain", "producer"),
 "B0787WN3VW": ("Semi-soft", "Cow", "Italy", "PDO name"),
 "B0787ZMGXN": ("Semi-soft", "Cow", "Italy", "producer"),
 "B0788V634Y": ("Hard Italian", "Cow", "Italy", "PDO name"),
 "B0787VWCF3": ("Fresh & brined", None, "Italy", "producer"),
 "B079L9V4W3": ("Semi-soft", "Cow", "United States", "producer"),
 "B079NQDZM9": ("Blue", "Cow", "United States", "producer"),
 "B07NX9JZSM": ("Semi-soft", "Cow", "United States", "producer"),
 "B0848J73RW": ("Semi-soft", "Cow", "United States", "producer"),
 "B0848PT7GP": ("Semi-soft", "Cow", "United States", "producer"),
 "B0787Y62YK": ("Blue", "Cow", "United States", "producer"),
 "B0787Y5F1H": ("Gouda & Dutch", "Cow", "United States", "producer"),
 "B07DQH5N4T": ("Semi-soft", "Cow", "United States", "producer"),
 "B07QB2TP9K": ("Hard & aged", "Cow", "United States", "producer"),
 "B0DNFRYNX2": ("Semi-soft", "Cow", None, None),
 "B0787Y2VQ3": ("Blue", "Cow", "France", "producer"),
 "B0787W2VC8": ("Hard & aged", "Cow", "United States", "producer"),
 "B0787V44FP": ("Hard & aged", "Cow", "United States", "producer"),
 "B0789WHBWY": ("Cheddar & British", "Cow", "England", "producer"),
 "B0787Y5PM3": ("Cheddar & British", "Cow", "England", "PDO name"),
 "B0788JF9FJ": ("Cheddar & British", "Cow", "Wales", "producer"),
 "B0787XQ6L1": ("Cheddar & British", "Cow", "England", "PDO name"),
 "B0787VGWSG": ("Cheddar & British", "Cow", "England", "producer"),
 "B0787Z4BJW": ("Gouda & Dutch", "Cow", None, None),
 "B0787Y9SJB": ("Gouda & Dutch", "Goat", "Netherlands", "producer"),
 "B07B64H7T2": ("Alpine & Swiss", "Cow", "United States", "producer"),
 "B079LB4DC8": ("Washed rind", "Cow", "United States", "producer"),
 "B078TJJY9N": ("Alpine & Swiss", "Cow", "United States", "producer"),
}
# Per-lb tiles that are sliced at the deli counter, not cut from a wheel.
DELI = {"B07FZGG2L5", "B07FZJPMWP", "B07N3FWV8F", "B0G65QRCTB", "B07FZSCH8F"}

FLAVORS = [("truffle", "Truffle"), ("tartufo", "Truffle"), ("smoked", "Smoked"),
           ("herb", "Herbs"), ("provence", "Herbs"), ("pepper", "Pepper & chile"),
           ("chile", "Pepper & chile"), ("onion", "Onion"), ("cranberry", "Fruit"),
           ("blueberry", "Fruit"), ("champagne", "Wine & spirits"),
           ("drunken", "Wine & spirits"), ("merlot", "Wine & spirits"),
           ("seven spice", "Spice"), ("red dragon", "Wine & spirits"),
           ("ginepro", "Juniper")]

def money(s):
    m = re.search(r"\$([\d,]+\.\d{2})", s or "")
    return float(m.group(1).replace(",", "")) if m else None

def form_of(name):
    n = name.lower()
    if "grated" in n: return "Grated"
    if "cubes" in n: return "Cubes"
    if "rinds" in n: return "Rinds"
    return "Wedge"

def age_months(name):
    m = re.search(r"(\d+)\s*month", name, re.I)
    return int(m.group(1)) if m else None

def main():
    paths = {}
    for p in (ROOT / "raw/product_paths.txt").read_text().split():
        paths[p[-10:].upper()] = p
    tiles, order = {}, []
    for line in (ROOT / "raw/grid_cheese.psv").read_text().splitlines():
        if not line or line.startswith("#"): continue
        pos, asin, brand, name, price, lst, var, stock = line.split("|")
        rec = tiles.get(asin)
        if rec is None:
            rec = tiles[asin] = {"asin": asin, "brand": brand, "name": name,
                                 "price": price, "list_price": lst, "note": "",
                                 "stock": stock, "positions": []}
            order.append(asin)
        rec["positions"].append(pos)
        if var and "off" in var: rec["note"] = var
        if lst and not rec["list_price"]: rec["list_price"] = lst
        if price and not rec["price"]: rec["price"] = price
        if stock and not rec["stock"]: rec["stock"] = stock

    cheeses, excluded = [], []
    for asin in order:
        t = tiles[asin]
        per_lb = t["price"].endswith("/lb")
        if not per_lb:
            excluded.append({"asin": asin, "brand": t["brand"], "name": t["name"],
                "price": t["price"] or None,
                "reason": "No price shown (out of stock); cannot classify" if not t["price"]
                          else "Fixed price per package (prepackaged shelf item)"})
            continue
        if asin in DELI:
            excluded.append({"asin": asin, "brand": t["brand"], "name": t["name"],
                "price": t["price"], "reason": "Sliced at the deli counter, not cut from a wheel"})
            continue
        style, milk, country, basis = C[asin]
        p, lp = money(t["price"]), money(t["list_price"])
        off = round((1 - p / lp) * 100) if p and lp and lp > p else None
        n = t["name"].lower()
        flavors = sorted({v for k, v in FLAVORS if k in n})
        cheeses.append({
            "scw_id": "SCW1", "asin": asin, "brand": t["brand"], "name": t["name"],
            "price": t["price"], "price_per_lb_usd": p,
            "list_price": t["list_price"] or None, "list_price_per_lb_usd": lp,
            "discount_note": t["note"] or None, "off_pct": off,
            "sold_by": "Weight (cut to order at the cheese counter)",
            "form": form_of(t["name"]), "age_months": age_months(t["name"]),
            "style_family": style, "milk": milk, "country": country,
            "origin_basis": basis, "flavors": flavors,
            "in_stock": t["stock"] == "",
            "grid_positions": t["positions"],
            "url": SITE + paths[asin], "image_url": None, "delivery_zip": "92211"})
    for i, c in enumerate(cheeses, 1):
        c["position"] = i
    assert len({c["asin"] for c in cheeses}) == len(cheeses)
    source = {"site": SITE,
      "search_urls": [SITE + "/grocery/search?k=cheese",
                      SITE + "/grocery/search?k=cheese&s=price-desc-rank"],
      "delivery_zip": "92211", "captured": CAPTURED,
      "unique_tiles": len(order), "cut_to_order": len(cheeses),
      "excluded": len(excluded),
      "rule": "Kept: priced per pound (sold by weight, cut at the cheese counter). "
              "Excluded: fixed-price packages, deli-sliced per-pound items, and tiles with no price.",
      "notes": ["Name, brand and price are copied from the store's search grid verbatim.",
                "style_family, milk and country are curated from the cheese's name and maker; null where not certain.",
                "The price-sorted pass reached every per-pound tile down to about $8/lb; below that only prepackaged items remained.",
                "Image URLs were not exposed to the capture tools, so image_url is null."]}
    (ROOT / "data").mkdir(exist_ok=True)
    (ROOT / "data/cheeses.json").write_text(json.dumps(
        {"source": source, "cheeses": cheeses, "excluded": excluded}, indent=1))
    reasons = {}
    for e in excluded: reasons[e["reason"]] = reasons.get(e["reason"], 0) + 1
    cov = {"unique_tiles": len(order), "cut_to_order_kept": len(cheeses),
           "excluded_by_reason": reasons,
           "deli_excluded": [e["name"] for e in excluded if "deli" in e["reason"]],
           "unclassified": [e["name"] for e in excluded if "No price" in e["reason"]],
           "null_country": [c["name"] for c in cheeses if not c["country"]],
           "null_milk": [c["name"] for c in cheeses if not c["milk"]]}
    (ROOT / "data/coverage_report.json").write_text(json.dumps(cov, indent=1))
    print(json.dumps({k: (v if not isinstance(v, list) else len(v)) for k, v in cov.items()}))

if __name__ == "__main__":
    main()
