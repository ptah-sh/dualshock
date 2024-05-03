import type { TypeOf, ZodType } from "zod";
import type { Refine } from "./refine";
import type { ContextInstance } from "./context";

export type RpcDefinition<
	A extends ZodType | undefined,
	R extends ZodType | undefined,
	Context extends object,
> = {
	name: string;
	args?: A;
    returns?: R;
	refine?: {
        args?: A extends ZodType ? Refine<TypeOf<A>, Context>[] : never;
        returns?: R extends ZodType ? Refine<TypeOf<R>, Context>[] : never;
    };
    fn: (args: A extends ZodType ? TypeOf<A> : undefined, context: ContextInstance<Context>) => Promise<R extends ZodType ? TypeOf<R> : void>;
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
 * export const myRpc = rpc({
 *    ...
 * })
 *
 * // rpcServer.ts
 * import { myRpc } from "./myRpc"
 * server.rpc(myRpc)
 * ```
 *
 * @param opts - The options for the RPC call
 * @returns The RPC definition with the provided options
 */
export const rpc = <A extends ZodType | undefined, R extends ZodType | undefined, Context extends object>(opts: RpcDefinition<A, R, Context>) => opts;
