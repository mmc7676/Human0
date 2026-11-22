"""Make the level-2 queue from the grid tiles: one entry per unique ASIN in grid order,
leaving out the non-beer drinks the "beer" search also returns (sodas, mixers, mocktails, wine, sake, rice wine)."""
import json, os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
# ASINs checked by hand against tile brand + name (Nov 20, 2026); reason kept for the coverage report.
NON_BEER = {
    "B0988MCTNT": "ginger beer soda", "B085LV5W5F": "ginger beer soda", "B085LVF5FV": "ginger beer soda",
    "B01M0XCCXG": "ginger beer soda", "B08V6JGG48": "ginger beer soda", "B07FYJQ45M": "ginger ale mixer",
    "B0BNZKTN5J": "cocktail mixer", "B0DCLC2CGL": "root beer soda", "B0BCLDGL4L": "root beer soda",
    "B0FZXSV2RQ": "root beer soda", "B0HFNTF6TG": "root beer kombucha soda", "B09G9B91J3": "root beer soda",
    "B0BCLGZ9GZ": "root beer soda", "B084PVD85Q": "root beer soda", "B09XT46ZJN": "root beer soda",
    "B09XTLXPWY": "root beer soda", "B0G6MRWD7L": "non-alcoholic margarita mocktail",
    "B0FQ388P78": "non-alcoholic mocktail", "B0CSRKRT4L": "non-alcoholic tea mocktail",
    "B0BPMS49KB": "sparkling hop water", "B084HHMM72": "wine", "B07GVW2424": "wine",
}
tiles = [json.loads(l) for l in open(os.path.join(ROOT, "raw/tiles/tiles.jsonl"))]
seen, queue = set(), []
for t in tiles:
    if t["asin"] in seen:
        continue
    seen.add(t["asin"])
    if t["asin"] in NON_BEER:
        continue
    queue.append({"asin": t["asin"], "href": t["href"].split("?")[0], "position": t["position"]})
json.dump(queue, open(os.path.join(ROOT, "raw/products/queue.json"), "w"), indent=1)
json.dump(NON_BEER, open(os.path.join(ROOT, "raw/tiles/non_beer.json"), "w"), indent=1)
print("unique", len(seen), "queued", len(queue), "non_beer", len(NON_BEER))
