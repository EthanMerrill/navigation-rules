import {createDefaultWorld} from "../state/worldReducer";
import {SCENARIOS} from "../scenarios";
import {IDENTITY_VIEW, fitView, worldBoundsPx} from "./fitView";

describe("worldBoundsPx", () => {
	it("is null for an empty world", () => {
		expect(worldBoundsPx({...createDefaultWorld(), boats: []})).toBeNull();
	});

	it("contains every boat centre with a margin", () => {
		const bounds = worldBoundsPx(createDefaultWorld())!;
		// Default boats are at px (300,150) and (300,350).
		expect(bounds.x).toBeLessThan(300);
		expect(bounds.x + bounds.width).toBeGreaterThan(300);
		expect(bounds.y).toBeLessThan(150);
		expect(bounds.y + bounds.height).toBeGreaterThan(350);
	});
});

describe("fitView", () => {
	it("returns the identity transform with nothing to fit or no viewport", () => {
		expect(fitView(null, {width: 800, height: 600})).toEqual(IDENTITY_VIEW);
		expect(fitView({x: 0, y: 0, width: 100, height: 100}, {width: 0, height: 0})).toEqual(IDENTITY_VIEW);
	});

	it("never zooms in past 1:1 and centres small content", () => {
		const view = fitView({x: 0, y: 0, width: 100, height: 100}, {width: 800, height: 600});
		expect(view.scale).toBe(1);
		expect(view.x).toBe(350);
		expect(view.y).toBe(250);
	});

	it("shrinks large content to fit inside the padded viewport", () => {
		const view = fitView({x: 100, y: 100, width: 2000, height: 1000}, {width: 1000, height: 1000}, 0);
		expect(view.scale).toBeCloseTo(0.5);
		// Left edge of the content lands on the left edge of the viewport.
		expect(100 * view.scale + view.x).toBeCloseTo(0);
	});

	it("fits every scenario into a 900×600 play area at a readable zoom", () => {
		for (const scenario of SCENARIOS) {
			const bounds = worldBoundsPx(scenario.world)!;
			const view = fitView(bounds, {width: 900, height: 600});
			expect(view.scale, scenario.id).toBeGreaterThanOrEqual(0.35);
			const left = bounds.x * view.scale + view.x;
			const right = (bounds.x + bounds.width) * view.scale + view.x;
			const top = bounds.y * view.scale + view.y;
			const bottom = (bounds.y + bounds.height) * view.scale + view.y;
			expect(left, scenario.id).toBeGreaterThanOrEqual(-0.5);
			expect(top, scenario.id).toBeGreaterThanOrEqual(-0.5);
			expect(right, scenario.id).toBeLessThanOrEqual(900.5);
			expect(bottom, scenario.id).toBeLessThanOrEqual(600.5);
		}
	});
});
