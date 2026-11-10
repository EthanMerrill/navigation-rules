/**
 * Mark memory — the zone-entry latches that Rule 18 needs, folded frame by
 * frame by `step`. Pure: takes last frame's memory and this frame's facts.
 */

import type {WorldState} from "../model/world";
import {isClearAstern, isOverlapped} from "./factsEngine";
import type {WorldFacts} from "./factsEngine";
import {insideBoatId} from "./markFacts";
import {markSlotKey, pairMarkKey} from "./memory";
import type {EngineMemory, MarkSlotMemory, PairMarkMemory} from "./memory";

/** The boat entitled to mark-room under a latch, or null when neither is (overlapped with nobody inside). */
export function entitledBoat(latch: PairMarkMemory): string | null {
	return (latch.overlappedAtEntry ? latch.insideAtEntry : latch.clearAheadAtEntry) ?? null;
}

/**
 * Fold one frame into the mark memory.
 *
 * - `markSlots`: `zoneEntryAt` is set on the frame a boat's hull first reaches a mark's zone and kept while she stays in it.
 * - `pairMarks`: when the first of two boats that both have the mark as their next mark reaches its zone, record whether they
 *   were overlapped (and who was inside) or who was clear ahead. The slot is released (18.2(d)) when the entitled boat starts
 *   tacking (`startedTacking`) or leaves the zone, and deleted once both boats have left the zone or stopped heading for the mark.
 *
 * @param startedTacking Ids of the boats that passed head to wind this frame.
 */
export function nextMarkMemory(world: WorldState, facts: WorldFacts, prev: EngineMemory, nowMs: number, startedTacking: Set<string>): Pick<EngineMemory, "markSlots" | "pairMarks"> {
	const markSlots: Record<string, MarkSlotMemory> = {};
	for (const boat of world.boats) {
		for (const mark of world.marks) {
			const key = markSlotKey(boat.id, mark.id);
			if (facts.marks[key].inZone) markSlots[key] = {zoneEntryAt: prev.markSlots[key]?.zoneEntryAt ?? nowMs};
		}
	}

	const pairMarks: Record<string, PairMarkMemory> = {};
	for (const [pairKey, pair] of Object.entries(facts.pairs)) {
		const a = world.boats.find((boat) => boat.id === pair.a);
		const b = world.boats.find((boat) => boat.id === pair.b);
		if (!a || !b) continue;
		for (const mark of world.marks) {
			const fa = facts.marks[markSlotKey(a.id, mark.id)];
			const fb = facts.marks[markSlotKey(b.id, mark.id)];
			if (!fa.nextMark || !fb.nextMark) continue;
			const key = pairMarkKey(pairKey, mark.id);
			const before = prev.pairMarks[key];

			if (!before) {
				if (!fa.inZone && !fb.inZone) continue;
				const overlapped = isOverlapped(a, b);
				const inside = overlapped ? insideBoatId(a, b, mark) : null;
				pairMarks[key] = {
					firstInZoneAt: nowMs,
					overlappedAtEntry: overlapped,
					...(inside ? {insideAtEntry: inside} : {}),
					...(!overlapped ? {clearAheadAtEntry: isClearAstern(b, a) ? a.id : b.id} : {}),
				};
				continue;
			}

			if (!fa.inZone && !fb.inZone) continue; // both left the zone: the slot ends
			const entitled = entitledBoat(before);
			const entitledFacts = entitled === a.id ? fa : fb;
			const release = entitled !== null && (startedTacking.has(entitled) || !entitledFacts.inZone);
			pairMarks[key] = release ? {...before, released: true} : before;
		}
	}
	return {markSlots, pairMarks};
}
