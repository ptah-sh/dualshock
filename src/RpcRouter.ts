import { NotFoundError, ValidationError } from "./errors";
import { type ZodType, type TypeOf, ZodObject, ZodCustomIssue } from "zod";
import type { Logger } from "pino";
import type { ContextInstance } from "./context";
import type { Refine } from "./refine";

export type RpcOptions<
	A extends ZodType,
	R extends ZodType,
	Context extends object,
> = {
	name: string;
	args?: A;
	refine?: Refine<TypeOf<A>, Context>[];
} & (
	| {
			returns: R;
			fn: (
				args: TypeOf<A>,
				context: ContextInstance<Context>,
			) => Promise<TypeOf<R>>;
	  }
	| {
			returns?: never;
			fn: (args: TypeOf<A>, context: ContextInstance<Context>) => Promise<void>;
	  }
);

export class RpcRouter<Context extends object> {
	protected registry: Record<
		string,
		RpcRouter<Context> | RpcOptions<ZodType, ZodType, Context>
	> = {};

	constructor(
		protected log: Logger,
		protected namespace?: string,
	) {}

	ns(name: string): RpcRouter<Context> {
		// TODO: throw an error if the rpc/namespace were already registered

		const subRouter = new RpcRouter<Context>(
			this.log,
			[this.namespace, name].filter(Boolean).join(":"),
		);

		this.registry[name] = subRouter;

		return subRouter;
	}

	rpc<A extends ZodType, R extends ZodType>(
		opts: RpcOptions<A, R, Context>,
	): RpcRouter<Context> {
		// TODO: add name validation - allow only A-z, 0-9 in specific order
		// TODO: throw an error if the rpc/namespace were already registered
		const name = [this.namespace, opts.name].filter(Boolean).join(":");

		this.log.info(`RPC registerd - '${name}'`);

		this.registry[opts.name] = opts as RpcOptions<any, any, Context>;

		return this;
	}

	async handle(
		rpcName: string,
		jsonData: unknown,
		context: ContextInstance<Context>,
	): Promise<unknown> {
		const columnPos = rpcName.indexOf(":");

		const ns = columnPos > 0 ? rpcName.slice(0, columnPos) : undefined;
		const rpc = columnPos > 0 ? rpcName.slice(columnPos + 1) : rpcName;

		const rpcDef = this.registry[ns || rpc];
		if (rpcDef == null) {
			throw new NotFoundError(rpcName);
		}

		if (rpcDef instanceof RpcRouter) {
			return rpcDef.handle(rpc, jsonData, context);
		}

		const { args: argsSchema, returns: resultSchema, fn, refine = [] } = rpcDef;

		const strictSchema =
			argsSchema instanceof ZodObject ? argsSchema.strict() : argsSchema;

		const args = await strictSchema?.parseAsync(jsonData);

		for (const ref of refine) {
			if (!(await ref.fn(args, context))) {
				throw new ValidationError([
					{
						code: ref.code || "custom",
						message: ref.message,
						path: ref.path,
					},
				]);
			}
		}

		const result = await fn.call(null, args, context);

		return resultSchema?.parse(result);
	}
}
