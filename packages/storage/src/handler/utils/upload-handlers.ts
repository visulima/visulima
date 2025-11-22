import type { IncomingMessage, ServerResponse } from "node:http";
import type { Readable } from "node:stream";

import type { UploadFile } from "../../storage/utils/file";
import type { UploadError } from "../../utils/errors";
import pick from "../../utils/primitives/pick";
import type { IncomingMessageWithBody } from "../../utils/types";
import type { ResponseFile, ResponseList } from "../types";
import { convertHeadersToString } from "./response-builder";

/**
 * Handles HEAD/OPTIONS requests.
 * @param file Response file with headers and status code
 * @param send Function to send response
 */
export const handleHeadOptionsRequest = <TFile extends UploadFile, NodeResponse extends ServerResponse>(
    file: ResponseFile<TFile>,
    send: (response: NodeResponse, data: { headers: Record<string, string | number>; statusCode: number }) => void,
    response: NodeResponse,
): void => {
    const { headers, statusCode } = file;

    send(response, { headers, statusCode });
};

/**
 * Handles GET requests with streaming support.
 * @param file Response file (may contain stream)
 * @param request HTTP request
 * @param response HTTP response
 * @param next Optional Express next function
 * @param send Function to send regular response
 * @param sendStream Function to send stream response
 * @param parseRangeHeader Function to parse range header
 */
export const handleGetRequest = <TFile extends UploadFile, NodeResponse extends ServerResponse>(
    file: ResponseFile<TFile> | ResponseList<TFile>,
    request: IncomingMessage,
    response: NodeResponse,
    next: (() => void) | undefined,
    send: (response: NodeResponse, data: { body: Buffer | string | object; headers: Record<string, string | number>; statusCode: number }) => void,
    sendStream: (
        response: NodeResponse,
        stream: Readable,
        options: { headers: Record<string, string | number>; range?: { end: number; start: number }; size?: number; statusCode: number },
    ) => void,
    parseRangeHeader: (rangeHeader: string | undefined, fileSize: number) => { end: number; start: number } | undefined,
): void => {
    (request as IncomingMessageWithBody).body = (file as ResponseList<TFile>)?.data === undefined ? file : (file as ResponseList<TFile>).data;

    const { headers, statusCode } = file as ResponseFile<TFile>;

    // Check if this is a streaming response
    const streamingFile = file as ResponseFile<TFile> & { size?: number; stream?: Readable };

    if (streamingFile.stream) {
        // Handle streaming response
        if (typeof next === "function") {
            next();
        } else {
            // Parse range header for partial content requests
            const range = parseRangeHeader(request.headers.range, streamingFile.size || 0);

            // Stream the response directly
            sendStream(response, streamingFile.stream, {
                headers,
                range: range || undefined,
                size: streamingFile.size,
                statusCode,
            });
        }
    } else {
        // Handle regular buffer-based response
        let body: Buffer | ResponseList<TFile>["data"] | string = "";

        if ((file as ResponseFile<TFile>).content !== undefined) {
            body = (file as ResponseFile<TFile>).content as Buffer;
        } else if (typeof file === "object" && "data" in file) {
            body = file.data;
        }

        if (typeof next === "function") {
            next();
        } else {
            send(response, { body, headers, statusCode });
        }
    }
};

/**
 * Handles completed upload responses.
 * @param file Response file
 * @param request HTTP request
 * @param response HTTP response
 * @param next Optional Express next function
 * @param storage Storage instance for onComplete hook
 * @param logger Optional logger
 * @param finish Function to finish the response
 */
