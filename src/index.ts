import { RpcServer } from "./RpcServer";
import {WebSocketServer} from "ws";
import createPino from "pino";

const wss = new WebSocketServer({
    port: 8000,
});

const logger = createPino();

const rpcServer = new RpcServer({
    wss,
    logger,
});
