"""Append beer-aisle drinks that the price-sorted sweep found but beers.json lacked.

Grid-only records: brand, name, pack, container, size, ABV (when the tile states it), price,
list price and discount come from the search tile and its product URL; product-page fields
stay empty (extraction_status = "grid_only").
Usage: python3 add_missing_beer.py <beer_missing.json> <beers.json> [--write]
"""
import json, re, sys, os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_dataset as B  # noqa: E402

TAIL = re.compile(r'\s*((?:\d+ (?:Flavors?|Sizes?),? ?)+)?\s*(?:(\d+)% off(?: with Prime)? )?\$([\d.,]+)(?: \$([\d.,]+))?\s*$')
# (tile prefix, brand to show). Tile text is the brand as the site shows it, then the grid name.
BRANDS = [
    ("Makku", "Makku"), ("Delirium", "Delirium"), ("Drowned Lands", "Drowned Lands"),
    ("HARLAND BREWING", "Harland Brewing"), ("Saint Feuillien", "Saint Feuillien"), ("805", "805"),
    ("Firestone Walker", "Firestone Walker"), ("하드nectar HARD SELTZER", "Nectar"),
    ("Kiuchi Brewery", "Kiuchi Brewery"), ("Peroni", "Peroni"), ("Corona Light", "Corona"),
    ("Stone Brewing", "Stone Brewing"), ("Pacifico", "Pacifico"), ("Lone River", "Lone River"),
    ("Modelo Especial", "Modelo"), ("Modelo", "Modelo"), ("White Claw", "White Claw"),
    ("Pure Project", "Pure Project"), ("Chimay", "Chimay"), ("Kerel", "Kerel"),
    ("SIERRA NEVADA", "Sierra Nevada"), ("Samuel Smith", "Samuel Smith"),
    ("Brouwerij Verhaeghe Vichte", "Brouwerij Verhaeghe"), ("Almanac BEER CO.", "Almanac Beer Co."),
    ("Weihenstephaner", "Weihenstephaner"), ("MADEWEST", "MadeWest"),
    ("Smog City Brewing Co.", "Smog City Brewing Co."), ("Beachwood Brewing", "Beachwood Brewing"),
    ("Zevia", "Zevia"), ("Elysian Brewing Company", "Elysian Brewing Company"),
    ("BEST DAY BREWING", "Best Day Brewing"), ("Sincere Cider", "Sincere Cider"),
    ("Green Flash", "Green Flash"), ("Lagunitas", "Lagunitas"), ("Topa Topa Brewery", "Topa Topa Brewery"),
    ("FLYING EMBERS", "Flying Embers"), ("Dogfish Head", "Dogfish Head"), ("Aval", "Aval"),
    ("New Belgium", "New Belgium"), ("Coronado Brewing", "Coronado Brewing"),
    ("Conquista Móveis", "Conquista Móveis"), ("Radeberger", "Radeberger"), ("CALI SQUEEZE", "Cali Squeeze"),
    ("MOTHER EARTH BREW", "Mother Earth Brew"), ("Santa Monica Brew Works", "Santa Monica Brew Works"),
    ("Paulaner Munchen", "Paulaner"), ("Nixie", "Nixie"), ("Maine Root", "Maine Root"),
    ("Rochefort", "Rochefort"), ("365 by Whole Foods Market", "365 by Whole Foods Market"),
    ("Russian River Brewing", "Russian River Brewing"), ("Fever-Tree", "Fever-Tree"), ("HIYO", "HIYO"),
    ("サッポロビール", "Sapporo"), ("Hoplark", "Hoplark"),
]
# The tile names a different brewery than the brand field shows; the product name settles it.
BRAND_BY_ASIN = {"B005J1JD4E": "St. Bernardus", "B0016M0SEO": "Pilsner Urquell"}
EXTRA_STYLE = [(r"\babt\b|saint feuillien|grand cru|rochefort", "Belgian ale"),
               (r"festbier|oktoberfest|m[aä]rzen", "Lager"), (r"flemish red|duchesse", "Lambic & sour"),
               (r"white ale", "Wheat"), (r"\bkerel\b", "Other ale")]
