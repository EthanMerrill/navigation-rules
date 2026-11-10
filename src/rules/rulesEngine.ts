/**
 * Rules Engine — Part 2, Sections A (Right of Way) & B (General Limitations) of
 * the Racing Rules of Sailing (2025–2028 edition).
 *
 * This file decides right-of-way between two boats by consuming the geometric +
 * situational "facts" computed by `factsEngine.ts` (the Definitions layer). It
 * contains no React or DOM code, so it is fully unit-testable in isolation.
 *
 * ---------------------------------------------------------------------------
 * Rule outcomes implemented (two-boat meetings only)
 * ---------------------------------------------------------------------------
 * - Rule 10 (On Opposite Tacks): a port-tack boat keeps clear of a starboard
 *   tack boat.
 * - Rule 11 (On the Same Tack, Overlapped): the windward boat keeps clear of
 *   the leeward boat.
 * - Rule 12 (On the Same Tack, Not Overlapped): the boat clear astern keeps
 *   clear of the boat clear ahead.
 * - Rule 13 (While Tacking): after passing head to wind, keep clear until
 *   close-hauled.
 * - Rule 14 (Avoiding Contact): a universal duty on both boats that applies at
 *   all times; it is the rule broken by a collision (hulls overlapping).
 * - Rule 15 (Acquiring Right of Way): limits a boat that just gained right of way.
 * - Rule 16 (Changing Course): limits a right-of-way boat that is turning.
 * - Rule 17 (On the Same Tack; Proper Course): limits a leeward boat that
 *   established its overlap from clear astern (17.1) and a windward boat sailing
 *   below her proper course (17.2).
 */

// The facts/geometry layer (types, tack, point of sail, hull geometry, overlap,
// separation, `computeMeetingFacts`) lives in `factsEngine.ts`. Re-export it so
// existing consumers can keep importing every symbol from this module as before.
export * from "./factsEngine";

import {
	BoatState,
	CONTACT_RISK_DISTANCE,
	computeMeetingFacts,
	getPointOfSail,
	getSailTrimAngle,
	getTack,
	inferProperCourse,
	isSailingAboveProperCourse,
	isSailingBelowProperCourse,
	LIMITATION_RULE_COOLDOWN_MS,
	MeetingFacts,
	PointOfSail,
	PrevTacks,
	Tack,
	TWO_HULL_LENGTHS,
	WindState,
} from "./factsEngine";

// ---------------------------------------------------------------------------
// Types (rule-specific)
// ---------------------------------------------------------------------------

/** The Section A rules implemented by this engine. */
export type RuleNumber = 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17;

/** Whether a rule determines right of way, or limits an existing right of way. */
export type RuleKind = "rightOfWay" | "limitation";

/** Per-boat rule outcome, ready for the UI to render. */
export interface BoatRuleView {
	id: string;
	/** Port/starboard tack, or null if head-to-wind. */
	tack: Tack | null;
	/** True when this boat is windward (only meaningful for Rule 11). */
	windward: boolean | null;
	/** True when this boat is leeward (only meaningful for Rule 11). */
	leeward: boolean | null;
	/** True when this boat has right of way. */
	standOn: boolean;
	/** True when this boat must keep clear. */
	giveWay: boolean;
	/** Point of sail relative to the wind. */
	pointOfSail: PointOfSail;
	/** Boom angle (degrees) off the centreline, 0 = pulled in, ~85 = let right out. */
	sailTrimAngle: number;
}

/**
 * The ranked state of a single rule in the registry, as shown in the sidebar.
 *
 * `applicable` means the rule's preconditions are satisfied in the current
 * configuration. `deciding` means this is the rule that actually determines
 * right-of-way (the highest-priority applicable rule).
 */
export interface RuleState {
	ruleNumber: RuleNumber;
	title: string;
	/** Static, always-visible short description of the rule. */
	description: string;
	/** The full official text of the rule (2025–2028 RRS). */
	fullText: string;
	/** A plain-English explanation of what the rule means. */
	laymanExplanation: string;
	applicable: boolean;
	deciding: boolean;
	/** Explanation of why this rule applies (or not), for applicable rules. */
	detail: string;
	/**
	 * For transient limitation rules (15, 16): how long the rule stays
	 * "cooling down" (in ms) after it fires before it becomes inactive again.
	 * `undefined` means the rule has no cooldown.
	 */
	cooldownMs?: number;
	/**
	 * A development note describing a known approximation/constraint in this rule
	 * (shown in the rule modal).
	 */
	note?: string;
	/** A shorter version of `note`, shown on the rule card while it is active. */
	noteShort?: string;
}

