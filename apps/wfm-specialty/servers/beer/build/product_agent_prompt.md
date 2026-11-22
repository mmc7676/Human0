You extract product details from public Whole Foods product pages into a file. Read-only web work. Do NOT call any mcp__hearthbot__ tools. Be economical: one navigate per product, no extra snapshots unless the page is still loading. Do not revisit a page you already captured.

Hard rules: never click anything on the product pages (not "Add to Cart", not size or flavor options), never sign in or click Login / "Log in with Amazon", never create an account, never buy anything, never change the store/location (pages should show "Delivery to 92211"; if one shows another ZIP, STOP and report; do not change it), never click "Change Address", never open other sites. If a CAPTCHA / "prove you're human" check appears, stop and report. If the browser refuses the site, stop and report the exact refusal. Do not launch or install a browser from a shell.

Tools: mcp__remote-browser__* (ToolSearch query "select:mcp__remote-browser__browser_open_window,mcp__remote-browser__browser_navigate,mcp__remote-browser__browser_snapshot,mcp__remote-browser__browser_wait_for,mcp__remote-browser__browser_close_window"). Call browser_open_window with no arguments first and pass its browser_id and window on every call. Close the window with browser_close_window when done.

Input: /mnt/project-files/wholefoods-beer-mcp/raw/products/queue.json is a JSON list of {asin, href, position}. Your slice is items [START, END) (0-based, Python slice). First, with python3, list the ASINs already present in any /mnt/project-files/wholefoods-beer-mcp/raw/products/batch_*.jsonl with status "ok" and skip those.

For each remaining item, in order:
1. browser_navigate to "https://www.wholefoodsmarket.com" + href. The navigate result already contains the page snapshot; read everything from it. Only if the main content is still loading (no h1), call browser_wait_for time=3 then browser_snapshot with ref=<the main element ref> to read just the main area.
2. From the main area read, verbatim (exact text, site spelling and capitalization kept, nothing invented, nothing paraphrased):
   - brand: the small text just above the h1 (e.g. "Stella Artois")
   - h1: the level-1 heading text
   - price: the price text right under the h1 (e.g. "$19.49"); if two prices show, the first is current; put the second in list_price; put any "x% off" text in discount_note
   - location_in_store: the "Located in ..." text (e.g. "Located in Beer") or null
   - delivery_zip: the ZIP shown after "Delivery to"
   - main_img_alt: the name of the first figure's img, or null
   - size_selected: the text after "Select Size:" (e.g. "11.20 Fl Oz (Pack of 12)"), or null if there is no size picker
   - size_options: one object per size option shown under the size picker: {"label": "11.20 Fl Oz (Pack of 6)", "price": "$10.99" or null, "selected": true/false (true for the option matching size_selected), "href": the option's /url if it is a link, else null}; [] if none
   - flavor_selected: the text after "Select Flavor:" (e.g. "barley malt/tomahawk"), or null
   - flavor_options: same shape as size_options for the flavor picker; [] if none
   - other_pickers: {} or an object for any other "Select ...:" picker (key = the picker name, value = {"selected": ..., "options": [...] same shape})
   - bullets: list of every paragraph/list-item text under the "Description" heading, in order (do NOT include the word "Description" and do NOT include the long legal disclaimer that starts "While we work to ensure")
   - ingredients: the text under the "Ingredients" heading, or null
   - other_sections: object mapping any other level-2 heading in the product area (e.g. "Product details", "Nutrition") to its text items as a list of strings; {} if none. Skip headings for reviews, "You may also like", and sitewide footer headings.
   - final_url: the Page URL shown
3. Append one JSON line to /mnt/project-files/wholefoods-beer-mcp/raw/products/batch_BATCH.jsonl with python3 (json.dumps, ensure_ascii=False; pass the text through a heredoc or a json file so quotes are kept exactly): {"asin", "href", "position", "final_url", "brand", "h1", "price", "list_price", "discount_note", "location_in_store", "delivery_zip", "main_img_alt", "size_selected", "size_options", "flavor_selected", "flavor_options", "other_pickers", "bullets", "ingredients", "other_sections", "status": "ok"}. If the page is missing (404 / "page not found" / error page / no h1 after one wait), write {"asin","href","position","status":"not_found","error":"<what you saw>"} and move on; do not retry more than once.
Pacing: the site starts refusing pages (net::ERR_HTTP_RESPONSE_CODE_FAILURE) when hit too fast. After each product, call browser_wait_for time=4 before the next navigate. If a navigate fails with ERR_HTTP_RESPONSE_CODE_FAILURE or another network error, call browser_wait_for time=60 and retry that product once. If it fails again, do not write a line for it; count it as a failure. If 3 products in a row fail, stop and report (do not write not_found lines for network errors; only write not_found for a real "page not found" page).
Write lines as you go (one to three products at a time) so nothing is lost.

Final report (short): items processed, ok count, not_found/error ASINs with reason, any problem.
