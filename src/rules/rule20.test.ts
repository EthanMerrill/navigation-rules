import type {BoatState, Hail, WorldState} from "../model/world";
import {createDefaultWorld} from "../state/worldReducer";
import {computeFacts, hailProblem, hailTarget, step} from "./rulesEngine";
import type {RuleEvaluation} from "./rulesEngine";
import {findScenario} from "../scenarios";

// Wind from the north. Both boats close-hauled on starboard tack (heading 315)
// heading for an obstruction to the north-west; boat1 to leeward of boat2.
function boat(id: string, x: number, y: number, heading = 315): BoatState {
	return {id, x, y, heading, nextLegIndex: 0};
}

const hail = (from: string, to: string, kind: Hail["kind"], id = `h-${from}-${to}-${kind}`): Hail => ({id, from, to, kind, at: 0});

function worldOf(boats: BoatState[], hails: Hail[], obstructions = [{id: "o", x: 4, y: 5.5, radius: 0.7}]): WorldState {
	return {...createDefaultWorld(), boats, obstructions, hails};
}

const boat1 = boat("boat1", 6, 8);
const boat2 = boat("boat2", 6.7, 7.3);
const evaluate = (world: WorldState): RuleEvaluation => step(world, null, 0).evaluation;
const mine = (e: RuleEvaluation) => e.obligations.filter((o) => o.ruleId === "20.2").map((o) => [o.boat, o.towards, o.kind]);

describe("Rule 20 — hails", () => {
	it("a valid hail makes the hailed boat respond", () => {
		const e = evaluate(worldOf([boat1, boat2], [hail("boat1", "boat2", "roomToTack")]));
		expect(mine(e)).toEqual([["boat2", "boat1", "giveRoom"]]);
		expect(e.rules.find((r) => r.id === "20.2")?.detail).toContain("must respond");
	});

	it("emits nothing without a hail", () => {
		expect(mine(evaluate(worldOf([boat1, boat2], [])))).toEqual([]);
	});

	it("a hail that breaks 20.1 (not close-hauled) must still be responded to, and says so", () => {
		const reaching = [boat("boat1", 6, 8, 270), boat("boat2", 6.7, 7.3, 270)];
		const world = worldOf(reaching, [hail("boat1", "boat2", "roomToTack")]);
		const e = evaluate(world);
		expect(mine(e)).toEqual([["boat2", "boat1", "giveRoom"]]);
		expect(e.obligations.find((o) => o.ruleId === "20.2")!.detail).toContain("breaks rule 20.1");
		expect(hailProblem(world, computeFacts(world), "boat1", "boat2")).toMatch(/close-hauled/);
	});

	it("a hail that breaks 20.1 (not approaching an obstruction) must still be responded to", () => {
		const world = worldOf([boat1, boat2], [hail("boat1", "boat2", "roomToTack")], [{id: "o", x: 30, y: 30, radius: 0.7}]);
		expect(mine(evaluate(world))).toEqual([["boat2", "boat1", "giveRoom"]]);
		expect(hailProblem(world, computeFacts(world), "boat1", "boat2")).toMatch(/obstruction/);
	});

	it("a valid hail does not mention 20.1 being broken", () => {
		const e = evaluate(worldOf([boat1, boat2], [hail("boat1", "boat2", "roomToTack")]));
		expect(e.obligations.find((o) => o.ruleId === "20.2")!.detail).not.toContain("breaks rule 20.1");
	});

	it("does not respond to a hail between boats on opposite tacks", () => {
		const opposite = boat("boat2", 6.7, 7.3, 45);
		expect(mine(evaluate(worldOf([boat1, opposite], [hail("boat1", "boat2", "roomToTack")])))).toEqual([]);
	});

	it("a \"You tack\" reply flips the obligations", () => {
		const e = evaluate(worldOf([boat1, boat2], [hail("boat1", "boat2", "roomToTack"), hail("boat2", "boat1", "youTack")]));
		expect(mine(e)).toEqual([
			["boat2", "boat1", "giveRoom"],
			["boat1", "boat2", "tackAsSoonAsPossible"],
		]);
		expect(e.obligations.find((o) => o.kind === "giveRoom" && o.ruleId === "20.2")!.detail).toContain("You tack");
	});

	it("hailTarget picks the nearest boat on the same tack", () => {
		const far = boat("boat3", 20, 20);
		const opposite = boat("boat4", 6.2, 8.2, 45);
		const world = worldOf([boat1, boat2, far, opposite], []);
		expect(hailTarget(world, computeFacts(world), "boat1")).toBe("boat2");
	});

	it("the room-to-tack scenario shows the respond obligation immediately", () => {
		const e = evaluate(findScenario("room-to-tack")!.world);
		expect(mine(e)).toEqual([["boat2", "boat1", "giveRoom"]]);
	});
});

describe("Rule 20.2(e) — 18.2 does not apply while a hail is active", () => {
	// Two boats overlapped on starboard tack in the zone of a windward mark (to port): 18.2(a) applies without a hail.
	const mark = {id: "m", x: 10, y: 10, roundingSide: "port" as const, kind: "windward" as const};
	const atMark = (hails: Hail[]): WorldState => ({
		...createDefaultWorld(),
		boats: [boat("a", 11.5, 12.5), boat("b", 13, 11)],
		wind: {direction: 0},
		marks: [mark],
		course: {legs: [{toMarkId: "m"}]},
		hails,
	});
	const mark18 = (e: RuleEvaluation) => e.obligations.filter((o) => o.kind === "giveMarkRoom").map((o) => [o.ruleId, o.boat, o.towards]);

	it("applies between the boats when nobody has hailed", () => {
		expect(mark18(evaluate(atMark([])))).toEqual([["18.2a", "b", "a"]]);
	});

	it("suspends 18.2(a) between the boats from the hail", () => {
		const e = evaluate(atMark([hail("a", "b", "roomToTack")]));
		expect(mark18(e)).toEqual([]);
		expect(e.rules.find((r) => r.id === "18.2a")?.applicable).toBe(false);
		expect(mine(e)).toEqual([["b", "a", "giveRoom"]]);
	});
});
