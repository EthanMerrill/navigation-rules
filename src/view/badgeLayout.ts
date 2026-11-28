/**
 * Badge layout: where to put each boat's badge so it covers neither another
 * badge nor a hull. A greedy candidate placement (the same strategy as
 * d3fc-label-layout's `layoutGreedy`): each badge has a few candidate spots
 * around its boat, in order of preference, and takes the one that overlaps
 * least with what is already placed. A small bias towards the spot a badge had
 * last time keeps badges from jumping about while boats are dragged.
 *
 * All geometry is in stage pixels.
 */

import {HULL_IMAGE_H_PX, WRAPPER_H_PX, type Vec2} from "./scale";

/** Where a badge sits relative to its boat. */
export type BadgeSide = "aft" | "portQuarter" | "starboardQuarter" | "port" | "starboard" | "bow";

/** Candidate spots, most preferred first. */
export const BADGE_SIDES: BadgeSide[] = ["aft", "portQuarter", "starboardQuarter", "port", "starboard", "bow"];

export interface BadgeItem {
	id: string;
	/** Boat centre. */
	centre: Vec2;
	/** Heading in degrees, 0 = up. */
	heading: number;
	width: number;
	height: number;
}

export interface Circle {
	x: number;
	y: number;
	r: number;
}

export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface BadgePlacement extends Rect {
	side: BadgeSide;
	/** Which edge the badge's lines line up on: the one nearest the boat. */
	align: "flex-start" | "flex-end" | "center";
}

/** Gap between a hull and its badge. */
const GAP_PX = 10;
/** Distance from the boat's centre to her stern (the hull is top-aligned in its wrapper) and to her bow. */
const STERN_PX = HULL_IMAGE_H_PX - WRAPPER_H_PX / 2;
const BOW_PX = WRAPPER_H_PX / 2;
/** Half the hull's beam. */
const HALF_BEAM_PX = 40;

/** Anchor of each side as (forward, starboard) offsets from the boat's centre. */
const SIDE_OFFSETS: Record<BadgeSide, [number, number]> = {
	aft: [-(STERN_PX + GAP_PX), 0],
	portQuarter: [-STERN_PX * 0.6, -(HALF_BEAM_PX + GAP_PX)],
	starboardQuarter: [-STERN_PX * 0.6, HALF_BEAM_PX + GAP_PX],
	port: [BOW_PX * 0.2, -(HALF_BEAM_PX + GAP_PX)],
	starboard: [BOW_PX * 0.2, HALF_BEAM_PX + GAP_PX],
	// Past the rotation handle at the bow (at 1:1; the handle itself is avoided at any zoom).
	bow: [BOW_PX + 70, 0],
};

/** Each later candidate costs this fraction of the badge's area. */
const PREFERENCE_COST = 0.015;
/**
 * Leaving last frame's spot costs this fraction of the badge's area: enough to
 * stop a badge flickering between two spots that overlap about equally, but
 * less than one step of preference, so a badge returns to the stern once it is clear.
 */
const MOVE_COST = 0.01;
/** Overlapping a hull is worse than overlapping another badge, which can at least still be read. */
const HULL_WEIGHT = 1.5;
/** Running off the screen is as bad as covering a hull. */
const OFFSCREEN_WEIGHT = 1.5;

const forwardOf = (heading: number): Vec2 => {
	const rad = (heading * Math.PI) / 180;
	return {x: Math.sin(rad), y: -Math.cos(rad)};
};

/** Circles approximating a hull, bow to stern. */
export function hullCircles(centre: Vec2, heading: number): Circle[] {
	const f = forwardOf(heading);
	return [55, 10, -35].map((along) => ({x: centre.x + f.x * along, y: centre.y + f.y * along, r: 36}));
}

