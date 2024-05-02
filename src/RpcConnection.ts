import type { Logger } from "pino";
import { BaseRpcError, ValidationError } from "./errors";
import type { RpcRouter } from "./RpcRouter";
import { type ZodError, z, type ZodIssue } from "zod";
import type { WebSocket } from "./websocket/WebSocket";
import { isZodError } from "./zod";
import { type ContextInstance, createContext } from "./context";

const packet = z.union([
	z.object({
		serial: z.number(),
		type: z.literal("invoke"),
		name: z.string(),
		args: z.unknown().optional(),
	}),
	z.object({
		ok: z.literal(true),
		serial: z.number(),
		type: z.literal("result"),
		data: z.unknown(),
	}),
	z.object({
		ok: z.literal(false),
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
		ok: z.literal(false),
		serial: z.number(),
		type: z.literal("error"),
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

export class RpcConnection<Context extends object> {
	protected readonly serialSource: SerialSource = new SerialSource();

	// TODO: cleanup receivers (reject all pending) on disconnect.
	protected receivers: Map<number, Function> = new Map();
	protected textDecoder: TextDecoder = new TextDecoder("utf-8");
	protected textEncoder: TextEncoder = new TextEncoder();
	protected context: ContextInstance<Context> = createContext();

	constructor(
		protected ws: WebSocket,
		protected log: Logger,
		protected router: RpcRouter<Context>,
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

		if (type === "invoke") {
			const { name, args } = parsedPacket;

			try {
				const result = await this.router.handle(name, args, this.context);

				await this.reply(serial, result);
			} catch (err: unknown) {
				if (isZodError(err)) {
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
			ok: true,
			serial: serial,
			type: "result",
			data: data,
		});
	}

	protected async invalid(serial: number, errors: ZodIssue[]) {
		await this.send({
			ok: false,
			serial: serial,
			type: "invalid",
			errors: errors,
		});
	}

	// TODO: allow to pass custom error message
	// TODO: return stacktrace in dev mode, hide stacktrace on prod
	protected async error(serial: number, err: unknown) {
		await this.send({
			ok: false,
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

	async invoke(rpc: string, args?: unknown): Promise<unknown> {
		const serial = this.serialSource.nextSerial;

		await this.send({
			serial: serial,
			type: "invoke",
			name: rpc,
			args: args,
		});

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

	disconnect() {
		this.ws.close();
		// this.ws.removeAllListeners();
	}
}
