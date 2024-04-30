import { WebSocket as WSI } from "./WebSocket";

export class WebSocketDom implements WSI {
  constructor(protected ws: WebSocket) {
    ws.binaryType = "arraybuffer";
  }

  onOpen(callback: () => void): void {
    this.ws.addEventListener("open", callback);
  }

  onMessage(callback: (data: ArrayBuffer) => void): void {
    this.ws.addEventListener(
      "message",
      this.handleMessage.bind(this, callback)
    );
  }

  onError(callback: (err: Error) => void): void {
    this.ws.addEventListener("error", this.handleError.bind(this, callback));
  }

  onClose(callback: () => void): void {
    this.ws.addEventListener("close", callback);
  }

  send(data: ArrayBuffer) {
    this.ws.send(data);
  }

  protected handleError(callback: (err: Error) => void, evt: Event): void {
    console.log("ERROR", evt);
  }

  protected handleMessage(callback: (data: ArrayBuffer) => void, evt: Event) {
    if (!(evt instanceof MessageEvent)) {
      return;
    }

    callback(evt.data);
  }

  close() {
    this.ws.close();
  }
}
