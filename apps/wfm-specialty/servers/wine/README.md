# Whole Foods Wine MCP Server

An MCP server (stdio, JSON-RPC 2.0) that serves every wine listed at
https://www.wholefoodsmarket.com/grocery/search?k=wine for the store shown as
"Delivering to 92211", captured November 19, 2026 and completed November 22, 2026. It is the wine component of
the wine and cheese pairing app.

The server uses only the Python standard library (Python 3.9 or newer). Nothing
needs to be installed to run it.

## What is in the dataset

- 472 wines. 362 have a level 2 product page captured (tasting notes, pairing,
  winemaking, location, label facts). 110 were added on November 22, 2026 from the
  full price-sorted listing with list-page fields only (brand, name, size, price,
  list price, discount, URL) and `extraction_status: "grid_only"`.
- 85 non-wine items that the search returns (spirits, sake, beer, cider,
  cocktails, vinegar, cheese, coffee) are kept as records but flagged
  `is_wine: false` and hidden from every tool unless `include_non_wine: true`.
- 557 records in total, one per unique product (ASIN). A backup of the file
  before the November 22 additions is `data/wines.before-sweep-2026-11-22.json`.

Each wine record has these fields:

| Spec item | Field(s) |
|---|---|
| a) Vineyard | `vineyard` (same as `brand`) |
| b) Product name and size | `product_name`, `size` (normalized: `750 mL`, `1.5 L`, `4 x 250 mL`), `size_raw` |
| c) Price | `price` (as shown), `price_usd` (number), `list_price`, `list_price_usd`, `discount_note` |
| d) Description header | not stored |
| e) Vineyard location | `vineyard_location` |
| f) How the wine was made | `winemaking` |
| g) Taste, flavor, palate | `tasting_notes` |
| h) Pairing | `pairing` (food-pairing sentences only) |
| i) Vintage | `vintage` |

Extra fields: `scw_id`, `asin`, `url`, `varietal`, `color`, `abv_pct`,
`non_alcoholic`, `label_facts` (structured "Type of Wine", "Country of Origin"
and similar lines), `other_notes` (awards, serving tips, package details),
`description_bullets` (the original text, verbatim), `in_store_location`,
`image` (the image match check, below).

Field coverage across the 361 wines captured with product pages on November 19 (share with a non-empty value):

| Field | Coverage |
|---|---|
| vineyard / brand | 100.0% |
| product_name | 100.0% |
| price | 100.0% |
| color | 99.4% |
| size | 98.9% |
| varietal | 91.4% |
| vineyard_location | 77.6% |
| tasting_notes | 45.7% |
| other_notes | 43.2% |
| pairing | 36.3% |
| winemaking | 32.7% |
| vintage | 19.9% |

The lower numbers reflect the site's descriptions: many are one or two lines
and do not mention winemaking, pairing or vintage. Four wines have an empty
Description on the site (B0DLKRRQM7, B0DLKSMCDK, B0C9DSBS6B, B0G1STZ64J).

## Images

`image.image_url` is `null` for every record. The browser used for the capture
exposes no image source address, and image addresses were not guessed or built
from the product ID. The tile-to-page image match is still checked for every
wine: `image.same_product_id` (grid tile and product page share the ASIN and
URL) and `image.level2_alt_matches_title` (the page's main image label matches
its title). `image.match_confirmed` is true for 361 of 361 wines from the November 19 build; grid_only records carry `match_confirmed: false`.

## SCW0 and SCW1..SCW405

Maxey0 returned "SCW limit reached", so the SCWs are stored as files:

- `data/scw/SCW0.json`: the build world for this server, listing its children.
- `data/scw/SCW1.json` .. `data/scw/SCW405.json`: one per product, with
  `parent: "SCW0"`, `kind: "wine_bottle"` (472) or `"non_wine_item"` (85), and
  the full record.

## How the count went from 361 to 472

- The 92211 search page said "More than 512 results", but the grid stopped at
  501 tiles when Load More disappeared after 18 loads. The 11 tiles the site
  never served cannot be identified, so no missed wine can be named.
