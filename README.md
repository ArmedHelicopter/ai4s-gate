# ai4s-gate

Host-agnostic middleware for AI-for-Science tool/skill routing.
Deterministic precondition gating — not a coding agent.

## What this is

A small library that answers three questions for any host:

1. **Catalog** — `gate(catalog, state)` — which methods may the model see?
2. **Before call** — `beforeCall(name, catalog, state)` — allow / deny / unknown?
3. **After call** — `afterCall(name, catalog, state)` — write pipeline tags.

Hosts (Pi, OpenCode, DeepSeek Harness, a script) are optional adapters.
`src/core` does not import any of them.

## Try it on an empty Pi

Pi stays stock: four tools (`read`, `write`, `edit`, `bash`). This repo only adds an extension.

```bash
cd ai4s-gate
npm install
npm test

# one-shot, no install into ~/.pi
pi -e ./src/adapters/pi/index.ts
```

In the session:

- Mention or write `.pdb` / `.sdf` / `.pdbqt` / `.smi` files — they are inspected into session state.
- `vina` / `autodock_vina` via bash is **blocked** until `fpocket` has run and ligands are PDBQT with charges.
- `diffdock` is allowed on SMILES + experimental PDB.
- `/ai4s` prints visible vs gated methods.

Or symlink for every project:

```bash
# Windows (pwsh)
New-Item -ItemType Junction -Path "$env:USERPROFILE\.pi\agent\extensions\ai4s-gate" -Target (Resolve-Path .)

# Unix
ln -s "$(pwd)" ~/.pi/agent/extensions/ai4s-gate
```

Pi discovers `package.json` → `"pi": { "extensions": ["./src/adapters/pi/index.ts"] }`.

## Layout

```text
src/core/           # gate / beforeCall / afterCall / inspect
src/adapters/pi/    # Pi extension only
contracts/          # docking YAML contracts
tests/              # host-free unit tests
```

`easy-agent` is a separate fork used as a testbed, not this product.

## License

MIT. See `LICENSE` and `NOTICE`.
