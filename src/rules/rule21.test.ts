import {findScenario} from "../scenarios";
import {obligationTags} from "../ui/obligationLabels";
import {step} from "./rulesEngine";

describe("Rule 21 — exoneration", () => {
	const {evaluation: e} = step(findScenario("leeward-mark")!.world, null, 0);

	it("marks the inside windward boat's Rule 11 keepClear as exonerated", () => {
		const keepClear = e.boats.boat1.obligations.find((o) => o.ruleId === "11" && o.kind === "keepClear");
		expect(keepClear?.exoneratedBy).toBe("21");
		expect(e.pairs["boat1|boat2"].obligations.find((o) => o.ruleId === "11")?.exoneratedBy).toBe("21");
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

	it("shows Rule 21 as applicable and notes the exoneration in rule 11's detail", () => {
		const rule21 = e.rules.find((r) => r.id === "21");
		expect(rule21?.applicable).toBe(true);
		expect(rule21?.detail).toContain("boat1 is exonerated");
		expect(e.rules.find((r) => r.id === "11")?.detail).toContain("(exonerated, Rule 21)");
	});

	it("flags exonerated obligations on the boat tags", () => {
		expect(obligationTags(e.boats.boat1.obligations)).toContainEqual({label: "Keep clear of boat2", exonerated: true});
	});

	it("is not applicable when nobody owes room", () => {
		const {evaluation} = step(findScenario("windward-leeward")!.world, null, 0);
		expect(evaluation.rules.find((r) => r.id === "21")?.applicable).toBe(false);
		expect(evaluation.obligations.some((o) => o.exoneratedBy)).toBe(false);
	});
});
