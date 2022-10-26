import type { NextHandler } from "@visulima/connect";
import type { IncomingHttpHeaders } from "node:http";
import { IncomingMessage } from "node:http";

const exceptionsList = [
    "ALPN",
    "C-PEP",
    "C-PEP-Info",
    "CalDAV-Timezones",
    "Content-ID",
    "Content-MD5",
    "DASL",
    "DAV",
    "DNT",
    "ETag",
    "GetProfile",
    "HTTP2-Settings",
    "Last-Event-ID",
    "MIME-Version",
    "Optional-WWW-Authenticate",
    "Sec-WebSocket-Accept",
    "Sec-WebSocket-Extensions",
    "Sec-WebSocket-Key",
    "Sec-WebSocket-Protocol",
    "Sec-WebSocket-Version",
    "SLUG",
    "TCN",
    "TE",
    "TTL",
    "WWW-Authenticate",
    "X-ATT-DeviceId",
    "X-DNSPrefetch-Control",
    "X-UIDH",
];

const exceptions = exceptionsList.reduce((accumulator: { [key: string]: string }, current: string) => {
    accumulator[current.toLowerCase()] = current;

    return accumulator;
}, {});

const normalizeHeaderKey = (key: string, canonical: boolean) => {
    const lowerCaseKey = key.toLowerCase();

    if (!canonical) {
        return lowerCaseKey;
    }

    if (exceptions[lowerCaseKey]) {
        return exceptions[lowerCaseKey];
    }

    return (
        lowerCaseKey
            .split("-")
            // eslint-disable-next-line no-unsafe-optional-chaining
            .map((text) => text[0]?.toUpperCase() + text.slice(1))
            .join("-")
    );
};

const defaults = {
    canonical: false,
    normalizeHeaderKey,
};

const httpHeaderNormalizerMiddleware = (options_?: { canonical?: boolean; normalizeHeaderKey?: (key: string, canonical: boolean) => string }) => {
    const options = { ...defaults, ...options_ };

    return async <Request extends IncomingMessage>(request: Request, _: any, next: NextHandler) => {
        if (request.headers) {
            const rawHeaders: IncomingHttpHeaders = {};
            const headers: IncomingHttpHeaders = {};

            Object.keys(request.headers).forEach((key) => {
                rawHeaders[key] = request.headers[key];
                const normalizedKey = options.normalizeHeaderKey(key, options.canonical);

                if (typeof normalizedKey !== "undefined") {
                    headers[normalizedKey] = request.headers[key];
                }
            });

            request.headers = headers;
            // @TODO at type `request.rawHeaders` to global scope
            // @ts-ignore
            request.rawHeaders = rawHeaders;
        }

        return next();
    };
};

export default httpHeaderNormalizerMiddleware;
