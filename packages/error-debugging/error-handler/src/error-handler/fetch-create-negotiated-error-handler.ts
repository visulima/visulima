import type { IncomingMessage, ServerResponse } from "node:http";

import { jsonErrorHandler } from "./json-error-handler";
import { jsonpErrorHandler } from "./jsonp-error-handler";
import problemErrorHandler from "./problem-error-handler";
import { textErrorHandler } from "./text-error-handler";
import type { ErrorHandler, FetchErrorHandlers } from "./types";

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
//
// Client q-values are honoured: among the server's supported types, the one the
// client weighted highest wins, so `Accept: text/html;q=0.1, application/json`
// returns JSON — matching the q-value-aware `@tinyhttp/accepts` node path. Ties
// fall back to the server's preference order.
// eslint-disable-next-line sonarjs/cognitive-complexity -- linear negotiation pass; splitting hurts readability
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

    // Highest client quality for a given candidate media type, or -1 when the
    // client does not accept it at all.
    const qualityFor = (candidate: string): number => {
        const [candidateType, candidateSubtype] = candidate.split("/");

        let best = -1;

        for (const { quality, subtype, type } of accepted) {
            const wildcardAll = type === "*" && subtype === "*";
            const wildcardSubtype = type === candidateType && subtype === "*";
            const exact = type === candidateType && subtype === candidateSubtype;

            if ((wildcardAll || wildcardSubtype || exact) && quality > best) {
                best = quality;
            }
        }

        return best;
    };

    let chosenType = "text/html";
    let chosenQuality = -1;

    // Iterate in server-preference order so equal-quality candidates keep the
    // server's ordering (the later entry only wins on a strictly higher q-value).
    for (const { chosen, types } of serverPreferences) {
        let preferenceQuality = -1;

        for (const type of types) {
            const quality = qualityFor(type);

            if (quality > preferenceQuality) {
                preferenceQuality = quality;
            }
        }

        if (preferenceQuality > chosenQuality) {
            chosenQuality = preferenceQuality;
            chosenType = chosen;
        }
    }

    return chosenQuality < 0 ? "text/html" : chosenType;
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

// These node formatters take no options, so both the formatter and its fetch
// adapter are pure and instantiated once at module load rather than per request.
const fetchJsonpHandler = adaptErrorHandlerToFetch(jsonpErrorHandler());
const fetchJsonHandler = adaptErrorHandlerToFetch(jsonErrorHandler());
const fetchProblemHandler = adaptErrorHandlerToFetch(problemErrorHandler);
const fetchTextHandler = adaptErrorHandlerToFetch(textErrorHandler());

type FetchErrorHandler = (error: Error, request: Request) => Promise<Response>;

// The JSON:API and XML formatters pull in `ts-japi` and `jstoxml`. They are
// loaded (and adapted to Fetch) lazily, only when a request actually negotiates
// one of those content types, so JSON-only edge/worker consumers never pay the
// startup cost of parsing those libraries. The adapted singleton is memoised.
let fetchJsonapiHandlerPromise: Promise<FetchErrorHandler> | undefined;
let fetchXmlHandlerPromise: Promise<FetchErrorHandler> | undefined;

const loadFetchJsonapiHandler = async (): Promise<FetchErrorHandler> => {
    fetchJsonapiHandlerPromise ??= import("./jsonapi-error-handler").then((module) => adaptErrorHandlerToFetch(module.default));

    return fetchJsonapiHandlerPromise;
};

const loadFetchXmlHandler = async (): Promise<FetchErrorHandler> => {
    fetchXmlHandlerPromise ??= import("./xml-error-handler").then((module) => adaptErrorHandlerToFetch(module.xmlErrorHandler()));

    return fetchXmlHandlerPromise;
};

/**
 * Apply the `expose` flag without permanently mutating the caller's error
 * object; the original state is restored once the handler resolves. See the
 * node twin in `create-negotiated-error-handler.ts` for the rationale.
 */
const withExpose = async (error: Error, showTrace: boolean, run: () => Promise<Response>): Promise<Response> => {
    const hadOwnExpose = Object.hasOwn(error, "expose");
    const previousExpose = (error as Error & { expose?: boolean }).expose;

    if (!showTrace) {
        // eslint-disable-next-line no-param-reassign -- enriching the passed-in error
        (error as Error & { expose: boolean }).expose = false;
    } else if (!("expose" in error)) {
        // eslint-disable-next-line no-param-reassign -- enriching the passed-in error
        (error as Error & { expose: boolean }).expose = true;
    }

    try {
        return await run();
    } finally {
        if (hadOwnExpose) {
            // eslint-disable-next-line no-param-reassign -- restoring the passed-in error
            (error as Error & { expose?: boolean }).expose = previousExpose;
        } else {
            // eslint-disable-next-line no-param-reassign -- restoring the passed-in error
            delete (error as Error & { expose?: boolean }).expose;
        }
    }
};

const createFetchNegotiatedErrorHandler
    = (errorHandlers: FetchErrorHandlers, showTrace: boolean, defaultHtmlHandler?: (error: Error, request: Request) => Promise<Response>) =>
        async (error: Error, request: Request): Promise<Response> => {
            const accept = request.headers.get("accept");
            const chosenType = negotiateContentType(accept);

            let fetchErrorHandler: (error: Error, request: Request) => Promise<Response> = defaultHtmlHandler ?? fetchProblemHandler;

            // Convert node handlers to fetch handlers
            if (chosenType === "text/html" && defaultHtmlHandler) {
                fetchErrorHandler = defaultHtmlHandler;
            } else {
                switch (chosenType) {
                    case "application/javascript": {
                        fetchErrorHandler = fetchJsonpHandler;

                        break;
                    }
                    case "application/json": {
                        fetchErrorHandler = fetchJsonHandler;

                        break;
                    }
                    case "application/problem+json": {
                        fetchErrorHandler = fetchProblemHandler;

                        break;
                    }
                    case "application/vnd.api+json": {
                        fetchErrorHandler = await loadFetchJsonapiHandler();

                        break;
                    }
                    case "application/xml": {
                        fetchErrorHandler = await loadFetchXmlHandler();

                        break;
                    }
                    case "text/plain": {
                        fetchErrorHandler = fetchTextHandler;

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

            return withExpose(error, showTrace, () => fetchErrorHandler(error, request));
        };

export default createFetchNegotiatedErrorHandler;
