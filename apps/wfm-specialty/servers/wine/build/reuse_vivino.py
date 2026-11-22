"""Find new wines whose exact wine already has a confirmed Vivino match under another listing
(another size or pack of the same wine). Same producer and the same wine words, ignoring size,
pack and filler; anything looser is left for a fresh search."""
import json, re, sys, unicodedata
FILL = set("""wine wines bottle can cans single pack ml l oz fl x abv
the a and de of organic california usa""".split())

def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\d+(\.\d+)?\s*(ml|l|oz|fl oz|%|x)\b", " ", s)
    return [t for t in re.findall(r"[a-z]+", s) if t not in FILL]

def key(w):
    b = norm(w["brand"])
    n = [t for t in norm(w["product_name"]) if t not in b]
    return " ".join(b), frozenset(n)

d = json.load(open(sys.argv[1]))
old = [w for w in d["wines"] if w["is_wine"] and (w.get("vivino") or {}).get("match_status") == "matched"]
idx = {}
for w in old:
    idx.setdefault(key(w), []).append(w)
new = [w for w in d["wines"] if w["is_wine"] and w.get("extraction_status") == "grid_only"]
hits = {}
for w in new:
    k = key(w)
    if k in idx and k[1]:
        src = idx[k][0]
        hits[w["scw_id"]] = src["scw_id"]
        print(w["scw_id"], w["product_name"], w["size"], "<=", src["scw_id"], src["product_name"], src["size"], src["vivino"]["url"])
print(len(hits))
json.dump(hits, open(sys.argv[2], "w"), indent=0)
