import type { UploadOptions } from "../handler/types";
import type { BaseStorage } from "../storage/storage";
import type { UploadFile } from "../storage/utils/file";

interface ModuleOptions {
    /** Base path for upload routes (default: '/api/upload') */
    basePath?: string;
    /** CORS configuration */
    cors?: {
        headers?: string[];
        methods?: string[];
        origin?: string | string[];
    };
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const module = async (nuxt: any, options: ModuleOptions): Promise<void> => {
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
    const { Multipart, Rest, Tus } = await import("../handler/http/node");

    // Create handler instances
    const multipartHandler = multipart ? new Multipart({ storage, ...multipartOptions }) : undefined;
    const restHandler = rest ? new Rest({ storage, ...restOptions }) : undefined;
    const tusHandler = tus ? new Tus({ storage, ...tusOptions }) : undefined;

    // Helper to set CORS headers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setCorsHeaders = (event: any) => {
        const origin = Array.isArray(cors.origin) ? cors.origin.join(", ") : cors.origin || "*";

        event.node.res.setHeader("Access-Control-Allow-Origin", origin);

        if (cors.methods) {
            event.node.res.setHeader("Access-Control-Allow-Methods", cors.methods.join(", "));
        }

        if (cors.headers) {
            event.node.res.setHeader("Access-Control-Allow-Headers", cors.headers.join(", "));
        }
    };

    // Register multipart upload route
    if (multipartHandler) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nuxt.hook("nitro:config", (nitroConfig: any) => {
            const handlers = nitroConfig.handlers || [];

            handlers.push({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                handler: async (event: any) => {
                    setCorsHeaders(event);
                    await multipartHandler.handle(event.node.req, event.node.res);
                },
                method: "all",
                route: `${basePath}/multipart`,
            });

            // eslint-disable-next-line no-param-reassign
            nitroConfig.handlers = handlers;
        });
    }

    // Register REST API route
    if (restHandler) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nuxt.hook("nitro:config", (nitroConfig: any) => {
            const handlers = nitroConfig.handlers || [];

            handlers.push({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                handler: async (event: any) => {
                    setCorsHeaders(event);
                    await restHandler.handle(event.node.req, event.node.res);
                },
                method: "all",
                route: `${basePath}/rest`,
            });

            // eslint-disable-next-line no-param-reassign
            nitroConfig.handlers = handlers;
        });
    }

    // Register TUS upload route
    if (tusHandler) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nuxt.hook("nitro:config", (nitroConfig: any) => {
            const handlers = nitroConfig.handlers || [];

            handlers.push({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                handler: async (event: any) => {
                    setCorsHeaders(event);
                    await tusHandler.handle(event.node.req, event.node.res);
                },
                method: "all",
                route: `${basePath}/tus`,
            });

            // eslint-disable-next-line no-param-reassign
            nitroConfig.handlers = handlers;
        });
    }
};

export default module;
export type { ModuleOptions };
