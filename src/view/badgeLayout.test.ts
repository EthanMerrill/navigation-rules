import {BADGE_SIDES, type BadgeItem, hullCircles, layoutBadges, overlapArea, placeOnSide} from "./badgeLayout";

const item = (id: string, x: number, y: number, heading: number): BadgeItem => ({id, centre: {x, y}, heading, width: 160, height: 44});

describe("badgeLayout", () => {
	it("puts a lone badge off the stern, clear of the hull", () => {
		const boat = item("a", 500, 500, 90);
		const place = layoutBadges([boat]).a;
		expect(place.side).toBe("aft");
		// Heading east: the stern is to the west, so the badge sits left of the boat, lined up on its right.
		expect(place.x + place.width).toBeLessThan(500);
		expect(place.align).toBe("flex-end");
	});

	it("moves a badge that would cover another badge or hull", () => {
		// b sits right where a's stern badge would go.
		const a = item("a", 500, 500, 90);
		const b = item("b", 330, 500, 90);
		const places = layoutBadges([a, b]);
		const rects = Object.values(places);
		expect(overlapArea(rects[0], rects[1])).toBe(0);
		for (const c of hullCircles(b.centre, b.heading)) {
			const p = places.a;
			const inside = c.x > p.x && c.x < p.x + p.width && c.y > p.y && c.y < p.y + p.height;
			expect(inside).toBe(false);
		}
	});

	it("returns to the stern once it is clear, even if it was elsewhere last frame", () => {
		const boat = item("a", 500, 500, 0);
		expect(layoutBadges([boat], [], {a: "starboardQuarter"}).a.side).toBe("aft");
	});

	it("keeps badges on screen near the edge of the water", () => {
		// Heading east at the left edge: the stern spot would be off screen.
		const boat = item("a", 120, 500, 90);
		const visible = {x: 0, y: 0, width: 1000, height: 1000};
		const place = layoutBadges([boat], [], {}, 1, visible).a;
		expect(place.x).toBeGreaterThanOrEqual(0);
		expect(place.x + place.width).toBeLessThanOrEqual(1000);
		expect(place.side).not.toBe("aft");
	});

	it("offers every side as a distinct spot", () => {
		const boat = item("a", 0, 0, 30);
		const spots = new Set(BADGE_SIDES.map((side) => `${Math.round(placeOnSide(boat, side).x)},${Math.round(placeOnSide(boat, side).y)}`));
		expect(spots.size).toBe(BADGE_SIDES.length);
	});
});
