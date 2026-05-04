import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";

type IncomingApiRequest<TApiRequest = IncomingMessage> = TApiRequest & {
    body?: unknown;
    query?: Record<string, unknown>;
};

const TRAILING_SLASH_REGEX = /\/$/u;

export const jsonResponse = (response: ServerResponse, status: number, data?: unknown): void => {
    response.statusCode = status;
    response.setHeader("Content-Type", "application/json");
    response.end(data ? JSON.stringify(data) : "");
};

export const parseBody = async (request: IncomingApiRequest): Promise<unknown> => {
    if (request.body) {
        return request.body;
    }

    const buffers = [];

    for await (const chunk of request) {
        buffers.push(chunk);
    }

    const data = Buffer.concat(buffers).toString();

    // eslint-disable-next-line unicorn/no-null -- null indicates "no body"; callers rely on this contract
    return data ? JSON.parse(data) : null;
};

export const parseQuery = (request: IncomingApiRequest): Record<string, unknown> => {
    if (request.query) {
        return request.query;
    }

    if (!request.url) {
        return {};
    }

    // Note: Fake protocol is required to parse query string
    const url = new URL(`https://${request.headers.host?.replace(TRAILING_SLASH_REGEX, "") ?? ""}/${request.url}`);

    return Object.fromEntries(url.searchParams.entries());
};

export const toHeaderCase = (string_: string): string =>
    string_
        .toLowerCase()
        .replaceAll(/[^\s\w]/gu, " ") // Remove all non-word characters
        .trimEnd() // Remove trailing spaces
        .replaceAll(/\s+|_/gu, "-") // Replace multiple spaces or underline with a single hyphen
        .replaceAll(/\b\w/gu, (c) => c.toUpperCase());
