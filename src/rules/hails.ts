/**
 * Hail helpers (Rule 20) — pure functions over the world and its facts, shared
 * by the Rule 20 predicate and the hail controls in the UI.
 */

import type {Hail, WorldState} from "../model/world";
import {distanceBetween} from "./factsEngine";
import type {WorldFacts} from "./factsEngine";
import {obstructionSlotKey} from "./memory";

/** Whether the boat is approaching any obstruction. */
export function approachesObstruction(world: WorldState, facts: WorldFacts, boatId: string): boolean {
	return world.obstructions.some((o) => facts.obstructions[obstructionSlotKey(boatId, o.id)]?.approaching);
}

/**
 * Why a hail by `from` to `to` for room to tack would break rule 20.1, or null when it would not.
 * A hail that breaks 20.1 still has to be responded to (Rule 20.2(b)), so this is a warning, not a gate.
 *
 * She must be close-hauled or above, on the same tack as the hailed boat, and
 * approaching an obstruction. NOT MODELLED: that she needs a substantial course
 * change to avoid the obstruction safely, and that the obstruction is not a
 * mark the hailed boat is fetching (marks are never obstructions here).
 */
export function hailProblem(world: WorldState, facts: WorldFacts, fromId: string, toId: string): string | null {
	const from = facts.boats[fromId];
	const to = facts.boats[toId];
	if (!from || !to) return "No such boat";
	if (from.pointOfSail !== "CLOSE_HAULED" && from.pointOfSail !== "HEAD_TO_WIND") return "Only a boat sailing close-hauled or above may hail for room to tack";
	if (from.tack === null || from.tack !== to.tack) return "The hailed boat must be on the same tack";
	if (!approachesObstruction(world, facts, fromId)) return "Not approaching an obstruction";
	return null;
}

/** The nearest boat on the same tack as `fromId`, or null when there is none. */
export function hailTarget(world: WorldState, facts: WorldFacts, fromId: string): string | null {
	const from = world.boats.find((b) => b.id === fromId);
	const tack = facts.boats[fromId]?.tack ?? null;
	if (!from || tack === null) return null;
	const others = world.boats.filter((b) => b.id !== fromId && facts.boats[b.id].tack === tack);
	others.sort((x, y) => distanceBetween(from, x) - distanceBetween(from, y));
	return others[0]?.id ?? null;
}

/** The "You tack" reply to `hail`, if one has been made. */
export function replyTo(world: WorldState, hail: Hail): Hail | undefined {
	return world.hails.find((h) => h.kind === "youTack" && h.from === hail.to && h.to === hail.from);
}
