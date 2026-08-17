import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import type { GatedItem, PreconditionStatus, ScientificPreconditions } from "./types.js";

interface OverlayEntry {
  description?: string;
  aliases?: string[];
  preconditionStatus?: PreconditionStatus;
  produces_state?: string[];
  preconditions?: ScientificPreconditions;
}

interface OverlayFile {
  skills?: Record<string, OverlayEntry>;
}

export function loadCatalog(yamlPath: string): GatedItem[] {
  const raw = parseYaml(readFileSync(yamlPath, "utf-8")) as OverlayFile;
  const skills = raw.skills ?? {};
  return Object.entries(skills).map(([name, entry]) => ({
    name,
    description: entry.description,
    aliases: entry.aliases,
    preconditionStatus: entry.preconditionStatus ?? "verified",
    produces_state: entry.produces_state,
    preconditions: entry.preconditions,
  }));
}

export function defaultCatalogPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..", "contracts", "docking.yaml");
}

export function loadDefaultCatalog(): GatedItem[] {
  return loadCatalog(defaultCatalogPath());
}

export function findInCatalog(catalog: GatedItem[], name: string): GatedItem | undefined {
  const key = name.trim().toLowerCase().replaceAll("_", "-");
  return catalog.find((item) => {
    if (item.name.toLowerCase() === key) return true;
    return item.aliases?.some((alias) => alias.toLowerCase().replaceAll("_", "-") === key);
  });
}
