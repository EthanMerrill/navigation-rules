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

describe("step — Rule 17 latch", () => {
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
		expect(fired(evaluations[1], "17")).toBe(false); // latched, but not sailing above proper course yet
		expect(fired(evaluations[2], "17")).toBe(true);
		expect(memory?.pairs[key].leewardFromAstern).toEqual({astern: true});

		// Overlap breaks: latch released and rule no longer fires.
		const released = run([worldOf(ahead, astern(0, 20))], memory);
		expect(released.memory?.pairs[key].leewardFromAstern).toEqual({});
		expect(fired(released.evaluations[0], "17")).toBe(false);
	});

	it("does not latch for a boat that was already overlapped", () => {
		const {evaluations} = run([worldOf(ahead, boat("astern", 5.9, 6, 90)), worldOf(ahead, boat("astern", 5.9, 6, 20))]);
		expect(fired(evaluations[1], "17")).toBe(false);
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

describe("step — Rules 15 and 16", () => {
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

	it("does not fire Rule 15 when she acquired right of way because only the other boat changed course", () => {
		// b (starboard tack) has right of way over a (port tack); then b tacks onto port tack behind a,
		// so a is clear ahead and gains right of way through b's action alone.
		const a = boat("a", 7, 2, 90);
		const key = pairKey("a", "b");
		const {evaluations} = run([worldOf(a, boat("b", 6, 2, 270)), worldOf(a, boat("b", 6, 2, 90))]);
		expect(evaluations[0].pairs[key].rightOfWay).toBe("b");
		expect(evaluations[1].pairs[key].rightOfWay).toBe("a");
		expect(fired(evaluations[1], "15")).toBe(false);
	});

	it("fires Rule 16.1 on the frame the right-of-way boat changes heading by more than 0.5 degrees", () => {
		// s (starboard tack) has right of way over p (port tack).
		const p = boat("p", 2, 2, 90);
		const s = (heading: number) => boat("s", 8, 2, heading);
		const {evaluations} = run([worldOf(p, s(270)), worldOf(p, s(270.3)), worldOf(p, s(260)), worldOf(p, s(260))]);

		expect(evaluations.map((e) => fired(e, "16.1"))).toEqual([false, false, true, false]);
	});
});

describe("step — zone-entry memory (Rule 18.2b)", () => {
	// Wind from the north, windward mark at (10, 10) to be left to port. Boats on
	// starboard tack, close-hauled (heading 315), approach from the south-east.
	const mark = {id: "m", x: 10, y: 10, roundingSide: "port" as const, kind: "windward" as const};
	const markWorld = (...boats: BoatState[]): WorldState => ({...worldOf(...boats), marks: [mark], course: {legs: [{toMarkId: "m"}]}});
	const key = "a|b|m";
	const far = (id: string, x: number, y: number) => boat(id, x, y, 315);

	// Abreast, `a` on the mark side of `b` (inside); out of the zone, then in it.
	const apart = markWorld(far("a", 14.5, 15.5), far("b", 16, 14));
	const together = markWorld(far("a", 11.5, 12.5), far("b", 13, 11));

	it("records overlap and the inside boat when the first boat reaches the zone", () => {
		const {memory} = run([apart, together]);
		expect(memory?.pairMarks[key]).toEqual({firstInZoneAt: 16, overlappedAtEntry: true, insideAtEntry: "a"});
		expect(memory?.markSlots["a|m"]).toEqual({zoneEntryAt: 16});
	});

	it("records the boat clear ahead when the boats are not overlapped at entry", () => {
		const {memory} = run([markWorld(far("a", 14.5, 15.5), far("b", 20, 20)), markWorld(far("a", 11.5, 12.5), far("b", 20, 20))]);
		expect(memory?.pairMarks[key]).toMatchObject({overlappedAtEntry: false, clearAheadAtEntry: "a"});
		expect(memory?.pairMarks[key].insideAtEntry).toBeUndefined();
	});

	it("does not record a slot while neither boat is in the zone, nor for a boat not heading for the mark", () => {
		expect(run([apart, apart]).memory?.pairMarks).toEqual({});
		const elsewhere = markWorld(far("a", 11.5, 12.5), {...far("b", 13, 11), nextLegIndex: 1});
		expect(run([elsewhere]).memory?.pairMarks).toEqual({});
	});

	it("keeps the latch when the overlap is later broken, and exposes it in history only while live", () => {
		const broken = markWorld(far("a", 11.5, 12.5), far("b", 16, 17));
		const {memory} = run([apart, together, broken, broken]);
		expect(memory?.pairMarks[key]).toMatchObject({overlappedAtEntry: true, insideAtEntry: "a"});
		expect(memory?.pairMarks[key].released).toBeUndefined();
	});

	it("releases when the entitled boat leaves the zone, and does not latch again until both have left", () => {
		const aOut = markWorld(far("a", 18, 18), far("b", 13, 11)); // a leaves, b still in the zone
		const {memory} = run([apart, together, aOut, together]);
		expect(memory?.pairMarks[key].released).toBe(true);
		expect(memory?.pairMarks[key].insideAtEntry).toBe("a");

		const bothOut = run([apart], memory);
		expect(bothOut.memory?.pairMarks).toEqual({});
		const reentry = run([together], bothOut.memory);
		expect(reentry.memory?.pairMarks[key].released).toBeUndefined();
	});

	it("releases when the entitled boat passes head to wind", () => {
		// `a` turns from starboard-tack close-hauled through the wind onto port tack (heading 20).
		const frames = [315, 350, 2, 20].map((heading) => markWorld({...far("a", 11.5, 12.5), heading}, far("b", 13, 11)));
		const {memory} = run([apart, ...frames]);
		expect(memory?.pairMarks[key].released).toBe(true);
	});
});

describe("step — Rule 16.2 (bearing away on a beat)", () => {
	// Wind from the north. s is close-hauled on starboard tack (heading 315); p is close-hauled on port tack
	// (heading 45) on s's leeward (port) side and abaft her, ducking behind her stern.
	const p = boat("p", 5.5, 8.5, 45);
	const s = (heading: number) => boat("s", 5, 5, heading);
	const rule = (e: RuleEvaluation) => e.obligations.filter((o) => o.ruleId === "16.2").map((o) => [o.boat, o.towards, o.kind]);

	it("fires on the frame the starboard-tack boat bears away, and not while she holds her course", () => {
		const {evaluations} = run([worldOf(p, s(315)), worldOf(p, s(310)), worldOf(p, s(310))]);
		expect(evaluations.map((e) => fired(e, "16.2"))).toEqual([false, true, false]);
		expect(rule(evaluations[1])).toEqual([["s", "p", "notBearAway"]]);
	});

	it("does not fire when the starboard-tack boat luffs (heads up)", () => {
		const {evaluations} = run([worldOf(p, s(310)), worldOf(p, s(315))]);
		expect(fired(evaluations[1], "16.2")).toBe(false);
	});

	it("does not fire when the port-tack boat is not passing to leeward and abaft her", () => {
		const ahead = boat("p", 4, 3, 45); // to windward of her path, ahead of s
		const {evaluations} = run([worldOf(ahead, s(315)), worldOf(ahead, s(310))]);
		expect(fired(evaluations[1], "16.2")).toBe(false);
	});

	it("does not fire when the boats are not both on a beat", () => {
		const reaching = boat("p", 5.5, 8.5, 90); // port tack, beam reach
		const {evaluations} = run([worldOf(reaching, s(315)), worldOf(reaching, s(310))]);
		expect(fired(evaluations[1], "16.2")).toBe(false);
	});
});
