import {render, screen} from "@testing-library/react";
import App from "./App";

test("renders the rules sidebar", () => {
	render(<App />);
	const heading = screen.getByText(/Right-of-Way Rules/i);
	expect(heading).toBeInTheDocument();
});

test("loads the scenario named by the hash and the picker reflects it", () => {
	window.location.hash = "#/scenario/windward-mark";
	render(<App />);
	expect(screen.getByLabelText("Scenario")).toHaveValue("windward-mark");
	expect(screen.getByRole("img", {name: /Mark mark1/})).toBeInTheDocument();
	window.location.hash = "";
});
