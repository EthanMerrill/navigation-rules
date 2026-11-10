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

const WINDWARD_MARK: Mark = {id: "mark1", ...toWorld({x: 900, y: 90}), roundingSide: "port", kind: "windward"};
const OBSTRUCTION: Obstruction = {id: "obstruction1", ...toWorld({x: 950, y: 320}), radius: 0.7};

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
		description: "Three boats approach a windward mark to be left to port; one is already inside the three-hull-length zone.",
		world: worldOf([boat("boat1", 800, 220, 45), boat("boat2", 500, 500, 45), boat("boat3", 700, 560, 45)], {
			marks: [WINDWARD_MARK],
			course: {legs: [{toMarkId: WINDWARD_MARK.id}]},
		}),
	},
	{
		id: "obstruction",
		title: "Obstruction",
		description: "Two boats on the same tack approach an obstruction.",
		world: worldOf([boat("boat1", 500, 250, 90), boat("boat2", 560, 400, 90)], {obstructions: [OBSTRUCTION]}),
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
