import { type ZodAny, z, type TypeOf, type ZodTypeAny } from "zod";

export type TRefine<
	A extends ZodTypeAny,
	R extends ZodTypeAny,
	C extends ZodTypeAny,
> = {
	path: (string | number)[];
	message: string;
	code?: string;
	context: C;
	args: A;
	pre?: (args: A, context: C) => Promise<boolean>;
	returns: R;
	post?: (args: A, returns: R, context: C) => Promise<boolean>;
};

export class RefineBuilder<
	A extends ZodTypeAny,
	R extends ZodTypeAny,
	C extends ZodTypeAny,
	TOmit extends keyof TRefine<A, R, C> | "schema" = "schema",
> {
	constructor(private build: TRefine<A, R, C>) {}

	path<B extends Omit<RefineBuilder<A, R, C, TOmit | "path">, TOmit | "path">>(
		path: (string | number)[],
	): B {
		this.build.path = path;

		return this as unknown as B;
	}

	message<
		B extends Omit<
			RefineBuilder<A, R, C, TOmit | "message">,
			TOmit | "message"
		>,
	>(message: string): B {
		this.build.message = message;

		return this as unknown as B;
	}

	code<B extends Omit<RefineBuilder<A, R, C, TOmit | "code">, TOmit | "code">>(
		code: string,
	): B {
		this.build.code = code;

		return this as unknown as B;
	}

	context<
		V extends C,
		B extends Omit<
			RefineBuilder<A, R, V, TOmit | "context">,
			TOmit | "context"
		>,
	>(context: V): B {
		this.build.context = context;

		return this as unknown as B;
	}

	args<
		V extends A,
		B extends Omit<RefineBuilder<V, R, C, TOmit | "args">, TOmit | "args">,
	>(args: V): B {
		this.build.args = args;

		return this as unknown as B;
	}

	returns<
		V extends R,
		B extends Omit<
			RefineBuilder<A, V, C, TOmit | "returns">,
			TOmit | "returns"
		>,
	>(returns: V): B {
		this.build.returns = returns;

		return this as unknown as B;
	}

	pre<
		B extends Omit<
			RefineBuilder<A, R, C, Exclude<TOmit, "refineSchema"> | "pre">,
			Exclude<TOmit, "refineSchema"> | "pre"
		>,
	>(pre: (args: TypeOf<A>, context: TypeOf<C>) => Promise<boolean>): B {
		this.build.pre = pre;

		return this as unknown as B;
	}

	post<
		B extends Omit<
			RefineBuilder<A, R, C, Exclude<TOmit, "refineSchema"> | "post">,
			Exclude<TOmit, "refineSchema"> | "post"
		>,
	>(
		post: (
			args: TypeOf<A>,
			returns: TypeOf<R>,
			context: TypeOf<C>,
		) => Promise<boolean>,
	): B {
		this.build.post = post;

		return this as unknown as B;
	}

	get refineSchema(): TRefine<any, any, any> {
		return this.build;
	}
}

export const refine = <
	A extends ZodTypeAny,
	R extends ZodTypeAny,
	C extends ZodTypeAny,
>(): RefineBuilder<A, R, C> => {
	return new RefineBuilder<A, R, C>({
		message: "Not Implemented",
		path: [],
		args: z.any() as unknown as A,
		returns: z.any() as unknown as R,
		context: z.any() as unknown as C,
	});
};
