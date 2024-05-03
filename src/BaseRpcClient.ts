import type { Logger } from "pino";
import type { RpcRouter } from "./RpcRouter";
import type { RpcDefinition } from "./RpcDefinition";
import type { ZodType } from "zod";

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
}
