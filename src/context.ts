import { ContextHolder } from "./ContextHolder";

export type ContextInstance<Context> = ContextHolder<Context> &
	Record<keyof Context, Context[keyof Context] | undefined>;

export function createContext<
	Context extends object,
>(): ContextInstance<Context> {
	// return new ContextHolder() as ContextHolder<C> & Record<keyof C, C[keyof C]>;
	const holder = new ContextHolder<Context>();

	return new Proxy(holder, {
		get: (target, key) => {
			return target.get(key as keyof Context);
		},

		// TODO: should createContext accept context definition as Zod type for validation purposes?
		set: (target, key, value) => {
			target.set(key as keyof Context, value);

			return true;
		},
	}) as ContextHolder<Context> & Record<keyof Context, Context[keyof Context]>;
}
