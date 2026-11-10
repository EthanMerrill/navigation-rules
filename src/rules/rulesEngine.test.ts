import type {BoatState, WindState, WorldState} from "../model/world";
import type {EngineHistory, PairView, RuleDefinition, RuleEvaluation, RuleState} from "./types";
import {CONTACT_RISK_DISTANCE, isShownApplicable} from "../ui/ruleDisplay";
import {PX_PER_HULL_LENGTH, toWorld} from "../view/scale";
import {worldReducer, createDefaultWorld} from "../state/worldReducer";
import {TWO_HULL_LENGTHS, HULL_ACTUAL_LENGTH, HULL_FOREMOST_OFFSET, HULL_AFTERMOST_OFFSET, computeFacts, computeMeetingFacts, pairKey, areOnSameTack, boatPerimeterDistance, compareRuleIds, contentOf, evaluate, RULE_CONTENT, RULE_REGISTRY, getAheadBoat, getHullVertices, getPointOfSail, getSailTrimAngle, getTack, getTransomLine, getWindAngle, getWindwardBoat, inferProperCourse, isClearAstern, isOverlapped, isSailingAboveProperCourse, isSailingBelowProperCourse} from "./rulesEngine";

// All tests use wind blowing FROM the north (0°), i.e. down the screen.
const WIND_NORTH: WindState = {direction: 0};

/** Boats built with `tacking = true`; `evalBoats` marks them as tacking in the facts (tacking is derived by `step`). */
const tackingBoats = new WeakSet<BoatState>();

/** Build a boat from PIXEL coordinates (converted to world units via `toWorld`). */
function boat(id: string, xPx: number, yPx: number, heading: number, tacking = false): BoatState {
	const p = toWorld({x: xPx, y: yPx});
	const b: BoatState = {id, x: p.x, y: p.y, heading, nextLegIndex: 0};
	if (tacking) tackingBoats.add(b);
	return b;
}

/** Alias of `boat` that makes the pixel input explicit. */
const boatPx = boat;

/** Convert a world length (hull lengths) to pixels for readable assertions. */
const px = (length: number) => length * PX_PER_HULL_LENGTH;

/** A default world with the given boats and wind. */
function worldOf(boats: BoatState[], wind: WindState = WIND_NORTH): WorldState {
	return {...createDefaultWorld(), boats, wind};
}

/** Evaluate any number of boats (facts computed once, as the hook does). */
function evalBoats(boats: BoatState[], history: EngineHistory = {}, focusPair?: string, wind: WindState = WIND_NORTH): RuleEvaluation {
	const world = worldOf(boats, wind);
	const facts = computeFacts(world);
	for (const b of boats) if (tackingBoats.has(b)) facts.boats[b.id].tacking = true;
	return evaluate(world, facts, history, focusPair);
}

/** Evaluate a two-boat world. */
function evalPair(a: BoatState, b: BoatState, wind: WindState = WIND_NORTH, history: EngineHistory = {}): RuleEvaluation {
	return evalBoats([a, b], history, undefined, wind);
}

/** The view of the pair formed by two boats. */
function pairOf(result: RuleEvaluation, a: BoatState, b: BoatState): PairView {
	return result.pairs[pairKey(a.id, b.id)];
}

/** A boat's obligations other than the Rule 14 avoidContact duty that close boats always share. */
function duties(result: RuleEvaluation, id: string) {
	return result.boats[id].obligations.filter((o) => o.kind !== "avoidContact");
}

/** True when the rule fired (after suspension) anywhere. */
function isApplicable(result: RuleEvaluation, id: string): boolean {
	return result.rules.find((r) => r.id === id)?.applicable === true;
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

	it("treats a boat behind the real transom as clear astern", () => {
		// ahead heads east (90°). A boat 100px behind its centre is behind the
		// real transom (~63px astern of centre), so it is clear astern — a centred
		// 100×200 box approximation would still have called this an overlap.
		const ahead = boat("ahead", 600, 300, 90);
		const astern = boat("astern", 500, 300, 90);
		expect(isClearAstern(astern, ahead)).toBe(true);
		expect(isOverlapped(ahead, astern)).toBe(false);
	});

	it("treats a boat within the transom distance as still overlapped", () => {
		const ahead = boat("ahead", 600, 300, 90);
		const abreast = boat("abreast", 580, 300, 90); // only 20px behind centre
		expect(isClearAstern(abreast, ahead)).toBe(false);
		expect(isOverlapped(ahead, abreast)).toBe(true);
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
		expect(px(v[0].x)).toBeCloseTo(-0.5, 0);
		expect(px(v[0].y)).toBeCloseTo(-98.55, 0);
	});

	it("is ~77.7px wide with the transom ~63px astern (matches the SVG)", () => {
		const b = boat("b", 0, 0, 0);
		const v = getHullVertices(b);
		const xs = v.map((p) => p.x);
		const ys = v.map((p) => p.y);
		const beam = Math.max(...xs) - Math.min(...xs);
		expect(px(beam)).toBeCloseTo(77.7, 0);
		expect(beam).toBeCloseTo(0.48, 2);
		// The flat stern sits ~63px behind centre, not 100px like a centred box.
		expect(px(Math.max(...ys))).toBeCloseTo(63, 0);
	});
});

