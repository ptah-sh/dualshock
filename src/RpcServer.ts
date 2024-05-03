import type { WebSocket, WebSocketServer } from "ws";
import { RpcRouter } from "./RpcRouter";
import type { Logger } from "pino";
import { RpcConnection } from "./RpcConnection";
import { WebSocketWs } from "./websocket/WebSocket.ws";
import { z, type ZodType } from "zod";
import { BaseRpcClient } from "./BaseRpcClient";

interface RpcServerOptions {
	wss: WebSocketServer;
	logger: Logger;
}

export class RpcServer<Context extends object> extends BaseRpcClient<Context> {
	protected wss: WebSocketServer;

	constructor(args: RpcServerOptions) {
		super(args.logger, new RpcRouter(args.logger));

		this.wss = args.wss;

		this.wss.on("connection", this.handleConnection.bind(this));

		this.router.rpc({
			name: "ping",
			args: z.date(),
			returns: z.date(),
			fn: async () => new Date(),
		});
	}

	// TODO: add timeout for receiving the first message (handshake).
	// TODO: handlers should accept the WS connection / or it should be abstracted ???
	protected handleConnection(ws: WebSocket) {
		this.log.info("Incoming Connection");

		new RpcConnection(new WebSocketWs(ws), this.log, this.router);

		ws.on("error", this.handleError.bind(this));
		ws.on("close", this.handleClose.bind(this));
	}

	protected handleError(err: Error) {}

	protected handleClose() {}
}