/** The result of evaluating a two-boat meeting. */
export interface RuleEvaluation {
	appliedRule: RuleNumber;
	/** Human-readable explanation of why the deciding rule applies. */
	reason: string;
	/** Same tack (true) vs opposite tacks (false). */
	sameTack: boolean;
	/** Overlap status; null when the boats are on opposite tacks (not applicable). */
	overlapped: boolean | null;
	/** True when the boats' hulls overlap — a collision (Rule 14). */
	collided: boolean;
	/** Per-boat views, in the same order as the boats were passed in. */
	boats: [BoatRuleView, BoatRuleView];
	/**
	 * All rules, ranked for display: the deciding rule first, then other
	 * applicable rules, then non-applicable rules.
	 */
	rules: RuleState[];
}

/**
 * Stateful context passed to the limitation rules (14, 15, 16). It captures the
 * outcome of the deciding right-of-way rule plus transition history.
 */
export interface EvaluationContext {
	/** Whether boat a stands on (true), b stands on (false), or neither (null). */
	standOnIsA: boolean | null;
	/** Who stood on in the previous evaluation (Rule 15). */
	prevStandOnIsA: boolean | null;
	/** Whether boat a is changing course (Rule 16). */
	changingCourseA: boolean;
	/** Whether boat b is changing course (Rule 16). */
	changingCourseB: boolean;
	/** Boat a has established a leeward overlap from clear astern within two hull lengths (Rule 17.1). */
	establishedLeewardA: boolean;
	/** Boat b has established a leeward overlap from clear astern within two hull lengths (Rule 17.1). */
	establishedLeewardB: boolean;
}

