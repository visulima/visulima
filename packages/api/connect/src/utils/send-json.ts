import type { ServerResponse } from "node:http";

/**
 * Send `JSON` object
 * @param response response object
 * @param statusCode
 * @param jsonBody of data
 */
const sendJson = (response: ServerResponse, statusCode: number, jsonBody: unknown): void => {
    // Set header to application/json
    response.setHeader("content-type", "application/json; charset=utf-8");

    response.statusCode = statusCode;
    response.end(JSON.stringify(jsonBody, null, 2));
};

export default sendJson;
