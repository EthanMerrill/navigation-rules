import type React from "react";
import {useRef, useState} from "react";

/** Height of the closed sheet (keep in step with `.rules-sidebar` max-height in the narrow-screen CSS). */
export const SHEET_CLOSED_PX = 54;
/** Height of the open sheet, as a fraction of the window (keep in step with `.rules-sidebar--sheet-open`). */
export const SHEET_OPEN_FRACTION = 0.65;
/** Capture (or release) the pointer so the drag keeps tracking outside the handle; best effort, since it throws for a pointer that is no longer active. */
function capture(e: React.PointerEvent<HTMLElement>, on: boolean) {
	try {
		if (on) e.currentTarget.setPointerCapture?.(e.pointerId);
		else e.currentTarget.releasePointerCapture?.(e.pointerId);
	} catch {
		// Not captured: the drag still works while the pointer stays over the handle.
	}
}

/** A movement shorter than this is a tap, not a drag. */
const DRAG_THRESHOLD_PX = 6;
/** A flick faster than this (px/ms) opens or closes the sheet whatever its height. */
const FLICK_SPEED = 0.4;

interface SheetDrag {
	/** The sheet's height while it is being dragged; null otherwise (the CSS decides). */
	dragHeight: number | null;
	/** Spread onto the sheet's handle. */
	handleProps: {
		onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
		onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
		onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
		onPointerCancel: () => void;
		onClick: (e: React.MouseEvent<HTMLElement>) => void;
	};
}

/**
 * Drag-to-open for a bottom sheet. The sheet follows the pointer while the
 * handle is dragged, then snaps open or shut: a quick flick goes the way it was
 * flicked, otherwise it goes to whichever state is nearer. A tap toggles, and
 * so does Enter or Space on the focused handle.
 *
 * @param sheetRef The sheet element, to read its height when a drag starts.
 */
export function useSheetDrag(sheetRef: React.RefObject<HTMLElement | null>, open: boolean, setOpen: (open: boolean) => void): SheetDrag {
	const [dragHeight, setDragHeight] = useState<number | null>(null);
	const drag = useRef<{startY: number; startHeight: number; moved: boolean; lastY: number; lastT: number; velocity: number} | null>(null);

	const openPx = () => Math.max(SHEET_CLOSED_PX, window.innerHeight * SHEET_OPEN_FRACTION);

	return {
		dragHeight,
		handleProps: {
			onPointerDown: (e) => {
				if (e.button !== 0) return;
				capture(e, true);
				const height = sheetRef.current?.getBoundingClientRect().height || (open ? openPx() : SHEET_CLOSED_PX);
				drag.current = {startY: e.clientY, startHeight: height, moved: false, lastY: e.clientY, lastT: e.timeStamp, velocity: 0};
			},
			onPointerMove: (e) => {
				const d = drag.current;
				if (!d) return;
				const dy = d.startY - e.clientY;
				if (!d.moved && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
				d.moved = true;
				const dt = e.timeStamp - d.lastT;
				// Upward speed in px/ms, smoothed so one jittery sample does not decide a flick.
				if (dt > 0) d.velocity = 0.6 * ((d.lastY - e.clientY) / dt) + 0.4 * d.velocity;
				d.lastY = e.clientY;
				d.lastT = e.timeStamp;
				setDragHeight(Math.min(openPx(), Math.max(SHEET_CLOSED_PX, d.startHeight + dy)));
			},
			onPointerUp: (e) => {
				const d = drag.current;
				drag.current = null;
				capture(e, false);
				if (!d) return;
				if (!d.moved) {
					setOpen(!open);
				} else {
					const height = Math.min(openPx(), Math.max(SHEET_CLOSED_PX, d.startHeight + d.startY - e.clientY));
					if (d.velocity > FLICK_SPEED) setOpen(true);
					else if (d.velocity < -FLICK_SPEED) setOpen(false);
					else setOpen(height > (SHEET_CLOSED_PX + openPx()) / 2);
				}
				setDragHeight(null);
			},
			onPointerCancel: () => {
				drag.current = null;
				setDragHeight(null);
			},
			// Pointer taps are handled on pointer-up; a click with no pointer behind it (detail 0) is the keyboard.
			onClick: (e) => {
				if (e.detail === 0) setOpen(!open);
			},
		},
	};
}
