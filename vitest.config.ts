import { defineConfig } from "vitest/config";

export default defineConfig({
	// test: {
	//     environment: "happy-dom",
	// },
	test: {
		typecheck: {
			enabled: true,
			tsconfig: "./tsconfig.json",
		},
	},
});
