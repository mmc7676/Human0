# Winery profiles (Vivino): integration note

Captured November 19, 2026. Built by `build/build_wineries.py` from `raw/wineries/` (queue + lookup records).
This folder is self-contained and does not change `data/wines.json` or `data/scw/*`. Since November 27, 2026 the server and the Wine Browser page read it (see below).

## How it was captured

- Root: https://www.vivino.com/en/wineries (222,366 wineries, 25 per page). The root was read once to learn its structure and was **not paged through**.
- Each Whole Foods producer was looked up **directly**: a web search restricted to vivino.com, and where search returned only a wine page, the winery link on that wine page.
- Each winery page (`/en/wineries/<slug>`) was fetched **once** (depth 1). The links on it (depth 2) were **recorded, not fetched**.
- robots.txt was respected: `/wineries/*/most_popular_vintages`, `/reviews/` and `/users` were never visited. No sign-in, no bot checks met.
- Dropped on purpose: phone numbers, email addresses (mailto/tel), user reviews and user names.
- Only page 1 of each winery's wine list is recorded (Vivino shows about 12 wines per page; `profile.wine_list_pages` gives the pager size when shown).

## Files

- `wineries.json`: the LINKTREE result plus indexes.
  - Contract fields: `root`, `startedAt`, `finishedAt`, `config`, `stats`, `warnings`, `nodes` (depth 0 root, depth 1 winery pages with status `fetched`, depth 2 links with status `listed, not fetched`), `edges` (`tree` and `cross`), `tree`, `outline` (markdown).
  - `wineries[]`: one summary row per winery page (name, URL, file, match status and confidence, country, region, avg rating, ratings count, wines count, Whole Foods wine ids).
  - `buckets`: `matched`, `low_confidence`, `not_found`, `fetch_failed`, `not_searched`, each listing the producer, its brand-field spellings and its Whole Foods wine ids.
  - `wine_to_winery`: Whole Foods `scw_id` -> `{vivino_winery_url, match_status, confidence}`.
- `<slug>.json`: one profile per winery page (matched and low-confidence only). Fields:
  - `vivino_winery_url`, `winery_slug`, `vivino_winery_id` (only when a winery-specific "See all" link carried it; otherwise null, with the id seen in page metadata noted in `warnings`)
  - `match_status` (`matched` | `low_confidence`), `match_confidence` (`high` | `medium` | `low`), `found_via` (`search_winery` | `wine_page`), `search_queries`, `verify_note`
  - `profile`: `name`, `badges`, `wines_count`, `avg_rating`, `ratings_count`, `country`, `country_url`, `region`, `region_url`, `owned_by`, `website_url` (tracking params stripped), `social_urls`, `founded`, `winemaker` (only when the page states them), `description_summary` (a short paraphrase, not a quote), `wine_list_pages`, `see_all_url`
  - `wines_on_page[]`: `{name, url, vivino_wine_id}` from page 1 of the winery's list
  - `links_level2[]`: every winery-specific link on the page, `{url, text, kind}` with kind `wine` | `region` | `country` | `explore` | `website` | `social` | `other`
  - `producers[]`: the Whole Foods producer name(s) that resolved to this page, their raw brand fields and any normalization note (for example a Japanese-language brand field, or a brand field that is a seller rather than the producer)
  - `wf_wine_ids[]`, `wf_wines[]` (`scw_id` + product name), `wf_wines_listed_on_page[]` (Whole Foods wines whose Vivino wine id, from the ratings task, is on page 1 of this winery's list: extra evidence)
  - `warnings`, `source`, `captured`, `captured_note`

## Match rule

- `matched/high`: page name is the producer, region or country fits, and a listed wine resembles a Whole Foods bottle.
- `matched/medium`: name and region fit, but no Whole Foods bottle is on page 1 of the list (common for large producers), or Vivino files the brand under a parent or label name.
- `low_confidence`: page read, but the name is only similar or another producer is plausible. Shown separately; do not present as fact.
- `not_found` / `fetch_failed`: no winery page found, or the page could not be read. No details stored.

## Server (built November 27, 2026, server version 1.2.0)

- `get_winery(slug | scw_id | asin, include_low_confidence?, include_links?)`: the stored profile. Level-2 links only with `include_links`.
- `list_wineries(query?, country?, region?, min_rating?, include_low_confidence?, sort?, offset?, limit?)`: sort `name`, `rating_desc` or `wf_wines_desc`.
- `wines_by_winery(slug | scw_id | asin)`: the winery's Whole Foods wines, joined to `data/wines.json`.
- `winery_stats`: coverage counts.
- Matched wineries only unless `include_low_confidence` is true. Folder override: `WINERY_DATA`.
- Tests: `python3 tests/test_stdio.py` (40 checks) and `python3 tests/test_sdk_client.py`.

## Wine Browser page (built November 27, 2026)

- `ui/build_ui_data.py data/wines.json ui/wines.json [data/wineries]` adds `w_*` fields to each wine row (matched wineries only; only vivino.com links are kept).
- Bottle detail: a Winery block with name, region and country, winery rating and count, wine count, owner, the short summary, the Vivino winery link, buttons for the winery's other Whole Foods wines, and up to 6 "More from this winery on Vivino" links.
- Filters: a "Winery region" list. Sort: "Winery rating, high to low". Search also matches winery name and region.
- Test: `node ui/test_core.js ui/core.js ui/wines.json ui/beers.json ui/cheeses.json`.

## Coverage (as of November 27, 2026)

- All 270 producers behind the 472 wines in `data/wines.json` (after the November 22 sweep): 261 matched to 260 winery pages (228 high, 32 medium, counted per page), 3 low confidence (Domaine Auchere, Maestrale, Vine to Table), 6 not found (Case Vecie, Quadrum, Saint Spritz, Summer Club Wines, Tres Volantes, and TSG Consumer Partners, which was not searched because the brand field is an investment firm and the Whole Foods page names no producer). Mirabelle and Schramsberg resolve to the same winery, so there are 263 winery files.
- 461 of 472 wines link to a matched winery, 3 to a low-confidence one, 8 to none.
- `build/make_winery_queue.py` keeps every existing producer's idx and appends new ones when the wine list grows.
- Rebuild: `python3 build/make_winery_queue.py && python3 build/build_wineries.py`. New lookups go in a new `raw/wineries/match_new_<N>.jsonl` or `match_retry.jsonl` (both take precedence over the original batch files).

## Caveats

- Data is a snapshot from November 19 and 27, 2026, not live.
- Vivino sometimes files a label under a parent producer (for example Farm to Table under Fowles Wine), or files a multi-region label in one region. `verify_note` and `warnings` say when.
- Several Whole Foods location fields disagree with Vivino's region; those are recorded as warnings, not corrected.
