import {act, fireEvent, render, screen} from "@testing-library/react";
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
	expect(screen.getByRole("group", {name: /mark mark1/})).toBeInTheDocument();
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

test("arrow keys turn a focused boat: 5° a press, 1° with Shift", () => {
	window.location.hash = "";
	render(<App />);
	const boat1 = screen.getByRole("group", {name: /^boat1, heading 90 degrees/});
	boat1.focus();
	fireEvent.keyDown(boat1, {key: "ArrowRight"});
	expect(screen.getByRole("group", {name: /^boat1, heading 95 degrees/})).toBeInTheDocument();
	fireEvent.keyDown(boat1, {key: "ArrowLeft", shiftKey: true});
	expect(screen.getByRole("group", {name: /^boat1, heading 94 degrees/})).toBeInTheDocument();
});

test("a tray item clicked from the keyboard adds it, and the picker then shows a custom scenario", () => {
	window.location.hash = "";
	render(<App />);
	expect(screen.getAllByRole("group", {name: /^boat\d, heading/})).toHaveLength(2);
	fireEvent.click(screen.getByRole("button", {name: "Add boat"}), {detail: 0});
	expect(screen.getAllByRole("group", {name: /^boat\d, heading/})).toHaveLength(3);
	expect(screen.getByLabelText("Scenario")).toHaveDisplayValue("Custom scenario");
	fireEvent.click(screen.getByRole("button", {name: "Add gate"}), {detail: 0});
	expect(screen.getAllByRole("group", {name: /^Gate mark/})).toHaveLength(2);
});

test("Delete removes a focused boat or mark; Reset brings the scenario back", () => {
	window.location.hash = "#/scenario/windward-mark";
	render(<App />);
	fireEvent.keyDown(screen.getByRole("group", {name: /^boat3, heading/}), {key: "Delete"});
	expect(screen.queryByRole("group", {name: /^boat3, heading/})).not.toBeInTheDocument();
	fireEvent.keyDown(screen.getByRole("group", {name: /^Windward mark mark1/}), {key: "Delete"});
	expect(screen.queryByRole("group", {name: /^Windward mark mark1/})).not.toBeInTheDocument();
	expect(screen.getByLabelText("Scenario")).toHaveDisplayValue("Custom scenario");
	fireEvent.click(screen.getByRole("button", {name: "Reset"}));
	expect(screen.getByRole("group", {name: /^boat3, heading/})).toBeInTheDocument();
	expect(screen.getByLabelText("Scenario")).toHaveValue("windward-mark");
	window.location.hash = "";
});
