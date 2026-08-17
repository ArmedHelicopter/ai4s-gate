import type { ArtifactDescriptor, SessionScientificState } from "./types.js";
import { inspectScientificFile } from "./fileInspector.js";

const SCI_PATH_RE = /([^\s"'<>]+\.(?:pdb|cif|sdf|pdbqt|smi|smiles|mol2|mol))\b/gi;

export function createEmptyScientificState(): SessionScientificState {
  return {
    artifacts: new Map(),
    pipelineStates: new Set(),
  };
}

export function noteArtifact(state: SessionScientificState, artifact: ArtifactDescriptor): void {
  state.artifacts.set(artifact.id, artifact);
  if (artifact.kind === "ligand") state.activeLigand = artifact;
  if (artifact.kind === "receptor" || artifact.kind === "structure") {
    state.activeReceptor = artifact;
  }
}

export function addPipelineState(state: SessionScientificState, tag: string): void {
  state.pipelineStates.add(tag);
}

export function extractScientificPaths(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(SCI_PATH_RE)) {
    if (match[1]) found.add(match[1]);
  }
  return [...found];
}

export async function ingestScientificPaths(
  state: SessionScientificState,
  text: string,
): Promise<ArtifactDescriptor[]> {
  const ingested: ArtifactDescriptor[] = [];
  for (const filePath of extractScientificPaths(text)) {
    try {
      const artifact = await inspectScientificFile(filePath);
      noteArtifact(state, artifact);
      ingested.push(artifact);
    } catch {
      // Path may be hypothetical or not yet written.
    }
  }
  return ingested;
}
