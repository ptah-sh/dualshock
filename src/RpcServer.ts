import type { WebSocket, WebSocketServer } from "ws";
import { RpcRouter } from "./RpcRouter.js";
import type { Logger } from "pino";
import { RpcConnection } from "./RpcConnection.js";
import { WebSocketWs } from "./websocket/WebSocket.ws.js";
import { type TypeOf, type ZodTypeAny, z, type ZodType } from "zod";
import { BaseRpcClient } from "./BaseRpcClient.js";
import { rpc } from "./RpcDefinition.js";

interface RpcServerOptions<
	Invokables extends Record<
		string,
		{ args: TypeOf<ZodTypeAny>; returns: TypeOf<ZodTypeAny> }
	>,
	Events extends Record<string, { payload: TypeOf<ZodTypeAny> }>,
> {
	wss: WebSocketServer;
	logger: Logger;
	invokables: Invokables;
	events: Events;
}

export class RpcServer<
	Invokables extends Record<
		string,
		{ args: TypeOf<ZodTypeAny>; returns: TypeOf<ZodTypeAny> }
	>,
	Events extends Record<string, { payload: TypeOf<ZodTypeAny> }>,
> extends BaseRpcClient {
	protected wss: WebSocketServer;

	constructor(args: RpcServerOptions<Invokables, Events>) {
		super(args.logger, new RpcRouter(args.logger));

		this.wss = args.wss;

		this.wss.on("connection", this.handleConnection.bind(this));

		this.router.rpc(
			"ping",
			rpc()
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

		new RpcConnection<Invokables, Events>(
			new WebSocketWs(ws),
			this.log,
			this.router,
			{} as Invokables,
			{} as Events,
		);

		ws.on("error", this.handleError.bind(this));
		ws.on("close", this.handleClose.bind(this));
	}

	protected handleError(err: Error) {
		this.log.warn('RpcServer: "handleError"', err);
	}

	protected handleClose() {
		this.log.info("Connection closed");
	}
}
