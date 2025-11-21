import type { UploadFile } from "../../../storage/utils/file";
import Multipart from "../../multipart/multipart-fetch";
import Rest from "../../rest/rest-fetch";
import { Tus } from "../../tus/tus-fetch";
import type { UploadOptions } from "../../types";

/**
 * Wait for storage to be ready before handling requests.
 */
const waitForStorage = async (storage: { isReady: boolean }): Promise<void> => {
    if (storage.isReady) {
        return;
    }

    // Wait up to 5 seconds for storage to be ready
    const maxWait = 5000;
    const startTime = Date.now();

    while (!storage.isReady && Date.now() - startTime < maxWait) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, 100);
        });
    }

    if (!storage.isReady) {
        throw new Error("Storage initialization timeout");
    }
};

/**
 * Configuration for Next.js handler.
 */
export interface NextjsHandlerConfig<TFile extends UploadFile> extends UploadOptions<TFile> {
    /** Handler type to use */
    type: "multipart" | "rest" | "tus";
}

/**
 * Next.js route handler that automatically exports the correct HTTP methods for each handler type.
 * @example
 * ```ts
 * // app/api/upload/multipart/route.ts
 * import { DiskStorage } from "@visulima/storage";
 * import { createNextjsHandler } from "@visulima/storage/handler/http/nextjs";
 *
 * const storage = new DiskStorage({ directory: "./uploads" });
 * const handler = createNextjsHandler({ storage, type: "multipart" });
 *
 * export const POST = handler;
 * export const DELETE = handler;
 * export const GET = handler;
 * export const OPTIONS = handler;
 * ```
 * @example
 * ```ts
 * // app/api/upload/rest/route.ts
 * import { DiskStorage } from "@visulima/storage";
 * import { createNextjsHandler } from "@visulima/storage/handler/http/nextjs";
 *
 * const storage = new DiskStorage({ directory: "./uploads" });
 * const handler = createNextjsHandler({ storage, type: "rest" });
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
 * // app/api/upload/tus/route.ts
 * import { DiskStorage } from "@visulima/storage";
 * import { createNextjsHandler } from "@visulima/storage/handler/http/nextjs";
 *
 * const storage = new DiskStorage({ directory: "./uploads" });
 * const handler = createNextjsHandler({ storage, type: "tus" });
 *
 * export const POST = handler;
 * export const PATCH = handler;
 * export const HEAD = handler;
 * export const DELETE = handler;
 * export const OPTIONS = handler;
 * ```
 */
export const createNextjsHandler = <TFile extends UploadFile>(
    config: NextjsHandlerConfig<TFile>,
): (request: Request) => Promise<Response> => {
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

    // Create the Next.js route handler
    const nextjsHandler = async (request: Request): Promise<Response> => {
        try {
            await waitForStorage(handler.storage);

            return await handler.fetch(request);
        } catch (error: unknown) {
            const errorObject = error as { message?: string; status?: string; statusCode?: number };
            const statusCode
                = errorObject.statusCode
                    || (errorObject.status ? Number.parseInt(errorObject.status, 10) : undefined)
                    || 500;

            return Response.json(
                { error: errorObject.message || "Request failed" },
                { status: statusCode },
            );
        }
    };

    return nextjsHandler;
};
