import {fireEvent, render, screen} from "@testing-library/react";
import type {BoatState, WorldState} from "../model/world";
import {createDefaultWorld} from "../state/worldReducer";
import HailControls from "./HailControls";

function boat(id: string, x: number, y: number, heading: number): BoatState {
	return {id, x, y, heading, nextLegIndex: 0};
}

// Wind from the north. Both boats on a beam reach on port tack, no obstruction: a hail would break rule 20.1.
const reaching = (): WorldState => ({...createDefaultWorld(), boats: [boat("boat1", 6, 8, 90), boat("boat2", 6.7, 7.3, 90)]});

describe("HailControls", () => {
	it("allows a hail that breaks rule 20.1 and shows a visible warning instead of disabling the button", () => {
		const dispatch = vi.fn();
		render(<HailControls world={reaching()} dispatch={dispatch} />);
		const button = screen.getByRole("button", {name: "boat1: room to tack"});
		expect(button).toBeEnabled();
		expect(screen.getAllByRole("status")[0]).toHaveTextContent(/breaks rule 20\.1: Only a boat sailing close-hauled/);
		fireEvent.click(button);
		expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({type: "hail", from: "boat1", to: "boat2", kind: "roomToTack"}));
	});

	it("shows no warning for a valid hail", () => {
		const world: WorldState = {...reaching(), boats: [boat("boat1", 6, 8, 315), boat("boat2", 6.7, 7.3, 315)], obstructions: [{id: "o", x: 4, y: 5.5, radius: 0.7}]};
		render(<HailControls world={world} dispatch={vi.fn()} />);
		expect(screen.getByRole("button", {name: "boat1: room to tack"})).toBeEnabled();
		expect(screen.queryByRole("status")).not.toBeInTheDocument();
	});

	it("disables the button when there is no boat on the same tack to hail", () => {
		const world: WorldState = {...reaching(), boats: [boat("boat1", 6, 8, 90), boat("boat2", 6.7, 7.3, 270)]};
		render(<HailControls world={world} dispatch={vi.fn()} />);
		expect(screen.getByRole("button", {name: "boat1: room to tack"})).toBeDisabled();
	});
});
