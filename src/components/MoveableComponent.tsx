import React from "react";
import Moveable, {OnDrag, OnRotate} from "react-moveable";

interface iMovableComponentProps {
	moveRef: React.RefObject<HTMLDivElement | null>;
	/** Called on drag with the current translate [x, y] of the target's top-left. */
	onDrag: (x: number, y: number) => void;
	/** Called on rotate with the current rotation in degrees. */
	onRotate: (rotation: number) => void;
}

const MovableComponent = ({moveRef, onDrag, onRotate}: iMovableComponentProps) => {
	const [renderMovable, setRenderMovable] = React.useState(false);

	React.useEffect(() => {
		setRenderMovable(true);
	}, []);

	const handleDrag = (e: OnDrag) => {
		onDrag(e.translate[0], e.translate[1]);
	};

	const handleRotate = (e: OnRotate) => {
		onRotate(e.rotate);
	};

	if (!renderMovable) return null;

	return <Moveable className="moveable-controls" target={moveRef.current} draggable={true} throttleDrag={0} onDrag={handleDrag} rotatable={true} onRotate={handleRotate} renderDirections={[]} />;
};

export default MovableComponent;
