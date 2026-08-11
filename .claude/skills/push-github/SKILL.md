---
name: push-github
description: >
  Stage, commit, and push the current working changes to GitHub (origin) in one
  go. Use whenever the user says things like "push code lên github", "commit và
  push", "đẩy code lên", "push commit github", or asks to save/upload the current
  changes to the remote. Handles a clean status check, a well-formed commit
  message, branch safety on the default branch, and reporting the pushed result.
  An optional argument is used verbatim as the commit message subject.
---

# push-github — commit & push the working changes to GitHub

Turn the current uncommitted work into a commit and push it to `origin`. Do the
whole flow yourself with the tools — never ask the user to run git by hand.

Repo facts (verify, don't assume):
- Remote: `origin` → https://github.com/DHMaiKhanh/e2e-webdriverIO-P8D.git
- Default branch: `master`

## Steps

Run these in order. Use the Bash tool (Git Bash / POSIX sh) for git.

### 1. See what's there
Run in parallel:
- `git status --short`
- `git diff --stat` (staged + unstaged)
- `git branch --show-current`

If `git status` shows **nothing to commit** and nothing unpushed, stop and tell
the user there is nothing to push. If there are already-committed-but-unpushed
commits and no new changes, skip to step 5 (push only).

### 2. Review the actual changes before committing
Run `git diff` (and `git diff --staged`) and read it. You must know what you are
committing — enough to write an honest one-line summary. If the diff contains
something that looks unintended (secrets, tokens, large binaries, `.env`,
credentials, an accidental huge file), **stop and flag it** to the user before
committing. Do not push secrets.

### 3. Stage
Stage everything that belongs in this commit:
```
git add -A
```
If the user named specific files, stage only those instead.

### 4. Commit
Write a concise, meaningful commit message from the actual diff — not "update
files". Follow Conventional-Commit style when it fits (`feat:`, `fix:`, `docs:`,
`test:`, `chore:`, `refactor:`).

- If the user passed an argument to this skill, use it verbatim as the subject line.
- Otherwise derive the subject from the diff (imperative mood, ≤ ~72 chars).
- Add a short body only when the change needs explanation.

Every commit message MUST end with this trailer (blank line before it):
```
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

Commit with a heredoc so multi-line messages work in PowerShell/bash:
```
git commit -F - <<'EOF'
<subject>

<optional body>

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```
Do NOT use `--no-verify` or skip hooks. If a pre-commit hook fails, fix the
underlying issue and retry rather than bypassing it.

### 5. Branch safety, then push
Check the current branch (from step 1):
- **On a feature branch** → push straight to it:
  `git push -u origin HEAD`
- **On the default branch `master`** → this is the user's personal repo, so
  pushing to `master` is normal here. Push directly:
  `git push origin master`
  (Only create a branch first if the user explicitly asked for a PR / branch,
  or if pushing to `master` is rejected by branch protection.)

If the push is rejected because the remote is ahead (`fetch first` /
non-fast-forward), do NOT force-push. Run `git pull --rebase origin <branch>`,
resolve if needed, then push again. Never use `--force`/`--force-with-lease`
unless the user explicitly asks.

### 6. Report
Confirm to the user, briefly:
- the commit subject + short SHA (`git log -1 --oneline`)
- the branch it was pushed to
- the compare/commit URL if easy to derive
  (`https://github.com/DHMaiKhanh/e2e-webdriverIO-P8D/commit/<sha>`)

## Guardrails
- Only commit/push when the user asked — this skill IS that ask, so proceed.
- Never invent a message that misrepresents the diff.
- Never push credentials/secrets; flag and stop instead.
- Never force-push or skip hooks unless explicitly told to.
- If anything git-related fails, show the exact error output and the command,
  don't silently retry a different way.
