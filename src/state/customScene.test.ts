import {createDefaultWorld, GATE_HALF_WIDTH, worldReducer} from "./worldReducer";
import {findScenario} from "../scenarios";

describe("worldReducer — adding and removing boats and marks", () => {
	it("adding or removing a boat or mark makes the scene custom (next marks inferred)", () => {
		const world = findScenario("windward-mark")!.world;
		expect(world.course.inferNextMark).toBeUndefined();
		expect(worldReducer(world, {type: "addBoat", boat: {x: 1, y: 1}}).course.inferNextMark).toBe(true);
		expect(worldReducer(world, {type: "removeBoat", id: "boat3"}).course.inferNextMark).toBe(true);
		expect(worldReducer(world, {type: "addMark", kind: "rounding", x: 1, y: 1}).course.inferNextMark).toBe(true);
		expect(worldReducer(world, {type: "removeMark", id: "mark1"}).course.inferNextMark).toBe(true);
		// Moving things or flipping a mark is not an edit of the scene's make-up.
		expect(worldReducer(world, {type: "flipMarkSide", id: "mark1"}).course.inferNextMark).toBeUndefined();
	});

	it("removing a boat or mark that is not there changes nothing", () => {
		const world = createDefaultWorld();
		expect(worldReducer(world, {type: "removeBoat", id: "nope"})).toBe(world);
		expect(worldReducer(world, {type: "removeMark", id: "nope"})).toBe(world);
	});

	it("adds a rounding mark left to port with a fresh id", () => {
		let world = worldReducer(createDefaultWorld(), {type: "addMark", kind: "rounding", x: 4, y: 5});
		world = worldReducer(world, {type: "addMark", kind: "rounding", x: 8, y: 9});
		expect(world.marks).toEqual([
			{id: "mark1", x: 4, y: 5, roundingSide: "port", kind: "rounding"},
			{id: "mark2", x: 8, y: 9, roundingSide: "port", kind: "rounding"},
		]);
	});

	it("lays a start line across the wind: committee boat at the starboard end (right, looking upwind), pin at the port end", () => {
		// Wind from the north: looking upwind (north) right is east.
		const world = worldReducer({...createDefaultWorld(), wind: {direction: 0}}, {type: "addMark", kind: "startLine", x: 10, y: 10});
		const [committee, pin] = world.marks;
		expect(committee).toMatchObject({kind: "start", startEnd: "committee", roundingSide: "starboard", pairId: "start1"});
		expect(committee.x).toBeCloseTo(10 + GATE_HALF_WIDTH);
		expect(committee.y).toBeCloseTo(10);
		expect(pin).toMatchObject({kind: "start", startEnd: "pin", roundingSide: "port", pairId: "start1"});
		expect(pin.x).toBeCloseTo(10 - GATE_HALF_WIDTH);
		// Its ends are left on the sides the line sets, and go together.
		expect(worldReducer(world, {type: "flipMarkSide", id: committee.id})).toBe(world);
		expect(worldReducer(world, {type: "removeMark", id: pin.id}).marks).toEqual([]);
	});

	it("lays a gate across the wind: looking downwind the left mark is left to port, the right to starboard", () => {
		// Wind from the north: looking downwind (south) left is east.
		const world = worldReducer({...createDefaultWorld(), wind: {direction: 0}}, {type: "addMark", kind: "gate", x: 10, y: 10});
		const [a, b] = world.marks;
		expect(a).toMatchObject({kind: "gate", roundingSide: "port", pairId: "gate1"});
		expect(a.x).toBeCloseTo(10 + GATE_HALF_WIDTH);
		expect(a.y).toBeCloseTo(10);
		expect(b).toMatchObject({kind: "gate", roundingSide: "starboard", pairId: "gate1"});
		expect(b.x).toBeCloseTo(10 - GATE_HALF_WIDTH);
	});

	it("removing either gate mark removes both, and their legs", () => {
		let world = worldReducer(createDefaultWorld(), {type: "addMark", kind: "gate", x: 10, y: 10});
		world = {...world, course: {legs: world.marks.map((m) => ({toMarkId: m.id}))}};
		const next = worldReducer(world, {type: "removeMark", id: world.marks[1].id});
		expect(next.marks).toEqual([]);
		expect(next.course.legs).toEqual([]);
	});

	it("flips the side a mark is left on", () => {
		const world = worldReducer(createDefaultWorld(), {type: "addMark", kind: "rounding", x: 4, y: 5});
		expect(worldReducer(world, {type: "flipMarkSide", id: "mark1"}).marks[0].roundingSide).toBe("starboard");
	});
});
