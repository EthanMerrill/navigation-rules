/**
 * The badge drawn next to each boat: only the rules that take precedence for
 * her right now, not every fact about her. Presentation only.
 *
 * Precedence, highest first:
 *   1. Right of way: she keeps clear of nobody, and somebody keeps clear of her.
 *      Or her keep-clear duty (Rules 10–13, 19.2c), unless it is exonerated
 *      (Rule 43.1(b)): then the room she is entitled to supersedes it on the badge.
 *   2. Room or mark-room she is entitled to (Sections C and D modify A and B).
 *   3. Room, mark-room or a tack she owes (Sections C and D).
 *   4. Limitations (Rules 15–18.4 that restrict how she sails).
 *
 * Rule 14 (avoid contact) applies to every boat all the time, so it is left
 * off the badge; the sidebar shows it when boats get close.
 */

import {NOT_ROOM_SOURCES, type Obligation, type ObligationKind, type RuleId} from "../rules/rulesEngine";
import {OBLIGATION_LABELS} from "./obligationLabels";

export type BadgeTone = "rightOfWay" | "keepClear" | "entitled" | "duty" | "limitation";

export interface BadgeLine {
	tone: BadgeTone;
	text: string;
	/** Rules behind this line, in first-seen order. */
	rules: RuleId[];
}

export interface BoatBadge {
	lines: BadgeLine[];
	/** Lines that were ranked below the cut-off and not shown. */
	hidden: number;
}

/** How many lines a badge shows; the rest are counted in `hidden`. */
export const MAX_BADGE_LINES = 2;

const TONE_RANK: Record<BadgeTone, number> = {rightOfWay: 0, keepClear: 0, entitled: 1, duty: 2, limitation: 3};

/** Whether this obligation gives `towards` room or mark-room (as opposed to "room to keep clear"). */
function isRoomEntitlement(o: Obligation): boolean {
	return (o.kind === "giveMarkRoom" || o.kind === "giveRoom") && !NOT_ROOM_SOURCES.has(o.ruleId) && o.towards !== undefined;
}

function toneOfDuty(o: Obligation): BadgeTone {
	if (o.kind === "keepClear") return "keepClear";
	if (isRoomEntitlement(o) || o.kind === "tackAsSoonAsPossible") return "duty";
	return "limitation";
}

/** Join boat ids: "boat1", "boat1 and boat2", "boat1, boat2 and boat3". */
function joinIds(ids: string[]): string {
	return ids.length <= 1 ? (ids[0] ?? "") : `${ids.slice(0, -1).join(", ")} and ${ids[ids.length - 1]}`;
}

/** Accumulates obligations into one line per (tone, kind), merging the boats and rules. */
class LineBuilder {
	private groups = new Map<string, {tone: BadgeTone; kind: ObligationKind | "rightOfWay"; boats: string[]; rules: RuleId[]; order: number}>();

	add(tone: BadgeTone, kind: ObligationKind | "rightOfWay", boat: string | undefined, rule: RuleId) {
		const key = `${tone}|${kind}`;
		let g = this.groups.get(key);
		if (!g) {
			g = {tone, kind, boats: [], rules: [], order: this.groups.size};
			this.groups.set(key, g);
		}
		if (boat !== undefined && !g.boats.includes(boat)) g.boats.push(boat);
		if (!g.rules.includes(rule)) g.rules.push(rule);
	}

	build(): BadgeLine[] {
		return [...this.groups.values()]
			.sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone] || a.order - b.order)
			.map(({tone, kind, boats, rules}) => ({tone, rules, text: lineText(tone, kind, boats)}));
	}
}

function lineText(tone: BadgeTone, kind: ObligationKind | "rightOfWay", boats: string[]): string {
	const who = boats.length > 0 ? joinIds(boats) : undefined;
	if (kind === "rightOfWay") return "Right of way";
	if (tone === "entitled") return `${kind === "giveMarkRoom" ? "Mark-room" : "Room"} from ${who}`;
	return OBLIGATION_LABELS[kind](who);
}

/**
 * The badge for `boatId`, from every obligation in the evaluation (her own
 * duties and the ones other boats owe her).
 */
export function boatBadge(boatId: string, obligations: Obligation[]): BoatBadge {
	const mine = obligations.filter((o) => o.boat === boatId && o.kind !== "avoidContact");
	const owedToMe = obligations.filter((o) => o.towards === boatId);
	const lines = new LineBuilder();

	const keepsClear = mine.some((o) => o.kind === "keepClear");
	if (!keepsClear) {
		for (const o of owedToMe) if (o.kind === "keepClear") lines.add("rightOfWay", "rightOfWay", undefined, o.ruleId);
	}
	for (const o of owedToMe) if (isRoomEntitlement(o)) lines.add("entitled", o.kind, o.boat, o.ruleId);
	for (const o of mine) {
		// An exonerated duty is superseded by the room she is entitled to, which is shown instead.
		if (o.exoneratedBy !== undefined) continue;
		lines.add(toneOfDuty(o), o.kind, o.towards, o.ruleId);
	}

	const all = lines.build();
	return {lines: all.slice(0, MAX_BADGE_LINES), hidden: Math.max(0, all.length - MAX_BADGE_LINES)};
}
