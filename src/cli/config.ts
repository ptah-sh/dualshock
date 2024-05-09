import { z } from "zod";

export const DualshockConfig = z.object({
	schema: z.object({
		registry: z.record(
			z.object({
				args: z.any(),
				returns: z.any(),
			}),
		),
		events: z.record(
			z.object({
				payload: z.any(),
			}),
		),
		output: z.string().default("dualshock.schema.json"),
	}),
	typescript: z.object({
		schema: z.string().default("dualshock.schema.json"),
		output: z.string().default("src/dualshock.gen.ts"),
		rpcTypeName: z.string().default("DualshockInvokables"),
		eventTypeName: z.string().default("DualshockEvents"),
	}),
});

export type DualshockConfig = z.infer<typeof DualshockConfig>;
