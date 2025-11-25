import type { APIEvent } from "@solidjs/start/server";

import type { UploadFile } from "../../../storage/utils/file";
import Multipart from "../../multipart/multipart-fetch";
import Rest from "../../rest/rest-fetch";
import { Tus } from "../../tus/tus-fetch";
import type { UploadOptions } from "../../types";

/**
 * Configuration for SolidStart handler.
 */
export interface SolidStartHandlerConfig<TFile extends UploadFile> extends UploadOptions<TFile> {
    /** Handler type to use */
    type: "multipart" | "rest" | "tus";
}

/**
 * SolidStart API route handler that automatically handles the correct HTTP methods for each handler type.
 * @example
 * ```ts
 * // app/routes/api/upload/multipart.ts
 * import { DiskStorage } from "@visulima/storage";
 * import { createSolidStartHandler } from "@visulima/storage/handler/http/solid-start";
 *
 * const storage = new DiskStorage({ directory: "./uploads" });
 * const handler = createSolidStartHandler({ storage, type: "multipart" });
 *
 * export const POST = handler;
 * export const DELETE = handler;
 * export const GET = handler;
 * export const OPTIONS = handler;
 * ```
 * @example
 * ```ts
 * // app/routes/api/upload/rest.ts
 * import { DiskStorage } from "@visulima/storage";
 * import { createSolidStartHandler } from "@visulima/storage/handler/http/solid-start";
 *
 * const storage = new DiskStorage({ directory: "./uploads" });
 * const handler = createSolidStartHandler({ storage, type: "rest" });
 *
 * export const POST = handler;
 * export const PUT = handler;
 * export const PATCH = handler;
 * export const GET = handler;
 * export const HEAD = handler;
 * export const DELETE = handler;
 * export const OPTIONS = handler;
 * ```
 * @example
 * ```ts
 * // app/routes/api/upload/tus.ts
 * import { DiskStorage } from "@visulima/storage";
 * import { createSolidStartHandler } from "@visulima/storage/handler/http/solid-start";
 *
 * const storage = new DiskStorage({ directory: "./uploads" });
 * const handler = createSolidStartHandler({ storage, type: "tus" });
 *
 * export const POST = handler;
 * export const PATCH = handler;
 * export const HEAD = handler;
 * export const DELETE = handler;
 * export const OPTIONS = handler;
 * ```
 */
export const createSolidStartHandler = <TFile extends UploadFile>(config: SolidStartHandlerConfig<TFile>): (event: APIEvent) => Promise<Response> => {
    let handler: Multipart<TFile> | Rest<TFile> | Tus<TFile>;

    // Create the appropriate handler based on type
    switch (config.type) {
        case "multipart": {
            handler = new Multipart(config);
            break;
        }
        case "rest": {
            handler = new Rest(config);
            break;
        }
        case "tus": {
            handler = new Tus(config);
            break;
        }
        default: {
            throw new Error(`Unknown handler type: ${String((config as { type?: string }).type ?? "unknown")}`);
        }
    }

    const solidStartHandler = async (event: APIEvent): Promise<Response> => {
        try {
            return await handler.fetch(event.request);
        } catch (error: unknown) {
            const errorObject = error as { message?: string; status?: string; statusCode?: number };
            const statusCode = errorObject.statusCode || (errorObject.status ? Number.parseInt(errorObject.status, 10) : undefined) || 500;

            return Response.json({ error: errorObject.message || "Request failed" }, {
                headers: {
                    "Content-Type": "application/json",
                },
                status: statusCode,
            });
        }
    };

    return solidStartHandler;
};
