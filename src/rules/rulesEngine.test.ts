import {BoatState, WindState, areOnSameTack, boatPerimeterDistance, evaluate, getHullVertices, getPointOfSail, getSailTrimAngle, getTack, getWindAngle, getWindwardBoat, inferProperCourse, isClearAstern, isOverlapped, isSailingAboveProperCourse, isSailingBelowProperCourse} from "./rulesEngine";

// All tests use wind blowing FROM the north (0°), i.e. down the screen.
const WIND_NORTH: WindState = {direction: 0};

function boat(id: string, x: number, y: number, heading: number, tacking = false): BoatState {
	return {id, x, y, heading, tacking};
}

describe("getTack", () => {
	it("reports port tack when wind comes over the port side", () => {
		// Heading east (90°), wind from north (0°) => sin(-90) < 0 => PORT.
		expect(getTack(90, 0)).toBe("PORT");
	});

	it("reports starboard tack when wind comes over the starboard side", () => {
		// Heading west (270°), wind from north (0°) => sin(+90) > 0 => STARBOARD.
		expect(getTack(270, 0)).toBe("STARBOARD");
	});

	it("reports null (head-to-wind) when pointing directly into the wind", () => {
		// Heading north (0°), wind from north (0°) => sin(0) = 0 => null.
		expect(getTack(0, 0)).toBeNull();
	});
});

describe("getWindAngle", () => {
	it("is 0 when pointing directly into the wind", () => {
		expect(getWindAngle(0, 0)).toBe(0);
	});

	it("is 90 on a beam reach", () => {
		expect(getWindAngle(90, 0)).toBe(90);
	});

	it("is 180 when running directly downwind", () => {
		expect(getWindAngle(180, 0)).toBe(180);
	});

	it("wraps correctly across 360°", () => {
		expect(getWindAngle(270, 0)).toBe(90);
	});
});

describe("getPointOfSail", () => {
	it("reports head to wind", () => {
		expect(getPointOfSail(0, 0)).toBe("HEAD_TO_WIND");
	});

	it("reports close hauled at 45°", () => {
		expect(getPointOfSail(45, 0)).toBe("CLOSE_HAULED");
	});

	it("reports beam reach at 90°", () => {
		expect(getPointOfSail(90, 0)).toBe("BEAM_REACH");
	});

	it("reports running at 180°", () => {
		expect(getPointOfSail(180, 0)).toBe("RUNNING");
	});
});

describe("getSailTrimAngle", () => {
	it("is pulled in tight when close hauled", () => {
		expect(getSailTrimAngle(45, 0)).toBeCloseTo(12);
	});

	it("is half out on a beam reach", () => {
		expect(getSailTrimAngle(90, 0)).toBeCloseTo(45);
	});

	it("is let out almost fully when running", () => {
		expect(getSailTrimAngle(180, 0)).toBeCloseTo(85);
	});
});

describe("areOnSameTack", () => {
	it("is true for two boats on the same tack", () => {
		expect(areOnSameTack("STARBOARD", "STARBOARD")).toBe(true);
	});

	it("is false for opposite tacks", () => {
		expect(areOnSameTack("STARBOARD", "PORT")).toBe(false);
	});

	it("is false when either boat is head-to-wind", () => {
		expect(areOnSameTack(null, "STARBOARD")).toBe(false);
		expect(areOnSameTack("STARBOARD", null)).toBe(false);
	});
});

describe("inferProperCourse", () => {
	it("is close-hauled on port tack when the wind is from the north", () => {
		// Heading east (90°) is port tack; close-hauled port = 45°.
		expect(inferProperCourse(90, 0)).toBe(45);
	});

	it("is close-hauled on starboard tack when the wind is from the north", () => {
		// Heading west (270°) is starboard tack; close-hauled starboard = 315°.
		expect(inferProperCourse(270, 0)).toBe(315);
	});

	it("defaults to starboard close-hauled when head-to-wind", () => {
		expect(inferProperCourse(0, 0)).toBe(315);
	});

	it("wraps correctly when the wind is from the east", () => {
		// Wind from east (90°). Heading south (180°) => port tack => 90 + 45 = 135.
		expect(inferProperCourse(180, 90)).toBe(135);
		// Heading north (0°) => starboard tack => 90 - 45 = 45.
		expect(inferProperCourse(0, 90)).toBe(45);
	});
});

