import type { IncomingMessage, ServerResponse } from "node:http";

import { getReasonPhrase } from "http-status-codes";
import { toXML } from "jstoxml";

import type { ErrorHandler } from "./types";
import { addStatusCodeToResponse } from "./utils/add-status-code-to-response";
import setErrorHeaders from "./utils/set-error-headers";

export type XmlErrorBody = Record<string, unknown> | unknown[];

export type XmlErrorFormatter = (parameters: {
    error: Error;
    reasonPhrase: string;
    request: IncomingMessage;
    response: ServerResponse;
    statusCode: number;
}) => XmlErrorBody | Promise<XmlErrorBody>;

export type ToXmlOptions = {
    attributeExplicitTrue?: boolean;
    attributeFilter?: (key: string, value: unknown) => boolean;
    attributeReplacements?: Record<string, string>;
    contentMap?: (content: string) => string;
    contentReplacements?: Record<string, string>;
    header?: string | boolean;
    indent?: string;
    selfCloseTags?: boolean;
};

export type XmlErrorHandlerOptions = {
    formatter?: XmlErrorFormatter;
    toXml?: ToXmlOptions;
    // Deprecated: use toXml.header instead
    xmlHeader?: boolean;
};

export const xmlErrorHandler
    = (options: XmlErrorHandlerOptions = {}): ErrorHandler =>
        async (error: Error, request: IncomingMessage, response: ServerResponse): Promise<void> => {
            addStatusCodeToResponse(response, error);

            setErrorHeaders(response, error);

            const { statusCode } = response;
            const reasonPhrase = getReasonPhrase(statusCode) || "An error occurred";

            let payload: XmlErrorBody;

            if (options.formatter) {
                payload = await options.formatter({ error, reasonPhrase, request, response, statusCode });
            } else {
                const { expose } = error as Error & { expose?: boolean };

                payload = {
                    error: {
                        statusCode,
                        // eslint-disable-next-line perfectionist/sort-objects
                        name: reasonPhrase,
                        // eslint-disable-next-line perfectionist/sort-objects
                        message: (error as Error & { message?: string }).message || reasonPhrase,
                        ...expose ? { stack: error.stack } : {},
                    },
                };
            }

            const xml = toXML(payload, {
                header: options.toXml?.header ?? options.xmlHeader ?? true,
                indent: options.toXml?.indent ?? "  ",
                ...options.toXml?.attributeReplacements ? { attributeReplacements: options.toXml.attributeReplacements } : {},
                ...options.toXml?.attributeFilter ? { attributeFilter: options.toXml.attributeFilter } : {},
                ...options.toXml?.attributeExplicitTrue === undefined ? {} : { attributeExplicitTrue: options.toXml.attributeExplicitTrue },
                ...options.toXml?.contentMap ? { contentMap: options.toXml.contentMap } : {},
                ...options.toXml?.contentReplacements ? { contentReplacements: options.toXml.contentReplacements } : {},
                ...options.toXml?.selfCloseTags === undefined ? {} : { selfCloseTags: options.toXml.selfCloseTags },
            });

            response.setHeader("content-type", "application/xml; charset=utf-8");
            response.end(xml);
        };
