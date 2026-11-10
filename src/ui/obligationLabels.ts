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
	tackAsSoonAsPossible: () => "Tack as soon as possible",
	notCauseAboveCloseHauled: (towards) => (towards ? `Don't force ${towards} above close-hauled` : "Don't force a boat above close-hauled"),
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

/** A label for a boat tag; `exonerated` when every obligation reading this way is exonerated (Rule 21). */
export interface ObligationTag {
	label: string;
	exonerated: boolean;
}

/** Unique tags for a boat's obligations, in order, noting which are exonerated. */
export function obligationTags(obligations: Obligation[]): ObligationTag[] {
	const tags = new Map<string, boolean>();
	for (const o of obligations) {
		const label = obligationLabel(o);
		tags.set(label, (tags.get(label) ?? true) && o.exoneratedBy !== undefined);
	}
	return [...tags].map(([label, exonerated]) => ({label, exonerated}));
}
