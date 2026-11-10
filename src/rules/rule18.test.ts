import type {BoatState, Mark, WorldState} from "../model/world";
import {createDefaultWorld} from "../state/worldReducer";
import {obligationLabels} from "../ui/obligationLabels";
import {step} from "./rulesEngine";
import type {EngineMemory, Obligation, RuleEvaluation} from "./rulesEngine";

// Wind from the north (0 degrees). Positions in hull lengths. Unless stated,
// the mark is a windward mark at (10, 10) to be left to port and the boats are
// close-hauled on starboard tack (heading 315) approaching from the south-east.
const MARK: Mark = {id: "m", x: 10, y: 10, roundingSide: "port", kind: "windward"};

function boat(id: string, x: number, y: number, heading: number, nextLegIndex = 0): BoatState {
	return {id, x, y, heading, nextLegIndex};
}

function worldOf(boats: BoatState[], marks: Mark[] = [MARK]): WorldState {
	return {...createDefaultWorld(), boats, wind: {direction: 0}, marks, course: {legs: marks.map((m) => ({toMarkId: m.id}))}};
}

function run(worlds: WorldState[], memory: EngineMemory | null = null): {evaluations: RuleEvaluation[]; memory: EngineMemory | null} {
	const evaluations: RuleEvaluation[] = [];
	worlds.forEach((world, i) => {
		const result = step(world, memory, i * 16);
		evaluations.push(result.evaluation);
		memory = result.memory;
	});
	return {evaluations, memory};
}

const last = (frames: RuleEvaluation[]) => frames[frames.length - 1];
const fired = (e: RuleEvaluation, id: string) => e.rules.find((r) => r.id === id)?.applicable === true;
const markRoom = (e: RuleEvaluation): Obligation[] => e.obligations.filter((o) => o.kind === "giveMarkRoom");
const rule18Ids = ["18.2a", "18.2b", "18.2c", "18.3", "18.4"];
const anyRule18 = (e: RuleEvaluation) => rule18Ids.some((id) => fired(e, id));

// `a` is inside (closer to the mark across the boats' heading), `b` outside; abreast.
const farA = boat("a", 14.5, 15.5, 315);
const farB = boat("b", 16, 14, 315);
const nearA = boat("a", 11.5, 12.5, 315);
const nearB = boat("b", 13, 11, 315);

describe("Rule 18.1 — applicability", () => {
	it("does not apply when neither boat is in the zone", () => {
		expect(anyRule18(last(run([worldOf([farA, farB])]).evaluations))).toBe(false);
	});

	it("does not apply between opposite-tack boats that are both on a beat to windward", () => {
		const portTack = boat("b", 13, 11, 45); // close-hauled on port tack
		const {evaluations} = run([worldOf([nearA, portTack])]);
		expect(anyRule18(last(evaluations))).toBe(false);
		expect(fired(last(evaluations), "10")).toBe(true);
	});

	it("does not apply when the boats are heading for different marks", () => {
		const other: Mark = {id: "m2", x: 30, y: 30, roundingSide: "port", kind: "leeward"};
		const {evaluations} = run([worldOf([nearA, boat("b", 13, 11, 315, 1)], [MARK, other])]);
		expect(anyRule18(last(evaluations))).toBe(false);
	});

	it("does not apply between a boat approaching the mark and one that has left it", () => {
		const {evaluations} = run([worldOf([nearA, boat("b", 13, 11, 315, 1)])]);
		expect(anyRule18(last(evaluations))).toBe(false);
	});

	it("applies to opposite-tack boats that are not both beating", () => {
		// b is on port tack on a beam reach to the east: opposite tack to a, but not close-hauled.
		const {evaluations} = run([worldOf([nearA, boat("b", 13, 11, 90)])]);
		expect(anyRule18(last(evaluations))).toBe(true);
	});
});

