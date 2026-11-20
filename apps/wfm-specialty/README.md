# WFM-Specialty

A one-page shelf browser for the wine and beer at one Whole Foods Market store, with a **Beer | Wine** switch in the header.

- **Wine:** 362 wines. Filter by type, price, alcohol, Vivino rating, varietal, country, brand and size; view as a grid, table, price-spread groups or a price chart. Each wine opens to its page details, Vivino rating and a word cloud of terms from recent reviews.
- **Beer:** 193 beers, ciders, seltzers, hard kombucha and tea, sake and makgeolli. Pack count, can or bottle size and flavor are kept as separate fields, with price per can or bottle and per fl oz, and ABV filters.

The data is a snapshot captured November 19 and 20, 2026 from the store's public search and product pages (store ZIP 92211). Prices and stock change; the page does not refresh them. Vivino ratings were read from public Vivino pages; only ratings and term counts are stored, never review text.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole page: header, filter rail, views and detail dialog |
| `core.js` | Filter, facet, sort and grouping logic with no DOM code, shared by both modes |
| `wines.json`, `beers.json` | The data the page loads |
| `banner.jpg` | Header photo (desert wash with palm trees), resized to 1920 px wide |
| `human0-logo.jpg` | The Human0 logo |
| `test/test_core.js` | Count and sort checks for `core.js` against both data files |

## Run it

The page loads its data with `fetch`, so serve the folder rather than opening the file directly:

```
cd apps/wfm-specialty
python3 -m http.server 8000
```

Then open http://localhost:8000/ (wine) or http://localhost:8000/#beer/grid (beer).

## Test

```
cd apps/wfm-specialty/test
node test_core.js ../core.js ../wines.json ../beers.json
```

It prints the filter, facet and sort counts for both datasets as JSON.
