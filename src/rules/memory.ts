/**
 * Engine memory — what the engine remembers from one frame to the next.
 *
 * The time-dependent rules (13, 15, 16, 17.1) need a little history. It lives
 * here as plain data, threaded through the pure `step` function: `step` takes
 * the previous memory and returns the next one, so nothing is hidden in React
 * refs or module state. Memory is rebuilt every frame from the boats and pairs
 * that currently exist, so removed boats are forgotten automatically.
 */

import type {Tack} from "./factsEngine";

/** What the engine remembers about one boat. */
export interface BoatMemory {
	/** The boat's tack last frame (head-to-wind falls back to the tack before it). */
	prevTack: Tack | null;
	/** The boat's heading last frame, in degrees. */
	prevHeading: number;
	/** True from the moment the boat comes through the wind until she is close-hauled again (Rule 13). */
	tacking: boolean;
	/** Timestamp (ms) at which the current tack began; set only while `tacking`. */
	tackingSince?: number;
}

/** What the engine remembers about one pair of boats. */
export interface PairMemory {
	/** The boat that had right of way last frame (Rule 15); null when none. */
	prevRightOfWay: string | null;
	/** Boat id → latched "established a leeward overlap from clear astern" (Rule 17.1). */
	leewardFromAstern: Record<string, boolean>;
	/** Boat id → whether that boat was clear astern of the other last frame. */
	prevClearAstern: Record<string, boolean>;
}

/** What the engine remembers about one boat's approach to one mark. Populated from Phase 6. */
export interface MarkSlotMemory {
	/** Timestamp (ms) at which the boat entered the mark's zone. */
	zoneEntryAt?: number;
	/** Boat id → whether that boat was overlapped with this one when she entered the zone. */
	overlappedAtZoneEntry?: Record<string, boolean>;
}

/** Everything the engine carries between frames. */
export interface EngineMemory {
	/** Keyed by boat id. */
	boats: Record<string, BoatMemory>;
	/** Keyed by `pairKey`. */
	pairs: Record<string, PairMemory>;
	/** Keyed by `markSlotKey(boatId, markId)`. Empty until mark rules exist. */
	markSlots: Record<string, MarkSlotMemory>;
}

/** Key of a boat×mark slot in `EngineMemory.markSlots`. */
export function markSlotKey(boatId: string, markId: string): string {
	return `${boatId}|${markId}`;
}

/** Memory of an engine that has not seen any frame yet. */
export function createEmptyMemory(): EngineMemory {
	return {boats: {}, pairs: {}, markSlots: {}};
}
