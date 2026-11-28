import React from "react";
import MoveableComponent from "./MoveableComponent";
import type {Mark} from "../model/world";
import type {WorldAction} from "../state/worldReducer";
import {lengthToPx, toPx, toWorld} from "../view/scale";

/** Radius of the mark-room zone, in hull lengths (Rule 18). */
export const ZONE_RADIUS_HULL_LENGTHS = 3;

/** Diameter in pixels of the mark's own circle. */
export const MARK_SIZE_PX = 28;

interface MarkMarkerProps {
	mark: Mark;
	dispatch: React.Dispatch<WorldAction>;
	/** Pointer position while the mark is dragged (see `MoveableComponent`). */
	onDragPointer?: (clientX: number, clientY: number, ended: boolean) => void;
}

const KIND_LABEL: Record<Mark["kind"], string> = {
	start: "Start mark",
	rounding: "Mark",
	windward: "Windward mark",
	leeward: "Leeward mark",
	gate: "Gate mark",
	finish: "Finish mark",
};

/**
 * A mark of the course: a small circle with a chevron showing the side it is
 * left on, and a dashed circle for the three-hull-length zone (none for a start
 * mark, where Rule 18 does not apply). The circle is draggable; select it and
 * press S (or double-click it) to switch the side, Delete to remove it.
 */
const MarkMarker = ({mark, dispatch, onDragPointer}: MarkMarkerProps) => {
	const moveRef = React.useRef<HTMLDivElement>(null);
	const center = toPx(mark);
	const zonePx = lengthToPx(ZONE_RADIUS_HULL_LENGTHS);
	const flip = () => dispatch({type: "flipMarkSide", id: mark.id});

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Delete" || e.key === "Backspace") {
			e.preventDefault();
			dispatch({type: "removeMark", id: mark.id});
		} else if (e.key === "s" || e.key === "S") {
			e.preventDefault();
			flip();
		}
	};

	return (
		<div>
			{mark.kind !== "start" && (
				<div
					className="mark-zone"
					aria-hidden="true"
					style={{width: zonePx * 2, height: zonePx * 2, transform: `translate(${center.x - zonePx}px, ${center.y - zonePx}px)`}}
				/>
			)}
			<div
				className={`mark-marker mark-marker--${mark.kind}`}
				ref={moveRef}
				tabIndex={0}
				role="group"
				aria-roledescription="mark"
				aria-label={`${KIND_LABEL[mark.kind]} ${mark.id}, to be left to ${mark.roundingSide}. Press S to switch sides; Delete removes it.`}
				title={`${KIND_LABEL[mark.kind]}, left to ${mark.roundingSide}. Double-click to switch sides.`}
				onKeyDown={onKeyDown}
				onDoubleClick={flip}
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
				onDragPointer={onDragPointer}
			/>
		</div>
	);
};

/** The dashed line between the two marks of each gate. */
export const GateLines = ({marks}: {marks: Mark[]}) => {
	const gates = new Map<string, Mark[]>();
	for (const mark of marks) if (mark.gateId) gates.set(mark.gateId, [...(gates.get(mark.gateId) ?? []), mark]);
	return (
		<>
			{[...gates].map(([gateId, pair]) => {
				if (pair.length !== 2) return null;
				const a = toPx(pair[0]);
				const b = toPx(pair[1]);
				const length = Math.hypot(b.x - a.x, b.y - a.y);
				const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
				return <div key={gateId} className="gate-line" aria-hidden="true" style={{width: length, transform: `translate(${a.x}px, ${a.y}px) rotate(${angle}deg)`}} />;
			})}
		</>
	);
};

export default MarkMarker;
