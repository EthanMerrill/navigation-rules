/**
 * Part 2, Section B (General Limitations) — rules 14 to 17 of the Racing Rules
 * of Sailing (2025–2028 edition). Predicates only; display text lives in
 * `content/rrs-2025.ts`.
 *
 * - Rule 14 (Avoiding Contact): a duty on both boats whenever they meet; broken by a collision.
 *   (How close is "close" for display purposes is UI config, see `ui/ruleDisplay.ts`.)
 * - Rule 15 (Acquiring Right of Way): the new right-of-way boat gives room.
 * - Rule 16 (Changing Course): a right-of-way boat that turns gives room.
 * - Rule 17 (On the Same Tack; Proper Course): a leeward boat that came from astern
 *   does not sail above her proper course. The 2025–2028 edition deleted the old 17.2.
 *   Not applicable before the starting signal (a boat has no proper course then).
 *   NOT MODELLED: the exception "unless in doing so she promptly sails astern of the other boat".
 */

import type {BoatState} from "../../model/world";
import {TWO_HULL_LENGTHS, isSailingAboveProperCourse} from "../factsEngine";
import type {PairContext, RuleDefinition} from "../types";
import {onPair, otherOf} from "./helpers";

/** Shared geometry for Rule 17: the windward/leeward boats if 17 could apply to this pair (same tack, overlapped, within two hull lengths). */
function sameTackOverlapWithinTwoLengths(pair: PairContext): {windward: BoatState; leeward: BoatState} | null {
	const f = pair.facts;
	if (!f.sameTack || f.overlapped !== true || f.windwardIsA === null) return null;
	if (f.separation >= TWO_HULL_LENGTHS) return null;
	return f.windwardIsA ? {windward: pair.a, leeward: pair.b} : {windward: pair.b, leeward: pair.a};
}

export const SECTION_B_RULES: RuleDefinition[] = [
	{
		id: "14",
		part: 2,
		section: "B",
		scope: "pair",
		evaluate: onPair(({pair}) => {
			const f = pair.facts;
			const detail = f.collided ? `Collision — the hulls overlap by ${(-f.separation).toFixed(2)} hull lengths. Both boats must avoid contact.` : `Boats are ${f.separation.toFixed(2)} hull lengths apart — both must act to avoid contact.`;
			return [
				{ruleId: "14", boat: pair.a.id, towards: pair.b.id, kind: "avoidContact", detail},
				{ruleId: "14", boat: pair.b.id, towards: pair.a.id, kind: "avoidContact", detail},
			];
		}),
	},
	{
		id: "15",
		part: 2,
		section: "B",
		scope: "pair",
		needsRightOfWay: true,
		evaluate: onPair(({pair, history, rightOfWay}) => {
			const prev = history.prevRightOfWay?.[pair.key];
			if (!rightOfWay || !prev || prev === rightOfWay) return [];
			const other = otherOf(pair, rightOfWay);
			return [
				{
					ruleId: "15",
					boat: rightOfWay,
					towards: other.id,
					kind: "giveRoom",
					detail: `${rightOfWay} has just acquired right of way from ${other.id} and must initially give room to keep clear.`,
				},
			];
		}),
	},
	{
		id: "16",
		part: 2,
		section: "B",
		scope: "pair",
		needsRightOfWay: true,
		evaluate: onPair(({pair, history, rightOfWay}) => {
			if (!rightOfWay || !history.changingCourse?.[rightOfWay]) return [];
			const other = otherOf(pair, rightOfWay);
			return [
				{
					ruleId: "16",
					boat: rightOfWay,
					towards: other.id,
					kind: "giveRoom",
					detail: `${rightOfWay} is the right-of-way boat and is changing course — it must give room to keep clear.`,
				},
			];
		}),
	},
	{
		id: "17",
		part: 2,
		section: "B",
		scope: "pair",
		evaluate: onPair(({pair, world, facts, history}) => {
			if (world.race.phase === "prestart") return []; // no proper course before the starting signal
			const boats = sameTackOverlapWithinTwoLengths(pair);
			if (!boats || !history.leewardFromAstern?.[pair.key]?.[boats.leeward.id]) return [];
			const {leeward, windward} = boats;
			const properCourse = facts.boats[leeward.id].properCourse;
			if (!isSailingAboveProperCourse(leeward.heading, properCourse, world.wind.direction)) return [];
			return [
				{
					ruleId: "17",
					boat: leeward.id,
					towards: windward.id,
					kind: "notAboveProperCourse",
					detail: `Rule 17 — ${leeward.id} established a leeward overlap from astern and is sailing above her proper course (${Math.round(properCourse)}°).`,
				},
			];
		}),
	},
];
