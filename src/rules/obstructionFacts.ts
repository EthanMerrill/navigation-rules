/**
 * Obstruction facts — per boat × obstruction geometry for Rule 19.
 *
 * Pure geometry, no rule logic. `computeFacts` calls this and stores the
 * results in `WorldFacts.obstructions` (keyed by `obstructionSlotKey`).
 *
 * Only the circular obstructions of `world.obstructions` are modelled. Marks are
 * never obstructions in this model (they live in `world.marks`), so Rule 19
 * never has to defer to Rule 18 for the same object. A right-of-way boat is
 * also an obstruction for a boat that must keep clear of her (RRS definition);
 * that depends on right of way and is handled in the rule file, not here.
 */

import type {BoatState, WorldState} from "../model/world";
import {headingVector} from "./factsEngine";
import {hullDistanceTo} from "./markFacts";
import {obstructionSlotKey} from "./memory";

/** Distance (hull lengths, edge to edge) within which an obstruction ahead counts as being approached. */
export const APPROACH_DISTANCE = 4;

/** Facts about one boat's relationship to one obstruction. */
export interface BoatObstructionFacts {
	/** Distance from the nearest point of her hull to the obstruction's edge, in hull lengths; negative when they touch. */
	distance: number;
	/** True when the obstruction's centre is ahead of her abeam line and its edge is within `APPROACH_DISTANCE`. */
	approaching: boolean;
	/** The side of her on which the obstruction's centre lies; null when it is dead ahead or astern. */
	passingSide: "port" | "starboard" | null;
}

/** Facts for every boat × obstruction of the world, keyed by `obstructionSlotKey(boatId, obstructionId)`. */
export function computeObstructionFacts(world: WorldState): Record<string, BoatObstructionFacts> {
	const facts: Record<string, BoatObstructionFacts> = {};
	for (const boat of world.boats) {
		for (const obstruction of world.obstructions) {
			facts[obstructionSlotKey(boat.id, obstruction.id)] = factsFor(boat, obstruction);
		}
	}
	return facts;
}

/** Facts for one boat and one obstruction. */
function factsFor(boat: BoatState, obstruction: {x: number; y: number; radius: number}): BoatObstructionFacts {
	const forward = headingVector(boat.heading);
	const dx = obstruction.x - boat.x;
	const dy = obstruction.y - boat.y;
	const along = dx * forward.x + dy * forward.y;
	// Starboard is the heading vector rotated 90 degrees clockwise (y axis points down).
	const lateral = dx * -forward.y + dy * forward.x;
	const distance = hullDistanceTo(boat, obstruction.x, obstruction.y) - obstruction.radius;
	return {
		distance,
		approaching: along > 0 && distance <= APPROACH_DISTANCE,
		passingSide: Math.abs(lateral) < 1e-6 ? null : lateral > 0 ? "starboard" : "port",
	};
}
