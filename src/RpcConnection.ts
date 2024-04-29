import {RawData, WebSocket} from "ws";
import {Logger} from "pino";
import {BaseRpcError, ProtocolError} from "./errors";
import {RpcRouter} from "./RpcRouter";

export class RpcConnection {
    constructor(protected ws: WebSocket, protected log: Logger, protected router: RpcRouter) {
        ws.once('message', this.handleMessage.bind(this));
    }

    async handleMessage(data: RawData) {
        this.log.info({msg: "Got message", data: data.toString()})

        if (!Array.isArray(data)) {
            // TODO: replace with this.error();
            this.error(null, new ProtocolError('protocol error - messages should be arrays'));

            return;
        }

        const reqId = Number.parseInt(data[0].toString());
        if (!Number.isFinite(reqId)) {
            // TODO: replace with this.error();
            this.error(null, new ProtocolError('reqId should be an integer'));

            return;
        }

        const rpcName = data[1].toString();
        const payload = data[2].toString();

        // TODO: handle errors for json parse
        const args = JSON.parse(payload);

        const result = await this.router.handle(rpcName, args);

        this.reply(reqId, result);
    }

    reply(reqId: number, payload: unknown) {
        this.ws.send([reqId, {
            ok: true,
            data: payload,
        }]);
    }

    // TODO: allow to pass custom error message
    // TODO: return stacktrace in dev mode, hide stacktrace on prod
    error(reqId: number | null, err: Error) {
        this.ws.send([
            Buffer.from(reqId?.toString() || ''),
            Buffer.from(JSON.stringify({
                ok: false,
                error: {
                    code: err instanceof BaseRpcError ? err.code : null,
                    message: err.message,
                    stack: err.stack,
                }
            }))
        ], this.disconnect.bind(this));
    }

    disconnect() {
        this.ws.close();
        this.ws.removeAllListeners();
    }
}
