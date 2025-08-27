import type { IncomingMessage, ServerResponse } from "node:http";

import { getReasonPhrase } from "http-status-codes";
import { toXML } from "jstoxml";

import type { ErrorHandler } from "./types";
import { addStatusCodeToResponse, setErrorHeaders } from "./utils";

export type XmlErrorBody = Record<string, unknown> | unknown[];

export type XmlErrorFormatter = (params: {
    error: Error;
    request: IncomingMessage;
    response: ServerResponse;
    reasonPhrase: string;
    statusCode: number;
}) => XmlErrorBody | Promise<XmlErrorBody>;

export type ToXmlOptions = {
    indent?: string;
    header?: string | boolean;
    attributeReplacements?: Record<string, string>;
    attributeFilter?: (key: string, value: unknown) => boolean;
    attributeExplicitTrue?: boolean;
    contentMap?: (content: string) => string;
    contentReplacements?: Record<string, string>;
    selfCloseTags?: boolean;
};

export type XmlErrorHandlerOptions = {
    formatter?: XmlErrorFormatter;
    // Deprecated: use toXml.header instead
    xmlHeader?: boolean;
    toXml?: ToXmlOptions;
};

export const xmlErrorHandler = (options: XmlErrorHandlerOptions = {}): ErrorHandler => {
    return async (error: Error, request: IncomingMessage, response: ServerResponse): Promise<void> => {
        addStatusCodeToResponse(response, error);

        setErrorHeaders(response, error);

        const statusCode = response.statusCode;
        const reasonPhrase = getReasonPhrase(statusCode) || "An error occurred";

        let payload: XmlErrorBody;
        if (options.formatter) {
            payload = await options.formatter({ error, request, response, reasonPhrase, statusCode });
        } else {
            const expose = (error as Error & { expose?: boolean }).expose;
            payload = {
                error: {
                    statusCode,
                    // eslint-disable-next-line perfectionist/sort-objects
                    name: reasonPhrase,
                    // eslint-disable-next-line perfectionist/sort-objects
                    message: (error as Error & { message?: string }).message || reasonPhrase,
                    ...(expose ? { stack: error.stack } : {}),
                },
            };
        }

        const xml = toXML(payload, {
            header: options.toXml?.header ?? options.xmlHeader ?? true,
            indent: options.toXml?.indent ?? "  ",
            ...(options.toXml?.attributeReplacements ? { attributeReplacements: options.toXml.attributeReplacements } : {}),
            ...(options.toXml?.attributeFilter ? { attributeFilter: options.toXml.attributeFilter } : {}),
            ...(options.toXml?.attributeExplicitTrue !== undefined
                ? { attributeExplicitTrue: options.toXml.attributeExplicitTrue }
                : {}),
            ...(options.toXml?.contentMap ? { contentMap: options.toXml.contentMap } : {}),
            ...(options.toXml?.contentReplacements ? { contentReplacements: options.toXml.contentReplacements } : {}),
            ...(options.toXml?.selfCloseTags !== undefined ? { selfCloseTags: options.toXml.selfCloseTags } : {}),
        });

        response.setHeader("content-type", "application/xml; charset=utf-8");
        response.end(xml);
    };
};

export default xmlErrorHandler;


