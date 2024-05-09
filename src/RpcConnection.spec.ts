import { describe, test, expectTypeOf } from "vitest";

import { RpcConnection } from "./RpcConnection.js";
import { WebSocketDom } from "./websocket/WebSocket.dom.js";
import { pino } from "pino";
import { RpcRouter } from "./RpcRouter.js";
import { z } from "zod";

const logger = pino({ enabled: false });
const router = new RpcRouter(logger);

const connection = new RpcConnection(
	new WebSocketDom(new WebSocket("ws://localhost")),
	logger,
	router,
	{
		"args-object_returns-object": {
			args: z.object({
				arg1: z.string(),
			}),
			returns: z.object({
				return1: z.string(),
			}),
		},
		"args-string_returns-void": {
			args: z.string({}),
			returns: z.undefined(),
		},
		"args-string_returns-number": {
			args: z.string({}),
			returns: z.number(),
		},
	},
	{
		"event-with-payload": {
			payload: z.object({
				payload1: z.string(),
			}),
		},
		"event-without-payload": {
			payload: z.undefined(),
		},
	},
);

describe("RpcConnection", async () => {
	test("emit - event-with-payload", async () => {
		const emit = connection.emit<"event-with-payload", { payload1: string }>;

		expectTypeOf(emit).toBeFunction();

		expectTypeOf(emit).parameter(0).toMatchTypeOf<"event-with-payload">();
		expectTypeOf(emit).parameter(1).toMatchTypeOf<{ payload1: string }>();

		expectTypeOf(emit).returns.toMatchTypeOf<Promise<void>>();
	});

	test("emit - event-without-payload", async () => {
		const emit = connection.emit<"event-without-payload", undefined>;

		expectTypeOf(emit).toBeFunction();

		expectTypeOf(emit).parameter(0).toMatchTypeOf<"event-without-payload">();
		expectTypeOf(emit).parameter(1).toMatchTypeOf<undefined>();

		expectTypeOf(emit).returns.toMatchTypeOf<Promise<void>>();
	});

	test("invoke - args-object_returns-object", async () => {
		const invoke = connection.invoke<
			"args-object_returns-object",
			{ arg1: string },
			{ return1: string }
		>;

		expectTypeOf(invoke).toBeFunction();

		expectTypeOf(invoke)
			.parameter(0)
			.toMatchTypeOf<"args-object_returns-object">();

		expectTypeOf(invoke).parameter(1).toMatchTypeOf<{ arg1: string }>();

		expectTypeOf(invoke).returns.toMatchTypeOf<
			Promise<{
				return1: string;
			}>
		>();
	});

	test("invoke - args-string_returns-void", async () => {
		const invoke = connection.invoke<
			"args-string_returns-void",
			string,
			undefined
		>;

		expectTypeOf(invoke).toBeFunction();

		expectTypeOf(invoke)
			.parameter(0)
			.toMatchTypeOf<"args-string_returns-void">();

		expectTypeOf(invoke).parameter(1).toMatchTypeOf<string>();

		expectTypeOf(invoke).returns.toMatchTypeOf<Promise<void>>();
	});
});
