#!/usr/bin/env python3
"""Build the standardized Whole Foods beer dataset from the captured grid tiles and product pages.

Inputs  raw/tiles/tiles.jsonl, raw/tiles/non_beer.json, raw/tiles/grid_summary.json,
        raw/products/queue.json, raw/products/batch_*.jsonl
Outputs data/beers.json, data/scw/SCW*.json (SCW0 = build world, SCW1..n = one product each),
        data/coverage_report.json
Every text field copied from the store pages is kept verbatim; derived fields (style, pack count,
container size, ABV, country) are parsed from that text and each record says where they came from.
"""
import glob
import json
import os
import re
import shutil

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
RAW = os.path.join(ROOT, "raw")
DATA = os.path.join(ROOT, "data")
CAPTURED = "2026-11-20"
ML_PER_FL_OZ = 29.5735

BRAND_FIX = {"コナ": "Kona", "本麒麟": "Kirin"}  # brand text the site shows in Japanese script


def load_jsonl(paths):
    rows = []
    for p in paths:
        with open(p, encoding="utf-8") as f:
            rows += [json.loads(l) for l in f if l.strip()]
    return rows


def money(s):
    if not s:
        return None
    m = re.search(r"\$\s*([\d,]+(?:\.\d+)?)", s)
    return float(m.group(1).replace(",", "")) if m else None


def pct(note):
    m = re.match(r"(\d+)% off", note or "")
    return int(m.group(1)) if m else None


def asin_of(href):
    m = re.search(r"-(b0[0-9a-z]{8})(?:$|[/?])", (href or "").lower())
    return m.group(1).upper() if m else None


# ---------- pack, container, size ----------
PACK_RES = [
    re.compile(r"pack of (\d+)", re.I),
    re.compile(r"\b(\d+)\s*-?\s*(?:pk|pack|ct|count)\b", re.I),
    re.compile(r"\b(\d+)\s*-\s*pk\b", re.I),
]
SINGLE_RE = re.compile(r"\b(single|sgl)\b", re.I)
OZ_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(?:fl\.?\s*oz|fz|oz|fl\s*oz)\b", re.I)
ML_RE = re.compile(r"(\d+(?:\.\d+)?)\s*ml\b", re.I)


def find_pack(text):
    if not text:
        return None
    for rx in PACK_RES:
        m = rx.search(text)
        if m:
            n = int(m.group(1))
            if 1 <= n <= 48:
                return n
    if SINGLE_RE.search(text):
        return 1
    return None


def find_volume(text):
    """Container volume -> (fl oz, label as written)."""
    if not text:
        return None, None
    m = OZ_RE.search(text)
    if m:
        v = float(m.group(1))
        # no can or bottle holds 100+ fl oz; a label like "355 FZ" is millilitres written with the wrong unit
        if v >= 100:
            return round(v / ML_PER_FL_OZ, 2), m.group(0)
        return round(v, 2), m.group(0)
    m = ML_RE.search(text)
    if m:
        return round(float(m.group(1)) / ML_PER_FL_OZ, 2), m.group(0)
    return None, None


def find_container(text):
    t = (text or "").lower()
    if re.search(r"\bcans?\b", t):
        return "Can"
    if re.search(r"\bbottles?\b|\bbtls?\b", t):
        return "Bottle"
    return None


# ---------- type, style, ABV, country ----------
def product_type(text):
    t = text.lower()
    if re.search(r"\bsake\b|junmai|ginjo|makgeolli|makkoli", t):
        return "rice_wine"
    if re.search(r"\bcider\b", t):
        return "hard_cider"
    if re.search(r"seltzer", t):
        return "hard_seltzer"
    if re.search(r"kombucha|booch", t):
        return "hard_kombucha"
    if re.search(r"hard tea", t):
        return "hard_tea"
    if re.search(r"hard ginger mule", t):
        return "hard_other"
    return "beer"


