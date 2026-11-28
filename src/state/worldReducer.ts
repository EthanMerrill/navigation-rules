/**
 * World reducer — the single place world state changes. Components dispatch
 * `WorldAction`s; nothing else mutates the world.
 */
import type {BoatState, Hail, Mark, WorldState} from "../model/world";
import {toWorld} from "../view/scale";

export type WorldAction =
	| {type: "moveBoat"; id: string; x: number; y: number}
	| {type: "rotateBoat"; id: string; heading: number}
	| {type: "setWind"; direction: number}
	| {type: "setNextLeg"; id: string; legIndex: number}
	| {type: "addBoat"; boat?: Partial<BoatState>}
	| {type: "removeBoat"; id: string}
	| {type: "moveMark"; id: string; x: number; y: number}
	/** Add a mark centred at (x, y): a rounding mark, a start line or a gate (each a pair of marks across the wind). */
	| {type: "addMark"; kind: AddableMarkKind; x: number; y: number}
	/** Remove a mark; removing either mark of a gate or start line removes both. */
	| {type: "removeMark"; id: string}
	/** Switch the side a mark is left on. */
	| {type: "flipMarkSide"; id: string}
	| {type: "moveObstruction"; id: string; x: number; y: number}
	| {type: "hail"; from: string; to: string; kind: Hail["kind"]; at?: number}
	| {type: "clearHails"}
	| {type: "loadScenario"; world: WorldState};

/** Marks the user can add. */
export type AddableMarkKind = "rounding" | "startLine" | "gate";

/** Half the width of an added gate or start line, in hull lengths: a gate's two zones just touch. */
export const GATE_HALF_WIDTH = 3;

/**
 * Offset (hull lengths) from the middle of a gate or start line to its
 * starboard-hand end: to the right looking upwind, which is also to the left
 * looking downwind. The other end is at minus this.
 */
export function pairEndOffset(windDirection: number): {x: number; y: number} {
	const right = (((windDirection + 90) % 360) * Math.PI) / 180;
	return {x: Math.sin(right) * GATE_HALF_WIDTH, y: -Math.cos(right) * GATE_HALF_WIDTH};
}

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
	return nextId("boat", boats.map((b) => b.id));
}

/** The first `<prefix>N` id not already in `used`. */
function nextId(prefix: string, used: string[]): string {
	const taken = new Set(used);
	let n = used.length + 1;
	while (taken.has(`${prefix}${n}`)) n++;
	return `${prefix}${n}`;
}

/**
 * The marks to add for `kind` centred at (x, y). Pairs lie across the wind:
 * - a gate: looking downwind, the left mark is left to port and the right one
 *   to starboard, so boats pass between them;
 * - a start line: the committee boat at the starboard end (right, looking
 *   upwind) and the pin at the port end; boats cross between them, leaving the
 *   committee boat to starboard and the pin to port.
 */
function marksToAdd(world: WorldState, kind: AddableMarkKind, x: number, y: number): Mark[] {
	const ids = world.marks.map((m) => m.id);
	if (kind === "rounding") return [{id: nextId("mark", ids), x, y, roundingSide: "port", kind: "rounding"}];
	const {x: dx, y: dy} = pairEndOffset(world.wind.direction);
	const pairId = nextId(kind === "gate" ? "gate" : "start", world.marks.flatMap((m) => (m.pairId ? [m.pairId] : [])));
	const a = nextId("mark", ids);
	const b = nextId("mark", [...ids, a]);
	if (kind === "gate") {
		return [
			{id: a, x: x + dx, y: y + dy, roundingSide: "port", kind: "gate", pairId},
			{id: b, x: x - dx, y: y - dy, roundingSide: "starboard", kind: "gate", pairId},
		];
	}
	return [
		{id: a, x: x + dx, y: y + dy, roundingSide: "starboard", kind: "start", pairId, startEnd: "committee"},
		{id: b, x: x - dx, y: y - dy, roundingSide: "port", kind: "start", pairId, startEnd: "pin"},
	];
}

/**
 * A world the user has edited (boats or marks added or removed): a custom scene,
 * whose course is no longer the scenario's, so each boat's next mark is inferred.
 */
function customised(world: WorldState): WorldState {
	return {...world, course: {...world.course, inferNextMark: true}};
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
			return customised({...world, boats: [...world.boats, {...boat, id}]});
		}
		case "removeBoat":
			if (!world.boats.some((boat) => boat.id === action.id)) return world;
			return customised({...world, boats: world.boats.filter((boat) => boat.id !== action.id), hails: world.hails.filter((h) => h.from !== action.id && h.to !== action.id)});
		case "addMark":
			return customised({...world, marks: [...world.marks, ...marksToAdd(world, action.kind, action.x, action.y)]});
		case "removeMark": {
			const mark = world.marks.find((m) => m.id === action.id);
			if (!mark) return world;
			const gone = new Set(world.marks.filter((m) => m.id === mark.id || (mark.pairId !== undefined && m.pairId === mark.pairId)).map((m) => m.id));
			return customised({
				...world,
				marks: world.marks.filter((m) => !gone.has(m.id)),
				course: {...world.course, legs: world.course.legs.filter((leg) => !gone.has(leg.toMarkId))},
			});
		}
		case "flipMarkSide":
			// The ends of a start line are left on the sides the line dictates.
			if (world.marks.find((m) => m.id === action.id)?.startEnd) return world;
			return {...world, marks: world.marks.map((mark) => (mark.id === action.id ? {...mark, roundingSide: mark.roundingSide === "port" ? "starboard" : "port"} : mark))};
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
