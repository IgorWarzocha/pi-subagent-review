# Changelog

## 0.1.52

- Detect local parent branches before falling back to `dev`/`main`/`master` review bases.
- Use branch config and reflog creation metadata so worktree-created branches review against their parent branch when possible.
- Label review output as parent-detected or fallback base.
- Hardened parent-branch inference for ambiguous reflogs and unusual branch names.

## 0.1.51

- Added configurable review context summaries and hardened summary prompt handling.
- Clarified that review findings are advisory and should be triaged before editing.
- Improved review prompt guidance and cancellation behavior.

## 0.1.0-0.1.5

- Added the initial `/review` command for isolated subagent code review.
- Included dirty worktree inspection and automatic `dev`/`main`/`master` base selection.
- Added package metadata and early prompt/config refinements.
