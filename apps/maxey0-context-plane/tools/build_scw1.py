#!/usr/bin/env python3
"""SCW1 builder: one rule set (SCW1/ontology.spec.json) applied to raw sources.

  import  copy raw sources into SCW1/sources once (pack files, the physics pack
          embedded in the Context Plane html, and the original Maxey0 base graph
          `const D` / `M` / `LEX` from the html). Removed topics are not copied.
  build   SCW1/sources + spec -> SCW1/scw1.graph.json, SCW1/harnesses/*.json,
          SCW1/scw1.manifest.json, SCW1/build_report.json, server/src/scw1.bundle.json

Graph shape (every thread):  Domain -> Topic -> Concept -> Skill   (one parent each)
Differentiation below skill: Skill -> Agents (primary/checker/support) -> MCP servers
Agents and MCP servers are global (one node each), not per-topic copies.
The build fails on any invariant breach; nothing is silently repaired.
"""
import argparse, collections, glob, hashlib, json, math, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SCW = os.path.join(ROOT, "SCW1")
SRC = os.path.join(SCW, "sources")
PACK_SCHEMA = "human0.topic-pack/1"
HARNESS_SCHEMA = "maxey0.topic-harness/3"
GRAPH_SCHEMA = "maxey0.scw1-graph/3"
ROLE_RANK = {"primary": 0, "checker": 1, "support": 2}
STOP = set("a an and the of in on for to with by from as at or into over across its their this that is are be "
           "using use used via per each all any not no new data".split())