- The 501 tiles hold 96 repeat tiles, leaving 405 unique products.
- 44 of those are not wine, leaving 361 wines.
- One more wine, Stags' Leap Winery Cabernet Sauvignon (B084HHMM72), turned up only on the beer search and was added on Nov 20, 2026 from raw/tiles/extra_tiles.jsonl, for 362 wines. It has no Vivino search yet. Its site description mentions apricot and pear, as written on the site.

- November 22, 2026: the default "wine" search repeats tiles, so it never shows
  every product. The same search sorted by price, high to low
  (`?k=wine&s=price-desc-rank`, heading "503 results") was loaded to the end, 505
  unique products in all. 353 were already here. Of the 152 that were missing, 110
  are wine and were added; 41 are spirits, beer, ready-to-drink cocktails,
  kombucha, makgeolli or mixers and were added as `is_wine: false`; one is a cheese
  sold by the pound and was left out. The script is `build/add_missing.py`.
- The 110 new wines got a Vivino pass on Nov 22 and 23, 2026 (`build/merge_vivino_2026_11_22.py`,
  inputs in raw/vivino/): 4 reuse the match of the same wine in another bottle size, and of the
  106 others, 88 matched (87 with a rating), 7 were held back as low confidence with no rating,
  10 were not found, and 1 was not searched because the listing gives no producer
  (`match_status: "not_searched"`). Each wine was searched on its own, one at a time.
- Word clouds for those 88 matches come from the "Wine lovers taste summary" on each Vivino wine
  page: every flavor keyword is sized by its group's mention count, and `taste_summary` keeps the
  groups and how many reviews they are based on (`word_cloud_source: "vivino_taste_summary"`).
  Vivino's reviews feed refused the browser, so no review text was read. 82 have a cloud; 6 pages
  show no taste summary, so those wines have none. Keywords that Vivino cut short were left out.
- Country comes from the Whole Foods text first, then from the Vivino region for matched wines
  only (`country_source`), via `build/countries.py`.

`data/coverage_report.json` holds the checks from the November 19 build.

## Vivino ratings and word clouds

Captured November 19, 2026 from vivino.com public pages (no sign-in). Each of the 361 wines from that build carries a `vivino` field; wines added later got theirs on Nov 22 and 23 (above). Items that are not wine carry `vivino: null`.

- **Match:** 312 matched, 42 low confidence, 7 not found. A match needs the Vivino page's producer and wine name to agree with the Whole Foods listing; low-confidence records keep a `reason` and show no rating or cloud.
- **Rating:** the average and ratings count shown on the Vivino page header. 306 matched wines have one; 6 matched wines show no average on Vivino and stay null. No rating is estimated.
- **Word cloud:** descriptor terms (flavor, texture, style, value, occasion) counted across up to 10 of the most recent English reviews per wine, capped at 10 by design. Only term counts and the number of reviews counted are stored; no review text, user name or profile detail is kept. A term is kept only if it appears in Vivino's raw review JSON for that wine. 310 matched wines have a cloud. Wines rated Nov 22 and 23 use the taste-summary cloud described above, for 392 rated wines with a cloud in all.
- **Tools:** `list_wines` takes `min_rating`, `has_vivino` and `sort=rating_desc`; `get_vivino` returns one wine's Vivino record.
- **Rebuild:** `build/parse_fetch_agents.py`, then `build/vivino_fetch_to_extract.py`, `build/enrich_vivino.py`, `build/merge_vivino_2026_11_22.py` (which runs `build/standardize_vivino.py` at the end), `build/countries.py data/wines.json --write`, and `ui/build_ui_data.py data/wines.json ui/wines.json`. Winery profiles: `build/make_winery_queue.py`, `build/build_wineries.py`, then the same `ui/build_ui_data.py` (it reads `data/wineries/` too); see `data/wineries/INTEGRATION.md`.

## Vivino record layout (schema v2, Nov 26, 2026)

Every wine's `vivino` block has the same fields, whichever pass wrote it; `data/wines.json` lists them under `vivino_schema`. `build/standardize_vivino.py` enforces this and is safe to rerun.

