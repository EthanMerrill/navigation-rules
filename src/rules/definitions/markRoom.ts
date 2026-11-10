/**
 * Helpers shared by the Rule 18 definitions: when Rule 18 applies between two
 * boats at a mark (18.1), the zone-entry latch that 18.2(a) reads, and the tack
 * in the zone that 18.3 uses to suspend 18.2.
 */

import type {BoatState, Mark} from "../../model/world";
import type {BoatMarkFacts} from "../markFacts";
import {entitledBoat} from "../markMemory";
import {markSlotKey, pairMarkKey} from "../memory";
import type {PairMarkMemory} from "../memory";
import type {Obligation, PairEvalContext} from "../types";
import {isBeating, otherOf} from "./helpers";

/** The boat × mark facts of `boat` at `mark`. */
export function markFactsOf(ctx: PairEvalContext, boat: BoatState, mark: Mark): BoatMarkFacts {
	return ctx.facts.marks[markSlotKey(boat.id, mark.id)];
}

/**
 * Rule 18.1: whether Rule 18 applies between the pair at `mark`.
 *
 * It applies when both boats are required to leave the mark on the same side
 * (it is the next mark of both, and a mark has one required side) and at least
 * one of them is in the zone. It does not apply between a boat approaching the
 * mark and one leaving it (that boat's next mark is a later one), nor between
 * boats on opposite tacks that are both on a beat to windward.
 *
 * Section C preamble: Rule 18 does not apply at a starting mark surrounded by
 * navigable water, from the time boats approach it to start until they have
 * left it astern. Every mark of kind "start" is skipped.
 *
 * APPROXIMATIONS: "on a beat to windward" is "close-hauled or head to wind";
 * "until they have left it astern" is not modelled (a start mark is always
 * skipped); 18.1(a)(2) (opposite tacks when the proper course for one but not
 * both is to tack), 18.1(a)(4) (a continuing obstruction) and 18.1(b) (Rule 18
 * ends once mark-room has been given) are not modelled.
 */
export function rule18Applies(ctx: PairEvalContext, mark: Mark): boolean {
	if (mark.kind === "start") return false;
	const {a, b, facts: pair} = ctx.pair;
	const fa = markFactsOf(ctx, a, mark);
	const fb = markFactsOf(ctx, b, mark);
	if (!fa.nextMark || !fb.nextMark || fa.requiredSide !== fb.requiredSide) return false;
	if (!fa.inZone && !fb.inZone) return false;

	const ba = ctx.facts.boats[a.id];
	const bb = ctx.facts.boats[b.id];
	const oppositeTacks = !pair.sameTack && ba.tack !== null && bb.tack !== null;
	return !(oppositeTacks && isBeating(ba.pointOfSail) && isBeating(bb.pointOfSail));
}

/** The marks Rule 18 applies to between this pair. */
export function marksUnderRule18(ctx: PairEvalContext): Mark[] {
	return ctx.world.marks.filter((mark) => rule18Applies(ctx, mark));
}

/** The pair's zone-entry latch at `mark` (Rule 18.2(a)), who is entitled to mark-room under it, and who owes it. */
export interface EntryLatch {
	latch: PairMarkMemory;
	entitled: BoatState;
	giver: BoatState;
	/** True when the current overlap state differs from the state at zone entry (a later overlap change; the duty continues). */
	changed: boolean;
}

/** The live zone-entry latch for the pair at `mark`, or null when there is none (or neither boat is entitled under it). */
export function entryLatch(ctx: PairEvalContext, mark: Mark): EntryLatch | null {
	const latch = ctx.history.markEntry?.[pairMarkKey(ctx.pair.key, mark.id)];
	const entitledId = latch ? entitledBoat(latch) : null;
	if (!latch || entitledId === null) return null;
	const entitled = entitledId === ctx.pair.a.id ? ctx.pair.a : ctx.pair.b;
	return {latch, entitled, giver: otherOf(ctx.pair, entitled.id), changed: ctx.pair.facts.overlappedGeometric !== latch.overlappedAtEntry};
}

/** A `giveMarkRoom` obligation from `giver` to `entitled`. */
export function giveMarkRoom(ruleId: string, giver: BoatState, entitled: BoatState, detail: string): Obligation {
	return {ruleId, boat: giver.id, towards: entitled.id, kind: "giveMarkRoom", detail};
}

/**
 * Rule 18.3, first sentence: the (tacker, other) pairs at `mark` between whom rule
 * 18.2 does not apply. A boat that passed head to wind from port to starboard tack in
 * the zone of a mark to be left to port (`history.tackedInZone`), and another boat on
 * starboard tack that is fetching the mark. Either boat of the pair may be the tacker.
 */
export function tackSuspensions(ctx: PairEvalContext, mark: Mark): {tacker: BoatState; other: BoatState}[] {
	if (mark.roundingSide !== "port") return [];
	const out: {tacker: BoatState; other: BoatState}[] = [];
	for (const tacker of [ctx.pair.a, ctx.pair.b]) {
		const other = otherOf(ctx.pair, tacker.id);
		if (ctx.history.tackedInZone?.[tacker.id] !== mark.id || ctx.facts.boats[tacker.id].tack !== "STARBOARD") continue;
		if (ctx.facts.boats[other.id].tack !== "STARBOARD" || !markFactsOf(ctx, other, mark).fetching) continue;
		out.push({tacker, other});
	}
	return out;
}