# Not beer-aisle alcohol: same rule as the first build (sodas, ginger beer and ale, root beer,
# hop water and hop tea, non-alcoholic functional seltzer).
NON_BEER = [(r"ginger ale", "ginger ale soda"), (r"ginger beer", "ginger beer soda"),
            (r"root beer", "root beer soda"), (r"cream soda|zero calorie soda|\bsoda\b", "soda"),
            (r"hoppy refresher|hop splash", "sparkling hop water"), (r"hoptea|sparkling tea", "sparkling hop tea"),
            (r"countional seltzer|functional seltzer", "non-alcoholic functional seltzer")]


def main(miss_path, beers_path, write):
    miss = json.load(open(miss_path))
    doc = json.load(open(beers_path))
    recs, skipped = doc["beers"], doc["skipped_non_beer"]
    have = {r["asin"] for r in recs} | {s["asin"] for s in skipped}
    pos = max([r["position"] for r in recs] + [s["position"] for s in skipped])
    n = len(recs)
    added, new_skip, problems = [], [], []
    for i, t in enumerate(miss, 1):
        a = t["asin"]
        if a in have:
            continue
        m = TAIL.search(t["label"])
        if not m:
            problems.append((a, t["label"], "no price tail"))
            continue
        text = t["label"][: m.start()].strip(" ,")
        brand_shown, name = None, text
        for k, v in sorted(BRANDS, key=lambda kv: -len(kv[0])):
            if text.startswith(k + " ") or text.startswith(k + ","):
                brand_shown, name = k, text[len(k):].strip(" ,")
                brand = v
                break
        if brand_shown is None:
            problems.append((a, t["label"], "brand not in list"))
            continue
        brand = BRAND_BY_ASIN.get(a, brand)
        variants = m.group(1).strip(" ,") if m.group(1) else None
        off = m.group(2)
        price = float(m.group(3).replace(",", ""))
        lp = float(m.group(4).replace(",", "")) if m.group(4) else None
        pos += 1
        low = name.lower()
        reason = next((why for rx, why in NON_BEER if re.search(rx, low)), None)
        if reason:
            new_skip.append({"asin": a, "position": pos, "brand": brand, "grid_name": name,
                             "price": f"${price:,.2f}", "reason": reason, "status": "skipped_non_beer",
                             "found_in": "price-sorted sweep 2026-11-22"})
            continue
        slug_title = re.sub(r"-b[0-9a-z]{9}$", "", t["href"].rsplit("/", 1)[-1]).replace("-", " ")
        # the slug drops dots: "11 2 fl oz" is 11.2 fl oz and "4 7 abv" is 4.7% ABV
        slug_title = re.sub(r"\b(\d+) (\d+) (?=(?:abv|fl oz|fz|oz|ml)\b)", r"\1.\2 ", slug_title)
        slug_title = re.sub(r"\b(\d+(?:\.\d+)?) abv\b", r"\1% ABV", slug_title)
        both = f"{name} {slug_title}"
        ptype = "rice_wine" if brand == "Makku" else B.product_type(both)
        style = B.find_style(both) if ptype == "beer" else None
        if ptype == "beer":  # names the first build's rules don't cover
            for rx, st in EXTRA_STYLE:
                if re.search(rx, both.lower()):
                    style = st
                    break
        if ptype != "beer":
            style = ("Makgeolli" if re.search(r"makgeolli|makkoli|makku", both.lower()) else "Sake") if ptype == "rice_wine" else \
                {"hard_cider": "Cider", "hard_seltzer": "Hard seltzer", "hard_kombucha": "Hard kombucha",
                 "hard_tea": "Hard tea"}.get(ptype, "Other hard drink")
        family = B.STYLE_FAMILY.get(style) if ptype == "beer" else B.TYPE_FAMILY[ptype]
        pack, pack_src = B.find_pack(name), "grid_title"
        vol, vol_txt = B.find_volume(name)
        vol_src = "grid_title" if vol else None
        if vol is None:
            sm = re.search(r"\b(\d+(?:\s\d+)?)\s(fl oz|fz|oz|ml)\b", slug_title)
            if sm:
                txt = sm.group(1).replace(" ", ".") + " " + sm.group(2)
                vol, vol_txt = B.find_volume(txt)
                vol_src = "product_url" if vol else None
        if pack is None:
            pack = B.find_pack(slug_title)
            pack_src = "product_url" if pack else None
        if pack is None and vol is not None:
            pack, pack_src = 1, "single container (no pack count in title)"
        if vol_txt and B.OZ_RE.search(vol_txt) and float(B.OZ_RE.search(vol_txt).group(1)) >= 100:
            problems.append((a, name, f"size {vol_txt} reads as mL"))
        container = B.find_container(name) or B.find_container(slug_title)
        abv = B.find_abv(name) or B.find_abv(slug_title)
        non_alc = bool(B.NA_RE.search(both)) or (abv is not None and abv["value"] <= 0.5)
        country, country_text = B.find_country([name])
        per_unit = round(price / pack, 2) if pack else None
        per_oz = round(price / (pack * vol), 3) if pack and vol else None
        n += 1
        rec = {
            "scw_id": f"SCW{n}", "asin": a, "position": pos, "grid_positions": [pos],
            "brand": brand, "brand_as_shown": brand_shown, "product_name": name, "page_title": None,
            "grid_title": f"{brand_shown} {name}", "grid_name": name, "variants_note": variants,
            "price": f"${price:,.2f}", "price_usd": price,
            "list_price": f"${lp:,.2f}" if lp else None, "list_price_usd": lp,
            "discount_note": (f"{off}% off" + (" with Prime" if "with Prime" in t["label"] else "")) if off else None,
            "off_pct": int(off) if off else None,
            "product_type": ptype, "type_family": family, "style": style, "non_alcoholic": non_alc,
            "pack_count": pack, "pack_count_source": pack_src,
            "container": container, "container_fl_oz": vol, "container_size_as_written": vol_txt,
            "container_size_source": vol_src, "total_fl_oz": round(pack * vol, 2) if pack and vol else None,
            "price_per_container_usd": per_unit, "price_per_fl_oz_usd": per_oz,
            "abv_pct": abv["value"] if abv else None, "abv_less_than": abv["less_than"] if abv else False,
            "abv_text": abv["text"] if abv else None, "abv_conflict": False,
            "abv_all_found": [abv["value"]] if abv else [],
            "calories": None, "calories_text": None, "country": country, "country_text": country_text,
            "in_store_location": None, "size_selected": None, "size_options": [], "flavor_selected": None,
            "flavor_options": [], "other_pickers": {}, "description_bullets": [], "ingredients": None,
            "label_facts": {}, "other_sections": {}, "main_img_alt": None, "image_url": None,
            "delivery_zip": "92211", "url": "https://www.wholefoodsmarket.com" + t["href"],
            "is_beer_aisle_drink": True, "extraction_status": "grid_only",
        }
        added.append(rec)
    for r in added:
        print(f"{r['brand'][:22]:22} | {r['product_name'][:52]:52} | {r['type_family']!s:18} | {r['style']!s:16} | {r['pack_count']!s:>3} x {r['container_fl_oz']!s:>5} {r['container']!s:6} | abv {r['abv_pct']} | NA {r['non_alcoholic']} | ${r['price_usd']} {r['price_per_fl_oz_usd']}")
    for s in new_skip:
        print("SKIP", s["brand"], "|", s["grid_name"][:60], "|", s["reason"])
    for p in problems:
        print("PROBLEM", p)
    print("added", len(added), "skipped", len(new_skip), "problems", len(problems))
    if write and not problems:
        for r in recs:
            r.setdefault("extraction_status", "page")
        recs.extend(added)
        skipped.extend(new_skip)
        src = doc["source"]
        src.update({"sweep_url": "https://www.wholefoodsmarket.com/grocery/search?k=beer&s=price-desc-rank",
                    "sweep_captured": "2026-11-22", "sweep_unique_products": 240,
                    "drinks_read": len(recs), "non_beer_skipped": len(skipped),
                    "sweep_note": "The default relevance sort repeats tiles. The price-sorted list was loaded to "
                                  "the end (240 products) and every product was checked against this file; missing "
                                  "drinks were added as grid_only records and missing non-beer items were set aside."})
        json.dump(doc, open(beers_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("wrote", beers_path, len(recs), len(skipped))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], "--write" in sys.argv)
