import {computeFacts} from "./rulesEngine";
import {createDefaultWorld} from "../state/worldReducer";
import {obstructionSlotKey} from "./memory";

const world = (boats: {id: string; x: number; y: number; heading: number}[]) => ({
	...createDefaultWorld(),
	boats: boats.map((b) => ({...b, nextLegIndex: 0})),
	obstructions: [{id: "o", x: 10, y: 10, radius: 1}],
});

describe("obstruction facts", () => {
	it("reports edge distance, approach and passing side", () => {
		// Heading east (90) towards an obstruction slightly to the south (starboard side).
		const f = computeFacts(world([{id: "a", x: 3, y: 9, heading: 90}])).obstructions[obstructionSlotKey("a", "o")];
		expect(f.approaching).toBe(false); // too far
		expect(f.passingSide).toBe("starboard");
		const near = computeFacts(world([{id: "a", x: 7.5, y: 9, heading: 90}])).obstructions[obstructionSlotKey("a", "o")];
		expect(near.approaching).toBe(true);
		expect(near.distance).toBeGreaterThan(0);
		expect(near.distance).toBeLessThan(2.5);
	});

	it("is not approaching once the obstruction is abeam or astern, and flips the passing side", () => {
		const past = computeFacts(world([{id: "a", x: 12, y: 11, heading: 90}])).obstructions[obstructionSlotKey("a", "o")];
		expect(past.approaching).toBe(false);
		const port = computeFacts(world([{id: "a", x: 8, y: 11, heading: 90}])).obstructions[obstructionSlotKey("a", "o")];
		expect(port.passingSide).toBe("port");
	});
});
