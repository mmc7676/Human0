![Human0](assets/human0-logo.png)

# How this repository is organized

Every Claude customization lives in exactly one place, decided by one question:
**what does it contain?**

| It contains | Folder | You edit it? | Example |
|---|---|---|---|
| One skill only: `SKILL.md` plus its own references, scripts, assets or tests | `skills/<name>/` | Yes, this is the source | `skills/zero-to-one/` |
| The directory package for that skill | `plugins/<name>/` | No, `scripts/build.py` generates it | `plugins/zero-to-one/` |
| More than a skill: an MCP server, an MCP app, hooks, commands or several skills | `plugins/<name>/` | Yes, written by hand | `plugins/space-at-scale/`, `plugins/scw-modeler/` |
| An app or service that runs on its own (a website, a Worker) | `apps/<name>/` | Yes | `apps/maxey0-context-plane/` |
| Downloads: `<name>.zip` (skill, upload to Claude) and `<name>.plugin` (install in Claude Code) | `dist/` | No, generated | `dist/zero-to-one.zip` |
| The Human0 logo and the directory icon | `assets/` | Only to replace the logo | `assets/human0-logo.png` |

So a skill is never written twice. You change `skills/<name>/`, run the build, and the
plugin, the zips, the marketplace file and the skills table in the README all follow.

## Skill or plugin?

- **A skill** is the instructions: a folder with a `SKILL.md`. It is the whole capability, and it works on its own when uploaded to Claude.
- **A plugin** is the package around one or more skills that the Claude plugin directory accepts: a `.claude-plugin/plugin.json` manifest, a `README.md`, a `LICENSE` and the listing icon. It can also carry MCP servers, hooks and commands.

A skill-only package is listed for Claude Code only; the plugin package is listed for Claude, the desktop app and Claude Code, and updates itself from GitHub when its version goes up. That is why every skill here also gets a generated plugin.

## Add or change a skill

1. Put the skill in `skills/<name>/` with `SKILL.md` (front matter `name: <name>` and `description:`), `README.md` (at least 40 words, first line `![Human0](../../assets/human0-logo.png)`) and `LICENSE`.
2. Add `"<name>": {"displayName": "...", "version": "1.0.0", "category": "..."}` to `skills/catalog.json`. Raise `version` on every later change.
3. Run `python3 scripts/build.py`. You should see: `N skills built, … files written`.
4. Run `python3 scripts/build.py --check`. You should see: `N skills, 0 files out of date`.
5. Run `claude plugin validate plugins/<name>`. You should see: `Validation passed`.
6. Commit and push.

## Submit one to the Claude plugin directory

In the developer portal at claude.ai/directory/manage, select **Submit new**, then **Plugin bundle**, and on **Source** enter Repository `mmc7676/Human0` and Plugin path `plugins/<name>`.
