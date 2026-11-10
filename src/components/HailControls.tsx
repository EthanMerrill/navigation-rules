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
 * the nearest boat on the same tack and disabled, with the reason as a tooltip,
 * when the hail would not be valid. A hailed boat can answer "You tack". Hails
 * stay until cleared.
 */
const HailControls = ({world, dispatch}: HailControlsProps) => {
	const facts = React.useMemo(() => computeFacts(world), [world]);
	return (
		<div className="control-row hail-controls">
			<span className="control-label">Hails</span>
			{world.boats.map((boat) => {
				const target = hailTarget(world, facts, boat.id);
				const problem = target === null ? "No boat on the same tack to hail" : hailProblem(world, facts, boat.id, target);
				const alreadyHailed = target !== null && world.hails.some((h) => h.kind === "roomToTack" && h.from === boat.id && h.to === target);
				return (
					<button
						key={boat.id}
						type="button"
						className="reset-button"
						disabled={problem !== null || alreadyHailed}
						title={problem ?? (alreadyHailed ? "Already hailed" : `${boat.id} hails ${target} for room to tack`)}
						onClick={() => target !== null && dispatch({type: "hail", from: boat.id, to: target, kind: "roomToTack", at: performance.now()})}>
						{boat.id}: room to tack
					</button>
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
