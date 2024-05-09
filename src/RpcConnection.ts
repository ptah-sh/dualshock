import type { Logger } from "pino";
import {
	BaseRpcError,
	ValidationError,
	type ValidationErrorItem,
} from "./errors.js";
import type { RpcRouter } from "./RpcRouter.js";
import {
	type ZodError,
	z,
	type ZodIssue,
	type ZodTypeAny,
	type TypeOf,
} from "zod";
import type { WebSocket } from "./websocket/WebSocket.js";
import { isZodError } from "./zod.js";

const packet = z.union([
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

type Packet = z.infer<typeof packet>;

class SerialSource {
	private serial = 0;

	get nextSerial(): number {
		this.serial += 1;

		return this.serial;
	}
}

export class RpcConnection<
	Invokables extends Record<
		string,
		{ args: TypeOf<ZodTypeAny>; returns: TypeOf<ZodTypeAny> }
	>,
	Events extends Record<string, { payload: TypeOf<ZodTypeAny> }>,
> {
	protected readonly serialSource: SerialSource = new SerialSource();

	// TODO: cleanup receivers (reject all pending) on disconnect.
	protected receivers: Map<number, Function> = new Map();
	protected listeners: Map<keyof Events, Function> = new Map();
	protected textDecoder: TextDecoder = new TextDecoder("utf-8");
	protected textEncoder: TextEncoder = new TextEncoder();
	protected context: unknown = {};

	constructor(
		protected ws: WebSocket,
		protected log: Logger,
		protected router: RpcRouter,
		protected invokables: Invokables,
		protected events: Events,
	) {
		ws.onMessage(this.handleMessage.bind(this));
	}

	protected async handleMessage(rawData: ArrayBuffer) {
		// this.log.info({
		//   // msg: "Got message",
		//   data: JSON.parse(this.textDecoder.decode(rawData)),
		// });

		// TODO: handle validation errors
		const parsedPacket = packet.parse(
			JSON.parse(this.textDecoder.decode(rawData)),
		);

		const { serial, type } = parsedPacket;
		if (type === "event") {
			const { name, payload } = parsedPacket;

			await this.router.handleEvent(name, payload, this.context);

			await this.reply(serial, null);
		} else if (type === "invoke") {
			const { name, args } = parsedPacket;

			try {
				const result = await this.router.handleRpc(name, args, this.context);

				await this.reply(serial, result);
			} catch (err: unknown) {
				if (isZodError(err) || err instanceof ValidationError) {
					await this.invalid(serial, err.errors);

					return;
				}

				await this.error(serial, err);
			}
		} else if (type === "result") {
			const receiver = this.receivers.get(serial);
			if (receiver == null) {
				this.log.error(`No such receiver: serial '${serial}'`);

				return;
			}

			receiver(parsedPacket);
		} else if (type === "error" || type === "invalid") {
			const receiver = this.receivers.get(serial);
			if (receiver != null) {
				receiver(parsedPacket);

				return;
			}

			// TODO: protocol error and disconnect?
			this.log.error(`Error received without receiver: serial '${serial}'`);
		} else {
			throw new Error(`Unhandled message type: '${type}'`);
		}
	}

	protected async reply(serial: number, data: unknown) {
		await this.send({
			serial: serial,
			type: "result",
			data: data,
		});
	}

	protected async invalid(
		serial: number,
		errors: ZodIssue[] | ValidationErrorItem[],
	) {
		await this.send({
			serial: serial,
			type: "invalid",
			errors: errors,
		});
	}

	// TODO: allow to pass custom error message
	// TODO: return stacktrace in dev mode, hide stacktrace on prod
	protected async error(serial: number, err: unknown) {
		await this.send({
			serial: serial,
			type: "error",
			error: this.formatError(err),
		});
	}

	protected formatError(err: unknown) {
		if (err instanceof BaseRpcError) {
			return {
				code: err.code,
				message: err.message,
				stack: err.stack,
			};
		}

		if (err instanceof Error) {
			return {
				code: null,
				message: err.message,
				stack: err.stack,
			};
		}

		return {
			code: null,
			message: "Unknown error",
			stack: null,
		};
	}

	protected async send(packet: Packet): Promise<void> {
		this.ws.send(this.textEncoder.encode(JSON.stringify(packet)).buffer);
	}

	// TODO: track subscriptions to reduce traffic usage when events are not awaited.
	async emit<T extends keyof Events>(
		event: T,
		payload: Events[T]["payload"],
	): Promise<void> {
		const schema = this.events[event];
		if (schema == null) {
			throw new Error(`Event '${String(event)}' not found`);
		}

		const serial = this.serialSource.nextSerial;

		await this.send({
			serial: serial,
			type: "event",
			name: event as string,
			payload: await schema.payload.parseAsync(payload),
		});

		return this.createReceiver(serial) as Promise<void>;
	}

	async invoke<T extends keyof Invokables>(
		rpc: T,
		args: Invokables[T]["args"],
	): Promise<Invokables[T]["returns"]> {
		const schema = this.invokables[rpc];
		if (schema == null) {
			throw new Error(`RPC '${String(rpc)}' not found`);
		}

		const serial = this.serialSource.nextSerial;

		await this.send({
			serial: serial,
			type: "invoke",
			name: rpc as string,
			args: await schema.args.parseAsync(args),
		});

		return this.createReceiver(serial);
	}

	disconnect() {
		this.ws.close();
		// this.ws.removeAllListeners();
	}

	private createReceiver(serial: number) {
		return new Promise((resolve, reject) => {
			this.receivers.set(serial, (result: Packet) => {
				this.receivers.delete(serial);

				switch (result.type) {
					case "result":
						resolve(result.data);
						return;
					case "error":
						reject(result.error);
						return;
					case "invalid":
						reject(new ValidationError(result.errors));
						return;
					default:
						throw new Error(`Unhandled packet type: '${result.type}'`);
				}
			});
		});
	}
}