describe("isClearAstern / isOverlapped", () => {
	it("detects a boat clear astern of another on the same heading", () => {
		const ahead = boat("ahead", 600, 300, 90);
		const astern = boat("astern", 300, 300, 90);
		// astern is 300px behind ahead along the +x heading (east).
		expect(isClearAstern(astern, ahead)).toBe(true);
		expect(isClearAstern(ahead, astern)).toBe(false);
		expect(isOverlapped(ahead, astern)).toBe(false);
	});

	it("detects overlap when boats are abreast", () => {
		const a = boat("a", 300, 150, 90);
		const b = boat("b", 300, 350, 90);
		expect(isClearAstern(a, b)).toBe(false);
		expect(isClearAstern(b, a)).toBe(false);
		expect(isOverlapped(a, b)).toBe(true);
	});
});

describe("getWindwardBoat", () => {
	it("identifies the more-northerly boat as windward (wind from north)", () => {
		const north = boat("north", 300, 150, 90);
		const south = boat("south", 300, 350, 90);
		expect(getWindwardBoat(north, south, WIND_NORTH)).toBe("a");
		expect(getWindwardBoat(south, north, WIND_NORTH)).toBe("b");
	});
});

describe("getHullVertices", () => {
	it("traces a pointed bow, not a rectangular corner", () => {
		// Heading north (0°): the first vertex is the bow tip, sitting on the
		// centreline ~98.5px ahead of centre — a 100×200 box would put a corner
		// at (±50, −100) instead.
		const b = boat("b", 0, 0, 0);
		const v = getHullVertices(b);
		expect(v[0].x).toBeCloseTo(-0.5, 0);
		expect(v[0].y).toBeCloseTo(-98.55, 0);
	});

	it("is ~77.7px wide with the transom ~63px astern (matches the SVG)", () => {
		const b = boat("b", 0, 0, 0);
		const v = getHullVertices(b);
		const xs = v.map((p) => p.x);
		const ys = v.map((p) => p.y);
		const beam = Math.max(...xs) - Math.min(...xs);
		expect(beam).toBeCloseTo(77.7, 1);
		// The flat stern sits ~63px behind centre, not 100px like a centred box.
		expect(Math.max(...ys)).toBeCloseTo(63, 0);
	});
});

describe("boatPerimeterDistance", () => {
	it("measures the gap between the actual hull edges, not the bounding box", () => {
		// Two boats heading east (90°), 200px centre-to-centre apart vertically.
		// The real hull is only ~77.7px wide, so the edge-to-edge gap is
		// 200 − 77.7 ≈ 122.3px (a 100px-wide bounding box would report 100px).
		const a = boat("a", 300, 150, 90);
		const b = boat("b", 300, 350, 90);
		expect(boatPerimeterDistance(a, b)).toBeCloseTo(122.34, 0);
	});

	it("is zero when hulls are just touching", () => {
		// Centres one beam (~77.7px) apart → the hull edges just meet.
		const a = boat("a", 300, 150, 90);
		const b = boat("b", 300, 150 + 77.66, 90);
		expect(boatPerimeterDistance(a, b)).toBeCloseTo(0, 0);
	});

	it("returns a negative value equal to the overlap when hulls intersect", () => {
		// Centres 70px apart, i.e. overlapping by 77.7 − 70 ≈ 7.7px.
		const a = boat("a", 300, 150, 90);
		const b = boat("b", 300, 220, 90);
		const d = boatPerimeterDistance(a, b);
		expect(d).toBeLessThan(0);
		expect(d).toBeCloseTo(-7.66, 1);
	});
});

