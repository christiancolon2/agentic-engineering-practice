---
description: Commit staged changes, push the current branch, and open a pull request
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git commit:*), Bash(git push:*), Bash(git branch:*), Bash(gh pr create:*)
---

Commit all staged changes, push them to the current branch, and open a pull request.

Follow these steps in order:

1. Run `git status` to show what will be committed. If nothing is staged, stop and tell the user.
2. Run `git diff --staged` to review the staged changes.
3. Write a commit message in Conventional Commits format (e.g. `feat: ...`, `fix: ...`, `refactor: ...`, `docs: ...`, `test: ...`, `chore: ...`) based on what was staged. Use a concise subject line, and add a body if the change needs explanation.
4. Run `git commit` with that message.
5. Run `git push origin <current-branch>`, using the name from `git branch --show-current`.
6. Run `gh pr create --fill` to open a pull request that uses the commit message as the PR title and body.

When done, report the commit hash and the PR URL.
