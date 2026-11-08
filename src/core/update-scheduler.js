const DEFAULT_PHASES = Object.freeze([
  "environment", "behaviour", "actuation", "forces", "integration",
  "constraints", "metabolism", "snapshot"
]);

/**
 * Stable deterministic phase scheduler. Systems in a phase execute by ascending
 * order, then registration sequence. Registration changes during dispatch are rejected.
 */
export function createUpdateScheduler(phases = DEFAULT_PHASES) {
  if (!Array.isArray(phases) || phases.length === 0 || new Set(phases).size !== phases.length) {
    throw new TypeError("Scheduler phases must be a non-empty array of unique names");
  }
  const phaseSet = new Set(phases);
  const systems = new Map();
  let sequence = 0;
  let dispatching = false;

  function register({ id, phase, order = 0, update }) {
    if (dispatching) throw new Error("Cannot register systems during scheduler dispatch");
    if (typeof id !== "string" || !id) throw new TypeError("System id must be a non-empty string");
    if (!phaseSet.has(phase)) throw new RangeError(`Unknown scheduler phase: ${phase}`);
    if (!Number.isFinite(order)) throw new TypeError("System order must be finite");
    if (typeof update !== "function") throw new TypeError("System update must be a function");
    if (systems.has(id)) throw new Error(`Duplicate system id: ${id}`);
    systems.set(id, { id, phase, order, sequence: sequence++, update });
    return () => {
      if (dispatching) throw new Error("Cannot unregister systems during scheduler dispatch");
      return systems.delete(id);
    };
  }

  function step(context) {
    if (dispatching) throw new Error("Scheduler dispatch is not re-entrant");
    dispatching = true;
    try {
      for (const phase of phases) {
        const batch = [...systems.values()]
          .filter(system => system.phase === phase)
          .sort((a, b) => a.order - b.order || a.sequence - b.sequence);
        for (const system of batch) system.update(context);
      }
    } finally {
      dispatching = false;
    }
  }

  return Object.freeze({
    register,
    step,
    get phases() { return phases.slice(); },
    get systemCount() { return systems.size; }
  });
}

export { DEFAULT_PHASES };
