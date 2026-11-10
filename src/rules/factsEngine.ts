/**
 * Facts Engine — the "Definitions" layer of the Racing Rules of Sailing
 * (2025–2028 edition), Part 2.
 *
 * This module computes the GEOMETRIC + SITUATIONAL FACTS about the boats in a
 * world (per boat and per pair of boats): tack, point of sail, clear astern / clear ahead, overlap,
 * windward / leeward, and hull separation. It also owns the shared types and
 * geometry helpers those facts depend on. It contains NO rule logic — the rule
 * predicates in `rulesEngine.ts` consume these facts via `computeFacts` (or the
 * temporary two-boat wrapper `computeMeetingFacts`).
 *
 * Both `evaluate` (the rules engine) and the React state hook call the same
 * facts functions, so the two can never drift on "what is the situation?".
 *
 * ---------------------------------------------------------------------------
 * Coordinate & heading conventions (world space)
 * ---------------------------------------------------------------------------
 * - Positions and distances are in WORLD UNITS = hull lengths (1 unit is one
 *   boat's actual bow-to-stern length), origin at the top-left of the play
 *   area. Pixels live only in `view/scale.ts`.
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
 */

import type {BoatState, WindState, WorldState} from "../model/world";
import {computeMarkFacts, computeProperCourse} from "./markFacts";
import type {BoatMarkFacts} from "./markFacts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Windward side of a boat. `null` means the boat is head-to-wind. */
export type Tack = "PORT" | "STARBOARD";

/** A boat's point of sail — its direction relative to the wind. */
export type PointOfSail = "HEAD_TO_WIND" | "CLOSE_HAULED" | "CLOSE_REACH" | "BEAM_REACH" | "BROAD_REACH" | "RUNNING";

export type {BoatState, WindState};

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
	 * hull lengths. Negative when the hulls overlap — see `collided` (Rule 14).
	 */
	separation: number;
	/** True when the hulls overlap (perimeter separation is negative) — a collision. */
	collided: boolean;
}

/** Previous tacks, used to avoid flicker when a boat is head-to-wind. */
export interface PrevTacks {
	a: Tack | null;
	b: Tack | null;
}

/** Facts about a single boat, independent of any other boat. */
export interface BoatFacts {
	/** Current tack; falls back to the previous tack while head-to-wind, else null. */
	tack: Tack | null;
	pointOfSail: PointOfSail;
	/** Boom angle off the centreline, in degrees. */
	sailTrimAngle: number;
	/**
	 * True while the boat is tacking (Rule 13): from coming out of head-to-wind
	 * on the other tack until close-hauled. Needs history, so `computeFacts`
	 * reports false and `step` fills it in from engine memory.
	 */
	tacking: boolean;
	/**
	 * Heading (degrees) of the boat's proper course: the bearing to her next
	 * mark (no higher than close-hauled on her tack), or close-hauled on her
	 * tack when she has no next mark. See `computeProperCourse`.
	 */
	properCourse: number;
}

/**
 * Facts about one pair of boats. `a` and `b` are the two ids in sorted order
 * (see `pairKey`); the `...IsA` fields refer to boat `a`. Same semantics as
 * `MeetingFacts`.
 */
export interface PairFacts extends MeetingFacts {
	a: string;
	b: string;
}

