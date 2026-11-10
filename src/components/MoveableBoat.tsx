import React from "react";
import MoveableComponent from "./MoveableComponent";
import PrototypeBoat from "../assets/PrototypeBoat.svg";
import type {BoatState} from "../model/world";
import {BoatRuleView, PointOfSail} from "../rules/rulesEngine";
import type {WorldAction} from "../state/worldReducer";
import {centerFromWrapperOrigin, wrapperOrigin} from "../view/scale";

export interface ImoveableBoatProps {
	boatState: BoatState;
	dispatch: React.Dispatch<WorldAction>;
	text: string;
	boatRuleView: BoatRuleView;
}

const STARBOARD_SAIL_PATH = "M10 1C-0.5 14.5 -0.5 61.5 3.5 78.5";
const PORT_SAIL_PATH = "M0.999999 1C11.5 14.5 11.5 61.5 7.5 78.5";

/**
 * Ripple shapes for the flapping (in irons) animation. Each keeps the same
 * command structure as the base path (M + one C) so motion can interpolate the
 * `d` attribute. The control points bow the sail in/out like it's luffing.
 */
const FLAP_SHAPES: Record<string, [string, string]> = {
	// Starboard sail: mast at x=10, curves left (negative control x)
	[STARBOARD_SAIL_PATH]: [
		"M10 1C-6.5 14.5 -6.5 61.5 3.5 78.5",
		"M10 1C3.5 14.5 4.5 61.5 3.5 78.5",
	],
	// Port sail: mast at x=1, curves right (positive control x)
	[PORT_SAIL_PATH]: [
		"M0.999999 1C17.5 14.5 17.5 61.5 7.5 78.5",
		"M0.999999 1C6.5 14.5 5.5 61.5 7.5 78.5",
	],
};

const POINT_OF_SAIL_LABELS: Record<PointOfSail, string> = {
	HEAD_TO_WIND: "In irons",
	CLOSE_HAULED: "Close hauled",
	CLOSE_REACH: "Close reach",
	BEAM_REACH: "Beam reach",
	BROAD_REACH: "Broad reach",
	RUNNING: "Running",
};

