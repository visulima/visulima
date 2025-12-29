import type { ModuleNode, ViteDevServer } from "vite";

/**
 * Server-side RPC functions
 * These can be called from the client
 */
export interface ServerFunctions {
    /**
     * Extension point for custom server functions
     */
    [key: string]: (...args: any[]) => Promise<any>;

    /**
     * Get module dependency graph
     */
    getModuleGraph: () => Promise<ModuleNode[]>;

    /**
     * Get Vite configuration
     */
    getViteConfig: () => Promise<Record<string, any>>;

    /**
     * Open file in editor
     * @param file File path
     * @param line Line number (1-based)
     * @param column Column number (1-based)
     */
    openInEditor: (file: string, line?: number, column?: number) => Promise<void>;

    /**
     * Read file contents
     * @param path File path
     */
    readFile: (path: string) => Promise<string>;
}

/**
 * Client-side RPC functions
 * These can be called from the server
 */
export interface ClientFunctions {
    /**
     * Extension point for custom client functions
     */
    [key: string]: (...args: any[]) => void;

    /**
     * Notify client of config change
     * @param config New Vite config
     */
    onConfigChange: (config: Record<string, any>) => void;

    /**
     * Notify client of HMR update
     * @param payload HMR payload
     */
    onHMRUpdate: (payload: any) => void;

    /**
     * Notify client of module update
     * @param module Updated module node
     */
    onModuleUpdate: (module: ModuleNode) => void;
}

/**
 * RPC context for server-side
 */
export interface ServerRPCContext {
    /**
     * Call a client function
     * @param name Function name
     * @param args Function arguments
     */
    callClient: <K extends keyof ClientFunctions>(name: K, ...args: Parameters<ClientFunctions[K]>) => void;

    /**
     * Register a server function
     * @param name Function name
     * @param fn Function implementation
     */
    registerFunction: <K extends keyof ServerFunctions>(name: K, function_: ServerFunctions[K]) => void;

    /**
     * Vite dev server instance
     */
    server: ViteDevServer;
}

/**
 * RPC context for client-side
 */
export interface ClientRPCContext {
    /**
     * Call a server function
     * @param name Function name
     * @param args Function arguments
     */
    callServer: <K extends keyof ServerFunctions>(name: K, ...args: Parameters<ServerFunctions[K]>) => Promise<ReturnType<ServerFunctions[K]>>;

    /**
     * Register a client function
     * @param name Function name
     * @param fn Function implementation
     */
    registerFunction: <K extends keyof ClientFunctions>(name: K, function_: ClientFunctions[K]) => void;
}
