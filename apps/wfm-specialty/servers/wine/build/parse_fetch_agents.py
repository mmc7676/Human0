#!/usr/bin/env python3
"""Turn fetch-agent transcripts into raw/vivino files, without retyping anything by hand.

Usage: parse_fetch_agents.py TAG TRANSCRIPT.jsonl [TRANSCRIPT.jsonl ...]

Each transcript is a web-fetch agent run. Its final report holds:
  PAGE <json>                      one Vivino wine page header read (rating, title, winery, ...)
  WINE <id> status=...             then one line per review: rating|date|language|term;term;...
  END <id> total=<n>
The agent's raw WebFetch results for /api/wines/<id>/reviews are in the same transcript.
A term is kept only when its words appear in that wine's raw reviews JSON (note text or
Vivino's flavor_word_matches), so a term the reading model invented cannot reach the word cloud.
Writes raw/vivino/fetch_<TAG>.jsonl (page reads) and raw/vivino/terms_<TAG>.jsonl (term lists).
Review texts are not written anywhere.
"""
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RAW = os.path.join(ROOT, "raw", "vivino")


def blocks(path):
    for line in open(path, encoding="utf-8"):
        o = json.loads(line)
        c = (o.get("message") or {}).get("content")
        if isinstance(c, list):
            for b in c:
                yield b


def text_of(content):
    if isinstance(content, str):
        return content
    return "".join(x.get("text", "") for x in content or [] if isinstance(x, dict))


def norm(s):
    s = s.replace("\\n", " ").replace("\\r", " ").replace('\\"', '"')
    s = re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), s)
    return re.sub(r"[^a-z0-9']+", " ", s.lower())


def main():
    tag, paths = sys.argv[1], sys.argv[2:]
    raw_by_id, report = {}, []
    page_urls = {}
    q = os.environ.get("COMBO_QUEUE")
    if q and os.path.exists(q):
        page_urls = {int(i): u for i, u in json.load(open(q))}
    for p in paths:
        uses = {}
        for b in blocks(p):
            if b.get("type") == "tool_use":
                uses[b["id"]] = b
                if b["name"] == "SubagentHandback":
                    report.append(b["input"].get("message", ""))
            elif b.get("type") == "tool_result":
                u = uses.get(b.get("tool_use_id"))
                if u is None or u["name"] != "WebFetch":
                    continue
                m = re.search(r"/api/wines/(\d+)/reviews", u["input"].get("url", ""))
                if m:
                    s = text_of(b.get("content"))
                    i = s.find("<fetched-web-content>")
                    body = s[i + len("<fetched-web-content>"):].lstrip() if i >= 0 else s.lstrip()
                    # Only Vivino's own JSON counts as evidence; a model-written summary does not.
                    if body.startswith("{") and len(body) > len(raw_by_id.get(int(m.group(1)), "")):
                        raw_by_id[int(m.group(1))] = body
    pages, terms, cur = [], [], None
    for line in "\n".join(report).splitlines():
        line = line.strip()
        if line.startswith("PAGE "):
            body = line[5:].strip()
            if body.startswith("{"):
                try:
                    pg = json.loads(body)
                    if "status" not in pg and pg.get("h1"):
                        pg["status"] = "ok"
                    pages.append(pg)
                except json.JSONDecodeError:
                    print("bad PAGE line:", line[:120])
            elif body.count("|") >= 8:
                # Some agents wrote: id | status | rating | count | h1 | winery | winery_path | region | grapes
                f = [x.strip() for x in body.split("|")]
                num = lambda x, t: (t(x) if re.fullmatch(r"[\d.]+", x or "") else None)
                url = page_urls.get(int(f[0])) if f[0].isdigit() else None
                if url:
                    pages.append({"url": url, "status": f[1], "rating": num(f[2], float),
                                  "ratings_count": num(f[3], int), "h1": f[4], "winery": f[5],
                                  "winery_path": None if f[6] == "null" else f[6], "region": f[7],
                                  "grapes": None if f[8] == "null" else f[8]})
                else:
                    print("PAGE id with no known URL:", line[:120])
            else:
                print("bad PAGE line:", line[:120])
        elif line.startswith("WINE "):
            m = re.match(r"WINE (\d+)(?: status=(\S+))?", line)
            st = (m.group(2) or "ok").split("(")[0].rstrip(";,")
            cur = {"vivino_wine_id": int(m.group(1)), "status": st,
                   "review_terms": [], "review_ratings": [], "dropped_terms": 0, "skipped_reviews": 0}
        elif line.startswith("END") and cur:
            m = re.search(r"total=(\d+)", line)
            cur["reviews_in_list"] = int(m.group(1)) if m else None
            terms.append(cur)
            cur = None
        elif cur and line.count("|") >= 3:
            rating, date, lang, tl = [x.strip() for x in line.split("|", 3)]
            if not lang.lower().startswith("en") or tl in ("none", "empty", "non-english", ""):
                cur["skipped_reviews"] += 1
                continue
            hay = norm(raw_by_id.get(cur["vivino_wine_id"], ""))
            keep = []
            for t in [x.strip().lower() for x in tl.split(";")]:
                if t and (" " + norm(t).strip() + " ") in (" " + hay + " "):
                    keep.append(t)
                elif t:
                    cur["dropped_terms"] += 1
            cur["review_terms"].append(keep)
            try:
                cur["review_ratings"].append(float(rating))
            except ValueError:
                pass
    for t in terms:
        if t["vivino_wine_id"] not in raw_by_id:
            t["status"] = "no raw fetch in transcript"
            t["review_terms"] = []
        elif t["status"] != "ok" and any(t["review_terms"]):
            # The page body was cut short, but the reviews that did come through are real.
            t["agent_status"], t["status"] = t["status"], "ok"
    with open(os.path.join(RAW, f"fetch_{tag}.jsonl"), "w", encoding="utf-8") as f:
        for p in pages:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")
    with open(os.path.join(RAW, f"terms_{tag}.jsonl"), "w", encoding="utf-8") as f:
        for t in terms:
            f.write(json.dumps(t, ensure_ascii=False) + "\n")
    kept = sum(len(x) for t in terms for x in t["review_terms"])
    print(json.dumps({"pages": len(pages), "wines": len(terms), "ok": sum(t["status"] == "ok" for t in terms),
                      "reviews_used": sum(len(t["review_terms"]) for t in terms), "terms_kept": kept,
                      "terms_dropped": sum(t["dropped_terms"] for t in terms)}))


if __name__ == "__main__":
    main()
