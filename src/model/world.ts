/**
 * World model — the single source of truth for everything on the water.
 *
 * All positions are in WORLD UNITS = hull lengths (1 unit = one boat's actual
 * bow-to-stern hull length). The view layer (`view/scale.ts`) converts world
 * units to screen pixels; the facts and rules layers never see pixels.
 *
 * Frame: +x right, +y DOWN, origin at the top-left of the play area. Headings
 * and wind directions are in degrees, 0 = up (north), increasing clockwise.
 */

/** Geometric + situational state of a single boat. Position is the boat's CENTER. */
export interface BoatState {
	id: string;
	/** Center x position, in hull lengths. */
	x: number;
	/** Center y position, in hull lengths. */
	y: number;
	/** Heading in degrees (0 = up, clockwise positive). */
	heading: number;
	/** Index into `course.legs` of the leg this boat is currently sailing. */
	nextLegIndex: number;
}

/** Wind state. `direction` is where the wind blows FROM, in degrees. */
export interface WindState {
	direction: number;
}

/** A mark of the course. `roundingSide` is the side on which it must be left. */
export interface Mark {
	id: string;
	x: number;
	y: number;
	roundingSide: "port" | "starboard";
	kind: "start" | "windward" | "leeward" | "gate" | "finish";
}

/** An obstruction (circle is enough for now). `radius` is in hull lengths. */
export interface Obstruction {
	id: string;
	x: number;
	y: number;
	radius: number;
}

/** Where the race is in its lifecycle. */
export interface RaceState {
	phase: "prestart" | "started" | "finished";
	/** Timestamp (ms) of the starting signal, if one has been made. */
	startSignalAt?: number;
}

/** The course as an ordered list of legs, each heading for a mark. */
export interface CourseState {
	legs: {toMarkId: string}[];
}

/**
 * A hail: something one boat calls to another (Rule 20). Hails are user actions
 * kept in the world, so rules can read them like any other input.
 * `roomToTack`: `from` hails `to` for room to tack and avoid her (20.1).
 * `youTack`: `from`, the hailed boat, replies "You tack" to `to`, the hailer (20.2).
 */
export interface Hail {
	id: string;
	from: string;
	to: string;
	kind: "roomToTack" | "youTack";
	/** When the hail was made (ms, the clock of the caller); informational. Hails do not expire on their own. */
	at: number;
}

/** Everything the facts and rules layers need to know about the situation. */
export interface WorldState {
	boats: BoatState[];
	wind: WindState;
	marks: Mark[];
	obstructions: Obstruction[];
	race: RaceState;
	course: CourseState;
	/** Hails currently in the air (Rule 20); cleared by the user and on scenario load. */
	hails: Hail[];
}
