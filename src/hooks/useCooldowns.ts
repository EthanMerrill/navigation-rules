import {useEffect, useRef, useState} from "react";
import type {RuleEvaluation} from "../rules/rulesEngine";

/** Snapshot of a single rule's cooldown, keyed by rule id. */
export interface CooldownState {
	/** Cooldown duration in ms (copied from the rule definition). */
	durationMs: number;
	/** True while the rule is latched as "still applying" (cooling down). */
	active: boolean;
	/** Increments on every (re-)fire so a remounted indicator restarts its animation. */
	key: number;
}

/**
 * Tracks cooldowns for the transient limitation rules (15 & 16).
 *
 * A cooldown rule becomes "latched" the moment the engine reports it applicable
 * and stays applicable for `cooldownMs` after its last fire. If its condition
 * persists (or recurs) the timer refreshes, so the rule only starts cooling down
 * once it stops firing.
 */
export function useCooldowns(evaluation: RuleEvaluation): Record<string, CooldownState> {
	const [cooldowns, setCooldowns] = useState<Record<string, CooldownState>>({});
	const timeoutsRef = useRef<Record<string, number>>({});

	useEffect(() => {
		for (const rule of evaluation.rules) {
			const durationMs = rule.cooldownMs;
			if (durationMs === undefined) continue;

			const ruleNumber = rule.id;
			if (!rule.applicable) continue;

			// (Re-)fire: refresh the timer and restart the drain animation.
			const existing = timeoutsRef.current[ruleNumber];
			if (existing !== undefined) {
				window.clearTimeout(existing);
				delete timeoutsRef.current[ruleNumber];
			}

			setCooldowns((prev) => ({
				...prev,
				[ruleNumber]: {durationMs, active: true, key: (prev[ruleNumber]?.key ?? 0) + 1},
			}));

			timeoutsRef.current[ruleNumber] = window.setTimeout(() => {
				setCooldowns((prev) => {
					const current = prev[ruleNumber];
					return current ? {...prev, [ruleNumber]: {...current, active: false}} : prev;
				});
				delete timeoutsRef.current[ruleNumber];
			}, durationMs);
		}
	}, [evaluation]);

	// Clear any pending timers when the component unmounts.
	useEffect(() => {
		const timeouts = timeoutsRef.current;
		return () => {
			for (const key of Object.keys(timeouts)) {
				window.clearTimeout(timeouts[key]);
			}
		};
	}, []);

	return cooldowns;
}
