import type { IncomingMessage, ServerResponse } from "node:http";

import type { UploadFile } from "../storage/utils/file";
import Multipart from "../handler/multipart";
import type { UploadOptions } from "../handler/types";

// Convert Web API Headers to plain object
function headersToObject(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
        result[key] = value;
    });
    return result;
}

const fetchMultipartHandler = <TFile extends UploadFile>(
    options: UploadOptions<TFile> & {
        onError?: (error: Error, request: Request) => void | Promise<void>;
    },
): ((request: Request) => Promise<Response>) => {
    const multipart = new Multipart<TFile, IncomingMessage, ServerResponse>(options);

    return async (request: Request): Promise<Response> => {
        try {
            if (options?.onError) {
                // Handle any setup errors here if needed
            }

            // Convert Request to Node.js IncomingMessage-like object
            const nodeRequest = {
                headers: headersToObject(request.headers),
                method: request.method,
                url: request.url,
                // Add required IncomingMessage properties
                aborted: false,
                httpVersion: "1.1",
                httpVersionMajor: 1,
                httpVersionMinor: 1,
                // For fetch requests, we need to handle the body differently
                // The handlers will need to be adapted to work with fetch streams
                pipe: () => {},
                on: () => {},
                once: () => {},
                removeListener: () => {},
                setEncoding: () => {},
                destroy: () => {},
                // Store the original request for body access
                _originalRequest: request,
            } as any as IncomingMessage;

            // Create a Response wrapper that mimics ServerResponse
            let responseStatus = 200;
            let responseHeaders: Record<string, string | string[]> = {};
            let responseBody: any = null;
            let responseEnded = false;

            const nodeResponse = {
                writeHead: (status: number, headers?: Record<string, string | string[]>) => {
                    responseStatus = status;
                    if (headers) {
                        responseHeaders = { ...responseHeaders, ...headers };
                    }
                },
                setHeader: (name: string, value: string | string[]) => {
                    responseHeaders[name] = value;
                },
                getHeader: (name: string) => responseHeaders[name],
                removeHeader: (name: string) => delete responseHeaders[name],
                write: (data: any) => {
                    responseBody = data;
                },
                end: (data?: any) => {
                    if (data !== undefined) responseBody = data;
                    responseEnded = true;
                },
                statusCode: 200,
                headersSent: false,
                // Add other required ServerResponse properties
                writeContinue: () => {},
                writeEarlyHints: () => {},
                writeProcessing: () => {},
                flushHeaders: () => { this.headersSent = true; },
            } as any as ServerResponse;

            await multipart.handle(nodeRequest, nodeResponse);

            // Convert headers to a format suitable for Response
            const responseInit: ResponseInit = {
                status: responseStatus,
                headers: Object.fromEntries(
                    Object.entries(responseHeaders).map(([key, value]) => [
                        key,
                        Array.isArray(value) ? value.join(', ') : String(value ?? '')
                    ])
                ),
            };

            return new Response(responseBody, responseInit);
        } catch (error: any) {
            if (options?.onError) {
                await options.onError(error, request);
            }

            // Return error response
            return new Response(JSON.stringify({ error: error.message }), {
                status: error.statusCode || 500,
                headers: { "Content-Type": "application/json" },
            });
        }
    };
};

export default fetchMultipartHandler;
