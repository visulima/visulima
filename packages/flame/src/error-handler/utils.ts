import type { ServerResponse } from "node:http";

import type { HttpError } from "http-errors";
import { StatusCodes } from "http-status-codes";

export const setErrorHeaders = (response: ServerResponse, error: unknown): void => {
    const headers: Record<string, ReadonlyArray<string> | number | string> = (error as HttpError).headers ?? {};

    Object.keys(headers).forEach((header: string) => {
        response.setHeader(header, headers[header] as ReadonlyArray<string> | number | string);
    });
};

/**
 * Send `JSON` object
 * @param response response object
 * @param jsonBody of data
 */
export const sendJson = (response: ServerResponse, jsonBody: unknown): void => {
    // Set header to application/json
    response.setHeader("content-type", "application/json; charset=utf-8");

    response.end(JSON.stringify(jsonBody));
};

export const addStatusCodeToResponse = (response: ServerResponse, error: unknown): void => {
    const err = error as Partial<HttpError>;
    const candidate = Number(
        err.statusCode ?? err.status,
    );
    if (Number.isInteger(candidate) && candidate >= 400 && candidate <= 599) {
        response.statusCode = candidate;
        return;
    }
    if (response.statusCode < 400) {
        response.statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
    }
};


