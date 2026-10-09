import type { OutgoingHttpHeader, ServerResponse } from "node:http";
import { IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

import createHttpError from "http-errors";
import { hasBody, TypeIs } from "type-is";

import { BaseStorage } from "../storage/storage";
import getLastOne from "./primitives/get-last-one";
import type { Header, Headers, IncomingMessageWithBody } from "./types";

/**
 * Message of the 413 error raised when a request body exceeds its size limit.
 * @internal
 */
export const BODY_LIMIT_EXCEEDED_MESSAGE = "Request body length limit exceeded";

/**
 * Bytes past its limit that a refused body is still read and discarded for, so the client gets to
 * read the 413; a client sending more has its connection cut.
 * @internal
 */
export const MAX_DRAIN_BYTES = 4 * 1024 * 1024;

/**
 * Milliseconds a refused body is drained for before its connection is cut, so a slow or stalled
 * client can't hold it open.
 * @internal
 */
export const MAX_DRAIN_MS = 5000;

const jsonType = new TypeIs(["json"]);

const extractForwarded = (request: IncomingMessage): { host: string; proto: string } => {
    // Forwarded: by=<identifier>;for=<identifier>;host=<host>;proto=<http|https>
    let proto = "";
    let host = "";

    const header = getHeader(request, "forwarded", true);

    if (header) {
        // RFC 7239: the first element (closest to the client) of a comma-separated list; tokens are
        // case-insensitive, may be padded, and values may be quoted (a host with a port must be).
        const [first = ""] = header.split(",");

        for (const pair of first.split(";")) {
            const separator = pair.indexOf("=");

            if (separator !== -1) {
                const token = pair.slice(0, separator).trim().toLowerCase();
                const value = pair
                    .slice(separator + 1)
                    .trim()
                    .replace(/^"(.*)"$/u, "$1");

                if (token === "proto") {
                    proto = value.toLowerCase();
                } else if (token === "host") {
                    host = value;
                }
            }
        }
    }

    return { host, proto };
};

const drainingBodies = new WeakSet<Readable>();

/**
 * Reads and discards the rest of a request body nothing will read any more, so the client gets to
 * read the error response. Closing the connection while the client is still sending makes the kernel
 * answer with a reset, which on macOS and Windows drops the response before the client reads it; and
 * a consumed body left paused is never dumped by Node, leaving the connection stuck until a timeout.
 * Once drained, the connection stays usable for the next request. A client that sends more than
 * {@link MAX_DRAIN_BYTES} past this call, or for longer than {@link MAX_DRAIN_MS}, is cut off.
 * Calling it again for the same body is a no-op.
 * @internal
 * @param request Request whose body was abandoned mid-stream
 * @param socket The request's connection, needed for a request a reader already destroyed
 */
export const drainAbandonedBody = (request: Readable, socket?: Socket | null): void => {
    if (request.readableEnded || drainingBodies.has(request)) {
        return;
    }

    if (request.destroyed) {
        // pipeline() and for-await destroy a server request with its socket detached, so the response
        // can still be sent, but the HTTP parser then stops reading the socket. Mark the body dumped,
        // which makes the parser discard the rest (Node's own handling of an unread body, an internal
        // API), and resume the socket.
        if (!(request instanceof IncomingMessage) || request.complete || !socket || socket.destroyed) {
            return;
        }

        drainingBodies.add(request);
        (request as IncomingMessage & { _dump: () => void })._dump();
        socket.resume();

        // Only the time cap applies here: the parser reads the socket natively, so no byte passes
        // through this code to be counted.
        setTimeout(() => {
            if (!request.complete) {
                socket.destroy();
            }
        }, MAX_DRAIN_MS).unref();

        return;
    }

    drainingBodies.add(request);

    // Detach whatever was reading it (a pipe, a web stream adapter), which would otherwise keep
    // buffering the body or pause it again.
    request.unpipe();
    request.removeAllListeners("data");

    let drained = 0;
    const timer = setTimeout(() => request.destroy(), MAX_DRAIN_MS).unref();
    const stopTimer = (): void => {
        clearTimeout(timer);
    };

    request.on("data", (chunk: Buffer | string) => {
        drained += Buffer.byteLength(chunk);

        if (drained > MAX_DRAIN_BYTES) {
            request.destroy();
        }
    });
    request.once("close", stopTimer);
    request.once("end", stopTimer);
    request.resume();
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
        // Accumulate bytes (not characters) so the `limit` is enforced against the actual
        // payload size on the wire. Multi-byte UTF-8 sequences mean string `.length` undercounts
        // the byte total — a malicious client could send well over `limit` bytes that decode to
        // fewer characters and silently bypass the cap.
        const chunks: Buffer[] = [];
        let byteLength = 0;

        const onData = (chunk: Buffer | string): void => {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);

            byteLength += buf.length;

            if (limit !== undefined && byteLength > limit) {
                // Stop buffering, but drain the rest so the client gets to read the 413.
                request.off("end", onEnd);
                chunks.length = 0;
                drainAbandonedBody(request);
                reject(createHttpError(413, BODY_LIMIT_EXCEEDED_MESSAGE));

                return;
            }

            chunks.push(buf);
        };
        const onEnd = (): void => {
            resolve(Buffer.concat(chunks).toString(encoding));
        };

        request.on("data", onData);
        request.once("end", onEnd);
        request.once("error", reject);
    });