/** All facts about a world: one entry per boat and one per pair of boats. */
export interface WorldFacts {
	boats: Record<string, BoatFacts>;
	/** Keyed by `pairKey(idA, idB)`. */
	pairs: Record<string, PairFacts>;
	/** Keyed by `markSlotKey(boatId, markId)`: one entry per boat per mark. */
	marks: Record<string, BoatMarkFacts>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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
 *
 * UPDATE: marks are now modelled. When a boat has a next mark her proper course
 * comes from `computeProperCourse` (`markFacts.ts`); this function remains the
 * fallback for boats with no next mark, where the upwind assumption still holds.
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
 * The aftermost point is the flat transom of the real hull outline —
 * `HULL_AFTERMOST_OFFSET` (≈0.39 hull lengths) abaft centre, NOT the halfway
 * point of a centred box. `astern` is clear astern when the projection of
 * (astern − ahead) onto ahead's heading is less than −HULL_AFTERMOST_OFFSET.
 */
export function isClearAstern(astern: BoatState, ahead: BoatState): boolean {
	const u = headingVector(ahead.heading);
	const dx = astern.x - ahead.x;
	const dy = astern.y - ahead.y;
	return dot(dx, dy, u.x, u.y) < -HULL_AFTERMOST_OFFSET;
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

/** Centre-to-centre distance between two boats, in hull lengths. */
export function distanceBetween(a: BoatState, b: BoatState): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

// ---------------------------------------------------------------------------
// Hull geometry & perimeter separation (Rule 14)
// ---------------------------------------------------------------------------

/** A point in world coordinates (hull lengths). */
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
 * Build the hull outline in the boat's LOCAL frame, in SVG pixels (offsets from the boat's
 * centre `(x, y)`, before rotation): x = lateral (+ = starboard), y = fore-aft
 * (+ = toward the bow).
 *
 * The rendered image is 80×164 inside a 100×200 wrapper, horizontally centred
 * (10px inset each side) and top-aligned, so (in SVG pixels) a point `(sx, sy)` maps via
 *   lateral = sx − 40       forward = 100 − sy
 * giving a hull ~80px wide and ~161px long (bow tip ≈ 98.5px ahead of centre,
 * transom ≈ 63px astern, so the hull sits slightly forward of centre). The
 * caller scales the result into hull lengths.
 */
function buildHullOutlinePx(): Point[] {
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

const HULL_OUTLINE_PX: Point[] = buildHullOutlinePx();

/** Bow-to-transom length of the SVG hull in its own pixel units (≈161.5). */
const HULL_LENGTH_SVG_PX = Math.max(...HULL_OUTLINE_PX.map((p) => p.y)) - Math.min(...HULL_OUTLINE_PX.map((p) => p.y));

/**
 * The sampled hull outline in the local frame, in WORLD UNITS (hull lengths):
 * the SVG outline scaled once at module load so the hull is exactly 1 long.
 */
const HULL_OUTLINE_LOCAL: Point[] = HULL_OUTLINE_PX.map((p) => ({x: p.x / HULL_LENGTH_SVG_PX, y: p.y / HULL_LENGTH_SVG_PX}));

// Real hull extents, derived from the SVG outline — the single source of truth
// for rule distances (local frame: +y is toward the bow), in hull lengths.
/** Distance from centre to the bow tip (≈0.61). */
export const HULL_FOREMOST_OFFSET = Math.max(...HULL_OUTLINE_LOCAL.map((p) => p.y));

/** Distance from centre to the aftermost point — the flat transom (≈0.39). */
export const HULL_AFTERMOST_OFFSET = -Math.min(...HULL_OUTLINE_LOCAL.map((p) => p.y));

/** Actual bow-to-stern hull length — the world unit, so exactly 1. */
export const HULL_ACTUAL_LENGTH = HULL_FOREMOST_OFFSET + HULL_AFTERMOST_OFFSET;

/** Two hull lengths (Rule 17), exactly 2 world units. */
export const TWO_HULL_LENGTHS = 2 * HULL_ACTUAL_LENGTH;

/**
 * The boat's hull outline, in world coordinates (hull lengths), as a polygon whose
 * vertices follow the actual pointed-bow hull silhouette from
 * `PrototypeBoat.svg` (NOT the 100×200 wrapper bounding box). The local
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
 * depth (in hull lengths) along the axis of least overlap when the polygons overlap,
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
 * in hull lengths — not the centre-to-centre distance.
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
// Transom (abeam) line — visualising the overlap boundary
// ---------------------------------------------------------------------------

/**
 * Which of two boats is "ahead" — the one whose BOW is further forward along
 * their common course. Boats on the same tack point roughly the same way, so
 * "forward" is the average of their two headings (falling back to the first
 * boat's heading when the two headings point in opposite directions and cancel).
 *
 * This drives the transom-line overlay: when the boats overlap, the line is
 * drawn abeam through the AHEAD boat's transom — the exact boundary that
 * separates "clear astern / clear ahead" (Rule 12) from "overlap" (Rule 11).
 */
export function getAheadBoat(a: BoatState, b: BoatState): "a" | "b" {
	const ua = headingVector(a.heading);
	const ub = headingVector(b.heading);
	let rx = ua.x + ub.x;
	let ry = ua.y + ub.y;
	let length = Math.hypot(rx, ry);
	if (length < 1e-9) {
		rx = ua.x;
		ry = ua.y;
		length = 1;
	}
	rx /= length;
	ry /= length;

	const bowA = dot(a.x + ua.x * HULL_FOREMOST_OFFSET, a.y + ua.y * HULL_FOREMOST_OFFSET, rx, ry);
	const bowB = dot(b.x + ub.x * HULL_FOREMOST_OFFSET, b.y + ub.y * HULL_FOREMOST_OFFSET, rx, ry);
	return bowA >= bowB ? "a" : "b";
}

/**
 * The "abeam line" through a boat's aftermost point (the flat transom) — the
 * boundary the Racing Rules use to define Clear Astern / Clear Ahead vs
 * Overlap. The line runs perpendicular to the boat's heading and extends
 * `extent` hull lengths to each side (port and starboard) of the transom.
 *
 * Returns the two endpoints in world coordinates.
 */
export function getTransomLine(boat: BoatState, extent: number): [Point, Point] {
	const fwd = headingVector(boat.heading);
	const abeam = {x: -fwd.y, y: fwd.x}; // toward starboard
	const tx = boat.x - fwd.x * HULL_AFTERMOST_OFFSET;
	const ty = boat.y - fwd.y * HULL_AFTERMOST_OFFSET;
	return [
		{x: tx + abeam.x * extent, y: ty + abeam.y * extent},
		{x: tx - abeam.x * extent, y: ty - abeam.y * extent},
	];
}

// ---------------------------------------------------------------------------
// World facts
// ---------------------------------------------------------------------------

/** Key of a pair of boats: the two ids sorted and joined with "|". */
export function pairKey(idA: string, idB: string): string {
	return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
}

/** Facts about one boat. Falls back to `prevTack` while the boat is head-to-wind. */
function computeBoatFacts(boat: BoatState, world: WorldState, prevTack?: Tack | null): BoatFacts {
	const wind = world.wind;
	const tack = getTack(boat.heading, wind.direction) ?? prevTack ?? null;
	return {
		tack,
		pointOfSail: getPointOfSail(boat.heading, wind.direction),
		sailTrimAngle: getSailTrimAngle(boat.heading, wind.direction),
		tacking: false,
		properCourse: computeProperCourse(boat, world, tack),
	};
}

/** Facts about the meeting of boats `a` and `b`, given their (resolved) tacks. */
function computePairFacts(a: BoatState, b: BoatState, aTack: Tack | null, bTack: Tack | null, wind: WindState): PairFacts {
	const sameTack = areOnSameTack(aTack, bTack);
	const overlapped = sameTack ? isOverlapped(a, b) : null;
	const separation = boatPerimeterDistance(a, b);

	return {
		a: a.id,
		b: b.id,
		sameTack,
		overlapped,
		windwardIsA: sameTack && overlapped ? getWindwardBoat(a, b, wind) === "a" : null,
		clearAheadIsA: sameTack && !overlapped ? isClearAstern(b, a) : null,
		separation,
		collided: separation < 0,
	};
}

/**
 * Compute the shared geometric + situational facts about every boat and every
 * pair of boats in the world — the "Definitions" layer of the Racing Rules
 * (tack, clear astern / clear ahead, overlap, leeward / windward, separation).
 * Rule predicates consume these facts; no rule logic lives here.
 *
 * `prevTacks` (boat id → last known tack) avoids flicker while a boat is
 * head-to-wind. Within each pair, `a` is the boat with the smaller id.
 */
export function computeFacts(world: WorldState, prevTacks?: Record<string, Tack | null>): WorldFacts {
	const boats: Record<string, BoatFacts> = {};
	for (const boat of world.boats) {
		boats[boat.id] = computeBoatFacts(boat, world, prevTacks?.[boat.id]);
	}

	const pairs: Record<string, PairFacts> = {};
	for (let i = 0; i < world.boats.length; i++) {
		for (let j = i + 1; j < world.boats.length; j++) {
			const [a, b] = world.boats[i].id < world.boats[j].id ? [world.boats[i], world.boats[j]] : [world.boats[j], world.boats[i]];
			pairs[pairKey(a.id, b.id)] = computePairFacts(a, b, boats[a.id].tack, boats[b.id].tack, world.wind);
		}
	}

	return {boats, pairs, marks: computeMarkFacts(world)};
}

/**
 * Two-boat convenience wrapper kept for `evaluate` (which stays two-boat until
 * Phase 2). Unlike `computeFacts`, `a` and `b` keep the caller's order.
 */
export function computeMeetingFacts(
	a: BoatState,
	b: BoatState,
	wind: WindState,
	prevTacks?: PrevTacks,
): {aTack: Tack | null; bTack: Tack | null; facts: MeetingFacts} {
	const aTack = getTack(a.heading, wind.direction) ?? prevTacks?.a ?? null;
	const bTack = getTack(b.heading, wind.direction) ?? prevTacks?.b ?? null;
	const {a: _a, b: _b, ...facts} = computePairFacts(a, b, aTack, bTack, wind);
	return {aTack, bTack, facts};
}
