/**
 * View scale — the only place world units (hull lengths) are converted to
 * screen pixels, and home of the rendered boat's pixel geometry.
 */

/** A point in either world units or pixels, depending on the function using it. */
export interface Vec2 {
	x: number;
	y: number;
}

/**
 * Screen pixels per world unit (one hull length). This is the rendered hull's
 * bow-to-stern length, so the default scene looks exactly as it did when the
 * engine worked in pixels.
 */
export const PX_PER_HULL_LENGTH = 161.5;

/** Width in pixels of the rendered boat wrapper (`.boat-wrapper`). */
export const WRAPPER_W_PX = 100;

/** Height in pixels of the rendered boat wrapper (`.boat-wrapper`). */
export const WRAPPER_H_PX = 200;

/** Width in pixels of the hull image, horizontally centred in the wrapper. */
export const HULL_IMAGE_W_PX = 80;

/** Height in pixels of the hull image, top-aligned in the wrapper. */
export const HULL_IMAGE_H_PX = 164;

/** Convert a world point (hull lengths) to a pixel point. */
export function toPx(p: Vec2): Vec2 {
	return {x: p.x * PX_PER_HULL_LENGTH, y: p.y * PX_PER_HULL_LENGTH};
}

/** Convert a pixel point to a world point (hull lengths). */
export function toWorld(p: Vec2): Vec2 {
	return {x: p.x / PX_PER_HULL_LENGTH, y: p.y / PX_PER_HULL_LENGTH};
}

/** Convert a world length (hull lengths) to pixels. */
export function lengthToPx(length: number): number {
	return length * PX_PER_HULL_LENGTH;
}

/**
 * CSS top-left of a boat wrapper for a boat centred at world point `center`.
 * The wrapper is positioned by its top-left corner, so offset by half its size.
 */
export function wrapperOrigin(center: Vec2): Vec2 {
	const px = toPx(center);
	return {x: px.x - WRAPPER_W_PX / 2, y: px.y - WRAPPER_H_PX / 2};
}

/** Inverse of `wrapperOrigin`: the boat's world centre from its wrapper top-left in px. */
export function centerFromWrapperOrigin(originPx: Vec2): Vec2 {
	return toWorld({x: originPx.x + WRAPPER_W_PX / 2, y: originPx.y + WRAPPER_H_PX / 2});
}
