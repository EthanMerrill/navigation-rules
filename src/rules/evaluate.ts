/**
 * Evaluator — runs the rule registry over a whole world.
 *
 * Pair-scope rules run on every pair of boats and boat-scope rules on every
 * boat. Within each pair, any fired rule that another fired rule `suspends`
 * (Rule 13 → 10, 11, 12) is dropped, and the surviving obligations are turned
 * into per-boat and per-pair views plus the ranked rule list for the sidebar.
 * Pure: no React, no hidden state; time-dependent inputs arrive as `history`.
 */

import type {BoatState, WorldState} from "../model/world";
import type {WorldFacts} from "./factsEngine";
import {RULE_REGISTRY} from "./registry";
import type {BoatView, EngineHistory, EvalContext, Obligation, PairContext, PairView, RuleDefinition, RuleEvaluation, RuleId, RuleState} from "./types";

/** A rule that fired (produced obligations) for one pair, one boat, or the whole world. */
interface FiredRule {
	rule: RuleDefinition;
	obligations: Obligation[];
	/** Pair key, when the rule fired for a pair. */
	pair?: string;
}

/**
 * Order rule ids numerically by leading number, then sub-number, then suffix,
 * so "17" < "17.1" < "17.2" < "18" < "18.2b".
 */
export function compareRuleIds(x: RuleId, y: RuleId): number {
	const parse = (id: RuleId) => {
		const m = /^(\d+)(?:\.(\d+))?(.*)$/.exec(id);
		return m ? {major: Number(m[1]), minor: m[2] === undefined ? -1 : Number(m[2]), rest: m[3]} : {major: Infinity, minor: -1, rest: id};
	};
	const a = parse(x);
	const b = parse(y);
	if (a.major !== b.major) return a.major - b.major;
	if (a.minor !== b.minor) return a.minor - b.minor;
	return a.rest < b.rest ? -1 : a.rest > b.rest ? 1 : 0;
}

/** Drop every fired rule that another fired rule in the same set suspends. */
function applySuspension(fired: FiredRule[]): FiredRule[] {
	const suspended = new Set(fired.flatMap((f) => f.rule.suspends ?? []));
	return fired.filter((f) => !suspended.has(f.rule.id));
}

/**
 * The boat that owes no keepClear in the pair. Null when nobody keeps clear or
 * both boats do (e.g. both tacking with no tiebreak).
 */
function rightOfWayOf(pair: PairContext, obligations: Obligation[]): string | null {
	const owing = new Set(obligations.filter((o) => o.kind === "keepClear").map((o) => o.boat));
	if (owing.size !== 1) return null;
	return owing.has(pair.a.id) ? pair.b.id : pair.a.id;
}

/** Build the `PairContext` for a pair's facts. */
function pairContext(world: WorldState, facts: WorldFacts, key: string): PairContext {
	const pf = facts.pairs[key];
	const byId = (id: string) => world.boats.find((b) => b.id === id) as BoatState;
	return {key, a: byId(pf.a), b: byId(pf.b), facts: pf};
}

/** Run one pair through the registry: base rules, then right-of-way limitations, then suspension. */
function evaluatePair(rules: RuleDefinition[], base: EvalContext & {pair: PairContext}): FiredRule[] {
	const run = (subset: RuleDefinition[], ctx: EvalContext): FiredRule[] =>
		subset.map((rule) => ({rule, obligations: rule.evaluate(ctx), pair: base.pair.key})).filter((f) => f.obligations.length > 0);

	const first = run(
		rules.filter((r) => !r.needsRightOfWay),
		base,
	);
	const rightOfWay = rightOfWayOf(base.pair, applySuspension(first).flatMap((f) => f.obligations));
	const second = run(
		rules.filter((r) => r.needsRightOfWay),
		{...base, rightOfWay},
	);
	return applySuspension([...first, ...second]);
}

/**
 * Evaluate every rule in `registry` over the world.
 *
 * @param world The world being evaluated.
 * @param facts Facts for the same world (`computeFacts`).
 * @param history Time-dependent inputs (previous right of way, course changes, latches).
 * @param focusPair Pair key shown as "the" meeting in the sidebar; defaults to the first pair by sorted key.
 * @param registry Rule set to run; overridable so tests can register stub rules.
 */
