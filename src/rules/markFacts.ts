/**
 * Mark facts — per boat × mark geometry for the mark-room rules (Rule 18) and
 * the proper course a boat sails to her next mark (Rule 17).
 *
 * Pure geometry, no rule logic. `computeFacts` calls these and stores the
 * results in `WorldFacts.marks` (keyed by `markSlotKey`) and
 * `BoatFacts.properCourse`.
 */

import type {BoatState, Mark, WorldState} from "../model/world";
import {CLOSE_HAULED_ANGLE, getHullVertices, getWindAngle, headingVector, inferProperCourse} from "./factsEngine";
import type {Tack} from "./factsEngine";
import {markSlotKey} from "./memory";

/** Radius of a mark's zone, in hull lengths (RRS: "the area around a mark within a distance of three hull lengths"). */
export const ZONE_RADIUS = 3;

/** Facts about one boat's relationship to one mark. */
export interface BoatMarkFacts {
	/** True when any part of the hull is within `ZONE_RADIUS` of the mark's centre. */
	inZone: boolean;
	/** Shortest distance from any hull vertex to the mark's centre, in hull lengths. */
	distance: number;
	/** True when she can pass the mark on its required side holding her current heading, without tacking. */
	fetching: boolean;
	/** The side on which the mark must be left (the mark's `roundingSide`). */
	requiredSide: "port" | "starboard";
	/** True when this is the mark of the boat's current leg (`course.legs[nextLegIndex]`). */
	nextMark: boolean;
}

/** The mark a boat is heading for, or undefined once she has finished the course. */
export function nextMarkOf(world: WorldState, boat: BoatState): Mark | undefined {
	const id = world.course.legs[boat.nextLegIndex]?.toMarkId;
	return id === undefined ? undefined : world.marks.find((mark) => mark.id === id);
}

/** Shortest distance from any hull vertex of `boat` to the point (`x`, `y`), in hull lengths. */
function hullDistanceTo(boat: BoatState, x: number, y: number): number {
	return Math.min(...getHullVertices(boat).map((v) => Math.hypot(v.x - x, v.y - y)));
}

/**
 * Whether `boat` is fetching `mark`: holding her current heading she passes the
 * mark on its required side without having to tack.
 *
 * APPROXIMATION: the mark is expressed in the boat's frame (forward and
 * starboard axes). She is fetching when the mark is ahead of her abeam line and
 * lies on the side that makes the required side the side she passes it on: to
 * port of her heading for a mark to be left to port, to starboard for one to be
 * left to starboard. Wind, leeway and the radius needed to round are ignored.
 */
function isFetching(boat: BoatState, mark: Mark): boolean {
	const forward = headingVector(boat.heading);
	const dx = mark.x - boat.x;
	const dy = mark.y - boat.y;
	const along = dx * forward.x + dy * forward.y;
	// Starboard is the heading vector rotated 90 degrees clockwise (y axis points down).
	const lateral = dx * -forward.y + dy * forward.x;
	if (along <= 0) return false;
	return mark.roundingSide === "port" ? lateral < 0 : lateral > 0;
}

/** Facts for every boat × mark of the world, keyed by `markSlotKey(boatId, markId)`. */
export function computeMarkFacts(world: WorldState): Record<string, BoatMarkFacts> {
	const facts: Record<string, BoatMarkFacts> = {};
	for (const boat of world.boats) {
		const next = nextMarkOf(world, boat);
		for (const mark of world.marks) {
			const distance = hullDistanceTo(boat, mark.x, mark.y);
			facts[markSlotKey(boat.id, mark.id)] = {
				inZone: distance <= ZONE_RADIUS,
				distance,
				fetching: isFetching(boat, mark),
				requiredSide: mark.roundingSide,
				nextMark: next?.id === mark.id,
			};
		}
	}
	return facts;
}

/** Compass bearing (degrees, 0 = up, clockwise) from `boat` to `mark`. */
function bearingTo(boat: BoatState, mark: Mark): number {
	const deg = (Math.atan2(mark.x - boat.x, -(mark.y - boat.y)) * 180) / Math.PI;
	return (deg + 360) % 360;
}

/**
 * The boat's proper course (degrees), the course she would sail to finish as
 * soon as possible in the absence of the other boats.
 *
 * With a next mark: the bearing to that mark, unless the mark lies upwind of
 * close-hauled, in which case it is close-hauled on her current tack. Without
 * one: the old assumption that the finish is upwind, i.e. close-hauled on her
 * current tack.
 *
 * APPROXIMATION: straight-line bearing; tide, laylines, and the tacks needed
 * to reach an upwind mark are ignored, and a mark on the other side of the wind
 * from her current tack still yields the direct bearing.
 */
export function computeProperCourse(boat: BoatState, world: WorldState, tack: Tack | null): number {
	const wind = world.wind.direction;
	// The resolved tack keeps a boat that is momentarily head to wind on her previous tack.
	const closeHauled = tack === null ? inferProperCourse(boat.heading, wind) : (wind + (tack === "PORT" ? CLOSE_HAULED_ANGLE : -CLOSE_HAULED_ANGLE) + 360) % 360;
	const mark = nextMarkOf(world, boat);
	if (!mark) return closeHauled;
	const bearing = bearingTo(boat, mark);
	return getWindAngle(bearing, world.wind.direction) < CLOSE_HAULED_ANGLE ? closeHauled : bearing;
}