/** Optional history/state inputs to `evaluate`. */
export interface EvaluateOptions {
	prevTacks?: PrevTacks;
	prevStandOnIsA?: boolean | null;
	changingCourseA?: boolean;
	changingCourseB?: boolean;
	/** Rule 17.1 transition history (latched in the UI layer). */
	establishedLeewardA?: boolean;
	establishedLeewardB?: boolean;
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

function makeView(boat: BoatState, tack: Tack | null, standOn: boolean, wind: WindState): BoatRuleView {
	return {
		id: boat.id,
		tack,
		windward: null,
		leeward: null,
		standOn,
		giveWay: !standOn,
		pointOfSail: getPointOfSail(boat.heading, wind.direction),
		sailTrimAngle: getSailTrimAngle(boat.heading, wind.direction),
	};
}

// ---------------------------------------------------------------------------
// Rule registry
// ---------------------------------------------------------------------------

/**
 * A single rule in the registry.
 *
 * `applies` reports whether the rule's preconditions are satisfied in the
 * current configuration (independent of any other rule). `decide` determines
 * right-of-way and is only consulted for the deciding rule.
 *
 * `priority` breaks ties when multiple rules are applicable: the highest
 * priority wins and becomes the `deciding` rule.
 */
interface RuleDefinition {
	ruleNumber: RuleNumber;
	kind: RuleKind;
	title: string;
	description: string;
	/** The full official text of the rule (2025–2028 RRS). */
	fullText: string;
	/** A plain-English explanation of what the rule means. */
	laymanExplanation: string;
	/** Priority among right-of-way rules; higher wins. Limitation rules use 0. */
	priority: number;
	applies: (a: BoatState, b: BoatState, wind: WindState, f: MeetingFacts, ctx: EvaluationContext) => boolean;
	/** Only present on right-of-way rules. Determines who stands on. */
	decide?: (
		a: BoatState,
		b: BoatState,
		wind: WindState,
		f: MeetingFacts,
		ctx: EvaluationContext,
	) => {
		/** True → a stands on, false → b stands on, null → neither (both give way). */
		standOnIsA: boolean | null;
		reason: string;
	};
	detail: (a: BoatState, b: BoatState, wind: WindState, f: MeetingFacts, ctx: EvaluationContext) => string;
	/**
	 * For transient limitation rules (15, 16): how long the rule stays
	 * "cooling down" (in ms) after it fires before it becomes inactive again.
	 * Omitted for rules without a cooldown.
	 */
	cooldownMs?: number;
	/** A development note describing a known approximation/constraint in this rule. */
	note?: string;
	/** A shorter version of `note`, shown on the rule card while it is active. */
	noteShort?: string;
}

const RULE_REGISTRY: RuleDefinition[] = [
	{
		ruleNumber: 13,
		kind: "rightOfWay",
		title: "While Tacking",
		description: "After a boat passes head to wind, she must keep clear of other boats until she is on a close-hauled course.",
		fullText:
			"After a boat passes head to wind, she shall keep clear of other boats until she is on a close-hauled course. During that time rules 10, 11 and 12 do not apply. If two boats are subject to this rule at the same time, the one on the other's port side or the one astern shall keep clear.",
		laymanExplanation:
			"A boat that is turning through the wind (changing from one tack to the other) loses its normal rights and must stay out of everyone's way until it has finished the turn and is sailing normally again. While it is turning, the usual port/starboard and windward/leeward rules do not apply to it.",
		priority: 30,
		applies: (a, b) => a.tacking || b.tacking,
		decide: (a, b) => {
			// If both are tacking, both must keep clear (no stand-on boat).
			if (a.tacking && b.tacking) {
				return {
					standOnIsA: null,
					reason: `Rule 13 — Both ${a.id} and ${b.id} are tacking and must keep clear of each other.`,
				};
			}
			const tackingId = a.tacking ? a.id : b.id;
			const otherId = a.tacking ? b.id : a.id;
			return {
				// The tacking boat keeps clear, so the other boat stands on.
				standOnIsA: !a.tacking,
				reason: `Rule 13 — ${tackingId} is tacking and must keep clear of ${otherId}.`,
			};
		},
		detail: (a, b) => {
			if (a.tacking && b.tacking) return `Both ${a.id} and ${b.id} are tacking.`;
			return `${a.tacking ? a.id : b.id} is in the act of tacking.`;
		},
	},
	{
		ruleNumber: 10,
		kind: "rightOfWay",
		title: "On Opposite Tacks",
		description: "A port-tack boat must keep clear of a starboard-tack boat.",
		fullText: "When boats are on opposite tacks, a port-tack boat shall keep clear of a starboard-tack boat.",
		laymanExplanation: "When two boats are on different tacks — one has the wind coming over its left (port) side and the other over its right (starboard) side — the port-tack boat must get out of the way of the starboard-tack boat. Starboard has right of way.",
		priority: 20,
		applies: (_a, _b, _w, f) => !f.sameTack,
		decide: (a, b, wind) => {
			const aTack = getTack(a.heading, wind.direction);
			const standOnIsA = aTack === "STARBOARD";
			const starboardId = standOnIsA ? a.id : b.id;
			const portId = standOnIsA ? b.id : a.id;
			return {
				standOnIsA,
				reason: `Rule 10 — On opposite tacks, ${portId} is on port tack and must keep clear of ${starboardId}, which is on starboard tack.`,
			};
		},
		detail: (a, b, wind) => {
			const aTack = getTack(a.heading, wind.direction);
			const bTack = getTack(b.heading, wind.direction);
			return `Boats are on opposite tacks (${a.id}: ${aTack?.toLowerCase()}, ${b.id}: ${bTack?.toLowerCase()}).`;
		},
	},
	{
		ruleNumber: 11,
		kind: "rightOfWay",
		title: "On the Same Tack, Overlapped",
		description: "The windward boat must keep clear of the leeward boat.",
		fullText: "When boats are on the same tack and overlapped, a windward boat shall keep clear of a leeward boat.",
		laymanExplanation: "When two boats are on the same tack and side-by-side, the boat that is upwind (closer to where the wind is coming from) must stay out of the way of the boat that is downwind (leeward). The leeward boat has right of way.",
		priority: 10,
		applies: (_a, _b, _w, f) => f.sameTack && f.overlapped === true,
		decide: (a, b, _wind, f) => {
			const windwardIsA = f.windwardIsA === true;
			const standOnIsA = !windwardIsA; // leeward stands on
			const windwardId = windwardIsA ? a.id : b.id;
			const leewardId = windwardIsA ? b.id : a.id;
			return {
				standOnIsA,
				reason: `Rule 11 — On the same tack and overlapped, the windward boat (${windwardId}) must keep clear of the leeward boat (${leewardId}).`,
			};
		},
		detail: (a, b, _wind, f) => {
			const windwardId = f.windwardIsA ? a.id : b.id;
			const leewardId = f.windwardIsA ? b.id : a.id;
			return `Boats are on the same tack and overlapped; ${windwardId} is windward, ${leewardId} is leeward.`;
		},
	},
	{
		ruleNumber: 12,
		kind: "rightOfWay",
		title: "On the Same Tack, Not Overlapped",
		description: "The boat clear astern must keep clear of the boat clear ahead.",
		fullText: "When boats are on the same tack and not overlapped, a boat clear astern shall keep clear of a boat clear ahead.",
		laymanExplanation: "When two boats are on the same tack and one is clearly in front of the other (not side-by-side), the boat behind must stay out of the way of the boat in front. The boat ahead has right of way.",
		priority: 10,
		applies: (_a, _b, _w, f) => f.sameTack && f.overlapped === false,
		decide: (a, b, _w, f) => {
			const clearAheadIsA = f.clearAheadIsA === true;
			const standOnIsA = clearAheadIsA;
			const clearAheadId = clearAheadIsA ? a.id : b.id;
			const clearAsternId = clearAheadIsA ? b.id : a.id;
			return {
				standOnIsA,
				reason: `Rule 12 — On the same tack and not overlapped, the boat clear astern (${clearAsternId}) must keep clear of the boat clear ahead (${clearAheadId}).`,
			};
		},
		detail: (a, b, _w, f) => {
			const clearAheadId = f.clearAheadIsA ? a.id : b.id;
			const clearAsternId = f.clearAheadIsA ? b.id : a.id;
			return `Boats are on the same tack and not overlapped; ${clearAsternId} is clear astern of ${clearAheadId}.`;
		},
	},
	{
		ruleNumber: 14,
		kind: "limitation",
		title: "Avoiding Contact",
		description: "A boat shall avoid contact with another boat if reasonably possible.",
		fullText:
			"A boat shall avoid contact with another boat if reasonably possible. However, a right-of-way boat, or one sailing within the room or mark-room to which she is entitled, need not act to avoid contact until it is clear that the other boat is not keeping clear or giving room or mark-room.",
		laymanExplanation: "Both boats must always try not to collide. When they get close together, avoiding contact becomes everyone's responsibility — even the boat with right of way has to act if a crash is about to happen.",
		priority: 0,
		applies: (_a, _b, _w, f) => f.collided || f.separation < CONTACT_RISK_DISTANCE,
		detail: (_a, _b, _w, f) => (f.collided ? `Collision — the hulls overlap by ${Math.round(-f.separation)}px. Both boats must avoid contact.` : `Boats are ${Math.round(f.separation)}px apart — both must act to avoid contact.`),
	},
	{
		ruleNumber: 15,
		kind: "limitation",
		title: "Acquiring Right of Way",
		description: "When a boat acquires right of way, she shall initially give the other boat room to keep clear.",
		fullText: "When a boat acquires right of way, she shall initially give the other boat room to keep clear. She shall not sail to change course to sail a course that would immediately require the other boat to take avoiding action.",
		laymanExplanation: "When you have just gained the right of way, you can't press your advantage straight away — you must first give the other boat enough room to get out of your way.",
		priority: 0,
		applies: (_a, _b, _w, _f, ctx) => ctx.standOnIsA !== null && ctx.prevStandOnIsA !== null && ctx.standOnIsA !== ctx.prevStandOnIsA,
		detail: (a, b, _w, _f, ctx) => {
			const acquirer = ctx.standOnIsA ? a.id : b.id;
			const other = ctx.standOnIsA ? b.id : a.id;
			return `${acquirer} has just acquired right of way from ${other} and must initially give room to keep clear.`;
		},
		cooldownMs: LIMITATION_RULE_COOLDOWN_MS,
	},
	{
		ruleNumber: 16,
		kind: "limitation",
		title: "Changing Course",
		description: "When a right-of-way boat changes course, she shall give the other boat room to keep clear.",
		fullText:
			"When a right-of-way boat changes course, she shall give the other boat room to keep clear. In addition, when after the starting signal a port-tack boat is keeping clear by sailing to pass astern of a starboard-tack boat, the starboard-tack boat shall not change course if as a result the port-tack boat would immediately need to change course to continue keeping clear.",
		laymanExplanation: "Even if you have right of way, you cannot suddenly alter course into the other boat — if you change direction, you must leave them room to stay clear.",
		priority: 0,
		applies: (_a, _b, _w, _f, ctx) => (ctx.standOnIsA === true && ctx.changingCourseA) || (ctx.standOnIsA === false && ctx.changingCourseB),
		detail: (a, b, _w, _f, ctx) => {
			const rowId = ctx.standOnIsA ? a.id : b.id;
			return `${rowId} is the right-of-way boat and is changing course — it must give room to keep clear.`;
		},
		cooldownMs: LIMITATION_RULE_COOLDOWN_MS,
	},
	{
		ruleNumber: 17,
		kind: "limitation",
		title: "On the Same Tack; Proper Course",
		description: "A boat that establishes a leeward overlap from astern must not sail above her proper course; a windward boat must not sail below hers.",
		fullText:
			"17.1 If a boat clear astern becomes overlapped within two of her hull lengths to leeward of a boat on the same tack, she shall not sail above her proper course while they remain on the same tack and overlapped within that distance. 17.2 Except on a beat to windward, while a boat is less than two of her hull lengths from a leeward boat or a boat clear astern that is steering a course to pass to leeward, she shall not sail below her proper course unless she gybes.",
		laymanExplanation:
			"When you sail up from behind and establish an overlap to leeward of another boat, you cannot then turn up toward the wind to push them — you may sail no higher than the course you would sail toward the finish (your proper course). Conversely, a windward boat sailing close below a leeward boat cannot bear away below her proper course (unless she gybes) — she cannot force the leeward boat down the course.",
		priority: 0,
		applies: (a, b, wind, f, ctx) => {
			if (!f.sameTack || f.overlapped !== true) return false;
			if (f.separation >= TWO_HULL_LENGTHS) return false;

			const windwardIsA = f.windwardIsA === true;
			const leeward = windwardIsA ? b : a;
			const windward = windwardIsA ? a : b;
			const leewardProperCourse = inferProperCourse(leeward.heading, wind.direction);
			const windwardProperCourse = inferProperCourse(windward.heading, wind.direction);

			// 17.1 — the leeward boat, having come from clear astern, must not sail above her proper course.
			const leewardCameFromAstern = windwardIsA ? ctx.establishedLeewardB : ctx.establishedLeewardA;
			if (leewardCameFromAstern && isSailingAboveProperCourse(leeward.heading, leewardProperCourse, wind.direction)) {
				return true;
			}

			// 17.2 — the windward boat must not sail below her proper course (except on a beat to windward).
			const windwardPoint = getPointOfSail(windward.heading, wind.direction);
			const onBeatToWindward = windwardPoint === "CLOSE_HAULED" || windwardPoint === "HEAD_TO_WIND";
			if (!onBeatToWindward && isSailingBelowProperCourse(windward.heading, windwardProperCourse, wind.direction)) {
				return true;
			}

			return false;
		},
		detail: (a, b, wind, f, ctx) => {
			const windwardIsA = f.windwardIsA === true;
			const leeward = windwardIsA ? b : a;
			const windward = windwardIsA ? a : b;
			const leewardProperCourse = inferProperCourse(leeward.heading, wind.direction);
			const windwardProperCourse = inferProperCourse(windward.heading, wind.direction);

			const leewardCameFromAstern = windwardIsA ? ctx.establishedLeewardB : ctx.establishedLeewardA;
			if (leewardCameFromAstern && isSailingAboveProperCourse(leeward.heading, leewardProperCourse, wind.direction)) {
				return `Rule 17.1 — ${leeward.id} established a leeward overlap from astern and is sailing above her proper course (${Math.round(leewardProperCourse)}°).`;
			}
			return `Rule 17.2 — ${windward.id} is within two hull lengths of the leeward boat and sailing below her proper course (${Math.round(windwardProperCourse)}°).`;
		},
		note: "A boat's proper course is assumed to be close-hauled on her current tack — the finish is assumed to be upwind. Until a mark/finish is modelled, Rule 17 treats any windward boat sailing below close-hauled as sailing below her proper course.",
		noteShort: "Proper course assumed close-hauled (finish upwind).",
	},
];

/**
 * Evaluate the right-of-way situation between two boats.
 *
 * Right-of-way rules (10–13) decide who stands on; limitation rules (14–16) then
 * co-apply on top of that decision based on transition history.
 *
 * @param a First boat.
 * @param b Second boat.
 * @param wind Wind state.
 * @param options Optional history/state: previous tacks (anti-flicker), the
 *                previous stand-on boat (Rule 15), and changing-course flags (Rule 16).
 */
export function evaluate(a: BoatState, b: BoatState, wind: WindState, options?: EvaluateOptions): RuleEvaluation {
	const {aTack, bTack, facts} = computeMeetingFacts(a, b, wind, options?.prevTacks);

	const emptyCtx: EvaluationContext = {
		standOnIsA: null,
		prevStandOnIsA: options?.prevStandOnIsA ?? null,
		changingCourseA: options?.changingCourseA ?? false,
		changingCourseB: options?.changingCourseB ?? false,
		establishedLeewardA: options?.establishedLeewardA ?? false,
		establishedLeewardB: options?.establishedLeewardB ?? false,
	};

	// Phase 1 — decide right of way among the right-of-way rules (10–13).
	const rightOfWayRules = RULE_REGISTRY.filter((rule) => rule.kind === "rightOfWay");
	const applicableRow = rightOfWayRules.filter((rule) => rule.applies(a, b, wind, facts, emptyCtx));
	const decidingRule = applicableRow.reduce((best, rule) => (rule.priority > best.priority ? rule : best));
	const decision = decidingRule.decide!(a, b, wind, facts, emptyCtx);
	const standOnIsA = decision.standOnIsA;

	// Phase 2 — limitation rules (14–16) co-apply on top of the right-of-way decision.
	const ctx: EvaluationContext = {...emptyCtx, standOnIsA};
	const limitationRules = RULE_REGISTRY.filter((rule) => rule.kind === "limitation" && rule.applies(a, b, wind, facts, ctx));

	// Phase 3 — build ranked list: deciding first, then other applicable, then non-applicable.
	const applicableRules = [decidingRule, ...applicableRow.filter((rule) => rule !== decidingRule), ...limitationRules];
	const othersApplicable = applicableRules.filter((rule) => rule !== decidingRule).sort((x, y) => x.ruleNumber - y.ruleNumber);
	const nonApplicable = RULE_REGISTRY.filter((rule) => !applicableRules.includes(rule)).sort((x, y) => x.ruleNumber - y.ruleNumber);

	const toRuleState = (rule: RuleDefinition, deciding: boolean): RuleState => ({
		ruleNumber: rule.ruleNumber,
		title: rule.title,
		description: rule.description,
		fullText: rule.fullText,
		laymanExplanation: rule.laymanExplanation,
		applicable: true,
		deciding,
		detail: deciding ? decision.reason : rule.detail(a, b, wind, facts, ctx),
		cooldownMs: rule.cooldownMs,
		note: rule.note,
		noteShort: rule.noteShort,
	});

	const toNonApplicableState = (rule: RuleDefinition): RuleState => ({
		ruleNumber: rule.ruleNumber,
		title: rule.title,
		description: rule.description,
		fullText: rule.fullText,
		laymanExplanation: rule.laymanExplanation,
		applicable: false,
		deciding: false,
		detail: "",
		cooldownMs: rule.cooldownMs,
		note: rule.note,
		noteShort: rule.noteShort,
	});

	const rules: RuleState[] = [toRuleState(decidingRule, true), ...othersApplicable.map((rule) => toRuleState(rule, false)), ...nonApplicable.map(toNonApplicableState)];

	// `null` (both tacking) means neither boat stands on → both give way.
	const aStandOn = standOnIsA === true;
	const bStandOn = standOnIsA === false;
	const aView = makeView(a, aTack, aStandOn, wind);
	const bView = makeView(b, bTack, bStandOn, wind);

	// Attach windward/leeward flags when same tack + overlapped (Rule 11 facts).
	if (facts.windwardIsA !== null) {
		const windwardIsA = facts.windwardIsA;
		aView.windward = windwardIsA;
		aView.leeward = !windwardIsA;
		bView.windward = !windwardIsA;
		bView.leeward = windwardIsA;
	}

	return {
		appliedRule: decidingRule.ruleNumber,
		reason: decision.reason,
		sameTack: facts.sameTack,
		overlapped: facts.overlapped,
		collided: facts.collided,
		boats: [aView, bView],
		rules,
	};
}
