/**
 * Rule registry — every evaluable rule, assembled from the section files.
 *
 * Each rule is a `RuleDefinition` that reads the facts computed by
 * `factsEngine.ts` and emits `Obligation`s; `evaluate.ts` runs them over every
 * pair/boat, applies rule suspension and builds the views. Display text for
 * each rule lives in `content/rrs-2025.ts`, keyed by the same id.
 */

import type {RuleDefinition} from "../types";
import {SECTION_A_RULES} from "./sectionA";
import {SECTION_B_RULES} from "./sectionB";
import {OBSTRUCTION_RULES} from "./obstructions";
import {SECTION_C_RULES} from "./sectionC";

export const RULE_REGISTRY: RuleDefinition[] = [...SECTION_A_RULES, ...SECTION_B_RULES, ...SECTION_C_RULES, ...OBSTRUCTION_RULES];