describe("getAheadBoat", () => {
	it("picks the boat whose bow is further forward, regardless of order", () => {
		// Both heading east; a is ahead (further +x), b astern.
		const ahead = boat("ahead", 700, 300, 90);
		const astern = boat("astern", 500, 300, 90);
		expect(getAheadBoat(ahead, astern)).toBe("a");
		expect(getAheadBoat(astern, ahead)).toBe("b");
	});
});

describe("getTransomLine", () => {
	it("runs abeam (vertical) through the transom of an east-heading boat", () => {
		const b = boat("b", 300, 300, 90);
		const [p1, p2] = getTransomLine(b, 300 / PX_PER_HULL_LENGTH);

		// Midpoint is the transom, ~63px astern of centre (west of x=300).
		expect(px((p1.x + p2.x) / 2)).toBeCloseTo(237, 0);
		expect(px((p1.y + p2.y) / 2)).toBeCloseTo(300, 0);
		// Each endpoint is 300px from the transom → line length 600.
		expect(px(Math.hypot(p2.x - p1.x, p2.y - p1.y))).toBeCloseTo(600, 0);
		// Abeam of an east-heading boat is vertical: both ends share x.
		expect(p1.x).toBeCloseTo(p2.x, 1);
	});

	it("runs abeam (horizontal) through the transom of a north-heading boat", () => {
		const b = boat("b", 300, 300, 0);
		const [p1, p2] = getTransomLine(b, 300 / PX_PER_HULL_LENGTH);

		// Transom is ~63px astern of centre (south of y=300).
		expect(px((p1.y + p2.y) / 2)).toBeCloseTo(363, 0);
		// Abeam of a north-heading boat is horizontal: both ends share y.
		expect(p1.y).toBeCloseTo(p2.y, 1);
	});
});

describe("boatPerimeterDistance", () => {
	it("measures the gap between the actual hull edges, not the bounding box", () => {
		// Two boats heading east (90°), 200px centre-to-centre apart vertically.
		// The real hull is only ~77.7px wide, so the edge-to-edge gap is
		// 200 − 77.7 ≈ 122.3px (a 100px-wide bounding box would report 100px).
		const a = boat("a", 300, 150, 90);
		const b = boat("b", 300, 350, 90);
		expect(px(boatPerimeterDistance(a, b))).toBeCloseTo(122.34, 0);
	});

	it("is zero when hulls are just touching", () => {
		// Centres one beam (~77.7px) apart → the hull edges just meet.
		const a = boat("a", 300, 150, 90);
		const b = boat("b", 300, 150 + 77.66, 90);
		expect(px(boatPerimeterDistance(a, b))).toBeCloseTo(0, 0);
	});

	it("returns a negative value equal to the overlap when hulls intersect", () => {
		// Centres 70px apart, i.e. overlapping by 77.7 − 70 ≈ 7.7px.
		const a = boat("a", 300, 150, 90);
		const b = boat("b", 300, 220, 90);
		const d = boatPerimeterDistance(a, b);
		expect(d).toBeLessThan(0);
		expect(px(d)).toBeCloseTo(-7.66, 0);
	});
});

