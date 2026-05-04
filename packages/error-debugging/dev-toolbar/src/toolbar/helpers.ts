import { createClientRPCContext } from "../rpc/client";
import type { ServerHelpers } from "../types/app";

/**
 * Creates server helpers that proxy RPC calls for use within app init().
 * @returns Server helpers instance.
 */
const createServerHelpers = (): ServerHelpers => {
    const rpcContext = createClientRPCContext();

    return {
        rpc: new Proxy(
            {},
            {
                get(_target, prop: string) {
                    return (...args: any[]) => rpcContext.callServer(prop as any, ...args);
                },
            },
        ),
    };
};

export { createServerHelpers };
export default createServerHelpers;
