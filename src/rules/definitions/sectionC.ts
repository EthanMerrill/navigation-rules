/**
 * Part 2, Section C (At Marks and Obstructions) — Rule 18 (Mark-Room) of the
 * Racing Rules of Sailing (2025–2028 edition). Predicates only; display text
 * lives in `content/rrs-2025.ts`.
 *
 * - 18.2(a): the situation when the first of the boats reached the zone decides who gives mark-room
 *   ((1) overlapped: the outside boat; (2) not overlapped: the boat that had not reached the zone),
 *   and the duty continues while the latch is live, even if an overlap is later broken or begun.
 * - 18.2(c): when no 18.2(a) latch is live and the boats are overlapped, the outside boat gives the inside boat mark-room.
 * - 18.3: tacking in the zone of a mark to be left to port. Rule 18.2 does not apply between the tacker and a
 *   starboard-tack boat that is fetching the mark (suspends 18.2(a) and 18.2(c)); if that boat has been on starboard
 *   tack since entering the zone the tacker must not force her above close-hauled and gives her mark-room if she
 *   becomes overlapped inside. It does not suspend Rules 10-12: right of way is unchanged.
 * - 18.4: gybing at a mark; limits the inside right-of-way boat. Not applicable before the starting signal (no proper course).
 *
 * 18.1 (applicability, including the Section C preamble for starting marks) is `rule18Applies` in `markRoom.ts`;
 * 18.2(b) (release of the entry latch) is applied in `markMemory.ts`. 18.1, 18.2(b), 18.2(d) and 18.2(e) are
 * reference-only content entries. NOT MODELLED: 18.2(d) (an inside overlap the outside boat was unable to give
 * mark-room for) and 18.2(e) (reasonable doubt about an overlap).
 */

import type {Mark} from "../../model/world";
import {getWindAngle} from "../factsEngine";
import {insideBoatId} from "../markFacts";
import type {Obligation, PairEvalContext, RuleDefinition} from "../types";
import {onPair, otherOf} from "./helpers";
import {entryLatch, giveMarkRoom, markFactsOf, marksUnderRule18, tackSuspensions} from "./markRoom";

/** Obligations from `fn` over every mark that Rule 18 applies to between the pair. */
function perMark(ctx: PairEvalContext, fn: (mark: Mark) => Obligation[]): Obligation[] {
	return marksUnderRule18(ctx).flatMap(fn);
}

/** Whether Rule 18.3 has suspended Rule 18.2 between the pair at `mark`, even when 18.3 has no duty to impose. */
function suspendedBy183(ctx: PairEvalContext, mark: Mark): boolean {
	return tackSuspensions(ctx, mark).length > 0;
}

/** Whether the boat must gybe to sail her proper course around `mark` (Rule 18.4 approximation, see content note). */
function mustGybe(ctx: PairEvalContext, boat: {id: string; heading: number}, mark: Mark): boolean {
	const tack = ctx.facts.boats[boat.id].tack;
	if (tack === null || getWindAngle(boat.heading, ctx.world.wind.direction) <= 90) return false;
	// The mark is on her leeward side when the side she leaves it on is opposite her windward side.
	const leewardSide = tack === "STARBOARD" ? "port" : "starboard";
	return mark.roundingSide === leewardSide;
}

