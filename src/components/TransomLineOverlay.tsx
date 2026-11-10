import {BoatState, getAheadBoat, getTransomLine} from "../rules/rulesEngine";

/** How far the abeam/transom line extends to each side of the boat, in px. */
const TRANSOM_LINE_EXTENT = 300;

export interface TransomLineOverlayProps {
	boatA: BoatState;
	boatB: BoatState;
	/** True when the two boats overlap — fade in the abeam line from the ahead boat's transom. */
	overlapped: boolean | null;
}

/**
 * Draws a dotted line abeam through the ahead boat's transom — the boundary
 * that defines "clear astern / clear ahead" vs "overlap" (RRS Definitions,
 * used by Rules 11 & 12). It fades in while the boats overlap and fades out
 * when they do not.
 */
const TransomLineOverlay = ({boatA, boatB, overlapped}: TransomLineOverlayProps) => {
	const aheadBoat = getAheadBoat(boatA, boatB) === "a" ? boatA : boatB;
	const [p1, p2] = getTransomLine(aheadBoat, TRANSOM_LINE_EXTENT);

	// The line is a horizontal segment centred on the transom; rotate it by the
	// boat's heading so it lies abeam (perpendicular to the centreline). CSS
	// rotate uses the same 0°=north, clockwise convention as the boat wrapper.
	const transomX = (p1.x + p2.x) / 2;
	const transomY = (p1.y + p2.y) / 2;
	const width = Math.hypot(p2.x - p1.x, p2.y - p1.y);

	return (
		<div
			aria-hidden="true"
			className={overlapped ? "transom-line transom-line--visible" : "transom-line"}
			style={{
				left: transomX,
				top: transomY,
				width,
				transform: `translate(-50%, -50%) rotate(${aheadBoat.heading}deg)`,
			}}
		/>
	);
};

export default TransomLineOverlay;