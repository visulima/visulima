import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";

import type { NextHandler, ValueOrPromise } from "@visulima/connect";

const exceptions = {
    alpn: "ALPN",
    "c-pep": "C-PEP",
    "c-pep-info": "C-PEP-Info",
    "caldav-timezones": "CalDAV-Timezones",
    "content-id": "Content-ID",
    "content-md5": "Content-MD5",
    dasl: "DASL",
    dav: "DAV",
    dnt: "DNT",
    etag: "ETag",
    getprofile: "GetProfile",
    "http2-settings": "HTTP2-Settings",
    "last-event-id": "Last-Event-ID",
    "mime-version": "MIME-Version",
    "optional-www-authenticate": "Optional-WWW-Authenticate",
    "sec-websocket-accept": "Sec-WebSocket-Accept",
    "sec-websocket-extensions": "Sec-WebSocket-Extensions",
    "sec-webSocket-key": "Sec-WebSocket-Key",
    "sec-webSocket-protocol": "Sec-WebSocket-Protocol",
    "sec-webSocket-version": "Sec-WebSocket-Version",
    slug: "SLUG",
    tcn: "TCN",
    te: "TE",
    ttl: "TTL",
    "www-authenticate": "WWW-Authenticate",
    "x-att-deviceid": "X-ATT-DeviceId",
    "x-dnsprefetch-control": "X-DNSPrefetch-Control",
    "x-uidh": "X-UIDH",
};

const normalizeHeaderKey = (key: string, canonical: boolean) => {
    const lowerCaseKey = key.toLowerCase();

    if (!canonical) {
        return lowerCaseKey;
    }

    if (exceptions[lowerCaseKey as keyof typeof exceptions]) {
        return exceptions[lowerCaseKey as keyof typeof exceptions];
    }

    return (
        lowerCaseKey
            .split("-")
            // eslint-disable-next-line no-unsafe-optional-chaining
            .map((text: string) => text[0]?.toUpperCase() + text.slice(1))
            .join("-")
    );
};

const defaults = {
    canonical: false,
    normalizeHeaderKey,
};

/**
 * HTTP headers are case-insensitive.
 * That's why NodeJS makes them lower case by default.
 * While sensible, sometimes, for example for compatibility reasons, you might need them in their more common form.
 */
const httpHeaderNormalizerMiddleware = (options_?: {
    canonical?: boolean;
    normalizeHeaderKey?: (key: string, canonical: boolean) => string;
}): (request: IncomingMessage, response: ServerResponse, next: NextHandler) => ValueOrPromise<void> => {
    const options = { ...defaults, ...options_ };

    return async <Request extends IncomingMessage>(request: Request, _: any, next: NextHandler) => {
        const rawHeaders: IncomingHttpHeaders = {};
        const headers: IncomingHttpHeaders = {};

        Object.keys(request.headers).forEach((key) => {
            rawHeaders[key] = request.headers[key];

            const normalizedKey = options.normalizeHeaderKey(key, options.canonical);

            if (normalizedKey) {
                headers[normalizedKey] = request.headers[key];
            }
        });

        request.headers = headers;
        // @TODO at type `request.rawHeaders` to global scope
        // @ts-expect-error - `rawHeaders` is not a property of `Request`
        request.rawHeaders = rawHeaders;

        return next();
    };
};

export default httpHeaderNormalizerMiddleware;
