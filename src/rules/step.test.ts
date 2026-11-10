import type {BoatState, WorldState} from "../model/world";
import {createDefaultWorld} from "../state/worldReducer";
import {createEmptyMemory, pairKey, step} from "./rulesEngine";
import type {EngineMemory, RuleEvaluation} from "./rulesEngine";

// Wind from the north (0°). Positions are in hull lengths.
const WIND = {direction: 0};

function boat(id: string, x: number, y: number, heading: number): BoatState {
	return {id, x, y, heading, nextLegIndex: 0};
}

function worldOf(...boats: BoatState[]): WorldState {
	return {...createDefaultWorld(), boats, wind: WIND};
}

/** Feeds a sequence of worlds through `step`, threading memory like the hook does. */
function run(worlds: WorldState[], memory: EngineMemory | null = null): {evaluations: RuleEvaluation[]; memory: EngineMemory | null} {
	const evaluations: RuleEvaluation[] = [];
	worlds.forEach((world, i) => {
		const result = step(world, memory, i * 16);
		evaluations.push(result.evaluation);
		memory = result.memory;
	});
	return {evaluations, memory};
}

const fired = (e: RuleEvaluation, id: string) => e.rules.find((r) => r.id === id)?.applicable === true;

describe("step — basics", () => {
	it("is pure: it does not mutate the memory it is given", () => {
		const first = step(worldOf(boat("a", 0, 0, 90), boat("b", 3, 3, 90)), null, 0);
		const snapshot = JSON.stringify(first.memory);
		step(worldOf(boat("a", 1, 0, 120), boat("b", 3, 3, 90)), first.memory, 16);
		expect(JSON.stringify(first.memory)).toBe(snapshot);
	});

	it("starts from empty memory and forgets removed boats", () => {
		expect(step(worldOf(), null, 0).memory).toEqual(createEmptyMemory());
		const two = step(worldOf(boat("a", 0, 0, 90), boat("b", 3, 3, 90)), null, 0).memory;
		expect(Object.keys(two.boats)).toEqual(["a", "b"]);
		const one = step(worldOf(boat("a", 0, 0, 90)), two, 16).memory;
		expect(Object.keys(one.boats)).toEqual(["a"]);
		expect(one.pairs).toEqual({});
	});
});

describe("step — Rule 17.1 latch", () => {
	// Wind from north, heading east: port tack. The northern boat is windward.
	const ahead = boat("ahead", 6, 5, 90);

	it("latches when a boat from clear astern becomes overlapped to leeward, then releases", () => {
		const key = pairKey("ahead", "astern");
		const astern = (x: number, heading = 90) => boat("astern", x, 6, heading);
		const {evaluations, memory} = run([
			worldOf(ahead, astern(0)), // clear astern
			worldOf(ahead, astern(5.9)), // overlapped to leeward within two lengths
			worldOf(ahead, astern(5.9, 20)), // luffs above proper course (45°)
		]);

		expect(evaluations[0].pairs[key].overlapped).toBe(false);
		expect(evaluations[1].pairs[key].overlapped).toBe(true);
		expect(fired(evaluations[1], "17.1")).toBe(false); // latched, but not sailing above proper course yet
		expect(fired(evaluations[2], "17.1")).toBe(true);
		expect(memory?.pairs[key].leewardFromAstern).toEqual({astern: true});

		// Overlap breaks: latch released and rule no longer fires.
		const released = run([worldOf(ahead, astern(0, 20))], memory);
		expect(released.memory?.pairs[key].leewardFromAstern).toEqual({});
		expect(fired(released.evaluations[0], "17.1")).toBe(false);
	});

	it("does not latch for a boat that was already overlapped", () => {
		const {evaluations} = run([worldOf(ahead, boat("astern", 5.9, 6, 90)), worldOf(ahead, boat("astern", 5.9, 6, 20))]);
		expect(fired(evaluations[1], "17.1")).toBe(false);
	});
});

describe("step — Rule 13 derived tacking", () => {
	// Boat t turns from port-tack close-hauled (heading 45°, wind from 0°)
	// through head to wind (0°) to starboard-tack close-hauled (315°). The other
	// boat is on port tack, well clear, so Rule 10 would normally apply.
	const other = boat("other", 4, 3, 90);
	const t = (heading: number) => boat("t", 2, 2, heading);

	it("is tacking after crossing the wind, until close-hauled on the new tack", () => {
		const headings = [45, 20, 3, 355, 340, 330, 315];
		const {evaluations} = run(headings.map((h) => worldOf(t(h), other)));
		const tacking = evaluations.map((e) => e.boats.t.tacking);

		// Not tacking on the old tack, nor while still head-to-wind (tack fallback).
		expect(tacking.slice(0, 3)).toEqual([false, false, false]);
		// Crossed (355°): tacking, and stays so through 340° and 330° (wind angle < 45°).
		expect(tacking.slice(3, 6)).toEqual([true, true, true]);
		// Close-hauled on the new tack (45° off the wind): done.
		expect(tacking[6]).toBe(false);
	});

	it("fires Rule 13 and suspends 10/11/12 while tacking", () => {
		const {evaluations} = run([worldOf(t(45), other), worldOf(t(3), other), worldOf(t(340), other), worldOf(t(315), other)]);
		const mid = evaluations[2];
		expect(fired(mid, "13")).toBe(true);
		expect(fired(mid, "10")).toBe(false);
		expect(mid.boats.t.standOn).toBe(false);
		expect(mid.boats.other.standOn).toBe(true);

		const done = evaluations[3];
		expect(fired(done, "13")).toBe(false);
		expect(fired(done, "10")).toBe(true);
	});

	it("does not tack when a boat luffs to head to wind and falls back to the same tack", () => {
		const {evaluations} = run([worldOf(t(45), other), worldOf(t(3), other), worldOf(t(30), other)]);
		expect(evaluations.map((e) => e.boats.t.tacking)).toEqual([false, false, false]);
	});
});

describe("step — Rule 15 and 16", () => {
	it("fires Rule 15 on exactly the frame right of way changes hands", () => {
		// s is on starboard tack and p on port, so s has right of way (Rule 10).
		// Then p turns onto starboard tack, clear ahead of s: s is now astern and must
		// keep clear (Rule 12), so right of way passes to p.
		const s = boat("s", 8, 2, 270);
		const p = (x: number, heading: number) => boat("p", x, 2, heading);
		const key = pairKey("p", "s");
		const {evaluations} = run([worldOf(p(7, 90), s), worldOf(p(7, 90), s), worldOf(p(7, 270), s), worldOf(p(7, 270), s)]);

		expect(evaluations[1].pairs[key].rightOfWay).toBe("s");
		expect(evaluations[2].pairs[key].rightOfWay).toBe("p"); // p is now clear ahead of s on the same tack
		expect(evaluations.map((e) => fired(e, "15"))).toEqual([false, false, true, false]);
	});

	it("fires Rule 16 on the frame the right-of-way boat changes heading by more than 0.5 degrees", () => {
		// s (starboard tack) has right of way over p (port tack).
		const p = boat("p", 2, 2, 90);
		const s = (heading: number) => boat("s", 8, 2, heading);
		const {evaluations} = run([worldOf(p, s(270)), worldOf(p, s(270.3)), worldOf(p, s(260)), worldOf(p, s(260))]);

		expect(evaluations.map((e) => fired(e, "16"))).toEqual([false, false, true, false]);
	});
});
