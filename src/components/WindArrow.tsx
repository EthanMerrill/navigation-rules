import React from "react";

interface WindArrowProps {
	/** Where the wind blows FROM, in degrees (0 = top of the screen, clockwise). */
	direction: number;
	onChange: (direction: number) => void;
	/** Size of the water, in screen pixels. */
	width: number;
	height: number;
}

const COMPASS_POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

/** "N", "NE", … for a direction in degrees. */
export function compassLabel(direction: number): string {
	return COMPASS_POINTS[Math.round(direction / 45) % 8];
}

/** Gap between the circle the arrow rides on and the edge of the water, in px. */
const EDGE_INSET_PX = 40;
/** Snap step while dragging, and the arrow-key step. Shift drags freely and steps 1°. */
const SNAP_DEG = 5;

/** Normalise to [0, 360). */
const norm = (deg: number) => ((Math.round(deg) % 360) + 360) % 360;

/** The wind direction (degrees FROM) of a point relative to the centre of the water. */
export function directionAt(dx: number, dy: number, snap: number): number {
	const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
	return norm(snap > 1 ? Math.round(deg / snap) * snap : deg);
}

/**
 * The wind control: an arrow that rides on a circle inside the water, sitting on
 * the side the wind comes FROM and pointing the way it blows. Drag it round the
 * circle (snaps to 5°, Shift for 1°), or focus it and use the arrow keys.
 */
const WindArrow = ({direction, onChange, width, height}: WindArrowProps) => {
	const [dragging, setDragging] = React.useState(false);
	const ref = React.useRef<HTMLDivElement>(null);
	if (width <= 0 || height <= 0) return null;

	const cx = width / 2;
	const cy = height / 2;
	const radius = Math.max(40, Math.min(width, height) / 2 - EDGE_INSET_PX);
	const rad = (direction * Math.PI) / 180;
	const at = {x: cx + radius * Math.sin(rad), y: cy - radius * Math.cos(rad)};
	// The readout sits just inside the circle, towards the middle of the water.
	const labelAt = {x: cx + (radius - 58) * Math.sin(rad), y: cy - (radius - 58) * Math.cos(rad)};

	const fromPointer = (e: React.PointerEvent) => {
		const area = ref.current?.offsetParent?.getBoundingClientRect();
		if (!area) return;
		const next = directionAt(e.clientX - area.left - cx, e.clientY - area.top - cy, e.shiftKey ? 1 : SNAP_DEG);
		if (next !== direction) onChange(next);
	};

	const onKeyDown = (e: React.KeyboardEvent) => {
		const step = e.shiftKey ? 1 : SNAP_DEG;
		const delta = e.key === "ArrowRight" || e.key === "ArrowUp" ? step : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -step : 0;
		if (delta === 0) return;
		e.preventDefault();
		onChange(norm(direction + delta));
	};

	return (
		<>
			<div
				className={`wind-circle${dragging ? " wind-circle--visible" : ""}`}
				aria-hidden="true"
				style={{width: radius * 2, height: radius * 2, transform: `translate(${cx - radius}px, ${cy - radius}px)`}}
			/>
			<div
				ref={ref}
				className={`wind-arrow${dragging ? " wind-arrow--dragging" : ""}`}
				role="slider"
				tabIndex={0}
				aria-label="Wind direction"
				aria-valuemin={0}
				aria-valuemax={359}
				aria-valuenow={direction}
				aria-valuetext={`Wind from ${compassLabel(direction)}, ${direction} degrees`}
				title="Drag around the circle to change the wind (hold Shift for single degrees)"
				onKeyDown={onKeyDown}
				onPointerDown={(e) => {
					e.currentTarget.setPointerCapture(e.pointerId);
					setDragging(true);
				}}
				onPointerMove={(e) => dragging && fromPointer(e)}
				onPointerUp={(e) => {
					e.currentTarget.releasePointerCapture(e.pointerId);
					setDragging(false);
				}}
				onPointerCancel={() => setDragging(false)}
				style={{transform: `translate(${at.x}px, ${at.y}px) rotate(${direction + 180}deg)`}}>
				<svg viewBox="0 0 40 72" width="40" height="72" aria-hidden="true">
					<path className="wind-arrow__body" d="M15 68 V30 H5 L20 4 L35 30 H25 V68 Q25 71 22 71 H18 Q15 71 15 68 Z" />
				</svg>
			</div>
			<div className={`wind-readout${dragging ? " wind-readout--dragging" : ""}`} aria-hidden="true" style={{transform: `translate(${labelAt.x}px, ${labelAt.y}px) translate(-50%, -50%)`}}>
				<span className="wind-readout__label">Wind</span> {compassLabel(direction)} {String(direction).padStart(3, "0")}°
			</div>
		</>
	);
};

export default WindArrow;
