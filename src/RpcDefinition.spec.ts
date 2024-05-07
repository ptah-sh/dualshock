import { describe, test } from "vitest";
import { refine } from "./refine.js";
import { z } from "zod";
import { rpc } from "./RpcDefinition.js";

describe("RpcDefinition", () => {
	test("complex type", () => {
		rpc()
			.context(
				z.object({
					contextFromRpc: z.string(),
					stringContextFromRpc: z.string(),
				}),
			)
			.args(
				z.object({
					argsFromRpc: z.string(),
				}),
			)
			.returns(
				z.object({
					returnsFromRpc: z.string(),
				}),
			)
			.refine([
				refine()
					.message("hello")
					.path(["argsFromRpc"])
					.args(
						z.object({
							argsFromRpc: z.string(),
						}),
					)
					.returns(
						z.object({
							returnsFromRpc: z.string(),
						}),
					)
					.context(
						z.object({
							contextFromRpc: z.string(),
							stringContextFromRpc: z.string(),
						}),
					)
					.pre(async ({ argsFromRpc }, { contextFromRpc }) => {
						console.log({ argsFromRpc, contextFromRpc });

						return true;
					})
					.post(
						async ({ argsFromRpc }, { returnsFromRpc }, { contextFromRpc }) => {
							console.log({ argsFromRpc, returnsFromRpc, contextFromRpc });

							return true;
						},
					)
					.code("hello"),
				refine()
					.context(
						z.object({
							contextFromRpc: z.string(),
						}),
					)
					.message("hello2")
					.path(["argsFromRpc"])
					.args(
						z.object({
							argsFromRpc: z.string(),
						}),
					)
					.returns(
						z.object({
							returnsFromRpc: z.string(),
						}),
					)
					.post(
						async ({ argsFromRpc }, { returnsFromRpc }, { contextFromRpc }) => {
							console.log({ argsFromRpc, returnsFromRpc, contextFromRpc });

							return true;
						},
					),
			])
			.fn(async ({ argsFromRpc }, context) => {
				const { contextFromRpc: itemFromContext } = context;

				return {
					returnsFromRpc: argsFromRpc + itemFromContext,
				};
			});
	});

	test("refiniment", () => {
		refine()
			.message("test")
			.code("custom")
			.args(
				z.object({
					fromArgs: z.string(),
				}),
			)
			.context(
				z.object({
					fromContext: z.string(),
				}),
			)
			.path(["test"])
			.pre(({ fromArgs }, { fromContext }) => {
				console.log(fromArgs, fromContext);

				return Promise.resolve(true);
			})
			.returns(
				z.object({
					fromReturns: z.string(),
				}),
			)
			.post(async ({ fromArgs }, { fromReturns }, { fromContext }) => {
				console.log(fromArgs, fromReturns, fromContext);

				return Promise.resolve(true);
			}).refineSchema;
	});
});
