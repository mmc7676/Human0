"""Build the "Claude" domain of the Maxey0 Context Plane from Anthropic's own documentation indexes.

Sources (saved copies of the public llms.txt indexes, fetched 2026-11-11):
  SCW1/sources/claude_docs/platform.claude.com_docs_llms.txt   Claude Developer Platform docs (900 pages)
  SCW1/sources/claude_docs/code.claude.com_docs_llms.txt       Claude Code docs (228 pages)
  SCW1/sources/claude_docs/claude.com_docs_llms.txt            Claude apps docs (281 pages)

Levels:  Domain "Claude" -> Topic (a documentation area) -> Concept (a section or URL group) -> Skill (one documentation
page: the capability that page teaches) -> Agents (one primary + one checker per topic, one shared support researcher)
-> MCP (the official Claude docs MCP server, listed in the platform index).

The API Reference area (one page per endpoint and per beta copy) is grouped one skill per API resource; every endpoint
page is still listed in the CSV. Nothing is invented: labels, URLs and descriptions come from the indexes.

Outputs:
  SCW1/sources/packs/claude-*.pack.json      one topic pack per topic (schema human0.topic-pack/1)
  SCW1/sources/claude_docs/claude_domain.csv every documentation page with its full D-T-C-S-A-M path
  prints the topic ids, for SCW1/ontology.spec.json regroup.pack_domains
"""
import collections, csv, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(ROOT, "SCW1", "sources", "claude_docs")
PACKS = os.path.join(ROOT, "SCW1", "sources", "packs")
CHECKED = "2026-11-11"
MCP = ["Claude Developer Platform docs", None,
       "Anthropic's official MCP server for searching and reading the Claude Developer Platform documentation (Streamable HTTP at https://platform.claude.com/docs/mcp).",
       [], "web-listed", "https://platform.claude.com/docs/llms.txt"]

LINK = re.compile(r"^- \[([^\]]+)\]\((https://[^)]+)\)\s*(?:[-:]\s*(.*))?$")


def slug(s, n=48):
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s[:n].strip("-") or "x"


def title(s):
    return s[:1].upper() + s[1:]


def read(name):
    return open(os.path.join(SRC, name), encoding="utf-8").read().splitlines()


# ---------------- page records: (site, topic_key, concept_label, page_title, url, desc) ----------------
pages = []

# 1. Claude Developer Platform: "### Section" headings; concepts from the URL path under /docs/en/
PLAT_TOPIC = {"Docs home": "messages", "Messages": "messages", "Managed Agents": "managed-agents", "Admin": "admin",
              "Best practices": "best-practices", "Models & pricing": "models", "SDKs, CLI, and libraries": "sdks",
              "API reference": "api-reference", "Claude API skill": "best-practices", "Release notes": "best-practices",
              "API Reference": "api-reference", "Other pages": "best-practices"}
PLAT_GROUP = {"agents-and-tools": "Agents and tools", "build-with-claude": "Build with Claude", "about-claude": "About Claude",
              "manage-claude": "Manage Claude", "test-and-evaluate": "Test and evaluate", "managed-agents": "Managed Agents",
              "models": "Models", "api": "API", "release-notes": "Release notes", "resources": "Resources"}
sec = None
for line in read("platform.claude.com_docs_llms.txt"):
    if line.startswith("### "):
        sec = line[4:].strip(); continue
    m = LINK.match(line)
    if not m or sec is None or sec not in PLAT_TOPIC:
        continue
    t, url, extra = m.group(1).strip(), m.group(2), (m.group(3) or "").strip()
    path = url.split("/docs/en/", 1)[-1].replace(".md", "").split("/")
    tk = PLAT_TOPIC[sec]
    if tk == "api-reference" and sec == "API Reference":
        rest = [p for p in path[1:] if p != "beta"]
        concept = "API resources: " + (rest[0].replace("_", " ") if rest else "overview")
    elif len(path) >= 3:
        concept = title(path[1].replace("-", " "))
    elif len(path) == 2:
        concept = PLAT_GROUP.get(path[0], title(path[0].replace("-", " ")))
    else:
        concept = "Getting started"
    label = f"{t}: {extra}" if extra and t.lower() in ("overview", "quickstart", "reference") else t
    pages.append(("platform", tk, concept, label, url, extra))

