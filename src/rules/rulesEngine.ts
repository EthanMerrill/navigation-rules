/**
 * Rules Engine — Part 2, Section A (Right of Way) of the Racing Rules of Sailing
 * (2025–2028 edition).
 *
 * This file is the SINGLE source of truth for rule logic. It contains no React
 * or DOM code, so it is fully unit-testable in isolation.
 *
 * ---------------------------------------------------------------------------
 * Coordinate & heading conventions (screen space)
 * ---------------------------------------------------------------------------
 * - Positions are in pixels, with the origin at the top-left of the play area.
 * - +x points right, +y points DOWN (standard CSS/screen coordinates).
 * - A boat's `heading` (θ) is in DEGREES: 0° points up (north), and angles
 *   increase CLOCKWISE (90° = right/east, 180° = down/south, 270° = left/west).
 *   This matches CSS `rotate(θdeg)`.
 * - Wind direction (W) is the direction the wind blows FROM, in the same frame
 *   (0° = from the north / blowing down the screen).
 *
 * Unit vectors (angles in radians):
 *   heading vector      u(θ) = (sin θ, −cos θ)   // points toward the bow
 *   wind-source vector  w(W) = (sin W, −cos W)   // points UPWIND (toward source)
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
 * - Rule 14 (Avoiding Contact): a universal duty that co-applies when boats are
 *   close.
 * - Rule 15 (Acquiring Right of Way): limits a boat that just gained right of way.
 * - Rule 16 (Changing Course): limits a right-of-way boat that is turning.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Windward side of a boat. `null` means the boat is head-to-wind. */
export type Tack = "PORT" | "STARBOARD";

/** A boat's point of sail — its direction relative to the wind. */
export type PointOfSail =
	| "HEAD_TO_WIND"
	| "CLOSE_HAULED"
	| "CLOSE_REACH"
	| "BEAM_REACH"
	| "BROAD_REACH"
	| "RUNNING";

/** The Section A rules implemented by this engine. */
export type RuleNumber = 10 | 11 | 12 | 13 | 14 | 15 | 16;

/** Whether a rule determines right of way, or limits an existing right of way. */
export type RuleKind = "rightOfWay" | "limitation";

/** Geometric + situational state of a single boat. Position is the boat's CENTER. */
export interface BoatState {
	id: string;
	/** Center x position, in pixels. */
	x: number;
	/** Center y position, in pixels. */
	y: number;
	/** Heading in degrees (0 = up, clockwise positive). */
	heading: number;
	/** True while the boat is in the act of tacking (passed head-to-wind, Rule 13). */
	tacking: boolean;
}

/** Wind state. `direction` is where the wind blows FROM, in degrees. */
export interface WindState {
	direction: number;
}

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

/** Shared geometric facts about a two-boat meeting, used by rule predicates. */
export interface MeetingFacts {
	sameTack: boolean;
	/** Overlap status; null when on opposite tacks. */
	overlapped: boolean | null;
	/** Which boat (a or b) is windward; null unless same tack + overlapped. */
	windwardIsA: boolean | null;
	/** Which boat (a or b) is clear ahead; null unless same tack + not overlapped. */
	clearAheadIsA: boolean | null;
	/** Centre-to-centre distance between the boats, in pixels (Rule 14). */
	separation: number;
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
	/** Per-boat views, in the same order as the boats were passed in. */
	boats: [BoatRuleView, BoatRuleView];
	/**
	 * All rules, ranked for display: the deciding rule first, then other
	 * applicable rules, then non-applicable rules.
	 */
	rules: RuleState[];
}

/** Previous tacks, used to avoid flicker when a boat is head-to-wind. */
export interface PrevTacks {
	a: Tack | null;
	b: Tack | null;
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
}

