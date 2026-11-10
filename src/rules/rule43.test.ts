import {findScenario} from "../scenarios";
import {obligationTags} from "../ui/obligationLabels";
import {RULE_REGISTRY, contentOf, step} from "./rulesEngine";

describe("Rule 43.1(b) — exoneration", () => {
	const {evaluation: e} = step(findScenario("leeward-mark")!.world, null, 0);

	it("marks the inside windward boat's Rule 11 keepClear as exonerated", () => {
		const keepClear = e.boats.boat1.obligations.find((o) => o.ruleId === "11" && o.kind === "keepClear");
		expect(keepClear?.exoneratedBy).toBe("43.1b");
		expect(e.pairs["boat1|boat2"].obligations.find((o) => o.ruleId === "11")?.exoneratedBy).toBe("43.1b");
	});

	it("does not change right of way", () => {
		const pair = e.pairs["boat1|boat2"];
		expect(pair.rightOfWay).toBe("boat2");
		expect(pair.decidingRuleId).toBe("11");
		expect(e.boats.boat1.standOn).toBe(false);
		expect(e.boats.boat2.standOn).toBe(true);
	});

	it("leaves the room-giver's own duties unmarked", () => {
		expect(e.boats.boat2.obligations.filter((o) => o.kind === "giveMarkRoom").every((o) => o.exoneratedBy === undefined)).toBe(true);
	});

	it("shows Rule 43.1(b) as applicable and notes the exoneration in rule 11's detail", () => {
		const rule43 = e.rules.find((r) => r.id === "43.1b");
		expect(rule43?.applicable).toBe(true);
		expect(rule43?.detail).toContain("boat1 is exonerated");
		expect(e.rules.find((r) => r.id === "11")?.detail).toContain("(exonerated, Rule 43.1b)");
	});

	it("flags exonerated obligations on the boat tags", () => {
		expect(obligationTags(e.boats.boat1.obligations)).toContainEqual({label: "Keep clear of boat2", exonerated: true});
	});

	it("is not applicable when nobody owes room", () => {
		const {evaluation} = step(findScenario("windward-leeward")!.world, null, 0);
		expect(evaluation.rules.find((r) => r.id === "43.1b")?.applicable).toBe(false);
		expect(evaluation.obligations.some((o) => o.exoneratedBy)).toBe(false);
	});
});

describe("Rule 43 content", () => {
	it("registers 43.1b as a Part 4 rule and keeps 43, 43.1a, 43.1c and 43.2 as reference content", () => {
		expect(RULE_REGISTRY.find((r) => r.id === "43.1b")).toMatchObject({part: 4, scope: "all"});
		expect(contentOf("43.1b")).toMatchObject({part: 4, evaluable: true});
		for (const id of ["43", "43.1a", "43.1c", "43.2"]) expect(contentOf(id)).toMatchObject({part: 4, evaluable: false});
		expect(RULE_REGISTRY.some((r) => r.id === "21")).toBe(false);
	});
});
