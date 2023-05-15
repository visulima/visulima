import type { IncomingMessage, ServerResponse } from "node:http";
import { parse as urlParse } from "node:url";

type IncomingApiRequest<TApiRequest = IncomingMessage> = TApiRequest & {
    body?: any;
    query?: any;
};

export const jsonResponse = (response: ServerResponse, status: number, data?: unknown): void => {
    response.statusCode = status;
    response.setHeader("Content-Type", "application/json");
    response.end(data ? JSON.stringify(data) : "");
};

export const parseBody = async (request: IncomingApiRequest): Promise<any> => {
    if (request.body) {
        return request.body;
    }

    const buffers = [];

    // eslint-disable-next-line no-restricted-syntax
    for await (const chunk of request) {
        buffers.push(chunk);
    }

    const data = Buffer.concat(buffers).toString();

    return data ? JSON.parse(data) : null;
};

export const parseQuery = (request: IncomingApiRequest): unknown => {
    if (request.query) {
        return request.query;
    }

    return urlParse(request.url ?? "", true).query;
};

export const toHeaderCase = (string_: string): string => string_
    .toLowerCase()
    .replaceAll(/[^\s\w]/g, " ") // Remove all non-word characters
    .trimEnd() // Remove trailing spaces
    .replaceAll(/\s+|_/g, "-") // Replace multiple spaces or underline with a single hyphen
    .replaceAll(/\b\w/g, (c) => c.toUpperCase());
