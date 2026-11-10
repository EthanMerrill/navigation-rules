import {createDefaultWorld, worldReducer} from "./worldReducer";

describe("worldReducer — marks and obstructions", () => {
	const world = {
		...createDefaultWorld(),
		marks: [
			{id: "m1", x: 1, y: 2, roundingSide: "port" as const, kind: "windward" as const},
			{id: "m2", x: 5, y: 5, roundingSide: "starboard" as const, kind: "leeward" as const},
		],
		obstructions: [{id: "o1", x: 3, y: 3, radius: 0.5}],
	};

	it("moveMark moves only the named mark", () => {
		const next = worldReducer(world, {type: "moveMark", id: "m1", x: 7, y: 8});
		expect(next.marks[0]).toMatchObject({id: "m1", x: 7, y: 8, roundingSide: "port"});
		expect(next.marks[1]).toBe(world.marks[1]);
	});

	it("moveObstruction moves only the named obstruction, keeping its radius", () => {
		const next = worldReducer(world, {type: "moveObstruction", id: "o1", x: 9, y: 1});
		expect(next.obstructions[0]).toEqual({id: "o1", x: 9, y: 1, radius: 0.5});
	});
});
