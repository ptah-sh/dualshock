import { describe, test, expect } from "vitest";
import { createSchema } from "./schema.js";
import { RpcServer } from "../RpcServer.js";
import { pino } from "pino";
import { rpc, on, emits } from "../RpcDefinition.js";
import { z } from "zod";
import { refine } from "../refine.js";
import { createTypescript } from "./typescript.js";

const server = new RpcServer({
	logger: pino({ enabled: false }),
	clients: {
		invokables: {},
		events: {},
	},
});

server
	.rpc(
		"rpc-in-root-ns",
		rpc()
			.args(z.number())
			.fn(async () => console.log("hello!")),
	)
	.ns("some-ns")
	.rpc(
		"rpc-in-some-ns",
		rpc()
			.context(z.object({}))
			.args(
				z.object({
					someArg: z.string(),
					nullableArg: z.number().nullable(),
				}),
			)
			.returns(z.string())
			.fn(async () => "hello!"),
	)
	.ns("sub-ns-in-some-ns")
	.on(
		"event-handler-in-sub-ns",
		on()
			.args(z.number())
			.refine([
				refine()
					.returns(z.string())
					.pre(async () => true),
			])
			.fn(async () => undefined),
	);

server.ns("some-ns-for-events").emits(
	"event-in-some-ns-for-events",
	emits().payload(
		z.object({
			eventKey: z.string(),
		}),
	),
);

describe("schema", () => {
	test("createSchema", () => {
		expect(
			createSchema({
				registry: server.registry(),
				events: server.events(),
			}),
		).toMatchSnapshot();
	});
});

describe("typescript", () => {
	test("createTypescript", () => {
		expect(
			createTypescript({
				schema: createSchema({
					registry: server.registry(),
					events: server.events(),
				}),
			}),
		).toMatchSnapshot();
	});
});
