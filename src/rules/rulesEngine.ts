/**
 * Rules Engine — barrel module. The rules layer is split into:
 * - `factsEngine.ts`: the Definitions layer (geometry, tack, overlap, facts).
 * - `types.ts`: obligations, rule definitions and evaluation output shapes.
 * - `registry.ts`: the rule definitions (Part 2, Sections A & B).
 * - `evaluate.ts`: runs the registry over a world, applying rule suspension.
 *
 * Re-exported here so consumers can import every symbol from one place.
 */

export * from "./factsEngine";
export * from "./types";
export * from "./registry";
export * from "./evaluate";
