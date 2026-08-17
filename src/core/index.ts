import { evaluatePreconditions } from "./typeChecker.js";
import { findInCatalog } from "./catalog.js";
import { addPipelineState } from "./sessionState.js";
import type {
  BeforeCallResult,
  GateResult,
  GatedItem,
  SessionScientificState,
} from "./types.js";

export type {
  ArtifactDescriptor,
  BeforeCallResult,
  CallDecision,
  GateResult,
  GatedItem,
  PreconditionStatus,
  ScaleBound,
  ScientificPreconditions,
  SessionScientificState,
  TypeCheckResult,
} from "./types.js";

export { evaluatePreconditions } from "./typeChecker.js";
export { inspectScientificFile } from "./fileInspector.js";
export {
  addPipelineState,
  createEmptyScientificState,
  extractScientificPaths,
  ingestScientificPaths,
  noteArtifact,
} from "./sessionState.js";
export {
  defaultCatalogPath,
  findInCatalog,
  loadCatalog,
  loadDefaultCatalog,
} from "./catalog.js";

/** Filter a catalog: visible items may be shown to the model. */
export function gate(catalog: GatedItem[], state: SessionScientificState): GateResult {
  const visible: GatedItem[] = [];
  const gated: GateResult["gated"] = [];
  for (const item of catalog) {
    const result = evaluatePreconditions(item, state);
    if (result.isValid) visible.push(item);
    else gated.push({ item, result });
  }
  return { visible, gated };
}

/** Decide whether a named skill/tool may run now. */
export function beforeCall(
  name: string,
  catalog: GatedItem[],
  state: SessionScientificState,
): BeforeCallResult {
  const item = findInCatalog(catalog, name);
  if (!item) {
    return {
      toolName: name,
      isValid: true,
      status: "unverified",
      rejectionReasons: [],
      softWarnings: [],
      decision: "unknown",
    };
  }
  const result = evaluatePreconditions(item, state);
  return {
    ...result,
    decision: result.isValid ? "allow" : "deny",
  };
}

/** After a successful call, write produces_state tags onto the session. */
export function afterCall(
  name: string,
  catalog: GatedItem[],
  state: SessionScientificState,
): string[] {
  const item = findInCatalog(catalog, name);
  const tags = item?.produces_state ?? [];
  for (const tag of tags) addPipelineState(state, tag);
  return tags;
}