const MoveableBoat = (props: ImoveableBoatProps) => {
	const {boatState, dispatch, text, boatRuleView} = props;
	const moveRef = React.useRef<HTMLDivElement>(null);

	// The boat's stored position is its center, but the wrapper is positioned by
	// its top-left corner; `wrapperOrigin` converts world units to that pixel offset.
	const origin = wrapperOrigin(boatState);
	const transform = `translate(${origin.x}px, ${origin.y}px) rotate(${boatState.heading}deg)`;

	const sailPath = boatRuleView.tack === "PORT" ? PORT_SAIL_PATH : STARBOARD_SAIL_PATH;

	// The sail hangs from its mast (luff). Each path's mast is at the top edge:
	//   - starboard sail: masthead at (10, 1), foot curves to the left/port side
	//   - port sail:      masthead at (1, 1), foot curves to the right/starboard side
	// To trim the sail we rotate it about its OWN mast so the foot swings out to
	// the leeward side while the mast stays put (no fore-aft drift).
	//
	// Rotation direction (CSS positive = clockwise on screen):
	//   - starboard tack: boom to port (left)  → rotate clockwise, +trim
	//   - port tack:      boom to starboard (right) → rotate counter-clockwise, -trim
	const trimAngle = boatRuleView.sailTrimAngle;
	const isPort = boatRuleView.tack === "PORT";
	const rotation = isPort ? -trimAngle : trimAngle;

	// The sail is anchored at its MAST (the forward-most point = the head of the
	// luff). The two mirrored paths have their mast at a different x in SVG space
	// (x=1 for port, x=10 for starboard), so we set `left` and `transform-origin`
	// per-tack to land that SAME point on the hull centreline at all times — the
	// mast must not jump when the boat tacks.
	//
	// Hull geometry (wrapper is 100×200, hull image 80×164 centered horizontally):
	//   - centreline (lateral) x = 50
	//   - mast sits ON that centreline; the sail then hangs to leeward.
	const MAST_X = 50; // hull centreline in local px
	const mastSvgX = isPort ? 1 : 10;
	const sailLeft = MAST_X - mastSvgX; // port: 49, starboard: 40

	// Fore-aft position: put the MIDDLE of the (roughly vertical, close-hauled)
	// sail over the middle of the hull (y ≈ 82). The sail's head is at SVG y=1
	// and its foot at y≈78.5, so its middle is ~40px below the mast head.
	const HULL_MIDDLE_Y = 82; // fore-aft middle of the 164px hull
	const SAIL_HALF_LENGTH = 40;
	const MAST_AFT_OFFSET = 20; // extra aft shift so the mast sits further back
	const sailTop = HULL_MIDDLE_Y - SAIL_HALF_LENGTH - 1 + MAST_AFT_OFFSET; // ≈ 61

	// Rotation pivots around the mast head so it stays fixed while the foot swings.
	const sailTransformOrigin = `${mastSvgX}px 1px`;

	// When in irons (head to wind) the sail luffs: it flaps and ripples.
	const isFlapping = boatRuleView.pointOfSail === "HEAD_TO_WIND";
	const [flapA, flapB] = FLAP_SHAPES[sailPath] ?? [sailPath, sailPath];
	const flapDuration = 1.1;

	return (
		<div>
			<div
				className="boat-wrapper"
				ref={moveRef}
				style={{
					transform,
				}}>
				<img alt={text} src={PrototypeBoat} className={boatRuleView.standOn ? "standon-boat" : undefined} />
				{boatRuleView.windward && (
					<div className="windward-tag">
						<p className="text-tag">Windward</p>
					</div>
				)}
				{boatRuleView.leeward && (
					<div className="leeward-tag">
						<p className="text-tag">
							<u>Leeward</u>
						</p>
					</div>
				)}
				{boatRuleView.tack === "STARBOARD" && (
					<div className="starboard-tag">
						<p className="text-tag">Starboard</p>
					</div>
				)}
				{boatRuleView.tack === "PORT" && (
					<div className="port-tag">
						<p className="text-tag">Port</p>
					</div>
				)}
				{boatRuleView.tack === null && (
					<div className="windward-tag">
						<p className="text-tag">Head to wind</p>
					</div>
				)}
				{boatState.tacking && (
					<div className="tacking-tag">
						<p className="text-tag">Tacking</p>
					</div>
				)}
				<div className="point-of-sail-tag">
					<p className="text-tag">{POINT_OF_SAIL_LABELS[boatRuleView.pointOfSail]}</p>
				</div>
				<svg
					className={isFlapping ? "sail-path sail-path--flapping" : "sail-path"}
					width="11"
					height="79"
					viewBox="0 0 11 79"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					style={{
						left: sailLeft,
						top: sailTop,
						transformOrigin: sailTransformOrigin,
						transform: `rotate(${rotation}deg)`,
					}}>
					{/* SMIL morphs the path between ripple shapes when flapping; a CSS
					    keyframe (sail-path--flapping) adds the rotation flutter. */}
					<path d={sailPath} stroke="black">
						{isFlapping && (
							<animate
								attributeName="d"
								values={`${sailPath}; ${flapA}; ${flapB}; ${sailPath}`}
								dur={`${flapDuration}s`}
								repeatCount="indefinite"
							/>
						)}
					</path>
				</svg>
			</div>
			<MoveableComponent
				moveRef={moveRef}
				onDrag={(x, y) => {
					const center = centerFromWrapperOrigin({x, y});
					dispatch({type: "moveBoat", id: boatState.id, x: center.x, y: center.y});
				}}
				onRotate={(heading) => dispatch({type: "rotateBoat", id: boatState.id, heading})}
			/>
		</div>
	);
};

export default MoveableBoat;
