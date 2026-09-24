import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Pure-Node config for the LaTeX formatter unit tests: no Obsidian integration
// global setup and no esbuild test build needed.
// Run with: npm run test:formatter
export default defineConfig({
	resolve: {
		// mirror tsconfig's baseUrl so `src/...` imports resolve
		alias: { src: fileURLToPath(new URL("./src", import.meta.url)) },
	},
	test: {
		include: ["tests/latex_formatter/**/*.test.ts"],
		environment: "node",
	},
});
