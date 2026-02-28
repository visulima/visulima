import { createClientRPCContext } from "../rpc/client";
import type { ServerHelpers } from "../types/app";

/**
 * Create server helpers for apps
 * @returns Server helpers instance
 */
export const createServerHelpers = (): ServerHelpers => {
    const rpcContext = createClientRPCContext();

    return {
        rpc: new Proxy({} as ServerHelpers["rpc"], {
            get(_target, prop: string) {
                return (...args: any[]) => rpcContext.callServer(prop as any, ...args);
            },
        }),
    };
};
