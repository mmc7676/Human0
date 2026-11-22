#!/usr/bin/env python3
"""Supersystem integration: merge level-1 grid tiles (raw/tiles/tiles.jsonl) with
level-2 product pages (raw/products/*.jsonl) into the standardized dataset
data/wines.json, one logical SCW record per bottle (data/scw/SCWn.json), plus a
coverage-parity report (data/coverage_report.json)."""
import glob
import json
import os
import re
import sys
from datetime import date

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RAW = os.path.join(ROOT, "raw")
DATA = os.path.join(ROOT, "data")

# ---------- level-2 description classification ----------
COUNTRIES = ["argentina", "australia", "austria", "chile", "france", "germany", "greece", "italy",
             "new zealand", "portugal", "south africa", "spain", "usa", "united states", "california",
             "oregon", "washington", "new york", "mexico", "hungary", "israel", "lebanon", "uruguay",
             "canada", "england", "japan", "georgia", "slovenia", "croatia", "moldova", "netherlands"]
REGION_WORDS = ["valley", "county", "coast", "napa", "sonoma", "paso robles", "marlborough", "bordeaux",
                "burgundy", "bourgogne", "champagne", "rioja", "tuscany", "toscana", "piedmont", "piemonte",
                "veneto", "sicily", "sicilia", "provence", "rhone", "rhône", "loire", "mendoza", "barossa",
                "willamette", "columbia", "central coast", "monterey", "lodi", "russian river", "carneros",
                "alsace", "mosel", "douro", "languedoc", "abruzzo", "puglia", "sancerre", "chianti",
                "prosecco", "cava", "doc", "docg", "aoc", "ava", "appellation", "region", "vineyard in",
                "hawke's bay", "central otago", "mclaren vale", "yarra", "coonawarra", "stellenbosch",
                "maipo", "colchagua", "casablanca", "uco valley", "patagonia", "beaujolais", "côtes", "cotes"]
PAIRING_RE = re.compile(r"\b(pair(s|ed|ing)?|food match|match(es)? (well|perfectly|beautifully)? ?with|serve(d)? with|"
                        r"enjoy (it )?(with|alongside)|accompan(y|ies|iment)|complement(s)?|goes (great|well) with|"
                        r"perfect (with|for|alongside)|delicious with|great with|wonderful with|ideal with|"
                        r"excellent with|try (it )?with|alongside)\b", re.I)
VINTAGE_RE = re.compile(r"\bvintage(s)?\b|\b(19|20)\d{2}\b", re.I)
MAKING_RE = re.compile(r"\b(ferment\w*|aged|aging|ageing|oak|barrel\w*|lees|stainless|malolactic|harvest\w*|"
                       r"hand[- ]?picked|picked|bottled|vinif\w*|macerat\w*|cellar\w*|crush\w*|press\w*|"
                       r"blend(ed|ing)?|made (from|with|in|using)|crafted|produced|methode|méthode|"
                       r"champenoise|charmat|tank|yeast|sur lie|organic(ally)? (farmed|grown)|"
                       r"sustainab\w*|biodynamic\w*|estate[- ]grown|grapes (are|were)|vineyards? (are|is))\b", re.I)
TASTE_RE = re.compile(r"\b(aroma\w*|notes?|flavou?r\w*|palate|pallet|finish(es)?|nose|taste\w*|tannin\w*|"
                      r"bouquet|crisp|bright|hints?|fruit\w*|acidity|body|bodied|smooth|velvety|juicy|"
                      r"refreshing|citrus|berr(y|ies)|cherry|vanilla|spice|spicy|oaky|buttery|dry|sweet|"
                      r"mouthfeel|structure|elegant|rich|round|zesty|mineral\w*)\b", re.I)
ABV_RE = re.compile(r"(\d{1,2}(?:\.\d{1,2})?)\s*%\s*(abv|alc|alcohol)?", re.I)