describe("hull-derived rule distances", () => {
	it("uses the real hull as the world unit: one hull length, two hull lengths", () => {
		expect(HULL_ACTUAL_LENGTH).toBeCloseTo(1, 10);
		expect(TWO_HULL_LENGTHS).toBeCloseTo(2, 10);
		expect(HULL_FOREMOST_OFFSET).toBeCloseTo(0.61, 2);
		expect(HULL_AFTERMOST_OFFSET).toBeCloseTo(0.39, 2);
	});

	it("Rule 17 stops applying beyond the tightened two-hull-lengths cutoff", () => {
		// Boats abreast with a ~332px hull-to-hull gap: the old 400px cutoff would
		// have left the windward beam-reach boat within two hull lengths, but the
		// real-hull cutoff (~323px) excludes it.
		const windward = boat("windward", 300, 150, 90);
		const leeward = boat("leeward", 300, 560, 90);
		const result = evalPair(windward, leeward);
		expect(isApplicable(result, "17.1")).toBe(false);
		expect(isApplicable(result, "17.2")).toBe(false);
		expect(pairOf(result, windward, leeward).decidingRuleId).toBe("11"); // right-of-way decision unchanged
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
		const result = evalPair(port, starboard);
		const pair = pairOf(result, port, starboard);

		expect(pair.decidingRuleId).toBe("10");
		expect(pair.rightOfWay).toBe("starboard");
		expect(pair.sameTack).toBe(false);
		expect(pair.overlapped).toBeNull();
		expect(result.boats.port.standOn).toBe(false);
		expect(result.boats.starboard.standOn).toBe(true);
		expect(duties(result, "port")).toMatchObject([{ruleId: "10", kind: "keepClear", towards: "starboard"}]);
		expect(duties(result, "starboard")).toEqual([]);
	});

	it("applies Rule 11 on same tack and overlapped (leeward stands on)", () => {
		const windward = boat("windward", 300, 150, 90); // north = windward
		const leeward = boat("leeward", 300, 350, 90); // south = leeward
		const result = evalPair(windward, leeward);
		const pair = pairOf(result, windward, leeward);

		expect(pair.decidingRuleId).toBe("11");
		expect(pair.rightOfWay).toBe("leeward");
		expect(pair.sameTack).toBe(true);
		expect(pair.overlapped).toBe(true);
		expect(result.boats.windward.standOn).toBe(false);
		expect(result.boats.windward.windwardOf).toEqual(["leeward"]);
		expect(result.boats.windward.leewardOf).toEqual([]);
		expect(result.boats.leeward.standOn).toBe(true);
		expect(result.boats.leeward.leewardOf).toEqual(["windward"]);
	});

	it("applies Rule 12 on same tack and not overlapped (clear ahead stands on)", () => {
		const astern = boat("astern", 300, 300, 90);
		const ahead = boat("ahead", 600, 300, 90);
		const result = evalPair(astern, ahead);
		const pair = pairOf(result, astern, ahead);

		expect(pair.decidingRuleId).toBe("12");
		expect(pair.sameTack).toBe(true);
		expect(pair.overlapped).toBe(false);
		expect(result.boats.astern.standOn).toBe(false);
		expect(result.boats.ahead.standOn).toBe(true);
	});

	it("ranks the deciding rule first, then applicable, then non-applicable", () => {
		const a = boat("a", 300, 150, 90);
		const b = boat("b", 300, 350, 90);
		const result = evalPair(a, b); // Rule 11 decides

		// 11 decides; 14 (hulls ~122px apart, within risk distance) and 17.2 (the
		// windward boat is on a beam reach, below her inferred close-hauled proper
		// course) co-apply; the rest are not applicable, sorted ascending.
		expect(result.rules.map((r) => r.id)).toEqual(["11", "14", "17.2", "10", "12", "13", "15", "16", "17.1"]);
		expect(result.rules[0].deciding).toBe(true);
		expect(result.rules[0].applicable).toBe(true);
		// Only one rule should ever be deciding.
		expect(result.rules.filter((r) => r.deciding).length).toBe(1);
		// Rule 11 (deciding), Rule 14 (close) and Rule 17.2 (below proper course).
		expect(result.rules.filter((r) => r.applicable).length).toBe(3);
	});

	it("sorts rule ids numerically, then by sub-number", () => {
		const ids = ["18", "17.2", "10", "17.1", "9", "18.2b", "17"];
		expect([...ids].sort(compareRuleIds)).toEqual(["9", "10", "17", "17.1", "17.2", "18", "18.2b"]);
	});

	it("orders 17.1 < 17.2 < 18 < 18.2a < 18.2b < 19", () => {
		const ids = ["19", "18.2b", "17.2", "18", "18.2a", "17.1"];
		expect([...ids].sort(compareRuleIds)).toEqual(["17.1", "17.2", "18", "18.2a", "18.2b", "19"]);
	});
});

