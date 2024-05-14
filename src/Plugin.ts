import type { ZodTypeAny } from "zod";
import type { RpcServer } from "./RpcServer.js";

export abstract class Plugin<
	Invokables extends Record<string, { args: ZodTypeAny; returns: ZodTypeAny }>,
	Events extends Record<string, { payload: ZodTypeAny }>,
> {
	constructor(readonly name: string) {}

	abstract setup(server: RpcServer<Invokables, Events>): Promise<void>;
}
