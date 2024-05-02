import type { ZodError } from "zod";

export function isZodError(err: unknown): err is ZodError {
	return err instanceof Error && err.constructor.name === "ZodError";
}