describe("isSailingAboveProperCourse / isSailingBelowProperCourse", () => {
	it("detects sailing above proper course (more upwind)", () => {
		// Proper course is a beam reach (90°); heading 45° points more upwind.
		expect(isSailingAboveProperCourse(45, 90, 0)).toBe(true);
		expect(isSailingAboveProperCourse(90, 90, 0)).toBe(false);
		expect(isSailingAboveProperCourse(135, 90, 0)).toBe(false);
	});

	it("detects sailing below proper course (more downwind)", () => {
		// Proper course is a beam reach (90°); heading 135° points more downwind.
		expect(isSailingBelowProperCourse(135, 90, 0)).toBe(true);
		expect(isSailingBelowProperCourse(90, 90, 0)).toBe(false);
		expect(isSailingBelowProperCourse(45, 90, 0)).toBe(false);
	});
});

describe("evaluate", () => {
	it("applies Rule 10 on opposite tacks (starboard stands on)", () => {
		const port = boat("port", 300, 200, 90); // port tack
		const starboard = boat("starboard", 400, 200, 270); // starboard tack
		const result = evaluate(port, starboard, WIND_NORTH);

		expect(result.appliedRule).toBe(10);
		expect(result.sameTack).toBe(false);
		expect(result.overlapped).toBeNull();
		expect(result.boats[0].standOn).toBe(false); // port
		expect(result.boats[0].giveWay).toBe(true);
		expect(result.boats[1].standOn).toBe(true); // starboard
		expect(result.boats[1].giveWay).toBe(false);
	});

	it("applies Rule 11 on same tack and overlapped (leeward stands on)", () => {
		const windward = boat("windward", 300, 150, 90); // north = windward
		const leeward = boat("leeward", 300, 350, 90); // south = leeward
		const result = evaluate(windward, leeward, WIND_NORTH);

		expect(result.appliedRule).toBe(11);
		expect(result.sameTack).toBe(true);
		expect(result.overlapped).toBe(true);
		expect(result.boats[0].standOn).toBe(false); // windward keeps clear
		expect(result.boats[0].windward).toBe(true);
		expect(result.boats[1].standOn).toBe(true); // leeward stands on
		expect(result.boats[1].leeward).toBe(true);
	});

	it("applies Rule 12 on same tack and not overlapped (clear ahead stands on)", () => {
		const astern = boat("astern", 300, 300, 90);
		const ahead = boat("ahead", 600, 300, 90);
		const result = evaluate(astern, ahead, WIND_NORTH);

		expect(result.appliedRule).toBe(12);
		expect(result.sameTack).toBe(true);
		expect(result.overlapped).toBe(false);
		expect(result.boats[0].standOn).toBe(false); // astern keeps clear
		expect(result.boats[1].standOn).toBe(true); // ahead stands on
	});

	it("ranks the deciding rule first, then applicable, then non-applicable", () => {
		const a = boat("a", 300, 150, 90);
		const b = boat("b", 300, 350, 90);
		const result = evaluate(a, b, WIND_NORTH); // Rule 11 decides

		// 11 decides; 14 (hulls ~122px apart, within risk distance) and 17 (the
		// windward boat is on a beam reach, below her inferred close-hauled proper
		// course) co-apply; the rest are not applicable, sorted ascending.
		expect(result.rules.map((r) => r.ruleNumber)).toEqual([11, 14, 17, 10, 12, 13, 15, 16]);
		expect(result.rules[0].deciding).toBe(true);
		expect(result.rules[0].applicable).toBe(true);
		// Only one rule should ever be deciding.
		expect(result.rules.filter((r) => r.deciding).length).toBe(1);
		// Rule 11 (deciding), Rule 14 (close) and Rule 17 (below proper course).
		expect(result.rules.filter((r) => r.applicable).length).toBe(3);
	});
});

