import {step} from "../rules/rulesEngine";
import {SCENARIOS, cloneWorld, findScenario} from "./index";

describe("scenarios", () => {
	it("have unique ids", () => {
		const ids = SCENARIOS.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).toEqual(expect.arrayContaining(["port-starboard", "windward-leeward", "clear-astern", "windward-mark", "obstruction"]));
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

	it("cloneWorld returns an independent copy", () => {
		const original = SCENARIOS[0].world;
		const copy = cloneWorld(original);
		copy.boats[0].x += 1;
		expect(original.boats[0].x).not.toBe(copy.boats[0].x);
	});
});
