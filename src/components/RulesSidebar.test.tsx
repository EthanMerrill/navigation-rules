import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RulesSidebar from "./RulesSidebar";
import {step} from "../rules/rulesEngine";
import {findScenario} from "../scenarios";

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
		expect(screen.getByText(/Rule 43\.1b — /)).toBeInTheDocument();
		expect(screen.queryByText(/Rule 21 — Exoneration/)).not.toBeInTheDocument();
	});

	it("collapses the reference group by default and expands it on click", async () => {
		renderSidebar();
		const header = screen.getByRole("button", {name: /Other rules \(reference only\)/});
		expect(header).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByText(/Rule 31 —/)).not.toBeInTheDocument();
		await userEvent.click(header);
		expect(header).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByText(/Rule 31 —/)).toBeInTheDocument();
	});
});
