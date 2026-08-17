# Next steps — 2026-08-17

Two tracks. Do not mix them in one agent session.

| Track | Repo | Job |
|---|---|---|
| A. Wrap-up | `E:\\AI\\easy-agent` @ `feat/ai4s-skill-routing` | Finish the in-flight skill-routing + defect work. Do not start a new product. |
| B. Product | `ArmedHelicopter/ai4s-gate` (private) | Host-agnostic middleware. Extract only after Track A is committed. |

Quota reset: **2026-08-17 14:25:38 +08**. Antigravity subagents do Track A only.

## Decisions (locked)

- Product is middleware (`gate` / `beforeCall` / `afterCall` / `inspect`), not an agent.
- Pi / OpenCode / DSH / easy-agent are sockets, not the base.
- First *external* agent socket later: Pi. First *dev* socket: in-process tests + a tiny script.
- Do not fork `pi-mono`. Do not import Cordis into core.
- Do not keep cloning Claude Code in `ai4s-gate`.

## Track A — Antigravity after 14:25 (easy-agent)

Working tree is dirty: routing + 41-defect remediation + test infra, uncommitted.

Do, in order:

1. **Do not** add TUI features, marketplace runtime, teams, or Stage-36 packaging.
2. Make the scientific + routing tests pass on real `src/` modules:
   - `npm run test:skill-routing`
   - `npm run test:scientific-pipeline`
   - `npm run test:docking-gating`
   - `npm run test:real-scientific`
   - `npx tsx --test tests/unit/skillDag.test.ts tests/unit/skillPreconditions.test.ts`
3. If M1 (DEF-01…DEF-10) files are mid-edit, finish only what is already started. Do not open M2–M4.
4. Delete the accidental `undefined/` directory if it is junk.
5. Commit on `feat/ai4s-skill-routing` in small commits:
   - routing/gating (`src/services/skills/*`, `src/services/scientific/*`, related tests)
   - defect fixes (permissions/sandbox/mcp) separately if possible
6. Leave a one-page note: which tests pass, which DEF-IDs are still open.

Do **not** copy files into `ai4s-gate`. Extraction is Track B, after the commit exists.

## Track B — after Track A is committed (ai4s-gate)

Extract these (they only depend on `Skill` + `scientificTypes` + node fs):

- `src/services/skills/typeChecker.ts`
- `src/services/skills/types/scientificTypes.ts`
- `src/services/skills/dag.ts`
- `src/services/skills/retrieve.ts`
- `src/services/skills/routingCard.ts`
- `src/services/skills/contractOverlay.ts`
- `src/services/skills/auditChannel.ts`
- `src/services/scientific/fileInspector.ts`
- `src/services/scientific/sessionState.ts`
- overlays + `tests/unit/skillRouting.test.ts`, `skillDag.test.ts`, `scientific-gating-pipeline.test.ts`, `tests/integration/real-scientific-execution.test.ts`

Rewrite `Skill` down to `{ name, description, preconditions, produces_state, routing? }`.
`preconditions.ts` can follow, but drop `process.cwd` / PATH probes into an injected `Env`.

Then:

1. `packages/core` public API: `gate`, `beforeCall`, `afterCall`, `inspect`.
2. Script socket: one file that blocks Vina without pocket, allows DiffDock.
3. `adapters/pi` last — only after the script socket is green.

## What not to do today

- Refactor easy-agent into a Pi project.
- Publish easy-agent / Stage 36.
- Adopt Cordis, OpenCode, or DSH as the repo kernel.
