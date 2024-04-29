import {RawData} from "ws";
import {NotFoundError, ProtocolError} from "./errors";
import {z, ZodType, TypeOf, ZodSchema} from 'zod';

interface RpcOptions<A extends ZodType, R extends ZodType> {
    name: string;
    args?: A;
    result?: R;
    fn: (args: TypeOf<A>) => Promise<TypeOf<R>>;
}

export class RpcRouter {
    protected registry: Record<string, RpcOptions<ZodType, ZodType>> = {};

    constructor(protected ns?: string) {
    }

    rpc<A extends ZodType, R extends ZodType>(opts: RpcOptions<A, R>) {
        // TODO: add name validation
        const name = [this.ns, opts.name].filter(Boolean).join(':');

        this.registry[name] = opts as RpcOptions<any, any>;
    }

    async handle(rpcName: string, jsonData: unknown) {
        const rpcDef = this.registry[rpcName];
        if (rpcDef == null) {
            throw new NotFoundError(`rpc '${rpcName}' not found`);
        }

        const { args: argsSchema, result: resultSchema, fn } = rpcDef;

        // TODO: throw invalid payload on argsSchema.parse failure
        const result = await fn.call(null, argsSchema?.parse(jsonData));
        if (true /** TODO: shouldCheckResponses */) {
            resultSchema?.parse(result);
        }

        return result;
    }
}

const router = new RpcRouter();

router.rpc({
    name: "hello",
    args: z.string(),
    result: z.number(),
    fn: async (args) => {
        console.log('WATEFUCK')

        return 5;
    }
});

