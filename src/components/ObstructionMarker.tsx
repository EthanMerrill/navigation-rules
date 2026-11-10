import React from "react";
import MoveableComponent from "./MoveableComponent";
import type {Obstruction} from "../model/world";
import type {WorldAction} from "../state/worldReducer";
import {lengthToPx, toPx, toWorld} from "../view/scale";

interface ObstructionMarkerProps {
	obstruction: Obstruction;
	dispatch: React.Dispatch<WorldAction>;
}

/** An obstruction: a grey filled circle of its radius, draggable. */
const ObstructionMarker = ({obstruction, dispatch}: ObstructionMarkerProps) => {
	const moveRef = React.useRef<HTMLDivElement>(null);
	const center = toPx(obstruction);
	const radiusPx = lengthToPx(obstruction.radius);

	return (
		<div>
			<div
				className="obstruction-marker"
				ref={moveRef}
				role="img"
				aria-label={`Obstruction ${obstruction.id}`}
				style={{width: radiusPx * 2, height: radiusPx * 2, transform: `translate(${center.x - radiusPx}px, ${center.y - radiusPx}px)`}}
			/>
			<MoveableComponent
				moveRef={moveRef}
				onDrag={(x, y) => {
					const next = toWorld({x: x + radiusPx, y: y + radiusPx});
					dispatch({type: "moveObstruction", id: obstruction.id, x: next.x, y: next.y});
				}}
			/>
		</div>
	);
};

export default ObstructionMarker;
