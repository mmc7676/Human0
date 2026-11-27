#!/usr/bin/env python3
"""Claude domain packs: Human0's claude_domain.csv + the Claude Duet harness -> 21 human0.topic-pack/1 files.

  python tools/claude_domain/build_claude_packs.py [--report-dir DIR]

Inputs (this folder):
  claude_domain.csv         Human0's Claude domain (Claude apps, Claude Code, Claude Platform): one row per docs page.
                            Columns are read by header name, so column order does not matter.
  merges.json               declared concept merges (duplicates, and topics over validate_topic_pack's 8 concepts),
                            topic ids and short codes, and the verified MCP row.
  claude-duet.source.json   the Claude Duet topic harness (generated concepts and skills, no agents or lexicon).

Outputs:
  SCW3/sources/packs/<topic id>.pack.json   one pack per topic, domain "claude" (regroup.pack_domains in the spec)
  <report-dir>/claude_domain_merged.csv     the merged domain, one row per page (Duet: one row per skill)
  <report-dir>/merge_report.json            counts before and after, every merge, and the checks below

One skill per (topic, concept, skill) of the CSV; a skill's pages (API reference endpoints) stay with it in
provenance.sources, so every CSV row maps to exactly one skill (checked). Deterministic: same inputs, same bytes.
"""
import argparse, collections, csv, hashlib, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.dirname(HERE))
from build_scw3 import tokens  # the one tokenizer, so keywords and lexicon terms match what the graph indexes

PACKS = os.path.join(ROOT, "SCW3", "sources", "packs")
GRAPH = os.path.join(ROOT, "SCW3", "scw3.graph.json")
COLS = ["domain", "topic", "concept", "skill", "page_title", "url", "source",
        "agent_primary", "agent_checker", "agent_support", "mcp_server"]
APP_DOMAINS = {"memory", "graph", "vector", "observability", "security", "data", "runtime", "orchestration",
               "protocol", "docs", "messaging", "research"}

LEX_SKIP = {"claude", "anthropic", "beta", "overview", "reference"}
LEX_WEAK = {"what", "you", "your", "one", "yes", "when", "get", "how", "person", "work", "use", "about", "more", "out"}
VERBS = set("""set create configure install use build deploy manage run get connect migrate add enable test
troubleshoot define handle track publish submit share sync roll import read catch scan find review let continue
automate schedule draw react host recommend measure give scale modify extend intercept rewind stream persist work
explore decide authenticate design send check detect map limit mitigate reduce increase keep compact trigger archive
delete upload list retrieve update acknowledge start move choose write sign request turn control plan apply
quickstart setting setup migrating deploying building using managing creating testing""".split())
BAD = re.compile(r"[<>\x00-\x08\x0b\x0c\x0e-\x1f]")


def slug(s, n=60):
    x = re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-")
    if len(x) > n:
        x = x[:n].rsplit("-", 1)[0]
    return x


def clean(s):
    return BAD.sub(" ", str(s)).strip()


def dump(o):
    return json.dumps(o, ensure_ascii=False, indent=1)