describe("Rule 18.2(a) and (b)", () => {
	it("makes the outside boat give the inside boat mark-room", () => {
		const {evaluations} = run([worldOf([nearA, nearB])]);
		const e = last(evaluations);
		expect(markRoom(e).map((o) => [o.boat, o.towards])).toEqual([["b", "a"]]);
		// On the very frame the latch is taken it already binds: 18.2(b) fires and suspends 18.2(a).
		expect(fired(e, "18.2b")).toBe(true);
		expect(fired(e, "18.2a")).toBe(false);
	});

	it("uses 18.2(a) when the pair has no zone-entry latch", () => {
		// Evaluate from a memory whose latch for the pair has been released.
		const first = run([worldOf([nearA, nearB])]);
		const released = {...first.memory!, pairMarks: {"a|b|m": {...first.memory!.pairMarks["a|b|m"], released: true}}};
		const e = last(run([worldOf([nearA, nearB])], released).evaluations);
		expect(fired(e, "18.2a")).toBe(true);
		expect(fired(e, "18.2b")).toBe(false);
		expect(markRoom(e).map((o) => [o.boat, o.towards])).toEqual([["b", "a"]]);
	});

	it("gives mark-room to the boat that was clear ahead when the first boat reached the zone", () => {
		const aheadInZone = boat("a", 11.5, 12.5, 315);
		const behind = boat("b", 20, 20, 315);
		const {evaluations} = run([worldOf([farA, behind]), worldOf([aheadInZone, behind])]);
		const e = last(evaluations);
		expect(fired(e, "18.2b")).toBe(true);
		expect(markRoom(e).map((o) => [o.boat, o.towards])).toEqual([["b", "a"]]);
	});
});

describe("Rule 18.2(c) — the latch outlives the overlap", () => {
	it("keeps the outside boat giving mark-room after the overlap is broken, shown as 18.2(c)", () => {
		const dropped = boat("b", 16, 17, 315); // far astern of a, still heading for the mark
		const {evaluations} = run([worldOf([farA, farB]), worldOf([nearA, nearB]), worldOf([nearA, dropped])]);
		expect(fired(evaluations[1], "18.2b")).toBe(true);
		expect(fired(evaluations[1], "18.2c")).toBe(false);
		const e = evaluations[2];
		expect(fired(e, "18.2c")).toBe(true);
		expect(fired(e, "18.2b")).toBe(false);
		expect(fired(e, "18.2a")).toBe(false);
		expect(markRoom(e).map((o) => [o.ruleId, o.boat, o.towards])).toEqual([["18.2c", "b", "a"]]);
	});
});

describe("Rule 18.2(d) — release of the latch", () => {
	it("ends the duty when the entitled boat leaves the zone", () => {
		const aLeft = boat("a", 18, 18, 315);
		const {evaluations, memory} = run([worldOf([farA, farB]), worldOf([nearA, nearB]), worldOf([aLeft, nearB])]);
		expect(markRoom(evaluations[1])).toHaveLength(1);
		expect(markRoom(last(evaluations))).toHaveLength(0);
		expect(memory!.pairMarks["a|b|m"].released).toBe(true);
	});

	it("ends the duty when the entitled boat passes head to wind", () => {
		const headings = [315, 350, 2, 20];
		const frames = headings.map((h) => worldOf([{...nearA, heading: h}, nearB]));
		const {evaluations} = run([worldOf([farA, farB]), ...frames]);
		expect(markRoom(evaluations[1])).toHaveLength(1);
		expect(markRoom(last(evaluations))).toHaveLength(0);
	});
});