/** The badge rectangle for one side: the edge (or corner) facing the boat touches the side's anchor. */
export function placeOnSide(item: BadgeItem, side: BadgeSide): BadgePlacement {
	const f = forwardOf(item.heading);
	const stbd = {x: -f.y, y: f.x};
	const [along, across] = SIDE_OFFSETS[side];
	const anchor = {x: item.centre.x + f.x * along + stbd.x * across, y: item.centre.y + f.y * along + stbd.y * across};
	const dx = anchor.x - item.centre.x;
	const dy = anchor.y - item.centre.y;
	const n = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
	const ux = dx / n;
	const uy = dy / n;
	return {
		side,
		x: anchor.x + item.width * (-0.5 + 0.5 * ux),
		y: anchor.y + item.height * (-0.5 + 0.5 * uy),
		width: item.width,
		height: item.height,
		align: ux < -0.4 ? "flex-end" : ux > 0.4 ? "flex-start" : "center",
	};
}

/** Area of the intersection of two rectangles. */
export function overlapArea(a: Rect, b: Rect): number {
	const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
	const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
	return w > 0 && h > 0 ? w * h : 0;
}

/** The rotation handle's distance past the bow and its radius, in screen px (react-moveable counter-scales it). */
const HANDLE_OFFSET_SCREEN_PX = 41;
const HANDLE_RADIUS_SCREEN_PX = 21;

/** The rotation handle off a boat's bow, at view scale `scale`. `r` is sized so the inscribed square covers the handle. */
export function handleCircle(centre: Vec2, heading: number, scale = 1): Circle {
	const f = forwardOf(heading);
	const along = BOW_PX + HANDLE_OFFSET_SCREEN_PX / scale;
	return {x: centre.x + f.x * along, y: centre.y + f.y * along, r: (HANDLE_RADIUS_SCREEN_PX * Math.SQRT2) / scale};
}

/** Move a rectangle the least distance that puts it inside `bounds` (as far as it fits). */
function nudgeInside<T extends Rect>(rect: T, bounds: Rect): T {
	const clamp = (v: number, size: number, lo: number, extent: number) => (size >= extent ? lo : Math.min(Math.max(v, lo), lo + extent - size));
	return {...rect, x: clamp(rect.x, rect.width, bounds.x, bounds.width), y: clamp(rect.y, rect.height, bounds.y, bounds.height)};
}

/** Approximate overlap of a rectangle and a circle: the rectangle against the square inscribed in the circle. */
function circleOverlap(rect: Rect, c: Circle): number {
	const half = c.r * Math.SQRT1_2;
	return overlapArea(rect, {x: c.x - half, y: c.y - half, width: 2 * half, height: 2 * half});
}

/**
 * Place every badge. Items are placed in the order given, each avoiding the
 * badges placed before it, every hull and rotation handle, and `obstacles`
 * (marks, obstructions).
 *
 * @param previous Last placement's side per badge id, for stability.
 * @param scale The view scale (stage px → screen px), for the counter-scaled rotation handles.
 * @param visible The part of the stage on screen: spots that run off it cost
 *   the area that is cut off, and the chosen spot is nudged back inside.
 */
export function layoutBadges(items: BadgeItem[], obstacles: Circle[] = [], previous: Record<string, BadgeSide> = {}, scale = 1, visible?: Rect): Record<string, BadgePlacement> {
	const hulls = items.flatMap((item) => [...hullCircles(item.centre, item.heading), handleCircle(item.centre, item.heading, scale)]);
	const avoid = [...hulls, ...obstacles];
	const placed: Rect[] = [];
	const result: Record<string, BadgePlacement> = {};

	for (const item of items) {
		const area = item.width * item.height;
		let best: BadgePlacement | null = null;
		let bestCost = Infinity;
		BADGE_SIDES.forEach((side, index) => {
			const rect = placeOnSide(item, side);
			let cost = index * PREFERENCE_COST * area;
			if (previous[item.id] !== undefined && previous[item.id] !== side) cost += MOVE_COST * area;
			for (const other of placed) cost += overlapArea(rect, other);
			for (const c of avoid) cost += HULL_WEIGHT * circleOverlap(rect, c);
			if (visible) cost += OFFSCREEN_WEIGHT * (area - overlapArea(rect, visible));
			if (cost < bestCost) {
				bestCost = cost;
				best = rect;
			}
		});
		const chosen = visible ? nudgeInside(best!, visible) : best!;
		result[item.id] = chosen;
		placed.push(chosen);
	}
	return result;
}
