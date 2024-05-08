import type { ZodTypeAny } from "zod";

export type TEvent<T extends ZodTypeAny> = {
	payload: T;
};
