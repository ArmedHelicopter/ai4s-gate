import assert from "node:assert/strict";
import { test } from "node:test";
import createExtension from "../src/adapters/pi/index.js";

type Handler = (event: Record<string, unknown>, ctx: { ui: { notify: () => void } }) => unknown;

function loadExtension() {
  const handlers = new Map<string, Handler[]>();
  const commands = new Map<string, (args: string, ctx: unknown) => unknown>();
  createExtension({
    on(event, handler) {
      const list = handlers.get(event) ?? [];
      list.push(handler as Handler);
      handlers.set(event, list);
    },
    registerCommand(name, spec) {
      commands.set(name, spec.handler);
    },
  });
  const ctx = { ui: { notify() {}, setStatus() {} } };
  return {
    async emit(event: string, payload: Record<string, unknown>) {
      const list = handlers.get(event) ?? [];
      const results = [];
      for (const handler of list) results.push(await handler(payload, ctx));
      return results;
    },
    commands,
  };
}

test("Pi adapter blocks vina bash before pocket/charges exist", async () => {
  const ext = loadExtension();
  const results = await ext.emit("tool_call", {
    toolName: "bash",
    input: { command: "vina --receptor rec.pdbqt --ligand lig.pdbqt --out out.pdbqt" },
  });
  const block = results.find((row) => row && typeof row === "object" && "block" in row) as
    | { block: boolean; reason: string }
    | undefined;
  assert.equal(block?.block, true);
  assert.match(block?.reason ?? "", /ai4s-gate/);
});

test("Pi adapter does not block plain ls", async () => {
  const ext = loadExtension();
  const results = await ext.emit("tool_call", {
    toolName: "bash",
    input: { command: "ls" },
  });
  const block = results.find((row) => row && typeof row === "object" && "block" in row);
  assert.equal(block, undefined);
});
