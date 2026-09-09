/**
 * Rules Engine — Part 2, Sections A (Right of Way) & B (General Limitations) of
 * the Racing Rules of Sailing (2025–2028 edition).
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
 * - Rule 14 (Avoiding Contact): a universal duty on both boats that applies at
 *   all times; it is the rule broken by a collision (hulls overlapping).
 * - Rule 15 (Acquiring Right of Way): limits a boat that just gained right of way.
 * - Rule 16 (Changing Course): limits a right-of-way boat that is turning.
 * - Rule 17 (On the Same Tack; Proper Course): limits a leeward boat that
 *   established its overlap from clear astern (17.1) and a windward boat sailing
 *   below her proper course (17.2).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Windward side of a boat. `null` means the boat is head-to-wind. */
export type Tack = "PORT" | "STARBOARD";

/** A boat's point of sail — its direction relative to the wind. */
export type PointOfSail = "HEAD_TO_WIND" | "CLOSE_HAULED" | "CLOSE_REACH" | "BEAM_REACH" | "BROAD_REACH" | "RUNNING";

/** The Section A rules implemented by this engine. */
export type RuleNumber = 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17;

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
	/**
	 * Shortest distance between the two boats' hull perimeters (outer edges), in
	 * pixels. Negative when the hulls overlap — see `collided` (Rule 14).
	 */
	separation: number;
	/** True when the hulls overlap (perimeter separation is negative) — a collision. */
	collided: boolean;
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
// Constants
// ---------------------------------------------------------------------------

/** Hull length in pixels (bow-to-stern dimension of the rendered boat). */
export const HULL_LENGTH = 200;

/** Beam (width) in pixels of the rendered boat. */
export const BEAM = 100;

/** Separation below which boats are at risk of contact (Rule 14). */
export const CONTACT_RISK_DISTANCE = 300;

/** How long a transient limitation rule (15, 16) stays applied after it fires. */
export const LIMITATION_RULE_COOLDOWN_MS = 10000;

/** Two hull lengths (centre-to-centre, a simplification) — Rule 17. */
export const TWO_HULL_LENGTHS = 2 * HULL_LENGTH;

/**
 * The closest angle a boat can point to the wind while sailing (a simplification
 * of the "close-hauled" point of sail). Used to infer a boat's proper course
 * (Rule 17) when no mark/finish is modelled — see `inferProperCourse`.
 */
export const CLOSE_HAULED_ANGLE = 45;

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

/**
 * Infer a boat's proper course (Rule 17) from the wind direction and the boat's
 * heading.
 *
 * A boat's true proper course is the course she would sail to finish as soon as
 * possible — which depends on the location of the next mark, something this
 * simulator does not model. We therefore adopt the most common racing
 * assumption: the finish lies UPWIND, so a boat's proper course is to sail as
 * close to the wind as she can — close-hauled on her current tack. The wind sets
 * the angle (CLOSE_HAULED_ANGLE off the wind); the boat's heading determines
 * which side of the wind she is on (her tack).
 *
 * NOTE / FUTURE WORK (constraint): because proper course is always
 * "close-hauled", Rule 17.2 applies to ANY same-tack, overlapped windward boat
 * within two hull lengths that is sailing below close-hauled — i.e. on any point
 * of sail other than a beat to windward. This makes Rule 17.2 effectively
 * "always on" in common configurations (e.g. the default app state has both
 * boats on a beam reach). To resolve this we need to model a mark/finish
 * location and derive proper course from it, instead of assuming upwind. Revisit
 * before treating Rule 17.2 as production-correct.
 */
