import { NotFoundError, ValidationError } from "./errors.js";
import { type ZodType, type TypeOf, ZodObject, ZodCustomIssue } from "zod";
import type { Logger } from "pino";
import type { RpcBuilder, TRpc } from "./RpcDefinition.js";

export class RpcRouter {
	public readonly registry: Record<string, RpcRouter | TRpc<any, any, any>> =
		{};

	constructor(protected log: Logger) {}

	ns(name: string): RpcRouter {
		// TODO: throw an error if the rpc/namespace were already registered

		const subRouter = new RpcRouter(this.log);

		this.registry[name] = subRouter;

		return subRouter;
	}

	rpc<
		A extends ZodType,
		R extends ZodType,
		C extends ZodType,
		T extends TRpc<A, R, C>,
		TOmit extends keyof TRpc<A, R, C> = never,
	>(
		name: string,
		rpcDef: Pick<RpcBuilder<A, R, C, T, TOmit>, "schema">,
	): RpcRouter {
		// TODO: add name validation - allow only A-z, 0-9 in specific order
		// TODO: throw an error if the rpc has been already registered
		this.registry[name] = rpcDef.schema;

		return this;
	}

	async handle(
		rpcName: string,
		jsonData: unknown,
		context: unknown,
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

		const args = await argsSchema?.parseAsync(jsonData);
		if (refine) {
			for (const ref of refine) {
				if (ref.pre) {
					if (!(await ref.pre(args, context))) {
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
		}

		const returns = await fn.call(null, args, context);
		if (refine) {
			for (const ref of refine) {
				if (ref.post) {
					if (!(await ref.post(args, returns, context))) {
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
		}

		return resultSchema?.parseAsync(returns);
	}
}
