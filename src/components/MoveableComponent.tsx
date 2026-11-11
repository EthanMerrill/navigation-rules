import React from "react";
import Moveable, {OnDrag, OnRotate} from "react-moveable";
import {ViewContext} from "../view/ViewContext";

interface iMovableComponentProps {
	moveRef: React.RefObject<HTMLDivElement | null>;
	/** Called on drag with the current translate [x, y] of the target's top-left. */
	onDrag: (x: number, y: number) => void;
	/** Called on rotate with the current rotation in whole degrees; omit for a drag-only target. */
	onRotate?: (rotation: number) => void;
	/** Called when a rotation gesture starts and ends, so the target can show a live heading readout. */
	onRotatingChange?: (rotating: boolean) => void;
}

/**
 * react-moveable drag (and optionally rotate) handles for a target. The
 * transform-origin dot is hidden, the handles are counter-scaled by the play
 * area's zoom so they stay the same size on screen, and they re-measure the
 * target after every render so they never lag behind it.
 */
const MovableComponent = ({moveRef, onDrag, onRotate, onRotatingChange}: iMovableComponentProps) => {
	const [renderMovable, setRenderMovable] = React.useState(false);
	const view = React.useContext(ViewContext);
	const moveableRef = React.useRef<Moveable>(null);

	React.useEffect(() => {
		setRenderMovable(true);
	}, []);

	// Moveable only measures its target on mount and during its own gestures. The
	// target also moves when the world changes (scenario load, keyboard turns, the
	// rules engine) and when the play area refits, so re-measure after every render.
	React.useLayoutEffect(() => {
		moveableRef.current?.updateRect();
	});

	const handleDrag = (e: OnDrag) => {
		onDrag(e.translate[0], e.translate[1]);
	};

	const handleRotate = (e: OnRotate) => {
		onRotate?.(((Math.round(e.rotate) % 360) + 360) % 360);
	};

	if (!renderMovable) return null;

	return (
		<Moveable
			ref={moveableRef}
			className="moveable-controls"
			target={moveRef.current}
			zoom={1 / view.scale}
			origin={false}
			draggable={true}
			throttleDrag={0}
			onDrag={handleDrag}
			rotatable={onRotate !== undefined}
			rotationPosition="top"
			throttleRotate={1}
			onRotateStart={() => onRotatingChange?.(true)}
			onRotate={handleRotate}
			onRotateEnd={() => onRotatingChange?.(false)}
			renderDirections={[]}
		/>
	);
};

export default MovableComponent;
