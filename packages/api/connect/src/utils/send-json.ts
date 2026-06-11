import type { ServerResponse } from "node:http";

/**
 * Send `JSON` object.
 * @param response Response object.
 * @param statusCode The HTTP status code.
 * @param jsonBody The body of data.
 */
const sendJson = (response: ServerResponse, statusCode: number, jsonBody: unknown): void => {
    // Set header to application/json
    response.setHeader("content-type", "application/json; charset=utf-8");

    response.statusCode = statusCode;
    // Emit compact JSON (no indentation) — pretty-printing inflates payload size and CPU on a hot path.
    response.end(JSON.stringify(jsonBody));
};

export default sendJson;
