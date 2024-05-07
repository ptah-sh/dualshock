import type { Logger } from "pino";
import { RpcRouter } from "./RpcRouter.js";
import type { RpcBuilder, TRpc } from "./RpcDefinition.js";
import type { ZodType, ZodTypeDef } from "zod";

export abstract class BaseRpcClient {
	constructor(
		protected log: Logger,
		protected router: RpcRouter,
	) {}

	rpc<
		A extends ZodType,
		R extends ZodType,
		C extends ZodType,
		T extends TRpc<A, R, C>,
		TOmit extends keyof TRpc<A, R, C> = never,
	>(name: string, rpcDef: RpcBuilder<A, R, C, T, TOmit>): RpcRouter {
		return this.router.rpc(name, rpcDef);
	}

	ns(name: string): RpcRouter {
		return this.router.ns(name);
	}

	registry(): Record<string, TRpc<any, any, any>> {
		return collectRoutes([], this.router);
	}
}

function collectRoutes(
	path: string[],
	router: RpcRouter,
): Record<string, TRpc<any, any, any>> {
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
