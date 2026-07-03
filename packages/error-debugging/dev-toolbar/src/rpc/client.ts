import type { ClientFunctions, ClientRPCContext, ServerFunctions } from "../types/rpc";

/**
 * Creates client-side RPC context.
 * @param customFunctions Custom client functions to register.
 * @returns Client RPC context.
 */
const createClientRPCContext = (customFunctions?: Partial<ClientFunctions>): ClientRPCContext => {
    const functions: ClientFunctions = {
        onConfigChange: () => {
            // Default implementation
        },
        onHMRUpdate: () => {
            // Default implementation
        },
        onModuleUpdate: () => {
            // Default implementation
        },
        ...customFunctions,
    };

    // Pending RPC requests map

    const pendingRequests = new Map<string, { reject: (error: any) => void; resolve: (value: any) => void }>();

    // Setup HMR listener for RPC responses
    if (globalThis.window !== undefined && import.meta.hot) {
        import.meta.hot.on("dev-toolbar:rpc:response", (data: { id: string; result: any }) => {
            const request = pendingRequests.get(data.id);

            if (request) {
                pendingRequests.delete(data.id);
                request.resolve(data.result);
            }
        });

        import.meta.hot.on("dev-toolbar:rpc:error", (data: { error: string; id: string }) => {
            const request = pendingRequests.get(data.id);

            if (request) {
                pendingRequests.delete(data.id);
                request.reject(new Error(data.error));
            }
        });

        // Listen for server-initiated client function calls

        import.meta.hot.on("dev-toolbar:client", (data: { args: any[]; method: string }) => {
            const { args, method } = data;
            const handler = functions[method];

            if (handler) {
                try {
                    handler(...args);
                } catch (error) {
                    console.error(`[dev-toolbar] Error calling client function ${method}:`, error);
                }
            }
        });
    }

    return {
        async callServer<K extends keyof ServerFunctions>(name: K, ...args: Parameters<ServerFunctions[K]>): Promise<ReturnType<ServerFunctions[K]>> {
            if (globalThis.window === undefined || !import.meta.hot) {
                throw new Error("RPC calls can only be made in browser environment with HMR");
            }

            // eslint-disable-next-line sonarjs/pseudo-random
            const id = `${Date.now()}-${Math.random().toString(36).slice(7)}`;

            return new Promise<ReturnType<ServerFunctions[K]>>((resolve, reject) => {
                pendingRequests.set(id, { reject, resolve });

                // Set timeout for request
                setTimeout(() => {
                    if (pendingRequests.has(id)) {
                        pendingRequests.delete(id);
                        reject(new Error(`RPC call timeout: ${name}`));
                    }
                }, 30_000); // 30 second timeout

                // Send RPC request

                import.meta.hot!.send("dev-toolbar:rpc", {
                    args,
                    id,
                    method: name,
                });
            });
        },
        registerFunction<K extends keyof ClientFunctions>(name: K, function_: ClientFunctions[K]): void {
            functions[name] = function_;
        },
    };
};

export { createClientRPCContext };
