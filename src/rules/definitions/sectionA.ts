/**
 * Part 2, Section A (Right of Way) — rules 10 to 13 of the Racing Rules of
 * Sailing (2025–2028 edition). Predicates only; display text lives in
 * `content/rrs-2025.ts`.
 *
 * - Rule 10 (On Opposite Tacks): a port-tack boat keeps clear of a starboard-tack boat.
 * - Rule 11 (On the Same Tack, Overlapped): the windward boat keeps clear of the leeward boat.
 * - Rule 12 (On the Same Tack, Not Overlapped): the boat clear astern keeps clear.
 * - Rule 13 (While Tacking): keep clear until close-hauled; suspends 10, 11 and 12.
 */

import type {BoatState} from "../../model/world";
import {isClearAstern, headingVector} from "../factsEngine";
import type {Obligation, RuleDefinition} from "../types";
import {onPair, otherOf} from "./helpers";

/**
 * Signed lateral offset of `to` from `from`, in `from`'s frame: positive is
 * to starboard (right of her heading), negative is to port.
 */
function lateralOffset(from: BoatState, to: BoatState): number {
	const forward = headingVector(from.heading);
	// Starboard is the heading vector rotated 90° clockwise (y axis points down).
	return (to.x - from.x) * -forward.y + (to.y - from.y) * forward.x;
}

/** Lateral offset (hull lengths) below which a boat is not "clearly" on the other's port side. */
const PORT_SIDE_EPSILON = 1e-6;

/**
 * Rule 13 tiebreak when both boats are tacking: the one on the other's port
 * side keeps clear, else the one astern. Returns the ids that keep clear (both
 * when neither criterion separates them).
 */
function bothTackingKeepClear(a: BoatState, b: BoatState): string[] {
	const bOnAPort = lateralOffset(a, b) < -PORT_SIDE_EPSILON;
	const aOnBPort = lateralOffset(b, a) < -PORT_SIDE_EPSILON;
	if (bOnAPort !== aOnBPort) return [bOnAPort ? b.id : a.id];

	const aAstern = isClearAstern(a, b);
	const bAstern = isClearAstern(b, a);
	if (aAstern !== bAstern) return [aAstern ? a.id : b.id];

	return [a.id, b.id];
}

export const SECTION_A_RULES: RuleDefinition[] = [
	{
		id: "10",
		part: 2,
		section: "A",
		scope: "pair",
		evaluate: onPair(({pair, facts}) => {
			if (pair.facts.sameTack) return [];
			const aStarboard = facts.boats[pair.a.id].tack === "STARBOARD";
			const starboard = aStarboard ? pair.a : pair.b;
			const port = aStarboard ? pair.b : pair.a;
			return [
				{
					ruleId: "10",
					boat: port.id,
					towards: starboard.id,
					kind: "keepClear",
					detail: `Rule 10 — On opposite tacks, ${port.id} is on port tack and must keep clear of ${starboard.id}, which is on starboard tack.`,
				},
			];
		}),
	},
	{
		id: "11",
		part: 2,
		section: "A",
		scope: "pair",
		evaluate: onPair(({pair}) => {
			const f = pair.facts;
			if (!f.sameTack || f.overlapped !== true || f.windwardIsA === null) return [];
			const windward = f.windwardIsA ? pair.a : pair.b;
			const leeward = f.windwardIsA ? pair.b : pair.a;
			return [
				{
					ruleId: "11",
					boat: windward.id,
					towards: leeward.id,
					kind: "keepClear",
					detail: `Rule 11 — On the same tack and overlapped, the windward boat (${windward.id}) must keep clear of the leeward boat (${leeward.id}).`,
				},
			];
		}),
	},
	{
		id: "12",
		part: 2,
		section: "A",
		scope: "pair",
		evaluate: onPair(({pair}) => {
			const f = pair.facts;
			if (!f.sameTack || f.overlapped !== false || f.clearAheadIsA === null) return [];
			const ahead = f.clearAheadIsA ? pair.a : pair.b;
			const astern = f.clearAheadIsA ? pair.b : pair.a;
			return [
				{
					ruleId: "12",
					boat: astern.id,
					towards: ahead.id,
					kind: "keepClear",
					detail: `Rule 12 — On the same tack and not overlapped, the boat clear astern (${astern.id}) must keep clear of the boat clear ahead (${ahead.id}).`,
				},
			];
		}),
	},
	{
		id: "13",
		part: 2,
		section: "A",
		scope: "pair",
		suspends: ["10", "11", "12"],
		evaluate: onPair(({pair, facts}) => {
			const {a, b} = pair;
			const aTacking = facts.boats[a.id].tacking;
			const bTacking = facts.boats[b.id].tacking;
			if (!aTacking && !bTacking) return [];

			const keepClear = aTacking && bTacking ? bothTackingKeepClear(a, b) : [aTacking ? a.id : b.id];
			return keepClear.map((id): Obligation => {
				const other = otherOf(pair, id);
				const detail = aTacking && bTacking ? `Rule 13 — Both ${a.id} and ${b.id} are tacking; ${id} is ${keepClear.length === 1 ? "on the other's port side or astern, so she" : "not separated by either test, so both"} must keep clear.` : `Rule 13 — ${id} is tacking and must keep clear of ${other.id}.`;
				return {ruleId: "13", boat: id, towards: other.id, kind: "keepClear", detail};
			});
		}),
	},
];
