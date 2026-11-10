import {describe, expect, it} from "vitest";
import {DEFINITIONS, PREAMBLES, RULE_CONTENT} from "./rrs-2025";

const ids = Object.keys(RULE_CONTENT);

describe("RULE_CONTENT official text", () => {
	it("has non-empty fullText and title for every entry", () => {
		for (const id of ids) {
			expect(RULE_CONTENT[id as keyof typeof RULE_CONTENT].fullText.trim(), `fullText of ${id}`).not.toBe("");
			expect(RULE_CONTENT[id as keyof typeof RULE_CONTENT].title.trim(), `title of ${id}`).not.toBe("");
		}
	});

	it("contains each sub-rule's numbering in its parent's fullText", () => {
		for (const id of ids) {
			const parent = id.replace(/[a-e]$/, "").replace(/\.\d+$/, "");
			if (parent === id.replace(/[a-e]$/, "")) continue; // top-level number, no parent
			const text = RULE_CONTENT[parent as keyof typeof RULE_CONTENT]?.fullText;
			if (text === undefined) continue;
			expect(text, `${parent} contains ${id}`).toContain(id.replace(/[a-e]$/, ""));
		}
	});

	it("contains each lettered paragraph in its rule's fullText", () => {
		for (const id of ids) {
			const m = /^(\d+\.\d+)([a-e])$/.exec(id);
			if (!m) continue;
			const own = RULE_CONTENT[id as keyof typeof RULE_CONTENT].fullText;
			expect(own.startsWith(`(${m[2]}) `), `${id} starts with its letter`).toBe(true);
			const parent = RULE_CONTENT[m[1] as keyof typeof RULE_CONTENT];
			if (parent) expect(parent.fullText).toContain(own);
		}
		expect(RULE_CONTENT["18"].fullText).toContain(RULE_CONTENT["18.2c"].fullText);
		expect(RULE_CONTENT["19"].fullText).toContain(RULE_CONTENT["19.2c"].fullText);
		expect(RULE_CONTENT["43"].fullText).toContain(RULE_CONTENT["43.1b"].fullText);
	});

	it("has no hyphenation artifacts", () => {
		for (const id of ids) expect(RULE_CONTENT[id as keyof typeof RULE_CONTENT].fullText).not.toMatch(/\w- \w/);
	});
});

describe("DEFINITIONS and PREAMBLES", () => {
	it("has the listed definitions, all non-empty", () => {
		const keys = [
			"Clear Astern and Clear Ahead", "Overlap", "Continuing Obstruction", "Fetching", "Keep Clear",
			"Leeward and Windward", "Mark", "Mark-Room", "Obstruction", "Proper Course", "Racing", "Room",
			"Start", "Tack, Starboard or Port", "Zone",
		];
		for (const key of keys) expect(DEFINITIONS[key]?.trim(), key).toBeTruthy();
	});

	it("has the 2025-2028 wording for the changed definitions", () => {
		expect(DEFINITIONS["Proper Course"]).toContain("no proper course before her starting signal");
		expect(DEFINITIONS["Mark-Room"]).toContain("to leave it astern");
	});

	it("has the preambles (Section B has none)", () => {
		expect(PREAMBLES.part2).toContain("rules of Part 2 apply");
		expect(PREAMBLES.sectionA).toContain("right of way");
		expect(PREAMBLES.sectionB).toBe("");
		expect(PREAMBLES.sectionC).toContain("starting mark");
		expect(PREAMBLES.sectionD).toContain("rule 21 or 22");
	});
});
