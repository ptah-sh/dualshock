import type { RpcServer } from "./RpcServer.js";
import type { RpcClient } from "./RpcClient.js";

export abstract class Plugin<Host extends RpcServer | RpcClient> {
	// TODO: detect plugin's name by traversing the filesystem lookig plugin's package.json#name
	//   This feature have to be implemented in a separate method as it should be implemented
	//     in an asynchronous way. Define `final` (using Symbol?) bootstrap() method in this class.
	constructor(readonly name: string) {
		// TODO: validate name better via some regexp, e.g. lowercase letters with dashes?
		if (name === "") {
			throw new Error("Plugin name cannot be empty");
		}
	}

	abstract setup(hsot: Host): Promise<void>;
}