# 2. Claude Code: "## Area" -> "#### Group" (first listing of each URL only)
CODE_TOPIC = {"Getting started": "code-start", "Build with Claude Code": "code-build", "Plugins": "code-plugins",
              "Administration": "code-admin", "Configuration": "code-config", "Reference": "code-reference",
              "Agent SDK": "code-agent-sdk"}
area = grp = None
seen = set()
for line in read("code.claude.com_docs_llms.txt"):
    if line.startswith("## "):
        area = line[3:].strip(); grp = None; continue
    if line.startswith("#### "):
        grp = line[5:].strip(); continue
    if line.startswith("##### "):
        grp = line[6:].strip(); continue
    if line.startswith("### ") and grp is None:
        grp = line[4:].strip(); continue
    m = LINK.match(line)
    if not m or area not in CODE_TOPIC or "/_llms/" in m.group(2) or m.group(2) in seen:
        continue
    seen.add(m.group(2))
    pages.append(("code", CODE_TOPIC[area], grp or area, m.group(1).strip(), m.group(2), (m.group(3) or "").strip()))

# 3. Claude apps: URL path under /docs/
APP_TOPIC = {"claude-tag": "apps-tag", "government": "apps-government", "claude-science": "apps-science",
             "third-party": "apps-third-party", "office-agents": "apps-office", "cowork": "apps-office"}
seen = set()
for line in read("claude.com_docs_llms.txt"):
    m = LINK.match(line)
    if not m or m.group(2) in seen:
        continue
    seen.add(m.group(2))
    path = m.group(2).split("/docs/", 1)[-1].replace(".md", "").split("/")
    tk = APP_TOPIC.get(path[0], "apps-extend")
    if tk == "apps-extend":
        concept = {"connectors": "Connectors", "plugins": "Plugins", "skills": "Skills", "directory": "Directory",
                   "build": "Build for Claude", "extend": "Extend Claude", "index": "Welcome"}.get(path[0], title(path[0]))
        if path[0] == "connectors" and len(path) >= 3:
            concept = "Connectors: " + path[1].replace("-", " ")
    elif tk == "apps-office" and path[0] == "cowork":
        concept = "Cowork"
    else:
        concept = title(path[1].replace("-", " ")) if len(path) >= 3 else "Overview"
    pages.append(("apps", tk, concept, m.group(1).strip(), m.group(2), (m.group(3) or "").strip()))

# ---------------- flat areas: concepts by keywords in the page URL (first match wins; the last entry catches the rest) ----
REGROUP = {
    "managed-agents": [("Get started", r"overview|quickstart|onboarding|migration"), ("Agents and orchestration", r"agent-setup|multiagent|outcome|dream|budget"),
                       ("Environments and sandboxes", r"environment|sandbox|self-hosted"), ("Sessions, events and streaming", r"session|event|stream"),
                       ("Tools, files and memory", r"file|github|mcp|memory|vault|tool|skill"), ("Deployment and security", r"deploy|secur|permission|schedul"),
                       ("Reference and other", r".")],
    "admin": [("CMEK and encryption", r"cmek"), ("Compliance API", r"compliance"), ("Identity and access", r"wif|workload|auth|user|admin-api|ip-allowlist|app-attest|rbac"),
              ("Usage, cost and limits", r"usage|cost|analytics|spend|rate-limit"), ("Data residency and retention", r"residency|retention|transparency"),
              ("Workspaces, hooks and integrations", r".")],
    "models": [("Claude Opus", r"/opus"), ("Claude Sonnet", r"/sonnet"), ("Claude Haiku", r"/haiku"), ("Claude Fable and Mythos", r"/fable|/mythos"),
               ("Pricing, choosing and deprecations", r".")],
    "apps-science": [("Get started and use", r"overview|get-started|mac-app|update|core-concepts|auto-mode|artifacts|comments|reviewer|multiple"),
                     ("Example gallery", r"example-gallery"), ("Compute, data and connectors", r"compute|cluster|storage|literature|connector|tools-and|remote"),
                     ("Administration and networks", r"admin|enable|devices|network|corporate|usage|data"), ("Reference and support", r".")],
    "apps-third-party": [("Install and administer", r"overview|feature|install|admin|mdm|bootstrap|in-app|credential|import|move|entra"),
                         ("Inference providers and models", r"models|gateway|bedrock|mantle|vertex|foundry|claude-api"),
                         ("Connectors and extensions", r"extension|mcp|connector|web-tools|browser|local-access"),
                         ("Configuration", r"configuration"), ("Using Claude Desktop and operations", r".")],
    "apps-office": [("Cowork", r"/cowork/"), ("Office apps", r"excel|powerpoint|word|outlook|across|dictation"),
                    ("Enterprise and operations", r"enterprise|opentelemetry|performance|data-storage|third-party|fsi"), ("Office agents overview", r".")],
    "code-reference": [("CLI, commands and settings", r"cli-reference|commands|env-vars"), ("Tools, hooks and channels", r"tools-reference|hooks|channels"),
                       ("Sessions and interaction", r"interactive|checkpoint"), ("Glossary", r".")],
}


