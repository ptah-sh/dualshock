import { RpcConnection } from "./RpcConnection";
import type { Logger } from "pino";
import { RpcRouter } from "./RpcRouter";
import type { WebSocket } from "./websocket/WebSocket";
import { BaseRpcClient } from "./BaseRpcClient";

export class RpcClient<
	Invokables extends { [key: string]: { args: any; returns: any } } = any,
	Context extends object = object,
> extends BaseRpcClient<Context> {
	protected ping: NodeJS.Timeout | null = null;
	protected rpcConnection: RpcConnection<Context>;

	constructor(
		protected ws: WebSocket,
		protected log: Logger,
	) {
		super(log, new RpcRouter<Context>(log));

		this.rpcConnection = new RpcConnection<Context, Invokables>(
			ws,
			this.log,
			this.router,
		);

		ws.onOpen(this.handleOpen.bind(this));
		ws.onError(this.handleDisconnect.bind(this));
		ws.onClose(this.handleDisconnect.bind(this));
	}

	async invoke<T extends keyof Invokables>(
		rpc: T,
		args?: Invokables[T]["args"],
	): Promise<Invokables[T]["returns"]> {
		return this.rpcConnection.invoke(rpc, args);
	}

	protected handleDisconnect() {
		this.log.debug("RpcClient: handleDisconnect");

		if (this.ping != null) {
			clearInterval(this.ping);
		}
	}

	protected handleOpen() {
		this.ping = setInterval(async () => {
			// TODO: enable ping
			// const result = await this.rpc.invoke("ping");
		}, 1000);
	}

	close() {
		this.ws.close();
	}
}
