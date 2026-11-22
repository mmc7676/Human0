You extract product details from public Whole Foods product pages into a file. Read-only web work. Do NOT call any mcp__hearthbot__ tools. Be economical: the user cares about usage. Do not revisit a page you already captured.

Hard rules: never click "Add to Cart", never sign in or click Login / "Log in with Amazon", never create an account, never buy anything, never change the store/location (pages should show "Delivery to 92211"; if one shows another ZIP, STOP and report; do not change it), never click "Change Address", never open other sites. If a CAPTCHA / "prove you're human" check appears, stop and report. If the browser refuses the site, stop and report the exact refusal. Do not launch or install a browser from a shell.

Tools: mcp__remote-browser__* (ToolSearch query "select:mcp__remote-browser__browser_open_window,mcp__remote-browser__browser_navigate,mcp__remote-browser__browser_snapshot,mcp__remote-browser__browser_wait_for,mcp__remote-browser__browser_close_window"). Call browser_open_window with no arguments first and pass its browser_id and window on every call. Close the window with browser_close_window when done.

Input: /mnt/project-files/wholefoods-wine-mcp/raw/products/queue.json is a JSON list of {asin, href, position}. Your slice is items [START, END) (0-based, Python slice). First, with python3, list the ASINs already present in any /mnt/project-files/wholefoods-wine-mcp/raw/products/batch_*.jsonl with status "ok" and skip those.

For each remaining item, in order:
1. browser_navigate to "https://www.wholefoodsmarket.com" + href. The navigate result already contains the page snapshot; read everything from it. Only if the main content is still loading (no h1), call browser_wait_for time=3 then browser_snapshot ref=<the main element ref> to read just the main area.
2. From the main area read, verbatim (exact text, site spelling kept, nothing invented):
   - brand: the small text just above the h1 (e.g. "Oyster Bay")
   - h1: the level-1 heading text
   - price: the price text right under the h1 (e.g. "$13.99"); if two prices show, the first is current; put the second in list_price
   - location_in_store: the "Located in ..." text or null
   - delivery_zip: the ZIP shown after "Delivery to"
   - main_img_alt: the name of the first figure's img (e.g. "Oyster Bay Sauvignon Blanc, White Wine, 750 mL Bottle 1"), or null
   - bullets: list of every paragraph text under the "Description" heading's list items, in order (do NOT include the word "Description" and do NOT include the long legal disclaimer paragraph that starts "While we work to ensure")
   - other_sections: object mapping any other level-2 heading in the product area (e.g. "Ingredients", "Product details") to its text items; {} if none
   - final_url: the Page URL shown
3. Append one JSON line to /mnt/project-files/wholefoods-wine-mcp/raw/products/batch_BATCH.jsonl with python3 (json.dumps, ensure_ascii=False): {"asin", "href", "position", "final_url", "brand", "h1", "price", "list_price", "location_in_store", "delivery_zip", "main_img_alt", "bullets", "other_sections", "status": "ok"}. If the page is missing (404 / "page not found" / no h1 after one wait), write {"asin","href","position","status":"not_found","error":"<what you saw>"} and move on; don't retry more than once.
Write lines as you go (one or a few at a time) so nothing is lost.

Final report (short): items processed, ok count, not_found/error ASINs with reason, any problem.
