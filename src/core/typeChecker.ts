import type {
  GatedItem,
  ScaleBound,
  SessionScientificState,
  TypeCheckResult,
} from "./types.js";

export function evaluatePreconditions(
  item: GatedItem,
  state: SessionScientificState,
): TypeCheckResult {
  const toolName = item.name;

  if (item.preconditionStatus === "unverified" || !item.preconditions) {
    return {
      toolName,
      isValid: true,
      status: "unverified",
      rejectionReasons: [],
      softWarnings: ["Skill has unverified preconditions contract (not filtered)"],
    };
  }

  if (item.preconditionStatus === "none") {
    return {
      toolName,
      isValid: true,
      status: "valid",
      rejectionReasons: [],
      softWarnings: [],
    };
  }

  const pre = item.preconditions;
  const rejectionReasons: string[] = [];
  const softWarnings: string[] = [];

  if (
    pre.category &&
    state.taskCategory &&
    pre.category !== state.taskCategory &&
    pre.category !== "general"
  ) {
    rejectionReasons.push(
      `Category mismatch: task requires '${state.taskCategory}', but skill is '${pre.category}'`,
    );
  }

  if (pre.search_scope && state.searchScope) {
    if (!pre.search_scope.includes(state.searchScope)) {
      rejectionReasons.push(
        `Search scope mismatch: task requires '${state.searchScope}', but skill only supports [${pre.search_scope.join(", ")}]`,
      );
    }
  }

  if (pre.accepts) {
    if (state.activeLigand?.format && pre.accepts.ligand && pre.accepts.ligand.length > 0) {
      if (!pre.accepts.ligand.includes(state.activeLigand.format)) {
        rejectionReasons.push(
          `Ligand format mismatch: skill requires [${pre.accepts.ligand.join(", ")}], but active ligand is '${state.activeLigand.format}'`,
        );
      }
    }

    if (state.activeReceptor?.format && pre.accepts.receptor && pre.accepts.receptor.length > 0) {
      if (!pre.accepts.receptor.includes(state.activeReceptor.format)) {
        rejectionReasons.push(
          `Receptor format mismatch: skill requires [${pre.accepts.receptor.join(", ")}], but active receptor is '${state.activeReceptor.format}'`,
        );
      }
    }
  }

  if (pre.scale) {
    for (const [scaleKey, scaleValue] of Object.entries(pre.scale)) {
      let actualVal: number | undefined;

      if (scaleKey === "rotatable_bonds_max" || scaleKey === "rotatable_bonds") {
        actualVal = state.activeLigand?.rotatableBonds;
      } else if (scaleKey === "receptor_atom_count" || scaleKey === "atom_count") {
        actualVal = state.activeReceptor?.atomCount ?? state.activeLigand?.atomCount;
      }

      if (actualVal !== undefined) {
        if (typeof scaleValue === "number") {
          if (actualVal > scaleValue) {
            rejectionReasons.push(
              `Scale limit exceeded: ${scaleKey} (${actualVal}) exceeds maximum capacity (${scaleValue})`,
            );
          }
        } else if (typeof scaleValue === "object" && scaleValue !== null) {
          const bound = scaleValue as ScaleBound;
          const max = bound.max ?? bound.value;
          const softMax = bound.soft_max;
          const min = bound.min;
          const softMin = bound.soft_min;

          if (max !== undefined) {
            if (softMax !== undefined && actualVal > max && actualVal <= softMax) {
              softWarnings.push(
                `Scale warning: ${scaleKey} (${actualVal}) is in soft boundary range (${max} - ${softMax})`,
              );
            } else if (actualVal > (softMax ?? max)) {
              rejectionReasons.push(
                `Scale limit exceeded: ${scaleKey} (${actualVal}) exceeds maximum bound (${softMax ?? max})`,
              );
            }
          }

          if (min !== undefined) {
            if (softMin !== undefined && actualVal < min && actualVal >= softMin) {
              softWarnings.push(
                `Scale warning: ${scaleKey} (${actualVal}) is in soft lower boundary range (${softMin} - ${min})`,
              );
            } else if (actualVal < (softMin ?? min)) {
              rejectionReasons.push(
                `Scale below minimum: ${scaleKey} (${actualVal}) is less than required minimum (${softMin ?? min})`,
              );
            }
          }
        }
      }
    }
  }

  if (pre.requires_tag) {
    if (pre.requires_tag.receptor && state.activeReceptor?.tags) {
      for (const [tagKey, expectedValues] of Object.entries(pre.requires_tag.receptor)) {
        const actualTag = state.activeReceptor.tags[tagKey];
        if (actualTag !== undefined) {
          const allowedList = Array.isArray(expectedValues) ? expectedValues : [expectedValues];
          if (!allowedList.includes(String(actualTag))) {
            rejectionReasons.push(
              `Receptor tag mismatch on '${tagKey}': expected [${allowedList.join(", ")}], but got '${actualTag}'`,
            );
          }
        } else {
          rejectionReasons.push(`Missing receptor provenance tag '${tagKey}' required by skill`);
        }
      }
    }
  }

  if (pre.requires_state && pre.requires_state.length > 0) {
    for (const req of pre.requires_state) {
      if (req === "commercial_license_present") {
        if (!state.hasCommercialLicense) {
          rejectionReasons.push("Commercial license required but not present in session state");
        }
      } else if (!state.pipelineStates.has(req)) {
        rejectionReasons.push(
          `Pipeline prerequisite missing: state lacks required operation '${req}'`,
        );
      }
    }
  }

  if (pre.excludes) {
    if (pre.excludes.binding_mode && state.bindingMode) {
      if (pre.excludes.binding_mode.includes(state.bindingMode)) {
        rejectionReasons.push(
          `Binding mode violation: skill explicitly excludes '${state.bindingMode}' interactions`,
        );
      }
    }
    if (pre.excludes.search_scope && state.searchScope) {
      if (pre.excludes.search_scope.includes(state.searchScope)) {
        rejectionReasons.push(
          `Search scope violation: skill explicitly excludes '${state.searchScope}' mode`,
        );
      }
    }
  }

  const isValid = rejectionReasons.length === 0;
  return {
    toolName,
    isValid,
    status: isValid ? "valid" : "gated",
    rejectionReasons,
    softWarnings,
  };
}
