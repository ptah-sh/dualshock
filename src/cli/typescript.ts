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

	contents.push("import { z, type ZodType } from 'zod';");
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

	// contents.push(`export type ${emitsTypeName} = {`);
	// contents.push(`  [key in keyof typeof ${emitsTypeName}]: {`);
	// contents.push(
	// 	`    payload: z.infer<typeof ${emitsTypeName}[key]["payload"]>;`,
	// );
	// contents.push("  };");
	// contents.push("};");
	// contents.push("");

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

	// contents.push("");
	// contents.push(`export type ${rpcTypeName} = {`);
	// contents.push(`  [key in keyof typeof ${rpcTypeName}]: {`);
	// contents.push(`    args: z.infer<typeof ${rpcTypeName}[key]["args"]>;`);
	// contents.push(
	// 	`    returns: ${rpcTypeName}[key]["returns"] extends ZodType<infer T> ? T : z.undefined();`,
	// );
	// contents.push("  };");
	// contents.push("}");
	// contents.push("");

	return contents.join("\n");
};
