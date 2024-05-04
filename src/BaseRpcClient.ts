import type { Logger } from "pino";
import { RpcRouter } from "./RpcRouter";
import type { RpcDefinition } from "./RpcDefinition";
import type { ZodType, ZodTypeDef } from "zod";

export abstract class BaseRpcClient<Context extends object> {
	constructor(
		protected log: Logger,
		protected router: RpcRouter<Context>,
	) {}

	rpc<A extends ZodType, R extends ZodType>(
		opts: RpcDefinition<A, R, Context>,
	): RpcRouter<Context> {
		return this.router.rpc(opts);
	}

	ns(name: string): RpcRouter<Context> {
		return this.router.ns(name);
	}

	registry<
		A extends ZodType<any, ZodTypeDef, any> | undefined,
		R extends ZodType<any, ZodTypeDef, any> | undefined,
	>(): Record<string, RpcDefinition<A, R, Context>> {
		return collectRoutes([], this.router);
	}
}

function collectRoutes<
	A extends ZodType<any, ZodTypeDef, any> | undefined,
	R extends ZodType<any, ZodTypeDef, any> | undefined,
	Context extends object,
>(
	path: string[],
	router: RpcRouter<Context>,
): Record<string, RpcDefinition<A, R, Context>> {
	return Object.entries(router.registry).reduce((acc, [key, value]) => {
		if (value instanceof RpcRouter) {
			return {
				...acc,
				...collectRoutes([...path, key], value),
			};
		}

		return {
			...acc,
			[`${[...path, key].join(":")}`]: value,
		};
	}, {});
}
