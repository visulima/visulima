import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type { UploadFile } from "../../../storage/utils/file";
import Multipart from "../../multipart/multipart-fetch";
import Rest from "../../rest/rest-fetch";
import { Tus } from "../../tus/tus-fetch";
import type { UploadOptions } from "../../types";

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
 * import { createHandler } from "@visulima/storage/handler/http/nextjs";
 *
 * const storage = new DiskStorage({ directory: "./uploads" });
 * const handler = createHandler({ storage, type: "multipart" });
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
 * import { createHandler } from "@visulima/storage/handler/http/nextjs";
 *
 * const storage = new DiskStorage({ directory: "./uploads" });
 * const handler = createHandler({ storage, type: "rest" });
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
 * import { createHandler } from "@visulima/storage/handler/http/nextjs";
 *
 * const storage = new DiskStorage({ directory: "./uploads" });
 * const handler = createHandler({ storage, type: "tus" });
 *
 * export const POST = handler;
 * export const PATCH = handler;
 * export const HEAD = handler;
 * export const DELETE = handler;
 * export const OPTIONS = handler;
 * ```
 */
export const createHandler = <TFile extends UploadFile>(config: NextjsHandlerConfig<TFile>): ((request: NextRequest) => Promise<NextResponse>) => {
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

    const nextjsHandler = async (request: NextRequest): Promise<NextResponse> => {
        try {
            return (await handler.fetch(request)) as NextResponse;
        } catch (error: unknown) {
            const errorObject = error as { message?: string; status?: string; statusCode?: number };
            const statusCode = errorObject.statusCode || (errorObject.status ? Number.parseInt(errorObject.status, 10) : undefined) || 500;

            return NextResponse.json({ error: errorObject.message || "Request failed" }, { status: statusCode });
        }
    };

    return nextjsHandler;
};
