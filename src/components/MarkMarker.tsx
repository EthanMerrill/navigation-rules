import React from "react";
import MoveableComponent from "./MoveableComponent";
import type {Mark} from "../model/world";
import type {WorldAction} from "../state/worldReducer";
import {lengthToPx, toPx, toWorld} from "../view/scale";

/** Radius of the mark-room zone, in hull lengths (Rule 18). */
export const ZONE_RADIUS_HULL_LENGTHS = 3;

/** Diameter in pixels of the mark's own circle. */
export const MARK_SIZE_PX = 28;

/** Size in stage px of a start line's committee boat (bow up, before she swings to the wind) and pin. */
export const COMMITTEE_BOAT_PX = {width: 24, height: 56};
export const PIN_PX = 22;

/** The size in stage px of a mark's draggable body. */
function bodySize(mark: Mark): {width: number; height: number} {
	if (mark.startEnd === "committee") return COMMITTEE_BOAT_PX;
	if (mark.startEnd === "pin") return {width: PIN_PX, height: PIN_PX};
	return {width: MARK_SIZE_PX, height: MARK_SIZE_PX};
}

/** A committee boat seen from above, bow up, with an orange flag. */
export const CommitteeBoatShape = () => (
	<svg className="committee-boat" viewBox="0 0 24 56" width="100%" height="100%" aria-hidden="true">
		<path className="committee-boat__hull" d="M12 1.5 Q22 13 22 25 V51 Q22 54.5 18.5 54.5 H5.5 Q2 54.5 2 51 V25 Q2 13 12 1.5 Z" />
		<rect className="committee-boat__cabin" x="6" y="25" width="12" height="15" rx="2" />
		<rect className="committee-boat__flag" x="12" y="13" width="8" height="6" rx="1" />
		<path className="committee-boat__mast" d="M12 12 V25" />
	</svg>
);

interface MarkMarkerProps {
	mark: Mark;
	dispatch: React.Dispatch<WorldAction>;
	/** Where the wind blows from: a committee boat lies bow to the wind, like a boat at anchor. */
	windDirection: number;
	/** Pointer position while the mark is dragged (see `MoveableComponent`). */
	onDragPointer?: (clientX: number, clientY: number, ended: boolean) => void;
}

function labelOf(mark: Mark): string {
	if (mark.startEnd === "committee") return "Committee boat (starboard end of the start line)";
	if (mark.startEnd === "pin") return "Pin (port end of the start line)";
	return KIND_LABEL[mark.kind];
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
 * left on, and a dashed circle for the three-hull-length zone. The ends of a
 * start line are a committee boat and a pin, with no zone (Rule 18 does not
 * apply at a start mark) and no side to switch. Marks are draggable; select
 * one and press S (or double-click it) to switch the side, Delete to remove it.
 */
const MarkMarker = ({mark, dispatch, windDirection, onDragPointer}: MarkMarkerProps) => {
	const moveRef = React.useRef<HTMLDivElement>(null);
	const center = toPx(mark);
	const zonePx = lengthToPx(ZONE_RADIUS_HULL_LENGTHS);
	const size = bodySize(mark);
	const lineEnd = mark.startEnd !== undefined;
	const flip = () => !lineEnd && dispatch({type: "flipMarkSide", id: mark.id});
	const rotation = mark.startEnd === "committee" ? ` rotate(${windDirection}deg)` : "";

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Delete" || e.key === "Backspace") {
			e.preventDefault();
			dispatch({type: "removeMark", id: mark.id});
		} else if (!lineEnd && (e.key === "s" || e.key === "S")) {
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
				className={`mark-marker mark-marker--${mark.startEnd ?? mark.kind}`}
				ref={moveRef}
				tabIndex={0}
				role="group"
				aria-roledescription="mark"
				aria-label={lineEnd ? `${labelOf(mark)} ${mark.id}. Delete removes the start line.` : `${labelOf(mark)} ${mark.id}, to be left to ${mark.roundingSide}. Press S to switch sides; Delete removes it.`}
				title={lineEnd ? labelOf(mark) : `${labelOf(mark)}, left to ${mark.roundingSide}. Double-click to switch sides.`}
				onKeyDown={onKeyDown}
				onDoubleClick={flip}
				style={{width: size.width, height: size.height, transform: `translate(${center.x - size.width / 2}px, ${center.y - size.height / 2}px)${rotation}`}}>
				{mark.startEnd === "committee" ? (
					<CommitteeBoatShape />
				) : mark.startEnd === "pin" ? null : (
					// The chevron points up the course with the mark kept on the named side:
					// leave to port → boats pass with it on their left, so it sits left of a boat heading up.
					<span className={`mark-marker__arrow mark-marker__arrow--${mark.roundingSide}`}>{mark.roundingSide === "port" ? "↶" : "↷"}</span>
				)}
			</div>
			<MoveableComponent
				moveRef={moveRef}
				onDrag={(x, y) => {
					const next = toWorld({x: x + size.width / 2, y: y + size.height / 2});
					dispatch({type: "moveMark", id: mark.id, x: next.x, y: next.y});
				}}
				onDragPointer={onDragPointer}
			/>
		</div>
	);
};

/** The line between the two marks of each gate (dashed) and each start line (the line itself). */
export const PairLines = ({marks}: {marks: Mark[]}) => {
	const pairs = new Map<string, Mark[]>();
	for (const mark of marks) if (mark.pairId) pairs.set(mark.pairId, [...(pairs.get(mark.pairId) ?? []), mark]);
	return (
		<>
			{[...pairs].map(([pairId, pair]) => {
				if (pair.length !== 2) return null;
				const a = toPx(pair[0]);
				const b = toPx(pair[1]);
				const length = Math.hypot(b.x - a.x, b.y - a.y);
				const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
				const className = pair[0].kind === "start" ? "start-line" : "gate-line";
				return <div key={pairId} className={className} aria-hidden="true" style={{width: length, transform: `translate(${a.x}px, ${a.y}px) rotate(${angle}deg)`}} />;
			})}
		</>
	);
};

export default MarkMarker;
