"""Build the page's slim beers.json from the beer server's data/beers.json."""
import json, sys, collections

SRC, OUT = sys.argv[1], sys.argv[2]
doc = json.load(open(SRC, encoding="utf-8"))


def pack_label(n):
    if n is None:
        return None
    return "Single" if n == 1 else f"{n}-pack"


def container_label(b):
    c, oz = b["container"], b["container_fl_oz"]
    if not c and oz is None:
        return None
    oz_txt = (f"{oz:g} fl oz" if oz is not None else "")
    return " ".join(x for x in [oz_txt, (c or "").lower()] if x) or None


def opts(lst):
    return [{"label": o.get("label"), "price": o.get("price"), "selected": bool(o.get("selected")),
             "asin": o.get("asin"), "in_dataset": bool(o.get("in_dataset"))} for o in (lst or [])]


rows = []
for b in doc["beers"]:
    rows.append({
        "id": b["scw_id"], "pos": b["position"], "asin": b["asin"],
        "brand": b["brand"], "name": b["product_name"], "page_title": b["page_title"],
        "price": b["price_usd"], "list_price": b["list_price_usd"], "off_pct": b["off_pct"],
        "variants": b["variants_note"],
        "family": b["type_family"], "style": b["style"], "ptype": b["product_type"], "country": b["country"],
        "pack": pack_label(b["pack_count"]), "pack_count": b["pack_count"],
        "container": b["container"], "container_label": container_label(b), "oz": b["container_fl_oz"],
        "total_oz": b["total_fl_oz"],
        "abv": b["abv_pct"], "abv_lt": b["abv_less_than"], "abv_conflict": b["abv_conflict"], "abv_all": b["abv_all_found"],
        "non_alcoholic": b["non_alcoholic"], "calories": b["calories"],
        "aisle": (b["in_store_location"] or "").replace("Located in ", "") or None,
        "per_unit": b["price_per_container_usd"], "per_oz": b["price_per_fl_oz_usd"],
        "ingredients": b["ingredients"], "bullets": b["description_bullets"], "label_facts": b["label_facts"] or {},
        "sections": b["other_sections"] or {},
        "size_selected": b["size_selected"], "size_options": opts(b["size_options"]),
        "flavor": b["flavor_selected"], "flavor_options": opts(b["flavor_options"]),
        "url": b["url"],
    })
rows.sort(key=lambda r: r["pos"])
with open(OUT, "w", encoding="utf-8") as f:
    f.write("[\n" + ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in rows) + "\n]\n")
C = collections.Counter
print("rows", len(rows))
print("family", C(r["family"] for r in rows).most_common())
print("pack", C(r["pack"] for r in rows).most_common(), "container", C(r["container"] for r in rows).most_common())
