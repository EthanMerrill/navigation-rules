/**
 * Engine memory — what the engine remembers from one frame to the next.
 *
 * The time-dependent rules (13, 15, 16, 17) need a little history. It lives
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
	/** Id of the mark whose zone she tacked in from port to starboard tack and is still in (Rule 18.3). */
	tackedInZoneOf?: string;
}

/** What the engine remembers about one pair of boats. */
export interface PairMemory {
	/** The boat that had right of way last frame (Rule 15); null when none. */
	prevRightOfWay: string | null;
	/** Boat id → latched "established a leeward overlap from clear astern" (Rule 17). */
	leewardFromAstern: Record<string, boolean>;
	/** Boat id → whether that boat was clear astern of the other last frame. */
	prevClearAstern: Record<string, boolean>;
	/**
	 * Obstruction id → the state of the pair when an overlap between them began
	 * while both were passing that obstruction (Rule 19.2(c)); kept while the
	 * overlap lasts. Absent for an obstruction means no such overlap is latched.
	 */
	obstructionOverlaps: Record<string, ObstructionOverlapMemory>;
}

/** The pair's state at the moment an overlap began at an obstruction (Rule 19.2(c)). */
export interface ObstructionOverlapMemory {
	/** The boat that was clear astern and became overlapped between the other boat and the obstruction. */
	insideId: string;
	/** Whether there was room for her to pass between the outside boat and the obstruction at that moment. */
	roomAtStart: boolean;
}

/** What the engine remembers about one boat's approach to one mark. */
export interface MarkSlotMemory {
	/** Timestamp (ms) at which the boat entered the mark's zone; kept while she stays in it. */
	zoneEntryAt?: number;
}

/**
 * What the engine remembers about one pair of boats at one mark: the state of
 * the pair when the FIRST of them reached the zone (Rule 18.2(b)). Created only
 * for pairs that both have the mark as their next mark.
 */
export interface PairMarkMemory {
	/** Timestamp (ms) at which the first of the two boats reached the zone. */
	firstInZoneAt: number;
	/** Whether the boats were overlapped at that moment. */
	overlappedAtEntry: boolean;
	/** When overlapped at entry: the inside boat (see `insideBoatId`); absent when neither was inside. */
	insideAtEntry?: string;
	/** When not overlapped at entry: the boat that was clear ahead. */
	clearAheadAtEntry?: string;
	/**
	 * True once the boat entitled to mark-room has passed head to wind or left
	 * the zone (Rule 18.2(d)). The slot is kept, so the latch is not simply taken
	 * again next frame, until both boats have left the zone.
	 */
	released?: boolean;
}

/** Everything the engine carries between frames. */
export interface EngineMemory {
	/** Keyed by boat id. */
	boats: Record<string, BoatMemory>;
	/** Keyed by `pairKey`. */
	pairs: Record<string, PairMemory>;
	/** Keyed by `markSlotKey(boatId, markId)`. */
	markSlots: Record<string, MarkSlotMemory>;
	/** Keyed by `pairMarkKey(pairKey, markId)`. */
	pairMarks: Record<string, PairMarkMemory>;
}

/** Key of a boat×mark slot in `EngineMemory.markSlots`. */
export function markSlotKey(boatId: string, markId: string): string {
	return `${boatId}|${markId}`;
}

/** Key of a boat×obstruction entry in `WorldFacts.obstructions`: `boatId|obstructionId`. */
export function obstructionSlotKey(boatId: string, obstructionId: string): string {
	return `${boatId}|${obstructionId}`;
}

/** Key of a pair×mark slot in `EngineMemory.pairMarks`: `pairKey|markId`. */
export function pairMarkKey(pairKey: string, markId: string): string {
	return `${pairKey}|${markId}`;
}

/** Memory of an engine that has not seen any frame yet. */
export function createEmptyMemory(): EngineMemory {
	return {boats: {}, pairs: {}, markSlots: {}, pairMarks: {}};
}
