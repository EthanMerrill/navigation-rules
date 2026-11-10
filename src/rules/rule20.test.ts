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

	it("an invalid hail (not close-hauled) emits nothing and says why", () => {
		const reaching = [boat("boat1", 6, 8, 270), boat("boat2", 6.7, 7.3, 270)];
		const world = worldOf(reaching, [hail("boat1", "boat2", "roomToTack")]);
		expect(mine(evaluate(world))).toEqual([]);
		expect(hailProblem(world, computeFacts(world), "boat1", "boat2")).toMatch(/close-hauled/);
	});

	it("an invalid hail (not approaching an obstruction) emits nothing", () => {
		const world = worldOf([boat1, boat2], [hail("boat1", "boat2", "roomToTack")], [{id: "o", x: 30, y: 30, radius: 0.7}]);
		expect(mine(evaluate(world))).toEqual([]);
		expect(hailProblem(world, computeFacts(world), "boat1", "boat2")).toMatch(/obstruction/);
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
