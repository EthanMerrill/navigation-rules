/**
 * Part 2, Section C (At Marks and Obstructions) — Rule 18 (Mark-Room) of the
 * Racing Rules of Sailing (2025–2028 edition). Predicates only; display text
 * lives in `content/rrs-2025.ts`.
 *
 * - 18.2(a): overlapped, the outside boat gives the inside boat mark-room.
 * - 18.2(b): the situation when the first boat reached the zone decides who gives mark-room; suspends 18.2(a).
 * - 18.2(c): as 18.2(b), once the overlap has changed since zone entry; suspends 18.2(a).
 * - 18.3: a limitation on a boat that tacked in the zone: she must not force a starboard-tack boat above close-hauled and
 *   gives her mark-room if she becomes overlapped inside. It suspends nothing: Rules 10-12 still decide right of way.
 * - 18.4: gybing at a mark; limits the inside right-of-way boat.
 *
 * 18.1 (applicability) is `rule18Applies` in `markRoom.ts`; 18.2(d) (release of the
 * entry latch) is applied in `markMemory.ts`. Both are reference-only content entries.
 */

import type {Mark} from "../../model/world";
import {getWindAngle} from "../factsEngine";
import {insideBoatId} from "../markFacts";
import type {Obligation, PairEvalContext, RuleDefinition} from "../types";
import {onPair, otherOf} from "./helpers";
import {entryLatch, giveMarkRoom, markFactsOf, marksUnderRule18} from "./markRoom";

/** Obligations from `fn` over every mark that Rule 18 applies to between the pair. */
function perMark(ctx: PairEvalContext, fn: (mark: Mark) => Obligation[]): Obligation[] {
	return marksUnderRule18(ctx).flatMap(fn);
}

/** Rule 18.2(b) and 18.2(c) differ only in whether the overlap has changed since zone entry. */
function entryRule(id: "18.2b" | "18.2c"): RuleDefinition {
	return {
		id,
		part: 2,
		section: "C",
		scope: "pair",
		suspends: ["18.2a"],
		evaluate: onPair((ctx) =>
			perMark(ctx, (mark) => {
				const entry = entryLatch(ctx, mark);
				if (!entry || entry.changed !== (id === "18.2c")) return [];
				const {entitled, giver, latch} = entry;
				const why = latch.overlappedAtEntry ? `the boats were overlapped when the first reached the zone of ${mark.id} and ${entitled.id} was inside` : `${entitled.id} was clear ahead when the first boat reached the zone of ${mark.id}`;
				const tail = id === "18.2c" ? " The overlap has since changed, but the duty continues." : "";
				return [giveMarkRoom(id, giver, entitled, `Rule ${id} — ${why}, so ${giver.id} gives ${entitled.id} mark-room.${tail}`)];
			}),
		),
	};
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
				const {a, b} = ctx.pair;
				if (!ctx.pair.facts.overlappedGeometric) return [];
				const insideId = insideBoatId(a, b, mark);
				if (insideId === null) return [];
				const inside = insideId === a.id ? a : b;
				const outside = otherOf(ctx.pair, insideId);
				return [giveMarkRoom("18.2a", outside, inside, `Rule 18.2(a) — ${outside.id} and ${inside.id} are overlapped at ${mark.id}; the outside boat (${outside.id}) gives the inside boat (${inside.id}) mark-room.`)];
			}),
		),
	},
	entryRule("18.2b"),
	entryRule("18.2c"),
	{
		id: "18.3",
		part: 2,
		section: "C",
		scope: "pair",
		evaluate: onPair((ctx) =>
			perMark(ctx, (mark) => {
				if (mark.roundingSide !== "port") return [];
				const out: Obligation[] = [];
				for (const tacker of [ctx.pair.a, ctx.pair.b]) {
					const other = otherOf(ctx.pair, tacker.id);
					const bf = ctx.facts.boats[tacker.id];
					const of = ctx.facts.boats[other.id];
					if (ctx.history.tackedInZone?.[tacker.id] !== mark.id || bf.tack !== "STARBOARD") continue;
					if (!markFactsOf(ctx, tacker, mark).fetching) continue;
					// "On starboard tack since entering the zone": on starboard tack, in the zone, and not herself having tacked there.
					if (of.tack !== "STARBOARD" || !markFactsOf(ctx, other, mark).inZone || ctx.history.tackedInZone?.[other.id] === mark.id) continue;
					out.push({
						ruleId: "18.3",
						boat: tacker.id,
						towards: other.id,
						kind: "notCauseAboveCloseHauled",
						detail: `Rule 18.3 — ${tacker.id} tacked from port to starboard in the zone of ${mark.id} and is fetching it; she must not cause ${other.id}, who has stayed on starboard tack, to sail above close-hauled to avoid contact.`,
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
