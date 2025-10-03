import type { IncomingMessage, ServerResponse } from "node:http";

import Tus from "../handler/tus";
import type { UploadOptions } from "../handler/types";
import type { UploadFile } from "../storage/utils/file";

const httpTusHandler = <TFile extends UploadFile>(
    options: UploadOptions<TFile> & {
        onError?: (error: Error, request: IncomingMessage, response: ServerResponse) => void | Promise<void>;
    },
): (request: IncomingMessage, response: ServerResponse) => Promise<void> => {
    const tus = new Tus<TFile, IncomingMessage, ServerResponse>(options);

    return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
        try {
            if (options?.onError) {
                // Handle any setup errors here if needed
            }

            await tus.handle(request, response);
        } catch (error: any) {
            if (options?.onError) {
                await options.onError(error, request, response);
            }

            // The Tus handler should handle errors internally, but this provides an additional error boundary
            if (!response.headersSent) {
                response.statusCode = error.statusCode || 500;
                response.setHeader("Content-Type", "application/json");
                response.end(JSON.stringify({ error: error.message }));
            }
        }
    };
};

export default httpTusHandler;
