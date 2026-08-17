export interface ScaleBound {
  min?: number;
  max?: number;
  soft_min?: number;
  soft_max?: number;
  unit?: string;
  value?: number;
}

export interface ScientificPreconditions {
  contract_version?: string;
  category?: string;
  accepts?: {
    ligand?: string[];
    receptor?: string[];
    [key: string]: string[] | undefined;
  };
  search_scope?: string[];
  scale?: Record<string, number | ScaleBound>;
  requires_tag?: Record<string, Record<string, string[] | string>>;
  requires_state?: string[];
  excludes?: {
    binding_mode?: string[];
    search_scope?: string[];
    [key: string]: string[] | undefined;
  };
}

export type PreconditionStatus = "verified" | "unverified" | "none";

export interface ArtifactDescriptor {
  id: string;
  kind: "structure" | "ligand" | "receptor" | "trajectory" | "table" | "report" | string;
  format: string;
  filePath?: string;
  tags?: Record<string, string | number | boolean>;
  atomCount?: number;
  rotatableBonds?: number;
  states?: string[];
  summary?: Record<string, unknown>;
}

export interface SessionScientificState {
  artifacts: Map<string, ArtifactDescriptor>;
  activeLigand?: ArtifactDescriptor;
  activeReceptor?: ArtifactDescriptor;
  bindingMode?: string;
  searchScope?: string;
  taskCategory?: string;
  pipelineStates: Set<string>;
  hasCommercialLicense?: boolean;
}

export interface TypeCheckResult {
  toolName: string;
  isValid: boolean;
  status: "valid" | "unverified" | "gated";
  rejectionReasons: string[];
  softWarnings: string[];
}

/** Host-agnostic catalog entry. No agent, plugin, or filesystem identity. */
export interface GatedItem {
  name: string;
  description?: string;
  aliases?: string[];
  preconditions?: ScientificPreconditions;
  preconditionStatus?: PreconditionStatus;
  produces_state?: string[];
}

export type CallDecision = "allow" | "deny" | "unknown";

export interface BeforeCallResult extends TypeCheckResult {
  decision: CallDecision;
}

export interface GateResult {
  visible: GatedItem[];
  gated: Array<{ item: GatedItem; result: TypeCheckResult }>;
}