NA_RE = re.compile(r"non[- ]?alc|alcohol[- ]free|zero[- ]alcohol|\bna beer\b|\b0\.0\b|<\s*0\.5\s*%", re.I)

STYLE_RULES = [  # (regex on title text, style), first match wins
    (r"variety|mixed|parade pack|party pack|trail pass|sampler", "Variety pack"),
    (r"paloma|moscow mule|margarita", "Cocktail-style brew"),
    (r"double ipa|\bdipa\b|imperial ipa|ipa double|double hazy|triple ipa|double ipa", "Double IPA"),
    (r"hazy|new england|juicy", "Hazy IPA"),
    (r"\bipa\b|india pale", "IPA"),
    (r"pale ale|pale hoppy|\bapa\b|ale american", "Pale ale"),
    (r"stout|rasputin", "Stout"),
    (r"porter", "Porter"),
    (r"lambic|geuze|gueuze|framboise|kriek|\bsour\b|fruit beer|fruit red", "Lambic & sour"),
    (r"radler|shandy", "Radler"),
    (r"saison|farmhouse|farmouse", "Saison"),
    (r"trappist|tripel|trippel|dubbel|quad|chimay|duvel|delirium|gulden draak|van steenberge|strong ale|belgian ale|chouffe|ommegang|gnommegang", "Belgian ale"),
    (r"hefe|weiss|weizen|wheat|witbier|white belgian|belgian white|einstok, white", "Wheat"),
    (r"k[oö]lsch", "Kölsch"),
    (r"schwarzbier|dark lager|negra|noche|black lager", "Dark lager"),
    (r"pilsner|\bpils\b|pilsener", "Pilsner"),
    (r"blonde|golden ale|\bgolden\b", "Blonde & golden ale"),
    (r"\bamber\b|\bcopper\b|\bred ale\b", "Amber & red ale"),
    (r"\blight\b|\blite\b|ultra", "Light lager"),
    (r"cerveza|mexican|clara|especial|corona|dos equis|tecate|pacifico|modelo|\btona\b|daura", "Mexican-style lager"),
    (r"lager|helles|high life|banquet|pabst|kirin|singha|tsingtao|sapporo|heineken|peroni|budweiser|stella", "Lager"),
    (r"\bale\b", "Other ale"),
]
# Two listings whose pages name no style. Both are widely known by their brewer's own style name.
KNOWN_STYLE = {"B0085157V8": "Double IPA",  # Russian River Pliny the Elder
               "B076QKYW1C": "Pilsner"}     # Clausthaler Original (non-alcoholic)

STYLE_FAMILY = {
    "IPA": "IPA", "Double IPA": "IPA", "Hazy IPA": "IPA",
    "Pale ale": "Pale ale",
    "Lager": "Lager & pilsner", "Light lager": "Lager & pilsner", "Mexican-style lager": "Lager & pilsner",
    "Pilsner": "Lager & pilsner", "Dark lager": "Lager & pilsner",
    "Wheat": "Wheat",
    "Belgian ale": "Belgian & farmhouse", "Saison": "Belgian & farmhouse",
    "Stout": "Stout & porter", "Porter": "Stout & porter",
    "Lambic & sour": "Fruit, sour & radler", "Radler": "Fruit, sour & radler", "Cocktail-style brew": "Fruit, sour & radler",
    "Blonde & golden ale": "Blonde & other ale", "Amber & red ale": "Blonde & other ale", "Kölsch": "Blonde & other ale", "Other ale": "Blonde & other ale",
    "Variety pack": "Variety pack",
}
TYPE_FAMILY = {"hard_cider": "Cider", "hard_seltzer": "Hard seltzer", "hard_kombucha": "Kombucha, tea & other",
               "hard_tea": "Kombucha, tea & other", "hard_other": "Kombucha, tea & other",
               "rice_wine": "Sake & rice wine"}


SECTION_KEYS = {"unit price (under price)": "Unit price", "unit_price": "Unit price", "unit price": "Unit price"}


