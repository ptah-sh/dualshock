export abstract class BaseRpcError extends Error {
	abstract get code(): string;
}

const registeredCodes = new Set();

// TODO: rewrite this magic "make error class" as a plain class definitions?
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
	"RPC_PROTOCOL_ERROR",
);

export const InvalidPayloadError = makeErrorClass(
	"InvalidPayloadError",
	"RPC_INVALID_PAYLOAD",
);

export const NotFoundError = makeErrorClass("NotFoundError", "RPC_NOT_FOUND");

interface ValidationErrorItem {
	code: string;
	path: (string | number)[];
	message: string;
}
export const ValidationError = class ValidationError extends makeErrorClass(
	"ValidationError",
	"RPC_VALIDATION_ERROR",
) {
	constructor(public readonly errors: ValidationErrorItem[]) {
		super("Invalid request payload");

		Object.setPrototypeOf(this, ValidationError.prototype);
	}
};

export const InternalError = makeErrorClass(
	"InternalError",
	"RPC_INTERNAL_ERROR",
);
