#!/usr/bin/env node

import { program } from "commander";
import { writeFile, readFile } from "node:fs/promises";
import { createSchema } from "./schema.js";
import { DualshockConfig } from "./config.js";
import { createTypescript } from "./typescript.js";

program.option("--config <path>");

program
	.command("schema")
	.description(
		"Generate Dualshock RPC Schema to create client's type definitions (or client libs)",
	)
	// TODO: add beautiful error message - check if the file exists
	.action(async () => {
		const config = await readCommandConfig("schema");

		const schema = createSchema(config);

		const serviceSchema = JSON.stringify(schema, null, 2);

		const outputPath = getCwdPath(config.output);
		await writeFile(outputPath, serviceSchema);

		console.log(`🎉 Successfully generated schema to ${config.output}`);

		process.exit(0);
	});

program
	.command("typescript")
	.description("Generate TypeScript types from the provided JSON Schema")
	.action(async () => {
		// TODO: Should we call resolveRefs here?
		// import { z } from "zod"
		// import { resolveRefs } from "json-refs"
		// import { format } from "prettier"
		// import jsonSchemaToZod from "json-schema-to-zod"

		// async function example(jsonSchema: any) {
		//   const { resolved }= await resolveRefs(jsonSchema)
		//   const code = jsonSchemaToZod(resolved)
		//   const formatted = await format(code, { parser: "typescript" })

		//   return formatted
		// }

		const config = await readCommandConfig("typescript");

		const { $schemaVersion, ...schema } = await fetchSchema(config.schema);

		if ($schemaVersion !== "dualshock:1") {
			throw new Error("Invalid schema version");
		}

		const header = [
			"// This file was automatically generated by the @ptah/dualshock package",
			"// DO NOT EDIT",
			"//",
			`// Schema: ${config.schema}`,
			`// Schema Version: ${$schemaVersion}`,
			"",
		];

		const contents = createTypescript({
			schema,
			rpcTypeName: config.rpcTypeName,
			emitsTypeName: config.eventTypeName,
		});

		await writeFile(config.output, `${header.join("\n") + contents}\n`, {
			encoding: "utf8",
		});

		console.log(
			`🎉 Successfully generated TypeScript definitions to ${config.output}`,
		);

		process.exit(0);
	});

program.parse();

function getCwdPath(path: string) {
	const slashedPath = path.startsWith("/") ? path : `/${path}`;

	return process.cwd() + slashedPath;
}

async function readCommandConfig<K extends keyof DualshockConfig>(
	key: K,
): Promise<DualshockConfig[K] | never> {
	const { config: configFile = "dualshock.config.ts" } = program.opts();

	const configFilePath = getCwdPath(configFile);

	const { default: configModule } = await import(configFilePath);

	const config = DualshockConfig.parse(configModule);
	if (!config[key]) {
		console.error(`No '${key}' section in the config`);

		process.exit(1);
	}

	return config[key];
}

async function fetchSchema(schemaFile: string) {
	if (schemaFile.startsWith("http")) {
		return fetch(schemaFile).then((res) => res.json());
	}

	return JSON.parse(await readFile(getCwdPath(schemaFile), "utf8"));
}
