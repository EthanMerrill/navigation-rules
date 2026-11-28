import {act, fireEvent, render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RulesSidebar from "./RulesSidebar";
import {step} from "../rules/rulesEngine";
import {findScenario} from "../scenarios";
import {SETTLE_MS} from "../hooks/useSettled";

function renderSidebar(scenario = "port-starboard") {
	const {evaluation} = step(findScenario(scenario)!.world, null, 0);
	return render(<RulesSidebar evaluation={evaluation} />);
}

describe("RulesSidebar grouping", () => {
	beforeEach(() => window.localStorage.clear());

	it("renders Part/Section group headers and an active count", () => {
		renderSidebar();
		expect(screen.getByRole("button", {name: /Section A — Right of Way/})).toBeInTheDocument();
		expect(screen.getByRole("button", {name: /Section B — General Limitations/})).toBeInTheDocument();
		expect(screen.getByRole("button", {name: /Section A — Right of Way.*1 active/})).toBeInTheDocument();
	});

	it("groups exoneration (Rule 43.1b) under Part 4", () => {
		renderSidebar("leeward-mark");
		expect(screen.getByRole("button", {name: /Part 4 — Other Requirements When Racing.*1 active/})).toBeInTheDocument();
		expect(screen.getByRole("heading", {name: /Rule 43\.1\(b\) — /})).toBeInTheDocument();
		expect(screen.queryByText(/Rule 21 — Exoneration/)).not.toBeInTheDocument();
	});

	it("collapses the reference group by default and expands it on click", async () => {
		renderSidebar();
		await userEvent.click(screen.getByRole("button", {name: "All rules"}));
		const header = screen.getByRole("button", {name: /Other rules \(reference only\)/});
		expect(header).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByText(/Rule 31 —/)).not.toBeInTheDocument();
		await userEvent.click(header);
		expect(header).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByText(/Rule 31 —/)).toBeInTheDocument();
	});

	it("lists only active rules by default, and every rule under All rules", async () => {
		renderSidebar();
		expect(screen.getByRole("button", {name: /Active/})).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByRole("heading", {name: /Rule 10 — /})).toBeInTheDocument();
		expect(screen.queryByRole("heading", {name: /Rule 13 — /})).not.toBeInTheDocument();
		expect(screen.queryByRole("button", {name: /Other rules \(reference only\)/})).not.toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", {name: "All rules"}));
		expect(screen.getByRole("heading", {name: /Rule 13 — /})).toBeInTheDocument();
		expect(window.localStorage.getItem("rules-sidebar.view")).toBe("all");
	});

	it("explains the sidebar and the colours behind the info button", async () => {
		renderSidebar();
		expect(screen.queryByRole("dialog", {name: "About these rules"})).not.toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", {name: "About these rules"}));
		expect(screen.getByRole("dialog", {name: "About these rules"})).toHaveTextContent(/Red outline: must keep clear/);
		await userEvent.keyboard("{Escape}");
		expect(screen.queryByRole("dialog", {name: "About these rules"})).not.toBeInTheDocument();
	});
});

describe("RulesSidebar settling", () => {
	beforeEach(() => {
		window.localStorage.clear();
		vi.useFakeTimers();
	});
	afterEach(() => vi.useRealTimers());

	const evaluate = (scenario: string) => step(findScenario(scenario)!.world, null, 0).evaluation;

	it("holds the last rules, greyed, while a drag changes them, and updates once it ends and settles", () => {
		const {rerender} = render(<RulesSidebar evaluation={evaluate("port-starboard")} interacting={false} />);
		expect(screen.getByRole("heading", {name: /Rule 10 — /})).toBeInTheDocument();

		rerender(<RulesSidebar evaluation={evaluate("port-starboard")} interacting={true} />);
		rerender(<RulesSidebar evaluation={evaluate("windward-leeward")} interacting={true} />);
		expect(screen.getByRole("status")).toHaveTextContent("Recalculating…");
		expect(screen.getByRole("heading", {name: /Rule 10 — /})).toBeInTheDocument();
		expect(screen.queryByRole("heading", {name: /Rule 11 — /})).not.toBeInTheDocument();

		// Still held: nothing changes however long it takes.
		act(() => vi.advanceTimersByTime(2000));
		expect(screen.queryByRole("heading", {name: /Rule 11 — /})).not.toBeInTheDocument();

		rerender(<RulesSidebar evaluation={evaluate("windward-leeward")} interacting={false} />);
		expect(screen.getByRole("status")).toHaveTextContent("Recalculating…");
		act(() => vi.advanceTimersByTime(SETTLE_MS + 10));
		expect(screen.getByRole("status")).toHaveTextContent("");
		expect(screen.getByRole("heading", {name: /Rule 11 — /})).toBeInTheDocument();
	});

	it("does not flag a press that changes nothing", () => {
		const evaluation = evaluate("port-starboard");
		const {rerender} = render(<RulesSidebar evaluation={evaluation} interacting={false} />);
		rerender(<RulesSidebar evaluation={evaluation} interacting={true} />);
		rerender(<RulesSidebar evaluation={evaluation} interacting={false} />);
		expect(screen.getByRole("status")).toHaveTextContent("");
	});
});

describe("RulesSidebar bottom sheet (narrow screens)", () => {
	beforeEach(() => window.localStorage.clear());

	const handle = () => screen.getByRole("button", {name: /Show rules|Hide rules/});
	const drag = (fromY: number, toY: number) => {
		fireEvent.pointerDown(handle(), {button: 0, pointerId: 1, clientY: fromY});
		for (let y = fromY; fromY > toY ? y >= toY : y <= toY; y += fromY > toY ? -20 : 20) fireEvent.pointerMove(handle(), {pointerId: 1, clientY: y});
		fireEvent.pointerUp(handle(), {pointerId: 1, clientY: toY});
	};

	it("opens when dragged up and closes when dragged back down", () => {
		renderSidebar();
		expect(handle()).toHaveAttribute("aria-expanded", "false");
		drag(700, 300);
		expect(handle()).toHaveAttribute("aria-expanded", "true");
		drag(300, 700);
		expect(handle()).toHaveAttribute("aria-expanded", "false");
	});

	it("follows the pointer while dragging", () => {
		renderSidebar();
		fireEvent.pointerDown(handle(), {button: 0, pointerId: 1, clientY: 700});
		fireEvent.pointerMove(handle(), {pointerId: 1, clientY: 600});
		expect(screen.getByRole("complementary", {name: "Rules"})).toHaveStyle({maxHeight: "154px"});
		fireEvent.pointerUp(handle(), {pointerId: 1, clientY: 600});
		expect(screen.getByRole("complementary", {name: "Rules"}).style.maxHeight).toBe("");
	});

	it("still toggles on a tap and from the keyboard", () => {
		renderSidebar();
		fireEvent.pointerDown(handle(), {button: 0, pointerId: 1, clientY: 700});
		fireEvent.pointerUp(handle(), {pointerId: 1, clientY: 701});
		expect(handle()).toHaveAttribute("aria-expanded", "true");
		fireEvent.click(handle(), {detail: 0});
		expect(handle()).toHaveAttribute("aria-expanded", "false");
	});
});
