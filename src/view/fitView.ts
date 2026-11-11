/**
 * Fit-to-view: the pan and zoom that fits everything on the water inside the
 * play area. Scenarios are laid out in pixels at 1:1 and can be far larger than
 * a laptop screen, so the play area scales its stage by this transform.
 */

import type {WorldState} from "../model/world";
import {lengthToPx, toPx} from "./scale";

/** An axis-aligned rectangle in stage pixels. */
export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** A stage transform: screen = stage * scale + (x, y). */
export interface ViewTransform {
	scale: number;
	x: number;
	y: number;
}

export const IDENTITY_VIEW: ViewTransform = {scale: 1, x: 0, y: 0};

/** Room kept around each boat, in stage pixels: enough for her tag stack and the rotation handle at any heading. */
const BOAT_MARGIN_PX = lengthToPx(1.6);

/** Room kept around each mark, in stage pixels: a little of the zone, not all of it. */
const MARK_MARGIN_PX = lengthToPx(1);

/** Never zoom in past 1:1, and never shrink past this. */
const MAX_SCALE = 1;
const MIN_SCALE = 0.35;

/** The stage-pixel rectangle that holds every boat, mark and obstruction, with margins. Null for an empty world. */
export function worldBoundsPx(world: WorldState): Rect | null {
	const boxes: Rect[] = [];
	const around = (cx: number, cy: number, r: number) => boxes.push({x: cx - r, y: cy - r, width: 2 * r, height: 2 * r});
	for (const boat of world.boats) {
		const c = toPx(boat);
		around(c.x, c.y, BOAT_MARGIN_PX);
	}
	for (const mark of world.marks) {
		const c = toPx(mark);
		around(c.x, c.y, MARK_MARGIN_PX);
	}
	for (const obstruction of world.obstructions) {
		const c = toPx(obstruction);
		around(c.x, c.y, lengthToPx(obstruction.radius) + 20);
	}
	if (boxes.length === 0) return null;
	const minX = Math.min(...boxes.map((b) => b.x));
	const minY = Math.min(...boxes.map((b) => b.y));
	const maxX = Math.max(...boxes.map((b) => b.x + b.width));
	const maxY = Math.max(...boxes.map((b) => b.y + b.height));
	return {x: minX, y: minY, width: maxX - minX, height: maxY - minY};
}

/**
 * The transform that fits `bounds` inside a `viewport` of the given size,
 * centred, without zooming in past 1:1. Returns the identity transform when
 * there is nothing to fit or the viewport has no size yet.
 */
export function fitView(bounds: Rect | null, viewport: {width: number; height: number}, padding = 16): ViewTransform {
	if (!bounds || viewport.width <= 0 || viewport.height <= 0) return IDENTITY_VIEW;
	const availW = Math.max(1, viewport.width - 2 * padding);
	const availH = Math.max(1, viewport.height - 2 * padding);
	const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(availW / bounds.width, availH / bounds.height)));
	const cx = bounds.x + bounds.width / 2;
	const cy = bounds.y + bounds.height / 2;
	return {scale, x: viewport.width / 2 - cx * scale, y: viewport.height / 2 - cy * scale};
}
