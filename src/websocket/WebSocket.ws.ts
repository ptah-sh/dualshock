import { WebSocket as WSI } from "./WebSocket";
import { RawData, WebSocket } from "ws";

export class WebSocketWs implements WSI {
  constructor(protected ws: WebSocket) {
    ws.binaryType = "arraybuffer";
  }

  onOpen(callback: () => void): void {
    this.ws.on("open", callback);
  }

  onMessage(callback: (data: ArrayBuffer) => void): void {
    this.ws.on("message", this.handleMessage.bind(this, callback));
  }

  onError(callback: (err: Error) => void): void {
    this.ws.on("error", callback);
  }

  onClose(callback: () => void): void {
    this.ws.on("close", callback);
  }

  close(): void {}

  send(data: ArrayBuffer): void {
    this.ws.send(data);
  }

  handleMessage(callback: (data: ArrayBuffer) => void, rawData: RawData) {
    if (!(rawData instanceof ArrayBuffer)) {
      // Handle this case and disconnect the client.
      console.error("Got not a buffer", rawData);

      return;
    }

    callback(rawData);
  }
}
