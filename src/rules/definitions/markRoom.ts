/**
 * Helpers shared by the Rule 18 definitions: when Rule 18 applies between two
 * boats at a mark (18.1), and the zone-entry latch that 18.2(b) and 18.2(c) read.
 */

import type {BoatState, Mark} from "../../model/world";
import {isOverlapped} from "../factsEngine";
import type {BoatMarkFacts} from "../markFacts";
import {entitledBoat} from "../markMemory";
import {markSlotKey, pairMarkKey} from "../memory";
import type {PairMarkMemory} from "../memory";
import type {Obligation, PairEvalContext} from "../types";
import {otherOf} from "./helpers";

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
 * APPROXIMATIONS: "on a beat to windward" is "close-hauled or head to wind";
 * the exception for opposite-tack boats when only one of them must tack to
 * sail her proper course, and the exception for a mark that is a continuing
 * obstruction, are not modelled.
 */
export function rule18Applies(ctx: PairEvalContext, mark: Mark): boolean {
	const {a, b, facts: pair} = ctx.pair;
	const fa = markFactsOf(ctx, a, mark);
	const fb = markFactsOf(ctx, b, mark);
	if (!fa.nextMark || !fb.nextMark || fa.requiredSide !== fb.requiredSide) return false;
	if (!fa.inZone && !fb.inZone) return false;

	const ba = ctx.facts.boats[a.id];
	const bb = ctx.facts.boats[b.id];
	const oppositeTacks = !pair.sameTack && ba.tack !== null && bb.tack !== null;
	const beating = (p: string) => p === "CLOSE_HAULED" || p === "HEAD_TO_WIND";
	return !(oppositeTacks && beating(ba.pointOfSail) && beating(bb.pointOfSail));
}

/** The marks Rule 18 applies to between this pair. */
export function marksUnderRule18(ctx: PairEvalContext): Mark[] {
	return ctx.world.marks.filter((mark) => rule18Applies(ctx, mark));
}

/** The pair's zone-entry latch at `mark` (Rule 18.2(b)), who is entitled to mark-room under it, and who owes it. */
export interface EntryLatch {
	latch: PairMarkMemory;
	entitled: BoatState;
	giver: BoatState;
	/** True when the current overlap state differs from the state at zone entry (Rule 18.2(c)). */
	changed: boolean;
}

/** The live zone-entry latch for the pair at `mark`, or null when there is none (or neither boat is entitled under it). */
export function entryLatch(ctx: PairEvalContext, mark: Mark): EntryLatch | null {
	const latch = ctx.history.markEntry?.[pairMarkKey(ctx.pair.key, mark.id)];
	const entitledId = latch ? entitledBoat(latch) : null;
	if (!latch || entitledId === null) return null;
	const entitled = entitledId === ctx.pair.a.id ? ctx.pair.a : ctx.pair.b;
	return {latch, entitled, giver: otherOf(ctx.pair, entitled.id), changed: isOverlapped(ctx.pair.a, ctx.pair.b) !== latch.overlappedAtEntry};
}

/** A `giveMarkRoom` obligation from `giver` to `entitled`. */
export function giveMarkRoom(ruleId: string, giver: BoatState, entitled: BoatState, detail: string): Obligation {
	return {ruleId, boat: giver.id, towards: entitled.id, kind: "giveMarkRoom", detail};
}