def regroup(k, concept, url):
    rules = REGROUP.get(k)
    if not rules or concept.startswith("API resources") or (k == "admin" and concept not in ("Manage Claude",)) or (k == "apps-office" and "/cowork/" not in url and "office-agents" not in url):
        return concept
    for label, rx in rules:
        if re.search(rx, url.split("/docs/", 1)[-1]):
            return label
    return concept


pages = [(a, k, regroup(k, c, u), t, u, e) for (a, k, c, t, u, e) in pages]

# ---------------- topics ----------------
TOPICS = {
    "messages": ("Claude API: Messages, Tools and Agent Skills", "Building on the Claude Messages API: tool use, server tools, MCP connector and tunnels, Agent Skills, files, batches, prompt caching, streaming, context windows, vision, citations and platform availability (Claude Developer Platform docs)."),
    "managed-agents": ("Claude Managed Agents", "Hosted agents on the Claude Platform: agents, sessions, environments, cloud sandboxes, memory, credential vaults, multiagent orchestration, scheduled deployments, outcomes and budgets."),
    "admin": ("Claude Platform Administration", "Running a Claude Console organization: Admin API and keys, workspaces, users, workload identity federation, usage and cost APIs, spend and rate limits, compliance API, CMEK, data residency, inference hooks and webhooks."),
    "best-practices": ("Prompting, Evaluation and Claude API Guidance", "Prompt engineering, testing and evaluation, the Claude API skill, release notes, glossary and resources for building with Claude."),
    "models": ("Claude Models and Pricing", "The Claude model families (Opus, Sonnet, Haiku, Fable, Mythos), model overviews, pricing, deprecations and choosing a model."),
    "sdks": ("Claude SDKs, CLI and Libraries", "The official Claude Platform SDKs, the ant CLI and client libraries."),
    "api-reference": ("Claude API Reference", "The Claude API reference: overview, errors, rate limits, versioning, beta headers, service tiers, regions, OpenTelemetry spans, and every API resource (messages, sessions, agents, environments, files, skills, organization, compliance and more)."),
    "code-start": ("Claude Code: Getting Started and Everyday Use", "Claude Code, Anthropic's agentic coding tool: installation, core concepts, everyday use, platforms (terminal, IDE, desktop, web, cloud) and code review."),
    "code-build": ("Claude Code: Building with Agents, MCP and Skills", "Building with Claude Code: subagents and parallel work, MCP, skills, artifacts, automation and routines, guides and troubleshooting."),
    "code-plugins": ("Claude Code Plugins and Marketplaces", "Using, creating, testing and distributing Claude Code plugins and mods, running a marketplace and managing plugins for an organization."),
    "code-admin": ("Claude Code Administration", "Setting up and governing Claude Code: access, deployment, gateways, usage and costs, security and data, adoption."),
    "code-config": ("Claude Code Configuration", "Configuring Claude Code: settings, permissions and sandboxing, environments, model and responses, interface."),
    "code-reference": ("Claude Code Reference", "Claude Code reference: CLI, commands, environment variables, tools, interactive mode, checkpointing, hooks, channels and glossary."),
    "code-agent-sdk": ("Claude Agent SDK", "The Claude Agent SDK: building agents with the same harness as Claude Code."),
    "apps-extend": ("Claude Apps: Connectors, Skills and Plugins", "Extending Claude in claude.ai, desktop and mobile: MCP connectors and the Connectors directory, custom connectors, skills, plugins and building for Claude."),
    "apps-tag": ("Claude Tag", "Claude Tag, Claude in Slack: how it works, agent identity, connectors, routines, admin setup and use."),
    "apps-government": ("Claude for Government", "Claude for government tenants: tenant administration, organizations, credits and compliance."),
    "apps-science": ("Claude Science", "Claude Science, the research workbench for scientists run on a lab's own machines."),
    "apps-third-party": ("Claude Apps on Third-Party Platforms", "Running Claude apps (such as Claude Desktop) against Amazon Bedrock, Google Cloud Vertex AI, Microsoft Foundry or other inference providers."),
    "apps-office": ("Claude for Microsoft 365, Office Agents and Cowork", "Claude in Microsoft 365 and the Office add-ins, office agents, and Cowork."),
}


