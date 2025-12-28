import type { ClientFunctions, ClientRPCContext, ServerFunctions } from '../types/rpc.js';

/**
 * Creates client-side RPC context
 * @param customFunctions - Custom client functions to register
 * @returns Client RPC context
 */
export const createClientRPCContext = (customFunctions?: Partial<ClientFunctions>): ClientRPCContext => {
  const functions: ClientFunctions = {
    onModuleUpdate: () => {
      // Default implementation
    },
    onConfigChange: () => {
      // Default implementation
    },
    onHMRUpdate: () => {
      // Default implementation
    },
    ...customFunctions,
  } as ClientFunctions;

  // Pending RPC requests map
  const pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (error: any) => void }>();

  // Setup HMR listener for RPC responses
  if (typeof window !== 'undefined' && import.meta.hot) {
    import.meta.hot.on('dev-toolbar:rpc:response', (data: { id: string; result: any }) => {
      const request = pendingRequests.get(data.id);
      if (request) {
        pendingRequests.delete(data.id);
        request.resolve(data.result);
      }
    });

    import.meta.hot.on('dev-toolbar:rpc:error', (data: { id: string; error: string }) => {
      const request = pendingRequests.get(data.id);
      if (request) {
        pendingRequests.delete(data.id);
        request.reject(new Error(data.error));
      }
    });

    // Listen for server-initiated client function calls
    import.meta.hot.on('dev-toolbar:client', (data: { method: string; args: any[] }) => {
      const { method, args } = data;
      const fn = functions[method];

      if (fn) {
        try {
          fn(...args);
        } catch (error) {
          console.error(`[dev-toolbar] Error calling client function ${method}:`, error);
        }
      }
    });
  }

  return {
    async callServer<K extends keyof ServerFunctions>(
      name: K,
      ...args: Parameters<ServerFunctions[K]>
    ): Promise<ReturnType<ServerFunctions[K]>> {
      if (typeof window === 'undefined' || !import.meta.hot) {
        throw new Error('RPC calls can only be made in browser environment with HMR');
      }

      const id = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

      return new Promise<ReturnType<ServerFunctions[K]>>((resolve, reject) => {
        pendingRequests.set(id, { resolve, reject });

        // Set timeout for request
        setTimeout(() => {
          if (pendingRequests.has(id)) {
            pendingRequests.delete(id);
            reject(new Error(`RPC call timeout: ${name}`));
          }
        }, 30_000); // 30 second timeout

        // Send RPC request
        import.meta.hot!.send('dev-toolbar:rpc', {
          method: name,
          args,
          id,
        });
      });
    },
    registerFunction<K extends keyof ClientFunctions>(name: K, fn: ClientFunctions[K]): void {
      functions[name] = fn;
    },
  };
};
