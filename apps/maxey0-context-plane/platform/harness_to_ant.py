"""Turn a Maxey0 "Send to Claude Code" harness (zip or folder) into a Claude Platform project for `ant apply`.

One input, the whole pipeline:  Maxey0 route  ->  harness zip  ->  this script  ->  `ant apply .`  ->  run.py "<task>"

    python harness_to_ant.py maxey0-harness-<task>.zip  out/  [--skills-dir DIR]  [--schedule "0 9 * * 1"]
                                                              [--lead-model claude-opus-5-5] [--worker-model claude-sonnet-5-5]
                                                              [--budget-usd 5]

Writes, under out/:
  agents/lead.md                 the orchestrator: CLAUDE.md as its system prompt, every route agent as a predefined
                                 subagent and as a workflow agent (multiagent_20261001), the Maxey0 Context Plane MCP server
  agents/<agent>.md              one Managed Agent per harness subagent (primary / checker / support), same MCP server
  skills/<name>/                 your skills, copied from --skills-dir (each a directory with SKILL.md), attached to all agents
  environments/cloud.yaml        cloud sandbox, limited networking: package managers + the MCP hosts the agents declare
  memory_stores/maxey0.yaml      a memory store the sessions read and write
  vaults/maxey0.yaml             a vault for MCP credentials (add credentials with `ant beta:vaults:credentials create`)
  outcomes/rubric.md             the route's acceptance criteria as a grader rubric
  deployments/scheduled.md       only with --schedule: the same task on a cron schedule
  run.py                         creates a session (lead agent, environment, vault, memory store, budget, outcome) and streams it
  README.md                      the commands, in order
Field names follow the Claude Platform docs (agent-setup, multiagent-orchestration, skills, vaults, define-outcomes,
cli/apply), read 2026-11-11.
"""
import argparse, json, os, re, shutil, sys, tempfile, zipfile
from urllib.parse import urlparse

p = argparse.ArgumentParser()
p.add_argument("harness"); p.add_argument("out")
p.add_argument("--skills-dir", default=None, help="a directory of skill folders (each with SKILL.md) to attach")
p.add_argument("--skills", default="", help="comma-separated skill folder names to take from --skills-dir (default: all)")
p.add_argument("--schedule", default=None, help='cron expression for a scheduled deployment, e.g. "0 9 * * 1"')
p.add_argument("--timezone", default="America/Los_Angeles")
p.add_argument("--lead-model", default="claude-opus-5-5"); p.add_argument("--worker-model", default="claude-sonnet-5-5")
p.add_argument("--budget-usd", type=float, default=5.0)
a = p.parse_args()

src = a.harness
if zipfile.is_zipfile(src):
    tmp = tempfile.mkdtemp(); zipfile.ZipFile(src).extractall(tmp); src = tmp
need = ["CLAUDE.md", "route.json", ".mcp.json"]
for n in need:
    if not os.path.exists(os.path.join(src, n)):
        sys.exit(f"not a Maxey0 harness: {n} missing in {a.harness}")
claude_md = open(os.path.join(src, "CLAUDE.md"), encoding="utf-8").read()
route = json.load(open(os.path.join(src, "route.json"), encoding="utf-8"))
mcp = json.load(open(os.path.join(src, ".mcp.json"), encoding="utf-8")).get("mcpServers", {})
adir = os.path.join(src, ".claude", "agents")
agent_files = sorted(f for f in os.listdir(adir) if f.endswith(".md")) if os.path.isdir(adir) else []
if not agent_files:
    sys.exit("the harness has no .claude/agents/*.md")
if len(agent_files) > 20:
    sys.exit(f"{len(agent_files)} agents: Managed Agents lists at most 20 predefined subagents per agent")

out = a.out
for d in ["agents", "skills", "environments", "memory_stores", "vaults", "outcomes"] + (["deployments"] if a.schedule else []):
    os.makedirs(os.path.join(out, d), exist_ok=True)

def fm(text):
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if not m: return {}, text
    meta = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1); meta[k.strip()] = v.strip()
    return meta, m.group(2).strip()

def yq(s):  # YAML double-quoted scalar
    return json.dumps(s, ensure_ascii=False)

# MCP servers the harness names (http/url only: Managed Agents connects remote servers by URL)
servers = [(re.sub(r"[^a-z0-9-]", "-", n.lower()), s["url"]) for n, s in mcp.items() if s.get("url")]
hosts = sorted({urlparse(u).hostname for _, u in servers})

