import type { WebSocket, WebSocketServer } from "ws";
import { RpcRouter } from "./RpcRouter.js";
import type { Logger } from "pino";
import { RpcConnection } from "./RpcConnection.js";
import { WebSocketWs } from "./websocket/WebSocket.ws.js";
import { type TypeOf, type ZodTypeAny, z, type ZodType } from "zod";
import { BaseRpcClient } from "./BaseRpcClient.js";
import { rpc } from "./RpcDefinition.js";
import type { Plugin } from "./Plugin.js";

interface RpcServerOptions<
	Invokables extends Record<
		string,
		{ args: TypeOf<ZodTypeAny>; returns: TypeOf<ZodTypeAny> }
	>,
	Events extends Record<string, { payload: TypeOf<ZodTypeAny> }>,
> {
	logger: Logger;
	// TODO: move invokables and events under a single key - "clients"
	invokables: Invokables;
	events: Events;
}

export class RpcServer<
	Invokables extends Record<string, { args: ZodTypeAny; returns: ZodTypeAny }>,
	Events extends Record<string, { payload: ZodTypeAny }>,
> extends BaseRpcClient {
	constructor(args: RpcServerOptions<Invokables, Events>) {
		super(args.logger, new RpcRouter(args.logger));

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
	// TODO: add onConnection(RpcConnection) callback
	protected handleConnection(ws: WebSocket) {
		this.log.info("Incoming Connection");

		new RpcConnection<Invokables, Events>(
			new WebSocketWs(ws),
			this.log,
			this.router,
			{} as Invokables,
			{} as Events,
		);
	}

	async listen(wss: WebSocketServer): Promise<void> {
		wss.on("connection", this.handleConnection.bind(this));
		wss.on("error", this.handleError.bind(this));
		wss.on("close", this.handleClose.bind(this));
	}

	// TODO: create a PluginShim so that plugins can't manupulate server instances directly.
	// TODO: allow to pass plugin options
	use(plugin: Plugin<Invokables, Events>) {
		plugin.setup(this);
	}

	protected handleError(err: Error) {
		this.log.warn('RpcServer: "handleError"', err);
	}

	protected handleClose() {
		this.log.info("WebSocketServer connection closed");
	}
}