describe("evaluate — three boats", () => {
	it("yields three pairs with the right right-of-way in each", () => {
		// port: port tack, east of starboard; leeward: same tack as port but south
		// of it (overlapped, so port is windward); starboard: starboard tack.
		const port = boat("a-port", 300, 150, 90);
		const leeward = boat("b-leeward", 300, 350, 90);
		const starboard = boat("c-starboard", 800, 250, 270);
		const result = evalBoats([port, leeward, starboard]);

		expect(Object.keys(result.pairs).sort()).toEqual([pairKey("a-port", "b-leeward"), pairKey("a-port", "c-starboard"), pairKey("b-leeward", "c-starboard")].sort());
		expect(result.pairs[pairKey("a-port", "b-leeward")].rightOfWay).toBe("b-leeward"); // Rule 11
		expect(result.pairs[pairKey("a-port", "c-starboard")].rightOfWay).toBe("c-starboard"); // Rule 10
		expect(result.pairs[pairKey("b-leeward", "c-starboard")].rightOfWay).toBe("c-starboard"); // Rule 10

		// a-port keeps clear of both; b-leeward keeps clear of c-starboard only.
		expect(result.boats["a-port"].standOn).toBe(false);
		expect(result.boats["a-port"].obligations.filter((o) => o.kind === "keepClear")).toHaveLength(2);
		expect(result.boats["b-leeward"].obligations.filter((o) => o.kind === "keepClear")).toMatchObject([{towards: "c-starboard"}]);
		expect(result.boats["c-starboard"].standOn).toBe(true);
	});

	it("uses the first pair by sorted key as the focus pair unless one is given", () => {
		const boats = [boat("a", 300, 150, 90), boat("b", 300, 350, 90), boat("c", 900, 250, 270)];
		expect(evalBoats(boats).focusPair).toBe(pairKey("a", "b"));
		const focused = evalBoats(boats, {}, pairKey("b", "c"));
		expect(focused.focusPair).toBe(pairKey("b", "c"));
		// Rule 10 decides in the b|c pair, Rule 11 in a|b: the deciding flag follows the focus.
		expect(focused.rules.find((r) => r.id === "10")?.deciding).toBe(true);
		expect(focused.rules.find((r) => r.id === "11")?.deciding).toBe(false);
		expect(focused.rules.find((r) => r.id === "11")?.applicable).toBe(true);
	});

	it("has no pairs (and never null) with fewer than two boats", () => {
		const result = evalBoats([boat("solo", 300, 150, 90)]);
		expect(result.pairs).toEqual({});
		expect(result.focusPair).toBeNull();
		expect(result.boats.solo.tack).toBe("PORT");
		expect(result.rules.every((r) => !r.applicable)).toBe(true);
	});
});

describe("rule content", () => {
	it("has an evaluable content entry for every registry rule", () => {
		for (const rule of RULE_REGISTRY) expect(contentOf(rule.id).evaluable, rule.id).toBe(true);
	});

	it("has a registry rule for every evaluable content entry", () => {
		const registered = new Set(RULE_REGISTRY.map((r) => r.id));
		for (const content of Object.values(RULE_CONTENT)) expect(registered.has(content.id) === content.evaluable, content.id).toBe(true);
	});

	it("throws a clear error for an unknown rule id", () => {
		expect(() => contentOf("no-such-rule")).toThrow(/no-such-rule/);
	});

	it("exposes the reference-only rules in id order", () => {
		const result = evaluate(worldOf([]), computeFacts(worldOf([])));
		expect(result.referenceRules.every((c) => !c.evaluable)).toBe(true);
		expect(result.referenceRules.map((c) => c.id)).toEqual([...result.referenceRules.map((c) => c.id)].sort(compareRuleIds));
		expect(result.referenceRules.map((c) => c.id)).toContain("18.2a");
		expect(result.rules.map((r) => r.id)).not.toContain("18");
	});
});

/** Register display content for stub rules (the evaluator looks content up by id). */
function withStubContent(id: string) {
	beforeAll(() => {
		RULE_CONTENT[id] = {id, title: "Stub", description: "", fullText: "", laymanExplanation: "", part: 2, evaluable: true};
	});
	afterAll(() => {
		delete RULE_CONTENT[id];
	});
}

describe("evaluate — rule suspension", () => {
	withStubContent("99");

	/** A stub rule that always fires for a pair and suspends rule 12. */
	const suspender: RuleDefinition = {
		id: "99",
		part: 2,
		section: "D",
		scope: "pair",
		suspends: ["12"],
		evaluate: ({pair}) => [{ruleId: "99", boat: pair!.a.id, towards: pair!.b.id, kind: "giveRoom", detail: "stub"}],
	};

	it("drops a suspended rule's obligations", () => {
		const astern = boat("astern", 300, 300, 90);
		const ahead = boat("ahead", 600, 300, 90);

		const plain = evalPair(astern, ahead);
		expect(isApplicable(plain, "12")).toBe(true);
		expect(plain.boats.astern.standOn).toBe(false);

		const world = worldOf([astern, ahead]);
		const result = evaluate(world, computeFacts(world), {}, undefined, [...RULE_REGISTRY, suspender]);
		expect(isApplicable(result, "99")).toBe(true);
		expect(isApplicable(result, "12")).toBe(false);
		expect(result.obligations.some((o) => o.ruleId === "12")).toBe(false);
		expect(result.boats.astern.standOn).toBe(true); // 12's keepClear was dropped
		expect(pairOf(result, astern, ahead).rightOfWay).toBeNull();
	});
});

