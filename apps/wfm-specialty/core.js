/* Shelf browser core: pure filter, sort, facet and grouping logic (no DOM), shared by the Wine and Beer pages.
   Call configure(cfg) with a mode's fields before using the other functions. */
(function (root) {
  "use strict";
  var NONE = "Not stated";
  var cfg = null;

  var WINE = {
    typeField: "color",
    typeOrder: ["red", "white", "rosé", "sparkling", "orange", "dessert", NONE],
    setFields: ["color", "varietal", "country", "brand", "size"],
    hayFields: ["brand", "name", "varietal", "color", "country", "location", "tasting", "winemaking", "pairing", "other", "asin", "id"],
    extra: function (row, st) {
      if (st.minRating !== null && st.minRating !== undefined &&
          (row.v_rating === null || row.v_rating === undefined || row.v_rating < st.minRating)) return false;
      if (st.vivino === "matched" && row.v_status !== "matched") return false;
      if (st.vivino === "unmatched" && row.v_status === "matched") return false;
      return true;
    },
    extraState: function () { return { minRating: null, vivino: "any" }; }
  };

  var BEER = {
    typeField: "family",
    typeOrder: ["IPA", "Pale ale", "Lager & pilsner", "Wheat", "Blonde & other ale", "Belgian & farmhouse",
      "Stout & porter", "Fruit, sour & radler", "Variety pack", "Cider", "Hard seltzer", "Kombucha, tea & other", "Sake & rice wine", NONE],
    setFields: ["family", "style", "pack", "container", "brand", "country"],
    // packs read in container count order: Single, 4-pack, 6-pack ... with Not stated last
    orders: { pack: function (k) { return k === "Single" ? 1 : k === NONE ? 1e9 : (parseInt(k, 10) || 1e8); } },
    hayFields: ["brand", "name", "page_title", "style", "family", "country", "pack", "container", "ingredients", "flavor", "asin", "id"],
    extra: function (row, st) {
      if (st.abvMin !== null && st.abvMin !== undefined && (row.abv === null || row.abv === undefined || row.abv < st.abvMin)) return false;
      if (st.abvMax !== null && st.abvMax !== undefined && (row.abv === null || row.abv === undefined || row.abv >= st.abvMax)) return false;
      return true;
    },
    extraState: function () { return { abvMin: null, abvMax: null }; }
  };

  function configure(c) { cfg = c; }

  function val(row, field) {
    var v = row[field];
    return v === null || v === undefined || v === "" ? NONE : v;
  }

  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function haystack(row) {
    if (!row._hay) {
      var bits = cfg.hayFields.map(function (f) { return row[f]; });
      if (row.bullets && cfg === BEER) bits.push(row.bullets.join(" "));
      row._hay = norm(bits.join(" | "));
    }
    return row._hay;
  }

  function emptyState() {
    var st = { q: "", priceMin: null, priceMax: null, alcohol: "any" };
    cfg.setFields.forEach(function (f) { st[f] = []; });
    var ex = cfg.extraState();
    Object.keys(ex).forEach(function (k) { st[k] = ex[k]; });
    return st;
  }

  // skip: name of a set field whose own filter is ignored (for facet counts)
  function matches(row, st, skip) {
    if (st.q) {
      var terms = norm(st.q).split(/\s+/).filter(Boolean);
      var h = haystack(row);
      for (var i = 0; i < terms.length; i++) if (h.indexOf(terms[i]) === -1) return false;
    }
    for (var f = 0; f < cfg.setFields.length; f++) {
      var key = cfg.setFields[f];
      if (key === skip) continue;
      var sel = st[key];
      if (sel && sel.length && sel.indexOf(String(val(row, key))) === -1) return false;
    }
    if (st.priceMin !== null && st.priceMin !== undefined && row.price < st.priceMin) return false;
    if (st.priceMax !== null && st.priceMax !== undefined && row.price > st.priceMax) return false;
    if (st.alcohol === "only_na" && !row.non_alcoholic) return false;
    if (st.alcohol === "exclude_na" && row.non_alcoholic) return false;
    return cfg.extra(row, st);
  }

  function filterRows(rows, st) {
    return rows.filter(function (r) { return matches(r, st, null); });
  }

  // Counts for one facet given every other active filter.
  function facetCounts(rows, st, field) {
    var counts = {};
    rows.forEach(function (r) {
      if (!matches(r, st, field)) return;
      var k = String(val(r, field));
      counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
  }

  function orderIndex(field, k) {
    if (field === cfg.typeField) return cfg.typeOrder.indexOf(k);
    var o = cfg.orders && cfg.orders[field];
    if (typeof o === "function") return o(k);
    if (o) { var i = o.indexOf(k); return i === -1 ? 999 : i; }
    return null;
  }

  // All values of a field across the full dataset, ordered for display.
  function facetValues(rows, field) {
    var counts = {};
    rows.forEach(function (r) { var k = String(val(r, field)); counts[k] = (counts[k] || 0) + 1; });
    var keys = Object.keys(counts);
    keys.sort(function (a, b) {
      var ia = orderIndex(field, a), ib = orderIndex(field, b);
      if (ia !== null && ib !== null && ia !== ib) return ia - ib;
      if (a === NONE) return 1;
      if (b === NONE) return -1;
      return counts[b] - counts[a] || a.localeCompare(b);
    });
    return keys.map(function (k) { return { value: k, total: counts[k] }; });
  }

  function num(v) { return v === null || v === undefined ? -1 : v; }
  function cheap(v) { return v === null || v === undefined ? Infinity : v; }
  var SORTS = {
    store: function (r) { return r.pos; },
    price: function (r) { return r.price; },
    off: function (r) { return r.off_pct || 0; },
    brand: function (r) { return norm(r.brand); },
    name: function (r) { return norm(r.name); },
    varietal: function (r) { return norm(val(r, "varietal")); },
    style: function (r) { return norm(val(r, "style")); },
    color: function (r) { return cfg.typeOrder.indexOf(val(r, "color")); },
    family: function (r) { return cfg.typeOrder.indexOf(val(r, "family")); },
    country: function (r) { return norm(val(r, "country")); },
    size: function (r) { return norm(val(r, "size")); },
    pack: function (r) { return num(r.pack_count); },
    container: function (r) { return norm(val(r, "container")); },
    abv: function (r) { return num(r.abv); },
    aisle: function (r) { return norm(val(r, "aisle")); },
    // missing unit prices sort after every real one when read low to high
    per_oz: function (r) { return cheap(r.per_oz); },
    per_unit: function (r) { return cheap(r.per_unit); },
    rating: function (r) { return num(r.v_rating); },
    ratings: function (r) { return r.v_count || 0; }
  };

  function sortRows(rows, key, dir) {
    var fn = SORTS[key] || SORTS.store;
    var m = dir === "desc" ? -1 : 1;
    return rows.slice().sort(function (a, b) {
      var x = fn(a), y = fn(b);
      if (x < y) return -1 * m;
      if (x > y) return 1 * m;
      return a.pos - b.pos;
    });
  }

  function median(sorted) {
    var n = sorted.length;
    if (!n) return null;
    return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  }

  function groupRows(rows, field) {
    var groups = {};
    rows.forEach(function (r) {
      var k = String(val(r, field));
      (groups[k] = groups[k] || []).push(r);
    });
    return Object.keys(groups).map(function (k) {
      var prices = groups[k].map(function (r) { return r.price; }).sort(function (a, b) { return a - b; });
      return { key: k, count: groups[k].length, min: prices[0], max: prices[prices.length - 1],
        median: median(prices), rows: groups[k] };
    }).sort(function (a, b) {
      var ia = orderIndex(field, a.key), ib = orderIndex(field, b.key);
      if (ia !== null && ib !== null && ia !== ib) return ia - ib;
      if (a.key === NONE) return 1;
      if (b.key === NONE) return -1;
      return b.count - a.count || a.key.localeCompare(b.key);
    });
  }

  var api = { NONE: NONE, WINE: WINE, BEER: BEER, configure: configure, val: val, emptyState: emptyState,
    filterRows: filterRows, facetCounts: facetCounts, facetValues: facetValues, sortRows: sortRows,
    groupRows: groupRows, median: median, cfg: function () { return cfg; } };
  configure(WINE);
  root.ShelfCore = api;
  root.WineCore = api;
})(typeof window !== "undefined" ? window : globalThis);
