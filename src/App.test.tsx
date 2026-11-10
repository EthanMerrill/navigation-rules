import {act, render, screen} from "@testing-library/react";
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

test("switching scenario via the hash does not make Rule 15 applicable on the first frame", async () => {
	window.location.hash = "#/scenario/port-starboard";
	render(<App />);
	await act(async () => {
		window.location.hash = "#/scenario/clear-astern";
		window.dispatchEvent(new HashChangeEvent("hashchange"));
	});
	expect(screen.getByLabelText("Scenario")).toHaveValue("clear-astern");
	expect(document.body.textContent).not.toMatch(/has just acquired right of way/);
	window.location.hash = "";
});
