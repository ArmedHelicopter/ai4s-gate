import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ArtifactDescriptor } from "./types.js";

const METAL_ION_SET = new Set([
  "ZN",
  "MG",
  "MN",
  "FE",
  "CA",
  "CU",
  "NI",
  "CO",
  "CD",
  "HG",
  "NA",
  "K",
]);

export async function inspectScientificFile(
  filePath: string,
  kindHint?: "ligand" | "receptor" | "structure",
): Promise<ArtifactDescriptor> {
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) {
    throw new Error(`Path is not a file: ${filePath}`);
  }

  const rawContent = await fs.readFile(filePath, "utf-8");
  const ext = path.extname(filePath).toLowerCase();
  const baseName = path.basename(filePath, ext);

  switch (ext) {
    case ".pdb":
      return parsePdbContent(rawContent, filePath, baseName, kindHint);
    case ".sdf":
      return parseSdfContent(rawContent, filePath, baseName);
    case ".pdbqt":
      return parsePdbqtContent(rawContent, filePath, baseName, kindHint);
    case ".smi":
    case ".smiles":
      return parseSmilesContent(rawContent, filePath, baseName);
    case ".mol2":
      return parseMol2Content(rawContent, filePath, baseName);
    default:
      return {
        id: baseName,
        kind: kindHint ?? "structure",
        format: "unknown",
        filePath,
        tags: { extension: ext },
      };
  }
}

function parsePdbContent(
  content: string,
  filePath: string,
  id: string,
  kindHint?: string,
): ArtifactDescriptor {
  const lines = content.split(/\r?\n/);
  let atomCount = 0;
  let hasHydrogens = false;
  let isAlphaFold = false;
  let resolution: number | undefined;
  const metalIonsFound = new Set<string>();

  for (const line of lines) {
    const record = line.slice(0, 6).trim();

    if (record === "HEADER" || record === "TITLE" || record === "REMARK") {
      const upper = line.toUpperCase();
      if (
        upper.includes("ALPHAFOLD") ||
        upper.includes("ESMFOLD") ||
        upper.includes("PREDICTED MODEL")
      ) {
        isAlphaFold = true;
      }
      if (line.includes("REMARK   2 RESOLUTION.")) {
        const match = line.match(/RESOLUTION\.\s+([0-9.]+)\s+ANGSTROMS/i);
        if (match && match[1]) {
          resolution = parseFloat(match[1]);
        }
      }
    }

    if (record === "ATOM" || record === "HETATM") {
      atomCount++;
      const atomName = line.slice(12, 16).trim();
      const element = line.slice(76, 78).trim().toUpperCase();

      if (element === "H" || atomName.startsWith("H")) {
        hasHydrogens = true;
      }

      if (record === "HETATM") {
        const ionCandidate = element || atomName.toUpperCase();
        if (METAL_ION_SET.has(ionCandidate)) {
          metalIonsFound.add(ionCandidate);
        }
      }
    }
  }

  const provenance = isAlphaFold ? "predicted" : "experimental";
  const format = isAlphaFold ? "pdb_predicted" : "pdb_experimental";
  const kind = kindHint ?? (atomCount > 500 ? "receptor" : "ligand");

  const tags: Record<string, string | number | boolean> = {
    provenance,
    has_hydrogens: hasHydrogens,
  };
  if (resolution !== undefined) {
    tags["resolution"] = resolution;
  }
  if (metalIonsFound.size > 0) {
    tags["metal_ions"] = Array.from(metalIonsFound).join(",");
    tags["has_metal_cofactors"] = true;
  }

  return {
    id,
    kind,
    format,
    filePath,
    atomCount,
    tags,
    states: hasHydrogens ? ["protonation_assigned"] : [],
    summary: {
      provenance,
      atomCount,
      resolution,
      metalIons: Array.from(metalIonsFound),
    },
  };
}

