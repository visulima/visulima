import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import { format } from "node:url";

import mime from "mime";

import type { BaseStorage } from "../../storage/storage";
import type { UploadFile } from "../../storage/utils/file";
import type MediaTransformer from "../../transformer/media-transformer";
import type { ErrorResponses } from "../../utils/errors";
import { ErrorMap } from "../../utils/errors";
import { HeaderUtilities } from "../../utils/headers";
import { getBaseUrl } from "../../utils/http";
import type { ResponseBodyType } from "../../utils/types";
import type { UploadOptions } from "../types";

/**
 * Core base class containing shared business logic for all handlers.
 * This class is platform-agnostic and contains no Node.js or Web API specific code.
 * @template TFile The file type used by this handler.
 */
abstract class BaseHandlerCore<TFile extends UploadFile> extends EventEmitter {
    /**
     * Response body type for the handler.
     */
    public responseType: ResponseBodyType = "json";

    /**
     * Storage instance for file operations.
     */
    public storage: BaseStorage<TFile>;

    /**
     * Optional media transformer for image/video processing.
     */
    public mediaTransformer?: MediaTransformer;

    /**
     * Whether to disable termination for finished uploads.
     */
    public disableTerminationForFinishedUploads?: boolean;

    /**
     * Logger instance for debugging and error reporting.
     */
    protected logger?: Console;

    /**
     * Gets the logger instance.
     * @returns Logger instance or undefined.
     */
    public get loggerInstance(): Console | undefined {
        return this.logger;
    }

    /**
     * Internal error responses configuration.
     */
    protected internalErrorResponses = {} as ErrorResponses;

    /**
     * Gets the error responses configuration.
     * @returns Error responses configuration.
     */
    public get errorResponses(): ErrorResponses {
        return this.internalErrorResponses;
    }

    public constructor({ disableTerminationForFinishedUploads, mediaTransformer, storage }: UploadOptions<TFile>) {
        super();

        this.storage = storage;
        this.mediaTransformer = mediaTransformer;
        this.disableTerminationForFinishedUploads = disableTerminationForFinishedUploads;
        this.logger = this.storage?.logger;

        this.assembleErrors();
    }

    /**
     * Sets custom error responses.
     * @param value Partial error responses to override defaults.
     */
    public set errorResponses(value: Partial<ErrorResponses>) {
        this.assembleErrors(value);
    }

    /**
     * Assemble error responses by merging defaults with custom overrides.
     * @param customErrors Custom error responses to override defaults
     */
    public assembleErrors = (customErrors = {}): void => {
        this.internalErrorResponses = {
            ...ErrorMap,
            ...this.internalErrorResponses,
            ...this.storage.errorResponses,
            ...customErrors,
        };
    };

    /**
     * Parses HTTP Range header and returns start/end byte positions for partial content requests.
     * @param rangeHeader HTTP Range header value (e.g., "bytes=0-1023").
     * @param fileSize Total size of the file in bytes.
     * @returns Object with start and end positions, or undefined if range is invalid.
     */
    // eslint-disable-next-line class-methods-use-this
    public parseRangeHeader(rangeHeader: string | undefined, fileSize: number): { end: number; start: number } | undefined {
        if (!rangeHeader || !rangeHeader.startsWith("bytes=")) {
            return undefined;
        }

        const ranges = rangeHeader.slice(6).split(",");

        if (ranges.length !== 1) {
            // Multiple ranges not supported
            return undefined;
        }

        const range = ranges[0]?.trim();

        if (!range) {
            return undefined;
        }

        const parts = range.split("-");

        if (parts.length !== 2) {
            return undefined;
        }

        const [startString, endString] = parts;
        let start: number;
        let end: number;

        if (startString && endString) {
            // bytes=start-end
            start = Number.parseInt(startString, 10);
            end = Number.parseInt(endString, 10);
        } else if (startString && !endString) {
            // bytes=start- (open-ended range)
            start = Number.parseInt(startString, 10);
            end = fileSize - 1;
        } else if (!startString && endString) {
            // bytes=-end (suffix range)
            const suffixLength = Number.parseInt(endString, 10);

            start = Math.max(0, fileSize - suffixLength);
            end = fileSize - 1;
        } else {
            return undefined; // Invalid range (both empty)
        }

        // Validate range
        if (Number.isNaN(start) || Number.isNaN(end) || start >= fileSize || end >= fileSize || start > end) {
            return undefined;
        }

        return { end, start };
    }

    /**
     * Build file URL from request and file data.
     * Platform-agnostic version that accepts URL string.
     * @param requestUrl Request URL string
     * @param file File object containing ID and content type
     * @returns Constructed file URL with extension based on content type
     */
    protected buildFileUrlFromString(requestUrl: string, file: TFile): string {
        const url = new URL(requestUrl, "http://localhost");
        const { pathname } = url;
        const query = Object.fromEntries(url.searchParams.entries());
        const relative = format({ pathname: `${pathname}/${file.id}`, query });

        const baseUrl = this.storage.config.useRelativeLocation ? "" : getBaseUrl({ url: requestUrl } as IncomingMessage);

        return `${baseUrl}${relative}.${mime.getExtension(file.contentType)}`;
    }

    /**
     * Negotiates content type based on Accept header and supported formats.
     * Platform-agnostic version that accepts header string.
     * @param acceptHeader Accept header value
     * @param supportedTypes Array of supported MIME types to match against
     * @returns Best matching content type or undefined if no match found
     */
    // eslint-disable-next-line class-methods-use-this
    public negotiateContentType(acceptHeader: string | undefined, supportedTypes: string[]): string | undefined {
        if (!acceptHeader) {
            return undefined;
        }

        return HeaderUtilities.getPreferredMediaType(acceptHeader, supportedTypes);
    }

    /**
     * Check for undefined ID or path errors and throw appropriate HTTP errors.
     * @param error The error to check
     */
    // eslint-disable-next-line class-methods-use-this
    protected checkForUndefinedIdOrPath(error: unknown): void {
        if (error instanceof Error && ["Id is undefined", "Invalid request URL", "Path is undefined"].includes(error.message)) {
            // This will be handled by the platform-specific error handler
            throw error;
        }
    }
}

export default BaseHandlerCore;
