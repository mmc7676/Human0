#!/usr/bin/env python3
"""Build every directory package from its skill source.

Folder classes (see STRUCTURE.md):
  skills/<name>/   SOURCE of one Agent Skill. The only place you edit a skill.
  plugins/<name>/  PACKAGE for the Claude plugin directory. Generated here from
                   skills/<name> unless <name> is in HAND_BUILT (plugins that
                   carry MCP servers, apps or hooks and are written by hand).
  dist/            Generated downloads: <name>.zip (skill, upload to Claude),
                   <name>.plugin (plugin, install in Claude Code), SHA256SUMS.txt.
  assets/          human0-logo.png (the logo, unaltered) and icon.png (the same
                   logo resized to 512 px for the directory listing icon).

Run after editing a skill:   python3 scripts/build.py
Check without writing:       python3 scripts/build.py --check
Bump the skill's version in skills/catalog.json on every release.
"""
import hashlib, json, os, re, shutil, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = "https://github.com/mmc7676/Human0"
AUTHOR = {"name": "Human0", "email": "human@maxey0.com", "url": "https://github.com/mmc7676"}
LOGO = f"{ROOT}/assets/human0-logo.png"
ICON = f"{ROOT}/assets/icon.png"
LOGO_SRC = "](../../assets/human0-logo.png)"
LOGO_PKG = "](human0-logo.png)"
HAND_BUILT = {  # plugins written by hand; build.py never touches them
    "space-at-scale": "./plugins/space-at-scale",
    "scw-modeler": "./plugins/scw-modeler",
    "maxey0-context-plane-graph": "./apps/maxey0-context-plane/plugin/maxey0-context-plane-graph",
}
FIXED_TIME = (2026, 11, 15, 0, 0, 0)


def files_of(base):
    out = []
    for d, dirs, fs in os.walk(base):
        dirs[:] = sorted(x for x in dirs if x not in ("__pycache__", "node_modules", ".pytest_cache"))
        for f in sorted(fs):
            out.append(os.path.relpath(os.path.join(d, f), base).replace("\\", "/"))
    return out


def frontmatter(text):
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not m:
        raise SystemExit("SKILL.md has no front matter")
    fm = {}
    for line in m.group(1).splitlines():
        k, _, v = line.partition(":")
        if v and not line.startswith((" ", "\t")):
            fm[k.strip()] = v.strip().strip('"')
    return fm


def skill_files(name):
    """(relative path, bytes) of the skill as packaged: README logo path rewritten, logo added."""
    src = f"{ROOT}/skills/{name}"
    out = []
    for rel in files_of(src):
        data = open(f"{src}/{rel}", "rb").read()
        if b"\r\n" in data:
            raise SystemExit(f"skills/{name}/{rel} has CRLF line endings")
        if rel == "README.md":
            data = data.replace(LOGO_SRC.encode(), LOGO_PKG.encode())
        out.append((rel, data))
    out.append(("human0-logo.png", open(LOGO, "rb").read()))
    return out


def plugin_files(name, meta):
    sk = open(f"{ROOT}/skills/{name}/SKILL.md", encoding="utf8").read()
    fm = frontmatter(sk)
    if fm.get("name") != name:
        raise SystemExit(f"skills/{name}/SKILL.md name is {fm.get('name')!r}, expected {name!r}")
    lic = open(f"{ROOT}/skills/{name}/LICENSE", encoding="utf8").read()
    manifest = {
        "name": name,
        "displayName": meta["displayName"],
        "version": meta["version"],
        "description": fm["description"],
        "author": AUTHOR,
        "homepage": f"{REPO}/tree/main/skills/{name}",
        "repository": REPO,
        "license": "Apache-2.0" if "Apache License" in lic else "MIT",
        "keywords": ["human0", "agent-skills", name],
    }
    out = [(".claude-plugin/plugin.json", (json.dumps(manifest, indent=2) + "\n").encode()),
           (".claude-plugin/icon.png", open(ICON, "rb").read())]
    for rel, data in skill_files(name):
        top = rel in ("README.md", "LICENSE", "human0-logo.png")
        out.append((rel if top else f"skills/{name}/{rel}", data))
    return out, manifest