def read_csv(path):
    with open(path, encoding="utf-8", newline="") as fh:
        r = csv.DictReader(fh)
        missing = [c for c in COLS if c not in (r.fieldnames or [])]
        if missing:
            sys.exit(f"{path}: missing columns {missing}")
        return [{c: row[c] for c in COLS} for row in r]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--report-dir", default=None, help="also write claude_domain_merged.csv and merge_report.json here")
    a = ap.parse_args()
    src_csv = os.path.join(HERE, "claude_domain.csv")
    rows = read_csv(src_csv)
    csv_sha = hashlib.sha256(open(src_csv, "rb").read()).hexdigest()
    M = json.load(open(os.path.join(HERE, "merges.json"), encoding="utf-8"))
    duet = json.load(open(os.path.join(HERE, "claude-duet.source.json"), encoding="utf-8"))
    # each page's own one-line description, from the sites' published index files (extract_page_descriptions.py)
    PD = json.load(open(os.path.join(HERE, "page_descriptions.json"), encoding="utf-8"))
    pdesc = PD["descriptions"]
    tid_of = {t: v[0] for t, v in M["topic_ids"].items()}
    code_of = {t: v[1] for t, v in M["topic_ids"].items()}
    surf_of = {t: v[2] for t, v in M["topic_ids"].items()}
    if {r["domain"] for r in rows} != {"Claude"}:
        sys.exit("every CSV row must be in domain Claude")
    unknown = sorted({r["topic"] for r in rows} - set(tid_of))
    if unknown:
        sys.exit(f"topics without an id in merges.json: {unknown}")
    urls = [r["url"] for r in rows]
    if len(set(urls)) != len(urls):
        sys.exit("a URL appears on two rows")

    # existing graph, minus anything these packs built earlier (so a rerun does not collide with itself)
    ours = set(tid_of.values())
    g = json.load(open(GRAPH, encoding="utf-8"))
    ex_ids = {d["id"] for d in g["domains"]} | {t["id"] for t in g["topics"] if not set(t["sources"]) & ours}
    ex_c = [c for c in g["concepts"] if c["source"] not in ours]
    ex_s = [s for s in g["skills"] if s["source"] not in ours]
    ex_ids |= {c["id"] for c in ex_c} | {s["id"] for s in ex_s} | {k["key"] for k in g["agents"]}
    ex_concept_labels = {c["label"].lower() for c in ex_c}
    ex_topic_labels = {t["label"].lower() for t in g["topics"] if not set(t["sources"]) & ours}

    before = {"rows": len(rows), "topics": len({r["topic"] for r in rows}),
              "concepts": len({(r["topic"], r["concept"]) for r in rows}),
              "skills": len({(r["topic"], r["concept"], r["skill"]) for r in rows}), "urls": len(set(urls))}

    # --- concept merges (declared) ------------------------------------------------------------
    where = {}  # (topic, concept) -> (topic, concept) after merges
    label_of = {}  # surviving (topic, concept) -> final label
    log = []
    for m in M["merges"]:
        src = (m["topic"], m["from"]); dst = (m.get("into_topic", m["topic"]), m["into"])
        for k in (src, dst):
            if not any((r["topic"], r["concept"]) == k for r in rows):
                sys.exit(f"merge names a concept the CSV does not have: {k}")
        where[src] = dst
        if "label" in m:
            label_of[dst] = m["label"]
        log.append({"from_topic": src[0], "from": src[1], "into_topic": dst[0], "into": dst[1],
                    "label": m.get("label", dst[1]), "reason": m["reason"]})
    def final(k):
        seen = set()
        while k in where:
            if k in seen: sys.exit(f"merge cycle at {k}")
            seen.add(k); k = where[k]
        return k

    # --- topics -> concepts -> skills (CSV order) -------------------------------------------------
    T = collections.OrderedDict()
    for r in rows:
        tk, ck = final((r["topic"], r["concept"]))
        sk = r["skill"]
        T.setdefault(tk, collections.OrderedDict()).setdefault(ck, collections.OrderedDict()).setdefault(sk, []).append(r)
    agent_names = {}
    for t in T:
        trs = [r for r in rows if r["topic"] == t]
        names = {(r["agent_primary"], r["agent_checker"], r["agent_support"]) for r in trs}
        if len(names) != 1:
            sys.exit(f"topic {t}: agents differ between rows: {sorted(names)}")
        agent_names[t] = names.pop()

    new_topic_labels = {t.lower() for t in tid_of}
    used_ids, used_clabels = set(ex_ids), set(ex_concept_labels)
    all_topic_labels = ex_topic_labels | new_topic_labels
    def take(i):
        base, k = i, 2
        while i in used_ids:
            i = f"{base}-{k}"; k += 1
        used_ids.add(i)
        return i
    def concept_label(label, surface):
        lab = label
        if lab.lower() in used_clabels or lab.lower() in all_topic_labels:
            lab = f"{label} ({surface})"
        if lab.lower() in used_clabels or lab.lower() in all_topic_labels:
            sys.exit(f"concept label still not unique: {lab}")
        used_clabels.add(lab.lower())
        return lab

    # idf over every new skill text, for lexicon term order
    def stext_csv(sk, rs):
        return sk + " " + " ".join(r["page_title"] for r in rs)
    corpus = [stext_csv(sk, rs) for cs in T.values() for ss in cs.values() for sk, rs in ss.items()]
    corpus += [s[2] + " " + s[3] for s in duet["skills"]]
    df = collections.Counter(w for x in corpus for w in set(tokens(x)))
    idf = lambda w: (len(corpus) + 1) / (df.get(w, 0) + 1)

    def skill_type(label):
        w = re.findall(r"[a-z]+", label.lower())
        return "procedural" if w and (w[0] in VERBS or w[0].endswith("ing") and w[0][:-3] in VERBS) else "semantic"

    def lexicon(concepts_with_text):
        lex, used = {}, set()
        for label, texts in concepts_with_text:
            tk = [w for w in tokens(label) if w.isalpha() and w not in LEX_SKIP]
            name = "".join(tk[:2]) or "c"
            if name in APP_DOMAINS or name in lex:
                name = "".join(tk[:3]) if len(tk) > 2 and "".join(tk[:3]) not in lex else name + str(len(lex) + 1)
            cnt = collections.Counter(w for x in texts for w in tokens(x))
            terms = [w for w, _ in sorted(cnt.items(), key=lambda kv: (-kv[1], -idf(kv[0]), kv[0]))
                     if w not in used and w not in LEX_SKIP and w not in LEX_WEAK and w.isalpha()][:6]
            if len(terms) >= 2:
                lex[name] = " ".join(terms); used.update(terms)
        return lex

    mrow, mnote = M["mcp"]["row"], M["mcp"]
    packs, merged_rows, row_to_skill = {}, [], {}
    for t, cs in T.items():
        pid, code, surf = tid_of[t], code_of[t], surf_of[t]
        if pid in used_ids: sys.exit(f"topic id {pid} already used")
        used_ids.add(pid)
        spec_k, rev_k, res_k = f"{pid}-specialist", f"{pid}-reviewer", "claude-docs-researcher"
        ap_, ac_, as_ = agent_names[t]
        agents = {spec_k: ap_, rev_k: ac_, res_k: as_}
        concepts, skills, sources, lex_in = [], [], {}, []
        for ck, ss in cs.items():
            clabel = concept_label(clean(label_of.get((t, ck), ck)), surf)
            cid = take(f"{code}-{slug(clabel, 50)}")
            slabels = list(ss)
            shown = ", ".join(slabels[:12]) + (f" and {len(slabels) - 12} more" if len(slabels) > 12 else "")
            cdesc = clean(f"{clabel}: {shown}.")[:900]
            kw = list(dict.fromkeys([w for w in tokens(clabel) if w not in LEX_SKIP] +
                     [w for w, _ in collections.Counter(w for s in slabels for w in tokens(s) if w not in LEX_SKIP).most_common(8)]))[:6]
            concepts.append([cid, clabel, pid, cdesc, kw])
            lex_in.append((clabel, [clabel] + [stext_csv(s, rs) for s, rs in ss.items()]))
            for sk, rs in ss.items():
                sid = take(f"{code}-{slug(sk)}")
                pages = list(dict.fromkeys((clean(r["page_title"]), r["url"]) for r in rs))
                if len(pages) == 1:
                    ptitle, url = pages[0]
                    named = "" if ptitle == clean(sk) else f" \"{ptitle}\""
                    page = pdesc.get(url)
                    desc = (f"{ptitle}. " if named else "") + (page if page else f"{clabel}.")
                else:
                    titles = list(dict.fromkeys(re.sub(r"\s*\(Beta\)$", "", p) for p, _ in pages))
                    head = f"{len(pages)} endpoint pages: "
                    tail = "."
                    room, parts = 1000 - len(head) - len(tail), []
                    for x in titles:
                        if len("; ".join(parts + [x])) > room: break
                        parts.append(x)
                    desc = head + "; ".join(parts) + tail
                skills.append([sid, cid, clean(sk), clean(desc), skill_type(sk),
                               [[spec_k, "primary"], [rev_k, "checker"], [res_k, "support"]]])
                sources[sid] = [u for _, u in pages]
                for r in rs:
                    if r["url"] in row_to_skill: sys.exit(f"row mapped twice: {r['url']}")
                    row_to_skill[r["url"]] = sid
                    merged_rows.append({**r, "concept": clabel, "mcp_server": mrow[0] if r["source"] in mnote["platform_sources"] else "",
                                        "topic_id": pid, "concept_id": cid, "skill_id": sid})
        platform = all(r["source"] in mnote["platform_sources"] for c in cs.values() for s in c.values() for r in s)
        merges_here = [x for x in log if pid in (tid_of[x["from_topic"]], tid_of[x["into_topic"]])]
        packs[pid] = {
            "schema": "human0.topic-pack/1", "id": pid,
            "topic": {"id": pid, "label": t, "desc": clean(f"{t}: " + ", ".join(c[1] for c in concepts) + ".")},
            "concepts": concepts, "skills": skills, "agents": agents,
            "mcp": [mrow] if platform else [],
            "lexicon": lexicon(lex_in),
            "provenance": {
                "domain": "claude",
                "levels": {"topic": "user", "concepts": "user", "skills": "user", "agents": "user", "mcp": "real"},
                "basis": f"Human0's claude_domain.csv (sha256 {csv_sha}), converted by tools/claude_domain/build_claude_packs.py on 2026-11-27. Topics, concepts, skills (docs pages) and agent names are Human0's. A single-page skill's description is that page's own one-line description where the site publishes one (page_descriptions.json: llms.txt / llms-full.txt fetched {PD['basis']['fetched']}); concept descriptions, other skill descriptions, keywords, skill types (a verb rule), ids and the lexicon are generated from the CSV text.",
                "concept_merges": merges_here,
                "mcp_checked_at": "2026-11-27",
                "mcp_notes": mnote["note_platform"] if platform else mnote["note_other"],
                "limitations": "Skills without a published page description (API reference endpoints and some guides) are described by their titles only; skill types come from the first word of the title. Docs pages change: the URLs were current in the CSV, not re-checked here.",
                "sources": sources}}

    # --- Claude Duet --------------------------------------------------------------------------------
    t = duet["topic"]["label"]; pid = duet["id"]
    if pid in used_ids: sys.exit(f"topic id {pid} already used")
    used_ids.add(pid)
    spec_k, rev_k, res_k = f"{pid}-specialist", f"{pid}-reviewer", "claude-docs-researcher"
    dconcepts = []
    for c in duet["concepts"]:
        lab = concept_label(c[1], surf_of[t])
        if c[0] in used_ids: sys.exit(f"duet concept id {c[0]} collides")
        used_ids.add(c[0]); dconcepts.append([c[0], lab, c[2], c[3], c[4]])
    dskills = []
    for s in duet["skills"]:
        if s[0] in used_ids: sys.exit(f"duet skill id {s[0]} collides")
        used_ids.add(s[0])
        dskills.append(s[:5] + [[[spec_k, "primary"], [rev_k, "checker"], [res_k, "support"]]])
    agents = {spec_k: "Claude Duet Specialist", rev_k: "Claude Duet Reviewer", res_k: "Claude Docs Researcher"}
    lab_of = {c[0]: c[1] for c in dconcepts}
    lex_in = [(c[1], [c[1], c[3]] + [s[2] + " " + s[3] for s in dskills if s[1] == c[0]]) for c in dconcepts]
    packs[pid] = {"schema": "human0.topic-pack/1", "id": pid, "topic": duet["topic"], "concepts": dconcepts,
                  "skills": dskills, "agents": agents, "mcp": [], "lexicon": lexicon(lex_in),
                  "provenance": {"domain": "claude", **duet["provenance"]}}
    for s in dskills:
        merged_rows.append({"domain": "Claude", "topic": t, "concept": lab_of[s[1]], "skill": s[2], "page_title": s[2], "url": "",
                            "source": "generated (Claude Duet harness, 2026-11-27)", "agent_primary": agents[spec_k],
                            "agent_checker": agents[rev_k], "agent_support": agents[res_k], "mcp_server": "",
                            "topic_id": pid, "concept_id": s[1], "skill_id": s[0]})

    # --- checks (validate_topic_pack rules, plus lossless mapping) -------------------------------------
    problems = []
    for pid, p in packs.items():
        if not 3 <= len(p["concepts"]) <= 8: problems.append(f"{pid}: {len(p['concepts'])} concepts (3-8)")
        cids = {c[0] for c in p["concepts"]}
        for c in p["concepts"]:
            if not any(s[1] == c[0] for s in p["skills"]): problems.append(f"{pid}: concept {c[0]} has no skills")
        for s in p["skills"]:
            if s[1] not in cids: problems.append(f"{pid}: skill {s[0]} -> unknown concept")
            roles = [r for _, r in s[5]]
            if roles.count("primary") != 1 or roles.count("checker") != 1: problems.append(f"{pid}: skill {s[0]} roles {roles}")
            if any(k not in p["agents"] for k, _ in s[5]): problems.append(f"{pid}: skill {s[0]} agent not in pack")
        def walk(v, path):
            if isinstance(v, str):
                if BAD.search(v): problems.append(f"{path}: bad character")
                if len(v) > 2000: problems.append(f"{path}: {len(v)} chars")
            elif isinstance(v, list): [walk(x, f"{path}[{i}]") for i, x in enumerate(v)]
            elif isinstance(v, dict): [walk(x, f"{path}.{k}") for k, x in v.items()]
        walk({k: v for k, v in p.items() if k != "provenance"}, pid)
        for i in [c[0] for c in p["concepts"]] + [s[0] for s in p["skills"]] + [pid]:
            if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", i): problems.append(f"{pid}: id {i} not a slug")
    if set(row_to_skill) != set(urls): problems.append("not every CSV row maps to one skill")
    src_urls = [u for p in packs.values() for us in p["provenance"].get("sources", {}).values() for u in us]
    if sorted(src_urls) != sorted(urls): problems.append("provenance.sources is not the CSV's URL set, each once")
    if problems:
        sys.exit("problems:\n  " + "\n  ".join(problems[:50]))

    after = {"topics": len(packs), "concepts": sum(len(p["concepts"]) for p in packs.values()),
             "skills": sum(len(p["skills"]) for p in packs.values()),
             "agents": len({k for p in packs.values() for k in p["agents"]}),
             "mcp_rows": sum(len(p["mcp"]) for p in packs.values()),
             "mcp_servers": len({m[1] or m[0] for p in packs.values() for m in p["mcp"]}),
             "urls": len(src_urls), "merged_csv_rows": len(merged_rows)}
    for pid, p in packs.items():
        with open(os.path.join(PACKS, f"{pid}.pack.json"), "w", encoding="utf-8") as fh:
            fh.write(dump(p))
    print(json.dumps({"before_csv": before, "after": after, "merges": len(log)}))
    if not a.report_dir:
        return
    os.makedirs(a.report_dir, exist_ok=True)
    with open(os.path.join(a.report_dir, "claude_domain_merged.csv"), "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=COLS + ["topic_id", "concept_id", "skill_id"])
        w.writeheader(); w.writerows(merged_rows)
    report = {"before_csv": before,
              "before_with_duet": {"topics": before["topics"] + 1, "concepts": before["concepts"] + len(duet["concepts"]),
                                   "skills": before["skills"] + len(duet["skills"])},
              "after": after, "merges": log, "merge_count": len(log),
              "topics": {pid: {"label": p["topic"]["label"], "concepts": len(p["concepts"]), "skills": len(p["skills"]),
                               "mcp": [m[0] for m in p["mcp"]]} for pid, p in packs.items()},
              "checks": {"validate_topic_pack_rules": "pass", "every_csv_row_to_one_skill": "pass",
                         "provenance_sources_equal_csv_urls": "pass"},
              "csv_sha256": csv_sha}
    with open(os.path.join(a.report_dir, "merge_report.json"), "w", encoding="utf-8") as fh:
        fh.write(dump(report))


if __name__ == "__main__":
    main()
