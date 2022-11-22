import { StatusCodes } from "http-status-codes";
import type { ServerResponse } from "node:http";

export const setErrorHeaders = (response: ServerResponse, error: any) => {
    const headers: { [key: string]: number | string | ReadonlyArray<string> } = error.headers || {};

    Object.keys(headers).forEach((header: string) => {
        response.setHeader(header, headers[header] as number | string | ReadonlyArray<string>);
    });
};

/**
 * Send `JSON` object
 * @param response response object
 * @param jsonBody of data
 */
export const sendJson = (response: ServerResponse, jsonBody: any): void => {
    // Set header to application/json
    response.setHeader("content-type", "application/json; charset=utf-8");

    response.end(JSON.stringify(jsonBody));
};

export const addStatusCodeToResponse = (response: ServerResponse, error: any): void => {
    // respect err.statusCode
    if (error.statusCode !== undefined) {
        response.statusCode = error.statusCode;
    }

    // respect err.status
    if (error.status !== undefined) {
        response.statusCode = error.status;
    }

    // default status code to 500
    if (response.statusCode < 400) {
        response.statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
    }
};
