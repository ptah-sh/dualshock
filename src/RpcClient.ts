import { RpcConnection } from "./RpcConnection.js";
import type { Logger } from "pino";
import { RpcRouter } from "./RpcRouter.js";
import type { WebSocket as IWebSocket } from "./websocket/WebSocket.js";
import { BaseRpcClient } from "./BaseRpcClient.js";
import type { ZodTypeAny } from "zod";

type ServerOptions<Invokables, Events> = {
	invokables: Invokables;
	events: Events;
};

// This is rather "follower server" than "rpc client", as the true "rpc client" is the "RpcConnection" class.
export class RpcClient extends BaseRpcClient {
	protected ping: NodeJS.Timeout | null = null;

	// TODO: make the constructor accept object instead of arguments list
	constructor(protected log: Logger) {
		super(log, new RpcRouter(log));
	}

	// emit<T extends keyof Events, Payload extends TypeOf<Events[T]["payload"]>>(
	// 	event: T,
	// 	payload: Payload,
	// ): Promise<void> {
	// 	return this.rpcConnection.emit(event, payload);
	// }

	// invoke<
	// 	T extends keyof Invokables,
	// 	Args extends TypeOf<Invokables[T]["args"]>,
	// 	Returns extends TypeOf<Invokables[T]["returns"]>,
	// >(rpcName: T, args: Args): Promise<Returns> {
	// 	return this.rpcConnection.invoke(rpcName, args);
	// }

	protected handleError(err: Error) {
		this.log.error(err);
	}

	protected handleDisconnect() {
		this.log.debug("RpcClient: handleDisconnect");

		if (this.ping != null) {
			clearInterval(this.ping);
		}
	}

	async connect<
		A extends ZodTypeAny,
		R extends ZodTypeAny,
		E extends ZodTypeAny,
		Invokables extends Record<string, { args: A; returns: R }>,
		Events extends Record<string, { payload: E }>,
	>(
		ws: IWebSocket,
		serverOpts: ServerOptions<Invokables, Events>,
	): Promise<RpcConnection<A, R, E, Invokables, Events>> {
		const rpcConnection = new RpcConnection(
			ws,
			this.log,
			this.router,
			serverOpts.invokables,
			serverOpts.events,
		);

		ws.onClose(this.handleDisconnect.bind(this));

		// TODO: remove event listeners after the connection has been made
		// TODO: remove interval on error or disconnect event
		return new Promise((resolve, reject) => {
			ws.onOpen(() => {
				this.ping = setInterval(async () => {
					// TODO: enable ping
					// const result = await this.rpc.invoke("ping");
				}, 1000);

				resolve(rpcConnection);
			});

			ws.onError((err) => {
				reject(err);
			});
		});
	}
}
