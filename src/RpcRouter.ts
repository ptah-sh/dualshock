import { NotFoundError, ValidationError } from "./errors";
import { type ZodType, type TypeOf, ZodObject, ZodCustomIssue } from "zod";
import type { Logger } from "pino";
import type { ContextInstance } from "./context";
import type { RpcDefinition } from "./RpcDefinition";
import { Refine } from "./refine";

export class RpcRouter<Context extends object> {
	public readonly registry: Record<
		string,
		RpcRouter<Context> | RpcDefinition<ZodType, ZodType, Context>
	> = {};

	constructor(protected log: Logger) {}

	ns(name: string): RpcRouter<Context> {
		// TODO: throw an error if the rpc/namespace were already registered

		const subRouter = new RpcRouter<Context>(this.log);

		this.registry[name] = subRouter;

		return subRouter;
	}

	rpc<A extends ZodType, R extends ZodType>(
		opts: RpcDefinition<A, R, Context>,
	): RpcRouter<Context> {
		// TODO: add name validation - allow only A-z, 0-9 in specific order
		// TODO: throw an error if the rpc has been already registered
		this.registry[opts.name] = opts as RpcDefinition<any, any, Context>;

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

		const { args: argsSchema, returns: resultSchema, fn, refine } = rpcDef;

		const strictSchema =
			argsSchema instanceof ZodObject ? argsSchema.strict() : argsSchema;

		const args = await strictSchema?.parseAsync(jsonData);
		if (refine?.args) {
			await runRefinements(args, refine.args, context);
		}

		const result = await fn.call(null, args, context);
		if (refine?.returns) {
			await runRefinements(result, refine.returns, context);
		}

		return resultSchema?.parseAsync(result);
	}
}

async function runRefinements(
	data: any,
	refinements: Refine<any, any>[],
	context: any,
) {
	for (const ref of refinements) {
		if (!(await ref.fn(data, context))) {
			throw new ValidationError([
				{
					code: ref.code || "custom",
					message: ref.message,
					path: ref.path,
				},
			]);
		}
	}
}