/**
 * Reads the body of a Web API request as text, enforcing a byte limit while streaming
 * so a missing or lying `Content-Length` cannot make the server buffer an unbounded body.
 * @internal
 * @param request Web API Request
 * @param limit Maximum body size in bytes
 * @returns The body decoded as UTF-8
 * @throws {HttpError} 413 when the body exceeds `limit`
 */
export const readWebRequestText = async (request: Request, limit: number): Promise<string> => {
    const declaredLength = Number(request.headers.get("content-length") ?? Number.NaN);

    if (Number.isFinite(declaredLength) && declaredLength > limit) {
        throw createHttpError(413, BODY_LIMIT_EXCEEDED_MESSAGE);
    }

    if (!request.body) {
        return "";
    }

    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let byteLength = 0;

    for (;;) {
        const { done, value } = await reader.read();

        if (done) {
            break;
        }

        byteLength += value.byteLength;

        if (byteLength > limit) {
            await reader.cancel();

            throw createHttpError(413, BODY_LIMIT_EXCEEDED_MESSAGE);
        }

        chunks.push(value);
    }

    return Buffer.concat(chunks).toString("utf8");
};

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

    if (all) {
        return raw.toString().trim();
    }

    const array = Array.isArray(raw) ? raw : raw.split(",");

    return getLastOne(array).trim();
};

/**
 * Extracts JSON metadata from an HTTP request body.
 * Parses the request body as JSON if the content type is 'application/json'.
 * @param request HTTP request with potential body data
 * @param limit Maximum body size limit in bytes (default: 16MB)
 * @returns Parsed metadata object, or empty object if not JSON
 */
export const getMetadata = async (request: IncomingMessageWithBody<Record<string, unknown>>, limit = 16_777_216): Promise<Record<string, unknown>> => {
    if (jsonType.request(request) === undefined) {
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

    return { ...(JSON.parse(raw) as Record<string, unknown>) };
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
            // `encodeURI` preserves `#` and `?` because they are URI reserved characters. That is
            // correct when the input is a fully-formed URL, but we use this header to embed a file
            // id into a path — an id containing `#` or `?` would otherwise be silently reinterpreted
            // by clients as a fragment or query separator. Forcing them through `%`-encoding closes
            // that ambiguity. Legitimate query strings on Location targets already arrive
            // pre-formed; we only encode the literal chars that survived `encodeURI`. An escape the
            // value already carries (a percent-encoded request path) is kept, not encoded again.
            const encoded = encodeURI((headers[key] as Header).toString())
                .replaceAll(/%25(?=[\dA-F]{2})/giu, "%")
                .replaceAll("#", "%23");

            response.setHeader(key, encoded);
        } else {
            response.setHeader(key, headers[key] as Header);
        }
    });
};

/**
 * Extracts host with port from a HTTP or HTTPS request.
 * Uses the Host header, falling back to X-Forwarded-Host.
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
    // Prefer originalUrl (full path) over url (may be stripped by Express routing)
    const realPath = (((request.originalUrl || request.url) as string) || "").split("?")[0];

    if (!realPath) {
        throw new TypeError("Invalid request URL");
    }

    // An absolute-form request target (RFC 9112 §3.2.2, e.g. through a proxy): take its path
    if (/^https?:\/\//iu.test(realPath)) {
        return new URL(realPath).pathname;
    }

    // Ensure path starts with / for consistent parsing
    return realPath.startsWith("/") ? realPath : `/${realPath}`;
};

/**
 * Anchored ID matcher — requires the *entire* segment to be alphanumeric chunks joined by hyphens,
 * with at least three chunks, each chunk ≥ 4 characters. The previous unanchored pattern
 * `/(?:[\dA-Z]+-){2}[\dA-Z]+/i` matched a substring of *any* string containing two hyphens (e.g.
 * `a-b-c`), so it would happily pass `not_my_uuid_a-b-c_attack_payload`. Anchoring + a minimum
 * per-chunk length makes accidental matches near-impossible while still allowing canonical UUIDs
 * (8-4-4-4-12), content-addressable IDs, and similar formats this codebase uses.
 * @internal
 */
