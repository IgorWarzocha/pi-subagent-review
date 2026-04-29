# pi-subagent-review

`@howaboua/pi-subagent-review` is a Pi extension that adds one slash command:

- `/review`

It runs an isolated review subagent against your current repo, injects the findings back into the session as a user message, and asks the main agent to consider those findings in light of the prior conversation before deciding what to address. It is modelled after Codex CLI's /review command.

## What it does

`/review`:
- detects the current git repo
- chooses a base branch automatically
- computes the merge base with `HEAD`
- inspects committed and dirty worktree changes
- runs an isolated review subagent
- sends the findings back into the current Pi session as a user message
- as a result, the main agent reviews the findings against the prior conversation and addresses only clearly worthwhile issues

## Automatic base branch selection

The command chooses the base branch automatically:

- if you are on a branch other than `main`, `master`, or `dev`, it reviews against `dev`
- if no local `dev` exists, it falls back to `main`, then `master`
- if you are on `dev`, it reviews against `main`, then `master`
- if you are on `main` or `master`, it prefers `dev` when available

This means you usually never need to specify the diff base manually.

## User arguments

Anything after `/review` is treated as extra review guidance.

Examples:

```text
/review
/review focus extra attention on migrations and tests
/review assess whether we introduced new UI elements instead of reusing established components and existing CSS patterns
```

## Config

On first load, the extension creates:

- `~/.pi/agent/pi-subagent-review.json`

If Pi is using a custom agent directory via `PI_CODING_AGENT_DIR`, the file is created there instead.

Edit that file to change the default review model or thinking level:

```json
{
  "model": "openai-codex/gpt-5.4",
  "thinking": "high"
}
```

If that configured model is not available for the user, `/review` falls back to the current session model automatically.

## Install

Installation methods:

```bash
pi install /absolute/path/to/pi-subagent-review
pi install npm:@howaboua/pi-subagent-review
pi install git:github.com/IgorWarzocha/pi-subagent-review
```

Then reload or restart Pi.

## Notes

- This extension registers `/review`.
- Do not load it together with another extension that also registers `/review` unless you intentionally want that command collision.