def norm_sections(secs):
    """Capture agents named the unit-price line differently; give it one key."""
    out = {}
    for k, v in (secs or {}).items():
        key = SECTION_KEYS.get(k.strip().lower(), k)
        vals = v if isinstance(v, list) else [v]
        out.setdefault(key, [])
        out[key] += [x for x in vals if x not in out[key]]
    return out


def find_style(text):
    t = text.lower()
    for rx, style in STYLE_RULES:
        if re.search(rx, t):
            return style
    return None


ABV_RES = [
    re.compile(r"(<\s*)?(\d+(?:\.\d+)?)\s*%\s*(?:abv|alc\b|alcohol)", re.I),
    re.compile(r"(?:abv|alcohol by volume|alcohol content)\s*(?:of|:)?\s*(<\s*)?(\d+(?:\.\d+)?)\s*%", re.I),
]


def find_abv(text):
    if not text:
        return None
    for rx in ABV_RES:
        m = rx.search(text)
        if m:
            v = float(m.group(2))
            if 0 <= v <= 20:
                return {"value": v, "less_than": bool(m.group(1)), "text": m.group(0)}
    return None


COUNTRIES = [
    (r"\bbelgium\b", "Belgium"), (r"\bgermany\b|\bbavaria\b|m[uü]nchen|munich", "Germany"),
    (r"\bmexico\b", "Mexico"), (r"\bjapan\b", "Japan"), (r"\bireland\b|\bdublin\b", "Ireland"),
    (r"\bitaly\b", "Italy"), (r"\bnetherlands\b|\bholland\b", "Netherlands"), (r"\bdenmark\b|\bdanish\b", "Denmark"),
    (r"\biceland\b", "Iceland"), (r"\bengland\b|\bengland's\b|\bunited kingdom\b|\bu\.k\.\b|\byorkshire\b|\benglish\b", "United Kingdom"),
    (r"\bchina\b|\bqingdao\b", "China"), (r"\bthailand\b", "Thailand"), (r"\bspain\b|\bbarcelona\b", "Spain"),
    (r"\baustria\b|\bsalzburg\b", "Austria"), (r"\bnicaragua\b", "Nicaragua"), (r"\bczech\b", "Czech Republic"),
    (r"\bcanada\b", "Canada"), (r"\bfrance\b", "France"), (r"\bkorea\b", "South Korea"),
    (r"\bcalifornia\b|\busa\b|\bu\.s\.a?\b|united states|\bamerican\b|\bamerica\b|\boregon\b|\bcolorado\b|\bmichigan\b|\bmaine\b|\bdelaware\b|\bbrooklyn\b|\bnew york\b|\bsan diego\b|\blos angeles\b|\bpetaluma\b|\bsanta rosa\b|\bchico\b|\bescondido\b|\bpaso robles\b|\bventura\b|\bojai\b|\bfort collins\b|\bbend\b|\bportland\b|\bhawaii\b", "United States"),
]


NOT_COUNTRY = re.compile(r"new belgium|belgi(?:an|um)[- ]style|style belgi|kona brewing|kona big wave", re.I)


def find_country(texts):
    texts = [NOT_COUNTRY.sub(" ", t) if t else t for t in texts]
    for t in texts:
        if not t:
            continue
        tl = t.lower()
        m = re.search(r"(?:imported from|brewed in|product of|made in|hails from|from)\s+([a-z' .]+)", tl)
        if m:
            for rx, c in COUNTRIES:
                if re.search(rx, m.group(1)):
                    return c, t
    for t in texts:
        if not t:
            continue
        for rx, c in COUNTRIES:
            if re.search(rx, t.lower()):
                return c, t
    return None, None


CAL_RE = re.compile(r"(under\s+)?(\d{1,3})\s*(?:calories|cal)\b", re.I)


def label_facts(bullets):
    out = {}
    for b in bullets:
        m = re.match(r"^([A-Z][A-Za-z /&()-]{2,40}):\s+(.{1,120})$", b.strip())
        if m and not re.search(r"[.!?].+[.!?]", m.group(2)):
            key = re.sub(r"[^a-z0-9]+", "_", m.group(1).lower()).strip("_")
            out[key] = m.group(2).strip()
    return out


