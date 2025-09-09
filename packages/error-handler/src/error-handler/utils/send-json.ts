import type { ServerResponse } from "node:http";

/**
 * Send `JSON` object
 * @param response response object
 * @param jsonBody of data
 * @param contentType optional content-type header value
 */
export const sendJson = (response: ServerResponse, jsonBody: unknown, contentType: string = "application/json; charset=utf-8"): void => {
    // Set header to provided or default content-type
    response.setHeader("content-type", contentType);

    response.end(JSON.stringify(jsonBody));
};
