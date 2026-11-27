#!/usr/bin/env python3
"""Group the Whole Foods wines in data/wines.json by producer for the Vivino winery lookup.
Keeps the idx of every producer already in raw/wineries/queue.json and appends new producers at the end,
so lookup records (raw/wineries/match_*.jsonl, keyed by idx) stay valid when the wine list grows."""
import json, os, re, collections, sys
ROOT = "/mnt/project-files/wholefoods-wine-mcp"
d = json.load(open(f"{ROOT}/data/wines.json"))
wines = [w for w in d["wines"] if w["is_wine"]]
# brand field -> producer name to search (only where the brand field is not the producer's plain name)
OVERRIDE = {
 "4457451-WRATH": ("Wrath", "brand field has a numeric prefix"),
 "Apothic Red Blend 2013": ("Apothic", "brand field includes wine name and year"),
 "アーガイル": ("Argyle", "brand field in Japanese; product name says Argyle"),
 "ドメーヌ・カーネロス": ("Domaine Carneros", "brand field in Japanese; product name says Domaine Carneros"),
 "フレイ ヴィンヤード": ("Frey Vineyards", "brand field in Japanese; product name says Frey"),
 "Frey": ("Frey Vineyards", None),
 "J Lohr Winery": ("J. Lohr", None), "J Lohr Wines": ("J. Lohr", None),
 "Chateau L'ermitage": ("Chateau Ducasse", "brand field Chateau L'ermitage, product is Chateau Ducasse Bordeaux Blanc; producer link unverified"),
 "Shawn Fine Wine": ("Domaine de la Patience", "brand field looks like a seller; product is Domaine de la Patience Rouge"),
 "Peshtera": ("Edoardo Miroglio", "brand field Peshtera, product says Edoardo Miroglio Wine Cellar"),
 "Melville Candy": ("Melville", "brand field has extra word"),
 "kingestate": ("King Estate", None),
 "Elizabeth Rose Designs": ("Elizabeth Rose", None),
 "Te Mata Estate 1896": ("Te Mata Estate", "1896 is a wine name"),
 "Castel Pujol Folklore": ("Castel Pujol", "Folklore is the wine line"),
 "Dominio De Eguren Protocolo": ("Dominio de Eguren", "Protocolo is the wine name"),
 "Bodega Noemia Patagonia": ("Bodega Noemia de Patagonia", None),
 "Erste e Neue": ("Erste + Neue", None),
 "Kermit Lynch": ("Kermit Lynch", "Kermit Lynch is an importer label; producer may be a Rhone grower"),
 "black box wine": ("Black Box", None), "bonanza wine": ("Bonanza", None),
 "Bodegas LAN, S.A.": ("Bodegas LAN", None), "Rabble": ("Rabble Wine Company", None),
 "TSG Consumer Partners": ("TSG Consumer Partners", "brand field is an investment firm; the Whole Foods page names no producer"),
}
SPLIT = {"silverlake wine": {"SCW123": ("Wonderwerk", "brand field silverlake wine (likely seller); label is Wonderwerk"),
                             "SCW182": ("VALRAVN", "brand field silverlake wine (likely seller); label is Valravn")}}
def key(s): return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()
groups = collections.OrderedDict()
for w in sorted(wines, key=lambda x: x["position"]):
    b = w["brand"]
    if b in SPLIT: name, note = SPLIT[b][w["scw_id"]]
    else: name, note = OVERRIDE.get(b, (b, None))
    k = key(name)
    g = groups.setdefault(k, {"producer": name, "brand_fields": [], "notes": [], "wines": []})
    if b not in g["brand_fields"]: g["brand_fields"].append(b)
    if note and note not in g["notes"]: g["notes"].append(note)
    g["wines"].append({"scw_id": w["scw_id"], "product_name": w["product_name"], "location": (w.get("vineyard_location") or "")[:60]})
QPATH = f"{ROOT}/raw/wineries/queue.json"
old = {g["key"]: g["idx"] for g in json.load(open(QPATH))} if os.path.exists(QPATH) else {}
nxt = max(old.values(), default=-1) + 1
q = []
for k, g in groups.items():
    if k in old:
        g["idx"] = old[k]
    else:
        g["idx"] = nxt; nxt += 1
        g["added"] = "2026-11-27"
    g["key"] = k
    if g["producer"] == "TSG Consumer Partners":
        g["skip_search"] = True
    q.append(g)
q.sort(key=lambda g: g["idx"])
lost = sorted(set(old) - set(groups))
json.dump(q, open(QPATH, "w"), ensure_ascii=False, indent=1)
print(len(q), "producers;", sum(len(g["wines"]) for g in q), "wines;", sum(1 for g in q if g.get("added")), "new;", "dropped keys:", lost)
