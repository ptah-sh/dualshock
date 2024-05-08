import { RpcConnection } from "./RpcConnection.js";
import type { Logger } from "pino";
import { RpcRouter } from "./RpcRouter.js";
import type { WebSocket } from "./websocket/WebSocket.js";
import { BaseRpcClient } from "./BaseRpcClient.js";

export class RpcClient<
	Invokables extends { [key: string]: { args: any; returns: any } } = any,
	Events extends { [key: string]: { payload: any } } = any,
> extends BaseRpcClient {
	protected ping: NodeJS.Timeout | null = null;
	protected rpcConnection: RpcConnection;
	protected signalReady: (() => void) | null = null;

	public readonly ready: Promise<void>;

	constructor(
		protected ws: WebSocket,
		protected log: Logger,
	) {
		super(log, new RpcRouter(log));

		this.ready = new Promise((resolve) => {
			this.signalReady = resolve;
		});

		this.rpcConnection = new RpcConnection<Invokables>(
			ws,
			this.log,
			this.router,
		);

		ws.onOpen(this.handleOpen.bind(this));
		ws.onError(this.handleError.bind(this));
		ws.onClose(this.handleDisconnect.bind(this));
	}

	async emit<T extends keyof Events>(event: T, payload?: Events[T]["payload"]) {
		return this.rpcConnection.emit(event, payload);
	}

	async invoke<T extends keyof Invokables>(
		rpc: T,
		args?: Invokables[T]["args"],
	): Promise<Invokables[T]["returns"]> {
		return this.rpcConnection.invoke(rpc, args);
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
