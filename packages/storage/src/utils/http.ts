import type { IncomingMessage, OutgoingHttpHeader, ServerResponse } from "node:http";
import { Readable } from "node:stream";

import typeis, { hasBody } from "type-is";

import filePathUrlMatcher from "./file-path-url-matcher";
import getLastOne from "./primitives/get-last-one";
import isRecord from "./primitives/is-record";
import type { Header, Headers, HttpError, HttpErrorBody, IncomingMessageWithBody, UploadResponse } from "./types";

const extractForwarded = (request: IncomingMessage): { host: string; proto: string } => {
    // Forwarded: by=<identifier>;for=<identifier>;host=<host>;proto=<http|https>
    let proto = "";
    let host = "";

    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const header = getHeader(request, "forwarded");

    if (header) {
        const kvPairs = header.split(";");

        kvPairs.forEach((kv) => {
            const [token, value] = kv.split("=");

            if (token === "proto") {
                proto = value as string;
            }

            if (token === "host") {
                host = value as string;
            }
        });
    }

    return { host, proto };
};

/**
 * Reads the body of an HTTP request as a string with optional size limit.
 * @param request HTTP request object to read body from
 * @param encoding Text encoding to use (defaults to 'utf8')
 * @param limit Maximum body size in characters (throws error if exceeded)
 * @returns Promise resolving to the request body as a string
 */
export const readBody = (
    request: IncomingMessage,
    // eslint-disable-next-line default-param-last
    encoding: BufferEncoding = "utf8",
    limit: number | undefined,
): Promise<string> =>
    new Promise((resolve, reject) => {
        let body = "";

        request.setEncoding(encoding);
        // eslint-disable-next-line consistent-return
        request.on("data", (chunk) => {
            if (limit && body.length + chunk.length > limit) {
                return reject(new Error("Request body length limit exceeded"));
            }

            body += chunk;
        });
        request.once("end", () => resolve(body));
    });

/**
 * Retrieve the value of a specific header of an HTTP request.
 * @param request request object
 * @param name name of the header
 * @param all if true, returns  all values of the header, comma-separated, otherwise returns the last value.
 */

/**
 * Get a header value. If `all` is true, returns the comma-joined value.
 */
export const getHeader = (request: IncomingMessage, name: string, all = false): string => {
    const raw = request.headers?.[name.toLowerCase()];

    if (!raw || raw.length === 0) {
        return "";
    }

    return all ? raw.toString().trim() : getLastOne(Array.isArray(raw) ? raw : raw.split(",")).trim();
};

/**
 * Extracts JSON metadata from an HTTP request body.
 * Parses the request body as JSON if the content type is 'application/json'.
 * @param request HTTP request with potential body data
 * @param limit Maximum body size limit in bytes (default: 16MB)
 * @returns Parsed metadata object, or empty object if not JSON
 */
export const getMetadata = async (request: IncomingMessageWithBody<Record<any, any>>, limit = 16_777_216): Promise<Record<any, any>> => {
    if (!typeis(request, ["json"])) {
        return {};
    }

    if (request.body) {
        return { ...request.body };
    }

    if (hasBody(request)) {
        const bodySize = Number.parseInt(getHeader(request, "content-length"), 10);

        if (!Number.isNaN(bodySize) && bodySize > limit) {
            throw new Error("body length limit");
        }
    }

    const raw = await readBody(request, "utf8", limit);

    return { ...JSON.parse(raw) } as Record<any, any>;
};

/**
 * Appends value to the end of the multi-value header
 */
/** Append a value to a multi-valued response header. */
export const appendHeader = (response: ServerResponse, name: string, value: OutgoingHttpHeader): void => {
    const s = [response.getHeader(name), value].flat().filter(Boolean).toString();

    response.setHeader(name, s);
};

/**
 * Sets the value of a specific header of an HTTP response.
 */
/** Set multiple response headers and expose them for CORS. */
export const setHeaders = (response: ServerResponse, headers: Headers = {}): void => {
    const keys = Object.keys(headers);

    if (keys.length > 0) {
        appendHeader(response, "Access-Control-Expose-Headers", keys);
    }

    keys.forEach((key) => {
        if (["link", "location"].includes(key.toLowerCase())) {
            response.setHeader(key, encodeURI((headers[key] as Header).toString()));
        } else {
            response.setHeader(key, headers[key] as Header);
        }
    });
};

