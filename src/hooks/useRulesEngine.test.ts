import {renderHook} from "@testing-library/react";
import type {BoatState, WorldState} from "../model/world";
import {createDefaultWorld} from "../state/worldReducer";
import {useRulesEngine} from "./useRulesEngine";

function boat(id: string, x: number, y: number, heading: number): BoatState {
	return {id, x, y, heading, nextLegIndex: 0};
}

function worldOf(...boats: BoatState[]): WorldState {
	return {...createDefaultWorld(), boats, wind: {direction: 0}};
}

// World A: boat1 is on starboard tack, boat2 on port, so boat1 has right of way (Rule 10).
// World B: the same ids with the roles swapped, so right of way "changes hands" if memory leaks.
const worldA = worldOf(boat("boat1", 8, 2, 270), boat("boat2", 2, 2, 90));
const worldB = worldOf(boat("boat1", 2, 2, 90), boat("boat2", 8, 2, 270));

const rule15Applicable = (e: ReturnType<typeof useRulesEngine>) => e.rules.find((r) => r.id === "15")?.applicable === true;

describe("useRulesEngine epoch", () => {
	it("carries memory between worlds within the same epoch", () => {
		const {result, rerender} = renderHook(({world, epoch}) => useRulesEngine(world, epoch), {initialProps: {world: worldA, epoch: 0}});
		rerender({world: worldB, epoch: 0});
		expect(rule15Applicable(result.current)).toBe(true);
	});

	it("starts from empty memory when the epoch changes", () => {
		const {result, rerender} = renderHook(({world, epoch}) => useRulesEngine(world, epoch), {initialProps: {world: worldA, epoch: 0}});
		rerender({world: worldB, epoch: 1});
		expect(rule15Applicable(result.current)).toBe(false);
	});
});
