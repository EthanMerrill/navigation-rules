import React from "react";
import type {WorldState} from "../model/world";
import {formatRuleId} from "../rules/rulesEngine";
import type {BadgeTone, BoatBadge} from "../ui/boatBadge";
import {type BadgeItem, type BadgeSide, type Circle, layoutBadges} from "../view/badgeLayout";
import {lengthToPx, toPx} from "../view/scale";
import {ViewContext} from "../view/ViewContext";
import {COMMITTEE_BOAT_PX} from "./MarkMarker";

interface BoatBadgeLayerProps {
	world: WorldState;
	/** Badge per boat id. */
	badges: Record<string, BoatBadge>;
}

const TONE_CLASS: Record<BadgeTone, string> = {
	rightOfWay: "boat-badge__line--right-of-way",
	keepClear: "boat-badge__line--keep-clear",
	entitled: "boat-badge__line--entitled",
	duty: "boat-badge__line--duty",
	limitation: "boat-badge__line--limitation",
};

/** Size assumed for a badge before it has been measured, per line, in screen px. */
const UNMEASURED = {width: 170, lineHeight: 24};
/** Gap kept between a badge and the edge of the water, in screen px. */
const VISIBLE_MARGIN_PX = 8;
/** Radius kept clear around a mark, in stage px; more for a committee boat. */
const MARK_RADIUS_PX = 18;
const COMMITTEE_BOAT_RADIUS_PX = COMMITTEE_BOAT_PX.height / 2;

/**
 * Every boat's badge, upright, laid out together so they do not cover each
 * other, the hulls, marks or obstructions (see `view/badgeLayout.ts`). Badges
 * are counter-scaled to read the same at any zoom, so their size in stage px
 * depends on the zoom; they are measured after each render.
 */
const BoatBadgeLayer = ({world, badges}: BoatBadgeLayerProps) => {
	const view = React.useContext(ViewContext);
	const scale = view.scale;
	const refs = React.useRef<Record<string, HTMLDivElement | null>>({});
	const [sizes, setSizes] = React.useState<Record<string, {width: number; height: number}>>({});
	const previousSides = React.useRef<Record<string, BadgeSide>>({});

	// Measure (in screen px, i.e. before the counter-scale) and store only real changes, so this settles in one pass.
	React.useLayoutEffect(() => {
		const next: Record<string, {width: number; height: number}> = {};
		let changed = false;
		for (const [id, el] of Object.entries(refs.current)) {
			if (!el) continue;
			next[id] = {width: el.offsetWidth, height: el.offsetHeight};
			if (sizes[id]?.width !== next[id].width || sizes[id]?.height !== next[id].height) changed = true;
		}
		if (changed) setSizes(next);
	});

	const items: BadgeItem[] = world.boats
		.filter((boat) => (badges[boat.id]?.lines.length ?? 0) > 0)
		.map((boat) => {
			const lines = badges[boat.id].lines.length + (badges[boat.id].hidden > 0 ? 1 : 0);
			const size = sizes[boat.id] ?? {width: UNMEASURED.width, height: UNMEASURED.lineHeight * lines};
			return {id: boat.id, centre: toPx(boat), heading: boat.heading, width: size.width / scale, height: size.height / scale};
		});
	const obstacles: Circle[] = [
		...world.marks.map((mark) => ({...toPx(mark), r: mark.startEnd === "committee" ? COMMITTEE_BOAT_RADIUS_PX : MARK_RADIUS_PX})),
		...world.obstructions.map((o) => ({...toPx(o), r: lengthToPx(o.radius)})),
	];
	// The water on screen, in stage px, less a small margin.
	const margin = VISIBLE_MARGIN_PX / scale;
	const visible =
		view.viewportWidth > 0
			? {x: -view.x / scale + margin, y: -view.y / scale + margin, width: view.viewportWidth / scale - 2 * margin, height: view.viewportHeight / scale - 2 * margin}
			: undefined;
	const placements = layoutBadges(items, obstacles, previousSides.current, scale, visible);

	React.useEffect(() => {
		previousSides.current = Object.fromEntries(Object.entries(placements).map(([id, p]) => [id, p.side]));
	});

	return (
		<>
			{items.map(({id}) => {
				const badge = badges[id];
				const place = placements[id];
				return (
					<div
						key={id}
						ref={(el) => {
							refs.current[id] = el;
						}}
						className="boat-badge"
						data-side={place.side}
						aria-hidden="true"
						style={{transform: `translate(${place.x}px, ${place.y}px) scale(${1 / scale})`, alignItems: place.align}}>
						{badge.lines.map((line) => (
							<div className={`boat-badge__line ${TONE_CLASS[line.tone]}`} key={`${line.tone}|${line.text}`}>
								<span className="boat-badge__text">{line.text}</span>
								<span className="boat-badge__rule">{line.rules.map(formatRuleId).join(" · ")}</span>
							</div>
						))}
						{badge.hidden > 0 && <div className="boat-badge__more">+{badge.hidden} more in the rules panel</div>}
					</div>
				);
			})}
		</>
	);
};

export default BoatBadgeLayer;
