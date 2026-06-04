import type { IncomingMessage, ServerResponse } from "node:http";

import { jsonErrorHandler as JsonErrorHandler } from "./json-error-handler";
import JsonapiErrorHandler from "./jsonapi-error-handler";
import { jsonpErrorHandler as JsonpErrorHandler } from "./jsonp-error-handler";
import ProblemErrorHandler from "./problem-error-handler";
import { textErrorHandler as TextErrorHandler } from "./text-error-handler";
import type { ErrorHandler, FetchErrorHandlers } from "./types";
import { xmlErrorHandler as XmlErrorHandler } from "./xml-error-handler";

type HeaderValue = string | number | string[];

// Mock ServerResponse for fetch handler
class MockServerResponse {
    public statusCode: number = 200;

    public headers: Record<string, HeaderValue> = {};

    public responseBody: string = "";

    public setHeader(name: string, value: HeaderValue): void {
        this.headers[name.toLowerCase()] = value;
    }

    public getHeader(name: string): HeaderValue | undefined {
        return this.headers[name.toLowerCase()];
    }

    public getHeaders(): Record<string, HeaderValue> {
        return { ...this.headers };
    }

    public writeHead(statusCode: number): void {
        this.statusCode = statusCode;
    }

    public write(chunk: string | Buffer): void {
        this.responseBody += chunk.toString();
    }

    public end(data?: string | Buffer): void {
        if (data) {
            this.responseBody += data.toString();
        }
    }

    // eslint-disable-next-line class-methods-use-this
    public flushHeaders(): void {}
}

// Server preference order (same as the @tinyhttp/accepts node path). Each entry
// maps the chosen response type to the set of acceptable media types.
const serverPreferences: { chosen: string; types: string[] }[] = [
    { chosen: "text/html", types: ["text/html"] },
    { chosen: "application/vnd.api+json", types: ["application/vnd.api+json"] },
    { chosen: "application/problem+json", types: ["application/problem+json"] },
    { chosen: "application/json", types: ["application/json"] },
    { chosen: "text/plain", types: ["text/plain"] },
    { chosen: "application/javascript", types: ["application/javascript", "text/javascript"] },
    { chosen: "application/xml", types: ["application/xml", "text/xml"] },
];

// Content type negotiation for fetch (without the @tinyhttp/accepts dependency).
// Parses the Accept header into (media type, q-value) pairs, drops entries with
// q=0, and matches against the server preference order using full media-type
// comparison (plus `*/*` and `type/*` wildcards) rather than substring includes.
const negotiateContentType = (acceptHeader: string | null): string => {
    if (!acceptHeader) {
        return "text/html";
    }

    const accepted: { quality: number; subtype: string; type: string }[] = [];

    for (const part of acceptHeader.split(",")) {
        const [rawType, ...parameters] = part.trim().split(";");
        const mediaType = (rawType ?? "").trim().toLowerCase();

        if (mediaType === "") {
            continue;
        }

        let quality = 1;

        for (const parameter of parameters) {
            const [key, rawValue] = parameter.trim().split("=");

            if ((key ?? "").trim().toLowerCase() === "q") {
                const parsed = Number.parseFloat((rawValue ?? "").trim());

                if (!Number.isNaN(parsed)) {
                    quality = parsed;
                }
            }
        }

        if (quality <= 0) {
            continue;
        }

        const [type = "", subtype = ""] = mediaType.split("/");

        accepted.push({ quality, subtype, type });
    }

    if (accepted.length === 0) {
        return "text/html";
    }

    const matches = (candidate: string): boolean => {
        const [candidateType, candidateSubtype] = candidate.split("/");

        return accepted.some(({ subtype, type }) => {
            if (type === "*" && subtype === "*") {
                return true;
            }

            if (type === candidateType && subtype === "*") {
                return true;
            }

            return type === candidateType && subtype === candidateSubtype;
        });
    };

    for (const { chosen, types } of serverPreferences) {
        if (types.some((type) => matches(type))) {
            return chosen;
        }
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

            return new Response(mockResponse.responseBody, {
                headers,
                status: mockResponse.statusCode,
            });
        };

const createFetchNegotiatedErrorHandler
    = (errorHandlers: FetchErrorHandlers, showTrace: boolean, defaultHtmlHandler?: (error: Error, request: Request) => Promise<Response>) =>
        async (error: Error, request: Request): Promise<Response> => {
            const accept = request.headers.get("accept");
            const chosenType = negotiateContentType(accept);

            let fetchErrorHandler: (error: Error, request: Request) => Promise<Response> = defaultHtmlHandler ?? adaptErrorHandlerToFetch(ProblemErrorHandler);

            // Convert node handlers to fetch handlers
            if (chosenType === "text/html" && defaultHtmlHandler) {
                fetchErrorHandler = defaultHtmlHandler;
            } else {
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
                    default: {
                    // Use the default fetchErrorHandler already set above
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

            // When the caller opts out of traces (showTrace === false), honour that
            // explicitly and suppress traces regardless of the error's own expose flag.
            // When traces are requested, preserve an http-errors instance's own expose
            // semantics and only set the flag if the error does not already define it.
            if (!showTrace) {
                // eslint-disable-next-line no-param-reassign
                (error as Error & { expose: boolean }).expose = false;
            } else if (!("expose" in error)) {
                // eslint-disable-next-line no-param-reassign
                (error as Error & { expose: boolean }).expose = true;
            }

            return fetchErrorHandler(error, request);
        };

export default createFetchNegotiatedErrorHandler;
