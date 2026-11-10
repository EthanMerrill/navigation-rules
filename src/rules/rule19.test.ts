import type {BoatState, Obstruction, WorldState} from "../model/world";
import {createDefaultWorld} from "../state/worldReducer";
import {step} from "./rulesEngine";
import type {EngineMemory, RuleEvaluation} from "./rulesEngine";

// Wind from the north; boats head east (90, port tack, beam reach) towards an obstruction
// at (10, 10). The boat with the larger y is the one closer to the obstruction side (south).
const OBS: Obstruction = {id: "o", x: 10, y: 10, radius: 1};

function boat(id: string, x: number, y: number, heading = 90): BoatState {
	return {id, x, y, heading, nextLegIndex: 0};
}

function worldOf(boats: BoatState[], obstruction: Obstruction = OBS): WorldState {
	return {...createDefaultWorld(), boats, wind: {direction: 0}, obstructions: [obstruction]};
}

function run(worlds: WorldState[]): RuleEvaluation[] {
	let memory: EngineMemory | null = null;
	return worlds.map((world, i) => {
		const result = step(world, memory, i * 16);
		memory = result.memory;
		return result.evaluation;
	});
}

const fired = (e: RuleEvaluation, id: string) => e.rules.find((r) => r.id === id)?.applicable === true;
const giveRoom = (e: RuleEvaluation, ruleId: string) => e.obligations.filter((o) => o.ruleId === ruleId && o.kind === "giveRoom").map((o) => [o.boat, o.towards]);

describe("Rule 19 — applicability", () => {
	it("does not apply when nobody is approaching the obstruction", () => {
		const e = run([worldOf([boat("a", 1, 7), boat("b", 1, 8.5)])])[0];
		expect(fired(e, "19.2b")).toBe(false);
	});

	it("does not apply when the boats would pass on opposite sides", () => {
		const e = run([worldOf([boat("a", 6.5, 8), boat("b", 6.5, 12)])])[0];
		expect(fired(e, "19.2b")).toBe(false);
	});
});

describe("Rule 19.2(a) — right-of-way boat changing course", () => {
	// Overlapped on port tack, obstruction to the south: b (south) is leeward and has right of way (Rule 11).
	const a = boat("a", 6.5, 7.5);
	const b = (heading: number) => boat("b", 6.5, 8.8, heading);

	it("makes the right-of-way boat give room when she changes course while approaching the obstruction", () => {
		const e = run([worldOf([a, b(90)]), worldOf([a, b(96)])])[1];
		expect(e.pairs["a|b"].rightOfWay).toBe("b");
		expect(giveRoom(e, "19.2a")).toEqual([["b", "a"]]);
	});

	it("does not apply when she holds her course, or when the give-way boat is the one turning", () => {
		expect(fired(run([worldOf([a, b(90)]), worldOf([a, b(90)])])[1], "19.2a")).toBe(false);
		expect(fired(run([worldOf([a, b(90)]), worldOf([boat("a", 6.5, 7.5, 96), b(90)])])[1], "19.2a")).toBe(false);
	});

	it("does not apply when no obstruction is being approached", () => {
		const far: Obstruction = {id: "o", x: 40, y: 40, radius: 1};
		expect(fired(run([worldOf([a, b(90)], far), worldOf([a, b(96)], far)])[1], "19.2a")).toBe(false);
	});
});

describe("Rule 19.2(b)", () => {
	// Obstruction to the south of both boats; b (larger y) is inside.
	const a = boat("a", 6.5, 7.5);
	const b = boat("b", 6.5, 8.8);

	it("makes the outside boat give the inside boat room", () => {
		const e = run([worldOf([a, b])])[0];
		expect(fired(e, "19.2b")).toBe(true);
		expect(giveRoom(e, "19.2b")).toEqual([["a", "b"]]);
		expect(e.obligations.find((o) => o.ruleId === "19.2b")!.detail).toContain("o");
	});

	it("does not apply when one boat is clear astern", () => {
		const e = run([worldOf([a, boat("b", 3, 8.8)])])[0];
		expect(fired(e, "19.2b")).toBe(false);
	});
});

describe("Rule 19.2(c) — no room when the overlap begins", () => {
	it("suppresses 19.2(b) when there was no room for the boat coming from astern", () => {
		// a sits close to the obstruction (gap < one beam); b comes up from astern on the inside.
		const big: Obstruction = {id: "o", x: 10, y: 12, radius: 2};
		const a = boat("a", 8.6, 9.9);
		const frames = [worldOf([a, boat("b", 4, 10.5)], big), worldOf([a, boat("b", 8.6, 10.5)], big), worldOf([a, boat("b", 8.9, 10.5)], big)];
		const evaluations = run(frames);
		expect(fired(evaluations[0], "19.2b")).toBe(false);
		for (const e of evaluations.slice(1)) {
			expect(fired(e, "19.2c")).toBe(true);
			expect(fired(e, "19.2b")).toBe(false);
		}
	});

	it("makes the squeezing-in boat keep clear and suspends rules 10 and 11 while they stay overlapped", () => {
		const big: Obstruction = {id: "o", x: 10, y: 12, radius: 2};
		const a = boat("a", 8.6, 9.9);
		const e = run([worldOf([a, boat("b", 4, 10.5)], big), worldOf([a, boat("b", 8.6, 10.5)], big)])[1];
		expect(e.obligations.filter((o) => o.ruleId === "19.2c").map((o) => [o.boat, o.towards, o.kind])).toEqual([["b", "a", "keepClear"]]);
		expect(fired(e, "11")).toBe(false);
		expect(fired(e, "10")).toBe(false);
		expect(e.pairs["a|b"].rightOfWay).toBe("a");
		expect(e.pairs["a|b"].decidingRuleId).toBe("19.2c");
	});

	it("lets 19.2(b) stand when there was room at the moment the overlap began", () => {
		const big: Obstruction = {id: "o", x: 10, y: 14, radius: 2};
		const a = boat("a", 6.5, 8);
		const frames = [worldOf([a, boat("b", 3, 10)], big), worldOf([a, boat("b", 6.5, 10)], big)];
		const e = run(frames)[1];
		expect(fired(e, "19.2c")).toBe(false);
		expect(giveRoom(e, "19.2b")).toEqual([["a", "b"]]);
	});

	it("releases the latch when the overlap ends", () => {
		const big: Obstruction = {id: "o", x: 10, y: 12, radius: 2};
		const a = boat("a", 8.6, 9.9);
		const frames = [worldOf([a, boat("b", 4, 10.5)], big), worldOf([a, boat("b", 8.6, 10.5)], big), worldOf([a, boat("b", 4, 10.5)], big), worldOf([a, boat("b", 8.6, 10.5)], big)];
		const evaluations = run(frames);
		expect(fired(evaluations[1], "19.2c")).toBe(true);
		expect(fired(evaluations[2], "19.2c")).toBe(false);
		// The overlap began again with the same geometry, so the latch is retaken.
		expect(fired(evaluations[3], "19.2c")).toBe(true);
	});
});
