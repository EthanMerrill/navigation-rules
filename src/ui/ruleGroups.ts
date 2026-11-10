/**
 * Sidebar grouping: rules are grouped by Part (and Section, in Part 2) using
 * their content entry. Pure helpers; the sidebar owns the collapse state.
 */

import {contentOf} from "../rules/rulesEngine";
import type {RuleContent, RuleId} from "../rules/rulesEngine";

/** Key of the collapsed-by-default reference-only group. */
export const REFERENCE_GROUP_KEY = "reference";

/** Titles of Part 2's sections. */
const SECTION_TITLES: Record<NonNullable<RuleContent["section"]>, string> = {
	A: "Right of Way",
	B: "General Limitations",
	C: "At Marks and Obstructions",
	D: "Other Rules",
};

/** Titles of the other Parts. */
const PART_TITLES: Record<RuleContent["part"], string> = {
	1: "Fundamental Rules",
	2: "When Boats Meet",
	3: "Conduct of a Race",
	4: "Other Requirements When Racing",
	5: "Protests, Redress, Hearings",
};

/** A group of rules under one header. `key` sorts in Part/Section order. */
export interface RuleGroup<T> {
	key: string;
	title: string;
	rules: T[];
}

/** The group key for a rule's content: "2A" for Part 2 Section A, "3" for Part 3. */
export function groupKeyOf(content: Pick<RuleContent, "part" | "section">): string {
	return `${content.part}${content.section ?? ""}`;
}

/** The header title for a group key. */
export function groupTitle(key: string): string {
	const part = Number(key[0]) as RuleContent["part"];
	const section = key[1] as RuleContent["section"];
	if (section) return `Part ${part} · Section ${section} — ${SECTION_TITLES[section]}`;
	return `Part ${part} — ${PART_TITLES[part]}`;
}

/**
 * Split rules into groups by Part/Section, groups in Part/Section order and
 * rules in their incoming order within each group.
 */
export function groupRules<T extends {id: RuleId}>(rules: T[]): RuleGroup<T>[] {
	const groups = new Map<string, RuleGroup<T>>();
	for (const rule of rules) {
		const key = groupKeyOf(contentOf(rule.id));
		const group = groups.get(key) ?? {key, title: groupTitle(key), rules: []};
		group.rules.push(rule);
		groups.set(key, group);
	}
	return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}
