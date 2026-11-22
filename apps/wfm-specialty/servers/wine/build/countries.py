"""One country rule for the wine server data and the page.

1. The Whole Foods listing's own text (label facts, location, name, title).
2. Otherwise the region on the matched Vivino page, only for wines whose Vivino match passed the
   match rule (match_status "matched"). Low-confidence matches are not used.
A region that could be in more than one country (for example "Central Valley", which is both in
California and in Chile) gives no country.
"""
import re

COUNTRY_WORDS = [  # (regex, country) checked in order on Whole Foods text
    (r"\bnew ?zealand\b|marlborough", "New Zealand"),
    (r"\bfrance\b|champagne|bordeaux|beaujolais|sancerre|c[oô]tes? d[ue] rh[oô]ne|\brh[oô]ne\b|provence|loire|bourgogne|burgundy|languedoc|cr[eé]mant", "France"),
    (r"\bitaly\b|piemonte|piedmont|tuscany|toscana|chianti|barolo|prosecco|veneto|sicil", "Italy"),
    (r"\bspain\b|rioja|cava\b|castilla", "Spain"),
    (r"\bportugal\b|vinho verde|douro", "Portugal"),
    (r"\bargentina\b|mendoza", "Argentina"),
    (r"\bchile\b", "Chile"),
    (r"\baustralia\b|barossa", "Australia"),
    (r"\baustria\b", "Austria"),
    (r"\bgermany\b|mosel", "Germany"),
    (r"\bsouth africa\b", "South Africa"),
    (r"\bgreece\b", "Greece"),
    (r"a/o world", "Multiple countries"),
    (r"\busa\b|united states|\bamerican?\b|california|\bca\b|oregon|washington|napa|sonoma|paso robles|mendocino|monterey|columbia valley|central coast|lodi|santa barbara|\bdomestic\b|a/o usa", "United States"),
]

# Vivino region text -> country. Vivino writes "Country / Region / Subregion", or sometimes only the region.
COUNTRY_NAMES = {"united states": "United States", "france": "France", "italy": "Italy", "spain": "Spain",
                 "portugal": "Portugal", "argentina": "Argentina", "chile": "Chile", "australia": "Australia",
                 "austria": "Austria", "germany": "Germany", "south africa": "South Africa", "greece": "Greece",
                 "new zealand": "New Zealand", "mexico": "Mexico", "uruguay": "Uruguay", "hungary": "Hungary",
                 "bulgaria": "Bulgaria", "israel": "Israel", "lebanon": "Lebanon", "georgia": "Georgia"}
REGION_COUNTRY = [
    (r"california|napa|sonoma|paso robles|russian river|carneros|rutherford|livermore|suisun|knights valley|"
     r"north coast|central coast|mendocino|monterey|arroyo seco|santa ynez|santa barbara|sta\.? rita|contra costa|"
     r"lake county|lodi|alexander valley|oregon|willamette|dundee hills|columbia valley|washington", "United States"),
    (r"vin de france|champagne|bordeaux|bourgogne|burgundy|beaujolais|m[aâ]con|alsace|loire|rh[oô]ne|"
     r"ch[aâ]teauneuf|provence|luberon|languedoc|coteaux|cr[eé]mant", "France"),
    (r"veneto|prosecco|barbera|chianti|sicilia|siciliane|lambrusco|alto adige|s[uü]dtirol|piemonte|toscana", "Italy"),
    (r"pened[eè]s|rioja|jumilla|castilla", "Spain"),
    (r"marlborough|hawke'?s bay", "New Zealand"),
    (r"victoria|barossa|mclaren", "Australia"),
    (r"mendoza|r[ií]o negro", "Argentina"),
    (r"apalta|san antonio valley|colchagua|maipo|casablanca", "Chile"),
    (r"nieder[oö]sterreich|wagram", "Austria"),
    (r"valle de guadalupe", "Mexico"),
]


def from_whole_foods(w):
    lf = w.get("label_facts") or {}
    for f in [lf.get("country_of_origin"), lf.get("country_string"), lf.get("import"), lf.get("appellation"),
              w.get("vineyard_location"), w.get("product_name"), w.get("page_title")]:
        if not f:
            continue
        t = str(f).lower()
        for rx, c in COUNTRY_WORDS:
            if re.search(rx, t):
                return c
    return None


def from_vivino(w):
    v = w.get("vivino") or {}
    if v.get("match_status") != "matched":
        return None
    region = ((v.get("page") or {}).get("page_region") or "").strip()
    if not region:
        return None
    first = region.split("/")[0].strip().lower()
    if first in COUNTRY_NAMES:
        return COUNTRY_NAMES[first]
    t = region.lower()
    for rx, c in REGION_COUNTRY:
        if re.search(rx, t):
            return c
    return None


def country_of(w):
    """(country, source) where source is "whole_foods_text", "vivino_region" or None."""
    c = from_whole_foods(w)
    if c:
        return c, "whole_foods_text"
    c = from_vivino(w)
    if c:
        return c, "vivino_region"
    return None, None


def apply(doc):
    """Write country and country_source onto every wine record. Returns counts by source."""
    counts = {"whole_foods_text": 0, "vivino_region": 0, None: 0}
    for w in doc["wines"]:
        if not w.get("is_wine"):
            w["country"], w["country_source"] = None, None
            continue
        w["country"], w["country_source"] = country_of(w)
        counts[w["country_source"]] += 1
    return counts


if __name__ == "__main__":
    import json, sys
    path = sys.argv[1]
    doc = json.load(open(path, encoding="utf-8"))
    print(apply(doc))
    if "--write" in sys.argv:
        json.dump(doc, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("wrote", path)
