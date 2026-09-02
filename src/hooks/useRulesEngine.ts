import {useEffect, useMemo, useRef} from "react";
import {BoatState, WindState, RuleEvaluation, Tack, evaluate, getTack} from "../rules/rulesEngine";

/** Heading change (degrees) above which a boat is considered to be changing course. */
const COURSE_CHANGE_EPSILON = 0.5;

/**
 * React glue around the pure rules engine. Memoizes the evaluation and tracks
 * the history needed by the stateful limitation rules:
 *   - previous tack of each boat (avoid head-to-wind flicker),
 *   - previous stand-on boat (Rule 15 — acquiring right of way),
 *   - previous headings (Rule 16 — changing course).
 */
export function useRulesEngine(boatA: BoatState, boatB: BoatState, wind: WindState): RuleEvaluation {
	const prevTacksRef = useRef<{a: Tack | null; b: Tack | null}>({a: null, b: null});
	const prevHeadingsRef = useRef<{a: number; b: number}>({a: boatA.heading, b: boatB.heading});
	const prevStandOnIsARef = useRef<boolean | null>(null);

	const evaluation = useMemo(() => {
		const changingCourseA = Math.abs(boatA.heading - prevHeadingsRef.current.a) > COURSE_CHANGE_EPSILON;
		const changingCourseB = Math.abs(boatB.heading - prevHeadingsRef.current.b) > COURSE_CHANGE_EPSILON;

		return evaluate(boatA, boatB, wind, {
			prevTacks: prevTacksRef.current,
			prevStandOnIsA: prevStandOnIsARef.current,
			changingCourseA,
			changingCourseB,
		});
	}, [boatA, boatB, wind]);

	// The stand-on boat is determined by the deciding rule.
	const standOnIsA: boolean | null = evaluation.boats[0].standOn ? true : evaluation.boats[1].standOn ? false : null;

	useEffect(() => {
		const aTack = getTack(boatA.heading, wind.direction);
		const bTack = getTack(boatB.heading, wind.direction);
		if (aTack !== null) prevTacksRef.current.a = aTack;
		if (bTack !== null) prevTacksRef.current.b = bTack;

		prevHeadingsRef.current = {a: boatA.heading, b: boatB.heading};
		prevStandOnIsARef.current = standOnIsA;
	}, [boatA, boatB, wind, standOnIsA]);

	return evaluation;
}
