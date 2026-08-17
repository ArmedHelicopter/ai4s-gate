# ai4s-gate

Host-agnostic middleware for AI-for-Science tool/skill routing.
Deterministic precondition gating — not a coding agent, not a Claude Code clone.

## What this is

A small library that answers three questions for any host:

1. **Catalog** — which skills/tools may the model see right now?
2. **Before call** — allow / deny / warn this invocation?
3. **After call** — what pipeline state did this produce?

Hosts (OpenCode, Pi, DeepSeek Harness, a Python script) are optional adapters.
The core must not import any of them.

## What this is not

- Not a TUI / CLI agent
- Not a sandbox, MCP client, or permission UI
- Not a rewrite of OpenCode, Pi, or Claude Code

## Layout (intended)

```text
packages/core/          # gate / beforeCall / afterCall / inspect
adapters/               # optional, one folder per host
```

`easy-agent` remains a local demo/testbed only. New work lands here.
