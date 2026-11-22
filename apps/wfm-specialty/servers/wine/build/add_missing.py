"""Append Whole Foods listings that the price-sorted sweep found but wines.json lacked.

Grid-only records: brand, name, size, price, list price and discount come from the
search tile; product-page fields stay empty (extraction_status = "grid_only").
Usage: python3 add_missing.py <sweep_missing.json> <wines.json> [--write]
"""
import json, os, re, sys, unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_dataset as B  # noqa: E402

EXTRA_NON_WINE = ["einstök", "einstok", "mojito", "brewing", "limoncello", "chambord", "tonic", "hop water", "boozy tea", "hard tea", "spirits",
                  "makku", "boochcraft", "lemonade", "agave", "aperitif liqueur", "schnapps",
                  "liquor", "tequila", "reposado", "anejo", "añejo", "blanco tequila", "gin & juice",
                  "vodka", "bitters"]
SKIP_ASINS = set()  # filled below for cheese
TAIL = re.compile(r'\s*((?:\d+ (?:Flavors?|Sizes?),? ?)+)?\s*(?:(\d+)% off )?\$([\d.,]+)(?: \$([\d.,]+))?\s*$')


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def _w(s):
    return slug(s).replace("-", " ")


# Tile text where the brand/title boundary can't be found mechanically: (text prefix, brand).
HAND_BRANDS = [("Balboa’s Tap House", "Balboa’s Tap House"), ("TSG Consumer Partners", "TSG Consumer Partners"),
               ("Basil Hayden's", "Basil Hayden's"), ("Belle Glos", "Belle Glos"),
               ("FLOWERS Vineyards & Winery", "Flowers Vineyards & Winery"), ("Kuleana Rum Works", "Kuleana Rum Works"),
               ("Bombay", "Bombay"), ("Educated Guess", "Educated Guess"),
               ("Gin & Juice by Dre and Snoop", "Gin & Juice by Dre and Snoop"), ("Sonoma Cutrer", "Sonoma-Cutrer"),
               ("Angels & Cowboys", "Angels & Cowboys"), ("Urban Bar", "Urban Bar"),
               ("McBride Sisters", "McBride Sisters"), ("Almanac BEER CO.", "Almanac Beer Co."),
               ("Giesen 0%", "Giesen"), ("Charles Smith Wines", "Charles Smith Wines"),
               ("Elysian Brewing Company", "Elysian Brewing Company"), ("Tres Volantes", "Tres Volantes"),
               ("Q Drinks", "Q Drinks"), ("WOLFFER ESTATE 2018,", "Wolffer Estate")]
NON_LATIN_LEAD = re.compile(r"^(?:[^\x00-\x7f]+\s*)+")