def short_name(h1):
    return re.split(r"\s+\|\s+", h1 or "")[0].strip()


def main():
    tiles = load_jsonl([os.path.join(RAW, "tiles", "tiles.jsonl")])
    non_beer = json.load(open(os.path.join(RAW, "tiles", "non_beer.json")))
    grid = json.load(open(os.path.join(RAW, "tiles", "grid_summary.json")))
    queue = json.load(open(os.path.join(RAW, "products", "queue.json")))
    pages = {}
    for r in load_jsonl(sorted(glob.glob(os.path.join(RAW, "products", "batch_*.jsonl")))):
        if r.get("status") == "ok" or r["asin"] not in pages:
            pages[r["asin"]] = r

    first_tile, positions = {}, {}
    for t in tiles:
        first_tile.setdefault(t["asin"], t)
        positions.setdefault(t["asin"], []).append(t["position"])

    queued = {q["asin"] for q in queue}
    records, problems = [], []
    for q in queue:
        a = q["asin"]
        t = first_tile[a]
        p = pages.get(a)
        if not p or p.get("status") != "ok":
            problems.append({"asin": a, "issue": "no product page captured", "detail": (p or {}).get("error")})
            continue
        h1 = p["h1"]
        tile_name = t["name"]
        bullets = p.get("bullets") or []
        ingredients = p.get("ingredients")
        title_text = f"{h1} {tile_name}"
        all_text = " ".join([title_text] + bullets + [ingredients or ""])

        ptype = product_type(title_text if product_type(title_text) != "beer" else all_text if re.search(r"\bcider\b|seltzer|kombucha", " ".join(bullets[:2]).lower()) else title_text)
        style = find_style(title_text) if ptype == "beer" else None
        if ptype == "beer" and style is None:
            style = find_style(" ".join(bullets))
        if ptype != "beer":  # ciders, seltzers and similar take their kind as the style
            style = ("Makgeolli" if re.search(r"makgeolli|makkoli", title_text.lower()) else "Sake") if ptype == "rice_wine" else \
                {"hard_cider": "Cider", "hard_seltzer": "Hard seltzer", "hard_kombucha": "Hard kombucha",
                     "hard_tea": "Hard tea"}.get(ptype, "Other hard drink")
        if ptype == "beer" and style is None and a in KNOWN_STYLE:
            style = KNOWN_STYLE[a]  # the page names no style; this is the brewer's own name for it
        family = STYLE_FAMILY.get(style) if ptype == "beer" else TYPE_FAMILY[ptype]

        # pack count: page title first, then the selected size option, then the grid tile
        pack_sources = [("page_title", h1), ("selected_size", p.get("size_selected")), ("grid_title", tile_name)]
        pack, pack_src = None, None
        for src, txt in pack_sources:
            pack = find_pack(txt)
            if pack:
                pack_src = src
                break
        vol, vol_txt, vol_src = None, None, None
        for src, txt in pack_sources:
            vol, vol_txt = find_volume(txt)
            if vol:
                vol_src = src
                break
        if pack is None and vol is not None:
            pack, pack_src = 1, "single container (no pack count in title)"
        if vol_txt and OZ_RE.search(vol_txt) and float(OZ_RE.search(vol_txt).group(1)) >= 100:
            problems.append({"asin": a, "issue": "size written in fl oz but reads as millilitres",
                             "detail": {"as_written": vol_txt, "read_as_fl_oz": vol}})
        container = find_container(h1) or find_container(tile_name) or find_container(p.get("size_selected")) \
            or find_container(" ".join(bullets))
        sel_pack = find_pack(p.get("size_selected"))
        if sel_pack and pack and sel_pack != pack:
            problems.append({"asin": a, "issue": "pack count differs between page title and selected size",
                             "detail": f"{h1!r} vs {p.get('size_selected')!r}"})

        abv_title = find_abv(h1)
        abv_bullets = None
        for b in bullets:
            abv_bullets = find_abv(b)
            if abv_bullets:
                break
        abv_tile = find_abv(tile_name)
        abv = abv_title or abv_bullets or abv_tile
        abv_vals = {x["value"] for x in (abv_title, abv_bullets, abv_tile) if x}
        abv_conflict = len(abv_vals) > 1
        if abv_conflict:
            problems.append({"asin": a, "issue": "ABV differs between page texts",
                             "detail": {"page_title": abv_title and abv_title["text"],
                                        "description": abv_bullets and abv_bullets["text"],
                                        "grid_title": abv_tile and abv_tile["text"]}})
        non_alc = bool(NA_RE.search(title_text)) or (abv is not None and abv["value"] <= 0.5)

        country, country_text = find_country([h1] + bullets + [ingredients or ""])
        cal = None
        for b in [h1] + bullets:
            m = CAL_RE.search(b or "")
            if m:
                cal = {"value": int(m.group(2)), "under": bool(m.group(1)), "text": m.group(0)}
                break
        lf = label_facts(bullets)

        price = money(p.get("price")) or money(t.get("price"))
        list_price = money(p.get("list_price")) or money(t.get("list_price"))
        discount_note = p.get("discount_note") or t.get("discount_note")
        units = pack or None
        per_unit = round(price / units, 2) if price and units else None
        per_oz = round(price / (units * vol), 3) if price and units and vol else None

        def opts(lst):
            out = []
            for o in lst or []:
                oa = asin_of(o.get("href"))
                out.append({"label": o.get("label"), "price": o.get("price"), "price_usd": money(o.get("price")),
                            "selected": bool(o.get("selected")), "asin": oa, "in_dataset": oa in queued})
            return out

        brand_raw = p.get("brand") or t.get("brand")
        rec = {
            "scw_id": None, "asin": a, "position": positions[a][0], "grid_positions": positions[a],
            "brand": BRAND_FIX.get(brand_raw, brand_raw), "brand_as_shown": brand_raw,
            "product_name": short_name(h1), "page_title": h1, "grid_title": f'{t.get("brand")} {tile_name}',
            "grid_name": tile_name, "variants_note": t.get("variants_note"),
            "price": p.get("price") or t.get("price"), "price_usd": price,
            "list_price": p.get("list_price") or t.get("list_price"), "list_price_usd": list_price,
            "discount_note": discount_note, "off_pct": pct(discount_note),
            "product_type": ptype, "type_family": family, "style": style, "non_alcoholic": non_alc,
            "pack_count": pack, "pack_count_source": pack_src,
            "container": container, "container_fl_oz": vol, "container_size_as_written": vol_txt,
            "container_size_source": vol_src,
            "total_fl_oz": round(pack * vol, 2) if pack and vol else None,
            "price_per_container_usd": per_unit, "price_per_fl_oz_usd": per_oz,
            "abv_pct": abv["value"] if abv else None, "abv_less_than": abv["less_than"] if abv else False,
            "abv_text": abv["text"] if abv else None, "abv_conflict": abv_conflict,
            "abv_all_found": sorted(abv_vals),
            "calories": cal["value"] if cal else None, "calories_text": cal["text"] if cal else None,
            "country": country, "country_text": country_text,
            "in_store_location": p.get("location_in_store"),
            "size_selected": p.get("size_selected"), "size_options": opts(p.get("size_options")),
            "flavor_selected": p.get("flavor_selected"), "flavor_options": opts(p.get("flavor_options")),
            "other_pickers": p.get("other_pickers") or {},
            "description_bullets": bullets, "ingredients": ingredients,
            "label_facts": lf, "other_sections": norm_sections(p.get("other_sections")),
            "main_img_alt": p.get("main_img_alt"), "image_url": None,
            "delivery_zip": p.get("delivery_zip"), "url": p.get("final_url") or "https://www.wholefoodsmarket.com" + q["href"],
            "is_beer_aisle_drink": True,
        }
        if rec["delivery_zip"] != "92211":
            problems.append({"asin": a, "issue": "page not shown for 92211", "detail": rec["delivery_zip"]})
        if rec["price_usd"] is None:
            problems.append({"asin": a, "issue": "no price"})
        records.append(rec)

    records.sort(key=lambda r: r["position"])
    for i, r in enumerate(records, 1):
        r["scw_id"] = f"SCW{i}"

    # non-beer grid items kept as light records so the grid is fully accounted for
    skipped = []
    for a, reason in non_beer.items():
        t = first_tile[a]
        skipped.append({"asin": a, "position": positions[a][0], "brand": t["brand"], "grid_name": t["name"],
                        "price": t["price"], "reason": reason, "status": "skipped_non_beer"})
    skipped.sort(key=lambda s: s["position"])

    source = {
        "site": "https://www.wholefoodsmarket.com", "search_url": "https://www.wholefoodsmarket.com/grocery/search?k=beer",
        "delivery_zip": "92211", "captured": CAPTURED, "heading_text": grid.get("heading_text"),
        "results_text": grid.get("results_text"), "grid_tiles": len(tiles), "unique_products": len(first_tile),
        "drinks_read": len(records), "non_beer_skipped": len(skipped),
        "notes": ["Text copied from store pages verbatim; style, pack, container, ABV and country are parsed from that text.",
                  "Image URLs were not exposed to the capture tools, so image_url is null."],
    }
    os.makedirs(DATA, exist_ok=True)
    with open(os.path.join(DATA, "beers.json"), "w", encoding="utf-8") as f:
        json.dump({"source": source, "beers": records, "skipped_non_beer": skipped}, f, ensure_ascii=False, indent=1)

    scw_dir = os.path.join(DATA, "scw")
    if os.path.isdir(scw_dir):
        shutil.rmtree(scw_dir)
    os.makedirs(scw_dir)
    json.dump({"scw": "SCW0", "kind": "mcp_server_build",
               "description": "Build world for the Whole Foods beer MCP server; children SCW1..SCWn are one product each.",
               "source": source, "children": [r["scw_id"] for r in records]},
              open(os.path.join(scw_dir, "SCW0.json"), "w"), ensure_ascii=False, indent=1)
    for r in records:
        json.dump({"scw": r["scw_id"], "parent": "SCW0", "kind": "beer_product", "record": r},
                  open(os.path.join(scw_dir, r["scw_id"] + ".json"), "w"), ensure_ascii=False, indent=1)

    fields = ["style", "pack_count", "container", "container_fl_oz", "abv_pct", "country", "ingredients",
              "calories", "in_store_location", "price_usd"]
    cov = {f: sum(1 for r in records if r.get(f) not in (None, "", [], {})) for f in fields}
    by = lambda k: dict(sorted(((v, sum(1 for r in records if r.get(k) == v)) for v in {r.get(k) for r in records}),
                               key=lambda kv: -kv[1]))
    report = {"source": source, "records": len(records), "queued": len(queue),
              "missing_pages": [q["asin"] for q in queue if q["asin"] not in {r["asin"] for r in records}],
              "field_coverage": cov, "by_product_type": by("product_type"), "by_type_family": by("type_family"),
              "by_style": by("style"), "by_pack_count": by("pack_count"), "by_container": by("container"),
              "non_alcoholic": sum(1 for r in records if r["non_alcoholic"]), "problems": problems}
    json.dump(report, open(os.path.join(DATA, "coverage_report.json"), "w"), ensure_ascii=False, indent=1)
    print(json.dumps({k: report[k] for k in ("records", "queued", "missing_pages", "field_coverage", "by_type_family",
                                              "by_pack_count", "by_container", "non_alcoholic")}, ensure_ascii=False))
    print("problems", len(problems))
    for pr in problems:
        print(" ", json.dumps(pr, ensure_ascii=False)[:300])


if __name__ == "__main__":
    main()
