import type { IncomingMessage, ServerResponse } from "node:http";

import JsonapiErrorHandler from "./jsonapi-error-handler";
import ProblemErrorHandler from "./problem-error-handler";
import { textErrorHandler as TextErrorHandler } from "./text-error-handler";
import { jsonErrorHandler as JsonErrorHandler } from "./json-error-handler";
import { jsonpErrorHandler as JsonpErrorHandler } from "./jsonp-error-handler";
import { xmlErrorHandler as XmlErrorHandler } from "./xml-error-handler";
import type { ErrorHandler, FetchErrorHandlers } from "./types";
import { extractStatusCode } from "./utils/extract-status-code";
import { sendFetchJson } from "./utils/send-fetch-json";

// Simple content type negotiation for fetch (without @tinyhttp/accepts dependency)
const negotiateContentType = (acceptHeader: string | null): string => {
    if (!acceptHeader) return "text/html";

    const accept = acceptHeader.toLowerCase();

    // Server preference order (same as node version)
    if (accept.includes("text/html")) return "text/html";
    if (accept.includes("application/vnd.api+json")) return "application/vnd.api+json";
    if (accept.includes("application/problem+json")) return "application/problem+json";
    if (accept.includes("application/json")) return "application/json";
    if (accept.includes("text/plain")) return "text/plain";
    if (accept.includes("application/javascript") || accept.includes("text/javascript")) return "application/javascript";
    if (accept.includes("application/xml") || accept.includes("text/xml")) return "application/xml";

    return "text/html"; // default
};

// Adapter to convert node-style error handler to fetch-style
const adaptErrorHandlerToFetch = (nodeHandler: ErrorHandler) => {
    return async (error: unknown, request: Request): Promise<Response> => {
        // Create mock request/response for the node handler
        const mockReq = {
            url: request.url,
            method: request.method,
            headers: Object.fromEntries(request.headers.entries()),
        } as IncomingMessage;

        const mockRes = {
            statusCode: 200,
            headers: {} as Record<string, string | number | string[]>,
            _body: "",
            setHeader(name: string, value: string | number | string[]): void {
                this.headers[name.toLowerCase()] = value;
            },
            getHeader(name: string): string | number | string[] | undefined {
                return this.headers[name.toLowerCase()];
            },
            getHeaders(): Record<string, string | number | string[]> {
                return { ...this.headers };
            },
            writeHead(statusCode: number): void {
                this.statusCode = statusCode;
            },
            write(chunk: string | Buffer): void {
                this._body += chunk.toString();
            },
            end(data?: string | Buffer): void {
                if (data) {
                    this._body += data.toString();
                }
            },
            flushHeaders(): void {},
        } as ServerResponse & { _body: string };

        // Call the node handler
        await nodeHandler(error, mockReq, mockRes);

        // Convert to fetch Response
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(mockRes.headers)) {
            if (Array.isArray(value)) {
                headers[key] = value.join(", ");
            } else {
                headers[key] = String(value);
            }
        }

        return new Response(mockRes._body, {
            status: mockRes.statusCode,
            headers,
        });
    };
};

const createFetchNegotiatedErrorHandler = (
    errorHandlers: FetchErrorHandlers,
    showTrace: boolean,
    defaultHtmlHandler?: (error: Error, request: Request) => Promise<Response>,
) => async (error: Error, request: Request): Promise<Response> => {
    const accept = request.headers.get("accept");
    const chosenType = negotiateContentType(accept);

    let fetchErrorHandler: (error: Error, request: Request) => Promise<Response> = defaultHtmlHandler || adaptErrorHandlerToFetch(ProblemErrorHandler);

    // Convert node handlers to fetch handlers
    if (chosenType === "text/html" && defaultHtmlHandler) {
        fetchErrorHandler = defaultHtmlHandler;
    } else if (chosenType === "application/vnd.api+json") {
        fetchErrorHandler = adaptErrorHandlerToFetch(JsonapiErrorHandler);
    } else if (chosenType === "application/problem+json") {
        fetchErrorHandler = adaptErrorHandlerToFetch(ProblemErrorHandler);
    } else if (chosenType === "application/json") {
        fetchErrorHandler = adaptErrorHandlerToFetch(JsonErrorHandler());
    } else if (chosenType === "text/plain") {
        fetchErrorHandler = adaptErrorHandlerToFetch(TextErrorHandler());
    } else if (chosenType === "application/javascript") {
        fetchErrorHandler = adaptErrorHandlerToFetch(JsonpErrorHandler());
    } else if (chosenType === "application/xml") {
        fetchErrorHandler = adaptErrorHandlerToFetch(XmlErrorHandler());
    }

    // Allow consumer overrides via regex
    for (const { handler, regex } of errorHandlers) {
        const headerStr = accept ?? "";
        if (regex.test(headerStr)) {
            fetchErrorHandler = handler;
            break;
        }
    }

    // Set expose property
    (error as Error & { expose: boolean }).expose = showTrace;

    return fetchErrorHandler(error, request);
};

export default createFetchNegotiatedErrorHandler;
