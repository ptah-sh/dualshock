import { Logger } from "pino";
import { BaseRpcError } from "./errors";
import { RpcRouter } from "./RpcRouter";
import { z } from "zod";
import { WebSocket } from "./websocket/WebSocket";

const packet = z
  .object({
    serial: z.number(),
    type: z.literal("invoke"),
    name: z.string(),
    args: z.unknown().optional(),
  })
  .or(
    z.object({
      ok: z.literal(true),
      serial: z.number(),
      type: z.literal("result"),
      data: z.unknown(),
    })
  )
  .or(
    z.object({
      ok: z.literal(false),
      serial: z.number(),
      type: z.literal("error"),
      error: z.unknown(),
    })
  );

type Packet = z.infer<typeof packet>;

interface GenericResult {
  ok: boolean;
  data?: unknown;
  error?: unknown;
}

class SerialSource {
  private serial: number = 0;

  get nextSerial(): number {
    this.serial += 1;

    return this.serial;
  }
}

export class RpcConnection {
  protected readonly serialSource: SerialSource = new SerialSource();
  protected receivers: Map<number, Function> = new Map();
  protected textDecoder: TextDecoder = new TextDecoder("utf-8");
  protected textEncoder: TextEncoder = new TextEncoder();

  constructor(
    protected ws: WebSocket,
    protected log: Logger,
    protected router: RpcRouter
  ) {
    ws.onMessage(this.handleMessage.bind(this));
  }

  protected async handleMessage(rawData: ArrayBuffer) {
    this.log.info({
      msg: "Got message",
      data: JSON.parse(this.textDecoder.decode(rawData)),
    });

    const parsedPacket = packet.parse(
      JSON.parse(this.textDecoder.decode(rawData))
    );

    const { serial, type } = parsedPacket;

    if (type === "invoke") {
      const { name, args } = parsedPacket;

      try {
        const result = await this.router.handle(name, args);

        await this.reply(serial, result);
      } catch (err: unknown) {
        await this.error(serial, err);
      }
    } else if (type === "result") {
      const receiver = this.receivers.get(serial);
      if (receiver == null) {
        this.log.error(`No such receiver: serial '${serial}'`);

        return;
      }

      receiver(parsedPacket);
    }
  }

  protected async reply(serial: number, data: unknown) {
    await this.send({
      ok: true,
      serial: serial,
      type: "result",
      data: data,
    });
  }

  // TODO: allow to pass custom error message
  // TODO: return stacktrace in dev mode, hide stacktrace on prod
  protected async error(serial: number, err: unknown) {
    await this.send({
      ok: false,
      serial: serial,
      type: "error",
      error: {
        code: err instanceof BaseRpcError ? err.code : null,
        message: err instanceof Error ? err.message : "Unknown error",
        stack: err instanceof Error ? err.stack : null,
      },
    });

    this.disconnect();
  }

  protected async send(packet: Packet): Promise<void> {
    this.ws.send(this.textEncoder.encode(JSON.stringify(packet)).buffer);
  }

  async invoke(rpc: string, args?: unknown): Promise<unknown> {
    const serial = this.serialSource.nextSerial;

    await this.send({
      serial: serial,
      type: "invoke",
      name: rpc,
      args: args,
    });

    return new Promise((resolve, reject) => {
      this.receivers.set(serial, (result: GenericResult) => {
        this.receivers.delete(serial);
        if (result.ok) {
          resolve(result.data);

          return;
        }

        reject(result.error);
      });
    });
  }

  disconnect() {
    this.ws.close();
    // this.ws.removeAllListeners();
  }
}