describe("evaluate — Rule 13 (While Tacking)", () => {
	it("makes a tacking boat keep clear even when it is on starboard", () => {
		// b is tacking and on starboard; a is on port. Normally Rule 10 would let
		// b (starboard) stand on, but Rule 13 (tacking) overrides it.
		const a = boat("a", 300, 200, 90); // port tack
		const b = boat("b", 400, 200, 270, true); // starboard tack, tacking
		const result = evaluate(a, b, WIND_NORTH);

		expect(result.appliedRule).toBe(13);
		expect(result.boats[0].standOn).toBe(true); // a stands on
		expect(result.boats[1].standOn).toBe(false); // b (tacking) keeps clear
	});

	it("ranks Rule 13 first and Rule 10 as still-applicable below it", () => {
		const a = boat("a", 300, 200, 90); // port tack
		const b = boat("b", 400, 200, 270, true); // starboard tack, tacking
		const result = evaluate(a, b, WIND_NORTH);

		expect(result.rules[0].ruleNumber).toBe(13);
		expect(result.rules[0].deciding).toBe(true);
		// Rule 10 is applicable (opposite tacks) but not deciding.
		const rule10 = result.rules.find((r) => r.ruleNumber === 10);
		expect(rule10?.applicable).toBe(true);
		expect(rule10?.deciding).toBe(false);
		// Rules 11 and 12 are not applicable (opposite tacks).
		expect(result.rules.find((r) => r.ruleNumber === 11)?.applicable).toBe(false);
		expect(result.rules.find((r) => r.ruleNumber === 12)?.applicable).toBe(false);
	});

	it("gives way to neither boat when both are tacking", () => {
		const a = boat("a", 300, 200, 90, true);
		const b = boat("b", 400, 200, 270, true);
		const result = evaluate(a, b, WIND_NORTH);

		expect(result.appliedRule).toBe(13);
		expect(result.boats[0].standOn).toBe(false);
		expect(result.boats[1].standOn).toBe(false);
		expect(result.boats[0].giveWay).toBe(true);
		expect(result.boats[1].giveWay).toBe(true);
	});
});

describe("evaluate — Rule 14 (Avoiding Contact)", () => {
	it("co-applies when boats are close, without deciding right of way", () => {
		const a = boat("a", 300, 150, 90);
		const b = boat("b", 300, 350, 90); // hulls 100px apart → within risk distance
		const result = evaluate(a, b, WIND_NORTH);

		const rule14 = result.rules.find((r) => r.ruleNumber === 14);
		expect(rule14?.applicable).toBe(true);
		expect(rule14?.deciding).toBe(false);
		// It never changes the right-of-way outcome (Rule 11 still decides).
		expect(result.appliedRule).toBe(11);
	});

	it("does not apply when boats are far apart", () => {
		const a = boat("a", 100, 100, 90);
		const b = boat("b", 900, 100, 90); // hulls 600px apart
		const result = evaluate(a, b, WIND_NORTH);

		expect(result.rules.find((r) => r.ruleNumber === 14)?.applicable).toBe(false);
	});

	it("flags a collision (overlapping hulls) without changing right of way", () => {
		const a = boat("a", 300, 150, 90);
		const b = boat("b", 300, 220, 90); // hulls overlap by 30px
		const result = evaluate(a, b, WIND_NORTH);

		expect(result.collided).toBe(true);
		expect(result.appliedRule).toBe(11); // right of way is still decided by 10–13

		const rule14 = result.rules.find((r) => r.ruleNumber === 14);
		expect(rule14?.applicable).toBe(true);
		expect(rule14?.deciding).toBe(false); // Rule 14 is a limitation, not a right-of-way rule
		expect(rule14?.detail).toContain("Collision");
	});
});