- A field the pass did not record is `null`; `word_cloud` is `[]` when empty, and `page` always has its six fields.
- `word_cloud_source` is `vivino_reviews` (Nov 19 review terms), `vivino_taste_summary` (Nov 22 taste summary) or `null`.
- `taste_summary` is `null` when none was captured, else `{based_on_reviews, groups}`. Each group has `group`, `group_source`, `keywords` (always a list), `keywords_truncated` and `mentions`.
- `group_source` is `vivino_page` for the 62 groups whose name was saved from the page (Nov 19). The Nov 22 pass saved keywords without group names, so 924 groups were named by keyword match against those page groups (`keyword_lookup`, an inference, not read from the page). 10 groups matched nothing and keep `group: null`.
- `keywords_truncated` is true or false for Nov 19 and `null` for Nov 22, where it was not recorded.
- The standardization changed no rating, match, cloud or page value; the app's data file came out identical.

## Install and run

1. Unzip `wholefoods-wine-mcp.zip`. This creates the folder
   `wholefoods-wine-mcp/`.
2. Check Python:

   ```
   python3 --version
   ```

   Expected: `Python 3.9` or newer.
3. Run the end-to-end test from inside the folder:

   ```
   cd wholefoods-wine-mcp
   python3 tests/test_stdio.py
   ```

   Expected last line: `ALL 20 CHECKS PASSED`.
4. Add the server to Claude Desktop. Open the config file
   (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`,
   Windows: `%APPDATA%\Claude\claude_desktop_config.json`) and add this entry
   under `mcpServers`, replacing the path with the full path to your unzipped
   folder:

   ```json
   {
     "mcpServers": {
       "wholefoods-wine": {
         "command": "python3",
         "args": ["/FULL/PATH/TO/wholefoods-wine-mcp/server/wine_mcp_server.py"]
       }
     }
   }
   ```

   On Windows use `"command": "python"` and a path like
   `"C:\\Users\\you\\wholefoods-wine-mcp\\server\\wine_mcp_server.py"`.
5. Restart Claude Desktop. The tools below appear under "wholefoods-wine".

For Claude Code:

```
claude mcp add wholefoods-wine -- python3 /FULL/PATH/TO/wholefoods-wine-mcp/server/wine_mcp_server.py
```

To serve a different dataset file, set `WINE_DATA` to its path.

Optional SDK client test (needs `pip install mcp`):

```
python3 tests/test_sdk_client.py
```

Expected last line: `SDK CLIENT TEST PASSED`.

## Tools

| Tool | What it does |
|---|---|
| `search_wines` | Free-text search over name, brand, varietal, location, winemaking, tasting, pairing and vintage, with filters |
| `get_wine` | One wine by `asin` or `scw_id` |
| `list_wines` | Page through wines (`offset`, `limit` up to 200, `sort`: position, price_asc, price_desc, brand) |
| `wines_by_pairing` | Wines whose pairing text matches a food (for the cheese side of the app) |
| `dataset_stats` | Counts, coverage and wines by color |
| `get_vivino` | One wine's Vivino record by `asin` or `scw_id` |
| `get_winery` | One Vivino winery profile by `slug`, or by a wine's `asin` or `scw_id` (`include_links` adds the recorded winery-page links) |
| `list_wineries` | Wineries filtered by `query`, `country`, `region`, `min_rating`; `sort`: name, rating_desc, wf_wines_desc |
| `wines_by_winery` | The Whole Foods wines made by one winery |
| `winery_stats` | Winery coverage: producers, match buckets, files and wines linked |

The winery tools read `data/wineries/` (override with `WINERY_DATA`) and show matched wineries only unless `include_low_confidence` is true. See `data/wineries/INTEGRATION.md`.

Filters shared by the search and list tools: `varietal`, `region`, `brand`,
`color` (red, white, rosé, sparkling, dessert, orange, other), `size`,
`min_price`, `max_price`, `include_non_wine`.

Resource: `wines://dataset` (the whole dataset as JSON).

## Rebuilding the dataset

The raw captures are in `raw/` (grid tiles in `raw/tiles/`, product pages in
`raw/products/batch_*.jsonl`). To rebuild `data/` from them:

```
python3 build/build_dataset.py
```

## Known data quirks (as shown on the site)

- Some brands are in Japanese, for example フレイ ヴィンヤード and アーガイル.
- Some wines show "Located in Beer" as their in-store location.
- B00BF0OH5I (Frog's Leap Sauvignon Blanc) carries a description for a
  different product on the site.
- Site typos are kept as written in `description_bullets`.
- Prices are for the 92211 store on November 19, 2026 and will change.
