import {defineConfig} from "vitest/config";
import react from "@vitejs/plugin-react";

// Base path is required because the app is deployed to GitHub Pages under the
// /navigation-rules/ sub-path (see "homepage" in package.json).
export default defineConfig({
	base: "/navigation-rules/",
	plugins: [react()],
	build: {
		outDir: "build",
	},
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: "./src/setupTests.ts",
		css: false,
	},
});
