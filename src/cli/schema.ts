import { zodToJsonSchema } from "zod-to-json-schema";
import type { DualshockConfig } from "./config.js";

export const createSchema = (
	config: Pick<DualshockConfig["schema"], "registry" | "events">,
): any => {
	const schema = {
		$schemaVersion: "dualshock:1",
	} as any;

	schema.rpc = Object.entries(config.registry).reduce(
		(acc, [key, value]: [string, any]) => {
			const rpcSchema: any = {};

			if (value.args) {
				rpcSchema.args = zodToJsonSchema(value.args);
			}
			if (value.returns) {
				rpcSchema.returns = zodToJsonSchema(value.returns);
			}

			acc[key] = rpcSchema;

			return acc;
		},
		{} as any,
	);

	schema.emits = Object.entries(config.events).reduce(
		(acc, [key, value]: [string, any]) => {
			const eventSchema: any = {};
			if (value.payload) {
				eventSchema.payload = zodToJsonSchema(value.payload);
			}

			acc[key] = eventSchema;

			return acc;
		},
		{} as any,
	);

	return schema;
};
