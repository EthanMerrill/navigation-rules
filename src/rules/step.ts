/**
 * Step — the engine's per-frame entry point.
 *
 * `step(world, memory, nowMs)` is a pure function: given the world and the
 * memory returned by the previous step it computes the facts, derives which
 * boats are tacking, evaluates the rules and returns the evaluation together
 * with the memory for the next step. No React, no hidden state.
 */

import type {WorldState} from "../model/world";
import {CLOSE_HAULED_ANGLE, TWO_HULL_LENGTHS, computeFacts, getWindAngle, isClearAstern} from "./factsEngine";
import type {Tack, WorldFacts} from "./factsEngine";
import {evaluate} from "./evaluate";
import {nextMarkMemory} from "./markMemory";
import {createEmptyMemory} from "./memory";
import type {BoatMemory, EngineMemory, PairMemory} from "./memory";
import type {EngineHistory, RuleEvaluation} from "./types";

/** Heading change (degrees) above which a boat is considered to be changing course. */
const COURSE_CHANGE_EPSILON = 0.5;

/** Smallest absolute difference between two headings, in degrees. */
function headingDelta(a: number, b: number): number {
	const d = Math.abs(a - b) % 360;
	return d > 180 ? 360 - d : d;
}

/**
 * Whether a boat is tacking this frame (Rule 13). She starts tacking when she
 * comes out of head-to-wind on the other tack from the one she was on, and
 * stops once her wind angle is back to close-hauled or lower on her new tack.
 */
function deriveTacking(prev: BoatMemory | undefined, tack: Tack | null, windAngle: number): boolean {
	const crossed = prev !== undefined && prev.prevTack !== null && tack !== null && tack !== prev.prevTack;
	const tackingNow = (prev?.tacking ?? false) || crossed;
	return tackingNow && !(tack !== null && windAngle >= CLOSE_HAULED_ANGLE);
}

/** Run one frame: facts → derived tacking → evaluation → next memory. */
export function step(world: WorldState, memory: EngineMemory | null, nowMs: number): {evaluation: RuleEvaluation; memory: EngineMemory} {
	const prev = memory ?? createEmptyMemory();

	// (a) Facts, with last frame's tacks to avoid head-to-wind flicker.
	const prevTacks: Record<string, Tack | null> = {};
	for (const [id, boat] of Object.entries(prev.boats)) prevTacks[id] = boat.prevTack;
	const facts = computeFacts(world, prevTacks);

	// (b) Derive tacking per boat and expose it in the facts.
	const boatMemory: Record<string, BoatMemory> = {};
	for (const boat of world.boats) {
		const bf = facts.boats[boat.id];
		const before = prev.boats[boat.id];
		bf.tacking = deriveTacking(before, bf.tack, getWindAngle(boat.heading, world.wind.direction));
		boatMemory[boat.id] = {
			prevTack: bf.tack,
			prevHeading: boat.heading,
			tacking: bf.tacking,
			...(bf.tacking ? {tackingSince: before?.tacking ? (before.tackingSince ?? nowMs) : nowMs} : {}),
		};
	}

	// (c) History for the evaluator, from last frame's memory.
	const changingCourse: Record<string, boolean> = {};
	for (const boat of world.boats) {
		const before = prev.boats[boat.id];
		changingCourse[boat.id] = before !== undefined && headingDelta(boat.heading, before.prevHeading) > COURSE_CHANGE_EPSILON;
	}
	const history: EngineHistory = {prevRightOfWay: {}, changingCourse, leewardFromAstern: {}};
	for (const [key, pair] of Object.entries(prev.pairs)) {
		history.prevRightOfWay![key] = pair.prevRightOfWay;
		history.leewardFromAstern![key] = pair.leewardFromAstern;
	}

	for (const [key, mark] of Object.entries(prev.pairMarks)) {
		if (!mark.released) (history.markEntry ??= {})[key] = mark;
	}

	// (d) Evaluate.
	const evaluation = evaluate(world, facts, history);

	// (e) Next memory.
	const startedTacking = new Set(world.boats.filter((boat) => facts.boats[boat.id].tacking && !prev.boats[boat.id]?.tacking).map((boat) => boat.id));
	const markMemory = nextMarkMemory(world, facts, prev, nowMs, startedTacking);
	return {evaluation, memory: {boats: boatMemory, pairs: nextPairMemory(world, facts, evaluation, prev), ...markMemory}};
}

/**
 * Fold one evaluated frame into the per-pair memory. Rule 17.1: a boat latches
 * when she was clear astern last frame and is now overlapped to leeward within
 * two hull lengths; the latch holds until the boats are no longer overlapped
 * within that distance (or no longer on the same tack).
 */
function nextPairMemory(world: WorldState, facts: WorldFacts, evaluation: RuleEvaluation, prev: EngineMemory): Record<string, PairMemory> {
	const pairs: Record<string, PairMemory> = {};
	for (const [key, pair] of Object.entries(facts.pairs)) {
		const a = world.boats.find((boat) => boat.id === pair.a);
		const b = world.boats.find((boat) => boat.id === pair.b);
		if (!a || !b) continue;
		const before = prev.pairs[key];

		let leewardFromAstern: Record<string, boolean> = {};
		if (pair.overlapped && pair.separation < TWO_HULL_LENGTHS && pair.windwardIsA !== null) {
			const leewardId = pair.windwardIsA ? pair.b : pair.a;
			leewardFromAstern = {...before?.leewardFromAstern};
			if (before?.prevClearAstern[leewardId]) leewardFromAstern[leewardId] = true;
		}

		pairs[key] = {
			prevRightOfWay: evaluation.pairs[key].rightOfWay,
			leewardFromAstern,
			prevClearAstern: {[a.id]: isClearAstern(a, b), [b.id]: isClearAstern(b, a)},
		};
	}
	return pairs;
}
