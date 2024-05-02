import type { WebSocket, WebSocketServer } from "ws";
import { type RpcOptions, RpcRouter } from "./RpcRouter";
import type { Logger } from "pino";
import { RpcConnection } from "./RpcConnection";
import { WebSocketWs } from "./websocket/WebSocket.ws";
import { z, type ZodType } from "zod";

interface RpcServerOptions {
	wss: WebSocketServer;
	logger: Logger;
}

export class RpcServer {
	protected wss: WebSocketServer;
	protected log: Logger;

	protected router: RpcRouter;

	constructor(args: RpcServerOptions) {
		this.wss = args.wss;
		this.log = args.logger;
		this.router = new RpcRouter(this.log);

		this.wss.on("connection", this.handleConnection.bind(this));

		this.router.rpc({
			name: "ping",
			args: z.date(),
			result: z.date(),
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

	// TODO: extract router proxy methods (.rpc(), .ns()) into a separate base class/trait to reuse them in RpcServer and RpcClient?
	rpc<A extends ZodType, R extends ZodType>(opts: RpcOptions<A, R>): RpcRouter {
		return this.router.rpc(opts);
	}

	ns(name: string): RpcRouter {
		return this.router.ns(name);
	}
}
