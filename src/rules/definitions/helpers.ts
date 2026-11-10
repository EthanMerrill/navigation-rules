/**
 * Helpers shared by the rule definition files: adapters and small lookups that
 * do not belong to any single rule.
 */

import type {BoatState} from "../../model/world";
import type {PointOfSail} from "../factsEngine";
import type {EvalContext, Obligation, PairContext, PairEvalContext} from "../types";

/** Adapt a pair-scope predicate: it only runs when the context carries a pair. */
export function onPair(fn: (ctx: PairEvalContext) => Obligation[]): (ctx: EvalContext) => Obligation[] {
	return (ctx) => (ctx.pair ? fn({...ctx, pair: ctx.pair}) : []);
}

/** Whether a point of sail is a beat to windward (close-hauled or head to wind; an approximation of "on a beat"). */
export function isBeating(point: PointOfSail): boolean {
	return point === "CLOSE_HAULED" || point === "HEAD_TO_WIND";
}

/** The other boat of a pair. */
export function otherOf(pair: PairContext, id: string): BoatState {
	return pair.a.id === id ? pair.b : pair.a;
}
