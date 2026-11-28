import React from "react";
import type {WorldState} from "../model/world";
import {approachesObstruction, computeFacts, hailProblem, hailTarget, replyTo} from "../rules/rulesEngine";
import type {WorldAction} from "../state/worldReducer";

interface HailControlsProps {
	world: WorldState;
	dispatch: React.Dispatch<WorldAction>;
}

/**
 * Hail controls (Rule 20). Hailing for room to tack only means something at an
 * obstruction, so the row only shows while a boat is approaching one (or a hail
 * is in play), with a button for each boat approaching an obstruction that has a
 * boat on the same tack to hail (the nearest). A hail that breaks rule 20.1 can still be
 * made (the hailed boat must respond anyway, Rule 20.2(b)); a visible warning
 * chip next to the button says it breaks 20.1; the reason is in its tooltip and
 * in screen-reader text. A hailed boat can
 * answer "You tack". Hails stay until cleared.
 */
const HailControls = ({world, dispatch}: HailControlsProps) => {
	const facts = React.useMemo(() => computeFacts(world), [world]);
	const approaching = world.boats.filter((boat) => approachesObstruction(world, facts, boat.id));
	if (approaching.length === 0 && world.hails.length === 0) return null;
	return (
		<div className="control-row hail-controls">
			<span className="control-label">Hails</span>
			{approaching.map((boat) => {
				const target = hailTarget(world, facts, boat.id);
				if (target === null) return null;
				const problem = hailProblem(world, facts, boat.id, target);
				const alreadyHailed = world.hails.some((h) => h.kind === "roomToTack" && h.from === boat.id && h.to === target);
				return (
					<span className="hail-control" key={boat.id}>
						<button
							type="button"
							className="reset-button"
							disabled={alreadyHailed}
							title={alreadyHailed ? "Already hailed" : `${boat.id} hails ${target} for room to tack`}
							onClick={() => dispatch({type: "hail", from: boat.id, to: target, kind: "roomToTack", at: performance.now()})}>
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
			{world.hails.length > 0 && (
				<button type="button" className="reset-button" onClick={() => dispatch({type: "clearHails"})}>
					Clear hails
				</button>
			)}
		</div>
	);
};

export default HailControls;