def split_sentences(text):
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\"'“])", text.strip())
    return [p.strip() for p in parts if p.strip()]


def looks_like_location(text):
    t = text.strip().rstrip(".")
    low = t.lower()
    words = t.split()
    if len(words) > 10:
        return False
    if PAIRING_RE.search(t) or TASTE_RE.search(t) and len(words) > 4:
        return False
    if re.match(r"^(region|appellation|origin|country of origin|from)\s*:", low):
        return True
    has_place = any(re.search(r"\b" + re.escape(c) + r"\b", low) for c in COUNTRIES + REGION_WORDS)
    return has_place


FOOD_RE = re.compile(
    r"\b(meals?|foods?|dish(es)?|cuisine|appetizers?|hors d|entr[eé]es?|cheeses?|charcuterie|chicken|poultry|"
    r"turkey|duck|beef|steaks?|burgers?|pork|ribs|ham|bacon|sausages?|lamb|veal|venison|game|meats?|fish|"
    r"seafood|salmon|tuna|halibut|cod|trout|shellfish|oysters?|shrimp|prawns?|crab|lobster|scallops?|mussels|"
    r"clams|sushi|sashimi|pasta|pizza|risotto|polenta|salads?|vegetables?|veggies|mushrooms?|stews?|soups?|"
    r"curry|curries|tacos?|fajitas|bbq|barbecue|grilled|roast(ed)?|braised|smoked|fried|tapas|paella|"
    r"brunch|picnic|desserts?|cake|pie|cookies?|tart|fondue|bolognese|lasagna|ratatouille|cassoulet|"
    r"spicy fare|takeout|take-out|burrito|enchiladas|quiche|"
    r"omelet|eggs|goat cheese|brie|camembert|parmesan|gouda|cheddar|blue cheese|manchego|pecorino)\b", re.I)
LABEL_RE = re.compile(
    r"(Type of Wine|Type of Blend|Country of Origin|Varietal|Grapes|Alcohol By Volume|Alcohol Content|ABV|Country string|Country|Region|"
    r"Appellation|Vintage|Import)\s*:\s*", re.I)
LOC_LEAD_RE = re.compile(r"^(from (the )?|produced in|made in|appellation|import:)|"
                         r"\b(sourced from|hailing from|grown in|located in|(winery|vineyards?) (is|are) located)\b",
                         re.I)


def is_pairing(sentence):
    foods = FOOD_RE.findall(sentence)
    if not foods:
        return False
    if PAIRING_RE.search(sentence) or re.search(r"\b(with|alongside|to)\b", sentence, re.I):
        return True
    return len(foods) >= 2


