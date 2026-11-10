import {groupKeyOf, groupRules, groupTitle} from "./ruleGroups";

describe("ruleGroups", () => {
	it("titles Parts and Sections", () => {
		expect(groupTitle("2D")).toBe("Part 2 · Section D — Other Rules");
		expect(groupTitle("4")).toBe("Part 4 — Other Requirements When Racing");
		expect(groupTitle("1")).toBe("Part 1 — Fundamental Rules");
		expect(groupTitle("3")).toBe("Part 3 — Conduct of a Race");
	});

	it("groups Part 1, Part 2 and Part 4 rules in Part order", () => {
		const groups = groupRules([{id: "43.1b"}, {id: "21"}, {id: "11"}, {id: "3"}]);
		expect(groups.map((g) => [g.key, g.rules.map((r) => r.id)])).toEqual([
			["1", ["3"]],
			["2A", ["11"]],
			["2D", ["21"]],
			["4", ["43.1b"]],
		]);
		expect(groupKeyOf({part: 4})).toBe("4");
	});
});
