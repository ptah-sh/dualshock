import type { WebSocket, WebSocketServer } from "ws";
import { RpcRouter } from "./RpcRouter.js";
import type { Logger } from "pino";
import { RpcConnection } from "./RpcConnection.js";
import { WebSocketWs } from "./websocket/WebSocket.ws.js";
import type { ZodTypeAny } from "zod";
import { BaseRpcClient } from "./BaseRpcClient.js";
import type { Plugin } from "./Plugin.js";
import { ulid } from "ulidx";

interface RpcServerOptions {
	logger: Logger;
}

export type OnConnectionCallback = (
	connectionId: string,
	connection: RpcConnection<any, any>,
) => void | Promise<void>;

export class RpcServer extends BaseRpcClient {
	public readonly connections: Record<string, RpcConnection<any, any>> = {};

	protected listeners: Record<"onConnection", Array<OnConnectionCallback>> = {
		onConnection: [],
	};

	constructor(args: RpcServerOptions) {
		// TODO: move router instantiation into super class?
		super(args.logger, new RpcRouter(args.logger));
		// TODO: extract the ping logic into a plugin, so that it doesn't leak everywhere.
		// this.router.rpc(
		// 	"ping",
		// 	rpc()
		// 		.args(z.date())
		// 		.returns(z.date())
		// 		.fn(async () => {
		// 			return new Date();
		// 		}),
		// );
	}

	// TODO: add timeout for receiving the first message (handshake).
	// TODO: handlers should accept the WS connection / or it should be abstracted ???
	// TODO: add onConnection(RpcConnection) callback
	protected handleConnection<
		Invokables extends Record<
			string,
			{ args: ZodTypeAny; returns: ZodTypeAny }
		>,
		Events extends Record<string, { payload: ZodTypeAny }>,
	>(invokables: Invokables, events: Events, ws: WebSocket) {
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
			invokables,
			events,
		);

		for (const fn of this.listeners.onConnection) {
			// TODO: catch errors (both sync/async) and log them.
			//   Do NOT await for callback completion, let them run async
			fn(traceId, this.connections[traceId]);
		}
	}

	async listen<
		Invokables extends Record<
			string,
			{ args: ZodTypeAny; returns: ZodTypeAny }
		>,
		Events extends Record<string, { payload: ZodTypeAny }>,
	>(
		wss: WebSocketServer,
		invokables: Invokables,
		events: Events,
	): Promise<void> {
		wss.on("connection", this.handleConnection.bind(this, invokables, events));
		wss.on("error", this.handleError.bind(this));
		wss.on("close", this.handleClose.bind(this));
	}

	// TODO: create a PluginShim so that plugins can't manupulate server instances directly.
	// TODO: allow to pass plugin options
	// TODO: allow to set up the base namespace for the plugin - mb define `use` on a router instead.
	async use(plugin: new () => Plugin<RpcServer>): Promise<this> {
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

	// Ooops, we've lost typing here.
	broadcast(event: string, payload: unknown) {
		for (const connection of Object.values(this.connections)) {
			connection.emit(event, payload);
		}
	}

	onConnection(callback: OnConnectionCallback) {
		this.listeners.onConnection.push(callback);
	}
}
