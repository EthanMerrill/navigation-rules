/**
 * Rules Engine — barrel module. The rules layer is split into:
 * - `factsEngine.ts`: the Definitions layer (geometry, tack, overlap, facts).
 * - `types.ts`: obligations, rule definitions and evaluation output shapes.
 * - `definitions/`: the rule predicates (Part 2, Sections A & B) and `RULE_REGISTRY`.
 * - `content/rrs-2025.ts`: display text for every rule, keyed by rule id.
 * - `evaluate.ts`: runs the registry over a world, applying rule suspension.
 * - `memory.ts` / `step.ts`: engine memory and the pure per-frame `step` function.
 *
 * Re-exported here so consumers can import every symbol from one place.
 */

export * from "./factsEngine";
export * from "./types";
export * from "./definitions";
export * from "./content/rrs-2025";
export * from "./evaluate";
export * from "./memory";
export * from "./step";
export * from "./obstructionFacts";
export * from "./hails";
export * from "./exoneration";