describe("evaluate — Rule 13 (While Tacking)", () => {
	it("makes a tacking boat keep clear even when it is on starboard", () => {
		// b is tacking and on starboard; a is on port. Normally Rule 10 would let
		// b (starboard) stand on, but Rule 13 (tacking) overrides it.
		const a = boat("a", 300, 200, 90); // port tack
		const b = boat("b", 400, 200, 270, true); // starboard tack, tacking
		const result = evalPair(a, b);

		expect(pairOf(result, a, b).decidingRuleId).toBe("13");
		expect(result.boats.a.standOn).toBe(true); // a stands on
		expect(result.boats.b.standOn).toBe(false); // b (tacking) keeps clear
	});

	it("ranks Rule 13 first and reports Rule 10 as suspended (not applicable)", () => {
		const a = boat("a", 300, 200, 90); // port tack
		const b = boat("b", 400, 200, 270, true); // starboard tack, tacking
		const result = evalPair(a, b);

		expect(result.rules[0].id).toBe("13");
		expect(result.rules[0].deciding).toBe(true);
		// Rule 10 would apply (opposite tacks) but Rule 13 suspends it.
		const rule10 = result.rules.find((r) => r.id === "10");
		expect(rule10?.applicable).toBe(false);
		expect(rule10?.deciding).toBe(false);
		expect(result.obligations.some((o) => o.ruleId === "10")).toBe(false);
		// Rules 11 and 12 are not applicable (opposite tacks).
		expect(isApplicable(result, "11")).toBe(false);
		expect(isApplicable(result, "12")).toBe(false);
	});

	it("also suspends Rule 11 for a tacking windward boat", () => {
		const windward = boat("windward", 300, 150, 90, true);
		const leeward = boat("leeward", 300, 350, 90);
		const result = evalPair(windward, leeward);
		expect(isApplicable(result, "13")).toBe(true);
		expect(isApplicable(result, "11")).toBe(false);
		expect(pairOf(result, windward, leeward).rightOfWay).toBe("leeward");
	});

	it("keeps both boats clear when both are tacking and neither test separates them", () => {
		// Abreast on the same line, so neither is on the other's port side or astern.
		const a = boat("a", 300, 200, 90, true);
		const b = boat("b", 400, 200, 270, true);
		const result = evalPair(a, b);

		expect(pairOf(result, a, b).decidingRuleId).toBe("13");
		expect(pairOf(result, a, b).rightOfWay).toBeNull();
		expect(result.boats.a.standOn).toBe(false);
		expect(result.boats.b.standOn).toBe(false);
	});

	it("both tacking: the boat on the other's port side keeps clear", () => {
		// Both heading 45°. b lies to a's starboard, so a lies on b's port side.
		const a = boat("a", 300, 200, 45, true);
		const b = boat("b", 400, 200, 45, true);
		const result = evalPair(a, b);

		expect(result.boats.a.standOn).toBe(false);
		expect(result.boats.b.standOn).toBe(true);
		expect(pairOf(result, a, b).rightOfWay).toBe("b");
	});

	it("both tacking: with no port/starboard difference the boat astern keeps clear", () => {
		// In line astern, heading east: neither is to the side of the other.
		const astern = boat("astern", 300, 300, 90, true);
		const ahead = boat("ahead", 600, 300, 90, true);
		const result = evalPair(astern, ahead);

		expect(result.boats.astern.standOn).toBe(false);
		expect(result.boats.ahead.standOn).toBe(true);
		expect(pairOf(result, astern, ahead).rightOfWay).toBe("ahead");
	});
});

