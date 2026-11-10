import React from "react";
import MoveableComponent from "./MoveableComponent";
import type {Mark} from "../model/world";
import type {WorldAction} from "../state/worldReducer";
import {lengthToPx, toPx, toWorld} from "../view/scale";

/** Radius of the mark-room zone, in hull lengths (Rule 18). */
export const ZONE_RADIUS_HULL_LENGTHS = 3;

/** Diameter in pixels of the mark's own circle. */
const MARK_SIZE_PX = 28;

interface MarkMarkerProps {
	mark: Mark;
	dispatch: React.Dispatch<WorldAction>;
}

/**
 * A mark of the course: a small orange circle with a chevron showing the side it
 * is left on, and a dashed circle for the three-hull-length zone. The circle is
 * draggable; the zone is decoration and ignores the pointer.
 */
const MarkMarker = ({mark, dispatch}: MarkMarkerProps) => {
	const moveRef = React.useRef<HTMLDivElement>(null);
	const center = toPx(mark);
	const zonePx = lengthToPx(ZONE_RADIUS_HULL_LENGTHS);

	return (
		<div>
			<div
				className="mark-zone"
				aria-hidden="true"
				style={{width: zonePx * 2, height: zonePx * 2, transform: `translate(${center.x - zonePx}px, ${center.y - zonePx}px)`}}
			/>
			<div
				className="mark-marker"
				ref={moveRef}
				role="img"
				aria-label={`Mark ${mark.id}, to be left to ${mark.roundingSide}`}
				style={{width: MARK_SIZE_PX, height: MARK_SIZE_PX, transform: `translate(${center.x - MARK_SIZE_PX / 2}px, ${center.y - MARK_SIZE_PX / 2}px)`}}>
				{/* The chevron points up the course with the mark kept on the named side:
				    leave to port → boats pass with it on their left, so it sits left of a boat heading up. */}
				<span className={`mark-marker__arrow mark-marker__arrow--${mark.roundingSide}`}>{mark.roundingSide === "port" ? "↶" : "↷"}</span>
			</div>
			<MoveableComponent
				moveRef={moveRef}
				onDrag={(x, y) => {
					const next = toWorld({x: x + MARK_SIZE_PX / 2, y: y + MARK_SIZE_PX / 2});
					dispatch({type: "moveMark", id: mark.id, x: next.x, y: next.y});
				}}
			/>
		</div>
	);
};

export default MarkMarker;
