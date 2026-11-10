/**
 * Obstruction memory — the overlap latch that Rule 19.2(c) needs, folded frame
 * by frame by `step`. Pure: takes last frame's memory and this frame's facts.
 */

import type {Obstruction, WorldState} from "../model/world";
import {isOverlapped} from "./factsEngine";
import type {WorldFacts} from "./factsEngine";
import {insideBoatAt} from "./markFacts";
import {obstructionSlotKey} from "./memory";
import type {EngineMemory, ObstructionOverlapMemory} from "./memory";

/** One beam in hull lengths: the room a boat needs to pass between the outside boat and the obstruction. */
export const BEAM_ROOM = 0.48;

/**
 * Whether `obstruction` is one the pair is passing together: at least one of
 * them is approaching it and both would pass it on the same side.
 */
export function passingTogether(facts: WorldFacts, obstruction: Obstruction, aId: string, bId: string): boolean {
	const fa = facts.obstructions[obstructionSlotKey(aId, obstruction.id)];
	const fb = facts.obstructions[obstructionSlotKey(bId, obstruction.id)];
	return (fa.approaching || fb.approaching) && fa.passingSide !== null && fa.passingSide === fb.passingSide;
}

/**
 * Fold one frame into the pair × obstruction overlap latches (Rule 19.2(c)).
 *
 * A latch is taken on the frame an overlap begins (the pair was not overlapped
 * last frame, so there is a last frame) while the pair is passing the obstruction
 * together, and only when the inside boat was clear astern and on the same tack
 * as the outside boat (so she was required to keep clear). It records whether the
 * gap between the outside boat's hull and the obstruction's edge was at least
 * `BEAM_ROOM`. The latch is kept while the boats stay overlapped and is dropped
 * when the overlap ends.
 *
 * @returns Pair key → obstruction id → latch; pairs with no latches map to `{}` or are absent.
 */
export function nextObstructionOverlaps(world: WorldState, facts: WorldFacts, prev: EngineMemory): Record<string, Record<string, ObstructionOverlapMemory>> {
	const result: Record<string, Record<string, ObstructionOverlapMemory>> = {};
	for (const [key, pair] of Object.entries(facts.pairs)) {
		const a = world.boats.find((boat) => boat.id === pair.a);
		const b = world.boats.find((boat) => boat.id === pair.b);
		const before = prev.pairs[key];
		if (!a || !b || !before || !isOverlapped(a, b)) continue;
		const wasOverlapped = !before.prevClearAstern[a.id] && !before.prevClearAstern[b.id];
		const latches: Record<string, ObstructionOverlapMemory> = {};
		for (const obstruction of world.obstructions) {
			const kept = before.obstructionOverlaps?.[obstruction.id];
			if (wasOverlapped) {
				if (kept) latches[obstruction.id] = kept;
				continue;
			}
			if (!pair.sameTack || !passingTogether(facts, obstruction, a.id, b.id)) continue;
			const insideId = insideBoatAt(a, b, obstruction);
			if (insideId === null || !before.prevClearAstern[insideId]) continue;
			const outside = insideId === a.id ? b : a;
			const gap = facts.obstructions[obstructionSlotKey(outside.id, obstruction.id)].distance;
			latches[obstruction.id] = {insideId, roomAtStart: gap >= BEAM_ROOM};
		}
		if (Object.keys(latches).length > 0) result[key] = latches;
	}
	return result;
}