# skills
skill_names = []
if a.skills_dir:
    want = [s.strip() for s in a.skills.split(",") if s.strip()]
    for name in sorted(os.listdir(a.skills_dir)):
        d = os.path.join(a.skills_dir, name)
        if not os.path.isfile(os.path.join(d, "SKILL.md")) or (want and name not in want):
            continue
        shutil.copytree(d, os.path.join(out, "skills", name), dirs_exist_ok=True)
        skill_names.append(name)
    missing = [w for w in want if w not in skill_names]
    if missing:
        sys.exit("skills not found in --skills-dir: " + ", ".join(missing))

def agent_md(name, model, desc, system, extra=""):
    lines = ["---", f"name: {yq(name)}", f"model: {model}", f"description: {yq(desc[:500])}", "tools:",
             "  - type: agent_toolset_20260401"]
    for sname, _ in servers:
        lines += ["  - type: mcp_toolset", f"    mcp_server_name: {sname}"]
    if servers:
        lines.append("mcp_servers:")
        for sname, url in servers:
            lines += ["  - type: url", f"    name: {sname}", f"    url: {url}"]
    if skill_names:
        lines.append("skills:")
        lines += [f"  - ../skills/{s}" for s in skill_names]
    lines.append(extra.rstrip()) if extra else None
    lines += ["---", "", system.strip(), ""]
    return "\n".join(l for l in lines if l is not None)

workers = []
for f in agent_files:
    meta, body = fm(open(os.path.join(adir, f), encoding="utf-8").read())
    slug = f[:-3]
    name = meta.get("name", slug)
    desc = meta.get("description", name)
    system = (body + "\n\nContext: you are one agent on a Maxey0 route for the task \"" + route.get("task", "") +
              "\". The lead agent hands you your part; report what you did, what you did not do, and anything assumed or untested.")
    open(os.path.join(out, "agents", f"{slug}.md"), "w", encoding="utf-8").write(agent_md(name, a.worker_model, desc, system))
    workers.append(slug)

lead_extra = "\n".join(["multiagent:", "  type: multiagent_20261001", "  subagents:", "    type: enabled", "    predefined_agents:"] +
                       [f"      - ./{w}.md" for w in workers] +
                       ["  workflows:", "    type: enabled", "    predefined_agents:"] + [f"      - ./{w}.md" for w in workers])
lead_system = (claude_md + "\n\n## How you run on Claude Platform\n"
               "You are the lead. For each skill on the route, delegate the work to its primary agent, then send the result to its "
               "checker agent for review against the acceptance criteria; call support agents when the primary asks. When the work has "
               "many independent pieces, start a workflow run instead of delegating one by one. Write deliverables to /mnt/session/outputs/. "
               "Record decisions and reusable findings in the memory store. Finish with a report: done, reviewed, not done, assumed, untested.")
open(os.path.join(out, "agents", "lead.md"), "w", encoding="utf-8").write(
    agent_md("Maxey0 lead: " + route.get("task", "")[:60], a.lead_model, "Orchestrates the Maxey0 route for: " + route.get("task", ""), lead_system, lead_extra))

env = ["# yaml-language-server: $schema=https://platform.claude.com/schemas/ant/beta/environment.json",
       "name: maxey0-cloud", "description: Cloud sandbox for Maxey0 routes, limited networking (package managers and the route's MCP hosts).",
       "config:", "  type: cloud", "  networking:", "    type: limited", "    allow_package_managers: true"]
if hosts:
    env.append("    allowed_hosts:"); env += [f"      - {h}" for h in hosts]
open(os.path.join(out, "environments", "cloud.yaml"), "w").write("\n".join(env) + "\n")
open(os.path.join(out, "memory_stores", "maxey0.yaml"), "w").write(
    "# yaml-language-server: $schema=https://platform.claude.com/schemas/ant/beta/memory_store.json\n"
    "name: Maxey0 memory\ndescription: Decisions, findings and house rules the Maxey0 agents record between sessions.\n")
open(os.path.join(out, "vaults", "maxey0.yaml"), "w").write(
    "# yaml-language-server: $schema=https://platform.claude.com/schemas/ant/beta/vault.json\ndisplay_name: Maxey0 credentials\n")

crit = re.search(r"## Acceptance criteria\n(.*?)(\n## |\Z)", claude_md, re.S)
rubric = ["# Rubric: " + route.get("task", ""), ""]
for r in route.get("route", []):
    rubric += [f"## {r['skill']}", f"- Delivers: {r['desc']}", f"- The deliverable for {r['skill']} is in /mnt/session/outputs/", ""]
