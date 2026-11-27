# WFM-Specialty

A one-page shelf browser for the wine, beer and cut-to-order cheese at one Whole Foods Market store, with a **Beer | Wine | Cheese** switch in the header.

- **Wine:** 472 wines. Filter by type, price, alcohol, Vivino rating, varietal, country, brand and size; view as a grid, table, price-spread groups or a price chart. Each wine opens to its page details, Vivino rating, a word cloud of terms from recent reviews and a Winery section from the producer's Vivino winery page (region, winery rating, a short summary and the winery's other Whole Foods wines). Filter by winery region or sort by winery rating. 110 wines added November 22 show list details only, with no Vivino rating or tasting notes yet.
- **Beer:** 258 beers, ciders, seltzers, hard kombucha and tea, sake and makgeolli. Pack count, can or bottle size and flavor are kept as separate fields, with price per can or bottle and per fl oz, and ABV filters. 65 drinks added November 22 show list details only, without a description or store aisle.
- **Cheese:** 108 cheeses cut to order at the cheese counter (priced per pound, so they come in different weights). Filter by style, milk, country and price per pound. Prepackaged shelf cheese is left out.

## Look and motion

- **Header:** a desert photo banner with white lettering and green accents, and a **Beer | Wine | Cheese** switch.
- **Green:** the filter rail and the backdrop behind the cards. The search bar and Sort dropdown are styled like a margarita: lime green inside a salted rim.
- **Opening a wine card:** a short animation runs before the details window opens.
  - Sparkling wine (68): the cork pops and flies up out of the card.
  - Every other wine (404): the bottle tips 90 degrees right and pours a splash in that wine's color.
  - Beer and cheese cards open straight away. Keyboard opening and the reduced-motion setting skip the animation.

The data is a snapshot captured November 19, 20 and 22, 2026 from the store's public search and product pages (store ZIP 92211). Prices and stock change; the page does not refresh them. Vivino ratings were read from public Vivino pages; only ratings and term counts are stored, never review text.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole page: header, filter rail, views and detail dialog |
| `core.js` | Filter, facet, sort and grouping logic with no DOM code, shared by both modes |
| `wines.json`, `beers.json`, `cheeses.json` | The data the page loads |
| `banner.jpg` | Header photo (desert wash with palm trees), resized to 1920 px wide |
| `human0-logo.jpg` | The Human0 logo |
| `test/test_core.js` | Count and sort checks for `core.js` against all three data files |
| `servers/wine`, `servers/beer`, `servers/cheese` | The MCP servers behind the page: server, build scripts, tests and data. Each has its own README. |

## Run it

The page loads its data with `fetch`, so serve the folder rather than opening the file directly:

```
cd apps/wfm-specialty
python3 -m http.server 8000
```

Then open http://localhost:8000/ (wine), http://localhost:8000/#beer/grid (beer) or http://localhost:8000/#cheese/grid (cheese).

## Test

```
cd apps/wfm-specialty/test
node test_core.js ../core.js ../wines.json ../beers.json ../cheeses.json
```

It prints the filter, facet and sort counts for each dataset as JSON.

Server tests:

```
python3 servers/wine/tests/test_stdio.py     # 40 checks
python3 servers/beer/tests/test_stdio.py     # 22 checks
python3 servers/beer/tests/test_ui_parity.py # 15 checks
python3 servers/cheese/tests/test_stdio.py   # 24 checks
```