def classify_bullets(bullets):
    fields = {"vineyard_location": [], "winemaking": [], "tasting_notes": [], "pairing": [],
              "vintage": [], "other_notes": []}
    label_facts = {}

    def add(k, v):
        if v and v not in fields[k]:
            fields[k].append(v)

    for b in bullets:
        b = (b or "").strip()
        if not b or b.lower() == "description":
            continue
        # pull "Label: value" facts (e.g. "Type of Wine: White Varietal: Chardonnay") out of the bullet
        parts = list(LABEL_RE.finditer(b))
        if parts and parts[0].start() <= 2:
            rest_start = None
            for i, m in enumerate(parts):
                end = parts[i + 1].start() if i + 1 < len(parts) else len(b)
                val = b[m.end():end].strip(" ,;.")
                key = re.sub(r"\s+", "_", m.group(1).strip().lower())
                # a label value is short; anything longer continues as free text
                words = val.split()
                if len(words) > 8:
                    label_facts.setdefault(key, " ".join(words[:8]).strip(" ,;."))
                    rest_start = (m.end(), " ".join(words[8:]))
                else:
                    label_facts.setdefault(key, val)
            if key in ("appellation", "region", "import", "country_of_origin") and label_facts.get(key):
                add("vineyard_location", label_facts[key])
            if rest_start is None:
                continue
            b = rest_start[1]
        if looks_like_location(b):
            add("vineyard_location", b)
            continue
        for s in split_sentences(b):
            low = s.lower()
            if is_pairing(s) and not re.search(r"\b(blend of|blended)\b", low):
                add("pairing", s)
            elif re.search(r"\bvintage\b", low) and len(s.split()) <= 12 and not re.search(r"points|awarded", low):
                add("vintage", s)
            elif LOC_LEAD_RE.search(s) and (looks_like_location(s) or any(
                    re.search(r"\b" + re.escape(c) + r"\b", low) for c in COUNTRIES + REGION_WORDS)):
                add("vineyard_location", s)
            else:
                m = len(MAKING_RE.findall(s))
                t = len(TASTE_RE.findall(s))
                if re.search(r"\b(points|awarded|award|best buy|#1|accolades|calories|carbs|package dimension|"
                             r"package weight|serve (between|chilled|at)|stays fresh)\b", low):
                    add("other_notes", s)
                elif m == 0 and t == 0:
                    if looks_like_location(s):
                        add("vineyard_location", s)
                    elif VINTAGE_RE.search(s) and len(s.split()) <= 12 and not re.search(r"points|awarded", low):
                        add("vintage", s)
                    else:
                        add("other_notes", s)
                elif m > t:
                    add("winemaking", s)
                else:
                    add("tasting_notes", s)
    out = {k: (" ".join(v) if v else None) for k, v in fields.items()}
    out["label_facts"] = label_facts
    return out


# ---------- name / size split ----------
SIZE_RE = re.compile(
    r"(?P<num>\d+(?:\.\d+)?)\s*(?P<unit>ml|mL|ML|Ml|l|L|liter|liters|litre|litres|ltr|fl\.?\s*oz|fz|oz)\b"
    r"(?:\s*(?P<pkg>bottles?|box|cans?|carton|bag[- ]in[- ]box|pouch|tetra(?:pak)?))?", re.I)
PACK_RE = re.compile(r"\b(\d+)\s*(?:-|\s)?(pack|pk|ct|count)\b|\b(\d+)\s*x\s*\d", re.I)


def norm_size(num, unit):
    u = unit.lower().replace(".", "").replace(" ", "")
    if u in ("ml",):
        return f"{num} mL"
    if u in ("l", "liter", "liters", "litre", "litres", "ltr"):
        return f"{num} L"
    if u in ("floz", "fz", "oz"):
        return f"{num} fl oz"
    return f"{num} {unit}"


def split_name_size(title):
    if not title:
        return None, None, None
    matches = list(SIZE_RE.finditer(title))
    if not matches:
        return title.strip(), None, None
    m = matches[-1]
    size = norm_size(m.group("num"), m.group("unit"))
    pack = PACK_RE.search(title)
    if pack:
        n = pack.group(1) or pack.group(3)
        size = f"{n} x {size}"
    name = (title[: m.start()] + title[m.end():])
    if pack:
        name = name.replace(pack.group(0), "")
    name = re.sub(r"\s*,\s*,+", ",", name)
    name = re.sub(r"\s{2,}", " ", name).strip(" ,-–|")
    name = re.sub(r",\s*(bottle|box|can)s?$", "", name, flags=re.I).strip(" ,")
    return name, size, m.group(0)


