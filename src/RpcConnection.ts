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
	type ZodType,
} from "zod";
import type { WebSocket } from "./websocket/WebSocket.js";
import { isZodError } from "./zod.js";
import { Packet } from "./Packet.js";

class SerialSource {
	private serial = 0;

	get nextSerial(): number {
		this.serial += 1;

		return this.serial;
	}
}

export class RpcConnection<
	A extends ZodTypeAny,
	R extends ZodTypeAny,
	E extends ZodTypeAny,
	Invokables extends Record<string, { args: A; returns: R }>,
	Events extends Record<string, { payload: E }>,
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
		ws.onError(this.handleError.bind(this));
		ws.onClose(this.handleClose.bind(this));
	}

	protected async handleMessage(rawData: ArrayBuffer) {
		// this.log.info({
		//   // msg: "Got message",
		//   data: JSON.parse(this.textDecoder.decode(rawData)),
		// });

		// TODO: handle validation errors
		const parsedPacket = Packet.parse(
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
	async emit<
		T extends keyof Events,
		Payload extends TypeOf<Events[T]["payload"]>,
	>(event: T, payload: Payload): Promise<void> {
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

	async invoke<
		T extends keyof Invokables,
		Args extends TypeOf<Invokables[T]["args"]>,
		Returns extends TypeOf<Invokables[T]["returns"]>,
	>(rpcName: T, args: Args): Promise<Returns> {
		const schema = this.invokables[rpcName];
		if (schema == null) {
			throw new Error(`RPC '${String(rpcName)}' not found`);
		}

		const serial = this.serialSource.nextSerial;

		await this.send({
			serial: serial,
			type: "invoke",
			name: rpcName as string,
			args: await schema.args.parseAsync(args),
		});

		const result = await this.createReceiver(serial);

		return schema.returns.parseAsync(result);
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

	protected handleError(err: Error) {
		this.log.warn('RpcConnection: "handleError"', err);
	}

	protected handleClose() {
		this.log.info("RpcConnection: connection closed");
	}
}
