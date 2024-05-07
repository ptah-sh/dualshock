import type { WebSocket, WebSocketServer } from "ws";
import { RpcRouter } from "./RpcRouter.js";
import type { Logger } from "pino";
import { RpcConnection } from "./RpcConnection.js";
import { WebSocketWs } from "./websocket/WebSocket.ws.js";
import { z, type ZodType } from "zod";
import { BaseRpcClient } from "./BaseRpcClient.js";
import { rpc as define } from "./RpcDefinition.js";

interface RpcServerOptions {
	wss: WebSocketServer;
	logger: Logger;
}

export class RpcServer extends BaseRpcClient {
	protected wss: WebSocketServer;

	constructor(args: RpcServerOptions) {
		super(args.logger, new RpcRouter(args.logger));

		this.wss = args.wss;

		this.wss.on("connection", this.handleConnection.bind(this));

		this.router.rpc(
			"ping",
			define()
				.args(z.date())
				.returns(z.date())
				.fn(async () => {
					return new Date();
				}),
		);
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