def split_brand(text, href, known):
    """Tile text is the brand followed by the grid title; the URL slug is the brand followed by
    the product-page title. Find where the brand ends."""
    for k, v in HAND_BRANDS:
        if text.startswith(k + " "):
            rest = text[len(k):].strip()
            if k.startswith("Giesen"):
                rest = "0% " + rest
            if k.startswith("WOLFFER"):
                rest = rest.replace("Wolffer Estate, ", "")
            return v, rest, "hand"
    lead = NON_LATIN_LEAD.match(text)
    if lead:  # brand written in another script, e.g. Japanese for Frey Vineyards
        rest = text[lead.end():]
        first = re.split(r"[ ,]", rest)[0]
        return first + " Vineyards" if first == "Frey" else first, rest, "non-latin"
    body = re.sub(r"-b[0-9a-z]{9}$", "", href.rsplit("/", 1)[-1]).split("-")
    words = text.split()
    nw = [_w(x) for x in words]
    # 1. brand repeated at the start of the grid title ("Veuve Clicquot Veuve Clicquot ...")
    for k in range(len(words) // 2, 0, -1):
        if " ".join(nw[:k]) == " ".join(nw[k:2 * k]) and " ".join(nw[:k]):
            return " ".join(words[:k]), " ".join(words[k:]), "repeat"
    # 2. leading all-caps run ("OREGON TRAILS WINE COMPANY Willamette ...")
    caps = 0
    for x in words:
        letters = re.sub(r"[^A-Za-z]", "", x)
        if len(letters) >= 2 and letters.isupper():
            caps += 1
        else:
            break
    if 0 < caps < len(words):
        return " ".join(words[:caps]), " ".join(words[caps:]), "caps"
    # 3. tile text and slug share the brand, then diverge
    flat = " ".join(nw).split()
    i = 0
    while i < len(flat) and i < len(body) and flat[i] == body[i]:
        i += 1
    if 0 < i < len(flat) and i < len(body):
        acc, k = 0, 0
        while k < len(words) and acc < i:
            acc += len(nw[k].split()); k += 1
        if acc == i:
            return " ".join(words[:k]), " ".join(words[k:]), "slug"
    # 4. a brand already in the data
    low = " ".join(nw)
    for b in sorted(known, key=len, reverse=True):
        if low.startswith(_w(b) + " "):
            k = len(_w(b).split())
            return " ".join(words[:k]), " ".join(words[k:]), "known"
    return words[0], " ".join(words[1:]), "first-word"


def red_hint(title):
    return "red" if re.search(r"\b(rosso|rouge|tinto|cannonau|ciliegiolo|montalcino|brunello)\b", title, re.I) else None


def classify(title, brand):
    ok, why = B.is_wine(title, brand)
    if not ok:
        return ok, why
    low = (title + " " + (brand or "")).lower()
    for k in EXTRA_NON_WINE:
        if re.search(r"\b" + re.escape(k) + r"\b", low):
            return False, f"name mentions {k!r}"
    return True, None


def main(miss_path, wines_path, write):
    miss = json.load(open(miss_path))
    data = json.load(open(wines_path))
    recs = data["wines"]
    have = {r["asin"] for r in recs}
    tmpl_image = dict(next(r["image"] for r in recs if r.get("image")))
    pos = max(r["position"] for r in recs)
    gpos = max(r["grid_position"] for r in recs)
    known = {r["brand"] for r in recs if r.get("brand")}
    added, skipped = [], []
    for t in miss:
        a = t["asin"]
        if a in have:
            continue
        m = TAIL.search(t["label"])
        if not m:
            skipped.append((a, t["label"], "no price tail (priced per lb, not a bottle)"))
            continue
        text = t["label"][: m.start()].strip(" ,")
        variants = m.group(1).strip(" ,") if m.group(1) else None
        off = m.group(2)
        price = float(m.group(3).replace(",", ""))
        lp = float(m.group(4).replace(",", "")) if m.group(4) else None
        brand, rest, how = split_brand(text, t["href"], known)
        # tile text repeats the brand at the start of the name ("Veuve Clicquot Veuve Clicquot ...")
        title = rest
        title = re.sub(r"\s*,\s*,", ",", title)
        title = re.sub(r"(\d+)\s*Milliliters?\b", r"\1 mL", title)
        title = re.sub(r"\b75 cl\b", "750 mL", title)
        name, size, size_raw = B.split_name_size(title)
        if not size:  # the URL slug carries the product-page title, which often states the size
            sm = re.search(r"-(\d+(?:-\d+)?)-(ml|l|fl-oz)(?:-|$)", t["href"])
            if sm:
                num = sm.group(1).replace("-", ".")
                size = B.norm_size(num, sm.group(2).replace("-", " "))
                pk = re.search(r"-(\d+)(?:pk|ct|-pack)-", t["href"])
                if pk:
                    size = f"{pk.group(1)} x {size}"
                size_raw = "from product URL"
        if re.search(r"\bcheese\b|cheddar", title, re.I):
            skipped.append((a, t["label"], "cheese"))
            continue
        wine_flag, reason = classify(f"{brand or ''} {title}", brand)
        na = bool(B.NON_ALC_RE.search(title) or re.search(r"(?<![\d.])0%", title))
        pos += 1
        gpos += 1
        img = dict(tmpl_image)
        img.update({"level2_main_img_alt": None, "same_product_id": None, "level2_alt_matches_title": None,
                    "image_url": None, "match_confirmed": False})
        rec = {
            "scw_id": f"SCW{pos}", "position": pos, "grid_position": gpos, "asin": a,
            "brand": brand, "vineyard": brand, "product_name": name, "size": size, "size_raw": size_raw,
            "price": f"${price:,.2f}", "price_usd": price,
            "list_price": f"${lp:,.2f}" if lp else None, "list_price_usd": lp,
            "discount_note": f"{off}% off" if off else None, "variants_note": variants,
            "vineyard_location": None, "winemaking": None, "tasting_notes": None, "pairing": None,
            "vintage": None, "other_notes": None, "label_facts": {},
            "varietal": B.find_varietal(title) if wine_flag else None,
            "color": (B.find_color(title) or red_hint(title)) if wine_flag else None,
            "abv_pct": None, "is_wine": wine_flag, "non_alcoholic": na, "non_wine_reason": reason,
            "grid_title": f"{brand} | {title}" if brand else title, "page_title": None,
            "in_store_location": None, "description_bullets": [], "other_sections": {},
            "image": img, "extraction_status": "grid_only",
            "url": "https://www.wholefoodsmarket.com" + t["href"], "vivino": None,
        }
        rec["_how"] = how
        for k in recs[0]:
            rec.setdefault(k, None)
        added.append(rec)
    for r in added:
        print(r.pop("_how"), end=" ")
        print(f"{'W' if r['is_wine'] else '-'} {str(r['color']):9} {r['brand']!s:28} | {r['product_name']} | {r['size']} | {r['price']} | {r['non_wine_reason'] or ''}")
    for s in skipped:
        print("SKIP", s)
    print("added", len(added), "wine", sum(r["is_wine"] for r in added), "skipped", len(skipped))
    if write:
        recs.extend(added)
        data["count"] = len(recs)
        data["source"].update({
            "site": "https://www.wholefoodsmarket.com/grocery/search?k=wine&s=price-desc-rank",
            "heading_text": "503 results for \"wine\" (sorted by price, high to low, all tiles loaded)",
            "captured": "2026-11-22",
            "sweep_note": "The default relevance sort repeats tiles (501 tiles, 405 unique). The "
                          "price-sorted list was loaded to the end and every product was checked against "
                          "this file; missing ones were added as grid_only records.",
        })
        json.dump(data, open(wines_path, "w"), ensure_ascii=False, indent=1)
        print("wrote", wines_path, len(recs))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], "--write" in sys.argv)
