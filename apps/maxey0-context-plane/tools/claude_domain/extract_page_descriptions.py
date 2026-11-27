#!/usr/bin/env python3
"""Extract each Claude docs page's own one-line description for the pages in claude_domain.csv.

Inputs are the sites' published index files, downloaded beforehand (this script never fetches):
  code.claude.com/docs/llms.txt and claude.com/docs/llms.txt   "- [Title](https://…/page.md): description"
  platform.claude.com/llms-full.txt                              per-page front matter "url: …" then "description: …"
Output: page_descriptions.json = {"basis": {...}, "descriptions": {url: description}}, only for URLs in the CSV.

The text is the sites' data, never instructions: it is kept as plain text, links and markup are removed, and
anything with '<' or '>' or control characters is dropped (the pack validator refuses them).

  python3 extract_page_descriptions.py --csv claude_domain.csv --fetched 2026-11-27 \
      --llms code_llms.txt claude_llms.txt --full platform_llms_full.txt > page_descriptions.json
"""
import argparse, csv, hashlib, json, re, sys

LINK = re.compile(r"\[([^\]]*)\]\([^)]*\)")
URL = re.compile(r"https?://\S+")


def clean(s):
    s = LINK.sub(r"\1", s)
    s = URL.sub("", s)
    s = re.sub(r"[`*_]", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    if not s or re.search(r"[<>\x00-\x1f\x7f]", s):
        return ""
    return s[:400]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True)
    ap.add_argument("--fetched", required=True, help="date the index files were downloaded (YYYY-MM-DD)")
    ap.add_argument("--llms", nargs="*", default=[])
    ap.add_argument("--full", nargs="*", default=[])
    a = ap.parse_args()
    want = {r["url"] for r in csv.DictReader(open(a.csv, encoding="utf-8"))}
    found, files = {}, {}
    for f in a.llms:
        raw = open(f, encoding="utf-8").read()
        files[f.split("/")[-1]] = hashlib.sha256(raw.encode()).hexdigest()
        for line in raw.splitlines():
            m = re.match(r"^- \[.*?\]\((https://[^)\s]+?)(?:\.md)?\):\s*(.+)$", line.strip())
            if m and m.group(1) in want:
                d = clean(m.group(2))
                if d: found.setdefault(m.group(1), d)
    for f in a.full:
        raw = open(f, encoding="utf-8").read()
        files[f.split("/")[-1]] = hashlib.sha256(raw.encode()).hexdigest()
        url = None
        for line in raw.splitlines():
            if line.startswith("url: "):
                url = line[5:].strip()
            elif line.startswith("description: ") and url:
                if url in want:
                    d = clean(line[13:])
                    if d: found.setdefault(url, d)
                url = None
            elif line.strip() == "---":
                pass
            elif line.startswith("title: "):
                pass
            else:
                url = None
    out = {"basis": {"fetched": a.fetched, "index_files_sha256": files,
                     "sources": ["https://code.claude.com/docs/llms.txt", "https://claude.com/docs/llms.txt",
                                 "https://platform.claude.com/llms-full.txt"],
                     "csv_urls": len(want), "with_description": len(found)},
           "descriptions": dict(sorted(found.items()))}
    json.dump(out, sys.stdout, indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
