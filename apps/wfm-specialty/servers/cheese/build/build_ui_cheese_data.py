"""Build the page's slim cheeses.json from the cheese server's data/cheeses.json.
Run: python3 ui/build_ui_cheese_data.py data/cheeses.json <out.json>"""
import json, sys

SRC, OUT = sys.argv[1], sys.argv[2]
doc = json.load(open(SRC, encoding="utf-8"))
rows = []
for c in doc["cheeses"]:
    rows.append({
        "id": "C" + str(c["position"]), "pos": c["position"], "asin": c["asin"],
        "brand": c["brand"], "name": c["name"], "price": c["price_per_lb_usd"],
        "list_price": c["list_price_per_lb_usd"], "off_pct": c["off_pct"],
        "discount_note": c["discount_note"], "style": c["style_family"], "milk": c["milk"],
        "country": c["country"], "origin_basis": c["origin_basis"], "form": c["form"],
        "age_months": c["age_months"], "flavors": c["flavors"], "url": c["url"],
        "non_alcoholic": False})
json.dump(rows, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(rows), "rows ->", OUT)
