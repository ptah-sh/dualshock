import type { ContextInstance } from "./context";

export type Refine<Args, Context extends object> = {
	fn: (args: Args, context: ContextInstance<Context>) => Promise<boolean>;
	path: (string | number)[];
	message: string;
	code?: string;
};

export function refine<Args, Context extends object>(
	fn: (args: Args, context: ContextInstance<Context>) => Promise<boolean>,
	opts: Omit<Refine<Args, Context>, "fn">,
): Refine<Args, Context> {
	return {
		fn,
		...opts,
	};
}
