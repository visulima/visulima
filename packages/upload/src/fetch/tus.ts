import type { IncomingMessage, ServerResponse } from "node:http";

import Tus from "../handler/tus";
import type { UploadOptions } from "../handler/types";
import type { UploadFile } from "../storage/utils/file";

// Convert Web API Headers to plain object
function headersToObject(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};

    headers.forEach((value, key) => {
        result[key] = value;
    });

    return result;
}

const fetchTusHandler = <TFile extends UploadFile>(
    options: UploadOptions<TFile> & {
        onError?: (error: Error, request: Request) => void | Promise<void>;
    },
): (request: Request) => Promise<Response> => {
    const tus = new Tus<TFile, IncomingMessage, ServerResponse>(options);

    return async (request: Request): Promise<Response> => {
        try {
            if (options?.onError) {
                // Handle any setup errors here if needed
            }

            // Convert Request to Node.js IncomingMessage-like object
            const nodeRequest = {
                // Store the original request for body access
                _originalRequest: request,
                // Add required IncomingMessage properties
                aborted: false,
                destroy: () => {},
                headers: headersToObject(request.headers),
                httpVersion: "1.1",
                httpVersionMajor: 1,
                httpVersionMinor: 1,
                method: request.method,
                on: () => {},
                once: () => {},
                // For fetch requests, we need to handle the body differently
                // The handlers will need to be adapted to work with fetch streams
                pipe: () => {},
                removeListener: () => {},
                setEncoding: () => {},
                url: request.url,
            } as any as IncomingMessage;

            // Create a Response wrapper that mimics ServerResponse
            let responseStatus = 200;
            let responseHeaders: Record<string, string | string[]> = {};
            let responseBody: any = null;

            const nodeResponse = {
                end: (data?: any) => {
                    if (data !== undefined) {
                        responseBody = data;
                    }
                },
                flushHeaders: () => {
                    (this as any).headersSent = true;
                },
                getHeader: (name: string) => responseHeaders[name],
                headersSent: false,
                removeHeader: (name: string) => delete responseHeaders[name],
                setHeader: (name: string, value: string | string[]) => {
                    responseHeaders[name] = value;
                },
                statusCode: 200,
                write: (data: any) => {
                    responseBody = data;
                },
                // Add other required ServerResponse properties
                writeContinue: () => {},
                writeEarlyHints: () => {},
                writeHead: (status: number, headers?: Record<string, string | string[]>) => {
                    responseStatus = status;

                    if (headers) {
                        responseHeaders = { ...responseHeaders, ...headers };
                    }
                },
                writeProcessing: () => {},
            } as any as ServerResponse;

            await tus.handle(nodeRequest, nodeResponse);

            // Convert headers to a format suitable for Response
            const responseInit: ResponseInit = {
                headers: Object.fromEntries(
                    Object.entries(responseHeaders).map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : String(value ?? "")]),
                ),
                status: responseStatus,
            };

            return new Response(responseBody, responseInit);
        } catch (error: any) {
            if (options?.onError) {
                await options.onError(error, request);
            }

            // Return error response
            return new Response(JSON.stringify({ error: error.message }), {
                headers: { "Content-Type": "application/json" },
                status: error.statusCode || 500,
            });
        }
    };
};

export default fetchTusHandler;
