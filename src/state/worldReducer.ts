/**
 * World reducer — the single place world state changes. Components dispatch
 * `WorldAction`s; nothing else mutates the world.
 */
import type {BoatState, Hail, WorldState} from "../model/world";
import {toWorld} from "../view/scale";

export type WorldAction =
	| {type: "moveBoat"; id: string; x: number; y: number}
	| {type: "rotateBoat"; id: string; heading: number}
	| {type: "setWind"; direction: number}
	| {type: "setNextLeg"; id: string; legIndex: number}
	| {type: "addBoat"; boat?: Partial<BoatState>}
	| {type: "removeBoat"; id: string}
	| {type: "moveMark"; id: string; x: number; y: number}
	| {type: "moveObstruction"; id: string; x: number; y: number}
	| {type: "hail"; from: string; to: string; kind: Hail["kind"]; at?: number}
	| {type: "clearHails"}
	| {type: "loadScenario"; world: WorldState};

/** The default scene: two boats abreast on a beam reach, wind from the north. */
export function createDefaultWorld(): WorldState {
	const boat1 = toWorld({x: 300, y: 150});
	const boat2 = toWorld({x: 300, y: 350});
	return {
		boats: [
			{id: "boat1", x: boat1.x, y: boat1.y, heading: 90, nextLegIndex: 0},
			{id: "boat2", x: boat2.x, y: boat2.y, heading: 90, nextLegIndex: 0},
		],
		wind: {direction: 0},
		marks: [],
		obstructions: [],
		race: {phase: "started"},
		course: {legs: []},
		hails: [],
	};
}

/** The first `boatN` id not already used by a boat in the world. */
function nextBoatId(boats: BoatState[]): string {
	const used = new Set(boats.map((b) => b.id));
	let n = boats.length + 1;
	while (used.has(`boat${n}`)) n++;
	return `boat${n}`;
}

/** The first `hailN` id not already used by a hail in the world. */
function nextHailId(hails: Hail[]): string {
	const used = new Set(hails.map((h) => h.id));
	let n = hails.length + 1;
	while (used.has(`hail${n}`)) n++;
	return `hail${n}`;
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
		case "setNextLeg":
			return updateBoat(world, action.id, (boat) => ({...boat, nextLegIndex: action.legIndex}));
		case "addBoat": {
			const id = action.boat?.id ?? nextBoatId(world.boats);
			if (world.boats.some((b) => b.id === id)) return world;
			const boat: BoatState = {id, x: 2, y: 2, heading: 90, nextLegIndex: 0, ...action.boat};
			return {...world, boats: [...world.boats, {...boat, id}]};
		}
		case "removeBoat":
			return {...world, boats: world.boats.filter((boat) => boat.id !== action.id), hails: world.hails.filter((h) => h.from !== action.id && h.to !== action.id)};
		case "hail": {
			// The same call between the same boats is not made twice.
			if (world.hails.some((h) => h.from === action.from && h.to === action.to && h.kind === action.kind)) return world;
			const hail: Hail = {id: nextHailId(world.hails), from: action.from, to: action.to, kind: action.kind, at: action.at ?? 0};
			return {...world, hails: [...world.hails, hail]};
		}
		case "clearHails":
			return {...world, hails: []};
		case "moveMark":
			return {...world, marks: world.marks.map((mark) => (mark.id === action.id ? {...mark, x: action.x, y: action.y} : mark))};
		case "moveObstruction":
			return {...world, obstructions: world.obstructions.map((obstruction) => (obstruction.id === action.id ? {...obstruction, x: action.x, y: action.y} : obstruction))};
		case "loadScenario":
			// A scenario brings its own hails (none by default), so hails never carry over.
			return action.world;
	}
}
