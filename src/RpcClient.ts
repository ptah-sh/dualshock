import { RpcConnection } from "./RpcConnection";
import type { Logger } from "pino";
import { RpcRouter } from "./RpcRouter";
import type { WebSocket } from "./websocket/WebSocket";

export class RpcClient {
	protected ping: NodeJS.Timeout | null = null;
	protected rpc: RpcConnection;

	constructor(
		protected ws: WebSocket,
		protected log: Logger,
	) {
		this.rpc = new RpcConnection(ws, log, new RpcRouter(log));

		ws.onOpen(this.handleOpen.bind(this));
		ws.onError(this.handleDisconnect.bind(this));
		ws.onClose(this.handleDisconnect.bind(this));
	}

	async invoke(rpc: string, args?: unknown) {
		return this.rpc.invoke(rpc, args);
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
}