describe("evaluate — Rule 14 (Avoiding Contact)", () => {
	it("co-applies when boats are close, without deciding right of way", () => {
		const a = boat("a", 300, 150, 90);
		const b = boat("b", 300, 350, 90); // hulls 100px apart → within risk distance
		const result = evalPair(a, b);

		const rule14 = result.rules.find((r) => r.id === "14");
		expect(rule14?.applicable).toBe(true);
		expect(rule14?.deciding).toBe(false);
		// It owes avoidContact on both boats and never changes the right-of-way outcome.
		expect(result.boats.a.obligations.some((o) => o.kind === "avoidContact")).toBe(true);
		expect(result.boats.b.obligations.some((o) => o.kind === "avoidContact")).toBe(true);
		expect(pairOf(result, a, b).decidingRuleId).toBe("11");
	});

	it("always applies in the engine, but the sidebar only shows it when boats are close", () => {
		const farA = boat("a", 100, 100, 90);
		const farB = boat("b", 900, 100, 90); // hulls 600px apart
		const far = evalPair(farA, farB);
		expect(isApplicable(far, "14")).toBe(true);
		expect(pairOf(far, farA, farB).separation).toBeGreaterThan(CONTACT_RISK_DISTANCE);

		const rule14 = far.rules.find((r) => r.id === "14") as RuleState;
		expect(isShownApplicable(rule14, pairOf(far, farA, farB))).toBe(false);

		const nearA = boat("a", 300, 150, 90);
		const nearB = boat("b", 300, 350, 90);
		const near = evalPair(nearA, nearB);
		expect(isShownApplicable(near.rules.find((r) => r.id === "14") as RuleState, pairOf(near, nearA, nearB))).toBe(true);
	});

	it("flags a collision (overlapping hulls) without changing right of way", () => {
		const a = boat("a", 300, 150, 90);
		const b = boat("b", 300, 220, 90); // hulls overlap by 30px
		const result = evalPair(a, b);

		expect(pairOf(result, a, b).collided).toBe(true);
		expect(pairOf(result, a, b).decidingRuleId).toBe("11"); // right of way is still decided by 10–13

		const rule14 = result.rules.find((r) => r.id === "14");
		expect(rule14?.applicable).toBe(true);
		expect(rule14?.deciding).toBe(false); // Rule 14 is a limitation, not a right-of-way rule
		expect(rule14?.detail).toContain("Collision");
	});
});

describe("evaluate — Rule 15 (Acquiring Right of Way)", () => {
	it("applies when right of way has just changed hands", () => {
		const a = boat("a", 300, 200, 90); // port
		const b = boat("b", 400, 200, 270); // starboard → b stands on
		const result = evalPair(a, b, WIND_NORTH, {prevRightOfWay: {[pairKey("a", "b")]: "a"}}); // a used to stand on

		const rule15 = result.rules.find((r) => r.id === "15");
		expect(rule15?.applicable).toBe(true);
		expect(rule15?.deciding).toBe(false);
		expect(duties(result, "b")).toMatchObject([{ruleId: "15", kind: "giveRoom", towards: "a"}]);
		expect(pairOf(result, a, b).decidingRuleId).toBe("10"); // right-of-way decision unchanged
	});

	it("does not apply when right of way is unchanged", () => {
		const a = boat("a", 300, 200, 90);
		const b = boat("b", 400, 200, 270);
		const result = evalPair(a, b, WIND_NORTH, {prevRightOfWay: {[pairKey("a", "b")]: "b"}}); // b stood on before too

		expect(isApplicable(result, "15")).toBe(false);
	});

	it("does not apply when there was no previous right-of-way boat", () => {
		const a = boat("a", 300, 200, 90);
		const b = boat("b", 400, 200, 270);
		expect(isApplicable(evalPair(a, b, WIND_NORTH, {prevRightOfWay: {[pairKey("a", "b")]: null}}), "15")).toBe(false);
		expect(isApplicable(evalPair(a, b), "15")).toBe(false);
	});
});

describe("evaluate — Rule 16 (Changing Course)", () => {
	it("applies when the right-of-way boat is changing course", () => {
		const a = boat("a", 300, 200, 90); // port
		const b = boat("b", 400, 200, 270); // starboard → b stands on
		const result = evalPair(a, b, WIND_NORTH, {changingCourse: {b: true}});

		const rule16 = result.rules.find((r) => r.id === "16");
		expect(rule16?.applicable).toBe(true);
		expect(rule16?.deciding).toBe(false);
		expect(duties(result, "b")).toMatchObject([{ruleId: "16", kind: "giveRoom", towards: "a"}]);
	});

	it("does not apply when the give-way boat changes course", () => {
		const a = boat("a", 300, 200, 90);
		const b = boat("b", 400, 200, 270);
		const result = evalPair(a, b, WIND_NORTH, {changingCourse: {a: true}}); // a is give-way

		expect(isApplicable(result, "16")).toBe(false);
	});
});

