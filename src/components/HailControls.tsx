import React from "react";
import type {WorldState} from "../model/world";
import {computeFacts, hailProblem, hailTarget, replyTo} from "../rules/rulesEngine";
import type {WorldAction} from "../state/worldReducer";

interface HailControlsProps {
	world: WorldState;
	dispatch: React.Dispatch<WorldAction>;
}

/**
 * Hail controls (Rule 20): one "Hail for room to tack" button per boat, aimed at
 * the nearest boat on the same tack. A hail that breaks rule 20.1 can still be
 * made (the hailed boat must respond anyway, Rule 20.2(b)); a visible warning
 * chip next to the button says it breaks 20.1; the reason is in its tooltip and
 * in screen-reader text. A hailed boat can
 * answer "You tack". Hails stay until cleared.
 */
const HailControls = ({world, dispatch}: HailControlsProps) => {
	const facts = React.useMemo(() => computeFacts(world), [world]);
	return (
		<div className="control-row hail-controls">
			<span className="control-label">Hails</span>
			{world.boats.map((boat) => {
				const target = hailTarget(world, facts, boat.id);
				const problem = target === null ? null : hailProblem(world, facts, boat.id, target);
				const alreadyHailed = target !== null && world.hails.some((h) => h.kind === "roomToTack" && h.from === boat.id && h.to === target);
				return (
					<span className="hail-control" key={boat.id}>
						<button
							type="button"
							className="reset-button"
							disabled={target === null || alreadyHailed}
							title={target === null ? "No boat on the same tack to hail" : alreadyHailed ? "Already hailed" : `${boat.id} hails ${target} for room to tack`}
							onClick={() => target !== null && dispatch({type: "hail", from: boat.id, to: target, kind: "roomToTack", at: performance.now()})}>
							{boat.id}: room to tack
						</button>
						{problem !== null && (
							<span className="hail-warning" role="status" title={`Breaks rule 20.1: ${problem}. The hailed boat must still respond (rule 20.2(b)).`}>
								<span aria-hidden="true">⚠ </span>
								breaks rule 20.1<span className="visually-hidden">: {problem}</span>
							</span>
						)}
					</span>
				);
			})}
			{world.hails
				.filter((h) => h.kind === "roomToTack" && !replyTo(world, h))
				.map((h) => (
					<button key={h.id} type="button" className="reset-button" onClick={() => dispatch({type: "hail", from: h.to, to: h.from, kind: "youTack", at: performance.now()})}>
						{h.to}: reply &quot;You tack&quot;
					</button>
				))}
			<button type="button" className="reset-button" disabled={world.hails.length === 0} onClick={() => dispatch({type: "clearHails"})}>
				Clear hails
			</button>
		</div>
	);
};

export default HailControls;
