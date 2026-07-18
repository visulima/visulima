import type { IncomingMessage, ServerResponse } from "node:http";

import type { HtmlErrorHandlerOptions } from "./html-error-handler";
import { htmlErrorHandler } from "./html-error-handler";
import MockServerResponse from "./utils/mock-server-response";

export const fetchHtmlErrorHandler = (options: HtmlErrorHandlerOptions = {}): (error: Error, request: Request) => Promise<Response> => {
    const nodeHandler = htmlErrorHandler(options);

    return async (error: Error, request: Request): Promise<Response> => {
        // Create mock request/response for the node handler
        const mockRequest = {
            headers: Object.fromEntries(request.headers.entries()),
            method: request.method,
            url: request.url,
        } as IncomingMessage;

        const mockResponse = new MockServerResponse();

        // Call the node handler
        await nodeHandler(error, mockRequest, mockResponse as unknown as ServerResponse);

        // Convert the mock response to a fetch Response
        const contentType = mockResponse.getHeader("content-type") ?? "text/html; charset=utf-8";

        const headers: Record<string, string> = {
            "content-type": contentType as string,
        };

        for (const [key, value] of Object.entries(mockResponse.headers)) {
            if (key === "content-type") {
                continue;
            }

            headers[key] = Array.isArray(value) ? value.join(", ") : String(value);
        }

        return new Response(mockResponse.body, {
            headers,
            status: mockResponse.statusCode,
        });
    };
};

export default fetchHtmlErrorHandler;