export const uuidRegex: RegExp = /^[\da-z]{4,}(?:-[\da-z]{4,}){2,}$/i;

/**
 * Path segments that are never treated as file IDs.
 * @internal
 */
export const COMMON_PATH_NAMES: ReadonlyArray<string> = ["files", "metadata", "upload", "download", "http-rest", "http-rest-chunked"];

/**
 * Drops a trailing `/metadata` or `/download` action segment, which addresses the id before it.
 * @param segments Non-empty path segments
 * @returns The segments without the action
 */
const withoutActionSegment = (segments: string[]): string[] =>
    segments.length >= 2 && ["download", "metadata"].includes(segments.at(-1) as string) ? segments.slice(0, -1) : segments;

/**
 * Validates an id taken from a URL path segment. The raw segment is the id, but its URL-decoded
 * form is checked too, so an encoded traversal such as `..%2F..%2Fetc` is rejected even if a
 * storage backend or proxy decodes the id later.
 * @internal
 * @param id Raw path segment
 * @throws {HttpError} 400 when the id is unsafe
 */
export const assertSafeUrlId = (id: string): void => {
    let decoded = id;

    try {
        decoded = decodeURIComponent(id);
    } catch {
        // Malformed escape sequences can't decode into a traversal; validate the raw id only
    }

    try {
        BaseStorage.assertSafeId(id);
        BaseStorage.assertSafeId(decoded);
    } catch {
        throw createHttpError(400, `Invalid file id: "${id}"`);
    }
};

/**
 * Extracts the file id from a Node request: the last path segment with its extension stripped, as
 * {@link getIdFromRequestUrl} reads it. An earlier "UUID-like" segment is never taken instead: a
 * mount path such as `/files-by-user` has that shape and would win over a nanoid id.
 * @internal
 * @param request HTTP request object
 * @returns The extracted identifier
 * @throws Error("Invalid request URL") if the path does not address a file
 * @throws {HttpError} 400 when the id is unsafe (path traversal, absolute path, …)
 */
export const getIdFromRequest = (request: IncomingMessage & { originalUrl?: string }): string => {
    const id = getIdFromRequestUrl(getRealPath(request), { stripExtension: true });

    if (!id) {
        throw new Error("Invalid request URL");
    }

    return id;
};

/**
 * Extracts a file identifier from the last path segment of a Web API request URL (Fetch handlers).
 * Unlike {@link getIdFromPath} there is no minimum length, so caller-chosen ids such as `asset01` work;
 * only a collection root (an empty path or a common path name such as `files`) yields `undefined`.
 * @internal
 * @param url Request URL
 * @param options.stripExtension Drop a trailing `.ext` (REST routes address files as `id.ext`)
 * @returns The extracted identifier, or `undefined` when the URL does not address a file
 * @throws {HttpError} 400 when the id is unsafe (path traversal, absolute path, …)
 */
export const getIdFromRequestUrl = (url: string, { stripExtension = false }: { stripExtension?: boolean } = {}): string | undefined => {
    let lastSegment: string | undefined;

    try {
        lastSegment = withoutActionSegment(new URL(url, "http://localhost").pathname.split("/").filter(Boolean)).at(-1);
    } catch {
        return undefined;
    }

    const id = stripExtension ? lastSegment?.replace(/\.[^.]+$/, "") : lastSegment;

    if (!id || COMMON_PATH_NAMES.includes(id.toLowerCase())) {
        return undefined;
    }

    assertSafeUrlId(id);

    return id;
};

/**
 * Converts a request to a Node.js Readable stream.
 * Handles both Node.js IncomingMessage and Web API Request objects.
 */
export const getRequestStream = (request: IncomingMessage | Request): Readable => {
    // Check if it's a Web API Request with ReadableStream body
    if ("body" in request && request.body && typeof (request.body as ReadableStream).getReader === "function") {
        // Web API ReadableStream - convert to Node.js Readable
        return Readable.fromWeb(request.body as unknown as NodeReadableStream);
    }

    // Check if request has body property with buffer data (converted Web API request)
    // This should be checked before instanceof Readable to prioritize body data
    if ("body" in request && request.body && request.body instanceof Uint8Array) {
        // Convert Uint8Array to Buffer for Readable.from to work correctly
        return Readable.from(Buffer.from(request.body));
    }

    // Node.js IncomingMessage - should be a Readable stream
    if (request instanceof Readable) {
        return request;
    }

    // Fallback - create an empty readable stream
    return Readable.from(new Uint8Array(0));
};
