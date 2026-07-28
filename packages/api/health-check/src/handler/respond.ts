import type { ServerResponse } from "node:http";

interface RespondOptions {
    /**
     * Response body to emit. Omit for an empty-body response.
     */
    body?: string;

    /**
     * Whether to set the `Content-Type: application/json` response header.
     * Defaults to `false`.
     */
    sendHeader?: boolean;

    /**
     * HTTP status code to set on the response.
     */
    statusCode: number;
}

/**
 * Emits a single HTTP response: sets the status code, optionally the JSON
 * content-type header, and ends the response with the given body.
 * @param response The Node HTTP response to write to.
 * @param options The computed status code, optional body and header flag.
 * @param options.body Response body to emit. Omit for an empty-body response.
 * @param options.sendHeader Whether to set the `Content-Type: application/json` header.
 * @param options.statusCode HTTP status code to set on the response.
 */
const respond = (response: ServerResponse, { body, sendHeader = false, statusCode }: RespondOptions): void => {
    response.statusCode = statusCode;

    if (sendHeader) {
        response.setHeader("Content-Type", "application/json");
    }

    response.end(body);
};

export default respond;
