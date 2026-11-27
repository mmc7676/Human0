---
name: ccuse-review-a-pull-request-for-security-bugs
description: Reviews a pull request for security bugs with Claude Code. It checks out the pull request's branch, runs the built-in /security-review command for a quick pass or the Claude Security plugin for a scan whose findings are independently verified, and reports each finding with its file, line, severity, exploit scenario and fix. Use when asked to review a pull request, PR, branch or diff for security bugs, vulnerabilities, injection, authentication or authorization issues, or data exposure.
metadata:
  context-plane-concept: ccuse-code-review-and-pull-requests
  context-plane-label: Review a pull request for security bugs
  context-plane-type: procedural
  context-plane-agents: Maxey1781:primary Maxey1782:checker Maxey1766:support
---

# Review a pull request for security bugs

Run this in Claude Code, in a local clone of the repository that holds the pull request. Scan only code that you own or have permission to test.

## Inputs

- **Repository:** a local clone with an `origin` remote.
- **Pull request:** its branch name, such as `feature-auth`, or its number when it comes from a fork, and its base branch.
- **Depth:** `quick` (the built-in `/security-review` command) or `verified` (the Claude Security plugin). Use `verified` when the change touches sign-in, permissions, input parsing, file or network access, cryptography or secrets, and before a release.

## Steps

1. **Put your own work aside.** Run `git status`. If it lists uncommitted changes, commit them or run `git stash -u`, and note which branch you were on so you can go back to it afterwards.
2. **Check out the pull request.** Run `git fetch origin`, then `git checkout <branch>` with the pull request's branch name. For a pull request from a fork, run `gh pr checkout <number>` with the GitHub CLI instead.
3. **Make sure `origin/HEAD` exists.** `/security-review` diffs your branch against `origin/HEAD`, the ref that records origin's default branch. If the review stops with `fatal: ambiguous argument 'origin/HEAD...'`, run `git fetch origin` and then `git remote set-head origin --auto`. If that fails with `error: Cannot determine remote HEAD`, name the default branch instead: `git remote set-head origin <default-branch>`. If it fails with `error: Not a valid ref`, as in a single-branch clone, fetch the default branch first: `git remote set-branches --add origin <default-branch>`, then `git fetch origin`, then run the set-head command again.
4. **Quick pass.** Start Claude Code with `claude` in the repository and run `/security-review`. It analyzes the changes on the current branch against origin's default branch and identifies risks such as injection, authentication issues and data exposure. When the pull request targets a base other than the default branch, that diff isn't the pull request's diff: compare the findings with `git diff --name-only <base-branch>...HEAD`, or use the verified pass.
5. **Verified pass** (when the depth is `verified`):
   1. Check the prerequisites: a paid plan, Anthropic API access or a third-party provider; Python 3.9 or later on `PATH` as `python3` (check with `python3 --version`); Git.
   2. Install the plugin once, at the Claude Code prompt: `/plugin install claude-security@claude-plugins-official`, and choose user scope to have it in every project.
   3. Make sure the edits you want scanned are committed and nothing else is left uncommitted (`git status`). A change scan reads commits, not uncommitted edits.
   4. Run `/claude-security scan my branch`. For a deeper pass run `/claude-security scan my branch at high`. `/claude-security scan my branch --change-scan-effort high` is the most thorough change scan; it costs several times as much and also lists vulnerabilities older than the change.
   5. Read the results in the `CLAUDE-SECURITY-<timestamp>/` directory in the folder where Claude Code started: `CLAUDE-SECURITY-RESULTS.md` (each finding's ID such as `F1`, impact, exploit scenario, severity, confidence and recommendation), `CLAUDE-SECURITY-RESULTS.jsonl`, `CLAUDE-SECURITY-RESULTS.sarif` and `CLAUDE-SECURITY-REVISION-<commit>.json`.
6. **Report.** For each finding give its ID, file and line, severity, confidence, exploit scenario and the fix. Name the tool that produced it. Say what was not examined: the plugin report's coverage section states this. No findings is a result, not proof that the change is safe: scans are nondeterministic, and two scans of the same code can surface different findings.
7. **Fixes, only on request.** Patches are never applied automatically. Ask the plugin to "fix finding F3" or pick **Suggest patches** from the `/claude-security` menu. Each patch is written to the report's `patches/` folder as `F<n>.patch` with a note; apply one from the repository root with `git apply`, in its own pull request. Run `git status` when a patch job ends.
8. **Restore your work.** Run `git checkout` with the branch you were on, then `git stash pop` if you stashed in step 1.

## Check (checker role)

- The scanned commit is the pull request's head: the commit in the name `CLAUDE-SECURITY-REVISION-<commit>.json` matches the start of `git rev-parse HEAD`. A scan outside version control stamps `UNVERSIONED` in its place, which means it didn't scan a commit at all.
- Every finding points to a file and line in the pull request's diff, or is marked as older than the change.
- The report says which depth ran and what was not examined.

## Boundaries

- Posting review comments on the pull request, pushing fixes or applying patches needs the user's yes.
- In CI, the plugin's GitHub Actions job can scan each pull request, post a review and block the merge. Use it only in a repository where you trust everyone who can push: anyone who adds text or code to a pull request's branch can steer the scan. In a public repository its review can disclose a live vulnerability, so scan in a session instead.

## Sources

Read on November 27, 2026:

- https://code.claude.com/docs/en/commands (the `/security-review` row)
- https://code.claude.com/docs/en/errors (`/security-review` fails without `origin/HEAD`, including the single-branch fix)
- https://code.claude.com/docs/en/claude-security (prerequisites, install, change scans, scan effort, results, fixes, GitHub Actions, the revision stamp)
- `gh pr checkout --help` from the GitHub CLI (checking out a pull request by number)
