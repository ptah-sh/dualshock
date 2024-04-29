export abstract class BaseRpcError extends Error {
    abstract get code(): string;
}

export class ProtocolError extends BaseRpcError {
    get code(): string {
        return "PROTOCOL_ERROR";
    }
}

export class InvalidPayloadError extends BaseRpcError {
    get code(): string {
        return "INVALID_PAYLOAD";
    }
}

export class NotFoundError extends BaseRpcError {
    get code(): string {
        return "NOT_FOUND";
    }
}
