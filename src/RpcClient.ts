import { RpcConnection } from "./RpcConnection";
import { Logger } from "pino";
import { RpcRouter } from "./RpcRouter";
import { WebSocket } from "./websocket/WebSocket";

export class RpcClient {
  protected ping: NodeJS.Timeout | null = null;
  protected rpc: RpcConnection;

  constructor(
    protected ws: WebSocket,
    protected log: Logger,
    protected router: RpcRouter
  ) {
    this.rpc = new RpcConnection(ws, log, router);

    ws.onOpen(this.handleOpen.bind(this));
    ws.onError(this.handleDisconnect.bind(this));
    ws.onClose(this.handleDisconnect.bind(this));
  }

  protected handleDisconnect() {
    this.log.debug("RpcClient: handleDisconnect");

    if (this.ping != null) {
      clearInterval(this.ping);
    }
  }

  protected handleOpen() {
    this.ping = setInterval(async () => {
      const result = await this.rpc.invoke("ping");

      console.log("got pong", result);
    }, 1000);
  }
}
