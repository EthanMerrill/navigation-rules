import {useEffect, useMemo, useRef} from "react";
import type {WorldState} from "../model/world";
import {EngineHistory, RuleEvaluation, Tack, WorldFacts, TWO_HULL_LENGTHS, computeFacts, evaluate, isClearAstern} from "../rules/rulesEngine";

/** Heading change (degrees) above which a boat is considered to be changing course. */
const COURSE_CHANGE_EPSILON = 0.5;

/** Mutable history carried between renders (replaced by engine memory in Phase 3). */
interface HistoryRefs {
	prevTacks: Record<string, Tack | null>;
	prevHeadings: Record<string, number>;
	prevRightOfWay: Record<string, string | null>;
	/** Pair key → boat id → whether that boat was clear astern of the other last frame. */
	prevClearAstern: Record<string, Record<string, boolean>>;
	/** Pair key → boat id → latched "established a leeward overlap from clear astern" (Rule 17.1). */
	leewardFromAstern: Record<string, Record<string, boolean>>;
}

/**
 * React glue around the pure rules engine. Computes the facts once, evaluates
 * every pair of boats, and tracks the history needed by the stateful rules,
 * keyed by boat id and pair key:
 *   - previous tack of each boat (avoid head-to-wind flicker),
 *   - previous right-of-way boat per pair (Rule 15 — acquiring right of way),
 *   - previous headings (Rule 16 — changing course),
 *   - leeward-from-astern latch per pair (Rule 17.1).
 * With fewer than two boats there are simply no pairs.
 */
export function useRulesEngine(world: WorldState): RuleEvaluation {
	const historyRef = useRef<HistoryRefs>({prevTacks: {}, prevHeadings: {}, prevRightOfWay: {}, prevClearAstern: {}, leewardFromAstern: {}});

	const computed = useMemo(() => {
		const h = historyRef.current;
		const facts = computeFacts(world, h.prevTacks);

		const changingCourse: Record<string, boolean> = {};
		for (const boat of world.boats) {
			const prev = h.prevHeadings[boat.id];
			changingCourse[boat.id] = prev !== undefined && Math.abs(boat.heading - prev) > COURSE_CHANGE_EPSILON;
		}

		const history: EngineHistory = {prevRightOfWay: h.prevRightOfWay, changingCourse, leewardFromAstern: h.leewardFromAstern};
		return {facts, evaluation: evaluate(world, facts, history)};
	}, [world]);

	useEffect(() => {
		const {facts, evaluation} = computed;
		const prev = historyRef.current;
		historyRef.current = nextHistory(world, facts, evaluation, prev);
	}, [world, computed]);

	return computed.evaluation;
}

/** Fold one evaluated frame into the history for the next frame. */
function nextHistory(world: WorldState, facts: WorldFacts, evaluation: RuleEvaluation, prev: HistoryRefs): HistoryRefs {
	const next: HistoryRefs = {prevTacks: {}, prevHeadings: {}, prevRightOfWay: {}, prevClearAstern: {}, leewardFromAstern: {}};

	for (const boat of world.boats) {
		next.prevTacks[boat.id] = facts.boats[boat.id].tack;
		next.prevHeadings[boat.id] = boat.heading;
	}

	for (const [key, pair] of Object.entries(facts.pairs)) {
		next.prevRightOfWay[key] = evaluation.pairs[key].rightOfWay;

		// Rule 17.1 — detect a clear-astern boat becoming overlapped to leeward
		// within two hull lengths, and latch it until the boats are no longer
		// overlapped within that distance (or are no longer on the same tack).
		const a = world.boats.find((b) => b.id === pair.a);
		const b = world.boats.find((boat) => boat.id === pair.b);
		if (!a || !b) continue;

		const latched: Record<string, boolean> = {...prev.leewardFromAstern[key]};
		if (pair.overlapped && pair.separation < TWO_HULL_LENGTHS && pair.windwardIsA !== null) {
			const leewardId = pair.windwardIsA ? pair.b : pair.a;
			if (prev.prevClearAstern[key]?.[leewardId]) latched[leewardId] = true;
			next.leewardFromAstern[key] = latched;
		}

		next.prevClearAstern[key] = {[a.id]: isClearAstern(a, b), [b.id]: isClearAstern(b, a)};
	}

	return next;
}
