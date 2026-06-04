import type { ViteDevServer } from "vite";

import type { StaticAsset } from "../rpc/functions/assets";
import type { SerializableModuleNode } from "../rpc/functions/module-graph";
import type { TailwindConfigResult } from "../rpc/functions/tailwind-config";
import type { Annotation, CreateAnnotationData, UpdateAnnotationData } from "./annotations";

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
     * Create a new annotation
     * @param data Annotation data (id, timestamps, status are generated server-side)
     */
    createAnnotation: (data: CreateAnnotationData) => Promise<Annotation>;

    /**
     * Delete an annotation and its screenshot
     * @param id Annotation ID
     */
    deleteAnnotation: (id: string) => Promise<boolean>;

    /**
     * Get all annotations
     */
    getAnnotations: () => Promise<Annotation[]>;

    /**
     * Get module dependency graph
     */
    getModuleGraph: () => Promise<SerializableModuleNode[]>;

    /**
     * Get a screenshot as a base64 data URL
     * @param annotationId Annotation ID
     */
    getScreenshot: (annotationId: string) => Promise<string | null>;

    /**
     * Get all static assets from the public directory
     */
    getStaticAssets: () => Promise<StaticAsset[]>;

    /**
     * Get full Tailwind CSS theme (default + user overrides)
     */
    getTailwindConfig: () => Promise<TailwindConfigResult>;

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

    /**
     * Save a screenshot for an annotation
     * @param annotationId Annotation ID
     * @param dataUrl Base64 data URL (PNG, JPEG, WebP, or SVG)
     * @returns Relative path within .devtoolbar/
     */
    saveScreenshot: (annotationId: string, dataUrl: string) => Promise<string>;

    /**
     * Update an existing annotation
     * @param id Annotation ID
     * @param data Fields to update
     */
    updateAnnotation: (id: string, data: UpdateAnnotationData) => Promise<Annotation | null>;
}

/**
 * Client-side RPC functions
 * These can be called from the server
 */
export interface ClientFunctions {
    // Extension point for custom client functions.
    [key: string]: (...args: any[]) => void;

    /**
     * Notify client of config change
     * @param config New Vite config
     */
    onConfigChange: (config: Record<string, unknown>) => void;

    /**
     * Notify client of HMR update
     * @param payload HMR payload
     */
    onHMRUpdate: (payload: unknown) => void;

    /**
     * Notify client of module update
     * @param module Updated module node
     */
    onModuleUpdate: (module: SerializableModuleNode) => void;
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
     * @param function_ Function implementation
     */
    registerFunction: <K extends keyof ClientFunctions>(name: K, function_: ClientFunctions[K]) => void;
}

export { type StaticAsset } from "../rpc/functions/assets";
