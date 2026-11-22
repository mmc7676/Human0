"""Build the wine browser's data file from the MCP server's wines.json (wine records only)."""
import json, re, sys, collections

SRC, OUT = sys.argv[1], sys.argv[2]
doc = json.load(open(SRC))
wines = [w for w in doc["wines"] if w["is_wine"]]

COUNTRY_WORDS = [  # (regex, country) checked in order
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

def derive_country(w):
    lf = w.get("label_facts") or {}
    fields = [lf.get("country_of_origin"), lf.get("country_string"), lf.get("import"), lf.get("appellation"),
              w.get("vineyard_location"), w.get("product_name"), w.get("page_title")]
    for f in fields:
        if not f:
            continue
        t = str(f).lower()
        for rx, c in COUNTRY_WORDS:
            if re.search(rx, t):
                return c
    return None

def pct(note):
    m = re.match(r"(\d+)% off", note or "")
    return int(m.group(1)) if m else None

def vivino_fields(w):
    """Vivino summary for the page. Review texts stay in the server data; the page gets only the word cloud."""
    v = w.get("vivino") or {}
    status = v.get("match_status") or "not_searched"
    out = {"v_status": status}
    if status == "matched":
        page = v.get("page") or {}
        out.update(v_rating=v.get("rating"), v_count=v.get("ratings_count"), v_url=v.get("url"),
                   v_winery=page.get("page_winery"), v_winery_url=page.get("page_winery_url"),
                   v_title=page.get("page_h1"), v_reviews=v.get("reviews_counted", 0),
                   v_cloud=[[c["word"], c["count"]] for c in (v.get("word_cloud") or [])])
    return out


rows = []
for w in wines:
    rows.append({
        "id": w["scw_id"], "pos": w["grid_position"], "asin": w["asin"],
        "brand": w["brand"], "name": w["product_name"], "page_title": w["page_title"], "grid_title": w["grid_title"],
        "size": w["size"], "size_raw": w["size_raw"],
        "price": w["price_usd"], "list_price": w["list_price_usd"], "off_pct": pct(w["discount_note"]),
        "variants": w["variants_note"],
        "color": w["color"], "varietal": w["varietal"], "country": derive_country(w),
        "location": w["vineyard_location"], "abv": w["abv_pct"], "non_alcoholic": w["non_alcoholic"],
        "aisle": (w["in_store_location"] or "").replace("Located in ", "") or None,
        "vintage": w["vintage"], "winemaking": w["winemaking"], "tasting": w["tasting_notes"],
        "pairing": w["pairing"], "other": w["other_notes"], "label_facts": w["label_facts"] or {},
        "bullets": w["description_bullets"], "sections": w["other_sections"] or {}, "url": w["url"],
        **vivino_fields(w),
    })
rows.sort(key=lambda r: r["pos"])
with open(OUT, "w") as f:
    f.write("[\n" + ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in rows) + "\n]\n")
print("rows", len(rows), "country", collections.Counter(r["country"] for r in rows).most_common())
print("source", json.dumps(doc["source"]))
print("vivino", collections.Counter(r["v_status"] for r in rows), "rated", sum(1 for r in rows if r.get("v_rating") is not None),
      "with cloud", sum(1 for r in rows if r.get("v_cloud")))
