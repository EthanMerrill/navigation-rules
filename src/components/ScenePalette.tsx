import React from "react";
import {createPortal} from "react-dom";
import PrototypeBoat from "../assets/PrototypeBoat.svg";
import {GATE_HALF_WIDTH, type AddableMarkKind} from "../state/worldReducer";
import {HULL_IMAGE_H_PX, HULL_IMAGE_W_PX, PX_PER_HULL_LENGTH, WRAPPER_H_PX, type Vec2} from "../view/scale";
import {MARK_SIZE_PX, ZONE_RADIUS_HULL_LENGTHS} from "./MarkMarker";
import type {PlayAreaApi} from "./PlayArea";

/** Things the tray can add to the water. */
export type PaletteItemKind = "boat" | AddableMarkKind;

interface ScenePaletteProps {
	/** Where the wind blows from, to lay a gate across it and show a new boat's heading. */
	windDirection: number;
	playArea: React.RefObject<PlayAreaApi | null>;
	/** Add an item centred at a world point. */
	onAdd: (kind: PaletteItemKind, at: Vec2) => void;
	/** Set while a boat or mark on the water is being dragged: the tray turns into a drop target that removes it. */
	removal: {overTray: boolean} | null;
	trayRef: React.RefObject<HTMLDivElement | null>;
}

const ITEMS: Array<{kind: PaletteItemKind; label: string; hint: string}> = [
	{kind: "boat", label: "Boat", hint: "Drag a boat onto the water (or click to add one in the middle)"},
	{kind: "rounding", label: "Mark", hint: "Drag a mark onto the water; it is left to port (double-click it to switch)"},
	{kind: "start", label: "Start", hint: "Drag a start mark onto the water; Rule 18 does not apply at a start mark"},
	{kind: "gate", label: "Gate", hint: "Drag a gate onto the water: two marks across the wind; Rule 18.4 does not apply at a gate"},
];

/** Movement (px) below which a press on a tray item is a click, not a drag. */
const DRAG_THRESHOLD_PX = 4;
/** Ghost scale while it is over the tray rather than the water. */
const ICON_SCALE = 0.3;

/** Heading for a new boat: a beam reach, wind over her port side. */
export function newBoatHeading(windDirection: number): number {
	return (windDirection + 90) % 360;
}

/**
 * The "Add" tray under the scenario picker. Drag an item onto the water and it
 * grows to its real size under the pointer, landing where it is dropped; click
 * (or press Enter) to drop one in the middle of the water. While a boat or mark
 * on the water is being dragged, the tray becomes a drop target that removes it.
 */
const ScenePalette = ({windDirection, playArea, onAdd, removal, trayRef}: ScenePaletteProps) => {
	const [ghost, setGhost] = React.useState<{kind: PaletteItemKind; x: number; y: number; overWater: boolean} | null>(null);
	const press = React.useRef<{kind: PaletteItemKind; x: number; y: number; dragging: boolean} | null>(null);

	const addAtCentre = (kind: PaletteItemKind) => {
		const centre = playArea.current?.centreWorld();
		if (centre) onAdd(kind, centre);
	};

	const itemProps = (kind: PaletteItemKind) => ({
		onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
			if (e.button !== 0) return;
			try {
				e.currentTarget.setPointerCapture(e.pointerId);
			} catch {
				// Not captured: the drag still tracks while the pointer is over the button.
			}
			press.current = {kind, x: e.clientX, y: e.clientY, dragging: false};
		},
		onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
			const p = press.current;
			if (!p) return;
			if (!p.dragging && Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_THRESHOLD_PX) return;
			p.dragging = true;
			setGhost({kind, x: e.clientX, y: e.clientY, overWater: playArea.current?.clientToWorld(e.clientX, e.clientY) != null});
		},
		onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
			const p = press.current;
			press.current = null;
			setGhost(null);
			if (!p) return;
			if (!p.dragging) return addAtCentre(kind);
			const at = playArea.current?.clientToWorld(e.clientX, e.clientY);
			if (at) onAdd(kind, at);
		},
		onPointerCancel: () => {
			press.current = null;
			setGhost(null);
		},
		// Pointer presses are handled above; a click with no pointer behind it (detail 0) is the keyboard.
		onClick: (e: React.MouseEvent) => {
			if (e.detail === 0) addAtCentre(kind);
		},
	});

	const className = ["palette", removal ? "palette--removal" : "", removal?.overTray ? "palette--removal-over" : ""].filter(Boolean).join(" ");

	return (
		<div className={className} ref={trayRef}>
			<span className="control-label">Add</span>
			<div className="palette__items">
				{ITEMS.map(({kind, label, hint}) => (
					<button key={kind} type="button" className="palette__item" title={hint} aria-label={`Add ${label.toLowerCase()}`} {...itemProps(kind)}>
						<PaletteIcon kind={kind} />
						<span>{label}</span>
					</button>
				))}
			</div>
			<span className="palette__remove" aria-hidden={!removal}>
				<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
					<path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
				Drop here to remove
			</span>
			{ghost && createPortal(<Ghost {...ghost} scale={playArea.current?.scale() ?? 1} windDirection={windDirection} />, document.body)}
		</div>
	);
};

