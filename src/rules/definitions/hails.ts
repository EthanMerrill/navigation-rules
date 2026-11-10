/**
 * Part 2, Section C — Rule 20 (Room to Tack at an Obstruction). Predicates
 * only; display text lives in `content/rrs-2025.ts`.
 *
 * Hails are user actions held in `world.hails`. The split between the rules:
 * - 20.1 (when a hail is valid) is `hailProblem` in `../hails.ts`, used by the UI to warn that a hail
 *   breaks the rule; reference-only content.
 * - 20.2 (the response) is the only evaluable rule: it emits the obligations that follow a hail between
 *   boats on the same tack, whether or not the hail breaks 20.1 (20.2(b)), and while a hail is active it
 *   suspends 18.2(a) and 18.2(c) between the two boats (20.2(e)).
 * - 20.3 (passing the hail on) and 20.4 (additional requirements for hails) are reference-only content.
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
		suspends: ["18.2a", "18.2c"],
		evaluate: onPair((ctx) => {
			const {a, b} = ctx.pair;
			return ctx.world.hails.flatMap((hail) => {
				const pairOfHail = (hail.from === a.id && hail.to === b.id) || (hail.from === b.id && hail.to === a.id);
				// 20.2(b): a hailed boat responds even if the hail breaks 20.1, so validity is not checked, only that the boats are on the same tack.
				if (hail.kind !== "roomToTack" || !pairOfHail || !ctx.pair.facts.sameTack) return [];
				const {from: hailer, to: hailed} = hail;
				const problem = hailProblem(ctx.world, ctx.facts, hailer, hailed);
				const breaks = problem === null ? "" : ` (the hail breaks rule 20.1: ${problem}, but she must respond anyway)`;
				if (replyTo(ctx.world, hail)) {
					return [
						{ruleId: "20.2", boat: hailed, towards: hailer, kind: "giveRoom" as const, detail: `Rule 20.2 — ${hailed} replied "You tack", so she must give ${hailer} room to tack and avoid her.${breaks}`},
						{ruleId: "20.2", boat: hailer, towards: hailed, kind: "tackAsSoonAsPossible" as const, detail: `Rule 20.2 — ${hailed} replied "You tack", so ${hailer} must tack as soon as possible.`},
					];
				}
				return [{ruleId: "20.2", boat: hailed, towards: hailer, kind: "giveRoom" as const, detail: `Rule 20.2 — ${hailer} hailed ${hailed} for room to tack${breaks}; ${hailed} must respond: tack as soon as possible, or reply "You tack" and then give ${hailer} room to tack and avoid her. Rule 18.2 does not apply between them.`}];
			});
		}),
	},
];
