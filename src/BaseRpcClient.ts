import type { Logger } from "pino";
import { RpcRouter } from "./RpcRouter.js";
import type { TRpc } from "./RpcDefinition.js";
import type { TEvent } from "./events.js";
import type { ZodTypeAny } from "zod";

export abstract class BaseRpcClient {
	constructor(
		protected log: Logger,
		protected router: RpcRouter,
	) {}

	emits(...args: Parameters<RpcRouter["emits"]>): RpcRouter {
		return this.router.emits(...args);
	}

	on(...args: Parameters<RpcRouter["on"]>): RpcRouter {
		return this.router.on(...args);
	}

	rpc(...args: Parameters<RpcRouter["rpc"]>): RpcRouter {
		return this.router.rpc(...args);
	}

	ns(...args: Parameters<RpcRouter["ns"]>): RpcRouter {
		return this.router.ns(...args);
	}

	events(): Record<string, TEvent<ZodTypeAny>> {
		return collectRoutes("emits", [], this.router);
	}

	registry(): Record<string, TRpc<any, any, any>> {
		return collectRoutes("rpc", [], this.router);
	}
}

function collectRoutes<K extends "emits" | "rpc">(
	kind: K,
	path: string[],
	router: RpcRouter,
): Record<string, { rpc: TRpc<any, any, any>; emits: TEvent<any> }[K]> {
	return Object.entries(router.registry).reduce((acc, [key, value]) => {
		if (!key.startsWith(`${kind}$`) && !key.startsWith("ns$")) {
			return acc;
		}

		const name = key.replace(/(ns|emits|rpc)\$/, "");

		if (value instanceof RpcRouter) {
			return {
				...acc,
				...collectRoutes(kind, [...path, name], value),
			};
		}

		return {
			...acc,
			[`${[...path, name].join(":")}`]: value,
		};
	}, {});
}
