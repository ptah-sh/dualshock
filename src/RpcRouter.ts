import { NotFoundError, ValidationError } from "./errors.js";
import type { Logger } from "pino";
import type { EmitsBrand, OnBrand, RpcBrand, TRpc } from "./RpcDefinition.js";
import type { TEvent } from "./events.js";

export class RpcRouter {
	public readonly registry: {
		[namespace: `ns$${string}`]: RpcRouter;
		[rpc: `rpc$${string}`]: TRpc<any, any, any> & RpcBrand;
		[on: `on$${string}`]: Array<TRpc<any, any, any> & OnBrand>;
		[emits: `emits$${string}`]: TEvent<any> & EmitsBrand;
	} = {};

	constructor(protected log: Logger) {}

	ns(name: string): RpcRouter {
		// TODO: throw an error if the rpc/namespace were already registered

		const subRouter = new RpcRouter(this.log);

		this.registry[`ns$${name}`] = subRouter;

		return subRouter;
	}

	emits(name: string, event: { schema: TEvent<any> & EmitsBrand }): RpcRouter {
		this.registry[`emits$${name}`] = event.schema;

		return this;
	}

	on(
		name: string,
		event: { schema: TRpc<any, any, any> & OnBrand },
	): RpcRouter {
		this.registry[`on$${name}`] ??= [];
		this.registry[`on$${name}`].push(event.schema);

		return this;
	}

	rpc(
		name: string,
		rpcDef: { schema: TRpc<any, any, any> & RpcBrand },
	): RpcRouter {
		// TODO: add name validation - allow only A-z, 0-9 in specific order
		// TODO: throw an error if the rpc has been already registered
		this.registry[`rpc$${name}`] = rpcDef.schema;

		return this;
	}

	async handleEvent(
		eventName: string,
		jsonData: unknown,
		context: unknown,
	): Promise<void> {
		const columnPos = eventName.indexOf(":");

		const ns = columnPos > 0 ? eventName.slice(0, columnPos) : undefined;
		const event = columnPos > 0 ? eventName.slice(columnPos + 1) : eventName;

		const nsDef = this.registry[`ns$${ns}`];
		if (nsDef != null) {
			return nsDef.handleEvent(event, jsonData, context);
		}

		const eventsDefs = this.registry[`on$${event}`];
		if (eventsDefs == null) {
			// Returning early as we are not listening to this event.
			return;
		}

		for (const eventDef of eventsDefs) {
			const { args: argsSchema, fn, refine } = eventDef;

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

			// TODO: do not await for the event handler call as they should queue up
			await fn.call(null, args, context);
		}
	}

	async handleRpc(
		rpcName: string,
		jsonData: unknown,
		context: unknown,
	): Promise<unknown> {
		const columnPos = rpcName.indexOf(":");

		const ns = columnPos > 0 ? rpcName.slice(0, columnPos) : undefined;
		const rpc = columnPos > 0 ? rpcName.slice(columnPos + 1) : rpcName;

		const nsDef = this.registry[`ns$${ns}`];
		if (nsDef != null) {
			return nsDef.handleRpc(rpc, jsonData, context);
		}

		const rpcDef = this.registry[`rpc$${rpc}`];
		if (rpcDef == null) {
			throw new NotFoundError(rpcName);
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
