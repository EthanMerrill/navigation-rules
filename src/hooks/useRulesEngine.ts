import {useEffect, useMemo, useRef} from "react";
import type {WorldState} from "../model/world";
import {RuleEvaluation, Tack, evaluate, getTack, isClearAstern, computeMeetingFacts, TWO_HULL_LENGTHS} from "../rules/rulesEngine";

/** Heading change (degrees) above which a boat is considered to be changing course. */
const COURSE_CHANGE_EPSILON = 0.5;

/**
 * React glue around the pure rules engine. Memoizes the evaluation and tracks
 * the history needed by the stateful limitation rules. TEMPORARY: evaluates
 * only the first two boats of the world (Phase 2 generalises this). History:
 *   - previous tack of each boat (avoid head-to-wind flicker),
 *   - previous stand-on boat (Rule 15 — acquiring right of way),
 *   - previous headings (Rule 16 — changing course).
 */
export function useRulesEngine(world: WorldState): RuleEvaluation | null {
	const [boatA, boatB] = world.boats;
	const wind = world.wind;
	const prevTacksRef = useRef<{a: Tack | null; b: Tack | null}>({a: null, b: null});
	const prevHeadingsRef = useRef<{a: number; b: number}>({a: boatA?.heading ?? 0, b: boatB?.heading ?? 0});
	const prevStandOnIsARef = useRef<boolean | null>(null);

	// Rule 17.1 transition history: whether each boat has (in a prior frame)
	// established a leeward overlap from clear astern, and each boat's previous
	// clear-astern status.
	const establishedLeewardRef = useRef<{a: boolean; b: boolean}>({a: false, b: false});
	const prevClearAsternARef = useRef(false);
	const prevClearAsternBRef = useRef(false);

	const evaluation = useMemo(() => {
		if (!boatA || !boatB) return null;
		const changingCourseA = Math.abs(boatA.heading - prevHeadingsRef.current.a) > COURSE_CHANGE_EPSILON;
		const changingCourseB = Math.abs(boatB.heading - prevHeadingsRef.current.b) > COURSE_CHANGE_EPSILON;

		return evaluate(boatA, boatB, wind, {
			prevTacks: prevTacksRef.current,
			prevStandOnIsA: prevStandOnIsARef.current,
			changingCourseA,
			changingCourseB,
			establishedLeewardA: establishedLeewardRef.current.a,
			establishedLeewardB: establishedLeewardRef.current.b,
		});
	}, [boatA, boatB, wind]);

	// The stand-on boat is determined by the deciding rule.
	const standOnIsA: boolean | null = !evaluation ? null : evaluation.boats[0].standOn ? true : evaluation.boats[1].standOn ? false : null;

	useEffect(() => {
		if (!boatA || !boatB) return;
		const aTack = getTack(boatA.heading, wind.direction);
		const bTack = getTack(boatB.heading, wind.direction);
		if (aTack !== null) prevTacksRef.current.a = aTack;
		if (bTack !== null) prevTacksRef.current.b = bTack;

		prevHeadingsRef.current = {a: boatA.heading, b: boatB.heading};
		prevStandOnIsARef.current = standOnIsA;

		// Rule 17.1 — detect a clear-astern boat becoming overlapped to leeward
		// within two hull lengths, and latch it until the boats are no longer
		// overlapped within that distance (or are no longer on the same tack).
		const {facts} = computeMeetingFacts(boatA, boatB, wind, prevTacksRef.current);
		const withinTwoLengths = facts.separation < TWO_HULL_LENGTHS;

		if (facts.overlapped && withinTwoLengths) {
			const windwardIsA = facts.windwardIsA === true;
			if (!windwardIsA && prevClearAsternARef.current) establishedLeewardRef.current.a = true;
			if (windwardIsA && prevClearAsternBRef.current) establishedLeewardRef.current.b = true;
		} else {
			establishedLeewardRef.current = {a: false, b: false};
		}

		prevClearAsternARef.current = isClearAstern(boatA, boatB);
		prevClearAsternBRef.current = isClearAstern(boatB, boatA);
	}, [boatA, boatB, wind, standOnIsA]);

	return evaluation;
}