# ---------- derived attributes ----------
VARIETALS = ["Cabernet Sauvignon", "Cabernet Franc", "Sauvignon Blanc", "Pinot Noir", "Pinot Grigio",
             "Pinot Gris", "Pinot Blanc", "Pinot Meunier", "Pinot Nero", "Chardonnay", "Merlot", "Malbec",
             "Zinfandel", "Syrah", "Shiraz", "Petite Sirah", "Grenache", "Garnacha", "Tempranillo",
             "Sangiovese", "Nebbiolo", "Barbera", "Montepulciano", "Primitivo", "Nero d'Avola", "Carmenere",
             "Carménère", "Mourvedre", "Mourvèdre", "Gamay", "Riesling", "Gewurztraminer", "Gewürztraminer",
             "Moscato", "Muscat", "Chenin Blanc", "Viognier", "Albarino", "Albariño", "Vermentino",
             "Grüner Veltliner", "Gruner Veltliner", "Verdejo", "Torrontes", "Torrontés", "Semillon",
             "Marsanne", "Roussanne", "Pinotage", "Lambrusco", "Prosecco", "Champagne", "Cava", "Cremant",
             "Crémant", "Rosé", "Rose", "Red Blend", "White Blend", "Bordeaux", "Chianti", "Rioja",
             "Sancerre", "Beaujolais", "Cotes du Rhone", "Côtes du Rhône", "Chablis", "Port", "Sherry",
             "Sake", "Vinho Verde", "Brut", "Sparkling", "Touriga", "Corvina", "Glera", "Carignan",
             "Cinsault", "Cinsaut", "Mencia", "Mencía", "Aglianico", "Dolcetto", "Valpolicella", "Amarone",
             "Soave", "Gavi", "Barolo", "Barbaresco", "Malvasia", "Assyrtiko", "Furmint", "Petit Verdot"]
RED = ["cabernet", "pinot noir", "merlot", "malbec", "zinfandel", "syrah", "shiraz", "petite sirah", "grenache",
       "garnacha", "tempranillo", "sangiovese", "nebbiolo", "barbera", "montepulciano", "primitivo", "nero d",
       "carmenere", "carménère", "mourv", "gamay", "beaujolais", "red", "rioja", "chianti", "pinotage",
       "bordeaux", "cotes du rhone", "côtes du rhône", "lambrusco", "touriga", "corvina", "carignan",
       "aglianico", "dolcetto", "valpolicella", "amarone", "barolo", "barbaresco", "mencia", "pinot nero",
       "petit verdot", "port"]
WHITE = ["chardonnay", "sauvignon blanc", "pinot grigio", "pinot gris", "pinot blanc", "riesling",
         "gewurz", "gewürz", "moscato", "muscat", "chenin", "viognier", "albari", "vermentino", "grüner",
         "gruner", "verdejo", "torront", "semillon", "white", "sancerre", "chablis", "vinho verde", "soave",
         "gavi", "marsanne", "roussanne", "assyrtiko", "furmint", "colombard", "blanc", "malvasia"]
SPARK = ["sparkling", "prosecco", "champagne", "cava", "cremant", "crémant", "brut", "spumante", "bubbl",
         "frizzante", "petillant", "pétillant", "mousseux", "sekt"]
NON_WINE = [  # explicit non-wine product terms; everything else in the wine search is treated as wine
    "vinegar", "manchego", "cheese", "mirin", "cooking wine", "coffee", "tequila", "vodka", "gin", "rum",
    "bourbon", "whiskey", "whisky", "mezcal", "liqueur", "amaro", "vsop", "cognac", "brandy", "lager", "beer",
    "weisse", "ale", "ipa", "cider", "sake", "junmai", "ginjo", "makgeolli", "margarita", "martini",
    "cocktail", "cocktails", "mocktail", "mocktails", "vinaigrette", "dressing", "tea", "kombucha", "juice",
    "soda", "seltzer", "sparkling water", "chocolate bar", "candy bar", "salami", "sauce", "marinade"]
NON_WINE_BRANDS = ["manotsuru", "kikusui", "tozai", "白鶴", "hakutsuru", "la colombe", "kerrygold", "el trigal"]
NON_ALC_RE = re.compile(r"\b(non[- ]?alcoholic|alcohol[- ]?(removed|free)|dealcoholi[sz]ed|zero[- ]proof)\b", re.I)


def find_varietal(text):
    low = (text or "").lower()
    best = None
    for v in VARIETALS:
        i = low.find(v.lower())
        if i >= 0 and (best is None or len(v) > len(best[1]) or i < best[0] and len(v) == len(best[1])):
            best = (i, v)
    return best[1] if best else None


