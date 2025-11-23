import type { Context, Hono } from "hono";

import type { UploadFile } from "../../../storage/utils/file";
import Multipart from "../../multipart/multipart-fetch";
import Rest from "../../rest/rest-fetch";
import { Tus } from "../../tus/tus-fetch";
import type { UploadOptions } from "../../types";

/**
 * Creates a Hono-compatible handler function.
 */
const createHandlerFunction
    = <TFile extends UploadFile>(handler: Multipart<TFile> | Rest<TFile> | Tus<TFile>): (c: Context) => Promise<Response> =>
        async (c: Context): Promise<Response> => {
            try {
                // Get the raw Request from Hono's Context
                const request = c.req.raw;

                return await handler.fetch(request);
            } catch (error: unknown) {
                const errorObject = error as { message?: string; status?: string; statusCode?: number };
                const statusCode = errorObject.statusCode || (errorObject.status ? Number.parseInt(errorObject.status, 10) : undefined) || 500;

                // Return a Response object (Hono accepts Response objects)
                return Response.json({ error: errorObject.message || "Request failed" }, { status: statusCode });
            }
        };

/**
 * Registers upload handler routes on a Hono app instance.
 * Automatically registers all required HTTP methods for the specified handler type.
 * @param app Hono app instance to register routes on
 * @param config Handler configuration including storage, type, and path
 * @example
 * ```ts
 * import { Hono } from "hono";
 * import { DiskStorage } from "@visulima/storage";
 * import { createHonoHandler } from "@visulima/storage/handler/http/hono";
 *
 * const app = new Hono();
 * const storage = new DiskStorage({ directory: "./uploads" });
 *
 * // Multipart handler - automatically registers POST, GET, DELETE, OPTIONS
 * createHonoHandler(app, {
 *   path: "/files",
 *   storage,
 *   type: "multipart"
 * });
 * ```
 * @example
 * ```ts
 * import { Hono } from "hono";
 * import { DiskStorage } from "@visulima/storage";
 * import { createHonoHandler } from "@visulima/storage/handler/http/hono";
 *
 * const app = new Hono();
 * const storage = new DiskStorage({ directory: "./uploads" });
 *
 * // REST handler - automatically registers POST, PUT, PATCH, GET, HEAD, DELETE, OPTIONS
 * createHonoHandler(app, {
 *   path: "/files-rest",
 *   storage,
 *   type: "rest"
 * });
 * ```
 * @example
 * ```ts
 * import { Hono } from "hono";
 * import { DiskStorage } from "@visulima/storage";
 * import { createHonoHandler } from "@visulima/storage/handler/http/hono";
 *
 * const app = new Hono();
 * const storage = new DiskStorage({ directory: "./uploads" });
 *
 * // TUS handler - automatically registers POST, PATCH, HEAD, GET, DELETE, OPTIONS
 * createHonoHandler(app, {
 *   path: "/files-tus",
 *   storage,
 *   type: "tus"
 * });
 * ```
 */
export const createStorageHandler = <TFile extends UploadFile>(app: Hono, config: HonoHandlerConfig<TFile>): void => {
    const { path, type, ...handlerConfig } = config;
    let handler: Multipart<TFile> | Rest<TFile> | Tus<TFile>;

    // Create the appropriate handler based on type
    switch (type) {
        case "multipart": {
            handler = new Multipart(handlerConfig);
            break;
        }
        case "rest": {
            handler = new Rest(handlerConfig);
            break;
        }
        case "tus": {
            handler = new Tus(handlerConfig);
            break;
        }
        default: {
            throw new Error(`Unknown handler type: ${String(type ?? "unknown")}`);
        }
    }

    // Create the handler function
    const handlerFunction = createHandlerFunction(handler);

    // Register routes based on handler type
    switch (type) {
        case "multipart": {
            // Multipart: POST, GET, DELETE, OPTIONS
            app.post(path, handlerFunction);
            app.get(`${path}/:id?/:metadata?`, handlerFunction);
            app.delete(`${path}/:id`, handlerFunction);
            app.on("OPTIONS", path, handlerFunction);
            break;
        }
        case "rest": {
            // REST: POST, PUT, PATCH, GET, HEAD, DELETE, OPTIONS
            app.post(path, handlerFunction);
            app.put(`${path}/:id`, handlerFunction);
            app.patch(`${path}/:id`, handlerFunction);
            app.get(`${path}/:id?`, handlerFunction);
            app.on("HEAD", `${path}/:id`, handlerFunction);
            app.delete(`${path}/:id?`, handlerFunction);
            app.on("OPTIONS", path, handlerFunction);
            break;
        }
        case "tus": {
            // TUS: POST, PATCH, HEAD, GET, DELETE, OPTIONS
            // Use app.all() to handle all methods on both base path and with ID
            app.all(path, handlerFunction);
            app.all(`${path}/:id`, handlerFunction);
            break;
        }
        default: {
            // This should never happen due to TypeScript narrowing, but satisfies linter
            throw new Error(`Unknown handler type: ${String(type)}`);
        }
    }
};

/**
 * Configuration for Hono handler.
 */
export interface HonoHandlerConfig<TFile extends UploadFile> extends UploadOptions<TFile> {
    /** Base path for the routes (e.g., "/files" or "/api/upload") */
    path: string;
    /** Handler type to use */
    type: "multipart" | "rest" | "tus";
}
