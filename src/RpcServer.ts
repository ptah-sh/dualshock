import type { WebSocket, WebSocketServer } from "ws";
import { RpcRouter } from "./RpcRouter.js";
import type { Logger } from "pino";
import { RpcConnection } from "./RpcConnection.js";
import { WebSocketWs } from "./websocket/WebSocket.ws.js";
import { type TypeOf, type ZodTypeAny, z, type ZodType } from "zod";
import { BaseRpcClient } from "./BaseRpcClient.js";
import { rpc } from "./RpcDefinition.js";
import type { Plugin } from "./Plugin.js";
import { ulid } from "ulidx";

interface RpcServerOptions<
	Invokables extends Record<
		string,
		{ args: TypeOf<ZodTypeAny>; returns: TypeOf<ZodTypeAny> }
	>,
	Events extends Record<string, { payload: TypeOf<ZodTypeAny> }>,
> {
	logger: Logger;
	clients: {
		invokables: Invokables;
		events: Events;
	};
}

export class RpcServer<
	Invokables extends Record<string, { args: ZodTypeAny; returns: ZodTypeAny }>,
	Events extends Record<string, { payload: ZodTypeAny }>,
> extends BaseRpcClient {
	public readonly connections: Record<
		string,
		RpcConnection<Invokables, Events>
	> = {};

	protected clients: {
		invokables: Invokables;
		events: Events;
	};

	constructor(args: RpcServerOptions<Invokables, Events>) {
		// TODO: move router instantiation into super class?
		super(args.logger, new RpcRouter(args.logger));

		this.clients = args.clients;

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
		const traceId = ulid();

		const log = this.log.child({ trace: traceId });

		log.info("Incoming connection");

		const wsAdapter = new WebSocketWs(ws);

		// TODO: call plugin lifecycle hooks
		// wsAdapter.onOpen(() => {
		// We need to check if the connection is still open here (readyState === open), for each plugin
		// Probably, need to await until all plugins are done and then register the connection
		// });

		// TODO: it seems that these invokables and events should be the client's invokables and events
		this.connections[traceId] = new RpcConnection<Invokables, Events>(
			wsAdapter,
			log,
			this.router,
			this.clients.invokables,
			this.clients.events,
		);
	}

	async listen(wss: WebSocketServer): Promise<void> {
		wss.on("connection", this.handleConnection.bind(this));
		wss.on("error", this.handleError.bind(this));
		wss.on("close", this.handleClose.bind(this));
	}

	// TODO: create a PluginShim so that plugins can't manupulate server instances directly.
	// TODO: allow to pass plugin options
	async use(plugin: new () => Plugin<Invokables, Events>): Promise<this> {
		const p = new plugin();

		await p.setup(this);

		return this;
	}

	protected handleError(err: Error) {
		this.log.warn('RpcServer: "handleError"', err);
	}

	protected handleClose() {
		this.log.info("WebSocketServer connection closed");
	}

	// TODO: hook this into the real code - wsAdapter.onerror/close/etc./
	// Mb something similar to "wsAdapter.cleanup(this.cleanupConnection.bind(this, traceId))"
	// BTW, it is not being called yet. :)
	protected cleanupConnection(traceId: string) {
		delete this.connections[traceId];
	}
}