/** Optional history/state inputs to `evaluate`. */
export interface EvaluateOptions {
	prevTacks?: PrevTacks;
	prevStandOnIsA?: boolean | null;
	changingCourseA?: boolean;
	changingCourseB?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Hull length in pixels (bow-to-stern dimension of the rendered boat). */
export const HULL_LENGTH = 200;

/** Beam (width) in pixels of the rendered boat. */
export const BEAM = 100;

/** Separation below which boats are at risk of contact (Rule 14). */
export const CONTACT_RISK_DISTANCE = 300;

/**
 * A boat whose heading is within this many radians of head-to-wind is treated
 * as head-to-wind (tack = null). ~5°.
 */
const HEAD_TO_WIND_EPSILON = 0.087;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

export function toRadians(degrees: number): number {
	return (degrees * Math.PI) / 180;
}

/** Unit vector pointing in the direction of the bow. */
export function headingVector(heading: number): {x: number; y: number} {
	const r = toRadians(heading);
	return {x: Math.sin(r), y: -Math.cos(r)};
}

/** Unit vector pointing upwind (toward the source of the wind). */
export function windSourceVector(windDirection: number): {x: number; y: number} {
	const r = toRadians(windDirection);
	return {x: Math.sin(r), y: -Math.cos(r)};
}

function dot(ax: number, ay: number, bx: number, by: number): number {
	return ax * bx + ay * by;
}

// ---------------------------------------------------------------------------
// Tack
// ---------------------------------------------------------------------------

/**
 * Determine a boat's tack from its heading and the wind direction.
 *
 * A boat is on starboard tack when her windward side is her starboard side
 * (the wind comes over the starboard side). With `w` = wind-source vector and
 * `s` = starboard-side vector (rotate heading +90° clockwise):
 *
 *   w · s = sin(W)cos(θ) − cos(W)sin(θ) = sin(W − θ)
 *
 *   sin(W − θ) > 0  →  STARBOARD
 *   sin(W − θ) < 0  →  PORT
 *   sin(W − θ) ≈ 0  →  head-to-wind (null)
 *
 * NOTE / FUTURE WORK: this treats tack purely by windward side. The RRS
 * definition of "tack" also accounts for the side the MAINSWIND is carried on
 * when sailing by the lee (or directly downwind), which this simplification
 * intentionally ignores. To support by-the-lee, `getTack` would need the boat's
 * sail/mainsail side as an additional input and the "opposite tack / same tack"
 * comparisons in `evaluate` would need updating accordingly.
 */
export function getTack(heading: number, windDirection: number): Tack | null {
	const s = Math.sin(toRadians(windDirection - heading));
	if (Math.abs(s) < HEAD_TO_WIND_EPSILON) {
		return null;
	}
	return s > 0 ? "STARBOARD" : "PORT";
}

/** Whether two boats are on the same tack (and neither is head-to-wind). */
export function areOnSameTack(a: Tack | null, b: Tack | null): boolean {
	return a !== null && b !== null && a === b;
}

// ---------------------------------------------------------------------------
// Point of sail & sail trim
// ---------------------------------------------------------------------------

/**
 * The angle between a boat's heading and the wind direction, in degrees,
 * normalised to [0, 180]. 0° = pointing straight into the wind (head to wind),
 * 180° = sailing directly downwind (running).
 */
export function getWindAngle(heading: number, windDirection: number): number {
	let d = Math.abs(heading - windDirection) % 360;
	if (d > 180) d = 360 - d;
	return d;
}

/**
 * The boat's point of sail, derived from the angle between its heading and the
 * wind direction.
 */
export function getPointOfSail(heading: number, windDirection: number): PointOfSail {
	const a = getWindAngle(heading, windDirection);
	if (a < 30) return "HEAD_TO_WIND";
	if (a < 55) return "CLOSE_HAULED";
	if (a < 80) return "CLOSE_REACH";
	if (a < 110) return "BEAM_REACH";
	if (a < 150) return "BROAD_REACH";
	return "RUNNING";
}

/**
 * How far the boom is let out (degrees off the centreline) for a given heading
 * and wind. Close hauled → pulled in tight; running → let out ~85°.
 */
export function getSailTrimAngle(heading: number, windDirection: number): number {
	const a = getWindAngle(heading, windDirection);
	if (a <= 45) return (a / 45) * 12;
	if (a <= 90) return 12 + ((a - 45) / 45) * 33;
	return 45 + ((a - 90) / 90) * 40;
}

// ---------------------------------------------------------------------------
// Clear astern / clear ahead / overlap (used by Rules 11 & 12)
// ---------------------------------------------------------------------------

/**
 * True if `astern` is clear astern of `ahead`: `astern` lies behind a line
 * drawn abeam (perpendicular) through the aftermost point of `ahead`'s hull.
 *
 * We approximate the aftermost point as one hull length behind `ahead`'s center
 * along its heading. `astern` is clear astern when the projection of
 * (astern − ahead) onto ahead's heading is less than −HULL_LENGTH.
 */
export function isClearAstern(astern: BoatState, ahead: BoatState): boolean {
	const u = headingVector(ahead.heading);
	const dx = astern.x - ahead.x;
	const dy = astern.y - ahead.y;
	return dot(dx, dy, u.x, u.y) < -HULL_LENGTH;
}

/**
 * Two boats are overlapped when NEITHER is clear astern of the other
 * (RRS definition of "Clear Astern and Clear Ahead; Overlap").
 */
export function isOverlapped(a: BoatState, b: BoatState): boolean {
	return !isClearAstern(a, b) && !isClearAstern(b, a);
}

/**
 * For two same-tack boats, which is windward (the one further upwind).
 * Returns 'a' or 'b'.
 */
export function getWindwardBoat(a: BoatState, b: BoatState, wind: WindState): "a" | "b" {
	const w = windSourceVector(wind.direction);
	const aUpwind = dot(a.x, a.y, w.x, w.y);
	const bUpwind = dot(b.x, b.y, w.x, w.y);
	return aUpwind > bUpwind ? "a" : "b";
}

/** Centre-to-centre distance between two boats, in pixels. */
export function distanceBetween(a: BoatState, b: BoatState): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
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
		laymanExplanation:
			"Both boats must always try not to collide. When they get close together, avoiding contact becomes everyone's responsibility — even the boat with right of way has to act if a crash is about to happen.",
		priority: 0,
		applies: (_a, _b, _w, f) => f.separation < CONTACT_RISK_DISTANCE,
		detail: (_a, _b, _w, f) => `Boats are ${Math.round(f.separation)}px apart — both must act to avoid contact.`,
	},
	{
		ruleNumber: 15,
		kind: "limitation",
		title: "Acquiring Right of Way",
		description: "When a boat acquires right of way, she shall initially give the other boat room to keep clear.",
		fullText:
			"When a boat acquires right of way, she shall initially give the other boat room to keep clear. She shall not sail to change course to sail a course that would immediately require the other boat to take avoiding action.",
		laymanExplanation:
			"When you have just gained the right of way, you can't press your advantage straight away — you must first give the other boat enough room to get out of your way.",
		priority: 0,
		applies: (_a, _b, _w, _f, ctx) =>
			ctx.standOnIsA !== null && ctx.prevStandOnIsA !== null && ctx.standOnIsA !== ctx.prevStandOnIsA,
		detail: (a, b, _w, _f, ctx) => {
			const acquirer = ctx.standOnIsA ? a.id : b.id;
			const other = ctx.standOnIsA ? b.id : a.id;
			return `${acquirer} has just acquired right of way from ${other} and must initially give room to keep clear.`;
		},
	},
	{
		ruleNumber: 16,
		kind: "limitation",
		title: "Changing Course",
		description: "When a right-of-way boat changes course, she shall give the other boat room to keep clear.",
		fullText:
			"When a right-of-way boat changes course, she shall give the other boat room to keep clear. In addition, when after the starting signal a port-tack boat is keeping clear by sailing to pass astern of a starboard-tack boat, the starboard-tack boat shall not change course if as a result the port-tack boat would immediately need to change course to continue keeping clear.",
		laymanExplanation:
			"Even if you have right of way, you cannot suddenly alter course into the other boat — if you change direction, you must leave them room to stay clear.",
		priority: 0,
		applies: (_a, _b, _w, _f, ctx) =>
			(ctx.standOnIsA === true && ctx.changingCourseA) || (ctx.standOnIsA === false && ctx.changingCourseB),
		detail: (a, b, _w, _f, ctx) => {
			const rowId = ctx.standOnIsA ? a.id : b.id;
			return `${rowId} is the right-of-way boat and is changing course — it must give room to keep clear.`;
		},
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
	const aTack = getTack(a.heading, wind.direction) ?? options?.prevTacks?.a ?? null;
	const bTack = getTack(b.heading, wind.direction) ?? options?.prevTacks?.b ?? null;

	const sameTack = areOnSameTack(aTack, bTack);
	const overlapped = sameTack ? isOverlapped(a, b) : null;

	const facts: MeetingFacts = {
		sameTack,
		overlapped,
		windwardIsA: sameTack && overlapped ? getWindwardBoat(a, b, wind) === "a" : null,
		clearAheadIsA: sameTack && !overlapped ? isClearAstern(b, a) : null,
		separation: distanceBetween(a, b),
	};

	const emptyCtx: EvaluationContext = {
		standOnIsA: null,
		prevStandOnIsA: options?.prevStandOnIsA ?? null,
		changingCourseA: options?.changingCourseA ?? false,
		changingCourseB: options?.changingCourseB ?? false,
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
		sameTack,
		overlapped,
		boats: [aView, bView],
		rules,
	};
}
