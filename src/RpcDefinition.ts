import type {
	BRAND,
	TypeOf,
	ZodType,
	ZodTypeAny,
	ZodUndefined,
	ZodVoid,
	symbol,
} from "zod";
import { ZodObject, z } from "zod";
import { refine, type TRefine } from "./refine.js";
import type { TEvent } from "./events.js";

export type RpcBrand = BRAND<"rpc">;
export type OnBrand = BRAND<"on">;
export type EmitsBrand = BRAND<"emits">;

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
	Brand,
	TOmit extends keyof TRpc<A, R, C>,
> {
	constructor(private build: T) {}

	context<
		V extends ZodTypeAny,
		B extends RpcBuilder<A, R, V, TRpc<A, R, V>, Brand, TOmit | "context">,
	>(context: V): Omit<B, TOmit | "context"> & Brand {
		this.build.context = context as V;

		return this as unknown as B & Brand;
	}

	args<
		V extends ZodTypeAny,
		B extends RpcBuilder<V, R, C, TRpc<V, R, C>, Brand, TOmit | "args">,
	>(args: V): Omit<B, TOmit | "args"> & Brand {
		this.build.args = strictSchema(args);

		return this as unknown as B & Brand;
	}

	returns<
		V extends ZodTypeAny,
		B extends RpcBuilder<A, V, C, TRpc<A, V, C>, Brand, TOmit | "returns">,
	>(returns: V): Omit<B, TOmit | "returns"> & Brand {
		this.build.returns = stripSchema(returns) as V;

		return this as unknown as B & Brand;
	}

	refine<
		V extends {
			refineSchema: TRefine<TypeOf<A>, TypeOf<R>, TypeOf<C>>;
		},
		B extends RpcBuilder<A, R, C, TRpc<A, R, C>, Brand, TOmit | "refine">,
	>(refine: Array<V>): Omit<B, TOmit | "refine"> & Brand {
		this.build.refine = refine.map((r) => r.refineSchema);

		return this as unknown as B & Brand;
	}

	fn<
		V extends (args: TypeOf<A>, context: TypeOf<C>) => Promise<TypeOf<R>>,
		B extends RpcBuilder<A, R, C, TRpc<A, R, C>, Brand, TOmit | "fn"> & Brand,
	>(fn: V): Omit<B, TOmit | "fn"> {
		this.build.fn = fn;

		return this as unknown as B;
	}

	get schema(): TRpc<A, R, C> & Brand {
		return this.build as unknown as TRpc<A, R, C> & Brand;
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
	R extends ZodTypeAny = ZodVoid,
	C extends ZodTypeAny = ZodUndefined,
	T extends TRpc<A, R, C> = TRpc<A, R, C>,
	TOmit extends keyof TRpc<A, R, C> = never,
>(): RpcBuilder<A, R, C, T, RpcBrand, TOmit> & RpcBrand => {
	return new RpcBuilder({
		fn: async () => Promise.reject(new Error("Not implemented")),
	} as TRpc<A, R, C>) as RpcBuilder<A, R, C, T, RpcBrand, TOmit> & RpcBrand;
};

export const on = <
	A extends ZodTypeAny = ZodUndefined,
	R extends ZodVoid = ZodVoid,
	C extends ZodTypeAny = ZodUndefined,
	T extends TRpc<A, R, C> = TRpc<A, R, C>,
	TOmit extends keyof TRpc<A, R, C> = never,
>(): Omit<RpcBuilder<A, R, C, T, OnBrand, TOmit | "returns">, "returns"> => {
	return new RpcBuilder({
		fn: async () => Promise.reject(new Error("Not implemented")),
	} as TRpc<A, R, C>) as RpcBuilder<A, R, C, T, OnBrand, TOmit | "returns">;
};

class EmitsBuilder<A extends ZodTypeAny, T extends TEvent<A>> {
	constructor(private build: T) {}

	payload<
		V extends ZodTypeAny,
		B = Omit<EmitsBuilder<V, TEvent<V>>, "payload"> & EmitsBrand,
	>(payload: V): B {
		this.build.payload = strictSchema(payload) as A;

		return this as unknown as B;
	}

	get schema(): TEvent<A> & EmitsBrand {
		return this.build as unknown as TEvent<A> & EmitsBrand;
	}
}

export const emits = <
	A extends ZodTypeAny,
	T extends TEvent<A>,
>(): EmitsBuilder<A, T> => {
	return new EmitsBuilder({
		payload: z.never(),
	} as unknown as T) as EmitsBuilder<A, T>;
};
