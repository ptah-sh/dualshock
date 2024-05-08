import type { TypeOf, ZodType, ZodTypeAny, ZodUndefined } from "zod";
import { ZodObject, z } from "zod";
import { refine, type TRefine } from "./refine.js";

const strictSchema = <T extends ZodTypeAny>(schema: T) => {
	if (schema instanceof ZodObject) {
		return schema.strict() as ZodTypeAny;
	}

	return schema;
};

const stripSchema = <T extends ZodTypeAny>(schema: T) => {
	if (schema instanceof ZodObject) {
		return schema.strip() as ZodTypeAny;
	}

	return schema;
};

export type TRpc<
	A extends ZodTypeAny,
	R extends ZodTypeAny,
	C extends ZodTypeAny,
> = {
	context?: C;
	args?: A;
	returns?: R;
	refine?: Array<TRefine<any, any, any>>;
	fn: (args: TypeOf<A>, context: TypeOf<C>) => Promise<TypeOf<R>>;
};
export class RpcBuilder<
	A extends ZodTypeAny,
	R extends ZodTypeAny,
	C extends ZodTypeAny,
	T extends TRpc<any, any, any>,
	TOmit extends keyof TRpc<A, R, C> = never,
> {
	constructor(private build: T) {}

	context<
		V extends ZodTypeAny,
		B extends RpcBuilder<A, R, V, TRpc<A, R, V>, TOmit | "context">,
	>(context: V): B {
		this.build.context = context as V;

		return this as unknown as B;
	}

	args<
		V extends ZodTypeAny,
		B extends RpcBuilder<V, R, C, TRpc<V, R, C>, TOmit | "args">,
	>(args: V): Omit<B, TOmit | "args"> {
		this.build.args = strictSchema(args);

		return this as unknown as B;
	}

	returns<
		V extends ZodTypeAny,
		B extends RpcBuilder<A, V, C, TRpc<A, V, C>, TOmit | "returns">,
	>(returns: V): Omit<B, TOmit | "returns"> {
		this.build.returns = stripSchema(returns) as V;

		return this as unknown as B;
	}

	refine<
		V extends {
			refineSchema: TRefine<TypeOf<A>, TypeOf<R>, TypeOf<C>>;
		},
		B extends RpcBuilder<A, R, C, TRpc<A, R, C>, TOmit | "refine">,
	>(refine: Array<V>): B {
		this.build.refine = refine.map((r) => r.refineSchema);

		return this as unknown as B;
	}

	fn<
		V extends (args: TypeOf<A>, context: TypeOf<C>) => Promise<TypeOf<R>>,
		B extends RpcBuilder<A, R, C, TRpc<A, R, C>, TOmit | "fn">,
	>(fn: V): Pick<B, "schema"> {
		this.build.fn = fn;

		return this as unknown as B;
	}

	get schema(): TRpc<A, R, C> {
		return this.build;
	}
}

/**
 * Simplifies the creation of a standalone RPC definition.
 *
 * Without this function you'd have to repeat the types for every RPC to get the
 * in-place type checking, and not in the server.rpc(myRpc) callsite.
 *
 * Usage:
 * ```ts
 * // myRpc.ts
 * export const myRpc = rpc().fn(async () => console.log('hello!'))
 *
 * // rpcServer.ts
 * import { myRpc } from "./myRpc"
 * server.rpc("myrpc", myRpc)
 * ```
 *
 * @returns The RPC definition with the provided options
 */
export const rpc = <
	A extends ZodTypeAny = ZodUndefined,
	R extends ZodTypeAny = ZodUndefined,
	C extends ZodTypeAny = ZodUndefined,
	T extends TRpc<A, R, C> = TRpc<A, R, C>,
	TOmit extends keyof TRpc<A, R, C> = never,
>(): RpcBuilder<A, R, C, T, TOmit> => {
	return new RpcBuilder({
		fn: async () => Promise.reject(new Error("Not implemented")),
	} as TRpc<A, R, C>) as RpcBuilder<A, R, C, T, TOmit>;
};
