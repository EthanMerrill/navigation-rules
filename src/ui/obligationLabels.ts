/**
 * Short, boat-tag-sized labels for obligations. Presentation only: the rules
 * engine reports obligations; this file decides how they read on the water.
 */

import type {Obligation, ObligationKind} from "../rules/rulesEngine";

/** Label builders by obligation kind; `towards` is the boat the duty is owed to, if any. */
export const OBLIGATION_LABELS: Record<ObligationKind, (towards?: string) => string> = {
	keepClear: (towards) => (towards ? `Keep clear of ${towards}` : "Keep clear"),
	giveRoom: (towards) => (towards ? `Give room to ${towards}` : "Give room"),
	giveMarkRoom: (towards) => (towards ? `Give mark-room to ${towards}` : "Give mark-room"),
	avoidContact: () => "Avoid contact",
	notAboveProperCourse: () => "No higher than proper course",
	notBelowProperCourse: () => "No lower than proper course",
	sailNoFartherFromMark: () => "Sail no farther from the mark than needed",
};

/** The short label for one obligation. */
export function obligationLabel(obligation: Obligation): string {
	return OBLIGATION_LABELS[obligation.kind](obligation.towards);
}

/**
 * Unique labels for a boat's obligations, in order. Obligations that read the
 * same (e.g. an avoid-contact duty owed once per other boat) show once.
 */
export function obligationLabels(obligations: Obligation[]): string[] {
	return [...new Set(obligations.map(obligationLabel))];
}
