import {render, screen} from "@testing-library/react";
import App from "./App";

test("renders the rules sidebar", () => {
	render(<App />);
	const heading = screen.getByText(/Right-of-Way Rules/i);
	expect(heading).toBeInTheDocument();
});
