# Whole Foods beer MCP server (Palm Desert, ZIP 92211)

Snapshot of the "beer" search at Whole Foods Market (https://www.wholefoodsmarket.com/grocery/search?k=beer),
captured November 20, 2026 and completed from the full price-sorted listing on November 22, 2026,
shown for delivery to 92211.

## Counts
- Search grid: 290 tiles, 215 distinct products (site heading: "More than 294 results").
- Set aside as not beer: 22 (ginger beer and ginger ale, root beer, mocktails, hop water, 2 wines). The two wines are on the Wine page; sake and makgeolli are kept here as "Sake & rice wine" (Nov 20 rule: keep anything with alcohol, plus non-alcoholic beer and wine). Listed in raw/tiles/non_beer.json and in data/beers.json "skipped_non_beer".
- Product pages read: 193 of 193, all on the 92211 store (extraction_status "page").
- Added Nov 22 from the price-sorted sweep: 65 drinks as grid_only records (name, brand, pack, size, price and discount from the search tile; ABV only where the tile or product URL states it). 13 more non-beer items set aside.
- Records: 258 (SCW0 is the build world). Set aside as not beer: 35. Backup of the Nov 20 file: data/beers.before-sweep-2026-11-22.json.
- Kinds: 224 beer, 9 hard cider, 9 hard kombucha, 8 hard seltzer, 5 sake and rice wine, 2 hard tea, 1 other hard drink. 30 non-alcoholic.

## How the count went from 193 to 258
The default "beer" search repeats tiles, so 290 tiles held only 215 products. On Nov 22 the
price-sorted search (s=price-desc-rank) was loaded to the end: 240 products. 151 were already
records and 11 already set aside; the other 78 went through build/add_missing_beer.py with the
Nov 20 rule, which kept 65 and set aside 13 (sodas, ginger ale and ginger beer, root beer, hop
water, hop tea, a non-alcoholic functional seltzer). Records already in data were left as they were.

## What each record keeps separate
- pack_count (from the page title first, then the selected size, then the grid tile)
- container (Can or Bottle) and container_fl_oz, with the size as written
- flavor_selected and flavor_options, size_selected and size_options (each option links to its own record when it is in the data)
- price, price per container and price per fl oz; ABV with its source text; ingredients and description verbatim

## Known data issues (data/coverage_report.json "problems")
- ABV differs between title and description on 4 listings (title value used, both kept).
- One listing writes 355 mL as "355 FZ"; read as 12 fl oz and flagged.
- 3 listings name no can or bottle; 2 name no style (Pliny the Elder, Clausthaler Original).
- Grid-only records (65) have no description, ingredients, calories or store aisle; 11 of them name no can or bottle, 41 state no ABV.
- Country is stated on only 35 of 258 records; the rest is null rather than guessed.

## Run
    python3 server/beer_mcp_server.py          # MCP over stdio
    python3 tests/test_stdio.py                 # 22 checks
    python3 tests/test_ui_parity.py             # page filter counts == Python counts
Rebuild: python3 build/build_dataset.py, then python3 build/add_missing_beer.py raw/tiles/sweep_missing_2026-11-22.json data/beers.json --write
(the first step alone drops the Nov 22 additions), then python3 ui/build_ui_beer_data.py data/beers.json ui/beers.json
Tools: search_beers, get_beer, list_beers, get_variants, dataset_stats. Resource: beers://dataset.
