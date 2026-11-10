/**
 * Scenario presets. Worlds are laid out in pixels (as seen on the play area,
 * clear of the sidebar on the left) and converted to hull lengths with `toWorld`.
 */

import type {BoatState, Mark, Obstruction, WorldState} from "../model/world";
import {createDefaultWorld} from "../state/worldReducer";
import {toWorld} from "../view/scale";

/** A named starting situation, loadable via `#/scenario/<id>`. */
export interface Scenario {
	id: string;
	title: string;
	description: string;
	world: WorldState;
}

/** A boat placed by pixel position. */
function boat(id: string, px: number, py: number, heading: number): BoatState {
	const {x, y} = toWorld({x: px, y: py});
	return {id, x, y, heading, nextLegIndex: 0};
}

/** A scene with wind from the north and no marks, obstructions or legs unless overridden. */
function worldOf(boats: BoatState[], overrides: Partial<WorldState> = {}): WorldState {
	return {...createDefaultWorld(), boats, ...overrides};
}

const WINDWARD_MARK: Mark = {id: "mark1", ...toWorld({x: 700, y: 130}), roundingSide: "port", kind: "windward"};
const LEEWARD_MARK: Mark = {id: "mark1", ...toWorld({x: 1000, y: 760}), roundingSide: "port", kind: "leeward"};
const OBSTRUCTION: Obstruction = {id: "obstruction1", ...toWorld({x: 950, y: 560}), radius: 0.7};
const LARGE_OBSTRUCTION: Obstruction = {id: "obstruction1", ...toWorld({x: 1100, y: 840}), radius: 2};

/** All scenarios, in picker order. */
export const SCENARIOS: Scenario[] = [
	{
		id: "port-starboard",
		title: "Port / starboard",
		description: "Two boats converge on opposite tacks. The port-tack boat must keep clear (Rule 10).",
		world: worldOf([boat("boat1", 500, 450, 60), boat("boat2", 850, 450, 300)]),
	},
	{
		id: "windward-leeward",
		title: "Windward / leeward",
		description: "Two boats abreast on port tack on a beam reach. The windward boat must keep clear (Rule 11).",
		world: createDefaultWorld(),
	},
	{
		id: "clear-astern",
		title: "Clear astern",
		description: "One boat is clear astern of another on the same tack and must keep clear (Rule 12).",
		world: worldOf([boat("boat1", 800, 300, 90), boat("boat2", 450, 300, 90)]),
	},
	{
		id: "windward-mark",
		title: "Windward mark",
		description: "Boats 1 and 2 reach the zone of a windward mark (to port) overlapped on starboard tack, boat 1 inside; boat 3 is clear astern. Boat 2 gives boat 1 mark-room (Rule 18.2(a)(1)); boat 3, which had not reached the zone, gives both room (18.2(a)(2)).",
		world: worldOf([boat("boat1", 942, 533, 315), boat("boat2", 1184, 291, 315), boat("boat3", 1168, 759, 315)], {
			marks: [WINDWARD_MARK],
			course: {legs: [{toMarkId: WINDWARD_MARK.id}]},
		}),
	},
	{
		id: "leeward-mark",
		title: "Leeward mark",
		description: "Two boats overlapped on a run approach a leeward mark to be left to port. The leeward boat has right of way (Rule 11) but, as the outside boat, must give the inside boat mark-room (Rule 18.2(a)).",
		world: worldOf([boat("boat1", 764, 387, 147), boat("boat2", 593, 432, 147)], {
			marks: [LEEWARD_MARK],
			course: {legs: [{toMarkId: LEEWARD_MARK.id}]},
		}),
	},
	{
		id: "tack-in-zone",
		title: "Tacking in the zone",
		description: "Boat 1 is on port tack inside the zone of a windward mark (to port); boat 2, on starboard tack, is fetching the mark. Rotate boat 1 through the wind onto starboard tack: Rule 18.3 then applies and rule 18.2 does not.",
		world: worldOf([boat("boat1", 1168, 195, 45), boat("boat2", 1088, 324, 315)], {
			marks: [WINDWARD_MARK],
			course: {legs: [{toMarkId: WINDWARD_MARK.id}]},
		}),
	},
	{
		id: "obstruction",
		title: "Obstruction",
		description: "Two boats overlapped on the same tack approach an obstruction. Boat 2 is inside, so boat 1 (outside) must give her room between her and the obstruction (Rule 19.2(b)).",
		world: worldOf([boat("boat1", 500, 230, 90), boat("boat2", 520, 370, 90)], {obstructions: [OBSTRUCTION]}),
	},
	{
		id: "continuing-obstruction",
		title: "Continuing obstruction",
		description: "Boat 1 is close to a large obstruction. Boat 2 is clear astern; drag her forward until she is overlapped inside boat 1. There is no room for her to pass between boat 1 and the obstruction, so she is not entitled to room (Rule 19.2(c)).",
		world: worldOf([boat("boat1", 880, 480, 90), boat("boat2", 400, 570, 90)], {obstructions: [LARGE_OBSTRUCTION]}),
	},
	{
		id: "room-to-tack",
		title: "Room to tack",
		description: "Two close-hauled boats on starboard tack head for an obstruction. Boat 1 has hailed boat 2 for room to tack (Rule 20): boat 2 must tack or reply \"You tack\". Use the hail controls to reply.",
		world: worldOf([boat("boat1", 900, 650, 315), boat("boat2", 1006, 544, 315)], {
			obstructions: [{id: "obstruction1", ...toWorld({x: 620, y: 400}), radius: 0.7}],
			hails: [{id: "hail1", from: "boat1", to: "boat2", kind: "roomToTack", at: 0}],
		}),
	},
];

/** The scenario with the given id, or undefined. */
export function findScenario(id: string | null): Scenario | undefined {
	return SCENARIOS.find((scenario) => scenario.id === id);
}

/** A fresh deep copy of a scenario's world, safe to hand to the reducer. */
export function cloneWorld(world: WorldState): WorldState {
	return JSON.parse(JSON.stringify(world)) as WorldState;
}
