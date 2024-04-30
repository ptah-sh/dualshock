import { WebSocket, WebSocketServer } from "ws";
import { RpcRouter } from "./RpcRouter";
import { Logger } from "pino";
import { RpcConnection } from "./RpcConnection";
import { WebSocketWs } from "./websocket/WebSocket.ws";

interface RpcServerOptions {
  wss: WebSocketServer;
  logger: Logger;
}

export class RpcServer {
  protected wss: WebSocketServer;
  protected log: Logger;

  protected router: RpcRouter = new RpcRouter();

  constructor(args: RpcServerOptions) {
    this.wss = args.wss;
    this.log = args.logger;

    this.wss.on("connection", this.handleConnection.bind(this));

    this.router.rpc({
      name: "ping",
      fn: async () => {
        this.log.info("RpcServer: ping");

        return new Date();
      },
    });
  }

  // TODO: add timeout for receiving the first message (handshake).
  // TODO: handlers should accept the WS connection / or it should be abstracted ???
  handleConnection(ws: WebSocket) {
    this.log.info("Incoming Connection");

    new RpcConnection(new WebSocketWs(ws), this.log, this.router);

    ws.on("error", this.handleError.bind(this));
    ws.on("close", this.handleClose.bind(this));
  }

  handleError(err: Error) {}

  handleClose() {}
}
