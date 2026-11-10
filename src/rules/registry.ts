/**
 * Rule registry — Part 2, Sections A (Right of Way) & B (General Limitations) of
 * the Racing Rules of Sailing (2025–2028 edition).
 *
 * Each rule is a `RuleDefinition` that reads the facts computed by
 * `factsEngine.ts` and emits `Obligation`s; `evaluate.ts` runs them over every
 * pair/boat, applies rule suspension and builds the views. No React or DOM code.
 *
 * - Rule 10 (On Opposite Tacks): a port-tack boat keeps clear of a starboard-tack boat.
 * - Rule 11 (On the Same Tack, Overlapped): the windward boat keeps clear of the leeward boat.
 * - Rule 12 (On the Same Tack, Not Overlapped): the boat clear astern keeps clear.
 * - Rule 13 (While Tacking): keep clear until close-hauled; suspends 10, 11 and 12.
 * - Rule 14 (Avoiding Contact): a duty on both boats whenever they meet; broken by a collision.
 *   (How close is "close" for display purposes is UI config, see `ui/ruleDisplay.ts`.)
 * - Rule 15 (Acquiring Right of Way): the new right-of-way boat gives room.
 * - Rule 16 (Changing Course): a right-of-way boat that turns gives room.
 * - Rule 17.1 / 17.2 (Proper Course): limits on a leeward boat that came from
 *   astern and on a windward boat sailing below her proper course.
 */

import type {BoatState} from "../model/world";
import {TWO_HULL_LENGTHS, getPointOfSail, headingVector, inferProperCourse, isClearAstern, isSailingAboveProperCourse, isSailingBelowProperCourse} from "./factsEngine";
import type {EvalContext, Obligation, PairContext, PairEvalContext, RuleDefinition} from "./types";

/** Adapt a pair-scope predicate: it only runs when the context carries a pair. */
function onPair(fn: (ctx: PairEvalContext) => Obligation[]): (ctx: EvalContext) => Obligation[] {
	return (ctx) => (ctx.pair ? fn({...ctx, pair: ctx.pair}) : []);
}

/** The other boat of a pair. */
function otherOf(pair: PairContext, id: string): BoatState {
	return pair.a.id === id ? pair.b : pair.a;
}

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

/** Shared geometry for Rule 17: the windward/leeward boats if 17 could apply to this pair. */
function sameTackOverlapWithinTwoLengths(pair: PairContext): {windward: BoatState; leeward: BoatState} | null {
	const f = pair.facts;
	if (!f.sameTack || f.overlapped !== true || f.windwardIsA === null) return null;
	if (f.separation >= TWO_HULL_LENGTHS) return null;
	return f.windwardIsA ? {windward: pair.a, leeward: pair.b} : {windward: pair.b, leeward: pair.a};
}