describe("evaluate — Rule 17 (On the Same Tack; Proper Course)", () => {
	it("17.1 applies when a leeward boat that came from astern sails above her proper course", () => {
		// a is windward (north), b is leeward and abeam to the south-east of a;
		// both on port tack, so they are overlapped. Proper course is inferred as
		// close-hauled on port tack (45°); b is pinching up to 30°, i.e. above
		// her proper course.
		const a = boat("a", 300, 150, 45);
		const b = boat("b", 441, 291, 30);
		const result = evalPair(a, b, WIND_NORTH, {leewardFromAstern: {[pairKey("a", "b")]: {b: true}}});

		const rule171 = result.rules.find((r) => r.id === "17.1");
		expect(rule171?.applicable).toBe(true);
		expect(rule171?.deciding).toBe(false);
		expect(rule171?.detail).toContain("17.1");
		expect(duties(result, "b")).toMatchObject([{ruleId: "17.1", kind: "notAboveProperCourse", towards: "a"}]);
		expect(pairOf(result, a, b).decidingRuleId).toBe("11"); // right-of-way decision unchanged
	});

	it("17.1 does not apply without the clear-astern-to-leeward transition", () => {
		// Same geometry, but b has not (latch absent) established the overlap from astern.
		const a = boat("a", 300, 150, 45);
		const b = boat("b", 300, 350, 30);
		const result = evalPair(a, b); // no latch

		expect(isApplicable(result, "17.1")).toBe(false);
	});

	it("17.2 applies when a windward boat sails below her proper course (not on a beat)", () => {
		// a is windward (north) and is on a broad reach (135°), below her inferred
		// close-hauled proper course (45°).
		const a = boat("a", 300, 150, 135);
		const b = boat("b", 300, 350, 90);
		const result = evalPair(a, b);

		const rule172 = result.rules.find((r) => r.id === "17.2");
		expect(rule172?.applicable).toBe(true);
		expect(rule172?.detail).toContain("17.2");
		expect(result.boats.a.obligations.some((o) => o.kind === "notBelowProperCourse")).toBe(true);
		expect(pairOf(result, a, b).decidingRuleId).toBe("11"); // right-of-way decision unchanged
	});

	it("does not apply when the boats are more than two hull lengths apart", () => {
		// b came from astern and sails above proper course, but they are 600px apart
		// (> TWO_HULL_LENGTHS ≈ 323px).
		const a = boat("a", 300, 100, 45);
		const b = boat("b", 300, 700, 30);
		const result = evalPair(a, b, WIND_NORTH, {leewardFromAstern: {[pairKey("a", "b")]: {b: true}}});

		expect(isApplicable(result, "17.1")).toBe(false);
		expect(isApplicable(result, "17.2")).toBe(false);
	});
});

describe("evaluate — obligations beyond keepClear (stub rule)", () => {
	withStubContent("18.stub");
	it("lets the Rule 11 right-of-way boat keep right of way while owing giveMarkRoom", () => {
		// Stub for a future Section C rule: the right-of-way boat owes mark-room.
		const stub: RuleDefinition = {
			id: "18.stub",
			part: 2,
			section: "C",
			scope: "pair",
			needsRightOfWay: true,
			evaluate: ({pair, rightOfWay}) => {
				if (!pair || !rightOfWay) return [];
				const other = pair.a.id === rightOfWay ? pair.b.id : pair.a.id;
				return [{ruleId: "18.stub", boat: rightOfWay, towards: other, kind: "giveMarkRoom", detail: "stub mark-room"}];
			},
		};
		const windward = boat("windward", 300, 150, 90);
		const leeward = boat("leeward", 300, 350, 90);
		const world = worldOf([windward, leeward]);
		const result = evaluate(world, computeFacts(world), {}, undefined, [...RULE_REGISTRY, stub]);

		const pair = pairOf(result, windward, leeward);
		expect(pair.decidingRuleId).toBe("11");
		expect(pair.rightOfWay).toBe("leeward"); // still has right of way...
		expect(result.boats.leeward.standOn).toBe(true);
		expect(duties(result, "leeward")).toMatchObject([{ruleId: "18.stub", kind: "giveMarkRoom", towards: "windward"}]); // ...yet owes mark-room
		expect(isApplicable(result, "18.stub")).toBe(true);
	});
});

describe("computeMeetingFacts (two-boat wrapper)", () => {
	it("keeps the caller's boat order and matches computeFacts semantics", () => {
		const a = boat("a", 300, 350, 90);
		const b = boat("b", 300, 150, 90);
		const {facts} = computeMeetingFacts(a, b, WIND_NORTH);
		expect(facts.overlapped).toBe(true);
		expect(facts.windwardIsA).toBe(false); // b is north = windward
	});
});

