# Whole Foods cheese MCP server (Palm Desert, ZIP 92211)

Snapshot of the "cheese" search at Whole Foods Market
(https://www.wholefoodsmarket.com/grocery/search?k=cheese, and the same search sorted by price,
s=price-desc-rank), captured November 22, 2026, shown for delivery to 92211.

## What counts as a specialty cheese here
A cheese is kept when the store prices it per pound. That means it is sold by variable weight and
cut to order at the cheese counter, so the same cheese can come in different sizes. Fixed-price
packages on the shelf (sliced, shredded, cubed and pre-wrapped items) are left out, and so are
per-pound items that are sliced at the deli counter rather than cut from a wheel.

## Counts
- Search grid: 265 distinct products across both sorts.
- Kept, cut to order: 108 (SCW0 is the build world, SCW1..SCW108 one cheese each).
- Left out: 157, each with its reason in data/cheeses.json "excluded":
  151 fixed price per package, 5 sliced at the deli counter, 1 with no price shown (out of stock).
- The price-sorted pass reached every per-pound tile down to about $8/lb; below that only
  prepackaged items remained.
- Style: 20 cheddar and British, 12 semi-soft, 11 Alpine and Swiss, 11 soft-ripened, 10 Gouda and
  Dutch, 8 blue, 8 goat, 6 hard Italian, 5 Spanish, 4 washed rind, 4 hard and aged, 3 fresh and
  brined, 3 sheep, 3 other.
- Milk: 76 cow, 12 sheep, 10 goat, 1 mixed, 9 not stated. Country: 98 named, 10 not stated.

## What each record keeps
- name, brand and price exactly as the store grid shows them, with price_per_lb_usd, list price
  and discount
- sold_by ("per lb"), form, age in months where the name states it
- style_family, milk and country from a curated table keyed by ASIN; origin_basis says whether a
  protected name ("PDO name") or the maker ("producer") fixes the country. These are null where
  the name and maker do not make them certain.
- url of the store listing; image_url is null because the store did not expose photo addresses

## Run
    python3 server/cheese_mcp_server.py        # MCP over stdio
    python3 tests/test_stdio.py                # 24 checks
Rebuild: python3 build/build_cheese_dataset.py, then python3 ui/build_ui_cheese_data.py data/cheeses.json ui/cheeses.json
Tools: search_cheeses, get_cheese, list_cheeses, list_excluded, dataset_stats.
