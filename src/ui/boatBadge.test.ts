import {findScenario} from "../scenarios";
import {step} from "../rules/rulesEngine";
import {boatBadge, MAX_BADGE_LINES} from "./boatBadge";

function badgesFor(scenario: string) {
	const {evaluation} = step(findScenario(scenario)!.world, null, 0);
	return (boat: string) => boatBadge(boat, evaluation.obligations);
}

describe("boatBadge", () => {
	it("shows right of way and keep clear with the deciding rule, and nothing else", () => {
		const badge = badgesFor("port-starboard");
		expect(badge("boat1").lines).toEqual([{tone: "keepClear", text: "Keep clear of boat2", rules: ["10"]}]);
		expect(badge("boat2").lines).toEqual([{tone: "rightOfWay", text: "Right of way", rules: ["10"]}]);
	});

	it("never shows Rule 14 (avoid contact)", () => {
		const badge = badgesFor("windward-leeward");
		for (const boat of ["boat1", "boat2"]) expect(badge(boat).lines.flatMap((l) => l.rules)).not.toContain("14");
	});

	it("replaces an exonerated keep-clear with the mark-room it is superseded by", () => {
		const badge = badgesFor("leeward-mark");
		expect(badge("boat1").lines).toEqual([{tone: "entitled", text: "Mark-room from boat2", rules: ["18.2a"]}]);
		expect(badge("boat2").lines.map((l) => l.text)).toEqual(["Right of way", "Give mark-room to boat1"]);
	});

	it("merges duties owed to several boats and caps the lines shown", () => {
		const badge = badgesFor("windward-mark");
		const boat3 = badge("boat3");
		expect(boat3.lines[0]).toMatchObject({tone: "keepClear", text: "Keep clear of boat1 and boat2"});
		for (const boat of ["boat1", "boat2", "boat3"]) expect(badge(boat).lines.length).toBeLessThanOrEqual(MAX_BADGE_LINES);
		expect(badge("boat2").hidden).toBeGreaterThan(0);
	});
});