def topic_id(k):
    return "claude-" + k


# ---------------- packs ----------------
by_topic = collections.defaultdict(list)
for p in pages:
    by_topic[p[1]].append(p)

csv_rows, packs_out, all_cids, all_sids = [], {}, set(), set()
SUPPORT = "ClaudeDocsResearcher"
for k, plist in by_topic.items():
    tid = topic_id(k)
    tlabel, tdesc = TOPICS[k]
    akey = "Claude" + "".join(w.title() for w in k.split("-"))
    agents = {akey + "Specialist": f"{tlabel} Specialist", akey + "Reviewer": f"{tlabel} Reviewer",
              SUPPORT: "Claude Docs Researcher"}
    groups = collections.OrderedDict()
    for p in plist:
        groups.setdefault(p[2], []).append(p)
    concepts, skills = [], []
    api_seen = {}
    for clabel, gp in groups.items():
        cid = ("cl-" + slug(k, 14) + "-" + slug(clabel, 30)).strip("-")
        i = 2
        while cid in all_cids:
            cid = f"{cid[:58]}-{i}"; i += 1
        all_cids.add(cid)
        words = collections.Counter(w for p in gp for w in re.findall(r"[a-z][a-z0-9]{3,}", p[3].lower()))
        kw = [w for w, _ in words.most_common(6)]
        concepts.append([cid, clabel, tid, f"{clabel} ({tlabel}): {len(gp)} documentation page{'s' if len(gp) > 1 else ''}.", kw])
        for p in gp:
            site, _, _, ptitle, url, extra = p
            if k == "api-reference" and clabel.startswith("API resources:"):
                # one skill per API resource; each endpoint page goes to the CSV under that skill
                key = cid
                if key not in api_seen:
                    sid = "cl-" + slug(clabel.split(":", 1)[1], 40) + "-api"
                    while sid in all_sids:
                        sid += "-x"
                    all_sids.add(sid)
                    api_seen[key] = sid
                    res = clabel.split(":", 1)[1].strip()
                    eps = sorted({q[3] for q in gp})
                    desc = (f"Call the Claude API {res} resource: " + "; ".join(eps))[:600]
                    skills.append([sid, cid, f"Claude API: {res}", desc, "reference",
                                   [[akey + "Specialist", "primary"], [akey + "Reviewer", "checker"], [SUPPORT, "support"]]])
                sid = api_seen[key]
            else:
                sid = "cl-" + slug(site + "-" + url.split("/docs/", 1)[-1].replace(".md", ""), 60)
                while sid in all_sids:
                    sid += "-x"
                all_sids.add(sid)
                desc = (extra or f"{ptitle} ({clabel})") + f" Source: {url.replace('.md', '')}"
                skills.append([sid, cid, ptitle, desc[:600], "reference" if "reference" in url or k.endswith("reference") else "procedural",
                               [[akey + "Specialist", "primary"], [akey + "Reviewer", "checker"], [SUPPORT, "support"]]])
            csv_rows.append(["Claude", tlabel, clabel, next(s[2] for s in skills if s[0] == sid), ptitle, url.replace(".md", ""),
                             {"platform": "platform.claude.com", "code": "code.claude.com", "apps": "claude.com"}[site],
                             agents[akey + "Specialist"], agents[akey + "Reviewer"], agents[SUPPORT], MCP[0]])
    if len(concepts) < 3:
        # the map needs at least 3 concepts per topic: split the largest concept by page title initial ranges
        print(f"note: topic {tid} has {len(concepts)} concepts", file=sys.stderr)
    pack = {"schema": "human0.topic-pack/1", "id": tid, "topic": {"id": tid, "label": tlabel, "desc": tdesc},
            "concepts": concepts, "skills": skills, "agents": agents, "mcp": [MCP],
            "provenance": {"levels": {"topic": "user", "concepts": "generated", "skills": "generated", "agents": "generated", "mcp": "real"},
                           "mcp_checked_at": CHECKED,
                           "notes": "Domain Claude, built from Anthropic's public documentation indexes (llms.txt) fetched on " + CHECKED +
                                    ": concepts are documentation sections or URL groups, skills are documentation pages (API Reference: one skill per API resource). Agents are role holders per topic, to be refined. MCP: the official Claude docs MCP server listed in platform.claude.com/docs/llms.txt; its tool names are not listed there, so none are given."}}
    packs_out[tid] = pack

