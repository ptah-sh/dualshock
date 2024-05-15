import { z } from "zod";

// TODO: add option to filter rpcs by regexp/namespace/etc.
//   Needed for creating schema/typings for debug plugin.
export const DualshockConfig = z.object({
	schema: z
		.object({
			registry: z
				.record(
					z.object({
						args: z.any(),
						returns: z.any(),
					}),
				)
				.default({}),
			events: z
				.record(
					z.object({
						payload: z.any(),
					}),
				)
				.default({}),
			output: z.string().default("dualshock.schema.json"),
		})
		.default({}),
	typescript: z
		.object({
			schema: z.string().default("dualshock.schema.json"),
			output: z.string().default("src/dualshock.gen.ts"),
			rpcTypeName: z.string().default("DualshockInvokables"),
			eventTypeName: z.string().default("DualshockEvents"),
		})
		.default({}),
});

export type DualshockConfig = z.infer<typeof DualshockConfig>;
export type DualshockSchemaConfig = {
	schema: DualshockConfig["schema"];
};

export type DualshockTypescriptConfig = {
	typescript: DualshockConfig["typescript"];
};
