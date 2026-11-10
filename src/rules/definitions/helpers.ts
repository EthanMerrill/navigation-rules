/**
 * Helpers shared by the rule definition files: adapters and small lookups that
 * do not belong to any single rule.
 */

import type {BoatState} from "../../model/world";
import type {EvalContext, Obligation, PairContext, PairEvalContext} from "../types";

/** Adapt a pair-scope predicate: it only runs when the context carries a pair. */
export function onPair(fn: (ctx: PairEvalContext) => Obligation[]): (ctx: EvalContext) => Obligation[] {
	return (ctx) => (ctx.pair ? fn({...ctx, pair: ctx.pair}) : []);
}

/** The other boat of a pair. */
export function otherOf(pair: PairContext, id: string): BoatState {
	return pair.a.id === id ? pair.b : pair.a;
}
