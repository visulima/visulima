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
 * Reads the body from the request.
 * @param request request object
 * @param encoding encoding to use
 * @param limit optional limit on the size of the body
 */
export const readBody = (
    request: IncomingMessage,
    // eslint-disable-next-line default-param-last
    encoding: BufferEncoding = "utf8",
    limit: number | undefined,
): Promise<string> =>
    // eslint-disable-next-line compat/compat
    new Promise((resolve, reject) => {
        let body = "";

        request.setEncoding(encoding);
        // eslint-disable-next-line consistent-return
        request.on("data", (chunk) => {
            if (limit && body.length > limit) {
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
export const getHeader = (request: IncomingMessage, name: string, all = false): string => {
    const raw = request.headers?.[name.toLowerCase()];

    if (!raw || raw.length === 0) {
        return "";
    }

    return all ? raw.toString().trim() : getLastOne(Array.isArray(raw) ? raw : raw.split(",")).trim();
};

/**
 * Reads the body of the incoming metadata request and parses it as JSON.
 * @param request incoming metadata request
 * @param limit optional limit on the size of the body
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
export const appendHeader = (response: ServerResponse, name: string, value: OutgoingHttpHeader): void => {
    const s = [response.getHeader(name), value].flat().filter(Boolean).toString();

    response.setHeader(name, s);
};

/**
 * Sets the value of a specific header of an HTTP response.
 */
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
 * Extracts host with port from a http or https request.
 */
export const extractHost = (request: IncomingMessage & { host?: string; hostname?: string }): string =>
    getHeader(request, "host") || getHeader(request, "x-forwarded-host");
// return req.host || req.hostname || getHeader(req, 'host'); // for express v5 / fastify

/**
 * Extracts protocol from a http or https request.
 */
export const extractProto = (request: IncomingMessage): string => getHeader(request, "x-forwarded-proto").toLowerCase();

/**
 * Try build a protocol:hostname:port string from a request object.
 */
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
        async (file: T) => {
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
export const normalizeOnErrorResponse = (callback: (error: HttpError) => UploadResponse) => (error: HttpError) => {
    if (isRecord(error)) {
        const { body, headers, statusCode, ...rest } = error;

        return callback({ body: body ?? (rest as HttpErrorBody), headers, statusCode });
    }

    return callback({ body: error ?? "unknown error", statusCode: 500 });
};

/**
 * @internal
 */
export const getRealPath = (request: IncomingMessage & { originalUrl?: string }): string => {
    // Exclude the query params from the path
    const realPath = ((request.originalUrl || request.url) as string).split("?")[0];

    if (!realPath) {
        throw new TypeError("Path is undefined");
    }

    return realPath;
};

/**
 * @internal
 */
export const uuidRegex = /(?:[\dA-Z]+-){2}[\dA-Z]+/i;

/**
 * @internal
 */
export const getIdFromRequest = (request: IncomingMessage & { originalUrl?: string }): string => {
    const pathMatch = filePathUrlMatcher(getRealPath(request));

    if (pathMatch && pathMatch.params.uuid && uuidRegex.test(pathMatch.params.uuid)) {
        return pathMatch.params.uuid;
    }

    throw new Error("Id is undefined");
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
