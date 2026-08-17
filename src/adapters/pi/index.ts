/**
 * Pi extension socket. Core stays host-agnostic.
 *
 * Load against an otherwise empty Pi:
 *   pi -e <repo>/src/adapters/pi/index.ts
 *
 * Or copy/symlink this folder to ~/.pi/agent/extensions/ai4s-gate/
 */

import {
  afterCall,
  beforeCall,
  createEmptyScientificState,
  gate,
  ingestScientificPaths,
  loadDefaultCatalog,
  type GatedItem,
  type SessionScientificState,
} from "../../core/index.js";

interface PiApi {
  on(event: string, handler: (event: Record<string, unknown>, ctx: PiCtx) => unknown): void;
  registerCommand(
    name: string,
    spec: { description: string; handler: (args: string, ctx: PiCtx) => Promise<void> | void },
  ): void;
}

interface PiCtx {
  ui: {
    notify(message: string, kind?: string): void;
    setStatus?(id: string, text: string): void;
  };
}

const COMMAND_ALIASES: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /\b(vina|autodock[_-]?vina)\b/i, name: "autodock-vina" },
  { pattern: /\bdiff[_-]?dock\b/i, name: "diffdock" },
  { pattern: /\bfpocket\b/i, name: "fpocket" },
  { pattern: /\b(rdkit|ligand[_-]?prep)\b/i, name: "rdkit-ligand-prep" },
  { pattern: /\b(mm[_-]?gbsa|mmgbsa)\b/i, name: "mm-gbsa-rescore" },
  { pattern: /\bcovalent[_-]?dock\b/i, name: "covalent-dock" },
];

function textFromUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return "";
}

function resolveCatalogName(toolName: string, input: unknown): string | undefined {
  const blob = `${toolName} ${textFromUnknown(input)}`;
  for (const { pattern, name } of COMMAND_ALIASES) {
    if (pattern.test(blob)) return name;
  }
  return undefined;
}

function formatCatalog(items: GatedItem[]): string {
  if (items.length === 0) return "(none)";
  return items.map((item) => `- ${item.name}: ${item.description ?? ""}`.trim()).join("\n");
}

export default function (pi: PiApi): void {
  const catalog = loadDefaultCatalog();
  const state: SessionScientificState = createEmptyScientificState();

  pi.on("session_start", (_event, ctx) => {
    ctx.ui.notify("ai4s-gate loaded (docking contracts)", "info");
    ctx.ui.setStatus?.("ai4s-gate", "gating on");
  });

  pi.on("before_agent_start", async () => {
    const snapshot = gate(catalog, state);
    const gatedLines = snapshot.gated
      .map((row) => `- ${row.item.name}: ${row.result.rejectionReasons.join("; ")}`)
      .join("\n");
    return {
      injectMessage:
        `<ai4s-gate>\n` +
        `Visible scientific methods:\n${formatCatalog(snapshot.visible)}\n\n` +
        `Currently gated:\n${gatedLines || "(none)"}\n` +
        `Pipeline state: [${[...state.pipelineStates].join(", ") || "empty"}]\n` +
        `Ligand: ${state.activeLigand?.format ?? "none"}; receptor: ${state.activeReceptor?.format ?? "none"}\n` +
        `Do not run a gated method until its preconditions are met (e.g. run fpocket before vina).\n` +
        `</ai4s-gate>`,
    };
  });

  pi.on("tool_call", async (event, ctx) => {
    const toolName = String(event.toolName ?? "");
    const input = event.input;
    await ingestScientificPaths(state, textFromUnknown(input));

    const catalogName = resolveCatalogName(toolName, input);
    if (!catalogName) return;

    const decision = beforeCall(catalogName, catalog, state);
    if (decision.decision === "deny") {
      const reason = decision.rejectionReasons.join("; ") || "blocked by scientific contract";
      ctx.ui.notify(`ai4s-gate blocked ${catalogName}`, "error");
      return { block: true, reason: `[ai4s-gate] ${reason}` };
    }
    if (decision.softWarnings.length > 0) {
      ctx.ui.notify(decision.softWarnings[0] ?? "", "warning");
    }
  });

  pi.on("tool_result", async (event) => {
    const toolName = String(event.toolName ?? event.name ?? "");
    const output = textFromUnknown(event.output ?? event.result ?? event.content ?? "");
    await ingestScientificPaths(state, output);

    const catalogName = resolveCatalogName(toolName, `${textFromUnknown(event.input)} ${output}`);
    if (!catalogName) return;
    const isError =
      event.isError === true || event.error === true || String(event.status ?? "") === "error";
    if (!isError) afterCall(catalogName, catalog, state);
  });

  pi.registerCommand("ai4s", {
    description: "Show ai4s-gate catalog and session scientific state",
    handler: (_args, ctx) => {
      const snapshot = gate(catalog, state);
      const visible = snapshot.visible.map((item) => item.name).join(", ") || "(none)";
      const gated = snapshot.gated.map((row) => row.item.name).join(", ") || "(none)";
      ctx.ui.notify(
        `visible: ${visible}\ngated: ${gated}\nstates: ${[...state.pipelineStates].join(",") || "empty"}`,
        "info",
      );
    },
  });
}
