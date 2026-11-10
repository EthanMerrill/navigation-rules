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

describe("worldReducer — hails", () => {
	const world = createDefaultWorld();

	it("hail adds a hail with a fresh id and ignores an identical one", () => {
		const once = worldReducer(world, {type: "hail", from: "boat1", to: "boat2", kind: "roomToTack", at: 5});
		expect(once.hails).toEqual([{id: "hail1", from: "boat1", to: "boat2", kind: "roomToTack", at: 5}]);
		expect(worldReducer(once, {type: "hail", from: "boat1", to: "boat2", kind: "roomToTack"})).toBe(once);
		const reply = worldReducer(once, {type: "hail", from: "boat2", to: "boat1", kind: "youTack"});
		expect(reply.hails.map((h) => h.id)).toEqual(["hail1", "hail2"]);
	});

	it("accepts a hail whatever the situation: validity (rule 20.1) is a warning in the UI, not a gate", () => {
		// The default world has no obstruction and both boats on a beam reach, so the hail would break 20.1.
		expect(worldReducer(world, {type: "hail", from: "boat1", to: "boat2", kind: "roomToTack"}).hails).toHaveLength(1);
	});

	it("clearHails empties the hails", () => {
		const hailed = worldReducer(world, {type: "hail", from: "boat1", to: "boat2", kind: "roomToTack"});
		expect(worldReducer(hailed, {type: "clearHails"}).hails).toEqual([]);
	});

	it("loadScenario replaces hails with the scenario's (none by default)", () => {
		const hailed = worldReducer(world, {type: "hail", from: "boat1", to: "boat2", kind: "roomToTack"});
		expect(worldReducer(hailed, {type: "loadScenario", world: createDefaultWorld()}).hails).toEqual([]);
	});

	it("removeBoat drops the hails that involve the boat", () => {
		const hailed = worldReducer(world, {type: "hail", from: "boat1", to: "boat2", kind: "roomToTack"});
		expect(worldReducer(hailed, {type: "removeBoat", id: "boat2"}).hails).toEqual([]);
	});
});
