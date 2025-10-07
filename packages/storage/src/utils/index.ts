import fnv1a from "@sindresorhus/fnv1a";
import mem from "memoize";

export const hash = mem((value: string) => fnv1a(value, { size: 64 }).toString(16));

export type { ErrorResponses } from "./errors";
export { ErrorMap, ERRORS, isUploadError, throwErrorCode, UploadError } from "./errors";
export type { PathMatch } from "./file-path-url-matcher";
export { default as filePathUrlMatcher } from "./file-path-url-matcher";
export {
    appendHeader,
    extractHost,
    extractProto,
    getBaseUrl,
    getHeader,
    getIdFromRequest,
    getMetadata,
    getRealPath,
    getRequestStream,
    normalizeHookResponse,
    normalizeOnErrorResponse,
    readBody,
    setHeaders,
    uuidRegex,
} from "./http";
export { default as Locker } from "./locker";
export { StreamChecksum, streamChecksum } from "./pipes/stream-checksum";
export { default as StreamLength } from "./pipes/stream-length";
export { default as isEqual } from "./primitives/is-equal";
export { default as isRecord } from "./primitives/is-record";
export { default as mapValues } from "./primitives/map-values";
export { default as pick } from "./primitives/pick";
export { default as toMilliseconds } from "./primitives/to-milliseconds";
export { default as toSeconds } from "./primitives/to-seconds";
export { default as RangeHasher } from "./range-hasher";
export type {
    Header,
    Headers,
    HttpError,
    HttpErrorBody,
    IncomingMessageWithBody,
    Logger,
    ResponseBody,
    ResponseBodyType,
    ResponseTuple,
    UploadResponse,
    Validation,
    ValidationError,
    ValidatorConfig,
} from "./types";
export { isValidationError, Validator } from "./validator";