# concept labels are unique across the whole map: qualify a label used twice (here or by the existing map) with its topic
existing = set()
try:
    g0 = json.load(open(os.path.join(ROOT, "SCW1", "scw1.graph.json"), encoding="utf-8"))
    existing = {c["label"].lower() for c in g0.get("concepts", []) if not str(c.get("topic", "")).startswith("claude-")}
except OSError:
    pass
cnt = collections.Counter(c[1].lower() for pk in packs_out.values() for c in pk["concepts"])
short = {"messages": "Claude API", "managed-agents": "Managed Agents", "admin": "Claude Platform", "best-practices": "Claude API guidance",
         "models": "Claude models", "sdks": "Claude SDKs", "api-reference": "Claude API reference", "code-start": "Claude Code",
         "code-build": "Claude Code building", "code-plugins": "Claude Code plugins", "code-admin": "Claude Code admin",
         "code-config": "Claude Code config", "code-reference": "Claude Code reference", "code-agent-sdk": "Agent SDK",
         "apps-extend": "Claude apps", "apps-tag": "Claude Tag", "apps-government": "Claude for Government", "apps-science": "Claude Science",
         "apps-third-party": "Claude Desktop third-party", "apps-office": "Claude for M365"}
relabel = {}
for tid, pk in packs_out.items():
    for c in pk["concepts"]:
        if cnt[c[1].lower()] > 1 or c[1].lower() in existing or c[1].lower() in ("overview", "getting started", "reference"):
            new = f"{c[1]} ({short[tid[len('claude-'):]]})"
            relabel[(tid, c[1])] = new
            c[3] = c[3].replace(c[1] + " (", new + " (", 1)
            c[1] = new
for r in csv_rows:
    tid = next(t for t, pk in packs_out.items() if pk["topic"]["label"] == r[1])
    r[2] = relabel.get((tid, r[2]), r[2])
dup = [l for l, n in collections.Counter(c[1].lower() for pk in packs_out.values() for c in pk["concepts"]).items() if n > 1 or l in existing]
if dup:
    sys.exit("still not unique: " + ", ".join(dup))

os.makedirs(PACKS, exist_ok=True)
for tid, pk in packs_out.items():
    with open(os.path.join(PACKS, f"{tid}.pack.json"), "w", encoding="utf-8") as fh:
        json.dump(pk, fh, indent=1, ensure_ascii=False)
with open(os.path.join(SRC, "claude_domain.csv"), "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow(["domain", "topic", "concept", "skill", "page_title", "url", "source", "agent_primary", "agent_checker", "agent_support", "mcp_server"])
    w.writerows(csv_rows)
print(json.dumps({"topics": len(packs_out), "concepts": sum(len(p["concepts"]) for p in packs_out.values()),
                  "skills": sum(len(p["skills"]) for p in packs_out.values()), "agents": len({a for p in packs_out.values() for a in p["agents"]}),
                  "pages": len(csv_rows), "per_topic": {t: [len(p["concepts"]), len(p["skills"])] for t, p in packs_out.items()},
                  "pack_domains": {t: "claude" for t in packs_out}}, indent=1))
