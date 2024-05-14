import type { RpcServer } from "./RpcServer.js";
import type { RpcClient } from "./RpcClient.js";

export abstract class Plugin<Host extends RpcServer | RpcClient> {
	constructor(readonly name: string) {
		// TODO: validate name better via some regexp, e.g. lowercase letters with dashes?
		if (name === "") {
			throw new Error("Plugin name cannot be empty");
		}
	}

	abstract setup(hsot: Host): Promise<void>;
}
