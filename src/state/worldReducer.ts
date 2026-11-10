/**
 * World reducer — the single place world state changes. Components dispatch
 * `WorldAction`s; nothing else mutates the world.
 */
import type {BoatState, WorldState} from "../model/world";
import {toWorld} from "../view/scale";

export type WorldAction =
	| {type: "moveBoat"; id: string; x: number; y: number}
	| {type: "rotateBoat"; id: string; heading: number}
	| {type: "setWind"; direction: number}
	| {type: "toggleTacking"; id: string}
	| {type: "setNextLeg"; id: string; legIndex: number}
	| {type: "addBoat"; boat?: Partial<BoatState>}
	| {type: "removeBoat"; id: string}
	| {type: "loadScenario"; world: WorldState};

/** The default scene: two boats abreast on a beam reach, wind from the north. */
export function createDefaultWorld(): WorldState {
	const boat1 = toWorld({x: 300, y: 150});
	const boat2 = toWorld({x: 300, y: 350});
	return {
		boats: [
			{id: "boat1", x: boat1.x, y: boat1.y, heading: 90, tacking: false, nextLegIndex: 0},
			{id: "boat2", x: boat2.x, y: boat2.y, heading: 90, tacking: false, nextLegIndex: 0},
		],
		wind: {direction: 0},
		marks: [],
		obstructions: [],
		race: {phase: "started"},
		course: {legs: []},
	};
}

/** The first `boatN` id not already used by a boat in the world. */
function nextBoatId(boats: BoatState[]): string {
	const used = new Set(boats.map((b) => b.id));
	let n = boats.length + 1;
	while (used.has(`boat${n}`)) n++;
	return `boat${n}`;
}

/** Apply `update` to the boat with the given id, leaving other boats untouched. */
function updateBoat(world: WorldState, id: string, update: (boat: BoatState) => BoatState): WorldState {
	return {...world, boats: world.boats.map((boat) => (boat.id === id ? update(boat) : boat))};
}

export function worldReducer(world: WorldState, action: WorldAction): WorldState {
	switch (action.type) {
		case "moveBoat":
			return updateBoat(world, action.id, (boat) => ({...boat, x: action.x, y: action.y}));
		case "rotateBoat":
			return updateBoat(world, action.id, (boat) => ({...boat, heading: action.heading}));
		case "setWind":
			return {...world, wind: {direction: action.direction}};
		case "toggleTacking":
			return updateBoat(world, action.id, (boat) => ({...boat, tacking: !boat.tacking}));
		case "setNextLeg":
			return updateBoat(world, action.id, (boat) => ({...boat, nextLegIndex: action.legIndex}));
		case "addBoat": {
			const id = action.boat?.id ?? nextBoatId(world.boats);
			if (world.boats.some((b) => b.id === id)) return world;
			const boat: BoatState = {id, x: 2, y: 2, heading: 90, tacking: false, nextLegIndex: 0, ...action.boat};
			return {...world, boats: [...world.boats, {...boat, id}]};
		}
		case "removeBoat":
			return {...world, boats: world.boats.filter((boat) => boat.id !== action.id)};
		case "loadScenario":
			return action.world;
	}
}
