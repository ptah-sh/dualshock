import { z } from "zod";

export const DualshockConfig = z.object({
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
});

export type DualshockConfig = z.infer<typeof DualshockConfig>;