def find_color(text):
    low = (text or "").lower()
    if any(k in low for k in SPARK):
        return "sparkling"
    if "rosé" in low or re.search(r"\brose\b", low) or "rosado" in low or "rosato" in low:
        return "rosé"
    if "orange wine" in low or "skin contact" in low or "skin-contact" in low:
        return "orange"
    if any(k in low for k in ["port", "sherry", "dessert", "late harvest", "ice wine", "sauternes"]):
        if re.search(r"\b(port|sherry|dessert|late harvest|ice wine|sauternes)\b", low):
            return "dessert"
    r = any(re.search(r"\b" + re.escape(k), low) for k in RED)
    w = any(re.search(r"\b" + re.escape(k), low) for k in WHITE)
    if r and not w:
        return "red"
    if w and not r:
        return "white"
    if "red" in low:
        return "red"
    if "white" in low:
        return "white"
    return None


def is_wine(title, brand):
    low_t = (title or "").lower()
    low_b = (brand or "").lower()
    for b in NON_WINE_BRANDS:
        if b in low_b or b in low_t:
            return False, f"non-wine producer {b!r}"
    for k in NON_WINE:
        # spirit words followed by "barrel" describe barrel-aged wine (e.g. "Zinfandel Bourbon Barrel")
        if re.search(r"\b" + re.escape(k) + r"\b(?!\s+barrel)", low_t):
            return False, f"name mentions {k!r}"
    return True, None


def price_value(p):
    if not p:
        return None
    m = re.search(r"\$\s*([\d,]+(?:\.\d{1,2})?)", p)
    return float(m.group(1).replace(",", "")) if m else None


def strip_ref(href):
    return href.split("?")[0] if href else href


def load_jsonl(paths):
    rows = []
    for p in paths:
        with open(p, encoding="utf-8") as f:
            for i, line in enumerate(f, 1):
                line = line.strip()
                if line:
                    try:
                        rows.append(json.loads(line))
                    except json.JSONDecodeError as e:
                        print(f"WARN bad json {p}:{i}: {e}", file=sys.stderr)
    return rows