describe("evaluate — Rule 15 (Acquiring Right of Way)", () => {
	it("applies when right of way has just changed hands", () => {
		const a = boat("a", 300, 200, 90); // port
		const b = boat("b", 400, 200, 270); // starboard → b stands on
		const result = evaluate(a, b, WIND_NORTH, {prevStandOnIsA: true}); // a used to stand on

		const rule15 = result.rules.find((r) => r.ruleNumber === 15);
		expect(rule15?.applicable).toBe(true);
		expect(rule15?.deciding).toBe(false);
		expect(result.appliedRule).toBe(10); // right-of-way decision unchanged
	});

	it("does not apply when right of way is unchanged", () => {
		const a = boat("a", 300, 200, 90);
		const b = boat("b", 400, 200, 270);
		const result = evaluate(a, b, WIND_NORTH, {prevStandOnIsA: false}); // b stood on before too

		expect(result.rules.find((r) => r.ruleNumber === 15)?.applicable).toBe(false);
	});
});

describe("evaluate — Rule 16 (Changing Course)", () => {
	it("applies when the right-of-way boat is changing course", () => {
		const a = boat("a", 300, 200, 90); // port
		const b = boat("b", 400, 200, 270); // starboard → b stands on
		const result = evaluate(a, b, WIND_NORTH, {changingCourseB: true});

		const rule16 = result.rules.find((r) => r.ruleNumber === 16);
		expect(rule16?.applicable).toBe(true);
		expect(rule16?.deciding).toBe(false);
	});

	it("does not apply when the give-way boat changes course", () => {
		const a = boat("a", 300, 200, 90);
		const b = boat("b", 400, 200, 270);
		const result = evaluate(a, b, WIND_NORTH, {changingCourseA: true}); // a is give-way

		expect(result.rules.find((r) => r.ruleNumber === 16)?.applicable).toBe(false);
	});
});

describe("evaluate — Rule 17 (On the Same Tack; Proper Course)", () => {
	it("17.1 applies when a leeward boat that came from astern sails above her proper course", () => {
		// a is windward (north), b is leeward (south); both on port tack.
		// Proper course is inferred as close-hauled on port tack (45°). b is
		// pinching up to 30°, i.e. above her proper course.
		const a = boat("a", 300, 150, 45);
		const b = boat("b", 300, 350, 30);
		const result = evaluate(a, b, WIND_NORTH, {establishedLeewardB: true});

		const rule17 = result.rules.find((r) => r.ruleNumber === 17);
		expect(rule17?.applicable).toBe(true);
		expect(rule17?.deciding).toBe(false);
		expect(rule17?.detail).toContain("17.1");
		expect(result.appliedRule).toBe(11); // right-of-way decision unchanged
	});

	it("17.1 does not apply without the clear-astern-to-leeward transition", () => {
		// Same geometry, but b has not (latch absent) established the overlap from astern.
		const a = boat("a", 300, 150, 45);
		const b = boat("b", 300, 350, 30);
		const result = evaluate(a, b, WIND_NORTH); // no establishedLeewardB

		expect(result.rules.find((r) => r.ruleNumber === 17)?.applicable).toBe(false);
	});

	it("17.2 applies when a windward boat sails below her proper course (not on a beat)", () => {
		// a is windward (north) and is on a broad reach (135°), below her inferred
		// close-hauled proper course (45°).
		const a = boat("a", 300, 150, 135);
		const b = boat("b", 300, 350, 90);
		const result = evaluate(a, b, WIND_NORTH);

		const rule17 = result.rules.find((r) => r.ruleNumber === 17);
		expect(rule17?.applicable).toBe(true);
		expect(rule17?.detail).toContain("17.2");
		expect(result.appliedRule).toBe(11); // right-of-way decision unchanged
	});

	it("does not apply when the boats are more than two hull lengths apart", () => {
		// b came from astern and sails above proper course, but they are 600px apart
		// (> TWO_HULL_LENGTHS = 400).
		const a = boat("a", 300, 100, 45);
		const b = boat("b", 300, 700, 30);
		const result = evaluate(a, b, WIND_NORTH, {establishedLeewardB: true});

		expect(result.rules.find((r) => r.ruleNumber === 17)?.applicable).toBe(false);
	});
});