export function inferProperCourse(heading: number, windDirection: number): number {
	const tack = getTack(heading, windDirection);
	if (tack === "PORT") return (windDirection + CLOSE_HAULED_ANGLE) % 360;
	// STARBOARD, or head-to-wind (no tack yet — default to starboard, deterministic).
	return (windDirection - CLOSE_HAULED_ANGLE + 360) % 360;
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

/**
 * Degrees of wind-angle tolerance for the "above/below proper course" checks
 * (Rule 17), so tiny heading jitter does not flicker the rule on/off.
 */
const PROPER_COURSE_EPSILON = 1;

/**
 * Whether `heading` points more upwind than `properCourse` (Rule 17.1 — sailing
 * "above" proper course). The comparison is only meaningful when both courses are
 * on the same tack; Rule 17 only calls this within a same-tack overlap.
 */
export function isSailingAboveProperCourse(heading: number, properCourse: number, windDirection: number): boolean {
	return getWindAngle(heading, windDirection) < getWindAngle(properCourse, windDirection) - PROPER_COURSE_EPSILON;
}

/**
 * Whether `heading` points more downwind than `properCourse` (Rule 17.2 — sailing
 * "below" proper course).
 */
export function isSailingBelowProperCourse(heading: number, properCourse: number, windDirection: number): boolean {
	return getWindAngle(heading, windDirection) > getWindAngle(properCourse, windDirection) + PROPER_COURSE_EPSILON;
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
// Hull geometry & perimeter separation (Rule 14)
// ---------------------------------------------------------------------------

/** A point in screen coordinates. */
export type Point = {x: number; y: number};

/** A cubic Bézier segment: two control points and the end point, in SVG coords. */
type CubicSegment = {c1: Point; c2: Point; end: Point};

/**
 * The hull outline from `PrototypeBoat.svg` (viewBox `0 0 80 164`), in SVG
 * coordinates. The path is a closed loop: a pointed bow tip at the top, down
 * the starboard side through the widest point to the transom at y = 163, across
 * the flat stern, then back up the port side to the bow tip.
 */
const HULL_SVG_OUTLINE: {bow: Point; transomPort: Point; starboard: CubicSegment[]; port: CubicSegment[]} = {
	bow: {x: 39.4968, y: 1.45154},
	transomPort: {x: 3.26864, y: 163},
	starboard: [
		{c1: {x: 39.6527, y: 1.70844}, c2: {x: 39.85, y: 2.03579}, end: {x: 40.0854, y: 2.43077}},
		{c1: {x: 40.737, y: 3.52423}, c2: {x: 41.6808, y: 5.13596}, end: {x: 42.8476, y: 7.20642}},
		{c1: {x: 45.1813, y: 11.3475}, c2: {x: 48.407, y: 17.3228}, end: {x: 51.9722, y: 24.6561}},
		{c1: {x: 59.1039, y: 39.3252}, c2: {x: 67.5887, y: 59.4163}, end: {x: 73.0149, y: 81.1213}},
		{c1: {x: 78.438, y: 102.814}, c2: {x: 79.3118, y: 123.39}, end: {x: 78.8284, y: 138.547}},
		{c1: {x: 78.5867, y: 146.124}, c2: {x: 78.006, y: 152.343}, end: {x: 77.486, y: 156.667}},
		{c1: {x: 77.226, y: 158.829}, c2: {x: 76.9812, y: 160.516}, end: {x: 76.8017, y: 161.662}},
		{c1: {x: 76.7119, y: 162.235}, c2: {x: 76.6384, y: 162.672}, end: {x: 76.5875, y: 162.966}},
		{c1: {x: 76.5855, y: 162.978}, c2: {x: 76.5835, y: 162.989}, end: {x: 76.5816, y: 163}},
	],
	port: [
		{c1: {x: 3.26716, y: 162.991}, c2: {x: 3.26565, y: 162.981}, end: {x: 3.26412, y: 162.972}},
		{c1: {x: 3.21681, y: 162.678}, c2: {x: 3.14855, y: 162.24}, end: {x: 3.0651, y: 161.667}},
		{c1: {x: 2.89821, y: 160.521}, c2: {x: 2.67061, y: 158.833}, end: {x: 2.42853, y: 156.671}},
		{c1: {x: 1.94436, y: 152.347}, c2: {x: 1.40237, y: 146.126}, end: {x: 1.17222, y: 138.547}},
		{c1: {x: 0.711858, y: 123.388}, c2: {x: 1.49961, y: 102.808}, end: {x: 6.48729, y: 81.112}},
		{c1: {x: 11.4759, y: 59.4113}, c2: {x: 19.8345, y: 39.3234}, end: {x: 26.9499, y: 24.6557}},
		{c1: {x: 30.5069, y: 17.3233}, c2: {x: 33.7516, y: 11.3486}, end: {x: 36.1065, y: 7.20813}},
		{c1: {x: 37.2839, y: 5.13794}, c2: {x: 38.2387, y: 3.52646}, end: {x: 38.8987, y: 2.43323}},
		{c1: {x: 39.138, y: 2.03695}, c2: {x: 39.3385, y: 1.70877}, end: {x: 39.4968, y: 1.45154}},
	],
};

/** Evaluate a cubic Bézier at parameter `t`. */
function cubicPoint(p0: Point, seg: CubicSegment, t: number): Point {
	const mt = 1 - t;
	const a = mt * mt * mt;
	const b = 3 * mt * mt * t;
	const c = 3 * mt * t * t;
	const d = t * t * t;
	return {
		x: a * p0.x + b * seg.c1.x + c * seg.c2.x + d * seg.end.x,
		y: a * p0.y + b * seg.c1.y + c * seg.c2.y + d * seg.end.y,
	};
}

/**
 * Build the hull outline in the boat's LOCAL frame (offsets from the boat's
 * centre `(x, y)`, before rotation): x = lateral (+ = starboard), y = fore-aft
 * (+ = toward the bow).
 *
 * The rendered image is 80×164 inside a 100×200 wrapper, horizontally centred
 * (10px inset each side) and top-aligned, so an SVG point `(sx, sy)` maps via
 *   lateral = sx − 40       forward = 100 − sy
 * giving a hull ~80px wide and ~161px long (bow tip ≈ 98.5px ahead of centre,
 * transom ≈ 63px astern, so the hull sits slightly forward of centre).
 */
function buildHullOutlineLocal(): Point[] {
	const toLocal = (sx: number, sy: number): Point => ({x: sx - 40, y: 100 - sy});
	const samplesPerSegment = 3;
	const points: Point[] = [toLocal(HULL_SVG_OUTLINE.bow.x, HULL_SVG_OUTLINE.bow.y)];

	// Starboard side, bow → stern.
	let cursor = HULL_SVG_OUTLINE.bow;
	for (const seg of HULL_SVG_OUTLINE.starboard) {
		for (let j = 1; j <= samplesPerSegment; j++) {
			const p = cubicPoint(cursor, seg, j / samplesPerSegment);
			points.push(toLocal(p.x, p.y));
		}
		cursor = seg.end;
	}

	// Transom: a straight edge across the stern to the port side.
	points.push(toLocal(HULL_SVG_OUTLINE.transomPort.x, HULL_SVG_OUTLINE.transomPort.y));
	cursor = HULL_SVG_OUTLINE.transomPort;

	// Port side, stern → bow (closes back at the bow tip, trimmed below).
	for (const seg of HULL_SVG_OUTLINE.port) {
		for (let j = 1; j <= samplesPerSegment; j++) {
			const p = cubicPoint(cursor, seg, j / samplesPerSegment);
			points.push(toLocal(p.x, p.y));
		}
		cursor = seg.end;
	}

	// The final port sample is the bow tip again — drop it so the polygon is a
	// closed loop without a duplicated vertex.
	points.pop();
	return points;
}

/** The sampled hull outline in the local frame, computed once at module load. */
const HULL_OUTLINE_LOCAL: Point[] = buildHullOutlineLocal();

/**
 * The boat's hull outline, in world (screen) coordinates, as a polygon whose
 * vertices follow the actual pointed-bow hull silhouette from
 * `PrototypeBoat.svg` (NOT the `BEAM × HULL_LENGTH` bounding box). The local
 * outline is placed at the boat's centre and rotated by its heading.
 */
export function getHullVertices(boat: BoatState): Point[] {
	const fwd = headingVector(boat.heading); // along the centreline, toward the bow
	const lateral = {x: -fwd.y, y: fwd.x}; // perpendicular, toward starboard
	return HULL_OUTLINE_LOCAL.map((p) => ({
		x: boat.x + lateral.x * p.x + fwd.x * p.y,
		y: boat.y + lateral.y * p.x + fwd.y * p.y,
	}));
}

function clamp(value: number, min: number, max: number): number {
	return value < min ? min : value > max ? max : value;
}

/** Squared distance between two line segments (Ericson, "Real-Time Collision Detection"). */
function segmentSegmentDistanceSq(a1: Point, a2: Point, b1: Point, b2: Point): number {
	const d1x = a2.x - a1.x;
	const d1y = a2.y - a1.y;
	const d2x = b2.x - b1.x;
	const d2y = b2.y - b1.y;
	const rx = a1.x - b1.x;
	const ry = a1.y - b1.y;

	const a = d1x * d1x + d1y * d1y;
	const e = d2x * d2x + d2y * d2y;
	const f = d2x * rx + d2y * ry;

	const EPS = 1e-9;
	let s = 0;
	let t = 0;

	if (a <= EPS && e <= EPS) {
		return rx * rx + ry * ry;
	}

	if (a <= EPS) {
		t = clamp(f / e, 0, 1);
	} else {
		const c = d1x * rx + d1y * ry;
		if (e <= EPS) {
			t = 0;
			s = clamp(-c / a, 0, 1);
		} else {
			const b = d1x * d2x + d1y * d2y;
			const denom = a * e - b * b;
			if (denom !== 0) {
				s = clamp((b * f - c * e) / denom, 0, 1);
			} else {
				s = 0;
			}
			t = (b * s + f) / e;
			if (t < 0) {
				t = 0;
				s = clamp(-c / a, 0, 1);
			} else if (t > 1) {
				t = 1;
				s = clamp((b - c) / a, 0, 1);
			}
		}
	}

	const cx = a1.x + d1x * s - (b1.x + d2x * t);
	const cy = a1.y + d1y * s - (b1.y + d2y * t);
	return cx * cx + cy * cy;
}

function projectOntoAxis(vertices: Point[], axisX: number, axisY: number): {min: number; max: number} {
	let min = Infinity;
	let max = -Infinity;
	for (const v of vertices) {
		const proj = v.x * axisX + v.y * axisY;
		if (proj < min) min = proj;
		if (proj > max) max = proj;
	}
	return {min, max};
}

/**
 * Separating-Axis overlap test for two convex polygons. Returns the penetration
 * depth (in pixels) along the axis of least overlap when the polygons overlap,
 * or `null` when they are disjoint.
 */
function polygonPenetrationDepth(a: Point[], b: Point[]): number | null {
	const axes: Point[] = [];
	for (const poly of [a, b]) {
		for (let i = 0; i < poly.length; i++) {
			const j = (i + 1) % poly.length;
			const ex = poly[j].x - poly[i].x;
			const ey = poly[j].y - poly[i].y;
			axes.push({x: ey, y: -ex}); // an edge normal
		}
	}

	let minOverlap = Infinity;
	for (const axis of axes) {
		const len = Math.hypot(axis.x, axis.y);
		if (len === 0) continue;
		const nx = axis.x / len;
		const ny = axis.y / len;
		const pa = projectOntoAxis(a, nx, ny);
		const pb = projectOntoAxis(b, nx, ny);
		const overlap = Math.min(pa.max, pb.max) - Math.max(pa.min, pb.min);
		if (overlap <= 0) return null; // a separating axis exists → disjoint
		if (overlap < minOverlap) minOverlap = overlap;
	}
	return minOverlap;
}

/**
 * The shortest distance between the two boats' hull PERIMETERS (outer edges),
 * in pixels — not the centre-to-centre distance.
 *
 * When the hulls are disjoint this is the gap between their closest points.
 * When the hulls overlap, the value is NEGATIVE: its magnitude is the
 * penetration depth (the farthest one hull reaches into the other), signalling
 * a collision for Rule 14.
 */
export function boatPerimeterDistance(a: BoatState, b: BoatState): number {
	const va = getHullVertices(a);
	const vb = getHullVertices(b);

	const depth = polygonPenetrationDepth(va, vb);
	if (depth !== null) return -depth;

	let minSq = Infinity;
	for (let i = 0; i < va.length; i++) {
		const a1 = va[i];
		const a2 = va[(i + 1) % va.length];
		for (let j = 0; j < vb.length; j++) {
			const b1 = vb[j];
			const b2 = vb[(j + 1) % vb.length];
			const dSq = segmentSegmentDistanceSq(a1, a2, b1, b2);
			if (dSq < minSq) minSq = dSq;
		}
	}
	return Math.sqrt(minSq);
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
	const aTack = getTack(a.heading, wind.direction) ?? options?.prevTacks?.a ?? null;
	const bTack = getTack(b.heading, wind.direction) ?? options?.prevTacks?.b ?? null;

	const sameTack = areOnSameTack(aTack, bTack);
	const overlapped = sameTack ? isOverlapped(a, b) : null;

	const separation = boatPerimeterDistance(a, b);
	const facts: MeetingFacts = {
		sameTack,
		overlapped,
		windwardIsA: sameTack && overlapped ? getWindwardBoat(a, b, wind) === "a" : null,
		clearAheadIsA: sameTack && !overlapped ? isClearAstern(b, a) : null,
		separation,
		collided: separation < 0,
	};

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
		sameTack,
		overlapped,
		collided: facts.collided,
		boats: [aView, bView],
		rules,
	};
}
