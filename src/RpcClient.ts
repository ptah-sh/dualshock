import { RpcConnection } from "./RpcConnection.js";
import type { Logger } from "pino";
import { RpcRouter } from "./RpcRouter.js";
import type { WebSocket } from "./websocket/WebSocket.js";
import { BaseRpcClient } from "./BaseRpcClient.js";
import type { TypeOf, ZodTypeAny } from "zod";

export class RpcClient<
	A extends ZodTypeAny,
	R extends ZodTypeAny,
	E extends ZodTypeAny,
	Invokables extends Record<string, { args: A; returns: R }>,
	Events extends Record<string, { payload: E }>,
> extends BaseRpcClient {
	protected ping: NodeJS.Timeout | null = null;
	protected rpcConnection: RpcConnection<A, R, E, Invokables, Events>;
	protected signalReady: (() => void) | null = null;

	public readonly ready: Promise<void>;

	constructor(
		protected ws: WebSocket,
		protected log: Logger,
		invokables: Invokables,
		events: Events,
	) {
		super(log, new RpcRouter(log));

		this.ready = new Promise((resolve) => {
			this.signalReady = resolve;
		});

		this.rpcConnection = new RpcConnection(
			ws,
			this.log,
			this.router,
			invokables,
			events,
		);

		ws.onOpen(this.handleOpen.bind(this));
		ws.onError(this.handleError.bind(this));
		ws.onClose(this.handleDisconnect.bind(this));
	}

	emit(
		...args: Parameters<RpcConnection<A, R, E, Invokables, Events>["emit"]>
	) {
		return this.rpcConnection.emit(...args);
	}

	async invoke<
		T extends keyof Invokables,
		Args extends TypeOf<Invokables[T]["args"]>,
		Returns extends TypeOf<Invokables[T]["returns"]>,
	>(rpcName: T, args: Args): Promise<Returns> {
		return this.rpcConnection.invoke(rpcName, args);
	}

	protected handleError(err: Error) {
		this.log.error(err);
	}

	protected handleDisconnect() {
		this.log.debug("RpcClient: handleDisconnect");

		if (this.ping != null) {
			clearInterval(this.ping);
		}
	}

	protected handleOpen() {
		this.signalReady?.();
		this.signalReady = null;

		this.ping = setInterval(async () => {
			// TODO: enable ping
			// const result = await this.rpc.invoke("ping");
		}, 1000);
	}

	close() {
		this.ws.close();
	}
}
