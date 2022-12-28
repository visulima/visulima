export { default as AbstractBaseHandler } from "./handler/base-handler";
export { default as Multipart } from "./handler/multipart";
export { default as Tus, TUS_RESUMABLE, TUS_VERSION } from "./handler/tus";
export type {
    BaseHandler, Handlers, MethodHandler, UploadOptions, AsyncHandler, UploadEvent, UploadErrorEvent, RequestEvent,
} from "./handler/types.d";

export { default as AbstractBaseStorage } from "./storage/storage";
export type {
    MetaStorageOptions, BaseStorageOptions, ExpirationOptions, DiskStorageOptions, PurgeList, OnCreate, OnError, OnComplete, OnDelete, OnUpdate,
} from "./storage/types.d";

export { default as MetaStorage } from "./storage/meta-storage";

export { default as DiskStorage } from "./storage/local/disk-storage";
export { default as LocalMetaStorage } from "./storage/local/local-meta-storage";

export type {
    UploadFile, FileInit, FilePart, FileQuery, UploadEventType,
} from "./storage/utils/file";
export {
    File,
    getFileStatus,
    hasContent,
    partMatch,
    updateSize,
    isMetadata,
    Metadata,
    extractMimeType,
    extractOriginalName,
    isExpired,
    updateMetadata,
} from "./storage/utils/file";

export { default as tusSwagger } from "./swagger/tus-swagger";
export { default as multipartSwagger } from "./swagger/xhr-swagger";

export type {
    UploadResponse,
    HttpErrorBody,
    HttpError,
    ResponseBodyType,
    IncomingMessageWithBody,
    Validation,
    ValidatorConfig,
    ValidationError,
    Headers,
    Header,
    ResponseBody,
    ResponseTuple,
    RangeChecksum,
    RangeHasher,
    Logger,
} from "./utils/types";
export {
    ERRORS, throwErrorCode, isUploadError, UploadError, ErrorMap,
} from "./utils/errors";
export {
    getHeader, setHeaders, appendHeader, readBody, getMetadata, getBaseUrl,
} from "./utils/http";
