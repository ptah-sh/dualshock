import { InternalError } from "./errors";

export class ContextHolder<Context> {
	private context: Map<keyof Context, Context[keyof Context]> = new Map();

	// TODO: allow to pass custom error message
	// TODO: allow to pass predefined error messages via constructor so that users should not
	//   type the same error message over and over again.
	//     ctx.require('userId', 'Unauthenticated, please log in first')
	//       vs
	//     ctx = createContext(z.object({}), { 'userId': 'Unauthenticated, please log in first' });
	//     ctx.require('userId')
	require(key: keyof Context): Context[keyof Context] {
		const value = this.context.get(key);
		if (value == null) {
			throw new InternalError(`Context key '${String(key)}' is required`);
		}

		return value;
	}

	has(key: keyof Context): boolean {
		return this.context.has(key);
	}

	get(key: keyof Context): Context[keyof Context] | undefined {
		return this.context.get(key);
	}

	set(key: keyof Context, value: Context[keyof Context]) {
		this.context.set(key, value);
	}
}