export const SECTION_C_RULES: RuleDefinition[] = [
	{
		id: "18.2a",
		part: 2,
		section: "C",
		scope: "pair",
		evaluate: onPair((ctx) =>
			perMark(ctx, (mark) => {
				const entry = entryLatch(ctx, mark);
				if (!entry || suspendedBy183(ctx, mark)) return [];
				const {entitled, giver, latch, changed} = entry;
				const clause = latch.overlappedAtEntry ? "(1)" : "(2)";
				const why = latch.overlappedAtEntry ? `the boats were overlapped when the first reached the zone of ${mark.id} and ${entitled.id} was inside` : `the boats were not overlapped when the first reached the zone of ${mark.id}; ${entitled.id} had reached it and ${giver.id} had not`;
				const since = !changed ? "" : latch.overlappedAtEntry ? " The overlap has since been broken, but the duty continues." : " A new overlap has since begun, but the duty continues.";
				return [giveMarkRoom("18.2a", giver, entitled, `Rule 18.2(a)${clause} — ${why}, so ${giver.id} gives ${entitled.id} mark-room.${since}`)];
			}),
		),
	},
	{
		id: "18.2c",
		part: 2,
		section: "C",
		scope: "pair",
		evaluate: onPair((ctx) =>
			perMark(ctx, (mark) => {
				const {a, b} = ctx.pair;
				// "When rule 18.2(a) does not apply": no live latch entitling a boat, or released, or suspended by 18.3.
				if (entryLatch(ctx, mark) || suspendedBy183(ctx, mark) || !ctx.pair.facts.overlappedGeometric) return [];
				const insideId = insideBoatId(a, b, mark);
				if (insideId === null) return [];
				const inside = insideId === a.id ? a : b;
				const outside = otherOf(ctx.pair, insideId);
				return [giveMarkRoom("18.2c", outside, inside, `Rule 18.2(c) — Rule 18.2(a) does not apply and ${outside.id} and ${inside.id} are overlapped at ${mark.id}; the outside boat (${outside.id}) gives the inside boat (${inside.id}) mark-room.`)];
			}),
		),
	},
	{
		id: "18.3",
		part: 2,
		section: "C",
		scope: "pair",
		suspends: ["18.2a", "18.2c"],
		evaluate: onPair((ctx) =>
			perMark(ctx, (mark) => {
				const out: Obligation[] = [];
				for (const {tacker, other} of tackSuspensions(ctx, mark)) {
					// "On starboard tack since entering the zone": in the zone, on starboard tack, and not herself having tacked there.
					if (!markFactsOf(ctx, other, mark).inZone || ctx.history.tackedInZone?.[other.id] === mark.id) continue;
					out.push({
						ruleId: "18.3",
						boat: tacker.id,
						towards: other.id,
						kind: "notCauseAboveCloseHauled",
						detail: `Rule 18.3 — ${tacker.id} tacked from port to starboard in the zone of ${mark.id}; Rule 18.2 does not apply between her and ${other.id}, who is fetching the mark and has stayed on starboard tack, and ${tacker.id} must not cause ${other.id} to sail above close-hauled to avoid contact.`,
					});
					if (ctx.pair.facts.overlappedGeometric && insideBoatId(ctx.pair.a, ctx.pair.b, mark) === other.id) {
						out.push(giveMarkRoom("18.3", tacker, other, `Rule 18.3 — ${other.id} is overlapped inside ${tacker.id} at ${mark.id}, so ${tacker.id} gives her mark-room.`));
					}
				}
				return out;
			}),
		),
	},
	{
		id: "18.4",
		part: 2,
		section: "C",
		scope: "pair",
		needsRightOfWay: true,
		evaluate: onPair((ctx) =>
			perMark(ctx, (mark) => {
				const {a, b} = ctx.pair;
				if (ctx.world.race.phase === "prestart") return []; // no proper course before the starting signal
				if (mark.kind === "gate" || ctx.rightOfWay == null || !ctx.pair.facts.overlappedGeometric) return [];
				const insideId = insideBoatId(a, b, mark);
				if (insideId === null || insideId !== ctx.rightOfWay) return [];
				const inside = insideId === a.id ? a : b;
				if (!mustGybe(ctx, inside, mark)) return [];
				const outside = otherOf(ctx.pair, insideId);
				return [
					{
						ruleId: "18.4",
						boat: inside.id,
						towards: outside.id,
						kind: "sailNoFartherFromMark",
						detail: `Rule 18.4 — ${inside.id} is the inside right-of-way boat at ${mark.id} and must gybe to sail her proper course, so until she gybes she sails no farther from the mark than needed.`,
					},
				];
			}),
		),
	},
];
