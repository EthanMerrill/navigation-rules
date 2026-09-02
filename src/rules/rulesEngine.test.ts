import {BoatState, WindState, areOnSameTack, evaluate, getPointOfSail, getSailTrimAngle, getTack, getWindAngle, getWindwardBoat, isClearAstern, isOverlapped} from "./rulesEngine";

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

		// 11 decides; 14 (boats 200px apart, within risk distance) co-applies;
		// the rest are not applicable, sorted ascending.
		expect(result.rules.map((r) => r.ruleNumber)).toEqual([11, 14, 10, 12, 13, 15, 16]);
		expect(result.rules[0].deciding).toBe(true);
		expect(result.rules[0].applicable).toBe(true);
		// Only one rule should ever be deciding.
		expect(result.rules.filter((r) => r.deciding).length).toBe(1);
		// Rule 11 (deciding) and Rule 14 (close) are the only applicable ones here.
		expect(result.rules.filter((r) => r.applicable).length).toBe(2);
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
		const b = boat("b", 300, 350, 90); // 200px apart → within risk distance
		const result = evaluate(a, b, WIND_NORTH);

		const rule14 = result.rules.find((r) => r.ruleNumber === 14);
		expect(rule14?.applicable).toBe(true);
		expect(rule14?.deciding).toBe(false);
		// It never changes the right-of-way outcome (Rule 11 still decides).
		expect(result.appliedRule).toBe(11);
	});

	it("does not apply when boats are far apart", () => {
		const a = boat("a", 100, 100, 90);
		const b = boat("b", 900, 100, 90); // 800px apart
		const result = evaluate(a, b, WIND_NORTH);

		expect(result.rules.find((r) => r.ruleNumber === 14)?.applicable).toBe(false);
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
