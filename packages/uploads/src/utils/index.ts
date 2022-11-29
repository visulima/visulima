import fnv1a from "@sindresorhus/fnv1a";
import mem from "mem";

export const hash = mem((value: string) => fnv1a.bigInt(value, { size: 64 }).toString(16));

export type { ErrorResponses } from "./errors";
export {
    ERRORS, throwErrorCode, UploadError, ErrorMap, isUploadError,
} from "./errors";
export {
    fsp, ensureFile, removeFile,
} from "./fs";
export {
    getHeader,
    appendHeader,
    setHeaders,
    extractHost,
    extractProto,
    normalizeHookResponse,
    normalizeOnErrorResponse,
    getBaseUrl,
    readBody,
    getMetadata,
    getIdFromRequest,
    uuidRegex,
    getRealPath,
} from "./http";
export { default as Locker } from "./locker";
export { default as StreamLength } from "./pipes/stream-length";
export { streamChecksum, StreamChecksum } from "./pipes/stream-checksum";
export { default as Validator, isValidationError } from "./validator";
export { default as RangeHasher } from "./range-hasher";

export { default as isEqual } from "./primitives/is-equal";
export { default as isRecord } from "./primitives/is-record";
export { default as mapValues } from "./primitives/map-values";
export { default as pick } from "./primitives/pick";
export { default as toSeconds } from "./primitives/to-seconds";
export { default as toMilliseconds } from "./primitives/to-milliseconds";

export type { PathMatch } from "./file-path-url-matcher";
export { default as filePathUrlMatcher } from "./file-path-url-matcher";

export type {
    UploadResponse,
    ResponseBody,
    ResponseTuple,
    Headers,
    Header,
    HttpErrorBody,
    HttpError,
    ResponseBodyType,
    IncomingMessageWithBody,
    Validation,
    ValidatorConfig,
    ValidationError,
    Logger,
} from "./types.d";