export function evaluate(world: WorldState, facts: WorldFacts, history: EngineHistory = {}, focusPair?: string, registry: RuleDefinition[] = RULE_REGISTRY): RuleEvaluation {
	const pairKeys = Object.keys(facts.pairs).sort();
	const focus = focusPair !== undefined && focusPair in facts.pairs ? focusPair : (pairKeys[0] ?? null);

	const fired: FiredRule[] = [];
	const pairRules = registry.filter((r) => r.scope === "pair");
	for (const key of pairKeys) {
		const pair = pairContext(world, facts, key);
		fired.push(...evaluatePair(pairRules, {world, facts, history, pair}));
	}
	for (const rule of registry.filter((r) => r.scope === "boat")) {
		for (const boat of world.boats) {
			const obligations = rule.evaluate({world, facts, history, boat});
			if (obligations.length > 0) fired.push({rule, obligations});
		}
	}
	for (const rule of registry.filter((r) => r.scope === "all")) {
		const obligations = rule.evaluate({world, facts, history});
		if (obligations.length > 0) fired.push({rule, obligations});
	}

	const obligations = fired.flatMap((f) => f.obligations);

	// Per-pair views.
	const pairs: Record<string, PairView> = {};
	for (const key of pairKeys) {
		const pf = facts.pairs[key];
		const pairObligations = fired.filter((f) => f.pair === key).flatMap((f) => f.obligations);
		const deciding = pairObligations.find((o) => o.kind === "keepClear");
		pairs[key] = {
			key,
			a: pf.a,
			b: pf.b,
			rightOfWay: rightOfWayOf(pairContext(world, facts, key), pairObligations),
			decidingRuleId: deciding?.ruleId ?? null,
			reason: deciding?.detail ?? "",
			sameTack: pf.sameTack,
			overlapped: pf.overlapped,
			collided: pf.collided,
			obligations: pairObligations,
		};
	}

	// Per-boat views.
	const boats: Record<string, BoatView> = {};
	for (const boat of world.boats) {
		const bf = facts.boats[boat.id];
		const owned = obligations.filter((o) => o.boat === boat.id);
		const windwardOf: string[] = [];
		const leewardOf: string[] = [];
		for (const pf of Object.values(facts.pairs)) {
			if (pf.windwardIsA === null || (pf.a !== boat.id && pf.b !== boat.id)) continue;
			const other = pf.a === boat.id ? pf.b : pf.a;
			const isWindward = pf.windwardIsA === (pf.a === boat.id);
			(isWindward ? windwardOf : leewardOf).push(other);
		}
		boats[boat.id] = {
			id: boat.id,
			tack: bf.tack,
			pointOfSail: bf.pointOfSail,
			sailTrimAngle: bf.sailTrimAngle,
			standOn: !owned.some((o) => o.kind === "keepClear"),
			obligations: owned,
			windwardOf,
			leewardOf,
		};
	}

	// Ranked rule list: deciding, then applicable, then the rest (each by rule id).
	const toState = (rule: RuleDefinition): RuleState => {
		const mine = fired.filter((f) => f.rule.id === rule.id);
		const inFocus = mine.filter((f) => f.pair === focus && focus !== null);
		const shown = (inFocus.length > 0 ? inFocus : mine)[0];
		return {
			id: rule.id,
			title: rule.title,
			description: rule.description,
			fullText: rule.fullText,
			laymanExplanation: rule.laymanExplanation,
			applicable: mine.length > 0,
			deciding: inFocus.some((f) => f.obligations.some((o) => o.kind === "keepClear")),
			detail: shown?.obligations[0].detail ?? "",
			cooldownMs: rule.cooldownMs,
			note: rule.note,
			noteShort: rule.noteShort,
		};
	};
	const states = registry.filter((r) => r.scope !== "reference").map(toState);
	const byId = (a: RuleState, b: RuleState) => compareRuleIds(a.id, b.id);
	const rules = [...states.filter((s) => s.deciding).sort(byId), ...states.filter((s) => !s.deciding && s.applicable).sort(byId), ...states.filter((s) => !s.applicable).sort(byId)];

	return {obligations, boats, pairs, focusPair: focus, rules};
}
