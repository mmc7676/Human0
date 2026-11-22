#!/usr/bin/env python3
"""Turn raw/vivino/fetch_*.jsonl (page reads by URL) into extract_f.jsonl (page reads by bottle).

Each fetch line is one Vivino wine page read (rating, rating count, h1, winery, grapes, region).
extract_queue.json maps each Vivino URL to the Whole Foods bottles that searched to it.
For every bottle this writes one extract line and checks, by name comparison, that the page is
the same producer (brand vs page winery/h1/URL slug) and the same wine (varietal and product words
vs page h1/grapes/URL slug). enrich_vivino.py only stores a rating when both checks pass.
"""
import glob
import json
import os
import re
import unicodedata

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RAW = os.path.join(ROOT, "raw", "vivino")

GENERIC = set("""wine wines winery vineyard vineyards vineyards cellars cellar estate estates the and de du la le les
di del della co company red white rose rosé blanc rouge bianco rosso tinto blanco sparkling still bottle ml
california usa us american from origin product of by""".split())
# Whole Foods product words that name the style, not the wine
STYLE = set("""red white rose blend wine dry sweet sparkling spumante organic natural vegan reserve""".split())
# label filler and place names: a Vivino title rarely repeats them
FILLER = set("""award winning abv screw cap bottle pack can cans new zealand napa valley sonoma county coast russian
river santa barbara ynez maria monterey arroyo seco paso robles central north south east west sicilia sicily
champagne rhone cotes france vin italy italia spain argentina chile australia oregon washington portugal
germany austria mendoza marlborough california""".split())
SYNONYMS = {"shiraz": "syrah", "pinot gris": "pinot grigio", "fume": "sauvignon blanc",
            "grenache": "garnacha", "pinot nero": "pinot noir", "rosé": "rose", "rosado": "rose", "rosato": "rose",
            "blanc de blancs": "white blanc de blancs", "bianco": "white bianco", "blanco": "white blanco",
            "rouge": "red rouge", "rosso": "red rosso", "tinto": "red tinto"}


def norm(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()
    for a, b in SYNONYMS.items():
        s = s.replace(a, b)
    return s


def tokens(s):
    return [t for t in re.findall(r"[a-z0-9]+", norm(s))]


def compact(s):
    return "".join(tokens(s))


def slug(url):
    m = re.search(r"/en/([^/]+)/w/\d+", url or "")
    return m.group(1).replace("-", " ") if m else ""


def producer_match(brand, page, product_name=""):
    b = compact(brand)
    hay = [compact(page.get("winery")), compact(page.get("h1")), compact(slug(page["url"]))]
    if b and any(b in h or (h and h in b and len(h) >= 4) for h in hay):
        return True, "brand found in page winery/title"
    bt = [t for t in tokens(brand) if t not in GENERIC and len(t) >= 3]
    words = set(tokens(page.get("winery")) + tokens(page.get("h1")) + tokens(slug(page["url"])))
    hit = [t for t in bt if t in words]
    if bt and len(hit) >= max(1, (len(bt) + 1) // 2):
        return True, "brand words %s on page" % hit
    w = compact(page.get("winery"))
    if w and len(w) >= 4 and w in compact(product_name):
        return True, "page winery %r named in the product name (brand field %r is the parent or importer)" % (
            page.get("winery"), brand)
    return False, "brand %r not on page (winery %r)" % (brand, page.get("winery"))


def wine_match(rec, page):
    words = set(tokens(page.get("h1")) + tokens(slug(page["url"])) + tokens(page.get("grapes")))
    brand = set(tokens(rec.get("brand")))
    place = set(tokens(rec.get("location"))) | set(tokens(page.get("region")))
    prod = [t for t in tokens(rec.get("product_name")) if t not in GENERIC and t not in STYLE
            and ((t not in FILLER and t not in place) or t in words) and t not in brand and t not in compact(rec.get("brand"))
            and len(t) >= 3 and not any(c.isdigit() for c in t)]
    if not prod and tokens(rec.get("product_name")) and set(tokens(rec.get("product_name"))) - brand <= STYLE | GENERIC:
        # product name is only a style ("Red Blend"); the page must show the same style word
        style = (set(tokens(rec.get("product_name"))) - brand) & {"red", "white", "rose"}
        if style and not style & words:
            return False, "style %s not on page" % sorted(style)
    note = "varietal and product words on page"
    var = [t for t in tokens(rec.get("varietal")) if t not in GENERIC]
    if var and not all(t in words for t in var) and not set(var) <= STYLE:
        # the Whole Foods varietal field is sometimes wrong; accept only if the product name
        # itself names what the page shows
        pn = set(tokens(rec.get("product_name")))
        hit = [t for t in prod if t in words]
        style_only = not prod and bool((pn - brand) & {"red", "white", "rose"} & words)
        if not (style_only or (prod and len(hit) * 2 >= len(prod) and pn & (words - brand))):
            return False, "varietal %r not on page" % rec.get("varietal")
        note = "Whole Foods varietal field %r differs; product name matches page" % rec.get("varietal")
    if prod:
        hit = [t for t in prod if t in words]
        if len(hit) * 2 < len(prod):
            return False, "product words %s mostly not on page (found %s)" % (prod, hit)
    return True, note


def main():
    queue = json.load(open(os.path.join(RAW, "extract_queue.json"), encoding="utf-8"))
    by_url = {e["vivino_url"]: e["wf_records"] for e in queue}
    pages = {}
    for p in sorted(glob.glob(os.path.join(RAW, "fetch_*.jsonl"))):
        for line in open(p, encoding="utf-8"):
            if line.strip():
                r = json.loads(line)
                if r["url"] not in pages or r.get("status") == "ok":
                    pages[r["url"]] = r
    out, stats = [], {"ok": 0, "verified": 0, "not_verified": 0, "page_error": 0}
    for url, recs in by_url.items():
        page = pages.get(url)
        if page is None:
            continue
        for rec in recs:
            line = {"scw_id": rec["scw_id"], "vivino_url": url, "status": page.get("status"),
                    "source": "page fetch (header and facts only)"}
            if page.get("status") != "ok":
                line["verify_note"] = "page fetch failed: " + str(page.get("status"))
                stats["page_error"] += 1
                out.append(line)
                continue
            stats["ok"] += 1
            pm, pn = producer_match(rec.get("brand"), page, rec.get("product_name"))
            wm, wn = wine_match(rec, page)
            wpath = page.get("winery_path")
            line.update(page_h1=page.get("h1"), page_winery=page.get("winery"),
                        page_winery_url=("https://www.vivino.com" + wpath) if wpath else None,
                        page_grapes=page.get("grapes"), page_region=page.get("region"), page_type=None,
                        rating=page.get("rating"), ratings_count=page.get("ratings_count"),
                        ratings_count_note=page.get("count_note"),
                        taste_based_on=None, taste_groups=[], reviews=[],
                        reviews_note="reviews not captured (page fetch reads header only)",
                        producer_match=pm, wine_match=wm, verify_note="; ".join([pn, wn]))
            stats["verified" if pm and wm else "not_verified"] += 1
            out.append(line)
    with open(os.path.join(RAW, "extract_f.jsonl"), "w", encoding="utf-8") as f:
        for line in out:
            f.write(json.dumps(line, ensure_ascii=False) + "\n")
    print(json.dumps(stats), "lines:", len(out))


if __name__ == "__main__":
    main()