describe("Rule 18.3 — tacking in the zone", () => {
	// `a` is on port tack in the zone and tacks onto starboard; `b` is already on starboard tack in the zone.
	const tacker = (heading: number) => boat("a", 12.7, 11.3, heading);
	const stbd = boat("b", 11.5, 12.5, 315);
	const headings = [45, 20, 3, 350, 330, 315];
	const frames = () => run(headings.map((h) => worldOf([tacker(h), stbd])));

	it("does not apply while the tacker is still on port tack, or when nobody tacked", () => {
		const {evaluations} = frames();
		expect(fired(evaluations[0], "18.3")).toBe(false);
		const steady = run([worldOf([boat("a", 12.7, 11.3, 315), stbd]), worldOf([boat("a", 12.7, 11.3, 315), stbd])]);
		expect(fired(last(steady.evaluations), "18.3")).toBe(false);
	});

	it("makes the tacker keep clear and give mark-room once she is fetching, suspending 10/11/12 and 18.2", () => {
		const {evaluations, memory} = frames();
		expect(memory!.boats.a.tackedInZoneOf).toBe("m");
		const e = last(evaluations);
		expect(fired(e, "18.3")).toBe(true);
		const mine = e.obligations.filter((o) => o.ruleId === "18.3").map((o) => [o.boat, o.towards, o.kind]);
		expect(mine).toEqual([
			["a", "b", "keepClear"],
			["a", "b", "giveMarkRoom"],
		]);
		for (const id of ["10", "11", "12", "18.2a", "18.2b", "18.2c"]) expect(fired(e, id), id).toBe(false);
		// The evaluator's right-of-way derivation copes: only the tacker keeps clear.
		expect(e.pairs["a|b"].rightOfWay).toBe("b");
		expect(e.pairs["a|b"].decidingRuleId).toBe("18.3");
	});

	it("forgets the tack once she leaves the zone", () => {
		const out = boat("a", 30, 30, 315);
		const {memory} = run([...headings.map((h) => worldOf([tacker(h), stbd])), worldOf([out, stbd])]);
		expect(memory!.boats.a.tackedInZoneOf).toBeUndefined();
	});
});

describe("Rule 18.4 — gybing", () => {
	// A leeward mark to be left to port, boats running on starboard tack (heading 195) from the north.
	const leewardMark: Mark = {id: "m", x: 10, y: 10, roundingSide: "port", kind: "leeward"};
	const east = boat("east", 9.78, 7.48, 195); // inside (mark is to the east, on her port side) and to leeward
	const west = boat("west", 8.78, 7.4, 195);

	it("limits the inside right-of-way boat that must gybe", () => {
		const {evaluations} = run([worldOf([east, west], [leewardMark])]);
		const e = last(evaluations);
		expect(e.pairs["east|west"].rightOfWay).toBe("east");
		expect(e.obligations.filter((o) => o.kind === "sailNoFartherFromMark").map((o) => [o.ruleId, o.boat])).toEqual([["18.4", "east"]]);
	});

	it("does not apply at a gate mark, nor when no gybe is needed", () => {
		expect(fired(last(run([worldOf([east, west], [{...leewardMark, kind: "gate"}])]).evaluations), "18.4")).toBe(false);
		// Port tack (heading 165): leaving the mark to port needs no gybe.
		const portEast = {...east, heading: 165};
		const portWest = {...west, heading: 165};
		expect(fired(last(run([worldOf([portEast, portWest], [leewardMark])]).evaluations), "18.4")).toBe(false);
	});
});

describe("Rule 18 alongside Rule 11", () => {
	it("lets the leeward right-of-way boat owe mark-room to the windward inside boat", () => {
		// Mark left to starboard: the inside boat is the one on the right, which is the windward boat.
		const starboardMark: Mark = {...MARK, roundingSide: "starboard"};
		const windward = boat("inside", 11.36, 12.64, 315);
		const leeward = boat("outside", 10.66, 13.34, 315);
		const e = last(run([worldOf([windward, leeward], [starboardMark])]).evaluations);

		expect(e.boats.outside.standOn).toBe(true); // Rule 11: leeward boat has right of way
		expect(e.boats.inside.obligations.some((o) => o.ruleId === "11" && o.kind === "keepClear")).toBe(true);
		expect(e.boats.outside.obligations.some((o) => o.kind === "giveMarkRoom" && o.towards === "inside")).toBe(true);
		expect(fired(e, "11")).toBe(true);
		expect(fired(e, "18.2b")).toBe(true);
		expect(obligationLabels(e.boats.outside.obligations)).toContain("Give mark-room to inside");
	});
});