/**
 * Extracts host with port from a HTTP or HTTPS request.
 * Prefers x-forwarded-host header for proxy compatibility.
 * @param request HTTP request object
 * @returns Host string with port (e.g., "example.com:8080")
 */
export const extractHost = (request: IncomingMessage & { host?: string; hostname?: string }): string =>
    getHeader(request, "host") || getHeader(request, "x-forwarded-host");

/**
 * Extracts protocol from a HTTP or HTTPS request.
 * Prefers x-forwarded-proto header for proxy compatibility.
 * @param request HTTP request object
 * @returns Protocol string ('http' or 'https')
 */
export const extractProto = (request: IncomingMessage): string => getHeader(request, "x-forwarded-proto").toLowerCase();

/**
 * Try build a protocol:hostname:port string from a request object.
 */
/** Build protocol://host from an IncomingMessage using forwarded headers. */
export const getBaseUrl = (request: IncomingMessage): string => {
    let { host, proto } = extractForwarded(request);

    host ||= extractHost(request);
    proto ||= extractProto(request);

    if (!host) {
        return "";
    }

    return proto ? `${proto}://${host}` : `//${host}`;
};

export const normalizeHookResponse
    = <T>(callback: (file: T) => Promise<UploadResponse>) =>
        async (file: T): Promise<UploadResponse> => {
            const response = await callback(file);

            if (isRecord(response)) {
                const { body, headers, statusCode, ...rest } = response;

                return { body: body ?? rest, headers, statusCode };
            }

            return { body: response ?? "" };
        };

/**
 * @internal
 */
export const normalizeOnErrorResponse
    = (callback: (error: HttpError) => UploadResponse): (error: HttpError) => UploadResponse =>
        (error: HttpError): UploadResponse => {
            if (isRecord(error)) {
                const { body, headers, statusCode, ...rest } = error;

                return callback({ body: body ?? (rest as HttpErrorBody), headers, statusCode });
            }

            return callback({ body: error ?? "unknown error", statusCode: 500 });
        };

/**
 * Extracts the real path from a request URL, excluding query parameters.
 * Prefers originalUrl for Express compatibility.
 * @internal
 * @param request HTTP request object
 * @returns The path component of the URL without query parameters
 * @throws TypeError if path is undefined
 */
export const getRealPath = (request: IncomingMessage & { originalUrl?: string }): string => {
    // Exclude the query params from the path
    let realPath = ((request.originalUrl || request.url) as string).split("?")[0];

    // If it's an absolute URL, extract the pathname
    if (realPath.startsWith("http")) {
        const url = new URL(realPath);

        realPath = url.pathname;
    }

    if (!realPath) {
        throw new TypeError("Invalid request URL");
    }

    return realPath;
};

/**
 * @internal
 */
export const uuidRegex: RegExp = /(?:[\dA-Z]+-){2}[\dA-Z]+/i;

/**
 * Extracts a UUID identifier from the request URL path.
 * Uses regex pattern to match UUID-like strings in the URL.
 * @internal
 * @param request HTTP request object
 * @returns The extracted UUID identifier
 * @throws TypeError if no valid ID is found in the path
 */
export const getIdFromRequest = (request: IncomingMessage & { originalUrl?: string }): string => {
    const realPath = getRealPath(request);

    // Extract UUID from the path by finding the last UUID-like segment
    const segments = realPath.split("/").filter(Boolean);

    for (let index = segments.length - 1; index >= 0; index--) {
        const segment = segments[index];
        // Remove file extension if present
        const cleanSegment = segment.replace(/\.[^/.]+$/, "");

        if (uuidRegex.test(cleanSegment)) {
            return cleanSegment;
        }
    }

    throw new Error("Invalid request URL");
};

/**
 * Converts a request to a Node.js Readable stream.
 * Handles both Node.js IncomingMessage and Web API Request objects.
 */
export const getRequestStream = (request: IncomingMessage | Request): Readable => {
    // Check if it's a Web API Request with ReadableStream body
    if ("body" in request && request.body && typeof request.body.getReader === "function") {
        // Web API ReadableStream - convert to Node.js Readable
        return Readable.fromWeb(request.body as any);
    }

    // Node.js IncomingMessage - should be a Readable stream
    if (request instanceof Readable) {
        return request;
    }

    // Check if request has body property with buffer data (converted Web API request)
    if ("body" in request && request.body && request.body instanceof Uint8Array) {
        return Readable.from(request.body);
    }

    // Fallback - create an empty readable stream
    return Readable.from(new Uint8Array(0));
};