/** The small icon for a tray item. */
const PaletteIcon = ({kind}: {kind: PaletteItemKind}) => {
	if (kind === "boat")
		return (
			<svg className="palette__boat" viewBox="0 0 28 12" width="24" height="11" aria-hidden="true">
				<path d="M1.5 1.5 H16 Q24 1.5 26.5 6 Q24 10.5 16 10.5 H1.5 Z" />
			</svg>
		);
	if (kind === "gate")
		return (
			<span className="palette__gate" aria-hidden="true">
				<span className="palette__mark" />
				<span className="palette__mark" />
			</span>
		);
	return <span className={`palette__mark${kind === "start" ? " palette__mark--start" : ""}`} aria-hidden="true" />;
};

/** What follows the pointer while an item is dragged from the tray: icon-sized over the tray, real size over the water. */
const Ghost = ({kind, x, y, overWater, scale, windDirection}: {kind: PaletteItemKind; x: number; y: number; overWater: boolean; scale: number; windDirection: number}) => {
	const zonePx = ZONE_RADIUS_HULL_LENGTHS * PX_PER_HULL_LENGTH;
	const mark = (dx: number, dy: number, start = false, key?: string) => (
		<React.Fragment key={key}>
			{!start && <span className="ghost__zone" style={{width: zonePx * 2, height: zonePx * 2, left: dx - zonePx, top: dy - zonePx}} />}
			<span className={`ghost__mark${start ? " ghost__mark--start" : ""}`} style={{width: MARK_SIZE_PX, height: MARK_SIZE_PX, left: dx - MARK_SIZE_PX / 2, top: dy - MARK_SIZE_PX / 2}} />
		</React.Fragment>
	);

	let body: React.ReactNode;
	if (kind === "boat") {
		// The boat's centre is the middle of her 200px wrapper; the hull image is top-aligned in it.
		body = (
			<img
				className="ghost__boat"
				src={PrototypeBoat}
				alt=""
				style={{width: HULL_IMAGE_W_PX, height: HULL_IMAGE_H_PX, left: -HULL_IMAGE_W_PX / 2, top: -WRAPPER_H_PX / 2, transformOrigin: `50% ${WRAPPER_H_PX / 2}px`, transform: `rotate(${newBoatHeading(windDirection)}deg)`}}
			/>
		);
	} else if (kind === "gate") {
		const left = ((windDirection + 90) * Math.PI) / 180;
		const dx = Math.sin(left) * GATE_HALF_WIDTH * PX_PER_HULL_LENGTH;
		const dy = -Math.cos(left) * GATE_HALF_WIDTH * PX_PER_HULL_LENGTH;
		body = [mark(dx, dy, false, "a"), mark(-dx, -dy, false, "b")];
	} else {
		body = mark(0, 0, kind === "start");
	}

	return (
		<div className={`ghost${overWater ? " ghost--over-water" : ""}`} aria-hidden="true" style={{transform: `translate(${x}px, ${y}px)`}}>
			<div className="ghost__body" style={{transform: `scale(${overWater ? scale : ICON_SCALE})`}}>
				{body}
			</div>
		</div>
	);
};

export default ScenePalette;
