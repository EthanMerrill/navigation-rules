/**
 * Part 2, Section C — Rule 20 (Room to Tack at an Obstruction). Predicates
 * only; display text lives in `content/rrs-2025.ts`.
 *
 * Hails are user actions held in `world.hails`. The split between the rules:
 * - 20.1 (when a hail is valid) is `hailProblem` in `../hails.ts`; reference-only content.
 * - 20.2 (the response) is the only evaluable rule: it emits the obligations that follow a valid hail.
 * - 20.3 (passing the hail on to an additional boat) is reference-only content.
 *
 * Hails do not expire on their own: they are cleared by the user and on scenario load.
 */

import {hailProblem, replyTo} from "../hails";
import type {RuleDefinition} from "../types";
import {onPair} from "./helpers";

export const HAIL_RULES: RuleDefinition[] = [
	{
		id: "20.2",
		part: 2,
		section: "C",
		scope: "pair",
		evaluate: onPair((ctx) => {
			const {a, b} = ctx.pair;
			return ctx.world.hails.flatMap((hail) => {
				const pairOfHail = (hail.from === a.id && hail.to === b.id) || (hail.from === b.id && hail.to === a.id);
				if (hail.kind !== "roomToTack" || !pairOfHail || hailProblem(ctx.world, ctx.facts, hail.from, hail.to) !== null) return [];
				const {from: hailer, to: hailed} = hail;
				if (replyTo(ctx.world, hail)) {
					return [
						{ruleId: "20.2", boat: hailed, towards: hailer, kind: "giveRoom" as const, detail: `Rule 20.2 — ${hailed} replied "You tack", so she must give ${hailer} room to tack and avoid her.`},
						{ruleId: "20.2", boat: hailer, towards: hailed, kind: "tackAsSoonAsPossible" as const, detail: `Rule 20.2 — ${hailed} replied "You tack", so ${hailer} must tack as soon as possible.`},
					];
				}
				return [{ruleId: "20.2", boat: hailed, towards: hailer, kind: "giveRoom" as const, detail: `Rule 20.2 — ${hailer} hailed ${hailed} for room to tack; ${hailed} must respond: tack as soon as possible, or reply "You tack" and then give ${hailer} room to tack and avoid her.`}];
			});
		}),
	},
];
