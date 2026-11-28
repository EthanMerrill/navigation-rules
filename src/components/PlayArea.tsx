import React from "react";
import type {WorldState} from "../model/world";
import WindArrow from "./WindArrow";
import {toWorld, type Vec2} from "../view/scale";

/** What the play area lets the rest of the app ask about the water. */
export interface PlayAreaApi {
	/** The world point under a screen point, or null when the point is not over the water. */
	clientToWorld: (clientX: number, clientY: number) => Vec2 | null;
	/** The world point at the middle of the visible water. */
	centreWorld: () => Vec2;
	/** Current zoom (stage px → screen px). */
	scale: () => number;
}
import {IDENTITY_VIEW, ViewTransform, fitView, worldBoundsPx} from "../view/fitView";
import {ViewContext} from "../view/ViewContext";

interface PlayAreaProps {
	world: WorldState;
	/** Changes whenever a scenario is (re)loaded; the view refits then. */
	fitKey: number;
	onWindChange: (direction: number) => void;
	/** Called with true when the pointer goes down anywhere on the water and false when it is released. */
	onPointerHeldChange?: (held: boolean) => void;
	/** Filled in with the play area's `PlayAreaApi`. */
	apiRef?: React.RefObject<PlayAreaApi | null>;
	children: React.ReactNode;
}

/**
 * The water: a clipped area to the right of the sidebar and below the controls.
 * Everything on it is drawn in stage pixels on a scaled, translated stage that
 * fits the whole scene. The view refits when a scenario loads, when the window
 * resizes, or on request, but not while boats are being dragged, so the water
 * never moves under the pointer.
 */
const PlayArea = ({world, fitKey, onWindChange, onPointerHeldChange, apiRef, children}: PlayAreaProps) => {
	const areaRef = React.useRef<HTMLDivElement>(null);
	const [size, setSize] = React.useState({width: 0, height: 0});
	const [view, setView] = React.useState<ViewTransform>(IDENTITY_VIEW);
	// The latest world, read when refitting without making every drag refit.
	const worldRef = React.useRef(world);
	worldRef.current = world;

	React.useLayoutEffect(() => {
		const el = areaRef.current;
		if (!el) return;
		const measure = () => setSize({width: el.clientWidth, height: el.clientHeight});
		measure();
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	const viewState = React.useMemo(() => ({...view, viewportWidth: size.width, viewportHeight: size.height}), [view, size]);

	const refit = React.useCallback(() => setView(fitView(worldBoundsPx(worldRef.current), size)), [size]);

	React.useLayoutEffect(refit, [refit, fitKey]);

	React.useImperativeHandle(
		apiRef,
		() => ({
			clientToWorld: (clientX, clientY) => {
				const rect = areaRef.current?.getBoundingClientRect();
				if (!rect || clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
				return toWorld({x: (clientX - rect.left - view.x) / view.scale, y: (clientY - rect.top - view.y) / view.scale});
			},
			centreWorld: () => toWorld({x: (size.width / 2 - view.x) / view.scale, y: (size.height / 2 - view.y) / view.scale}),
			scale: () => view.scale,
		}),
		[view, size],
	);

	// The pointer counts as held from a press on the water until it is released anywhere.
	const onPointerDownCapture = () => {
		if (!onPointerHeldChange) return;
		onPointerHeldChange(true);
		const release = () => {
			onPointerHeldChange(false);
			window.removeEventListener("pointerup", release);
			window.removeEventListener("pointercancel", release);
		};
		window.addEventListener("pointerup", release);
		window.addEventListener("pointercancel", release);
	};

	return (
		<main className="play-area" ref={areaRef} aria-label="Race area" onPointerDownCapture={onPointerDownCapture}>
			<div className="patterns pt1" aria-hidden="true" />
			<ViewContext.Provider value={viewState}>
				<div className="play-area__stage" style={{transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`}}>
					{children}
				</div>
			</ViewContext.Provider>
			<WindArrow direction={world.wind.direction} onChange={onWindChange} width={size.width} height={size.height} />
			<p className="play-area__hint">
				Drag a boat to move her; turn her with the <span aria-hidden="true">↻</span> handle or the arrow keys. Drag the wind arrow round the circle.
			</p>
			<button type="button" className="reset-button play-area__fit" onClick={refit} title="Zoom to fit every boat, mark and obstruction">
				Fit to view
			</button>
		</main>
	);
};

export default PlayArea;
