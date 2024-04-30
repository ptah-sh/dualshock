export abstract class BaseRpcError extends Error {
  abstract get code(): string;
}

const registeredCodes = new Set();

const makeErrorClass = (className: string, code: string) => {
  if (registeredCodes.has(code)) {
    throw new Error(`Error code '${code}' is already registered`);
  }

  return class RpcError extends BaseRpcError {
    constructor(message: string) {
      super(`${className}: ${message}`);

      Object.setPrototypeOf(this, RpcError.prototype);
    }

    get code() {
      return code;
    }
  };
};

export const ProtocolError = makeErrorClass(
  "ProtocolError",
  "RPC_PROTOCOL_ERROR"
);

export const InvalidPayloadError = makeErrorClass(
  "InvalidPayloadError",
  "RPC_INVALID_PAYLOAD"
);

export const NotFoundError = makeErrorClass("NotFoundError", "RPC_NOT_FOUND");
