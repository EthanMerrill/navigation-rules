/**
 * Part 2, Section D — Rule 21 (Exoneration).
 *
 * Rule 21 is not a rule that imposes a duty: it removes a penalty. It is
 * therefore applied as a post-pass inside `evaluate` (see `../exoneration.ts`),
 * which marks the affected obligations `exoneratedBy: "21"` and reports the
 * rule as applicable when it marked any. This registry entry exists so the rule
 * has a card and an id in the registry (ids in the registry and evaluable
 * content stay in step); its own predicate emits nothing.
 */

import type {RuleDefinition} from "../types";

export const EXONERATION_RULES: RuleDefinition[] = [
	{
		id: "21",
		part: 2,
		section: "D",
		scope: "all",
		evaluate: () => [],
	},
];