describe("computeFacts", () => {
	function threeBoatWorld(): WorldState {
		return {
			...createDefaultWorld(),
			boats: [
				boatPx("alpha", 300, 150, 90), // port tack, abeam of bravo
				boatPx("bravo", 300, 350, 90), // port tack, leeward of alpha
				boatPx("charlie", 1200, 250, 270), // starboard tack, far away
			],
		};
	}

	it("yields one entry per boat and one per pair", () => {
		const facts = computeFacts(threeBoatWorld());
		expect(Object.keys(facts.boats).sort()).toEqual(["alpha", "bravo", "charlie"]);
		expect(Object.keys(facts.pairs).sort()).toEqual(["alpha|bravo", "alpha|charlie", "bravo|charlie"]);
		expect(pairKey("bravo", "alpha")).toBe("alpha|bravo");
	});

	it("reports per-boat tack, point of sail and trim", () => {
		const facts = computeFacts(threeBoatWorld());
		expect(facts.boats.alpha.tack).toBe("PORT");
		expect(facts.boats.charlie.tack).toBe("STARBOARD");
		expect(facts.boats.alpha.pointOfSail).toBe("BEAM_REACH");
		expect(facts.boats.alpha.sailTrimAngle).toBeCloseTo(45);
	});

	it("reports per-pair overlap, tack and windward facts", () => {
		const {pairs} = computeFacts(threeBoatWorld());

		const ab = pairs[pairKey("alpha", "bravo")];
		expect(ab.a).toBe("alpha");
		expect(ab.b).toBe("bravo");
		expect(ab.sameTack).toBe(true);
		expect(ab.overlapped).toBe(true);
		expect(ab.windwardIsA).toBe(true); // alpha is north of bravo
		expect(ab.collided).toBe(false);
		expect(px(ab.separation)).toBeCloseTo(122.34, 0);

		const ac = pairs[pairKey("alpha", "charlie")];
		expect(ac.sameTack).toBe(false);
		expect(ac.overlapped).toBeNull();
		expect(ac.windwardIsA).toBeNull();
		expect(ac.clearAheadIsA).toBeNull();
	});

	it("falls back to the previous tack while a boat is head-to-wind", () => {
		const world: WorldState = {...createDefaultWorld(), boats: [boatPx("a", 300, 300, 0)]};
		expect(computeFacts(world).boats.a.tack).toBeNull();
		expect(computeFacts(world, {a: "PORT"}).boats.a.tack).toBe("PORT");
	});
});

describe("worldReducer", () => {
	it("builds the default world from the old pixel scene", () => {
		const world = createDefaultWorld();
		expect(world.boats.map((b) => b.id)).toEqual(["boat1", "boat2"]);
		expect(px(world.boats[0].x)).toBeCloseTo(300, 6);
		expect(px(world.boats[0].y)).toBeCloseTo(150, 6);
		expect(px(world.boats[1].y)).toBeCloseTo(350, 6);
		expect(world.boats[0].heading).toBe(90);
		expect(world.wind.direction).toBe(0);
		expect(world.race.phase).toBe("started");
		expect(world.marks).toEqual([]);
		expect(world.course.legs).toEqual([]);
	});

	it("moves and rotates only the targeted boat, immutably", () => {
		const before = createDefaultWorld();
		const moved = worldReducer(before, {type: "moveBoat", id: "boat1", x: 5, y: 6});
		expect(moved.boats[0]).toMatchObject({x: 5, y: 6});
		expect(moved.boats[1]).toBe(before.boats[1]);
		expect(before.boats[0].x).not.toBe(5);

		const rotated = worldReducer(moved, {type: "rotateBoat", id: "boat2", heading: 200});
		expect(rotated.boats[1].heading).toBe(200);
		expect(rotated.boats[0].heading).toBe(90);
	});

	it("sets wind and sets the next leg", () => {
		let world = createDefaultWorld();
		world = worldReducer(world, {type: "setWind", direction: 135});
		expect(world.wind.direction).toBe(135);
		world = worldReducer(world, {type: "setNextLeg", id: "boat1", legIndex: 2});
		expect(world.boats[0].nextLegIndex).toBe(2);
	});

	it("adds boats with fresh ids, removes boats and loads scenarios", () => {
		let world = createDefaultWorld();
		world = worldReducer(world, {type: "addBoat"});
		expect(world.boats.map((b) => b.id)).toEqual(["boat1", "boat2", "boat3"]);
		world = worldReducer(world, {type: "addBoat", boat: {id: "boat3"}}); // duplicate id ignored
		expect(world.boats).toHaveLength(3);
		world = worldReducer(world, {type: "removeBoat", id: "boat2"});
		expect(world.boats.map((b) => b.id)).toEqual(["boat1", "boat3"]);

		const scenario = {...createDefaultWorld(), wind: {direction: 90}};
		expect(worldReducer(world, {type: "loadScenario", world: scenario})).toBe(scenario);
	});
});