def main():
    tiles = load_jsonl([os.path.join(RAW, "tiles", "tiles.jsonl")])
    # wines found on other searches (e.g. the beer search), placed after the wine grid
    extra_path = os.path.join(RAW, "tiles", "extra_tiles.jsonl")
    extra_tiles = load_jsonl([extra_path]) if os.path.exists(extra_path) else []
    tiles = tiles + extra_tiles
    products = load_jsonl(sorted(glob.glob(os.path.join(RAW, "products", "*.jsonl"))))
    grid_summary = json.load(open(os.path.join(RAW, "tiles", "grid_summary.json"), encoding="utf-8"))

    # de-dupe tiles by ASIN keeping first grid position
    seen, uniq_tiles, dup_tiles = set(), [], []
    for t in sorted(tiles, key=lambda t: t["position"]):
        a = t["asin"].upper()
        if a in seen:
            dup_tiles.append(t)
            continue
        seen.add(a)
        uniq_tiles.append(t)
    # latest ok product record per ASIN
    prod = {}
    for p in products:
        a = (p.get("asin") or "").upper()
        if not a:
            continue
        if a not in prod or (p.get("status") == "ok" and prod[a].get("status") != "ok"):
            prod[a] = p

    wines, failures = [], []
    for n, t in enumerate(uniq_tiles, 1):
        a = t["asin"].upper()
        p = prod.get(a)
        rec_ok = bool(p and p.get("status") == "ok")
        title = (p or {}).get("h1") if rec_ok else None
        title_for_split = title or t.get("name")
        product_name, size, size_raw = split_name_size(title_for_split)
        bullets = (p or {}).get("bullets") or []
        cls = classify_bullets(bullets) if rec_ok else {k: None for k in
                                                        ["vineyard_location", "winemaking", "tasting_notes",
                                                         "pairing", "vintage", "other_notes"]} | {"label_facts": {}}
        brand = ((p or {}).get("brand") if rec_ok else None) or t.get("brand")
        price = ((p or {}).get("price") if rec_ok else None) or t.get("price")
        wine_flag, why_not = is_wine(title_for_split, brand)
        all_text = " ".join([title_for_split or "", " ".join(bullets)])
        abv = ABV_RE.search(all_text)
        if not rec_ok:
            failures.append({"asin": a, "position": t["position"], "href": strip_ref(t["href"]),
                             "reason": ((p or {}).get("error") or (p or {}).get("status") or
                                        ("product page not extracted" if wine_flag else
                                         "non-wine item: product page skipped by design"))})
        url_path = strip_ref(t["href"])
        page_alt = (p or {}).get("main_img_alt")
        image_check = {
            "level1_tile_img_alt": t.get("img_alt"),
            "level2_main_img_alt": page_alt,
            "same_product_id": bool(rec_ok and (p.get("asin") or "").upper() == a and
                                    a.lower() in (p.get("final_url") or "").lower()),
            "level2_alt_matches_title": bool(page_alt and title and page_alt.startswith(title)),
            "image_url": None,
            "image_url_note": "Not captured: the read-only browser view exposes no img src (tried the page "
                              "accessibility snapshot, a plain-text fetch, and dragging the image into a text "
                              "field). URLs were not guessed or built. The match is confirmed by product id (ASIN) "
                              "identity between grid tile and product page plus the page's main image label "
                              "matching its title.",
        }
        image_check["match_confirmed"] = image_check["same_product_id"] and image_check["level2_alt_matches_title"]
        wines.append({
            "scw_id": f"SCW{n}",
            "position": n,
            "grid_position": t["position"],
            "asin": a,
            "brand": brand,
            "vineyard": brand,
            "product_name": product_name,
            "size": size,
            "size_raw": size_raw,
            "price": price,
            "price_usd": price_value(price),
            "list_price": t.get("list_price") or ((p or {}).get("list_price") if rec_ok else None),
            "list_price_usd": price_value(t.get("list_price") or ((p or {}).get("list_price") if rec_ok else None)),
            "discount_note": t.get("discount_note"),
            "variants_note": t.get("variants_note"),
            "vineyard_location": cls["vineyard_location"],
            "winemaking": cls["winemaking"],
            "tasting_notes": cls["tasting_notes"],
            "pairing": cls["pairing"],
            "vintage": cls["vintage"],
            "other_notes": cls["other_notes"],
            "label_facts": cls["label_facts"],
            "varietal": find_varietal(all_text if rec_ok else title_for_split),
            "color": find_color(title_for_split) or find_color(" ".join(bullets)),
            "abv_pct": float(abv.group(1)) if abv and float(abv.group(1)) < 25 else None,
            "is_wine": wine_flag,
            "non_alcoholic": bool(NON_ALC_RE.search(title_for_split or "")),
            "non_wine_reason": why_not,
            "grid_title": f'{t.get("brand")} | {t.get("name")}',
            "page_title": title,
            "in_store_location": (p or {}).get("location_in_store") if rec_ok else None,
            "description_bullets": bullets,
            "other_sections": (p or {}).get("other_sections") or {},
            "url": "https://www.wholefoodsmarket.com" + url_path,
            "image": image_check,
            "extraction_status": "ok" if rec_ok else ("level2_missing" if wine_flag else "skipped_non_wine"),
        })

    only_wines = [w for w in wines if w["is_wine"]]
    fields = ["brand", "product_name", "size", "price", "vineyard_location", "winemaking",
              "tasting_notes", "pairing", "vintage", "other_notes", "varietal", "color"]

    def cov(rows):
        return {f: {"count": sum(1 for w in rows if w.get(f)),
                    "pct": round(100.0 * sum(1 for w in rows if w.get(f)) / max(len(rows), 1), 1)} for f in fields}

    report = {
        "generated": date.today().isoformat(),
        "grid": grid_summary,
        "tiles_captured": len(tiles),
        "extra_tiles_from_other_searches": [{"asin": t["asin"], "found_in": t.get("found_in")} for t in extra_tiles],
        "duplicate_tiles_dropped": [{"asin": d["asin"], "position": d["position"]} for d in dup_tiles],
        "unique_products": len(uniq_tiles),
        "level2_ok": sum(1 for w in wines if w["extraction_status"] == "ok"),
        "level2_failed": failures,
        "records": len(wines),
        "wines": len(only_wines),
        "non_wine_records": [{"asin": w["asin"], "title": w["page_title"] or w["grid_title"],
                              "reason": w["non_wine_reason"]} for w in wines if not w["is_wine"]],
        "image_match_confirmed": sum(1 for w in wines if w["image"]["match_confirmed"]),
        "field_coverage_wines_only": cov(only_wines),
        "field_coverage_all_records": cov(wines),
        "parity": {
            "unique_tiles == records": len(uniq_tiles) == len(wines),
            "wine_records == wine_level2_ok": sum(1 for w in wines if w["is_wine"]) ==
                sum(1 for w in wines if w["is_wine"] and w["extraction_status"] == "ok"),
            "wine_records == wine_image_match_confirmed": sum(1 for w in wines if w["is_wine"]) ==
                sum(1 for w in wines if w["is_wine"] and w["image"]["match_confirmed"]),
            "scw_files == records + 1 (SCW0)": None,
            "every_record_has_asin_url_price": all(w["asin"] and w["url"] and w["price"] for w in wines),
        },
    }
    doc = {
        "source": {"site": "https://www.wholefoodsmarket.com/grocery/search?k=wine",
                   "store_shown": grid_summary.get("store_shown"),
                   "heading_text": grid_summary.get("heading_text"),
                   "captured": date.today().isoformat()},
        "schema_version": 1,
        "count": len(wines),
        "wines": wines,
    }
    os.makedirs(os.path.join(DATA, "scw"), exist_ok=True)
    for f in glob.glob(os.path.join(DATA, "scw", "SCW*.json")):
        os.remove(f)
    with open(os.path.join(DATA, "wines.json"), "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    for w in wines:
        with open(os.path.join(DATA, "scw", f'{w["scw_id"]}.json'), "w", encoding="utf-8") as f:
            json.dump({"scw": w["scw_id"], "parent": "SCW0",
                       "kind": "wine_bottle" if w["is_wine"] else "non_wine_item", "record": w},
                      f, ensure_ascii=False, indent=1)
    scw0 = {"scw": "SCW0", "kind": "mcp_server_build",
            "description": "Build world for the Whole Foods wine MCP server; children SCW1..SCWn are one bottle each.",
            "children": [w["scw_id"] for w in wines], "dataset": "data/wines.json",
            "server": "server/wine_mcp_server.py", "coverage_report": "data/coverage_report.json"}
    with open(os.path.join(DATA, "scw", "SCW0.json"), "w", encoding="utf-8") as f:
        json.dump(scw0, f, ensure_ascii=False, indent=1)
    report["parity"]["scw_files == records + 1 (SCW0)"] = (
        len(glob.glob(os.path.join(DATA, "scw", "SCW*.json"))) == len(wines) + 1)
    with open(os.path.join(DATA, "coverage_report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=1)
    print(json.dumps({k: report[k] for k in ["tiles_captured", "unique_products", "level2_ok", "records",
                                             "wines", "image_match_confirmed", "parity"]}, indent=1))
    print("level2_failed:", len(failures), "non_wine:", len(report["non_wine_records"]))
    print(json.dumps({f: v["pct"] for f, v in report["field_coverage_wines_only"].items()}))


if __name__ == "__main__":
    main()
