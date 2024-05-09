import { z } from "zod";

export const Packet = z.union([
	z.object({
		serial: z.number(),
		type: z.literal("event"),
		name: z.string(),
		payload: z.unknown().optional(),
	}),
	z.object({
		serial: z.number(),
		type: z.literal("invoke"),
		name: z.string(),
		args: z.unknown().optional(),
	}),
	z.object({
		serial: z.number(),
		type: z.literal("result"),
		data: z.unknown(),
	}),
	z.object({
		serial: z.number(),
		type: z.literal("invalid"),
		errors: z.array(
			z.object({
				code: z.string(),
				path: z.union([z.string(), z.number()]).array(),
				message: z.string(),
			}),
		),
	}),
	z.object({
		serial: z.number(),
		type: z.literal("error"),
		// TODO: define better error type - require, at least, message
		error: z.unknown(),
	}),
]);

export type Packet = z.infer<typeof Packet>;
