import type {BoatState, Mark, WorldState} from "../model/world";
import {createDefaultWorld} from "../state/worldReducer";
import {ZONE_RADIUS, inferredNextMark} from "./markFacts";
import {computeFacts, markSlotKey} from "./rulesEngine";

// Wind from the north (0 degrees); positions in hull lengths.
const MARK: Mark = {id: "m", x: 10, y: 10, roundingSide: "port", kind: "windward"};

function boat(id: string, x: number, y: number, heading: number, nextLegIndex = 0): BoatState {
	return {id, x, y, heading, nextLegIndex};
}

function worldOf(boats: BoatState[], mark: Mark | null = MARK): WorldState {
	return {...createDefaultWorld(), boats, wind: {direction: 0}, marks: mark ? [mark] : [], course: {legs: mark ? [{toMarkId: mark.id}] : []}};
}

const markFacts = (world: WorldState, id: string) => computeFacts(world).marks[markSlotKey(id, "m")];

describe("mark facts — zone and distance", () => {
	it("measures from the nearest hull vertex, so a boat centred beyond the radius can still be in the zone", () => {
		const f = markFacts(worldOf([boat("a", 10, 10 + ZONE_RADIUS + 0.2, 0)]), "a");
		expect(f.distance).toBeLessThan(ZONE_RADIUS + 0.2);
		expect(f.inZone).toBe(true);
	});

	it("is outside the zone when every vertex is further than three hull lengths", () => {
		const f = markFacts(worldOf([boat("a", 10, 20, 0)]), "a");
		expect(f.inZone).toBe(false);
		expect(f.distance).toBeGreaterThan(ZONE_RADIUS);
	});

	it("reports nextMark from the boat's current leg, and the required side", () => {
		const world = worldOf([boat("a", 10, 20, 0), boat("b", 10, 20, 0, 1)]);
		expect(markFacts(world, "a")).toMatchObject({nextMark: true, requiredSide: "port"});
		expect(markFacts(world, "b").nextMark).toBe(false);
	});
});

describe("mark facts — fetching", () => {
	it("is true when the mark is ahead and to port for a mark left to port", () => {
		// Heading north with the mark ahead and one length to the left (port).
		expect(markFacts(worldOf([boat("a", 11, 20, 0)]), "a").fetching).toBe(true);
	});

	it("is false when the mark is on the wrong side, or abaft the abeam line", () => {
		expect(markFacts(worldOf([boat("a", 9, 20, 0)]), "a").fetching).toBe(false);
		expect(markFacts(worldOf([boat("a", 10, 5, 0)]), "a").fetching).toBe(false);
	});

	it("mirrors for a mark left to starboard", () => {
		const world = worldOf([boat("a", 9, 20, 0)], {...MARK, roundingSide: "starboard"});
		expect(markFacts(world, "a").fetching).toBe(true);
	});
});

describe("proper course", () => {
	const properCourse = (world: WorldState, id: string) => computeFacts(world).boats[id].properCourse;

	it("is the bearing to the next mark when it is not above close-hauled", () => {
		// Mark due east of the boat: bearing 90, 90 degrees off the wind.
		expect(properCourse(worldOf([boat("a", 0, 10, 90)]), "a")).toBeCloseTo(90);
		// Mark due south: bearing 180.
		expect(properCourse(worldOf([boat("a", 10, 0, 90)]), "a")).toBeCloseTo(180);
	});

	it("is close-hauled on the current tack when the mark is upwind of close-hauled", () => {
		// Mark due north (bearing 0), boat on port tack (heading 90 side): close-hauled is 45.
		expect(properCourse(worldOf([boat("a", 10, 20, 60)]), "a")).toBeCloseTo(45);
		// Starboard tack: 315.
		expect(properCourse(worldOf([boat("a", 10, 20, 300)]), "a")).toBeCloseTo(315);
	});

	it("falls back to close-hauled on the current tack with no next mark", () => {
		expect(properCourse(worldOf([boat("a", 0, 10, 90)], null), "a")).toBeCloseTo(45);
		expect(properCourse(worldOf([boat("a", 0, 10, 90, 1)]), "a")).toBeCloseTo(45); // past the last leg
	});
});

describe("mark facts — inferred next mark (custom scenes)", () => {
	const ahead: Mark = {id: "ahead", x: 10, y: 2, roundingSide: "port", kind: "rounding"};
	const astern: Mark = {id: "astern", x: 10, y: 18, roundingSide: "port", kind: "rounding"};
	const far: Mark = {id: "far", x: 10, y: -20, roundingSide: "port", kind: "rounding"};
	const custom = (boats: BoatState[], marks: Mark[]): WorldState => ({...createDefaultWorld(), boats, marks, course: {legs: [], inferNextMark: true}});

	it("is the nearest mark ahead of her abeam line, ignoring marks astern", () => {
		const b = boat("a", 10, 10, 0);
		expect(inferredNextMark(custom([b], [far, astern, ahead]), b)?.id).toBe("ahead");
		expect(inferredNextMark(custom([b], [astern]), b)).toBeUndefined();
	});

	it("keeps a mark she is rounding (in its zone) even once it is abeam or astern", () => {
		const b = boat("a", 10, 10, 0);
		const abeam: Mark = {id: "abeam", x: 12, y: 10.5, roundingSide: "port", kind: "rounding"};
		expect(inferredNextMark(custom([b], [ahead, abeam]), b)?.id).toBe("abeam");
	});

	it("feeds the mark facts, overriding the course legs", () => {
		const b = boat("a", 10, 10, 0);
		const world = {...custom([b], [ahead]), course: {legs: [{toMarkId: "nope"}], inferNextMark: true}};
		expect(computeFacts(world).marks[markSlotKey("a", "ahead")].nextMark).toBe(true);
	});
});
