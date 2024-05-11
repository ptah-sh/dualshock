import { jsonSchemaToZod } from "json-schema-to-zod";

export const createTypescript = (args: {
	schema: { rpc: any; emits: any };
	rpcTypeName?: string;
	emitsTypeName?: string;
}): string => {
	const {
		schema,
		rpcTypeName = "DualshockInvokables",
		emitsTypeName = "DualshockEvents",
	} = args;
	const contents = [];

	contents.push("import { z } from 'zod';");
	contents.push("");

	contents.push(`export const ${emitsTypeName} = {`);
	for (const [event, { payload }] of Object.entries<any>(schema.emits)) {
		contents.push(`  "${event}": {`);
		contents.push(
			`    payload: ${jsonSchemaToZod(payload).replace(/\.strict\(\)/g, "")},`,
		);
		contents.push("  },");
	}
	contents.push("} as const;");
	contents.push("");

	contents.push(`export const ${rpcTypeName} = {`);
	for (const [rpc, { args, returns }] of Object.entries<any>(schema.rpc)) {
		contents.push(`  "${rpc}": {`);
		contents.push(
			`    args: ${
				args
					? jsonSchemaToZod(args).replace(/\.strict\(\)/g, "")
					: "`.undefined()"
			},`,
		);
		contents.push(
			`    returns: ${
				returns
					? jsonSchemaToZod(returns).replace(/\.strict\(\)/g, "")
					: "z.undefined()"
			},`,
		);
		contents.push("  },");
	}
	contents.push("} as const;");
	contents.push("");

	return contents.join("\n");
};
