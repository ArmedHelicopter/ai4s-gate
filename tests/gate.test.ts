import assert from "node:assert/strict";
import { test } from "node:test";
import {
  afterCall,
  beforeCall,
  createEmptyScientificState,
  gate,
  loadDefaultCatalog,
  noteArtifact,
} from "../src/core/index.js";

const catalog = loadDefaultCatalog();

test("empty session: vina denied, diffdock and fpocket visible", () => {
  const state = createEmptyScientificState();
  // No taskCategory: pocket finders stay visible so the pipeline can start.
  state.searchScope = "blind";
  state.activeLigand = {
    id: "lig",
    kind: "ligand",
    format: "smiles_2d",
    rotatableBonds: 4,
  };
  state.activeReceptor = {
    id: "rec",
    kind: "receptor",
    format: "pdb_experimental",
    tags: { provenance: "experimental" },
  };

  const snapshot = gate(catalog, state);
  const names = snapshot.visible.map((item) => item.name);
  assert.ok(names.includes("diffdock"));
  assert.ok(names.includes("fpocket"));
  assert.ok(!names.includes("autodock-vina"));

  const vina = beforeCall("vina", catalog, state);
  assert.equal(vina.decision, "deny");
  assert.ok(vina.rejectionReasons.some((r) => /pocket_defined|charges_assigned|pdbqt/i.test(r)));
});

test("after fpocket + ligand prep, vina is allowed on pdbqt", () => {
  const state = createEmptyScientificState();
  state.taskCategory = "docking";
  state.searchScope = "pocket_targeted";
  state.bindingMode = "noncovalent";
  noteArtifact(state, {
    id: "lig",
    kind: "ligand",
    format: "pdbqt",
    rotatableBonds: 6,
  });
  noteArtifact(state, {
    id: "rec",
    kind: "receptor",
    format: "pdbqt",
    tags: { provenance: "experimental" },
  });

  afterCall("fpocket", catalog, state);
  afterCall("rdkit-ligand-prep", catalog, state);

  const vina = beforeCall("autodock-vina", catalog, state);
  assert.equal(vina.decision, "allow", vina.rejectionReasons.join("; "));
});

test("unknown tool is not blocked by the catalog", () => {
  const state = createEmptyScientificState();
  const result = beforeCall("bash", catalog, state);
  assert.equal(result.decision, "unknown");
});