function parseSdfContent(content: string, filePath: string, id: string): ArtifactDescriptor {
  const lines = content.split(/\r?\n/);
  let atomCount = 0;
  let is3D = false;
  let rotatableBonds = 0;

  if (lines.length >= 4) {
    const countsLine = lines[3] ?? "";
    const parsedAtoms = parseInt(countsLine.slice(0, 3).trim(), 10);
    const parsedBonds = parseInt(countsLine.slice(3, 6).trim(), 10);

    if (!isNaN(parsedAtoms) && parsedAtoms > 0) {
      atomCount = parsedAtoms;
    }

    let nonZeroZ = false;
    for (let i = 4; i < Math.min(4 + atomCount, lines.length); i++) {
      const line = lines[i] ?? "";
      if (line.length >= 30) {
        const z = parseFloat(line.slice(20, 30).trim());
        if (!isNaN(z) && Math.abs(z) > 0.0001) {
          nonZeroZ = true;
          break;
        }
      }
    }
    is3D = nonZeroZ;

    if (!isNaN(parsedBonds) && parsedBonds > 0) {
      const bondStart = 4 + atomCount;
      let singleBonds = 0;
      for (let i = bondStart; i < Math.min(bondStart + parsedBonds, lines.length); i++) {
        const line = lines[i] ?? "";
        if (line.length >= 6) {
          const bondType = parseInt(line.slice(6, 9).trim(), 10);
          if (bondType === 1) {
            singleBonds++;
          }
        }
      }
      rotatableBonds = Math.max(0, Math.round(singleBonds * 0.45));
    }
  }

  const format = is3D ? "sdf_3d" : "sdf_2d";

  return {
    id,
    kind: "ligand",
    format,
    filePath,
    atomCount,
    rotatableBonds,
    tags: { is_3d: is3D },
    summary: { atomCount, rotatableBonds, is3D },
  };
}

function parsePdbqtContent(
  content: string,
  filePath: string,
  id: string,
  kindHint?: string,
): ArtifactDescriptor {
  const lines = content.split(/\r?\n/);
  let atomCount = 0;
  let rotatableBonds = 0;
  let hasGasteigerCharges = false;

  for (const line of lines) {
    const record = line.slice(0, 6).trim();
    if (record === "ATOM" || record === "HETATM") {
      atomCount++;
      if (line.length >= 76) {
        const charge = parseFloat(line.slice(70, 76).trim());
        if (!isNaN(charge)) {
          hasGasteigerCharges = true;
        }
      }
    }
    if (record === "BRANCH") {
      rotatableBonds++;
    }
  }

  const kind = kindHint ?? (rotatableBonds > 0 || atomCount < 150 ? "ligand" : "receptor");

  return {
    id,
    kind,
    format: "pdbqt",
    filePath,
    atomCount,
    rotatableBonds: kind === "ligand" ? rotatableBonds : undefined,
    tags: { has_gasteiger_charges: hasGasteigerCharges },
    states: ["charges_assigned", "protonation_assigned"],
    summary: { atomCount, rotatableBonds, hasGasteigerCharges },
  };
}

function parseSmilesContent(content: string, filePath: string, id: string): ArtifactDescriptor {
  const firstLine = content.trim().split(/\r?\n/)[0] ?? "";
  const smiles = firstLine.split(/\s+/)[0] ?? "";
  const heavyAtoms = (smiles.match(/[CNOFPSIKLBr]/gi) || []).length;
  const rotatableEstimate = Math.max(1, Math.floor(heavyAtoms / 4));

  return {
    id,
    kind: "ligand",
    format: "smiles_2d",
    filePath,
    atomCount: heavyAtoms,
    rotatableBonds: rotatableEstimate,
    tags: { smiles_string: smiles, is_3d: false },
    summary: { smiles, atomCount: heavyAtoms, rotatableBonds: rotatableEstimate },
  };
}

function parseMol2Content(content: string, filePath: string, id: string): ArtifactDescriptor {
  const lines = content.split(/\r?\n/);
  let atomCount = 0;
  let inAtomBlock = false;

  for (const line of lines) {
    if (line.startsWith("@<TRIPOS>ATOM")) {
      inAtomBlock = true;
      continue;
    }
    if (line.startsWith("@<TRIPOS>BOND") || line.startsWith("@<TRIPOS>SUBSTRUCTURE")) {
      inAtomBlock = false;
    }
    if (inAtomBlock && line.trim().length > 0) {
      atomCount++;
    }
  }

  const rotatableBonds = Math.max(1, Math.floor(atomCount / 4));

  return {
    id,
    kind: "ligand",
    format: "mol2",
    filePath,
    atomCount,
    rotatableBonds,
    tags: { is_3d: true },
    states: ["charges_assigned"],
    summary: { atomCount, rotatableBonds },
  };
}
