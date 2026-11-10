/**
 * Rules-layer types — the vocabulary shared by rule definitions, the evaluator
 * and the UI. Rules consume facts (`factsEngine.ts`) and emit obligations;
 * the evaluator turns obligations into per-boat and per-pair views.
 */

import type {BoatState, WorldState} from "../model/world";
import type {PairFacts, PointOfSail, Tack, WorldFacts} from "./factsEngine";

/** Rule identifier as printed in the RRS: "10", "17.1", later "18.2b". */
export type RuleId = string;

/** What a rule requires of a boat. */
export type ObligationKind = "keepClear" | "giveRoom" | "giveMarkRoom" | "avoidContact" | "notAboveProperCourse" | "notBelowProperCourse";

/** A single duty imposed on `boat` (optionally owed `towards` another boat) by a rule. */
export interface Obligation {
	ruleId: RuleId;
	/** The boat that owes the duty. */
	boat: string;
	/** The boat the duty is owed to, when it is owed to one boat in particular. */
	towards?: string;
	kind: ObligationKind;
	/** Human-readable explanation of why this obligation exists right now. */
	detail: string;
}

/**
 * History the evaluator needs for the time-dependent rules (13, 15, 16, 17.1).
 * Everything is keyed by boat id or pair key; all fields are optional so a
 * stateless evaluation can pass `{}`. `step` builds it from engine memory (`memory.ts`).
 */
export interface EngineHistory {
	/** Pair key → boat id that had right of way last evaluation (`null`: none, absent: unseen). */
	prevRightOfWay?: Record<string, string | null | undefined>;
	/** Boat id → true while the boat is changing course (Rule 16). */
	changingCourse?: Record<string, boolean>;
	/** Pair key → boat id → true when that boat established a leeward overlap from clear astern (Rule 17.1). */
	leewardFromAstern?: Record<string, Record<string, boolean>>;
}

/** The two boats of a pair-scope evaluation. `a` is the boat with the smaller id. */
export interface PairContext {
	key: string;
	a: BoatState;
	b: BoatState;
	facts: PairFacts;
}

/** Everything a rule may look at. `pair` is set for pair-scope rules, `boat` for boat-scope rules. */
export interface EvalContext {
	world: WorldState;
	facts: WorldFacts;
	history: EngineHistory;
	pair?: PairContext;
	boat?: BoatState;
	/**
	 * Boat that owes no keepClear in this pair, once the rules that do not set
	 * `needsRightOfWay` have run and been subject to suspension. `null` when
	 * there is none (or both keep clear). Only set for rules with `needsRightOfWay`.
	 */
	rightOfWay?: string | null;
}

/** An `EvalContext` known to be a pair-scope evaluation. */
export interface PairEvalContext extends EvalContext {
	pair: PairContext;
}

/** A single rule: identity, how it relates to other rules, and its predicate. */
export interface RuleDefinition {
	id: RuleId;
	part: 2;
	section: "A" | "B" | "C" | "D";
	/** Run once per pair of boats, once per boat, once per world, or never (reference only). */
	scope: "pair" | "boat" | "all" | "reference";
	/** Rules that do not apply to a pair while this rule fires for it (Rule 13 → 10, 11, 12). */
	suspends?: RuleId[];
	/** True when `evaluate` reads `ctx.rightOfWay` (limitations on the right-of-way boat). */
	needsRightOfWay?: boolean;
	/** Obligations this rule imposes in the given context; empty when it does not apply. */
	evaluate: (ctx: EvalContext) => Obligation[];

	// Display content — Phase 4 moves these into a separate content file.
	title: string;
	description: string;
	/** The full official text of the rule (2025–2028 RRS). */
	fullText: string;
	/** A plain-English explanation of what the rule means. */
	laymanExplanation: string;
	/** A development note describing a known approximation/constraint in this rule. */
	note?: string;
	/** A shorter version of `note`, shown on the rule card while it is active. */
	noteShort?: string;
}

/** Per-boat rule outcome, ready for the UI to render. */
export interface BoatView {
	id: string;
	/** Port/starboard tack, or null if head-to-wind. */
	tack: Tack | null;
	pointOfSail: PointOfSail;
	/** Boom angle (degrees) off the centreline, 0 = pulled in, ~85 = let right out. */
	sailTrimAngle: number;
	/** True while the boat is tacking (Rule 13). */
	tacking: boolean;
	/** True when this boat owes no keepClear obligation to any boat. */
	standOn: boolean;
	/** All obligations this boat owes. */
	obligations: Obligation[];
	/** Ids of the boats this boat is windward of (same tack, overlapped). */
	windwardOf: string[];
	/** Ids of the boats this boat is leeward of (same tack, overlapped). */
	leewardOf: string[];
}

/** Per-pair rule outcome. `a` is the boat with the smaller id (see `pairKey`). */
export interface PairView {
	key: string;
	a: string;
	b: string;
	/** The boat that owes no keepClear in this pair; null when none, or both owe. */
	rightOfWay: string | null;
	/** The rule behind the keepClear obligation, if any. */
	decidingRuleId: RuleId | null;
	/** Why the deciding rule applies; empty when nobody has to keep clear. */
	reason: string;
	sameTack: boolean;
	/** Overlap status; null when on opposite tacks. */
	overlapped: boolean | null;
	/** True when the boats' hulls overlap — a collision (Rule 14). */
	collided: boolean;
	/** Perimeter-to-perimeter distance between the hulls, in hull lengths; negative when they overlap. */
	separation: number;
	/** Obligations surviving suspension in this pair. */
	obligations: Obligation[];
}

/**
 * The ranked state of a single rule, as shown in the sidebar. `applicable`:
 * the rule fired (after suspension) for any pair or boat. `deciding`: it
 * produced the keepClear obligation in the focus pair.
 */
export interface RuleState {
	id: RuleId;
	title: string;
	/** Static, always-visible short description of the rule. */
	description: string;
	fullText: string;
	laymanExplanation: string;
	applicable: boolean;
	deciding: boolean;
	/** Why the rule applies (empty when it does not). */
	detail: string;
	note?: string;
	noteShort?: string;
}

/** The result of evaluating a world. */
export interface RuleEvaluation {
	/** Every obligation that survived suspension. */
	obligations: Obligation[];
	boats: Record<string, BoatView>;
	/** Keyed by `pairKey`. */
	pairs: Record<string, PairView>;
	/** Pair shown as "the" meeting in the UI (first pair by sorted key by default); null with fewer than two boats. */
	focusPair: string | null;
	/**
	 * All rules, ranked for display: deciding first, then other applicable
	 * rules by id, then non-applicable rules by id.
	 */
	rules: RuleState[];
}
