import { NotFoundError } from "./errors";
import type { ZodType, TypeOf } from "zod";
import type { Logger } from "pino";

export interface RpcOptions<A extends ZodType, R extends ZodType> {
	name: string;
	args?: A;
	result?: R;
	fn: (args: TypeOf<A>) => Promise<TypeOf<R>>;
}

export class RpcRouter {
	protected registry: Record<string, RpcRouter | RpcOptions<ZodType, ZodType>> =
		{};

	constructor(
		protected log: Logger,
		protected namespace?: string,
	) {}

	ns(name: string): RpcRouter {
		// TODO: throw an error if the rpc/namespace were already registered

		const subRouter = new RpcRouter(
			this.log,
			[this.namespace, name].filter(Boolean).join(":"),
		);

		this.registry[name] = subRouter;

		return subRouter;
	}

	rpc<A extends ZodType, R extends ZodType>(opts: RpcOptions<A, R>): RpcRouter {
		// TODO: add name validation - allow only A-z, 0-9 in specific order
		// TODO: throw an error if the rpc/namespace were already registered
		const name = [this.namespace, opts.name].filter(Boolean).join(":");

		this.log.info(`RPC registerd - '${name}'`);

		this.registry[opts.name] = opts as RpcOptions<any, any>;

		return this;
	}

	async handle(rpcName: string, jsonData: unknown): Promise<unknown> {
		const columnPos = rpcName.indexOf(":");

		const ns = columnPos > 0 ? rpcName.slice(0, columnPos) : undefined;
		const rpc = columnPos > 0 ? rpcName.slice(columnPos + 1) : rpcName;

		const rpcDef = this.registry[ns || rpc];
		if (rpcDef == null) {
			throw new NotFoundError(rpcName);
		}

		if (rpcDef instanceof RpcRouter) {
			return rpcDef.handle(rpc, jsonData);
		}

		const { args: argsSchema, result: resultSchema, fn } = rpcDef;

		const args = await argsSchema?.parseAsync(jsonData);

		const result = await fn.call(null, args);
		if (
			true /** TODO: add config option `shouldCheckResponses` in dev mode */
		) {
			resultSchema?.parse(result);
		}

		return result;
	}
}