export const RULE_REGISTRY: RuleDefinition[] = [
	{
		id: "10",
		part: 2,
		section: "A",
		scope: "pair",
		title: "On Opposite Tacks",
		description: "A port-tack boat must keep clear of a starboard-tack boat.",
		fullText: "When boats are on opposite tacks, a port-tack boat shall keep clear of a starboard-tack boat.",
		laymanExplanation: "When two boats are on different tacks — one has the wind coming over its left (port) side and the other over its right (starboard) side — the port-tack boat must get out of the way of the starboard-tack boat. Starboard has right of way.",
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
		title: "On the Same Tack, Overlapped",
		description: "The windward boat must keep clear of the leeward boat.",
		fullText: "When boats are on the same tack and overlapped, a windward boat shall keep clear of a leeward boat.",
		laymanExplanation: "When two boats are on the same tack and side-by-side, the boat that is upwind (closer to where the wind is coming from) must stay out of the way of the boat that is downwind (leeward). The leeward boat has right of way.",
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
		title: "On the Same Tack, Not Overlapped",
		description: "The boat clear astern must keep clear of the boat clear ahead.",
		fullText: "When boats are on the same tack and not overlapped, a boat clear astern shall keep clear of a boat clear ahead.",
		laymanExplanation: "When two boats are on the same tack and one is clearly in front of the other (not side-by-side), the boat behind must stay out of the way of the boat in front. The boat ahead has right of way.",
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
		title: "While Tacking",
		description: "After a boat passes head to wind, she must keep clear of other boats until she is on a close-hauled course.",
		fullText:
			"After a boat passes head to wind, she shall keep clear of other boats until she is on a close-hauled course. During that time rules 10, 11 and 12 do not apply. If two boats are subject to this rule at the same time, the one on the other's port side or the one astern shall keep clear.",
		laymanExplanation:
			"A boat that is turning through the wind (changing from one tack to the other) loses its normal rights and must stay out of everyone's way until it has finished the turn and is sailing normally again. While it is turning, the usual port/starboard and windward/leeward rules do not apply to it.",
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
	{
		id: "14",
		part: 2,
		section: "B",
		scope: "pair",
		title: "Avoiding Contact",
		description: "A boat shall avoid contact with another boat if reasonably possible.",
		fullText:
			"A boat shall avoid contact with another boat if reasonably possible. However, a right-of-way boat, or one sailing within the room or mark-room to which she is entitled, need not act to avoid contact until it is clear that the other boat is not keeping clear or giving room or mark-room.",
		laymanExplanation: "Both boats must always try not to collide. When they get close together, avoiding contact becomes everyone's responsibility — even the boat with right of way has to act if a crash is about to happen.",
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
		title: "Acquiring Right of Way",
		description: "When a boat acquires right of way, she shall initially give the other boat room to keep clear.",
		fullText: "When a boat acquires right of way, she shall initially give the other boat room to keep clear. She shall not sail to change course to sail a course that would immediately require the other boat to take avoiding action.",
		laymanExplanation: "When you have just gained the right of way, you can't press your advantage straight away — you must first give the other boat enough room to get out of your way.",
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
		title: "Changing Course",
		description: "When a right-of-way boat changes course, she shall give the other boat room to keep clear.",
		fullText:
			"When a right-of-way boat changes course, she shall give the other boat room to keep clear. In addition, when after the starting signal a port-tack boat is keeping clear by sailing to pass astern of a starboard-tack boat, the starboard-tack boat shall not change course if as a result the port-tack boat would immediately need to change course to continue keeping clear.",
		laymanExplanation: "Even if you have right of way, you cannot suddenly alter course into the other boat — if you change direction, you must leave them room to stay clear.",
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
		id: "17.1",
		part: 2,
		section: "B",
		scope: "pair",
		title: "On the Same Tack; Proper Course (leeward from astern)",
		description: "A boat that establishes a leeward overlap from astern must not sail above her proper course.",
		fullText: "If a boat clear astern becomes overlapped within two of her hull lengths to leeward of a boat on the same tack, she shall not sail above her proper course while they remain on the same tack and overlapped within that distance.",
		laymanExplanation:
			"When you sail up from behind and establish an overlap to leeward of another boat, you cannot then turn up toward the wind to push them — you may sail no higher than the course you would sail toward the finish (your proper course).",
		note: "A boat's proper course is assumed to be close-hauled on her current tack — the finish is assumed to be upwind. Until a mark/finish is modelled, Rule 17 treats any windward boat sailing below close-hauled as sailing below her proper course.",
		noteShort: "Proper course assumed close-hauled (finish upwind).",
		evaluate: onPair(({pair, world, history}) => {
			const boats = sameTackOverlapWithinTwoLengths(pair);
			if (!boats || !history.leewardFromAstern?.[pair.key]?.[boats.leeward.id]) return [];
			const {leeward, windward} = boats;
			const properCourse = inferProperCourse(leeward.heading, world.wind.direction);
			if (!isSailingAboveProperCourse(leeward.heading, properCourse, world.wind.direction)) return [];
			return [
				{
					ruleId: "17.1",
					boat: leeward.id,
					towards: windward.id,
					kind: "notAboveProperCourse",
					detail: `Rule 17.1 — ${leeward.id} established a leeward overlap from astern and is sailing above her proper course (${Math.round(properCourse)}°).`,
				},
			];
		}),
	},
	{
		id: "17.2",
		part: 2,
		section: "B",
		scope: "pair",
		title: "On the Same Tack; Proper Course (windward boat)",
		description: "A windward boat close to a leeward boat must not sail below her proper course unless she gybes.",
		fullText: "Except on a beat to windward, while a boat is less than two of her hull lengths from a leeward boat or a boat clear astern that is steering a course to pass to leeward, she shall not sail below her proper course unless she gybes.",
		laymanExplanation: "A windward boat sailing close above a leeward boat cannot bear away below her proper course (unless she gybes) — she cannot force the leeward boat down the course.",
		note: "A boat's proper course is assumed to be close-hauled on her current tack — the finish is assumed to be upwind. Until a mark/finish is modelled, Rule 17 treats any windward boat sailing below close-hauled as sailing below her proper course.",
		noteShort: "Proper course assumed close-hauled (finish upwind).",
		evaluate: onPair(({pair, world}) => {
			const boats = sameTackOverlapWithinTwoLengths(pair);
			if (!boats) return [];
			const {leeward, windward} = boats;
			const wind = world.wind.direction;
			const point = getPointOfSail(windward.heading, wind);
			if (point === "CLOSE_HAULED" || point === "HEAD_TO_WIND") return []; // on a beat to windward
			const properCourse = inferProperCourse(windward.heading, wind);
			if (!isSailingBelowProperCourse(windward.heading, properCourse, wind)) return [];
			return [
				{
					ruleId: "17.2",
					boat: windward.id,
					towards: leeward.id,
					kind: "notBelowProperCourse",
					detail: `Rule 17.2 — ${windward.id} is within two hull lengths of the leeward boat and sailing below her proper course (${Math.round(properCourse)}°).`,
				},
			];
		}),
	},
];
