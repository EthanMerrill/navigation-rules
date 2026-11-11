import React from "react";
import type {WorldState} from "../model/world";
import {IDENTITY_VIEW, ViewTransform, fitView, worldBoundsPx} from "../view/fitView";
import {ViewContext} from "../view/ViewContext";

interface PlayAreaProps {
	world: WorldState;
	/** Changes whenever a scenario is (re)loaded; the view refits then. */
	fitKey: number;
	children: React.ReactNode;
}

/**
 * The water: a clipped area to the right of the sidebar and below the controls.
 * Everything on it is drawn in stage pixels on a scaled, translated stage that
 * fits the whole scene. The view refits when a scenario loads, when the window
 * resizes, or on request, but not while boats are being dragged, so the water
 * never moves under the pointer.
 */
const PlayArea = ({world, fitKey, children}: PlayAreaProps) => {
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

	const refit = React.useCallback(() => setView(fitView(worldBoundsPx(worldRef.current), size)), [size]);

	React.useLayoutEffect(refit, [refit, fitKey]);

	return (
		<main className="play-area" ref={areaRef} aria-label="Race area">
			<div className="patterns pt1" aria-hidden="true" />
			<ViewContext.Provider value={view}>
				<div className="play-area__stage" style={{transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`}}>
					{children}
				</div>
			</ViewContext.Provider>
			<p className="play-area__hint">
				Drag a boat to move it. Drag the <span aria-hidden="true">↻</span> handle at her bow to turn her, or select her and use the arrow keys.
			</p>
			<button type="button" className="reset-button play-area__fit" onClick={refit} title="Zoom to fit every boat, mark and obstruction">
				Fit to view
			</button>
		</main>
	);
};

export default PlayArea;