rubric += ["## Review and honesty", "- The checker agent's review of each skill's result is reported",
           "- Everything not done, assumed or untested is stated explicitly", ""]
if crit:
    rubric += ["## Acceptance criteria from the route", crit.group(1).strip(), ""]
open(os.path.join(out, "outcomes", "rubric.md"), "w", encoding="utf-8").write("\n".join(rubric))

if a.schedule:
    open(os.path.join(out, "deployments", "scheduled.md"), "w", encoding="utf-8").write("\n".join([
        "---", f"name: {yq('Maxey0: ' + route.get('task', '')[:80])}", "agent: ../agents/lead.md", "environment_id: ../environments/cloud.yaml",
        "resources:", "  - path: ../memory_stores/maxey0.yaml", "    access: read_write",
        "schedule:", "  type: cron", f"  expression: {yq(a.schedule)}", f"  timezone: {a.timezone}", "---", "",
        route.get("task", ""), ""]))

budget_minor = str(int(round(a.budget_usd * 100)))
open(os.path.join(out, "run.py"), "w", encoding="utf-8").write(f'''"""Run the Maxey0 lead agent on Claude Platform: one session, the route's outcome, streamed to the terminal.

    python run.py                     # the harness task
    python run.py "another task"      # the same agents and skills, a new task

Needs: pip install anthropic, `ant apply .` already run here (reads claude-lock.json), ANTHROPIC_API_KEY or `ant auth login`.
"""
import json, sys, time
import anthropic

TASK = sys.argv[1] if len(sys.argv) > 1 else {json.dumps(route.get("task", ""))}
lock = json.load(open("claude-lock.json"))["resources"]
ID = lambda path: lock[path]["id"]
client = anthropic.Anthropic()
rubric = open("outcomes/rubric.md", encoding="utf-8").read()

session = client.beta.sessions.create(
    agent=ID("./agents/lead.md"),
    environment_id=ID("./environments/cloud.yaml"),
    vault_ids=[ID("./vaults/maxey0.yaml")],
    resources=[{{"type": "memory_store", "memory_store_id": ID("./memory_stores/maxey0.yaml"), "access": "read_write"}}],
    budget={{"type": "limit", "max_list_cost": {{"amount": "{budget_minor}", "currency": "USD"}}}},
    title=("Maxey0: " + TASK)[:128],
    initial_events=[{{"type": "user.define_outcome", "description": TASK, "rubric": {{"type": "text", "content": rubric}}, "max_iterations": 3}}],
)
print("session", session.id)
for ev in client.beta.sessions.events.stream(session.id):
    t = getattr(ev, "type", "")
    if t == "agent.message":
        for b in getattr(ev, "content", []) or []:
            if getattr(b, "type", "") == "text": print(b.text)
    elif t == "agent.tool_use":
        print("  [tool]", getattr(ev, "name", ""))
    elif t.startswith("span.outcome_evaluation_end"):
        print("  [outcome]", getattr(ev, "result", ""), "-", getattr(ev, "explanation", ""))
    elif t == "session.status_idle":
        break
time.sleep(5)  # outputs can appear a few seconds after the session goes idle
for f in client.beta.files.list(scope_id=session.id, betas=["managed-agents-2026-04-01"]):
    print("output:", f.id, getattr(f, "filename", ""))
''')

open(os.path.join(out, "README.md"), "w", encoding="utf-8").write(f"""# Maxey0 on Claude Platform: {route.get('task','')}

Generated from a Maxey0 Context Plane harness by `harness_to_ant.py`. {len(workers)} route agents + 1 lead, {len(skill_names)} skills,
{len(servers)} MCP server(s), 1 environment, 1 memory store, 1 vault{', 1 scheduled deployment' if a.schedule else ''}.

1. `ant auth login`  (or set ANTHROPIC_API_KEY)
2. `ant apply --dry-run .`   then   `ant apply .`   and commit `claude-lock.json`
3. Credentials for MCP servers that need them: `ant beta:vaults:credentials create --vault-id <id from claude-lock.json>` (see the vaults docs)
4. `pip install anthropic`  then  `python run.py`
""")
print(json.dumps({"out": out, "agents": ["lead"] + workers, "skills": skill_names, "mcp": servers, "hosts": hosts, "schedule": a.schedule}, indent=1))