def zip_bytes(entries, prefix=""):
    import io
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for rel, data in sorted(entries, key=lambda e: (e[0] != "SKILL.md", e[0])):
            zi = zipfile.ZipInfo(prefix + rel, date_time=FIXED_TIME)
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = 0o644 << 16
            z.writestr(zi, data)
    return buf.getvalue()


def main(check):
    catalog = json.load(open(f"{ROOT}/skills/catalog.json"))
    names = sorted(d for d in os.listdir(f"{ROOT}/skills") if os.path.isdir(f"{ROOT}/skills/{d}"))
    if set(names) != set(catalog):
        raise SystemExit(f"skills/ and catalog.json differ: {sorted(set(names) ^ set(catalog))}")
    clash = set(names) & set(HAND_BUILT)
    if clash:
        raise SystemExit(f"names used by both a skill and a hand-built plugin: {clash}")
    want = {}  # path -> bytes
    entries = []
    for n in names:
        pf, man = plugin_files(n, catalog[n])
        for rel, data in pf:
            want[f"plugins/{n}/{rel}"] = data
        want[f"dist/{n}.zip"] = zip_bytes(skill_files(n), prefix=f"{n}/")
        want[f"dist/{n}.plugin"] = zip_bytes(pf)
        entries.append({"name": n, "source": f"./plugins/{n}", "description": man["description"],
                        "version": man["version"], "category": catalog[n]["category"]})
    sums = "".join(f"{hashlib.sha256(want[f'dist/{n}.{e}']).hexdigest()}  {n}.{e}\n" for n in names for e in ("zip", "plugin"))
    want["dist/SHA256SUMS.txt"] = sums.encode()
    mk = json.load(open(f"{ROOT}/.claude-plugin/marketplace.json"))
    hand = [p for p in mk["plugins"] if p["name"] in HAND_BUILT]
    mk["description"] = "Human0 skills and plugins: directory-ready packages built from skills/, plus hand-built plugins with MCP apps."
    mk["plugins"] = hand + entries
    readme = open(f"{ROOT}/README.md", encoding="utf8").read()
    a, b = "<!-- skills:start -->", "<!-- skills:end -->"
    if a in readme and b in readme:
        rows = "".join(
            f"| [`/{n}`](skills/{n}) | {catalog[n]['displayName']} | {catalog[n]['version']} | "
            f"{frontmatter(open(f'{ROOT}/skills/{n}/SKILL.md', encoding='utf8').read())['description'].split('. ')[0].rstrip('.').replace('|', '/')}. | "
            f"[plugin](plugins/{n}) · [zip](dist/{n}.zip) |\n" for n in names)
        table = f"{a}\n| Skill | Name | Version | What it does | Packages |\n|---|---|---|---|---|\n{rows}{b}"
        want["README.md"] = (readme[:readme.index(a)] + table + readme[readme.index(b) + len(b):]).encode()
    want[".claude-plugin/marketplace.json"] = (json.dumps(mk, indent=2) + "\n").encode()

    generated_dirs = {f"plugins/{n}" for n in names}
    stale = []
    for d in generated_dirs:
        for rel in files_of(f"{ROOT}/{d}") if os.path.isdir(f"{ROOT}/{d}") else []:
            if f"{d}/{rel}" not in want:
                stale.append(f"{d}/{rel}")
    for rel in files_of(f"{ROOT}/dist") if os.path.isdir(f"{ROOT}/dist") else []:
        if f"dist/{rel}" not in want:
            stale.append(f"dist/{rel}")
    diff = [p for p, b in want.items() if not os.path.exists(f"{ROOT}/{p}") or open(f"{ROOT}/{p}", "rb").read() != b]
    if check:
        for p in diff + stale:
            print("OUT OF DATE", p)
        print(f"{len(names)} skills, {len(diff) + len(stale)} files out of date")
        sys.exit(1 if diff or stale else 0)
    for p in stale:
        os.remove(f"{ROOT}/{p}")
    for p in diff:
        os.makedirs(os.path.dirname(f"{ROOT}/{p}"), exist_ok=True)
        open(f"{ROOT}/{p}", "wb").write(want[p])
    print(f"{len(names)} skills built, {len(diff)} files written, {len(stale)} stale removed")


if __name__ == "__main__":
    main("--check" in sys.argv)
