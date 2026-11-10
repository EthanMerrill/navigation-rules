/**
 * Part 2, Section C — Rule 19 (Room to Pass an Obstruction). Predicates only;
 * display text lives in `content/rrs-2025.ts`.
 *
 * - 19.1 (applicability) is `obstructionsUnderRule19` below; reference-only content.
 * - 19.2(a): a right-of-way boat may choose which side to pass; if she changes course
 *   while doing so she gives the other boat room to keep clear. The permission itself is not
 *   modelled; the rule fires when the right-of-way boat changes course while approaching an
 *   obstruction the other boat is also approaching. Needs right of way.
 * - 19.2(b): overlapped, the outside boat gives the inside boat room between her and the obstruction.
 * - 19.2(c): a boat that became overlapped inside from clear astern when there was no room is not
 *   entitled to 19.2(b) room, and while the boats remain overlapped she keeps clear and rules
 *   10 and 11 do not apply; suspends 19.2(b), 10 and 11.
 *
 * Only the circular obstructions of `world.obstructions` are modelled. Marks are never
 * obstructions in this model (they are a separate collection), so the 19.1 exception for
 * an obstruction that is also a mark both boats leave on the same side never arises.
 */

import type {Obstruction} from "../../model/world";
import {insideBoatAt} from "../markFacts";
import {passingTogether} from "../obstructionMemory";
import {obstructionSlotKey} from "../memory";
import type {EvalContext, PairContext, PairEvalContext, RuleDefinition} from "../types";
import {onPair, otherOf} from "./helpers";

/**
 * Rule 19.1: the obstructions Rule 19 applies to between this pair: those at least
 * one of them is approaching and that both would pass on the same side.
 *
 * NOT MODELLED: exception (b), that Rule 19 does not apply when Rule 18 applies between
 * the boats and the obstruction is a continuing one.
 */
export function obstructionsUnderRule19(ctx: PairEvalContext): Obstruction[] {
	return ctx.world.obstructions.filter((o) => passingTogether(ctx.facts, o, ctx.pair.a.id, ctx.pair.b.id));
}

/**
 * Whether the other boat of the pair is an obstruction for `boatId`: a right-of-way
 * boat is an obstruction for a boat required to keep clear of her (RRS definition of Obstruction).
 * Needs `ctx.rightOfWay`, so it is only meaningful in a rule with `needsRightOfWay`.
 *
 * TODO: not used by any rule yet; Rule 19 is modelled only against `world.obstructions`.
 */
export function isObstructionFor(ctx: EvalContext, pair: PairContext, boatId: string): boolean {
	const other = otherOf(pair, boatId);
	return ctx.rightOfWay === other.id;
}

/** The inside and outside boat of an overlapped pair at `obstruction`, or null when not overlapped or equally close. */
function insideOutside(ctx: PairEvalContext, obstruction: Obstruction) {
	const {a, b} = ctx.pair;
	if (!ctx.pair.facts.overlappedGeometric) return null;
	const insideId = insideBoatAt(a, b, obstruction);
	if (insideId === null) return null;
	return {inside: insideId === a.id ? a : b, outside: otherOf(ctx.pair, insideId)};
}

export const OBSTRUCTION_RULES: RuleDefinition[] = [
	{
		id: "19.2a",
		part: 2,
		section: "C",
		scope: "pair",
		needsRightOfWay: true,
		evaluate: onPair((ctx) => {
			const {rightOfWay, history, facts} = ctx;
			if (!rightOfWay || !history.changingCourse?.[rightOfWay]) return [];
			const other = otherOf(ctx.pair, rightOfWay);
			const obstruction = ctx.world.obstructions.find((o) => facts.obstructions[obstructionSlotKey(rightOfWay, o.id)].approaching && facts.obstructions[obstructionSlotKey(other.id, o.id)].approaching);
			if (!obstruction) return [];
			return [
				{
					ruleId: "19.2a",
					boat: rightOfWay,
					towards: other.id,
					kind: "giveRoom",
					detail: `Rule 19.2(a) — ${rightOfWay} has right of way and is changing course while approaching ${obstruction.id}; if she is choosing which side to pass it she must give ${other.id} room to keep clear.`,
				},
			];
		}),
	},
	{
		id: "19.2b",
		part: 2,
		section: "C",
		scope: "pair",
		evaluate: onPair((ctx) =>
			obstructionsUnderRule19(ctx).flatMap((obstruction) => {
				const sides = insideOutside(ctx, obstruction);
				if (!sides) return [];
				const {inside, outside} = sides;
				return [
					{
						ruleId: "19.2b",
						boat: outside.id,
						towards: inside.id,
						kind: "giveRoom" as const,
						detail: `Rule 19.2(b) — ${outside.id} and ${inside.id} are overlapped at ${obstruction.id}; the outside boat (${outside.id}) gives the inside boat (${inside.id}) room between her and the obstruction.`,
					},
				];
			}),
		),
	},
	{
		id: "19.2c",
		part: 2,
		section: "C",
		scope: "pair",
		suspends: ["19.2b", "10", "11"],
		evaluate: onPair((ctx) =>
			obstructionsUnderRule19(ctx).flatMap((obstruction) => {
				const latch = ctx.history.obstructionOverlaps?.[ctx.pair.key]?.[obstruction.id];
				const sides = insideOutside(ctx, obstruction);
				if (!latch || latch.roomAtStart || !sides || sides.inside.id !== latch.insideId) return [];
				const {inside, outside} = sides;
				return [
					{
						ruleId: "19.2c",
						boat: inside.id,
						towards: outside.id,
						// Not entitled to room, and she keeps clear while the overlap lasts: rules 10 and 11 are suspended, so this sets right of way.
						kind: "keepClear" as const,
						detail: `Rule 19.2(c) — ${inside.id} was clear astern and became overlapped inside ${outside.id} at ${obstruction.id} when there was no room to pass between them, so she is not entitled to room under Rule 19.2(b); while they remain overlapped she must keep clear and Rules 10 and 11 do not apply.`,
					},
				];
			}),
		),
	},
];
