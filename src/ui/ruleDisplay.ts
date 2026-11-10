/**
 * Per-rule display configuration. These are presentation choices (how long a
 * card stays lit, when a rule that always applies is worth highlighting), not
 * rules of the game, so they live outside the rules engine.
 */

import type {PairView, RuleId, RuleState} from "../rules/rulesEngine";

/** Display options for one rule. */
export interface RuleDisplay {
	/** For transient limitation rules (15, 16): how long the card stays lit (ms) after the rule fires. */
	cooldownMs?: number;
	/** For rules that always apply (14): only show as applicable when the focus pair is close or has collided. */
	proximityOnly?: boolean;
}

/** How long a transient limitation rule (15, 16) stays shown after it fires. */
const LIMITATION_RULE_COOLDOWN_MS = 10000;

/**
 * Separation below which boats are shown as at risk of contact (Rule 14), in
 * hull lengths (≈ 300px at the default view scale).
 */
export const CONTACT_RISK_DISTANCE = 300 / 161.5;

/** Display options by rule id; rules not listed use the defaults. */
export const RULE_DISPLAY: Record<RuleId, RuleDisplay> = {
	"14": {proximityOnly: true},
	"15": {cooldownMs: LIMITATION_RULE_COOLDOWN_MS},
	"16": {cooldownMs: LIMITATION_RULE_COOLDOWN_MS},
};

/** Display options for a rule, with defaults for unlisted rules. */
export function displayOf(id: RuleId): RuleDisplay {
	return RULE_DISPLAY[id] ?? {};
}

/**
 * Whether the sidebar should show the rule as applicable: the engine's verdict,
 * except that a `proximityOnly` rule also needs the focus pair to be within
 * `CONTACT_RISK_DISTANCE` (or colliding).
 */
export function isShownApplicable(rule: RuleState, focusPair: PairView | null): boolean {
	if (!rule.applicable) return false;
	if (!displayOf(rule.id).proximityOnly) return true;
	return focusPair !== null && (focusPair.collided || focusPair.separation < CONTACT_RISK_DISTANCE);
}
