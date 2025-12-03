import type { IncomingMessage, ServerResponse } from "node:http";

import { defineNuxtModule } from "@nuxt/kit";

import type { UploadOptions } from "../../handler/types";
import type { BaseStorage } from "../../storage/storage";
import type { UploadFile } from "../../storage/utils/file";

/**
 * Nitro event object with Node.js request/response
 */
interface NitroEvent {
    node: {
        req: IncomingMessage;
        res: ServerResponse;
    };
}

// Store handlers at module level so they persist across Nitro initialization
const handlerStorage = new Map<
    string,
    {
        handler: any;
        setCorsHeaders: (event: NitroEvent) => void;
    }
>();

/**
 * CORS configuration for upload endpoints
 */
export interface CorsOptions {
    /** Allowed CORS headers */
    headers?: string[];
    /** Allowed HTTP methods */
    methods?: string[];
    /** Allowed origins (use "*" for all origins) */
    origin?: string | string[];
}

/**
 * Configuration options for the Nuxt storage module
 */
export interface ModuleOptions {
    /** Base path for upload routes (default: '/api/upload') */
    basePath?: string;
    /** CORS configuration */
    cors?: CorsOptions;
    /** Enable multipart upload endpoint (default: true) */
    multipart?: boolean;
    /** Additional options for multipart handler */
    multipartOptions?: Omit<UploadOptions<UploadFile>, "storage">;
    /** Enable REST API endpoint for direct binary uploads (default: true) */
    rest?: boolean;
    /** Additional options for REST handler */
    restOptions?: Omit<UploadOptions<UploadFile>, "storage">;
    /** Storage instance to use for file uploads */
    storage: BaseStorage;
    /** Enable TUS resumable upload endpoint (default: true) */
    tus?: boolean;
    /** Additional options for TUS handler */
    tusOptions?: Omit<UploadOptions<UploadFile>, "storage">;
}

const nuxtModule: any = defineNuxtModule<ModuleOptions>({
    defaults: {
        basePath: "/api/upload",
        cors: {
            headers: ["Content-Type", "Upload-Offset", "Upload-Length", "Tus-Resumable"],
            methods: ["GET", "POST", "PATCH", "PUT", "HEAD", "DELETE", "OPTIONS"],
            origin: "*",
        },
        multipart: true,
        rest: true,
        tus: true,
    },
    meta: {
        compatibility: {
            nuxt: ">=4.0.0",
        },
        configKey: "storage",
        name: "@visulima/storage",
    },
    async setup(options: ModuleOptions, nuxt: any) {
        const {
            basePath = "/api/upload",
            cors = {
                headers: ["Content-Type", "Upload-Offset", "Upload-Length", "Tus-Resumable"],
                methods: ["GET", "POST", "PATCH", "PUT", "HEAD", "DELETE", "OPTIONS"],
                origin: "*",
            },
            multipart = true,
            multipartOptions = {},
            rest = true,
            restOptions = {},
            storage,
            tus = true,
            tusOptions = {},
        } = options;

        if (!storage) {
            throw new Error("[@visulima/storage/nuxt] Storage instance is required");
        }

        // Import handlers dynamically to avoid bundling issues
        const { Multipart, Rest, Tus } = await import("../../handler/http/node");

        // Create handler instances
        const multipartHandler = multipart ? new Multipart({ storage, ...multipartOptions }) : undefined;
        const restHandler = rest ? new Rest({ storage, ...restOptions }) : undefined;
        const tusHandler = tus ? new Tus({ storage, ...tusOptions }) : undefined;

        // Helper to set CORS headers
        const setCorsHeaders = (event: NitroEvent): void => {
            const origin = Array.isArray(cors.origin) ? cors.origin.join(", ") : cors.origin || "*";

            event.node.res.setHeader("Access-Control-Allow-Origin", origin);

            if (cors.methods) {
                event.node.res.setHeader("Access-Control-Allow-Methods", cors.methods.join(", "));
            }

            if (cors.headers) {
                event.node.res.setHeader("Access-Control-Allow-Headers", cors.headers.join(", "));
            }
        };

        // Store handlers in module-level storage
        if (multipartHandler) {
            handlerStorage.set(`${basePath}/multipart`, { handler: multipartHandler, setCorsHeaders });
        }

        if (restHandler) {
            handlerStorage.set(`${basePath}/rest`, { handler: restHandler, setCorsHeaders });
        }

        if (tusHandler) {
            handlerStorage.set(`${basePath}/tus`, { handler: tusHandler, setCorsHeaders });
        }

        // Set up route rules for CORS
        nuxt.hook("nitro:config", (nitroConfig: any) => {
            const routeRules = nitroConfig.routeRules || {};

            if (multipartHandler) {
                routeRules[`${basePath}/multipart/**`] = { cors: true };
            }

            if (restHandler) {
                routeRules[`${basePath}/rest/**`] = { cors: true };
            }

            if (tusHandler) {
                routeRules[`${basePath}/tus/**`] = { cors: true };
            }

            nitroConfig.routeRules = routeRules;
        });

        // Use nitro:init to add route handlers via request hook
        nuxt.hook("nitro:init", (nitro: any) => {
            nitro.hooks.hook("request", async (event: any) => {
                const url = event.node.req.url || "";

                // Check if this URL matches any of our stored handlers
                for (const [route, { handler, setCorsHeaders: setHeaders }] of handlerStorage.entries()) {
                    if (url.startsWith(route)) {
                        setHeaders(event as NitroEvent);
                        await handler.handle((event as NitroEvent).node.req, (event as NitroEvent).node.res);

                        return; // Handled, stop processing
                    }
                }
            });
        });
    },
});

export default nuxtModule;
