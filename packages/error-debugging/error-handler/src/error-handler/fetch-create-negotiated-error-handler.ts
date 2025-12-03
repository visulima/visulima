import type { IncomingMessage, ServerResponse } from "node:http";

import { jsonErrorHandler as JsonErrorHandler } from "./json-error-handler";
import JsonapiErrorHandler from "./jsonapi-error-handler";
import { jsonpErrorHandler as JsonpErrorHandler } from "./jsonp-error-handler";
import ProblemErrorHandler from "./problem-error-handler";
import { textErrorHandler as TextErrorHandler } from "./text-error-handler";
import type { ErrorHandler, FetchErrorHandlers } from "./types";
import { xmlErrorHandler as XmlErrorHandler } from "./xml-error-handler";

// Mock ServerResponse for fetch handler
class MockServerResponse {
    public statusCode: number = 200;

    public headers: Record<string, string | number | string[]> = {};

    public _body: string = "";

    public setHeader(name: string, value: string | number | string[]): void {
        this.headers[name.toLowerCase()] = value;
    }

    public getHeader(name: string): string | number | string[] | undefined {
        return this.headers[name.toLowerCase()];
    }

    public getHeaders(): Record<string, string | number | string[]> {
        return { ...this.headers };
    }

    public writeHead(statusCode: number): void {
        this.statusCode = statusCode;
    }

    public write(chunk: string | Buffer): void {
        // eslint-disable-next-line no-underscore-dangle
        this._body += chunk.toString();
    }

    public end(data?: string | Buffer): void {
        if (data) {
            // eslint-disable-next-line no-underscore-dangle
            this._body += data.toString();
        }
    }

    public flushHeaders(): void {}
}

// Simple content type negotiation for fetch (without @tinyhttp/accepts dependency)
const negotiateContentType = (acceptHeader: string | null): string => {
    if (!acceptHeader) {
        return "text/html";
    }

    const accept = acceptHeader.toLowerCase();

    // Server preference order (same as node version)
    if (accept.includes("text/html")) {
        return "text/html";
    }

    if (accept.includes("application/vnd.api+json")) {
        return "application/vnd.api+json";
    }

    if (accept.includes("application/problem+json")) {
        return "application/problem+json";
    }

    if (accept.includes("application/json")) {
        return "application/json";
    }

    if (accept.includes("text/plain")) {
        return "text/plain";
    }

    if (accept.includes("application/javascript") || accept.includes("text/javascript")) {
        return "application/javascript";
    }

    if (accept.includes("application/xml") || accept.includes("text/xml")) {
        return "application/xml";
    }

    return "text/html"; // default
};

// Adapter to convert node-style error handler to fetch-style
const adaptErrorHandlerToFetch
    = (nodeHandler: ErrorHandler) =>
        async (error: unknown, request: Request): Promise<Response> => {
        // Create mock request/response for the node handler
            const mockRequest = {
                headers: Object.fromEntries(request.headers.entries()),
                method: request.method,
                url: request.url,
            } as IncomingMessage;

            const mockResponse = new MockServerResponse();

            // Call the node handler
            await nodeHandler(error as Error, mockRequest, mockResponse as unknown as ServerResponse);

            // Convert to fetch Response
            const headers: Record<string, string> = {};

            for (const [key, value] of Object.entries(mockResponse.headers)) {
                headers[key] = Array.isArray(value) ? value.join(", ") : String(value);
            }

            // eslint-disable-next-line no-underscore-dangle
            return new Response(mockResponse._body, {
                headers,
                status: mockResponse.statusCode,
            });
        };

const createFetchNegotiatedErrorHandler
    = (errorHandlers: FetchErrorHandlers, showTrace: boolean, defaultHtmlHandler?: (error: Error, request: Request) => Promise<Response>) =>
        async (error: Error, request: Request): Promise<Response> => {
            const accept = request.headers.get("accept");
            const chosenType = negotiateContentType(accept);

            let fetchErrorHandler: (error: Error, request: Request) => Promise<Response> = defaultHtmlHandler || adaptErrorHandlerToFetch(ProblemErrorHandler);

            // Convert node handlers to fetch handlers
            if (chosenType === "text/html" && defaultHtmlHandler) {
                fetchErrorHandler = defaultHtmlHandler;
            } else {
            // eslint-disable-next-line default-case
                switch (chosenType) {
                    case "application/javascript": {
                        fetchErrorHandler = adaptErrorHandlerToFetch(JsonpErrorHandler());

                        break;
                    }
                    case "application/json": {
                        fetchErrorHandler = adaptErrorHandlerToFetch(JsonErrorHandler());

                        break;
                    }
                    case "application/problem+json": {
                        fetchErrorHandler = adaptErrorHandlerToFetch(ProblemErrorHandler);

                        break;
                    }
                    case "application/vnd.api+json": {
                        fetchErrorHandler = adaptErrorHandlerToFetch(JsonapiErrorHandler);

                        break;
                    }
                    case "application/xml": {
                        fetchErrorHandler = adaptErrorHandlerToFetch(XmlErrorHandler());

                        break;
                    }
                    case "text/plain": {
                        fetchErrorHandler = adaptErrorHandlerToFetch(TextErrorHandler());

                        break;
                    }
                }
            }

            // Allow consumer overrides via regex
            for (const { handler, regex } of errorHandlers) {
                const headerString = accept ?? "";

                if (regex.test(headerString)) {
                    fetchErrorHandler = handler;
                    break;
                }
            }

            // Set expose property
            (error as Error & { expose: boolean }).expose = showTrace;

            return fetchErrorHandler(error, request);
        };

export default createFetchNegotiatedErrorHandler;