def canon(o):
    return json.dumps(o, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def digest(o):
    return "sha256:" + hashlib.sha256(canon(o).encode("utf-8")).hexdigest()


def tokens(s):
    """The one tokenizer (mirrored exactly in server/src/sim.ts, parity-tested)."""
    out = []
    for w in re.findall(r"[a-z0-9]+", str(s).replace("_", " ").lower()):
        if w in STOP or len(w) <= 2:
            continue
        out.append(w[:-1] if len(w) > 3 and w.endswith("s") and not w.endswith("ss") else w)
    return out


class Sim:
    """The one similarity method: TF-IDF vectors, cosine.
    tf weight = 1 + ln(count); idf = ln((N + 1) / (df + 1)) + 1 over the corpus of
    concept, skill and MCP documents; vectors are L2-normalised, so cosine = dot."""
    def __init__(self, corpus_texts):
        df = collections.Counter()
        for x in corpus_texts:
            df.update(set(tokens(x)))
        n = len(corpus_texts)
        self.idf = {w: round(math.log((n + 1) / (d + 1)) + 1, 6) for w, d in sorted(df.items())}
    def vec(self, text):
        tf = collections.Counter(w for w in tokens(text) if w in self.idf)
        v = {w: (1 + math.log(c)) * self.idf[w] for w, c in tf.items()}
        norm = math.sqrt(sum(x * x for x in v.values())) or 1.0
        return {w: round(x / norm, 6) for w, x in sorted(v.items())}
    @staticmethod
    def cos(a, b):
        """Cosine, counted only when the two sides share >= min(2, terms in the shorter side);
        a single rare shared word is not evidence of similarity."""
        if len(a) > len(b):
            a, b = b, a
        shared = [w for w in a if w in b]
        if len(shared) < min(2, len(a)):
            return 0.0
        return sum(a[w] * b[w] for w in shared)



def fail(msg):
    sys.exit("FAIL: " + msg)


# ------------------------------------------------------------------ import
def raw_after(h, marker):
    i = h.find(marker)
    if i < 0:
        fail(f"'{marker}' not found")
    return json.JSONDecoder().raw_decode(h, i + len(marker))[0]


def cmd_import(a):
    spec = json.load(open(os.path.join(SCW, "ontology.spec.json"), encoding="utf-8"))
    removed = set(spec["removed_topics"])
    os.makedirs(os.path.join(SRC, "packs"), exist_ok=True)
    seen = {}
    for f in sorted(glob.glob(os.path.join(a.packs, "*.json"))):
        p = json.load(open(f, encoding="utf-8"))
        if p.get("schema") != PACK_SCHEMA:
            fail(f"{f}: schema {p.get('schema')!r}")
        seen[p["id"]] = p
    h = open(a.html, encoding="utf-8").read()
    phys = raw_after(h, "const PHYSICS_PACK=")
    if phys["id"] in seen and canon(seen[phys["id"]]) != canon(phys):
        fail("physics pack differs between file and html")
    seen[phys["id"]] = phys
    for pid, p in sorted(seen.items()):
        if pid in removed:
            continue
        with open(os.path.join(SRC, "packs", f"{pid}.pack.json"), "w", encoding="utf-8") as fh:
            json.dump(p, fh, ensure_ascii=False, indent=1)
    D = raw_after(h, "const D=")
    M = raw_after(h, ",M=")
    i = h.find("const LEX={")
    lex = dict(re.findall(r"(\w+):'([^']*)'", h[i:h.find("};", i)]))
    with open(os.path.join(SRC, "maxey0_base.json"), "w", encoding="utf-8") as fh:
        json.dump({"source": os.path.basename(a.html), "D": D, "M": M, "LEX": lex}, fh, ensure_ascii=False, indent=1)
    print(json.dumps({"imported_packs": len([p for p in seen if p not in removed]),
                      "skipped_removed": sorted(removed & set(seen)), "base_version": D.get("version")}))


# ------------------------------------------------------------------ build
def cmd_build(a):
    spec = json.load(open(os.path.join(SCW, "ontology.spec.json"), encoding="utf-8"))
    packs = {}
    for f in sorted(glob.glob(os.path.join(SRC, "packs", "*.pack.json"))):
        p = json.load(open(f, encoding="utf-8"))
        packs[p["id"]] = p
    base = json.load(open(os.path.join(SRC, "maxey0_base.json"), encoding="utf-8"))
    D, M = base["D"], base["M"]
    for t in spec["removed_topics"]:
        if t in packs:
            fail(f"removed topic {t} is still in sources")
    before = {"topics": len(packs) + len({c[2] for c in D["concepts"]}),
              "concepts": sum(len(p["concepts"]) for p in packs.values()) + len(D["concepts"]),
              "skills": sum(len(p["skills"]) for p in packs.values()) + len(D["skills"]),
              "agents": sum(len(p["agents"]) for p in packs.values()) + len(D["agents"]),
              "mcp_rows": sum(len(p["mcp"]) for p in packs.values()) + len(M)}
    log = collections.defaultdict(list)

    # --- topics ---------------------------------------------------------
    merged_into = {}
    for dst, m in spec["topic_merges"].items():
        for s in m["from"]:
            if s not in packs:
                fail(f"topic merge source {s} missing")
            merged_into[s] = dst
    topics = {}
    for pid, p in packs.items():
        tid = merged_into.get(pid, pid)
        if tid in topics:
            continue
        if tid in spec["topic_merges"]:
            m = spec["topic_merges"][tid]
            topics[tid] = {"id": tid, "label": m["label"], "desc": m["desc"], "sources": list(m["from"])}
            log["topic_merges"].append({"into": tid, "from": m["from"], "reason": m["reason"]})
        else:
            topics[tid] = {"id": tid, "label": p["topic"]["label"], "desc": p["topic"]["desc"], "sources": [pid]}
    for tid, m in spec["maxey0_topics"].items():
        topics[tid] = {"id": tid, "label": m["label"], "desc": m["desc"], "sources": ["maxey0_base"]}
    work = set(spec["work_topics"])
    for t in list(work) + [x for ts in spec.get("domain_topics", {}).values() for x in ts]:
        if t not in topics:
            fail(f"work topic {t} missing")
    for tid, t in topics.items():
        dt = next((d for d, ts in spec.get("domain_topics", {}).items() if tid in ts), None)
        t["domain"] = dt or ("maxey0-system" if tid in spec["maxey0_topics"] else ("work" if tid in work else "disciplines"))

    # --- agents (global) -------------------------------------------------
    agents, home = {}, {}
    for pid, p in packs.items():
        for k, n in p["agents"].items():
            if k in agents and agents[k] != n:
                fail(f"agent key {k} has two names: {agents[k]!r} / {n!r}")
            agents[k] = n
            home[k] = merged_into.get(pid, pid)
    for k, n in D["agents"].items():
        if k in agents and agents[k] != n:
            fail(f"agent key {k} collides with base")
        agents[k] = n
        home[k] = "maxey0_base"
    slug = lambda s: re.sub(r"[^a-z0-9]+", "-", str(s).lower())
    base_slug = {slug(n): k for k, n in D["agents"].items()}
    remap = {}
    by_name = {}
    for k in agents:  # insertion order = build order; same name merges only within one home topic
        nm = (home[k], agents[k].strip().lower())
        if nm in by_name:
            remap[k] = by_name[nm]
        else:
            by_name[nm] = k
    for k, keep in remap.items():
        log["agent_merges"].append({"merged": k, "into": keep, "name": agents[keep], "home_topic": home[k]})
    agents = {k: n for k, n in agents.items() if k not in remap}
    rk = lambda k: remap.get(k, k)

    # --- concepts + skills ----------------------------------------------
    concepts, skills = {}, {}
    def add_concept(cid, label, desc, kws, tid, src):
        if cid in concepts:
            fail(f"duplicate concept id {cid}")
        concepts[cid] = {"id": cid, "label": label, "desc": desc, "keywords": list(kws), "topic": tid, "source": src}
    def add_skill(s, src, resolve=lambda k: k):
        if s[0] in skills:
            fail(f"duplicate skill id {s[0]}")
        ag = {}
        for k, r in s[5]:
            k = rk(resolve(k))
            if k not in agents:
                fail(f"skill {s[0]} -> unknown agent {k}")
            if k not in ag or ROLE_RANK[r] < ROLE_RANK[ag[k]]:
                ag[k] = r
        skills[s[0]] = {"id": s[0], "concept": s[1], "label": s[2], "desc": s[3], "type": s[4],
                        "agents": [{"key": k, "role": r} for k, r in sorted(ag.items(), key=lambda x: ROLE_RANK[x[1]])],
                        "source": src}
    for pid, p in packs.items():
        tid = merged_into.get(pid, pid)
        for c in p["concepts"]:
            add_concept(c[0], c[1], c[3], c[4], tid, pid)
        for s in p["skills"]:
            add_skill(s, pid)
    m_topic = {c: t for t, m in spec["maxey0_topics"].items() for c in m["concepts"]}
    px = spec["id_rules"]["maxey0_concept_prefix"]
    for c in D["concepts"]:
        if c[0] in spec.get("dropped_concepts", {}):
            log["dropped_concepts"].append({"id": c[0], "reason": spec["dropped_concepts"][c[0]]})
            continue
        if c[0] not in m_topic:
            fail(f"base concept {c[0]} has no maxey0 topic in spec")
        add_concept(px + c[0], spec["maxey0_concept_labels"].get(c[0], c[1]),
                    c[3] or spec["maxey0_concept_descs"].get(c[0], ""), c[4], m_topic[c[0]], "maxey0_base")
    resolve = lambda k: k if k in D["agents"] else base_slug.get(k, k)
    for s in D["skills"]:
        if s[0] in spec["dropped_skills"]:
            log["dropped_skills"].append({"id": s[0], "reason": spec["dropped_skills"][s[0]]})
            continue
        add_skill([s[0], px + s[1]] + s[2:], "maxey0_base", resolve)

    for src, dst in spec["concept_merges"].items():
        if src not in concepts or dst not in concepts:
            fail(f"concept merge {src} -> {dst}: id missing")
        have = {skills[s]["label"].lower() for s in skills if skills[s]["concept"] == dst}
        moved, dropped = [], []
        for sid in [s for s in skills if skills[s]["concept"] == src]:
            if skills[sid]["label"].lower() in have:
                del skills[sid]; dropped.append(sid)
            else:
                skills[sid]["concept"] = dst; moved.append(sid); have.add(skills[sid]["label"].lower())
        kw = concepts[dst]["keywords"]
        concepts[dst]["keywords"] = kw + [k for k in concepts[src]["keywords"] if k not in kw]
        log["concept_merges"].append({"from": src, "from_label": concepts[src]["label"], "from_topic": concepts[src]["topic"],
                                      "into": dst, "into_label": concepts[dst]["label"], "skills_moved": moved,
                                      "skills_dropped_as_duplicate": dropped})
        del concepts[src]
    for cid, dst in spec.get("concept_moves", {}).items():
        if cid not in concepts or dst not in topics:
            fail(f"concept move {cid} -> {dst}: missing")
        log["concept_moves"].append({"id": cid, "from": concepts[cid]["topic"], "to": dst})
        concepts[cid]["topic"] = dst
    for cid, lab in spec["concept_renames"].items():
        if cid not in concepts:
            fail(f"rename: concept {cid} missing")
        log["concept_renames"].append({"id": cid, "from": concepts[cid]["label"], "to": lab})
        concepts[cid]["label"] = lab

    # same-name agents that now serve skills in a common topic (concept merges move skills,
    # with their agents, across topics) are one agent: union-find, first key in build order wins
    serves = collections.defaultdict(set)
    for s in skills.values():
        for a_ in s["agents"]:
            serves[a_["key"]].add(concepts[s["concept"]]["topic"])
    parent = {k: k for k in agents}
    def find(k):
        while parent[k] != k:
            parent[k] = parent[parent[k]]; k = parent[k]
        return k
    order_k = list(agents)
    by_nm = collections.defaultdict(list)
    for k in order_k:
        if k in serves:
            by_nm[agents[k].strip().lower()].append(k)
    for nm, ks in by_nm.items():
        for i, x in enumerate(ks):
            for y in ks[i + 1:]:
                if serves[x] & serves[y]:
                    rx, ry = find(x), find(y)
                    if rx != ry:
                        a_, b_ = sorted((rx, ry), key=order_k.index)
                        parent[b_] = a_
    post = {k: find(k) for k in agents if find(k) != k}
    for k, keep in post.items():
        log["agent_merges"].append({"merged": k, "into": keep, "name": agents[keep], "reason": "same name, shared topic after concept merges"})
    for s in skills.values():
        ag = {}
        for a_ in s["agents"]:
            k = post.get(a_["key"], a_["key"])
            if k not in ag or ROLE_RANK[a_["role"]] < ROLE_RANK[ag[k]]:
                ag[k] = a_["role"]
        s["agents"] = [{"key": k, "role": r} for k, r in sorted(ag.items(), key=lambda x: ROLE_RANK[x[1]])]
    for s in skills.values():
        if not any(a_["role"] == "primary" for a_ in s["agents"]):
            fail(f"post-merge: skill {s['id']} lost its primary agent")

    # agents no longer used by any skill are trimmed
    used = {a["key"] for s in skills.values() for a in s["agents"]}
    for k in [k for k in agents if k not in used]:
        log["agents_trimmed_unused"].append({"key": k, "name": agents[k]})
        del agents[k]

    # --- MaxeyN keys: every specialised agent is a Maxey agent ------------------
    # Keys already in MaxeyN form (the base graph's) are kept. Every other agent's key
    # comes from SCW1/maxey_registry.json (source key -> MaxeyN), so a key never changes
    # between builds. Agents not yet in the registry get the next free number, in graph
    # order (domain, topic, concept, skill), and are appended to the registry.
    mx = re.compile(spec["id_rules"]["maxey_agent_key"]["pattern"])
    reg_path = os.path.join(SCW, "maxey_registry.json")
    registry = json.load(open(reg_path, encoding="utf-8")) if os.path.exists(reg_path) else {}
    if len(set(registry.values())) != len(registry):
        fail("maxey_registry.json maps two source keys to one MaxeyN key")
    taken = {k for k in agents if mx.fullmatch(k)} | set(registry.values())
    nxt = max(int(k[5:]) for k in taken) + 1
    dom_order = [d["id"] for d in spec["domains"]]
    def gkey(s):
        tid = concepts[s["concept"]]["topic"]
        return (dom_order.index(topics[tid]["domain"]), tid, s["concept"], s["id"])
    legacy, newkey, added = {}, {}, []
    for s in sorted(skills.values(), key=gkey):
        for a_ in s["agents"]:
            k = a_["key"]
            if mx.fullmatch(k) or k in newkey:
                continue
            if k in registry:
                newkey[k] = registry[k]
            else:
                newkey[k] = f"Maxey{nxt}"; nxt += 1
                registry[k] = newkey[k]; added.append({"source_key": k, "key": newkey[k], "name": agents[k]})
    if len(set(newkey.values())) != len(newkey) or set(newkey.values()) & {k for k in agents if mx.fullmatch(k)}:
        fail("MaxeyN key collision")
    for k, nk in newkey.items():
        agents[nk] = agents.pop(k)
        legacy[nk] = k
    for s in skills.values():
        for a_ in s["agents"]:
            a_["key"] = newkey.get(a_["key"], a_["key"])
    with open(reg_path, "w", encoding="utf-8") as fh:
        json.dump(dict(sorted(registry.items())), fh, ensure_ascii=False, indent=1)
    log["maxey_keys"] = {"from_registry": len(newkey) - len(added), "newly_assigned": added}

    for o in spec.get("skill_agent_overrides", []):
        s = skills.get(o["skill"])
        if not s or o["to"] not in agents or not any(a_["key"] == o["from"] and a_["role"] == o["role"] for a_ in s["agents"]):
            fail(f"skill_agent_override {o}: skill, 'from' agent in role, or 'to' agent missing")
        s["agents"] = [a_ for a_ in s["agents"] if a_["key"] != o["to"]]
        for a_ in s["agents"]:
            if a_["key"] == o["from"] and a_["role"] == o["role"]:
                a_["key"] = o["to"]
        log["skill_agent_overrides"].append(o)
    used = {a_["key"] for s in skills.values() for a_ in s["agents"]}
    for k in [k for k in agents if k not in used]:
        log["agents_trimmed_unused"].append({"key": k, "name": agents[k], "after": "overrides"})
        del agents[k]

    # --- lexicon per topic ----------------------------------------------
    lexicon = collections.defaultdict(dict)
    for pid, p in packs.items():
        tid = merged_into.get(pid, pid)
        for dom, words in p.get("lexicon", {}).items():
            cur = lexicon[tid].get(dom)
            lexicon[tid][dom] = words if not cur else " ".join(dict.fromkeys((cur + " " + words).split()))
    for tid in spec["maxey0_topics"]:
        lexicon[tid] = dict(base["LEX"])

    # --- MCP registry + agent links --------------------------------------
    mcp = {}
    def reg(row, origin):
        # rows without a directory uuid (local servers) get a stable local id
        u = row["uuid"] or "local:" + slug(row["name"])
        row["id"] = u
        if u in mcp:
            if mcp[u]["name"] != row["name"]:
                fail(f"mcp uuid {u} has two names")
            mcp[u]["origins"].add(origin)
            return u
        else:
            mcp[u] = dict(row, origins={origin})
        return u
    # one corpus, one index: concepts, skills and every MCP row the sources mention
    ctext = lambda c: " ".join([c["label"], c["desc"], " ".join(c["keywords"])])
    stext = lambda s: s["label"] + " " + s["desc"]
    mtext = lambda m: " ".join([m["name"], m["desc"], " ".join(m["tools"])])
    mrows = [{"name": m[0], "desc": m[2], "tools": m[3]} for p in packs.values() for m in p["mcp"]] + \
            [{"name": m[0], "desc": m[2], "tools": m[3]} for m in M]
    sim = Sim([ctext(c) for c in concepts.values()] + [stext(s) for s in skills.values()] + [mtext(m) for m in mrows])
    TH = spec["similarity"]["thresholds"]
    cvec = {c["id"]: sim.vec(ctext(c)) for c in concepts.values()}
    svec = {s["id"]: sim.vec(stext(s)) for s in skills.values()}
    agent_skill_vecs = collections.defaultdict(list)  # agent -> one vector per skill it serves (+ agent name)
    agent_topics = collections.defaultdict(set)
    for s in skills.values():
        t = concepts[s["concept"]]["topic"]
        for a_ in s["agents"]:
            agent_skill_vecs[a_["key"]].append(sim.vec(stext(s) + " " + agents[a_["key"]]))
            agent_topics[a_["key"]].add(t)
    links = []
    topic_mcp = collections.defaultdict(list)
    def link(u, cand, topic, topic_of=None):
        mv = sim.vec(mtext(mcp[u]))
        # best single skill, so agents serving many skills do not win by volume
        sc = sorted(((round(max((Sim.cos(mv, v) for v in agent_skill_vecs[k]), default=0.0), 4), k) for k in cand),
                    key=lambda x: (-x[0], x[1]))
        top = [(n, k) for n, k in sc[:TH["mcp_link_top_k"]] if n >= TH["mcp_link"]]
        if top:
            for n, k in top:
                links.append({"agent": k, "mcp": u, "topic": topic_of(k) if topic_of else topic, "score": n, "basis": "derived:tfidf-cosine"})
            return True
        return False
    # a server a pack lists belongs to every topic that received that pack's concepts
    # (its own topic, plus the topics its concepts were merged or moved into)
    cmerge = spec["concept_merges"]
    for pid, p in packs.items():
        tid = merged_into.get(pid, pid)
        rec = [tid] + sorted({concepts[cmerge.get(c[0], c[0])]["topic"] for c in p["concepts"]
                              if cmerge.get(c[0], c[0]) in concepts} - {tid})
        cand = sorted(k for k in agents if agent_topics[k] & set(rec))
        topic_of = lambda k, rec=rec: next(x for x in rec if x in agent_topics[k])
        for m in p["mcp"]:
            u = reg({"uuid": m[1], "name": m[0], "desc": m[2], "tools": m[3], "state": m[4], "source": m[5]}, pid)
            new = [x for x in rec if u not in topic_mcp[x]]
            for x in new:
                topic_mcp[x].append(u)
            if new:
                link(u, cand, tid, topic_of)
    mx_agents = sorted(k for k in agents if agent_topics[k] & set(spec["maxey0_topics"]))
    for m in M:
        u = reg({"uuid": m[1], "name": m[0], "desc": m[2], "tools": m[3], "state": m[4],
             "source": "Maxey0 base graph MCP table"}, "maxey0_base")
        if any(l["mcp"] == u for l in links):
            continue
        if not link(u, mx_agents, None) and mcp[u]["origins"] == {"maxey0_base"}:
            log["mcp_trimmed_unused"].append({"id": u, "name": m[0]})
            del mcp[u]
    # dedupe identical (agent, mcp) pairs across topics: keep highest score
    best = {}
    for l in links:
        key = (l["agent"], l["mcp"])
        if key not in best or l["score"] > best[key]["score"]:
            best[key] = l
    for d in spec.get("declared_mcp_links", []):
        if d["agent"] not in agents or d["mcp"] not in mcp:
            fail(f"declared link {d['agent']} -> {d['mcp']}: end missing")
        best[(d["agent"], d["mcp"])] = {"agent": d["agent"], "mcp": d["mcp"], "topic": None, "score": None, "basis": "declared:spec"}
    # checker rule: a checker holds the servers its primary holds for that skill's topic
    for s in sorted(skills.values(), key=lambda s: s["id"]):
        stopic = concepts[s["concept"]]["topic"]
        prim = [a_["key"] for a_ in s["agents"] if a_["role"] == "primary"]
        chk = [a_["key"] for a_ in s["agents"] if a_["role"] == "checker"]
        for p_ in prim:
            for l in [l for l in list(best.values()) if l["agent"] == p_ and l["topic"] in (stopic, None)
                      and not l["basis"].startswith("inherited")]:
                for c_ in chk:
                    if (c_, l["mcp"]) not in best:
                        best[(c_, l["mcp"])] = {"agent": c_, "mcp": l["mcp"], "topic": stopic, "score": l["score"],
                                                "basis": "inherited:checker-of-primary", "via": {"primary": p_, "skill": s["id"]}}
    links = sorted(best.values(), key=lambda l: (l["agent"], l["mcp"]))
    for m in mcp.values():
        m["origins"] = sorted(m["origins"])

    # --- related concepts --------------------------------------------------
    related = []
    cl = sorted(concepts.values(), key=lambda c: c["id"])
    for i, x in enumerate(cl):
        for y in cl[i + 1:]:
            if x["topic"] == y["topic"]:
                continue
            sc = round(Sim.cos(cvec[x["id"]], cvec[y["id"]]), 4)
            if sc >= TH["related"]:
                related.append({"a": x["id"], "b": y["id"], "score": sc, "basis": "derived:tfidf-cosine"})

    # --- invariants (fail hard) ------------------------------------------
    problems = []
    dom_ids = {d["id"] for d in spec["domains"]}
    tl = collections.Counter(t["label"].lower() for t in topics.values())
    problems += [f"topic label not unique: {l}" for l, n in tl.items() if n > 1]
    cll = collections.Counter(c["label"].lower() for c in concepts.values())
    problems += [f"concept label not unique: {l}" for l, n in cll.items() if n > 1]
    problems += [f"concept label equals a topic label: {c['id']} '{c['label']}'" for c in concepts.values()
                 if c["label"].lower() in tl]
    for t in topics.values():
        if t["domain"] not in dom_ids:
            problems.append(f"topic {t['id']} bad domain")
        n = sum(1 for c in concepts.values() if c["topic"] == t["id"])
        if n < 3:
            problems.append(f"topic {t['id']} has {n} concepts (<3)")
    for c in concepts.values():
        if c["topic"] not in topics:
            problems.append(f"concept {c['id']} orphan")
        if not any(s["concept"] == c["id"] for s in skills.values()):
            problems.append(f"concept {c['id']} has no skills")
    for s in skills.values():
        if s["concept"] not in concepts:
            problems.append(f"skill {s['id']} orphan")
        if not any(a_["role"] == "primary" for a_ in s["agents"]):
            problems.append(f"skill {s['id']} has no primary agent")
    linked = {l["mcp"] for l in links}
    listed = {u for v in topic_mcp.values() for u in v}
    problems += [f"mcp {u} has no agent and no topic" for u in mcp if u not in linked and u not in listed]
    problems += [f"agent key not MaxeyN: {k}" for k in agents if not mx.fullmatch(k)]
    ids = collections.Counter(list(dom_ids) + list(topics) + list(concepts) + list(skills) + list(agents))
    problems += [f"id used on two levels: {i}" for i, n in ids.items() if n > 1]
    if problems:
        fail("invariants:\n  " + "\n  ".join(problems[:60]))

    # --- outputs --------------------------------------------------------
    order = sorted(topics, key=lambda t: ([d["id"] for d in spec["domains"]].index(topics[t]["domain"]), t))
    graph = {
        "schema": GRAPH_SCHEMA, "scw": "SCW1",
        "domains": spec["domains"],
        "topics": [dict({k: topics[t][k] for k in ("id", "label", "desc", "domain", "sources")},
                        priority=spec["topic_priority"]["topics"].get(t, spec["topic_priority"]["default"])) for t in order],
        "topic_priority": {k: v for k, v in spec["topic_priority"].items() if k != "topics"},
        "concepts": sorted(concepts.values(), key=lambda c: (order.index(c["topic"]), c["id"])),
        "skills": sorted(skills.values(), key=lambda s: (order.index(concepts[s["concept"]]["topic"]), s["concept"], s["id"])),
        "agents": [dict({"key": k, "name": agents[k]}, **({"legacy_key": legacy[k]} if k in legacy else {}))
                   for k in sorted(agents, key=lambda k: int(k[5:]) if mx.fullmatch(k) else 10**9)],
        "mcp": [mcp[u] for u in sorted(mcp, key=lambda u: (mcp[u]["name"].lower(), u))],
        "agent_mcp": links, "topic_mcp": {t: topic_mcp[t] for t in order if topic_mcp[t]}, "related": related, "lexicon": {t: lexicon[t] for t in order},
        "similarity": {"method": spec["similarity"]["method"], "thresholds": TH, "idf": sim.idf,
                       "vectors": {**{"c:" + k: v for k, v in sorted(cvec.items())}, **{"s:" + k: v for k, v in sorted(svec.items())}}},
    }
    graph["snapshot_digest"] = digest({k: v for k, v in graph.items() if k != "snapshot_digest"})
    totals = {"domains": len(spec["domains"]), "topics": len(topics), "concepts": len(concepts), "skills": len(skills),
              "agents": len(agents), "mcp_servers": len(mcp), "agent_mcp_links": len(links), "related_links": len(related),
              "mcp_without_agent": len([u for u in mcp if u not in {l["mcp"] for l in links}])}

    hdir = os.path.join(SCW, "harnesses")
    os.makedirs(hdir, exist_ok=True)
    for f in glob.glob(os.path.join(hdir, "*.harness.json")):  # remove only harnesses no longer in the graph
        if os.path.basename(f)[:-len(".harness.json")] not in topics:
            os.remove(f)
    entries = []
    for t in order:
        cs = [c for c in graph["concepts"] if c["topic"] == t]
        cids = {c["id"] for c in cs}
        sk = [s for s in graph["skills"] if s["concept"] in cids]
        aks = sorted({a_["key"] for s in sk for a_ in s["agents"]})
        lk = [l for l in links if l["agent"] in aks and l["topic"] in (t, None)]
        h = {"schema": HARNESS_SCHEMA, "scw": "SCW1", "domain": topics[t]["domain"],
             "topic": {k: topics[t][k] for k in ("id", "label", "desc")},
             "concepts": [dict(c, related=sorted({r["b"] if r["a"] == c["id"] else r["a"] for r in related
                                                  if c["id"] in (r["a"], r["b"])})) for c in cs],
             "skills": sk,
             "agents": [dict({"key": k, "name": agents[k]}, **({"legacy_key": legacy[k]} if k in legacy else {}),
                             mcp=sorted({l["mcp"] for l in lk if l["agent"] == k})) for k in aks],
             "mcp": [mcp[u] for u in sorted({l["mcp"] for l in lk} | set(topic_mcp[t]))],
             "topic_mcp": topic_mcp[t],
             "agent_mcp": lk, "lexicon": lexicon[t], "sources": topics[t]["sources"]}
        with open(os.path.join(SCW, "harnesses", f"{t}.harness.json"), "w", encoding="utf-8") as fh:
            json.dump(h, fh, ensure_ascii=False, indent=1)
        entries.append({"id": t, "domain": topics[t]["domain"], "label": topics[t]["label"],
                        "counts": {"concepts": len(cs), "skills": len(sk), "agents": len(aks), "mcp": len(h["mcp"])},
                        "digest": digest(h)})
    with open(os.path.join(SCW, "scw1.graph.json"), "w", encoding="utf-8") as fh:
        json.dump(graph, fh, ensure_ascii=False, indent=1)
    with open(os.path.join(SCW, "scw1.manifest.json"), "w", encoding="utf-8") as fh:
        json.dump({"scw": "SCW1", "name": "Maxey0 Context Plane - Topic Harness Set (feeds the Human0 app)", "schema": HARNESS_SCHEMA,
                   "graph_schema": GRAPH_SCHEMA, "spec": "ontology.spec.json", "snapshot_digest": graph["snapshot_digest"],
                   "totals": totals, "entries": entries}, fh, ensure_ascii=False, indent=1)
    with open(os.path.join(SCW, "build_report.json"), "w", encoding="utf-8") as fh:
        json.dump({"before_sources": before, "after": totals, "removed_topics": spec["removed_topics"], **log},
                  fh, ensure_ascii=False, indent=1)
    os.makedirs(os.path.join(ROOT, "server", "src"), exist_ok=True)
    with open(os.path.join(ROOT, "server", "src", "scw1.bundle.json"), "w", encoding="utf-8") as fh:
        json.dump(graph, fh, ensure_ascii=False, separators=(",", ":"))
    print(json.dumps({"ok": True, "totals": totals, "snapshot_digest": graph["snapshot_digest"]}))


def main():
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="cmd", required=True)
    i = sp.add_parser("import")
    i.add_argument("--packs", required=True)
    i.add_argument("--html", required=True, help="Context Plane html carrying PHYSICS_PACK and the base graph")
    sp.add_parser("build")
    a = ap.parse_args()
    cmd_import(a) if a.cmd == "import" else cmd_build(a)


if __name__ == "__main__":
    main()