export const handleCompletedUpload = async <TFile extends UploadFile, NodeResponse extends ServerResponse>(
    file: ResponseFile<TFile>,
    request: IncomingMessage,
    response: NodeResponse,
    next: (() => void) | undefined,
    storage: { onComplete: (file: TFile, responseFile: ResponseFile<TFile>, request?: IncomingMessage) => void | Promise<void> },
    logger: { error?: (message: string, error: unknown) => void } | undefined,
    finish: (request: IncomingMessage, response: NodeResponse, uploadResponse: ResponseFile<TFile>) => void,
): Promise<void> => {
    const { headers: fileHeaders, statusCode, ...basicFile } = file;

    if (typeof next === "function") {
        // eslint-disable-next-line no-underscore-dangle
        (request as IncomingMessageWithBody)._body = true;
        (request as IncomingMessageWithBody).body = basicFile;

        next();
    } else {
        // onComplete modifies the response object directly
        const responseFile = file;

        // Preserve headers before calling onComplete (in case onComplete clears them)
        const originalHeaders = responseFile.headers ? { ...responseFile.headers } : {};

        // Ensure headers and statusCode exist before calling onComplete
        if (responseFile.headers === undefined) {
            responseFile.headers = {};
        }

        if (responseFile.statusCode === undefined) {
            responseFile.statusCode = 200;
        }

        try {
            const result = storage.onComplete(basicFile as TFile, responseFile, request);

            if (result instanceof Promise) {
                await result;
            }
        } catch (error) {
            logger?.error("[onComplete error]: %O", error);
            throw error;
        }

        // Restore headers if they were cleared by onComplete
        // Merge original headers with any modifications from onComplete
        if (Object.keys(responseFile.headers || {}).length === 0 && Object.keys(originalHeaders).length > 0) {
            responseFile.headers = originalHeaders;
        } else if (responseFile.headers && Object.keys(originalHeaders).length > 0) {
            // Merge original headers with onComplete modifications (original takes precedence for critical headers)
            responseFile.headers = {
                ...originalHeaders,
                ...responseFile.headers,
            };
        }

        finish(request, response, responseFile);
    }
};

/**
 * Handles partial upload responses.
 * @param file Response file
 * @param request HTTP request
 * @param response HTTP response
 * @param send Function to send response
 */
export const handlePartialUpload = <TFile extends UploadFile, NodeResponse extends ServerResponse>(
    file: ResponseFile<TFile>,
    request: IncomingMessage,
    response: NodeResponse,
    send: (response: NodeResponse, data: { body: Buffer | string | undefined; headers: Record<string, string>; statusCode: number }) => void,
): void => {
    const { headers: fileHeaders, statusCode, ...basicFile } = file;
    // Preserve headers from the file response
    const headers = fileHeaders || {};

    // Check if this is a chunked upload initialization (has X-Chunked-Upload header)
    const isChunkedUploadInit = headers["X-Chunked-Upload"] === "true" || headers["x-chunked-upload"] === "true";

    // For chunked upload initialization, include body in response
    let body: Buffer | string | undefined;

    // Merge fileHeaders (from ResponseFile) with request headers, prioritizing fileHeaders
    const responseHeaders: Record<string, string> = {
        ...convertHeadersToString(headers as Record<string, Header>),
        ...(fileHeaders ? convertHeadersToString(fileHeaders as Record<string, Header>) : {}),
        ...((basicFile as TFile).hash === undefined
            ? {}
            : { [`X-Range-${(basicFile as TFile).hash?.algorithm.toUpperCase()}`]: String((basicFile as TFile).hash?.value) }),
    };

    if (isChunkedUploadInit) {
        // Serialize the file object as JSON for chunked upload initialization
        body = JSON.stringify(basicFile);

        // Ensure Content-Type is set to application/json
        if (!responseHeaders["Content-Type"] && !responseHeaders["content-type"]) {
            responseHeaders["Content-Type"] = "application/json; charset=utf-8";
        }
    }

    // For HEAD requests, don't send body
    if (request.method === "HEAD") {
        body = "";
    }

    send(response, {
        body,
        headers: responseHeaders,
        statusCode: statusCode || 200,
    });
};

/**
 * Handles errors during upload processing.
 * @param error The error that occurred
 * @param request HTTP request
 * @param emit Function to emit events
 * @param listenerCount Function to count event listeners
 * @param logger Optional logger
 * @param sendError Function to send error response
 * @param response HTTP response
 */
export const handleUploadError = async <TFile extends UploadFile, NodeResponse extends ServerResponse>(
    error: unknown,
    request: IncomingMessage,
    emit: (event: string, data: unknown) => boolean,
    listenerCount: (event: string) => number,
    logger: { error?: (message: string, error: unknown) => void } | undefined,
    sendError: (response: NodeResponse, error: Error) => Promise<void>,
    response: NodeResponse,
): Promise<void> => {
    const errorObject = error instanceof Error ? error : new Error(String(error));
    const uError = pick(errorObject, ["name", ...(Object.getOwnPropertyNames(errorObject) as (keyof Error)[])]) as UploadError;
    const errorEvent = { ...uError, request: pick(request, ["headers", "method", "url"]) };

    if (listenerCount("error") > 0) {
        emit("error", errorEvent);
    }

    logger?.error("[error]: %O", errorEvent);

    await sendError(response, errorObject);
};
