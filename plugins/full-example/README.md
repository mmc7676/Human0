# Full Example (`/full-example`)

By Human0. Turns "how do I set up / use / build X?" into one worked example you can follow start to finish by copying values.

## What you get

- **Every field, with a value.** Sign-up forms, settings pages, config files: each field named, with an example value and the order to fill them in.
- **Every step, in order, with what you should see.** Commands with their expected output, screens with what appears after each click.
- **Complete sample files.** Code, config and data files in full, not fragments or placeholders.
- **Stated defaults.** When you specify little, it picks sensible defaults, states them in one line at the top and continues; it asks only when a wrong guess would waste the work.

## Use it

```
/full-example LinkedIn profile set-up
/full-example Build a Cloudflare MCP server and wrap it as a connector in Claude
/full-example Claude Managed Agents with skills, a vault and a scheduled deployment
```

Or just ask for "a full example of …". The more you specify (versions, platform, device, your own data), the more precise the example.

## Install

In Claude Code: `/plugin marketplace add mmc7676/Human0` then `/plugin install full-example@human0`.

## Contents

- `skills/full-example/SKILL.md` — the skill
- `skills/full-example/references/output-format.md` — the answer layout
- `skills/full-example/references/fastapi-todo-example.md — worked build example (FastAPI todo API, verified run)

## License

Apache-2.0. Contact: human@maxey0.com
