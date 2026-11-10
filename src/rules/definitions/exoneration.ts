/**
 * Part 4 — Rule 43 (Exoneration), the part that is evaluated: 43.1(b).
 *
 * Rule 43.1(b) is not a rule that imposes a duty: it removes a penalty. It is
 * therefore applied as a post-pass inside `evaluate` (see `../exoneration.ts`),
 * which marks the affected obligations `exoneratedBy: "43.1b"` and reports the
 * rule as applicable when it marked any. This registry entry exists so the rule
 * has a card and an id in the registry (ids in the registry and evaluable
 * content stay in step); its own predicate emits nothing. Rule 43 itself, 43.1(a),
 * 43.1(c) and 43.2 are reference-only content.
 */

import type {RuleDefinition} from "../types";

export const EXONERATION_RULES: RuleDefinition[] = [
	{
		id: "43.1b",
		part: 4,
		scope: "all",
		evaluate: () => [],
	},
];
