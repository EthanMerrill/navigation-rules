import {step} from "../rules/rulesEngine";
import {SCENARIOS, cloneWorld, findScenario} from "./index";

describe("scenarios", () => {
	it("have unique ids", () => {
		const ids = SCENARIOS.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).toEqual(expect.arrayContaining(["port-starboard", "windward-leeward", "clear-astern", "windward-mark", "leeward-mark", "tack-in-zone", "obstruction", "continuing-obstruction"]));
	});

	it.each(SCENARIOS.map((s) => [s.id, s] as const))("%s has two or more boats and valid legs", (_id, scenario) => {
		const {world} = scenario;
		expect(world.boats.length).toBeGreaterThanOrEqual(2);
		for (const boat of world.boats) {
			if (world.course.legs.length > 0) expect(world.course.legs[boat.nextLegIndex]).toBeDefined();
		}
		for (const leg of world.course.legs) {
			expect(world.marks.some((m) => m.id === leg.toMarkId)).toBe(true);
		}
		expect(() => step(world, null, 0)).not.toThrow();
	});

	it.each([
		["port-starboard", "10"],
		["windward-leeward", "11"],
		["clear-astern", "12"],
	])("%s is decided by rule %s", (id, ruleId) => {
		const scenario = findScenario(id);
		const {evaluation} = step(scenario!.world, null, 0);
		const pair = evaluation.pairs[evaluation.focusPair!];
		expect(pair.decidingRuleId).toBe(ruleId);
	});

	it("windward-mark shows 18.2(b): the outside boat gives the inside boat mark-room, boat 3 gives both room", () => {
		const {evaluation} = step(findScenario("windward-mark")!.world, null, 0);
		const pairs = evaluation.obligations.filter((o) => o.ruleId === "18.2b").map((o) => `${o.boat}>${o.towards}`);
		expect(pairs).toEqual(expect.arrayContaining(["boat2>boat1", "boat3>boat1", "boat3>boat2"]));
	});

	it("leeward-mark: the Rule 11 right-of-way boat owes mark-room to the inside boat", () => {
		const {evaluation} = step(findScenario("leeward-mark")!.world, null, 0);
		expect(evaluation.boats.boat2.standOn).toBe(true);
		expect(evaluation.boats.boat2.obligations.some((o) => o.kind === "giveMarkRoom" && o.towards === "boat1")).toBe(true);
	});

	it("tack-in-zone: rotating boat 1 through the wind brings in Rule 18.3", () => {
		const base = findScenario("tack-in-zone")!.world;
		let memory = step(base, null, 0).memory;
		let evaluation = step(base, null, 0).evaluation;
		expect(evaluation.rules.find((r) => r.id === "18.3")?.applicable).toBe(false);
		[20, 3, 350, 330, 315].forEach((heading, i) => {
			const world = {...base, boats: base.boats.map((b) => (b.id === "boat1" ? {...b, heading} : b))};
			const result = step(world, memory, (i + 1) * 16);
			memory = result.memory;
			evaluation = result.evaluation;
		});
		expect(evaluation.rules.find((r) => r.id === "18.3")?.applicable).toBe(true);
	});

	it("obstruction shows 19.2(b): the outside boat gives the inside boat room", () => {
		const {evaluation} = step(findScenario("obstruction")!.world, null, 0);
		expect(evaluation.obligations.filter((o) => o.ruleId === "19.2b").map((o) => `${o.boat}>${o.towards}`)).toEqual(["boat1>boat2"]);
	});

	it("continuing-obstruction: boat 2 squeezing in from astern is not entitled to room (19.2(c))", () => {
		const base = findScenario("continuing-obstruction")!.world;
		const first = step(base, null, 0);
		expect(first.evaluation.rules.find((r) => r.id === "19.2b")?.applicable).toBe(false);
		const boat1 = base.boats[0];
		const squeezed = {...base, boats: base.boats.map((b) => (b.id === "boat2" ? {...b, x: boat1.x, y: boat1.y + 0.7} : b))};
		const {evaluation} = step(squeezed, first.memory, 16);
		expect(evaluation.rules.find((r) => r.id === "19.2c")?.applicable).toBe(true);
		expect(evaluation.rules.find((r) => r.id === "19.2b")?.applicable).toBe(false);
	});

	it("cloneWorld returns an independent copy", () => {
		const original = SCENARIOS[0].world;
		const copy = cloneWorld(original);
		copy.boats[0].x += 1;
		expect(original.boats[0].x).not.toBe(copy.boats[0].x);
	});
});
