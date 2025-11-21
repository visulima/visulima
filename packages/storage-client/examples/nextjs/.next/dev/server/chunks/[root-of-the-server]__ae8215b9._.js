module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/node:fs [external] (node:fs, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:fs", () => require("node:fs"));

module.exports = mod;
}),
"[externals]/node:fs/promises [external] (node:fs/promises, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:fs/promises", () => require("node:fs/promises"));

module.exports = mod;
}),
"[externals]/node:stream [external] (node:stream, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:stream", () => require("node:stream"));

module.exports = mod;
}),
"[project]/packages/storage/dist/packem_shared/_commonjsHelpers-B85MJLTf.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "g",
    ()=>getDefaultExportFromCjs
]);
function getDefaultExportFromCjs(x) {
    return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}
;
}),
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[externals]/fs [external] (fs, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("fs", () => require("fs"));

module.exports = mod;
}),
"[externals]/module [external] (module, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("module", () => require("module"));

module.exports = mod;
}),
"[externals]/tty [external] (tty, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("tty", () => require("tty"));

module.exports = mod;
}),
"[externals]/util [external] (util, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("util", () => require("util"));

module.exports = mod;
}),
"[externals]/os [external] (os, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("os", () => require("os"));

module.exports = mod;
}),
"[project]/packages/storage/dist/packem_shared/part-match-CW8Z1naC.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "a",
    ()=>detectFileTypeFromBuffer,
    "d",
    ()=>detectFileTypeFromStream,
    "g",
    ()=>getFileStatus,
    "p",
    ()=>partMatch
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$stream__$5b$external$5d$__$28$node$3a$stream$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:stream [external] (node:stream, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$file$2d$type$40$21$2e$1$2e$0$2f$node_modules$2f$file$2d$type$2f$core$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/file-type@21.1.0/node_modules/file-type/core.js [app-route] (ecmascript)");
;
;
const detectFileTypeFromBuffer = async (buffer)=>{
    try {
        return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$file$2d$type$40$21$2e$1$2e$0$2f$node_modules$2f$file$2d$type$2f$core$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["fileTypeFromBuffer"])(buffer);
    } catch  {
        return void 0;
    }
};
const detectFileTypeFromStream = async (stream, options)=>{
    const sampleSize = 4100;
    let fileType;
    const chunks = [];
    let totalLength = 0;
    let detectionStarted = false;
    let detectionPromise;
    const outputStream = new __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$stream__$5b$external$5d$__$28$node$3a$stream$2c$__cjs$29$__["PassThrough"]({
        highWaterMark: 0
    });
    const peekStream = new __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$stream__$5b$external$5d$__$28$node$3a$stream$2c$__cjs$29$__["Transform"]({
        objectMode: false,
        transform (chunk, _encoding, callback) {
            if (!detectionStarted) {
                chunks.push(chunk);
                totalLength += chunk.length;
                if (totalLength >= sampleSize || totalLength > 0) {
                    detectionStarted = true;
                    const buffer = Buffer.concat(chunks);
                    detectionPromise = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$file$2d$type$40$21$2e$1$2e$0$2f$node_modules$2f$file$2d$type$2f$core$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["fileTypeFromBuffer"])(buffer).then((detected)=>{
                        fileType = detected;
                        return detected;
                    }).catch(()=>void 0);
                }
            }
            callback(void 0, chunk);
        }
    });
    stream.pipe(peekStream).pipe(outputStream);
    stream.on("error", (error)=>{
        peekStream.destroy(error);
        outputStream.destroy(error);
    });
    peekStream.on("error", (error)=>{
        if (!outputStream.destroyed) {
            outputStream.destroy(error);
        }
    });
    await Promise.race([
        new Promise((resolve)=>{
            if (detectionStarted) {
                resolve();
                return;
            }
            const timeout = setTimeout(()=>resolve(), 10);
            peekStream.once("data", ()=>{
                clearTimeout(timeout);
                resolve();
            });
            peekStream.once("end", ()=>{
                clearTimeout(timeout);
                resolve();
            });
        }),
        new Promise((resolve)=>{
            setTimeout(()=>resolve(), 10);
        })
    ]);
    if (detectionPromise) {
        await Promise.race([
            detectionPromise.then(()=>void 0),
            new Promise((resolve)=>{
                setTimeout(()=>resolve(), 150);
            })
        ]).catch(()=>{});
    }
    return {
        fileType,
        stream: outputStream
    };
};
const getFileStatus = (file)=>file.bytesWritten === file.size ? "completed" : file.createdAt ? "part" : "created";
const partMatch = (part, file)=>{
    if (part.size !== void 0 && file.size !== void 0 && part.size > 0 && file.size > 0 && part.size > file.size) {
        return false;
    }
    if (file.size === void 0) {
        return true;
    }
    return (part.start || 0) + (part.contentLength || 0) <= file.size;
};
;
}),
"[project]/packages/storage/dist/packem_shared/ERRORS-DKaR93nv.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ERRORS",
    ()=>ERRORS,
    "ErrorMap",
    ()=>ErrorMap,
    "UploadError",
    ()=>UploadError,
    "isUploadError",
    ()=>isUploadError,
    "throwErrorCode",
    ()=>throwErrorCode
]);
var ERRORS = /* @__PURE__ */ ((ERRORS2)=>{
    ERRORS2["BAD_REQUEST"] = "BadRequest";
    ERRORS2["CHECKSUM_MISMATCH"] = "ChecksumMismatch";
    ERRORS2["FILE_CONFLICT"] = "FileConflict";
    ERRORS2["FILE_ERROR"] = "FileError";
    ERRORS2["FILE_LOCKED"] = "FileLocked";
    ERRORS2["FILE_NOT_ALLOWED"] = "FileNotAllowed";
    ERRORS2["FILE_NOT_FOUND"] = "FileNotFound";
    ERRORS2["FORBIDDEN"] = "Forbidden";
    ERRORS2["GONE"] = "Gone";
    ERRORS2["INVALID_FILE_NAME"] = "InvalidFileName";
    ERRORS2["INVALID_FILE_SIZE"] = "InvalidFileSize";
    ERRORS2["INVALID_RANGE"] = "InvalidRange";
    ERRORS2["INVALID_TYPE"] = "Invalidtype";
    ERRORS2["METHOD_NOT_ALLOWED"] = "MethodNotAllowed";
    ERRORS2["REQUEST_ABORTED"] = "RequestAborted";
    ERRORS2["REQUEST_ENTITY_TOO_LARGE"] = "RequestEntityTooLarge";
    ERRORS2["STORAGE_BUSY"] = "StorageBusy";
    ERRORS2["STORAGE_ERROR"] = "StorageError";
    ERRORS2["TOO_MANY_REQUESTS"] = "TooManyRequests";
    ERRORS2["UNKNOWN_ERROR"] = "UnknownError";
    ERRORS2["UNPROCESSABLE_ENTITY"] = "UnprocessableEntity";
    ERRORS2["UNSUPPORTED_CHECKSUM_ALGORITHM"] = "UnsupportedChecksumAlgorithm";
    ERRORS2["UNSUPPORTED_MEDIA_TYPE"] = "UnsupportedMediaType";
    return ERRORS2;
})(ERRORS || {});
const ErrorMap = (()=>{
    const errors = {
        BadRequest: [
            400,
            "Bad request"
        ],
        ChecksumMismatch: [
            460,
            "Checksum mismatch"
        ],
        FileConflict: [
            409,
            "File conflict"
        ],
        FileError: [
            500,
            "Something went wrong writing the file"
        ],
        FileLocked: [
            423,
            "File locked"
        ],
        FileNotAllowed: [
            403,
            "File not allowed"
        ],
        FileNotFound: [
            404,
            "Not found"
        ],
        Forbidden: [
            403,
            "Authenticated user is not allowed access"
        ],
        Gone: [
            410,
            "The file for this url no longer exists"
        ],
        InvalidFileName: [
            400,
            "Invalid file name or it cannot be retrieved"
        ],
        InvalidFileSize: [
            400,
            "File size cannot be retrieved"
        ],
        InvalidRange: [
            400,
            "Invalid or missing content-range header"
        ],
        Invalidtype: [
            400,
            'Invalid or missing "content-type" header'
        ],
        MethodNotAllowed: [
            405,
            "Method not allowed"
        ],
        RequestAborted: [
            499,
            "Request aborted"
        ],
        RequestEntityTooLarge: [
            413,
            "Request entity too large"
        ],
        StorageBusy: [
            503,
            "Storage is busy"
        ],
        StorageError: [
            503,
            "Storage error"
        ],
        TooManyRequests: [
            429,
            "Too many requests"
        ],
        UnknownError: [
            500,
            "Something went wrong"
        ],
        UnprocessableEntity: [
            422,
            "Validation failed"
        ],
        UnsupportedChecksumAlgorithm: [
            400,
            "Unsupported checksum algorithm"
        ],
        UnsupportedMediaType: [
            415,
            "Unsupported media type"
        ]
    };
    const errorMap = {};
    Object.keys(errors).forEach((code)=>{
        const [statusCode, message] = errors[code];
        errorMap[code] = {
            code,
            message,
            statusCode
        };
    });
    return errorMap;
})();
class UploadError extends Error {
    name = "UploadError";
    /** The standardized error code from the ERRORS enum */ UploadErrorCode = "UnknownError" /* UNKNOWN_ERROR */ ;
    /** Optional additional error details */ detail;
    /**
   * Creates a new UploadError instance.
   * @param code Standardized error code (defaults to UNKNOWN_ERROR)
   * @param message Human-readable error message (defaults to the code)
   * @param detail Optional additional error details
   */ constructor(code = "UnknownError" /* UNKNOWN_ERROR */ , message, detail){
        super(message || code);
        this.name = "UploadError";
        this.detail = detail;
        if (Object.values(ERRORS).includes(code)) {
            this.UploadErrorCode = code;
        }
    }
}
const isUploadError = (error)=>!!error.UploadErrorCode;
const throwErrorCode = (UploadErrorCode, detail)=>{
    const errorResponse = ErrorMap[UploadErrorCode];
    const error = new UploadError(detail || errorResponse?.message || "UnknownError" /* UNKNOWN_ERROR */ );
    error.UploadErrorCode = UploadErrorCode;
    if (typeof detail === "string") {
        error.detail = detail;
    }
    throw error;
};
;
}),
"[externals]/node:crypto [external] (node:crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:crypto", () => require("node:crypto"));

module.exports = mod;
}),
"[externals]/node:timers [external] (node:timers, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:timers", () => require("node:timers"));

module.exports = mod;
}),
"[externals]/node:util [external] (node:util, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:util", () => require("node:util"));

module.exports = mod;
}),
"[externals]/path [external] (path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("path", () => require("path"));

module.exports = mod;
}),
"[project]/packages/storage/dist/packem_shared/NoOpMetrics-DhAk5rXc.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>NoOpMetrics
]);
class NoOpMetrics {
    increment(_name, _value, _attributes) {}
    timing(_name, _duration, _attributes) {}
    gauge(_name, _value, _attributes) {}
}
;
}),
"[project]/packages/storage/dist/packem_shared/cache-B88MXQ_2.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "N",
    ()=>NoOpCache
]);
class NoOpCache {
    get() {
        return void 0;
    }
    set() {
        return true;
    }
    delete() {
        return true;
    }
    clear() {}
    has() {
        return false;
    }
}
;
}),
"[project]/packages/storage/dist/packem_shared/validator-InvzeyVl.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "V",
    ()=>ValidationError,
    "a",
    ()=>Validator,
    "i",
    ()=>isValidationError
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/ERRORS-DKaR93nv.js [app-route] (ecmascript)");
;
class ValidationError extends Error {
    /**
   * Creates a new ValidationError instance.
   * @param code Machine-readable error code
   * @param statusCode HTTP status code for the error
   * @param body Error response body (string or structured object)
   * @param headers HTTP headers to include in error response
   */ constructor(code, statusCode, body, headers){
        super(typeof body === "string" ? body : body?.message);
        this.code = code;
        this.statusCode = statusCode;
        this.body = body;
        this.headers = headers;
        this.name = "ValidationError";
    }
}
const capitalize = (s)=>s && s[0].toUpperCase() + s.slice(1);
const toResponse = (response)=>{
    if (!Array.isArray(response)) {
        return response;
    }
    const [statusCode, body, headers] = response;
    return {
        body,
        headers,
        statusCode
    };
};
class Validator {
    /**
   * Creates a new Validator instance.
   * @param prefix Prefix for generated error codes (default: "ValidationError")
   */ constructor(prefix = "ValidationError"){
        this.prefix = prefix;
    }
    validators = {};
    /**
   * Adds validation rules to the validator.
   * Each rule must include an `isValid` function.
   * @param config Validation configuration object
   * @throws TypeError if any validator is missing the isValid function
   */ add(config) {
        Object.entries(config).forEach(([key, validator])=>{
            const code = `${this.prefix}${capitalize(key)}`;
            this.validators[code] = {
                ...this.validators[code],
                ...validator
            };
            if (typeof this.validators[code].isValid !== "function") {
                throw new TypeError('Validation config "isValid" is missing, or it is not a function!');
            }
        });
    }
    /**
   * Verifies an object against all configured validation rules.
   * Throws ValidationError on first validation failure.
   * @param t Object to validate
   * @throws ValidationError if validation fails
   */ async verify(t) {
        for await (const [code, validator] of Object.entries(this.validators)){
            const isValid = await validator.isValid(t);
            if (!isValid) {
                const errorResponse = validator.response || (code in __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorMap"] ? __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorMap"][code] : __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorMap"].UnknownError);
                const response = toResponse(errorResponse);
                const { body, headers, message, statusCode } = response;
                throw new ValidationError(code, statusCode, body || message, headers);
            }
        }
    }
}
const isValidationError = (error)=>error.name === "ValidationError";
;
}),
"[project]/packages/storage/dist/packem_shared/path-CR6YkPXX-7R1-9CMk.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "a",
    ()=>normalizeWindowsPath,
    "b",
    ()=>basename,
    "d",
    ()=>dirname,
    "i",
    ()=>isAbsolute,
    "j",
    ()=>join,
    "n",
    ()=>normalize,
    "r",
    ()=>resolve
]);
const DRIVE_LETTER_START_RE = /^[A-Z]:\//i;
const normalizeWindowsPath = (input = "")=>{
    if (!input) {
        return input;
    }
    return input.replaceAll("\\", "/").replace(DRIVE_LETTER_START_RE, (r)=>r.toUpperCase());
};
const UNC_REGEX = /^[/\\]{2}/;
const IS_ABSOLUTE_RE = /^[/\\](?![/\\])|^[/\\]{2}(?!\.)|^[A-Z]:[/\\]/i;
const DRIVE_LETTER_RE = /^[A-Z]:$/i;
const cwd = ()=>{
    if (typeof process.cwd === "function") {
        return process.cwd().replaceAll("\\", "/");
    }
    return "/";
};
const normalizeString = (path2, allowAboveRoot)=>{
    let result = "";
    let lastSegmentLength = 0;
    let lastSlash = -1;
    let dots = 0;
    let char;
    for(let index = 0; index <= path2.length; ++index){
        if (index < path2.length) {
            char = path2[index];
        } else if (char === "/") {
            break;
        } else {
            char = "/";
        }
        if (char === "/") {
            if (lastSlash === index - 1 || dots === 1) ;
            else if (dots === 2) {
                if (result.length < 2 || lastSegmentLength !== 2 || !result.endsWith(".") || result.at(-2) !== ".") {
                    if (result.length > 2) {
                        const lastSlashIndex = result.lastIndexOf("/");
                        if (lastSlashIndex === -1) {
                            result = "";
                            lastSegmentLength = 0;
                        } else {
                            result = result.slice(0, lastSlashIndex);
                            lastSegmentLength = result.length - 1 - result.lastIndexOf("/");
                        }
                        lastSlash = index;
                        dots = 0;
                        continue;
                    } else if (result.length > 0) {
                        result = "";
                        lastSegmentLength = 0;
                        lastSlash = index;
                        dots = 0;
                        continue;
                    }
                }
                if (allowAboveRoot) {
                    result += result.length > 0 ? "/.." : "..";
                    lastSegmentLength = 2;
                }
            } else {
                if (result.length > 0) {
                    result += `/${path2.slice(lastSlash + 1, index)}`;
                } else {
                    result = path2.slice(lastSlash + 1, index);
                }
                lastSegmentLength = index - lastSlash - 1;
            }
            lastSlash = index;
            dots = 0;
        } else if (char === "." && dots !== -1) {
            ++dots;
        } else {
            dots = -1;
        }
    }
    return result;
};
const isAbsolute = (path2)=>IS_ABSOLUTE_RE.test(path2);
const normalize = function(path2) {
    if (path2.length === 0) {
        return ".";
    }
    path2 = normalizeWindowsPath(path2);
    const isUNCPath = UNC_REGEX.exec(path2);
    const isPathAbsolute = isAbsolute(path2);
    const trailingSeparator = path2.at(-1) === "/";
    path2 = normalizeString(path2, !isPathAbsolute);
    if (path2.length === 0) {
        if (isPathAbsolute) {
            return "/";
        }
        return trailingSeparator ? "./" : ".";
    }
    if (trailingSeparator) {
        path2 += "/";
    }
    if (DRIVE_LETTER_RE.test(path2)) {
        path2 += "/";
    }
    if (isUNCPath) {
        if (!isPathAbsolute) {
            return `//./${path2}`;
        }
        return `//${path2}`;
    }
    return isPathAbsolute && !isAbsolute(path2) ? `/${path2}` : path2;
};
const join = (...segments)=>{
    let path2 = "";
    for (const seg of segments){
        if (!seg) {
            continue;
        }
        if (path2.length > 0) {
            const pathTrailing = path2[path2.length - 1] === "/";
            const segLeading = seg[0] === "/";
            const both = pathTrailing && segLeading;
            if (both) {
                path2 += seg.slice(1);
            } else {
                path2 += pathTrailing || segLeading ? seg : `/${seg}`;
            }
        } else {
            path2 += seg;
        }
    }
    return normalize(path2);
};
const resolve = function(...arguments_) {
    arguments_ = arguments_.map((argument)=>normalizeWindowsPath(argument));
    let resolvedPath = "";
    let resolvedAbsolute = false;
    for(let index = arguments_.length - 1; index >= -1 && !resolvedAbsolute; index--){
        const path2 = index >= 0 ? arguments_[index] : cwd();
        if (!path2 || path2.length === 0) {
            continue;
        }
        resolvedPath = `${path2}/${resolvedPath}`;
        resolvedAbsolute = isAbsolute(path2);
    }
    resolvedPath = normalizeString(resolvedPath, !resolvedAbsolute);
    if (resolvedAbsolute && !isAbsolute(resolvedPath)) {
        return `/${resolvedPath}`;
    }
    return resolvedPath.length > 0 ? resolvedPath : ".";
};
const dirname = (path2)=>{
    const segments = normalizeWindowsPath(path2).replace(/\/$/, "").split("/").slice(0, -1);
    if (segments.length === 1 && DRIVE_LETTER_RE.test(segments[0])) {
        segments[0] += "/";
    }
    return segments.join("/") || (isAbsolute(path2) ? "/" : ".");
};
const basename = (path2, extension)=>{
    const lastSegment = normalizeWindowsPath(path2).split("/").pop();
    if (extension && lastSegment.endsWith(extension)) {
        return lastSegment.slice(0, -extension.length);
    }
    return lastSegment;
};
;
}),
"[project]/packages/storage/dist/packem_shared/is-expired-CTThU1q5.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "i",
    ()=>isExpired
]);
const isExpired = (file)=>{
    if (!file.expiredAt) {
        return false;
    }
    return Date.now() > +new Date(file.expiredAt);
};
;
}),
"[project]/packages/storage/dist/packem_shared/storage-qBIeShej.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "B",
    ()=>BaseStorage,
    "a",
    ()=>defaultFilesystemFileNameValidation,
    "b",
    ()=>parseBytes,
    "d",
    ()=>defaultCloudStorageFileNameValidation,
    "p",
    ()=>parseDuration,
    "t",
    ()=>toMilliseconds
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$stream__$5b$external$5d$__$28$node$3a$stream$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:stream [external] (node:stream, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$timers__$5b$external$5d$__$28$node$3a$timers$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:timers [external] (node:timers, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$util__$5b$external$5d$__$28$node$3a$util$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:util [external] (node:util, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$type$2d$is$40$2$2e$0$2e$1$2f$node_modules$2f$type$2d$is$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/type-is@2.0.1/node_modules/type-is/index.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$NoOpMetrics$2d$DhAk5rXc$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/NoOpMetrics-DhAk5rXc.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$cache$2d$B88MXQ_2$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/cache-B88MXQ_2.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/ERRORS-DKaR93nv.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$lru$2d$cache$40$11$2e$2$2e$2$2f$node_modules$2f$lru$2d$cache$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/lru-cache@11.2.2/node_modules/lru-cache/dist/esm/index.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$validator$2d$InvzeyVl$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/validator-InvzeyVl.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$path$2d$CR6YkPXX$2d$7R1$2d$9CMk$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/path-CR6YkPXX-7R1-9CMk.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$is$2d$expired$2d$CTThU1q5$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/is-expired-CTThU1q5.js [app-route] (ecmascript)");
;
;
;
;
;
;
;
;
;
;
;
const BYTE_SIZES = {
    iec: [
        {
            long: "Bytes",
            short: "B"
        },
        {
            long: "Kibibytes",
            short: "KiB"
        },
        {
            long: "Mebibytes",
            short: "MiB"
        },
        {
            long: "Gibibytes",
            short: "GiB"
        },
        {
            long: "Tebibytes",
            short: "TiB"
        },
        {
            long: "Pebibytes",
            short: "PiB"
        },
        {
            long: "Exbibytes",
            short: "EiB"
        },
        {
            long: "Zebibytes",
            short: "ZiB"
        },
        {
            long: "Yobibytes",
            short: "YiB"
        }
    ],
    iec_octet: [
        {
            long: "Octets",
            short: "o"
        },
        {
            long: "Kibioctets",
            short: "Kio"
        },
        {
            long: "Mebioctets",
            short: "Mio"
        },
        {
            long: "Gibioctets",
            short: "Gio"
        },
        {
            long: "Tebioctets",
            short: "Tio"
        },
        {
            long: "Pebioctets",
            short: "Pio"
        },
        {
            long: "Exbioctets",
            short: "Eio"
        },
        {
            long: "Zebioctets",
            short: "Zio"
        },
        {
            long: "Yobioctets",
            short: "Yio"
        }
    ],
    metric: [
        {
            long: "Bytes",
            short: "Bytes"
        },
        {
            long: "Kilobytes",
            short: "KB"
        },
        {
            long: "Megabytes",
            short: "MB"
        },
        {
            long: "Gigabytes",
            short: "GB"
        },
        {
            long: "Terabytes",
            short: "TB"
        },
        {
            long: "Petabytes",
            short: "PB"
        },
        {
            long: "Exabytes",
            short: "EB"
        },
        {
            long: "Zettabytes",
            short: "ZB"
        },
        {
            long: "Yottabytes",
            short: "YB"
        }
    ],
    metric_octet: [
        {
            long: "Octets",
            short: "o"
        },
        {
            long: "Kilo-octets",
            short: "ko"
        },
        {
            long: "Mega-octets",
            short: "Mo"
        },
        {
            long: "Giga-octets",
            short: "Go"
        },
        {
            long: "Tera-octets",
            short: "To"
        },
        {
            long: "Peta-octets",
            short: "Po"
        },
        {
            long: "Exa-octets",
            short: "Eo"
        },
        {
            long: "Zetta-octets",
            short: "Zo"
        },
        {
            long: "Yotta-octets",
            short: "Yo"
        }
    ]
};
const parseLocalizedNumber = (stringNumber, locale)=>{
    const thousandSeparator = new Intl.NumberFormat(locale).format(11111).replaceAll(new RegExp("\\p{Number}", "gu"), "");
    const decimalSeparator = new Intl.NumberFormat(locale).format(1.1).replaceAll(new RegExp("\\p{Number}", "gu"), "");
    return Number.parseFloat(stringNumber.replaceAll(new RegExp(`\\${thousandSeparator}`, "g"), "").replace(new RegExp(`\\${decimalSeparator}`), "."));
};
const fromBase = (base)=>{
    if (base === 2) {
        return 1024;
    }
    if (base === 10) {
        return 1e3;
    }
    throw new TypeError(`Unsupported base.`);
};
const parseBytes = (value, options)=>{
    const config = {
        base: 2,
        locale: "en-US",
        units: "metric",
        ...options
    };
    if (typeof value !== "string" || value.length === 0) {
        throw new TypeError("Value is not a string or is empty.");
    }
    if (value.length > 100) {
        throw new TypeError("Value exceeds the maximum length of 100 characters.");
    }
    const match = /^(?<value>-?(?:\d+(([.,])\d+)*)?[.,]?\d+) *(?<type>bytes?|b|kb|kib|mb|mib|gb|gib|tb|tib|pb|pib|eb|eib|zb|zib|yb|yib|(kilo|kibi|mega|mebi|giga|gibi|tera|tebi|peta|pebi|exa|exbi|zetta|zebi|yotta|yobi)?bytes)?$/i.exec(value);
    const groups = match?.groups;
    if (!groups) {
        return Number.NaN;
    }
    const localizedNumber = parseLocalizedNumber(groups.value, config.locale);
    const type = (groups.type ?? "Bytes").toUpperCase().replace(/^KIBI/, "KILO").replace(/^MIBI/, "MEGA").replace(/^GIBI/, "GIGA").replace(/^TEBI/, "TERA").replace(/^PEBI/, "PETA").replace(/^EXBI/, "EXA").replace(/^ZEBI/, "ZETTA").replace(/^YIBI/, "YOTTA").replace(/^(.)IB$/, "$1B");
    const level = BYTE_SIZES[config.units].findIndex((unit)=>unit.short[0].toUpperCase() === type[0]);
    const base = fromBase(config.base);
    return localizedNumber * base ** level;
};
const createDurationLanguage = (y, mo, w, d, h, m, s, ms, future, past, decimal, unitMap, groupSeparator, placeholderSeparator)=>{
    const result = {
        d,
        h,
        m,
        mo,
        ms,
        s,
        w,
        y
    };
    {
        result.future = future;
    }
    {
        result.past = past;
    }
    {
        result.decimal = decimal;
    }
    if (unitMap !== void 0) {
        result.unitMap = unitMap;
    }
    {
        result.groupSeparator = groupSeparator;
    }
    {
        result.placeholderSeparator = placeholderSeparator;
    }
    return result;
};
const englishUnitMap = {
    d: "d",
    day: "d",
    days: "d",
    h: "h",
    hour: "h",
    hours: "h",
    hr: "h",
    hrs: "h",
    m: "m",
    millisecond: "ms",
    milliseconds: "ms",
    min: "m",
    mins: "m",
    minute: "m",
    minutes: "m",
    mo: "mo",
    month: "mo",
    months: "mo",
    ms: "ms",
    s: "s",
    sec: "s",
    second: "s",
    seconds: "s",
    secs: "s",
    w: "w",
    week: "w",
    weeks: "w",
    y: "y",
    year: "y",
    years: "y",
    yr: "y",
    yrs: "y"
};
const durationLanguage = createDurationLanguage((counter)=>`year${counter === 1 ? "" : "s"}`, (counter)=>`month${counter === 1 ? "" : "s"}`, (counter)=>`week${counter === 1 ? "" : "s"}`, (counter)=>`day${counter === 1 ? "" : "s"}`, (counter)=>`hour${counter === 1 ? "" : "s"}`, (counter)=>`minute${counter === 1 ? "" : "s"}`, (counter)=>`second${counter === 1 ? "" : "s"}`, (counter)=>`millisecond${counter === 1 ? "" : "s"}`, "in %s", "%s ago", ".", // decimal
englishUnitMap, ",", // groupSeparator
"_");
const validateDurationLanguage = (language)=>{
    const requiredProperties = [
        "y",
        "mo",
        "w",
        "d",
        "h",
        "m",
        "s",
        "ms",
        "future",
        "past"
    ];
    for (const property of requiredProperties){
        if (!Object.prototype.hasOwnProperty.call(language, property)) {
            throw new TypeError(`Missing required property: ${property}`);
        }
    }
    if (typeof language.future !== "string" || typeof language.past !== "string") {
        throw new TypeError("Properties future and past must be of type string");
    }
    for (const property of [
        "y",
        "mo",
        "w",
        "d",
        "h",
        "m",
        "s",
        "ms"
    ]){
        if (typeof language[property] !== "string" && typeof language[property] !== "function") {
            throw new TypeError(`Property ${property} must be of type string or function`);
        }
    }
    if (language.decimal && typeof language.decimal !== "string") {
        throw new TypeError("Property decimal must be of type string");
    }
    if (language.delimiter && typeof language.delimiter !== "string") {
        throw new TypeError("Property delimiter must be of type string");
    }
    if (language._digitReplacements && !Array.isArray(language._digitReplacements)) {
        throw new TypeError("Property _digitReplacements must be an array");
    }
    if (language._numberFirst && typeof language._numberFirst !== "boolean") {
        throw new TypeError("Property _numberFirst must be of type boolean");
    }
    if (language.unitMap && typeof language.unitMap !== "object") {
        throw new TypeError("Property unitMap must be an object");
    }
    if (language.unitMap && Object.values(language.unitMap).some((value)=>typeof value !== "string")) {
        throw new TypeError("All values in unitMap must be of type string");
    }
};
const STANDARD_UNIT_MEASURES = {
    d: 864e5,
    h: 36e5,
    m: 6e4,
    mo: 2629746e3,
    ms: 1,
    s: 1e3,
    w: 6048e5,
    y: 31556952e3
};
const ESCAPE_REGEX = /[-/\\^$*+?.()|[\]{}]/g;
const ISO_FORMAT = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i;
const COLON_FORMAT = /^(?:(\d+):)?(?:(\d+):)?(\d+)$/;
const NUMERIC_STRING_REGEX = /^[+-]?\d+(?:\.\d+)?$/;
const parseDuration = (value, options)=>{
    if (typeof value !== "string" || value.length === 0) {
        return void 0;
    }
    const { defaultUnit = "ms", language = durationLanguage } = {};
    validateDurationLanguage(language);
    const decimalSeparator = language.decimal ?? ".";
    const groupSeparator = language.groupSeparator ?? ",";
    const placeholderSeparator = language.placeholderSeparator ?? "_";
    const escapedDecimal = decimalSeparator.replaceAll(ESCAPE_REGEX, String.raw`\$&`);
    const escapedGroup = groupSeparator.replaceAll(ESCAPE_REGEX, String.raw`\$&`);
    const escapedPlaceholder = placeholderSeparator.replaceAll(ESCAPE_REGEX, String.raw`\$&`);
    const currentUnitMap = language.unitMap ?? englishUnitMap;
    let processedValue = value.replaceAll(new RegExp(`(\\d)[${escapedPlaceholder}${escapedGroup}](\\d)`, "g"), "$1$2");
    if (decimalSeparator !== ".") {
        processedValue = processedValue.replace(escapedDecimal, ".");
    }
    if (NUMERIC_STRING_REGEX.test(value)) {
        const numberOnly = Number.parseFloat(processedValue.trim());
        if (!Number.isNaN(numberOnly)) {
            const unitKey = currentUnitMap[defaultUnit];
            if (unitKey !== void 0) {
                return numberOnly * STANDARD_UNIT_MEASURES[unitKey];
            }
        }
        return void 0;
    }
    const isoMatch = ISO_FORMAT.exec(value);
    if (isoMatch) {
        const hours = Number.parseInt(isoMatch[1] ?? "0", 10);
        const minutes = Number.parseInt(isoMatch[2] ?? "0", 10);
        const seconds = Number.parseInt(isoMatch[3] ?? "0", 10);
        return hours * 36e5 + minutes * 6e4 + seconds * 1e3;
    }
    const colonMatch = COLON_FORMAT.exec(value);
    if (colonMatch) {
        let hours = 0;
        let minutes = 0;
        let seconds = 0;
        if (colonMatch[2] !== void 0) {
            hours = Number.parseInt(colonMatch[1] ?? "0", 10);
            minutes = Number.parseInt(colonMatch[2], 10);
        } else if (colonMatch[1] !== void 0) {
            minutes = Number.parseInt(colonMatch[1], 10);
        }
        seconds = Number.parseInt(colonMatch[3] ?? "0", 10);
        return hours * 36e5 + minutes * 6e4 + seconds * 1e3;
    }
    const currentUnitMapKeys = Object.keys(currentUnitMap);
    const regexKeys = currentUnitMapKeys.toSorted((a, b)=>b.length - a.length).map((k)=>k.replaceAll(ESCAPE_REGEX, String.raw`\$&`)).join("|");
    const durationRegex = new RegExp(`(-?\\d*\\.?\\d+)\\s*(${regexKeys})`, "gi");
    let totalMs = 0;
    let match;
    let unitsFound = false;
    let firstMatchIndex = -1;
    let lastMatchEndIndex = 0;
    durationRegex.lastIndex = 0;
    while((match = durationRegex.exec(processedValue)) !== null){
        if (!unitsFound) {
            firstMatchIndex = match.index;
        }
        unitsFound = true;
        const numberString = match[1];
        const unitString = match[2];
        if (!numberString || !unitString) {
            continue;
        }
        const trimmedNumberString = numberString.trim();
        const sign = trimmedNumberString.startsWith("-") ? -1 : 1;
        const absNumberString = trimmedNumberString.replace(/^[-+]/, "");
        const parsedNumber = Number.parseFloat(absNumberString);
        const unitKey = currentUnitMap[unitString.toLowerCase()];
        if (unitKey === void 0) {
            continue;
        }
        const unitValue = STANDARD_UNIT_MEASURES[unitKey];
        if (Number.isNaN(parsedNumber)) {
            return void 0;
        }
        totalMs += sign * parsedNumber * unitValue;
        lastMatchEndIndex = durationRegex.lastIndex;
    }
    const leadingText = processedValue.slice(0, firstMatchIndex).trim();
    const trailingText = processedValue.slice(lastMatchEndIndex).trim();
    if (unitsFound && (leadingText.length > 0 || trailingText.length > 0)) {
        return void 0;
    }
    if (!unitsFound) {
        return void 0;
    }
    return totalMs;
};
const toMilliseconds = (value)=>{
    if (value === Number(value)) {
        return value;
    }
    if (!value) {
        return void 0;
    }
    const parsed = parseDuration(value);
    if (parsed === void 0) {
        return void 0;
    }
    return parsed;
};
class Locker extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$lru$2d$cache$40$11$2e$2$2e$2$2f$node_modules$2f$lru$2d$cache$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["LRUCache"] {
    /**
   * Creates a new Locker instance with configurable TTL and cache options.
   * @param options LRU cache configuration options
   */ constructor(options){
        super({
            ttl: 1e3,
            ttlAutopurge: true,
            ...options
        });
    }
    /**
   * Acquires a lock for the specified key.
   * Throws an error if the key is already locked.
   * @param key The key to lock
   * @returns The lock token (same as the key)
   * @throws Error if the key is already locked
   */ lock(key) {
        const locked = this.get(key);
        if (locked) {
            throw new Error(`${key} is locked`);
        }
        this.set(key, key);
        return key;
    }
    /**
   * Releases the lock for the specified key.
   * @param key The key to unlock
   */ unlock(key) {
        this.delete(key);
    }
}
const extractOriginalName = (meta)=>{
    if (typeof meta.name === "string") {
        return meta.name;
    }
    if (typeof meta.title === "string") {
        return meta.title;
    }
    if (typeof meta.originalName === "string") {
        return meta.originalName;
    }
    if (typeof meta.filename === "string") {
        return meta.filename;
    }
    return void 0;
};
const deepMerge = (target, source)=>{
    const result = {
        ...target
    };
    Object.keys(source).forEach((key)=>{
        const sourceValue = source[key];
        if (sourceValue !== null && typeof sourceValue === "object" && !Array.isArray(sourceValue)) {
            const targetValue = result[key];
            const targetObject = targetValue && typeof targetValue === "object" && !Array.isArray(targetValue) ? targetValue : {};
            result[key] = deepMerge(targetObject, sourceValue);
        } else {
            result[key] = sourceValue;
        }
    });
    return result;
};
const updateMetadata = (file, metadata)=>{
    const merged = deepMerge(file, metadata);
    Object.assign(file, merged);
    file.originalName = extractOriginalName(file.metadata) || file.originalName;
};
const defaults = {
    allowMIME: [
        "*/*"
    ],
    filename: ({ id })=>id,
    maxMetadataSize: "8MB",
    maxUploadSize: "5TB",
    onComplete: ()=>{},
    onCreate: ()=>{},
    onDelete: ()=>{},
    onError: ()=>{},
    onUpdate: ()=>{},
    useRelativeLocation: false,
    validation: {}
};
const defaultCloudStorageFileNameValidation = (name)=>{
    if (!name || name.length < 3 || name.length > 255 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$path$2d$CR6YkPXX$2d$7R1$2d$9CMk$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["i"])(name)) {
        return false;
    }
    const upperCase = name.toUpperCase();
    return !(upperCase.includes("../") || name.includes("\0"));
};
const defaultFilesystemFileNameValidation = (name)=>{
    if (!name || name.length < 3 || name.length > 255 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$path$2d$CR6YkPXX$2d$7R1$2d$9CMk$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["i"])(name)) {
        return false;
    }
    const upperCase = name.toUpperCase();
    const filesystemInvalidChars = [
        '"',
        "*",
        ":",
        "<",
        ">",
        "?",
        "\\",
        "|",
        "../",
        "\0"
    ];
    return !filesystemInvalidChars.some((char)=>upperCase.includes(char));
};
class BaseStorage {
    /**
   * Hook called when a new file is created.
   * @param file The newly created file object.
   * @remarks This hook is called after file metadata is saved but before returning the file.
   * Can be used for side effects like logging, notifications, or custom processing.
   */ onCreate;
    /**
   * Hook called when file metadata is updated.
   * @param file The updated file object.
   * @remarks This hook is called after metadata is updated and saved.
   * Can be used for side effects like logging or custom processing.
   */ onUpdate;
    /**
   * Hook called when a file upload is completed.
   * @param file The completed file object.
   * @param response The response object that can be modified in place (headers, statusCode, body).
   * @param request Optional request object for additional context.
   * @remarks This hook is called when file status becomes "completed".
   * The response object can be modified directly to add headers or change the status code.
   */ onComplete;
    /**
   * Hook called when a file is deleted.
   * @param file The deleted file object.
   * @remarks This hook is called after the file is deleted but before returning.
   * Can be used for side effects like cleanup or logging.
   */ onDelete;
    /**
   * Hook called when an error occurs during storage operations.
   * @param error The HTTP error object that can be modified in place.
   * @remarks This hook allows customizing error responses by modifying the error object.
   * The error object can be modified to change headers, statusCode, or body properties.
   * Error formatting happens in handlers after this hook is called.
   */ onError;
    isReady = true;
    errorResponses = {};
    cache;
    logger;
    metrics;
    genericConfig;
    maxMetadataSize;
    checksumTypes = [];
    maxUploadSize;
    expiration;
    locker;
    namingFunction;
    validation = new __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$validator$2d$InvzeyVl$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["a"]();
    assetFolder = void 0;
    /**
   * Limits the number of concurrent upload requests
   */ concurrency;
    constructor(config){
        const options = {
            ...defaults,
            ...config
        };
        this.onCreate = options.onCreate;
        this.onUpdate = options.onUpdate;
        this.onComplete = options.onComplete;
        this.onDelete = options.onDelete;
        this.onError = options.onError;
        this.namingFunction = options.filename;
        this.maxUploadSize = typeof options.maxUploadSize === "string" ? parseBytes(options.maxUploadSize) : options.maxUploadSize;
        this.maxMetadataSize = typeof options.maxMetadataSize === "string" ? parseBytes(options.maxMetadataSize) : options.maxMetadataSize;
        this.expiration = options.expiration;
        this.genericConfig = options;
        if (options.assetFolder !== void 0) {
            this.assetFolder = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$path$2d$CR6YkPXX$2d$7R1$2d$9CMk$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["n"])(options.assetFolder);
        }
        this.locker = new Locker({
            max: 1e3,
            ttl: 3e4,
            ttlAutopurge: true
        });
        this.cache = options.cache ?? new __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$cache$2d$B88MXQ_2$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["N"]();
        this.logger = options.logger;
        this.metrics = options.metrics ?? new __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$NoOpMetrics$2d$DhAk5rXc$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"]();
        this.logger?.debug(`${this.constructor.name} config: ${(0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$util__$5b$external$5d$__$28$node$3a$util$2c$__cjs$29$__["inspect"])({
            ...config,
            logger: this.logger.constructor
        })}`);
        const purgeInterval = toMilliseconds(options.expiration?.purgeInterval);
        if (purgeInterval) {
            this.startAutoPurge(purgeInterval);
        }
        const size = {
            isValid (file) {
                if (file.size === void 0) {
                    return true;
                }
                const fileSize = Number(file.size);
                if (fileSize < 0) {
                    return false;
                }
                return fileSize <= this.value;
            },
            response: __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorMap"].RequestEntityTooLarge,
            value: this.maxUploadSize
        };
        const mime = {
            isValid (file) {
                return !!__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$type$2d$is$40$2$2e$0$2e$1$2f$node_modules$2f$type$2d$is$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].is(file.contentType, this.value);
            },
            // @TODO: add better error handling for mime types
            response: __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorMap"].UnsupportedMediaType,
            value: options.allowMIME
        };
        const fileNameValidation = options.fileNameValidation ?? defaultCloudStorageFileNameValidation;
        const filename = {
            isValid (file) {
                return fileNameValidation(file.name);
            },
            response: __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorMap"].InvalidFileName
        };
        this.validation.add({
            filename,
            mime,
            size
        });
        this.validation.add({
            ...options.validation
        });
    }
    get tusExtension() {
        const extensions = [
            "creation",
            "creation-with-upload",
            "termination",
            "checksum",
            "creation-defer-length",
            "concatenation"
        ];
        if (this.expiration) {
            extensions.push("expiration");
        }
        return extensions;
    }
    /**
   * Validates a file against configured validation rules.
   * @param file File object to validate.
   * @returns Promise resolving to undefined if file is valid, throws ValidationError otherwise.
   * @throws {ValidationError} If validation fails
   */ async validate(file) {
        await this.validation.verify(file);
    }
    /**
   * Checks if a file exists by querying its metadata.
   * @param query File query containing the file ID to check.
   * @param query.id File ID to check.
   * @returns Promise resolving to true if file exists, false otherwise.
   * @remarks This method does not throw errors - it returns false if the file is not found.
   */ async exists(query) {
        return this.instrumentOperation("exists", async ()=>{
            try {
                await this.getMeta(query.id);
                return true;
            } catch  {
                return false;
            }
        });
    }
    /**
   * Normalizes errors with storage-specific context.
   * @param error The error to normalize.
   * @returns Normalized HTTP error with storage class context added to the message.
   * @remarks Errors are enhanced with the storage class name for better debugging.
   */ normalizeError(error) {
        const baseError = {
            code: error.name,
            message: error.message,
            name: error.name,
            statusCode: 500
        };
        return {
            ...baseError,
            message: `[${this.constructor.name}] ${baseError.message}`
        };
    }
    /**
   * Gets the storage configuration.
   * @returns The current storage configuration options.
   */ get config() {
        return this.genericConfig;
    }
    /**
   * Saves upload metadata to the metadata storage.
   * @param file File object containing metadata to save.
   * @returns Promise resolving to the saved file object.
   * @remarks Updates timestamps and caches the file metadata.
   */ async saveMeta(file) {
        this.updateTimestamps(file);
        this.cache.set(file.id, file);
        return this.meta.save(file.id, file);
    }
    /**
   * Deletes upload metadata from the metadata storage.
   * @param id File ID whose metadata should be deleted.
   * @returns Promise resolving when metadata is deleted.
   * @remarks Also removes the file from the cache.
   */ async deleteMeta(id) {
        this.cache.delete(id);
        return this.meta.delete(id);
    }
    /**
   * Retrieves upload metadata by file ID.
   * @param id File ID to retrieve metadata for.
   * @returns Promise resolving to the file metadata object.
   * @throws {UploadError} If the file metadata cannot be found (ERRORS.FILE_NOT_FOUND).
   * @remarks Caches the retrieved metadata for faster subsequent access.
   */ async getMeta(id) {
        try {
            const file = await this.meta.get(id);
            this.cache.set(file.id, file);
            return {
                ...file
            };
        } catch  {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["throwErrorCode"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ERRORS"].FILE_NOT_FOUND);
        }
    }
    /**
   * Checks if a file has expired and deletes it if so.
   * @param file File object to check for expiration.
   * @returns Promise resolving to the file object if not expired.
   * @throws {UploadError} If the file has expired (ERRORS.GONE).
   * @remarks If the file is expired, it is automatically deleted and the metadata is removed.
   */ async checkIfExpired(file) {
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$is$2d$expired$2d$CTThU1q5$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["i"])(file)) {
            void this.delete(file).catch(()=>void 0);
            void this.deleteMeta(file.id).catch(()=>void 0);
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["throwErrorCode"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ERRORS"].GONE);
        }
        return file;
    }
    /**
   * Searches for and purges expired uploads.
   * @param maxAge Maximum age of files to keep (files older than this will be purged).
   * Can be a number (milliseconds) or string (e.g., "1h", "30m", "7d").
   * If not provided, uses the expiration.maxAge from configuration.
   * @returns Promise resolving to a list of purged files.
   * @remarks
   * Errors during individual file deletions are logged but do not stop the purge process.
   * Files with corrupted metadata are skipped with a warning.
   * Uses rolling expiration if configured (based on modifiedAt) or fixed expiration (based on createdAt).
   */ async purge(maxAge) {
        return this.instrumentOperation("purge", async ()=>{
            const maxAgeMs = toMilliseconds(maxAge || this.expiration?.maxAge);
            const purged = {
                items: [],
                maxAgeMs
            };
            if (maxAgeMs) {
                const before = Date.now() - maxAgeMs;
                const list = await this.list();
                const expired = list.filter((item)=>Number(new Date(this.expiration?.rolling ? item.modifiedAt || item.createdAt : item.createdAt)) < before);
                for await (const { id, ...rest } of expired){
                    try {
                        const deleted = await this.delete({
                            id
                        });
                        purged.items.push({
                            ...deleted,
                            ...rest
                        });
                    } catch (error) {
                        this.logger?.warn(`Failed to delete file ${id} during purge: ${error instanceof Error ? error.message : String(error)}`);
                    }
                }
                if (purged.items.length > 0) {
                    this.logger?.info(`Purge: removed ${purged.items.length} uploads`);
                    this.metrics.gauge("storage.operations.purge.items_count", purged.items.length, {
                        storage: this.constructor.name.toLowerCase().replace("storage", "")
                    });
                }
            }
            return purged;
        });
    }
    /**
   * Gets an uploaded file as a readable stream for efficient large file handling.
   * @param query File query containing the file ID to stream.
   * @param query.id File ID to stream.
   * @returns Promise resolving to an object containing the stream, headers, and size.
   * @throws {UploadError} If the file cannot be found (ERRORS.FILE_NOT_FOUND) or has expired (ERRORS.GONE).
   * @remarks
   * Default implementation falls back to get() and creates a stream from the buffer.
   * Storage implementations should override this for better streaming performance.
   * Headers include Content-Type, Content-Length, ETag, and Last-Modified.
   */ async getStream({ id }) {
        return this.instrumentOperation("getStream", async ()=>{
            const file = await this.get({
                id
            });
            const stream = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$stream__$5b$external$5d$__$28$node$3a$stream$2c$__cjs$29$__["Readable"].from(file.content);
            return {
                headers: {
                    "Content-Length": String(file.size),
                    "Content-Type": file.contentType,
                    ...file.ETag && {
                        ETag: file.ETag
                    },
                    ...file.modifiedAt && {
                        "Last-Modified": file.modifiedAt.toString()
                    }
                },
                size: typeof file.size === "number" ? file.size : void 0,
                stream
            };
        });
    }
    /**
   * Retrieves a list of uploaded files.
   * @param _limit Maximum number of files to return (default: 1000).
   * @returns Promise resolving to an array of file metadata objects.
   * @throws {Error} If not implemented by the storage backend.
   * @remarks Storage implementations must override this method.
   */ async list(_limit = 1e3) {
        return this.instrumentOperation("list", async ()=>{
            throw new Error("Not implemented");
        });
    }
    /**
   * Updates file metadata with user-provided key-value pairs.
   * @param query File query containing the file ID to update.
   * @param query.id File ID to update.
   * @param metadata Partial file object containing fields to update.
   * @returns Promise resolving to the updated file object.
   * @throws {UploadError} If the file cannot be found (ERRORS.FILE_NOT_FOUND).
   * @remarks
   * Supports TTL (time-to-live) option: if metadata contains a 'ttl' field,
   * it will be converted to an 'expiredAt' timestamp.
   * TTL can be a number (milliseconds) or string (e.g., "1h", "30m", "7d").
   */ async update({ id }, metadata) {
        return this.instrumentOperation("update", async ()=>{
            const file = await this.getMeta(id);
            const processedMetadata = {
                ...metadata
            };
            if ("ttl" in processedMetadata && processedMetadata.ttl !== void 0) {
                const ttlValue = processedMetadata.ttl;
                const ttlMs = typeof ttlValue === "string" ? toMilliseconds(ttlValue) : ttlValue;
                if (ttlMs !== void 0) {
                    processedMetadata.expiredAt = Date.now() + ttlMs;
                }
                delete processedMetadata.ttl;
            }
            updateMetadata(file, processedMetadata);
            await this.saveMeta(file);
            const updatedFile = {
                ...file,
                status: "updated"
            };
            await this.onUpdate(updatedFile);
            return updatedFile;
        });
    }
    /**
   * Deletes multiple files in a single batch operation.
   * @param ids Array of file IDs to delete.
   * @returns Promise resolving to batch operation response with successful and failed deletions.
   * @remarks
   * Processes all deletions in parallel using Promise.allSettled.
   * Individual failures do not stop the batch operation.
   * Each deletion is wrapped in error handling to capture failures.
   * Metrics are recorded for the batch operation and individual failures.
   * Returns both successful and failed operations with detailed error information.
   */ async deleteBatch(ids) {
        const startTime = Date.now();
        const storageType = this.constructor.name.toLowerCase().replace("storage", "");
        this.metrics.increment("storage.operations.batch.delete.count", 1, {
            batch_size: ids.length,
            storage: storageType
        });
        const successful = [];
        const failed = [];
        const deletePromises = ids.map(async (id)=>{
            try {
                const file = await this.delete({
                    id
                });
                return {
                    file,
                    id,
                    success: true
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Delete failed";
                this.metrics.increment("storage.operations.delete.error.count", 1, {
                    error: errorMessage,
                    storage: storageType
                });
                return {
                    error: errorMessage,
                    id,
                    success: false
                };
            }
        });
        const results = await Promise.allSettled(deletePromises);
        for (const result of results){
            if (result.status === "fulfilled") {
                if (result.value.success) {
                    successful.push(result.value.file);
                } else {
                    failed.push({
                        error: result.value.error,
                        id: result.value.id
                    });
                }
            } else {
                failed.push({
                    error: result.reason?.message || "Delete failed",
                    id: ""
                });
            }
        }
        const duration = Date.now() - startTime;
        this.metrics.timing("storage.operations.batch.delete.duration", duration, {
            batch_size: ids.length,
            storage: storageType
        });
        this.metrics.gauge("storage.operations.batch.delete.success_count", successful.length, {
            storage: storageType
        });
        this.metrics.gauge("storage.operations.batch.delete.failed_count", failed.length, {
            storage: storageType
        });
        return {
            failed,
            failedCount: failed.length,
            successful,
            successfulCount: successful.length
        };
    }
    /**
   * Copies multiple files in a single batch operation.
   * @param operations Array of copy operations, each containing:
   * source: Source file ID.
   * destination: Destination file ID or path.
   * options: Optional copy options including storage class.
   * @returns Promise resolving to batch operation response with successful and failed copies.
   * @remarks
   * Processes all copies in parallel using Promise.allSettled.
   * Individual failures do not stop the batch operation.
   * Each copy operation is wrapped in error handling to capture failures.
   * Metrics are recorded for the batch operation and individual failures.
   * Returns both successful and failed operations with detailed error information.
   */ async copyBatch(operations) {
        const startTime = Date.now();
        const storageType = this.constructor.name.toLowerCase().replace("storage", "");
        this.metrics.increment("storage.operations.batch.copy.count", 1, {
            batch_size: operations.length,
            storage: storageType
        });
        const successful = [];
        const failed = [];
        const copyPromises = operations.map(async ({ destination, options, source })=>{
            try {
                const copiedFile = await this.copy(source, destination, options);
                return {
                    file: copiedFile,
                    id: destination,
                    success: true
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Copy failed";
                this.metrics.increment("storage.operations.copy.error.count", 1, {
                    error: errorMessage,
                    storage: storageType
                });
                return {
                    error: errorMessage,
                    id: destination,
                    success: false
                };
            }
        });
        const results = await Promise.allSettled(copyPromises);
        for (const result of results){
            if (result.status === "fulfilled") {
                if (result.value.success && result.value.file) {
                    successful.push(result.value.file);
                } else {
                    failed.push({
                        error: result.value.error || "Copy failed",
                        id: result.value.id
                    });
                }
            } else {
                failed.push({
                    error: result.reason?.message || "Copy failed",
                    id: ""
                });
            }
        }
        const duration = Date.now() - startTime;
        this.metrics.timing("storage.operations.batch.copy.duration", duration, {
            batch_size: operations.length,
            storage: storageType
        });
        this.metrics.gauge("storage.operations.batch.copy.success_count", successful.length, {
            storage: storageType
        });
        this.metrics.gauge("storage.operations.batch.copy.failed_count", failed.length, {
            storage: storageType
        });
        return {
            failed,
            failedCount: failed.length,
            successful,
            successfulCount: successful.length
        };
    }
    /**
   * Moves multiple files in a single batch operation.
   * @param operations Array of move operations, each containing:
   * source: Source file ID.
   * destination: Destination file ID or path.
   * @returns Promise resolving to batch operation response with successful and failed moves.
   * @remarks
   * Processes all moves in parallel using Promise.allSettled.
   * Individual failures do not stop the batch operation.
   * Each move operation is wrapped in error handling to capture failures.
   * Metrics are recorded for the batch operation and individual failures.
   * Returns both successful and failed operations with detailed error information.
   */ async moveBatch(operations) {
        const startTime = Date.now();
        const storageType = this.constructor.name.toLowerCase().replace("storage", "");
        this.metrics.increment("storage.operations.batch.move.count", 1, {
            batch_size: operations.length,
            storage: storageType
        });
        const successful = [];
        const failed = [];
        const movePromises = operations.map(async ({ destination, source })=>{
            try {
                const movedFile = await this.move(source, destination);
                return {
                    file: movedFile,
                    id: destination,
                    success: true
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Move failed";
                this.metrics.increment("storage.operations.move.error.count", 1, {
                    error: errorMessage,
                    storage: storageType
                });
                return {
                    error: errorMessage,
                    id: destination,
                    success: false
                };
            }
        });
        const results = await Promise.allSettled(movePromises);
        for (const result of results){
            if (result.status === "fulfilled") {
                if (result.value.success && result.value.file) {
                    successful.push(result.value.file);
                } else {
                    failed.push({
                        error: result.value.error || "Move failed",
                        id: result.value.id
                    });
                }
            } else {
                failed.push({
                    error: result.reason?.message || "Move failed",
                    id: result.reason?.id || ""
                });
            }
        }
        const duration = Date.now() - startTime;
        this.metrics.timing("storage.operations.batch.move.duration", duration, {
            batch_size: operations.length,
            storage: storageType
        });
        this.metrics.gauge("storage.operations.batch.move.success_count", successful.length, {
            storage: storageType
        });
        this.metrics.gauge("storage.operations.batch.move.failed_count", failed.length, {
            storage: storageType
        });
        return {
            failed,
            failedCount: failed.length,
            successful,
            successfulCount: successful.length
        };
    }
    /**
   * Prevent upload from being accessed by multiple requests
   */ async lock(key) {
        const activeUploads = [
            ...this.locker.keys()
        ];
        if (activeUploads.includes(key)) {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["throwErrorCode"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ERRORS"].FILE_LOCKED);
        }
        if (this.config.concurrency && typeof this.config.concurrency === "number" && this.config.concurrency < activeUploads.length) {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["throwErrorCode"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ERRORS"].STORAGE_BUSY);
        }
        this.locker.set(key, key);
        return key;
    }
    async unlock(key) {
        this.locker.unlock(key);
    }
    isUnsupportedChecksum(algorithm = "") {
        return !!algorithm && !this.checksumTypes.includes(algorithm);
    }
    startAutoPurge(purgeInterval) {
        if (purgeInterval >= 2147483647) {
            throw new Error("“purgeInterval” must be less than 2147483647 ms");
        }
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$timers__$5b$external$5d$__$28$node$3a$timers$2c$__cjs$29$__["setInterval"])(()=>void this.purge().catch((error)=>this.logger?.error(error)), purgeInterval);
    }
    updateTimestamps(file) {
        file.createdAt ??= /* @__PURE__ */ new Date().toISOString();
        const maxAgeMs = toMilliseconds(this.expiration?.maxAge);
        if (maxAgeMs && !file.expiredAt) {
            file.expiredAt = this.expiration?.rolling ? Date.now() + maxAgeMs : +new Date(file.createdAt) + maxAgeMs;
        }
        return file;
    }
    /**
   * Instruments a storage operation with metrics and error tracking.
   * @param operation Operation name (e.g., "create", "delete", "copy").
   * @param function_ The operation function to execute.
   * @param attributes Additional attributes to include in metrics.
   * @returns Promise resolving to the operation result.
   * @throws Re-throws any errors from the operation function.
   * @remarks
   * Records operation count, duration, and error metrics.
   * Tracks file sizes for operations returning file objects.
   * Error metrics include error messages for debugging.
   * All public methods should use this wrapper for consistent instrumentation.
   */ async instrumentOperation(operation, function_, attributes) {
        const startTime = Date.now();
        const storageType = this.constructor.name.toLowerCase().replace("storage", "");
        const baseAttributes = {
            storage: storageType,
            ...attributes
        };
        try {
            this.metrics.increment(`storage.operations.${operation}.count`, 1, baseAttributes);
            const result = await function_();
            const duration = Date.now() - startTime;
            this.metrics.timing(`storage.operations.${operation}.duration`, duration, baseAttributes);
            if (result && typeof result === "object" && "size" in result && typeof result.size === "number") {
                this.metrics.gauge("storage.files.size", result.size, {
                    ...baseAttributes,
                    operation
                });
            }
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            this.metrics.timing(`storage.operations.${operation}.duration`, duration, {
                ...baseAttributes,
                error: "true"
            });
            this.metrics.increment(`storage.operations.${operation}.error.count`, 1, {
                ...baseAttributes,
                error: errorMessage
            });
            throw error;
        }
    }
}
;
}),
"[externals]/node:os [external] (node:os, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:os", () => require("node:os"));

module.exports = mod;
}),
"[project]/packages/storage/dist/packem_shared/MetaStorage-pECeFOad.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>MetaStorage
]);
class MetaStorage {
    prefix = "";
    suffix = "";
    logger;
    constructor(config){
        this.prefix = config?.prefix ?? "";
        this.suffix = config?.suffix ?? ".META";
        this.logger = config?.logger;
    }
    /**
   * Saves upload metadata.
   */ // eslint-disable-next-line class-methods-use-this
    async save(_id, file) {
        return file;
    }
    /**
   * Deletes an upload metadata.
   */ // eslint-disable-next-line class-methods-use-this
    async delete(_id) {
        throw new Error("Not implemented");
    }
    /**
   * Retrieves upload metadata.
   */ // eslint-disable-next-line class-methods-use-this
    async get(_id) {
        throw new Error("Not implemented");
    }
    /**
   * Marks upload active.
   */ // eslint-disable-next-line class-methods-use-this
    async touch(_id, _file) {
        throw new Error("Not implemented");
    }
    getMetaName(id) {
        return this.prefix + id + this.suffix;
    }
    getIdFromMetaName(name) {
        return name.slice(this.prefix.length, -this.suffix.length);
    }
}
;
}),
"[project]/packages/storage/dist/packem_shared/Metadata-v9haqHC6.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Metadata",
    ()=>Metadata,
    "isMetadata",
    ()=>isMetadata,
    "parseMetadata",
    ()=>parseMetadata,
    "stringifyMetadata",
    ()=>stringifyMetadata,
    "validateKey",
    ()=>validateKey,
    "validateValue",
    ()=>validateValue
]);
const isRecord = (x)=>x !== null && typeof x === "object" && !Array.isArray(x);
const ASCII_SPACE = " ".codePointAt(0) ?? 32;
const ASCII_COMMA = ",".codePointAt(0) ?? 44;
const BASE64_REGEX = /^[\d+/A-Z]*={0,2}$/i;
const isNumeric = (input)=>{
    if (typeof input !== "string") {
        return false;
    }
    const number_ = Number.parseFloat(input);
    return !Number.isNaN(number_) && isFinite(number_);
};
class Metadata {
    psize;
    pname;
    pfiletype;
    ptype;
    pmimeType;
    pcontentType;
    ptitle;
    pfilename;
    poriginalName;
    plastModified;
}
const isMetadata = (raw)=>isRecord(raw);
const validateKey = (key)=>{
    if (key.length === 0) {
        return false;
    }
    for(let index = 0; index < key.length; ++index){
        const charCodePoint = key.codePointAt(index);
        if (charCodePoint > 127 || charCodePoint === ASCII_SPACE || charCodePoint === ASCII_COMMA) {
            return false;
        }
    }
    return true;
};
const validateValue = (value)=>{
    if (value.length % 4 !== 0) {
        return false;
    }
    return BASE64_REGEX.test(value);
};
const stringifyMetadata = (metadata)=>Object.entries(metadata).map(([key, value])=>{
        if (value === null || value === void 0) {
            return key;
        }
        const stringValue = typeof value === "object" ? JSON.stringify(value) : String(value);
        const encodedValue = Buffer.from(stringValue, "utf8").toString("base64");
        return `${key} ${encodedValue}`;
    }).join(",");
const parseMetadata = (string_)=>{
    const meta = {};
    if (!string_ || string_.trim().length === 0) {
        throw new Error("Metadata string is not valid");
    }
    for (const pair of string_.split(",")){
        const tokens = pair.split(" ");
        const [key, value] = tokens;
        if ((tokens.length === 1 || tokens.length === 2) && validateKey(key) && (tokens.length === 1 || validateValue(value)) && !(key in meta)) {
            const decodedValue = tokens.length === 1 ? void 0 : value ? Buffer.from(value, "base64").toString("utf8") : "";
            let parsedValue = decodedValue;
            if (decodedValue !== void 0) {
                try {
                    parsedValue = JSON.parse(decodedValue);
                } catch  {
                    if (decodedValue === "true") {
                        parsedValue = true;
                    } else if (decodedValue === "false") {
                        parsedValue = false;
                    } else if (isNumeric(decodedValue)) {
                        parsedValue = Number(decodedValue);
                    }
                }
            }
            meta[key] = parsedValue;
        } else {
            throw new Error("Metadata string is not valid");
        }
    }
    return meta;
};
;
}),
"[externals]/node:module [external] (node:module, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:module", () => require("node:module"));

module.exports = mod;
}),
"[project]/packages/storage/dist/packem_shared/local-meta-storage-CsuVst9V.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "L",
    ()=>LocalMetaStorage,
    "a",
    ()=>assertValidFileOrDirectoryPath,
    "b",
    ()=>readFile,
    "e",
    ()=>ensureDir,
    "g",
    ()=>getFileInfoType,
    "i",
    ()=>isAccessible,
    "r",
    ()=>remove,
    "t",
    ()=>toPath
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs$2f$promises__$5b$external$5d$__$28$node$3a$fs$2f$promises$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:fs/promises [external] (node:fs/promises, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$os__$5b$external$5d$__$28$node$3a$os$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:os [external] (node:os, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/ERRORS-DKaR93nv.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$MetaStorage$2d$pECeFOad$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/MetaStorage-pECeFOad.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$Metadata$2d$v9haqHC6$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/Metadata-v9haqHC6.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$path$2d$CR6YkPXX$2d$7R1$2d$9CMk$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/path-CR6YkPXX-7R1-9CMk.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$module__$5b$external$5d$__$28$node$3a$module$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:module [external] (node:module, cjs)");
const __TURBOPACK__import$2e$meta__ = {
    get url () {
        return `file://${__turbopack_context__.P("packages/storage/dist/packem_shared/local-meta-storage-CsuVst9V.js")}`;
    }
};
;
;
;
;
;
;
;
const F_OK = 0;
const R_OK = 4;
const assertValidFileOrDirectoryPath = (fileOrDirectoryPath)=>{
    if (!fileOrDirectoryPath || !(fileOrDirectoryPath instanceof URL) && typeof fileOrDirectoryPath !== "string") {
        throw new TypeError("Path must be a non-empty string or URL.");
    }
};
const getFileInfoType = (fileInfo)=>{
    if (fileInfo.isFile()) {
        return "file";
    }
    if (fileInfo.isDirectory()) {
        return "dir";
    }
    if (fileInfo.isSymbolicLink()) {
        return "symlink";
    }
    return void 0;
};
const __cjs_require$5 = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$module__$5b$external$5d$__$28$node$3a$module$2c$__cjs$29$__["createRequire"])(__TURBOPACK__import$2e$meta__.url);
const __cjs_getProcess$5 = typeof globalThis !== "undefined" && typeof globalThis.process !== "undefined" ? globalThis.process : process;
const __cjs_getBuiltinModule$5 = (module)=>{
    if (typeof __cjs_getProcess$5 !== "undefined" && __cjs_getProcess$5.versions && __cjs_getProcess$5.versions.node) {
        const [major, minor] = __cjs_getProcess$5.versions.node.split(".").map(Number);
        if (major > 22 || major === 22 && minor >= 3 || major === 20 && minor >= 16) {
            return __cjs_getProcess$5.getBuiltinModule(module);
        }
    }
    return (()=>{
        const e = new Error("Cannot find module as expression is too dynamic");
        e.code = 'MODULE_NOT_FOUND';
        throw e;
    })();
};
const { lstat, mkdir: mkdir$1 } = __cjs_getBuiltinModule$5("node:fs/promises");
const ensureDir = async (directory)=>{
    assertValidFileOrDirectoryPath(directory);
    try {
        const fileInfo = await lstat(directory);
        if (!fileInfo.isDirectory()) {
            throw new Error(`Ensure path exists, expected 'dir', got '${getFileInfoType(fileInfo)}'`);
        }
        return;
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }
    try {
        await mkdir$1(directory, {
            recursive: true
        });
    } catch (error) {
        if (error.code !== "EEXIST") {
            throw error;
        }
        const fileInfo = await lstat(directory);
        if (!fileInfo.isDirectory()) {
            throw new Error(`Ensure path exists, expected 'dir', got '${getFileInfoType(fileInfo)}'`);
        }
    }
};
const __cjs_require$4 = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$module__$5b$external$5d$__$28$node$3a$module$2c$__cjs$29$__["createRequire"])(__TURBOPACK__import$2e$meta__.url);
const __cjs_getProcess$4 = typeof globalThis !== "undefined" && typeof globalThis.process !== "undefined" ? globalThis.process : process;
const __cjs_getBuiltinModule$4 = (module)=>{
    if (typeof __cjs_getProcess$4 !== "undefined" && __cjs_getProcess$4.versions && __cjs_getProcess$4.versions.node) {
        const [major, minor] = __cjs_getProcess$4.versions.node.split(".").map(Number);
        if (major > 22 || major === 22 && minor >= 3 || major === 20 && minor >= 16) {
            return __cjs_getProcess$4.getBuiltinModule(module);
        }
    }
    return (()=>{
        const e = new Error("Cannot find module as expression is too dynamic");
        e.code = 'MODULE_NOT_FOUND';
        throw e;
    })();
};
const { fileURLToPath } = __cjs_getBuiltinModule$4("node:url");
function getDefaultExportFromCjs(x) {
    return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var binaryExtensions$1;
var hasRequiredBinaryExtensions;
function requireBinaryExtensions() {
    if (hasRequiredBinaryExtensions) return binaryExtensions$1;
    hasRequiredBinaryExtensions = 1;
    binaryExtensions$1 = [
        "3dm",
        "3ds",
        "3g2",
        "3gp",
        "7z",
        "a",
        "aac",
        "adp",
        "afdesign",
        "afphoto",
        "afpub",
        "ai",
        "aif",
        "aiff",
        "alz",
        "ape",
        "apk",
        "appimage",
        "ar",
        "arj",
        "asf",
        "au",
        "avi",
        "bak",
        "baml",
        "bh",
        "bin",
        "bk",
        "bmp",
        "btif",
        "bz2",
        "bzip2",
        "cab",
        "caf",
        "cgm",
        "class",
        "cmx",
        "cpio",
        "cr2",
        "cr3",
        "cur",
        "dat",
        "dcm",
        "deb",
        "dex",
        "djvu",
        "dll",
        "dmg",
        "dng",
        "doc",
        "docm",
        "docx",
        "dot",
        "dotm",
        "dra",
        "DS_Store",
        "dsk",
        "dts",
        "dtshd",
        "dvb",
        "dwg",
        "dxf",
        "ecelp4800",
        "ecelp7470",
        "ecelp9600",
        "egg",
        "eol",
        "eot",
        "epub",
        "exe",
        "f4v",
        "fbs",
        "fh",
        "fla",
        "flac",
        "flatpak",
        "fli",
        "flv",
        "fpx",
        "fst",
        "fvt",
        "g3",
        "gh",
        "gif",
        "graffle",
        "gz",
        "gzip",
        "h261",
        "h263",
        "h264",
        "icns",
        "ico",
        "ief",
        "img",
        "ipa",
        "iso",
        "jar",
        "jpeg",
        "jpg",
        "jpgv",
        "jpm",
        "jxr",
        "key",
        "ktx",
        "lha",
        "lib",
        "lvp",
        "lz",
        "lzh",
        "lzma",
        "lzo",
        "m3u",
        "m4a",
        "m4v",
        "mar",
        "mdi",
        "mht",
        "mid",
        "midi",
        "mj2",
        "mka",
        "mkv",
        "mmr",
        "mng",
        "mobi",
        "mov",
        "movie",
        "mp3",
        "mp4",
        "mp4a",
        "mpeg",
        "mpg",
        "mpga",
        "mxu",
        "nef",
        "npx",
        "numbers",
        "nupkg",
        "o",
        "odp",
        "ods",
        "odt",
        "oga",
        "ogg",
        "ogv",
        "otf",
        "ott",
        "pages",
        "pbm",
        "pcx",
        "pdb",
        "pdf",
        "pea",
        "pgm",
        "pic",
        "png",
        "pnm",
        "pot",
        "potm",
        "potx",
        "ppa",
        "ppam",
        "ppm",
        "pps",
        "ppsm",
        "ppsx",
        "ppt",
        "pptm",
        "pptx",
        "psd",
        "pya",
        "pyc",
        "pyo",
        "pyv",
        "qt",
        "rar",
        "ras",
        "raw",
        "resources",
        "rgb",
        "rip",
        "rlc",
        "rmf",
        "rmvb",
        "rpm",
        "rtf",
        "rz",
        "s3m",
        "s7z",
        "scpt",
        "sgi",
        "shar",
        "snap",
        "sil",
        "sketch",
        "slk",
        "smv",
        "snk",
        "so",
        "stl",
        "suo",
        "sub",
        "swf",
        "tar",
        "tbz",
        "tbz2",
        "tga",
        "tgz",
        "thmx",
        "tif",
        "tiff",
        "tlz",
        "ttc",
        "ttf",
        "txz",
        "udf",
        "uvh",
        "uvi",
        "uvm",
        "uvp",
        "uvs",
        "uvu",
        "viv",
        "vob",
        "war",
        "wav",
        "wax",
        "wbmp",
        "wdp",
        "weba",
        "webm",
        "webp",
        "whl",
        "wim",
        "wm",
        "wma",
        "wmv",
        "wmx",
        "woff",
        "woff2",
        "wrm",
        "wvx",
        "xbm",
        "xif",
        "xla",
        "xlam",
        "xls",
        "xlsb",
        "xlsm",
        "xlsx",
        "xlt",
        "xltm",
        "xltx",
        "xm",
        "xmind",
        "xpi",
        "xpm",
        "xwd",
        "xz",
        "z",
        "zip",
        "zipx"
    ];
    return binaryExtensions$1;
}
var binaryExtensionsExports = /* @__PURE__ */ requireBinaryExtensions();
const binaryExtensions = /* @__PURE__ */ getDefaultExportFromCjs(binaryExtensionsExports);
new Set(binaryExtensions);
const toPath = (urlOrPath)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$path$2d$CR6YkPXX$2d$7R1$2d$9CMk$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["a"])(urlOrPath instanceof URL ? fileURLToPath(urlOrPath) : urlOrPath);
const __cjs_require$3 = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$module__$5b$external$5d$__$28$node$3a$module$2c$__cjs$29$__["createRequire"])(__TURBOPACK__import$2e$meta__.url);
const __cjs_getProcess$3 = typeof globalThis !== "undefined" && typeof globalThis.process !== "undefined" ? globalThis.process : process;
const __cjs_getBuiltinModule$3 = (module)=>{
    if (typeof __cjs_getProcess$3 !== "undefined" && __cjs_getProcess$3.versions && __cjs_getProcess$3.versions.node) {
        const [major, minor] = __cjs_getProcess$3.versions.node.split(".").map(Number);
        if (major > 22 || major === 22 && minor >= 3 || major === 20 && minor >= 16) {
            return __cjs_getProcess$3.getBuiltinModule(module);
        }
    }
    return (()=>{
        const e = new Error("Cannot find module as expression is too dynamic");
        e.code = 'MODULE_NOT_FOUND';
        throw e;
    })();
};
const { access } = __cjs_getBuiltinModule$3("node:fs/promises");
async function isAccessible(path, mode = F_OK) {
    assertValidFileOrDirectoryPath(path);
    path = toPath(path);
    try {
        await access(path, mode);
        return true;
    } catch  {
        return false;
    }
}
class PermissionError extends Error {
    /**
   * Creates a new instance.
   * @param message
   */ constructor(message){
        super(`EPERM: Operation not permitted, ${message}`);
    }
    // eslint-disable-next-line class-methods-use-this
    get code() {
        return "EPERM";
    }
    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    set code(_name) {
        throw new Error("Cannot overwrite code EPERM");
    }
    // eslint-disable-next-line class-methods-use-this
    get name() {
        return "PermissionError";
    }
    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    set name(_name) {
        throw new Error("Cannot overwrite name of PermissionError");
    }
}
const __cjs_require$2 = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$module__$5b$external$5d$__$28$node$3a$module$2c$__cjs$29$__["createRequire"])(__TURBOPACK__import$2e$meta__.url);
const __cjs_getProcess$2 = typeof globalThis !== "undefined" && typeof globalThis.process !== "undefined" ? globalThis.process : process;
const __cjs_getBuiltinModule$2 = (module)=>{
    if (typeof __cjs_getProcess$2 !== "undefined" && __cjs_getProcess$2.versions && __cjs_getProcess$2.versions.node) {
        const [major, minor] = __cjs_getProcess$2.versions.node.split(".").map(Number);
        if (major > 22 || major === 22 && minor >= 3 || major === 20 && minor >= 16) {
            return __cjs_getProcess$2.getBuiltinModule(module);
        }
    }
    return (()=>{
        const e = new Error("Cannot find module as expression is too dynamic");
        e.code = 'MODULE_NOT_FOUND';
        throw e;
    })();
};
const { readFile: readFile$1 } = __cjs_getBuiltinModule$2("node:fs/promises");
const { unzip, brotliDecompress } = __cjs_getBuiltinModule$2("node:zlib");
const decompressionMethods = {
    brotli: brotliDecompress,
    gzip: unzip,
    none: (buffer, callback)=>{
        callback(null, buffer);
    }
};
const readFile = async (path, options)=>{
    assertValidFileOrDirectoryPath(path);
    path = toPath(path);
    if (!await isAccessible(path)) {
        throw new PermissionError(`unable to read the non-accessible file: ${path}`);
    }
    if (!await isAccessible(path, R_OK)) {
        throw new Error(`Unable to read the non-readable file: ${path}`);
    }
    const { buffer, compression, encoding, flag } = options ?? {};
    return await readFile$1(path, flag ? {
        encoding,
        flag
    } : {
        encoding
    }).then(async (content)=>await new Promise((resolve, reject)=>{
            decompressionMethods[compression ?? "none"](content, (error, result)=>{
                if (error) {
                    reject(error);
                } else {
                    resolve(buffer ? result : result.toString());
                }
            });
        })).catch((error)=>{
        throw error;
    });
};
const __cjs_require$1 = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$module__$5b$external$5d$__$28$node$3a$module$2c$__cjs$29$__["createRequire"])(__TURBOPACK__import$2e$meta__.url);
const __cjs_getProcess$1 = typeof globalThis !== "undefined" && typeof globalThis.process !== "undefined" ? globalThis.process : process;
const __cjs_getBuiltinModule$1 = (module)=>{
    if (typeof __cjs_getProcess$1 !== "undefined" && __cjs_getProcess$1.versions && __cjs_getProcess$1.versions.node) {
        const [major, minor] = __cjs_getProcess$1.versions.node.split(".").map(Number);
        if (major > 22 || major === 22 && minor >= 3 || major === 20 && minor >= 16) {
            return __cjs_getProcess$1.getBuiltinModule(module);
        }
    }
    return (()=>{
        const e = new Error("Cannot find module as expression is too dynamic");
        e.code = 'MODULE_NOT_FOUND';
        throw e;
    })();
};
const { unlink: unlink$1, rm } = __cjs_getBuiltinModule$1("node:fs/promises");
const remove = async (path, options = {})=>{
    assertValidFileOrDirectoryPath(path);
    try {
        await unlink$1(path);
    } catch  {}
    try {
        await rm(path, {
            force: true,
            maxRetries: options?.maxRetries,
            recursive: true,
            retryDelay: options?.retryDelay
        });
    } catch  {}
};
const assertValidFileContents = (contents)=>{
    if (typeof contents !== "string" && !(contents instanceof ArrayBuffer) && !ArrayBuffer.isView(contents)) {
        throw new TypeError("File contents must be a string, ArrayBuffer, or ArrayBuffer view.");
    }
};
const encoder = new TextEncoder();
const toUint8Array = (contents)=>{
    if (contents instanceof Uint8Array) {
        return contents;
    }
    if (typeof contents === "string") {
        return encoder.encode(contents);
    }
    if (contents instanceof ArrayBuffer) {
        return new Uint8Array(contents);
    }
    if (ArrayBuffer.isView(contents)) {
        const bytes = contents.buffer.slice(contents.byteOffset, contents.byteOffset + contents.byteLength);
        return new Uint8Array(bytes);
    }
    throw new TypeError("Invalid contents type. Expected string or ArrayBuffer.");
};
const __cjs_require = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$module__$5b$external$5d$__$28$node$3a$module$2c$__cjs$29$__["createRequire"])(__TURBOPACK__import$2e$meta__.url);
const __cjs_getProcess = typeof globalThis !== "undefined" && typeof globalThis.process !== "undefined" ? globalThis.process : process;
const __cjs_getBuiltinModule = (module)=>{
    if (typeof __cjs_getProcess !== "undefined" && __cjs_getProcess.versions && __cjs_getProcess.versions.node) {
        const [major, minor] = __cjs_getProcess.versions.node.split(".").map(Number);
        if (major > 22 || major === 22 && minor >= 3 || major === 20 && minor >= 16) {
            return __cjs_getProcess.getBuiltinModule(module);
        }
    }
    return (()=>{
        const e = new Error("Cannot find module as expression is too dynamic");
        e.code = 'MODULE_NOT_FOUND';
        throw e;
    })();
};
const { mkdir, writeFile: writeFile$1, stat, rename, chown, chmod, unlink } = __cjs_getBuiltinModule("node:fs/promises");
const writeFile = async (path, content, options)=>{
    options = {
        encoding: "utf8",
        flag: "w",
        overwrite: true,
        recursive: true,
        ...options
    };
    assertValidFileOrDirectoryPath(path);
    assertValidFileContents(content);
    path = toPath(path);
    const temporaryPath = `${path}.tmp`;
    try {
        const pathExists = await isAccessible(path, F_OK);
        if (!pathExists && options.recursive) {
            const directory = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$path$2d$CR6YkPXX$2d$7R1$2d$9CMk$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["d"])(path);
            if (!await isAccessible(directory, F_OK)) {
                await mkdir(directory, {
                    recursive: true
                });
            }
        }
        let stat$1;
        await writeFile$1(temporaryPath, toUint8Array(content), {
            encoding: options.encoding,
            flag: options.flag
        });
        if (pathExists && !options.overwrite) {
            stat$1 = await stat(path);
            if (options.chown === void 0) {
                options.chown = {
                    gid: stat$1.gid,
                    uid: stat$1.uid
                };
            }
            await rename(path, `${path}.bak`);
        }
        if (options.chown) {
            try {
                await chown(temporaryPath, options.chown.uid, options.chown.gid);
            } catch  {}
        }
        await chmod(temporaryPath, stat$1 && !options.mode ? stat$1.mode : options.mode ?? 438);
        await rename(temporaryPath, path);
    } catch (error) {
        throw new Error(`Failed to write file at: ${path} - ${error.message}`, {
            cause: error
        });
    } finally{
        if (await isAccessible(temporaryPath)) {
            await unlink(`${path}.tmp`);
        }
    }
};
class LocalMetaStorage extends __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$MetaStorage$2d$pECeFOad$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"] {
    directory;
    constructor(config){
        super(config);
        this.directory = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$path$2d$CR6YkPXX$2d$7R1$2d$9CMk$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["n"])(config?.directory || (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$path$2d$CR6YkPXX$2d$7R1$2d$9CMk$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["j"])((0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$os__$5b$external$5d$__$28$node$3a$os$2c$__cjs$29$__["tmpdir"])(), "Upload_meta"));
        this.accessCheck().catch((error)=>{
            this.logger?.error("Metadata storage access check failed: %O", error);
        });
    }
    /**
   * Returns metafile path.
   * @param id upload id
   */ getMetaPath = (id)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$path$2d$CR6YkPXX$2d$7R1$2d$9CMk$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["n"])(`${this.directory}/${this.prefix}${id}${this.suffix}`);
    /**
   * Returns upload id from metafile path.
   * @internal
   */ getIdFromPath = (metaFilePath)=>metaFilePath.slice(`${this.directory}/${this.prefix}`.length, -this.suffix.length);
    async save(id, file) {
        await this.accessCheck();
        const transformedMetadata = {
            ...file
        };
        if (transformedMetadata.metadata) {
            transformedMetadata.metadata = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$Metadata$2d$v9haqHC6$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["stringifyMetadata"])(file.metadata);
        }
        await writeFile(this.getMetaPath(id), JSON.stringify(transformedMetadata), {
            recursive: true
        });
        return file;
    }
    async touch(id, file) {
        const time = /* @__PURE__ */ new Date();
        await (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs$2f$promises__$5b$external$5d$__$28$node$3a$fs$2f$promises$2c$__cjs$29$__["utimes"])(this.getMetaPath(id), time, time);
        return file;
    }
    async get(id) {
        try {
            const json = await readFile(this.getMetaPath(id));
            if (json === void 0) {
                throw new TypeError("Invalid metafile");
            }
            const file = JSON.parse(json);
            if (file.metadata && typeof file.metadata === "string") {
                file.metadata = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$Metadata$2d$v9haqHC6$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["parseMetadata"])(file.metadata);
            }
            return file;
        } catch (error) {
            if (error instanceof Error && error.message.includes("ENOENT")) {
                throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["throwErrorCode"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ERRORS"].FILE_NOT_FOUND);
            }
            throw error;
        }
    }
    async delete(id) {
        await remove(this.getMetaPath(id));
    }
    async accessCheck() {
        await ensureDir(this.directory);
    }
}
;
}),
"[project]/packages/storage/dist/packem_shared/File-Bb3P23dr.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>File
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sindresorhus$2b$fnv1a$40$3$2e$1$2e$0$2f$node_modules$2f40$sindresorhus$2f$fnv1a$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sindresorhus+fnv1a@3.1.0/node_modules/@sindresorhus/fnv1a/index.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$nanoid$40$5$2e$1$2e$6$2f$node_modules$2f$nanoid$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/nanoid@5.1.6/node_modules/nanoid/index.js [app-route] (ecmascript) <locals>");
;
;
const hash = (value)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sindresorhus$2b$fnv1a$40$3$2e$1$2e$0$2f$node_modules$2f40$sindresorhus$2f$fnv1a$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"])(value, {
        size: 64
    }).toString(16);
const extractMimeType = (meta)=>{
    if (typeof meta.mimeType === "string") {
        return meta.mimeType;
    }
    if (typeof meta.type === "string") {
        return meta.type;
    }
    if (typeof meta.filetype === "string") {
        return meta.filetype;
    }
    return void 0;
};
const extractOriginalName = (meta)=>{
    if (typeof meta.name === "string") {
        return meta.name;
    }
    if (typeof meta.title === "string") {
        return meta.title;
    }
    if (typeof meta.originalName === "string") {
        return meta.originalName;
    }
    if (typeof meta.filename === "string") {
        return meta.filename;
    }
    return void 0;
};
const generateFileId = (file)=>{
    const { metadata, originalName, size } = file;
    const mtime = String(metadata.lastModified ?? Date.now());
    return [
        originalName,
        size,
        mtime
    ].filter(Boolean).map(String).map((value)=>hash(value)).join("-");
};
class File {
    bytesWritten = Number.NaN;
    contentType;
    originalName;
    id;
    metadata;
    name = "";
    size;
    status;
    expiredAt;
    createdAt;
    modifiedAt;
    hash;
    content;
    ETag;
    constructor({ contentType, expiredAt, metadata = {}, originalName, size }){
        this.metadata = metadata;
        this.originalName = originalName || extractOriginalName(metadata) || (this.id = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$nanoid$40$5$2e$1$2e$6$2f$node_modules$2f$nanoid$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["nanoid"])());
        this.contentType = contentType || extractMimeType(metadata) || "application/octet-stream";
        this.expiredAt = expiredAt;
        if (typeof size === "string" || typeof size === "number") {
            this.size = Number(size);
        } else if (typeof metadata.size === "string" || typeof metadata.size === "number") {
            this.size = Number(metadata.size);
        }
        if (typeof this.size === "number" && this.size <= 0) {
            this.size = void 0;
        }
        this.id ||= generateFileId(this);
    }
}
;
}),
"[project]/packages/storage/dist/packem_shared/update-size-CCGm6i1J.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "u",
    ()=>updateSize
]);
const updateSize = (file, size)=>{
    if (size < file.size) {
        file.size = size;
    }
    return file;
};
;
}),
"[project]/packages/storage/dist/packem_shared/has-content-CY66ehMK.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "h",
    ()=>hasContent
]);
const hasContent = (part)=>typeof part.start === "number" && part.start >= 0 && !!part.body;
;
}),
"[project]/packages/storage/dist/packem_shared/disk-storage-Bnldtwqx.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "D",
    ()=>DiskStorage,
    "S",
    ()=>StreamLength,
    "e",
    ()=>ensureFile,
    "s",
    ()=>streamChecksum
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:fs [external] (node:fs, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs$2f$promises__$5b$external$5d$__$28$node$3a$fs$2f$promises$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:fs/promises [external] (node:fs/promises, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$stream__$5b$external$5d$__$28$node$3a$stream$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:stream [external] (node:stream, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$_commonjsHelpers$2d$B85MJLTf$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/_commonjsHelpers-B85MJLTf.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/crypto [external] (crypto, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/fs [external] (fs, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$part$2d$match$2d$CW8Z1naC$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/part-match-CW8Z1naC.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/ERRORS-DKaR93nv.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$storage$2d$qBIeShej$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/storage-qBIeShej.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$local$2d$meta$2d$storage$2d$CsuVst9V$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/local-meta-storage-CsuVst9V.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$File$2d$Bb3P23dr$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/File-Bb3P23dr.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$module__$5b$external$5d$__$28$node$3a$module$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:module [external] (node:module, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$path$2d$CR6YkPXX$2d$7R1$2d$9CMk$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/path-CR6YkPXX-7R1-9CMk.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$update$2d$size$2d$CCGm6i1J$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/update-size-CCGm6i1J.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$has$2d$content$2d$CY66ehMK$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/has-content-CY66ehMK.js [app-route] (ecmascript)");
const __TURBOPACK__import$2e$meta__ = {
    get url () {
        return `file://${__turbopack_context__.P("packages/storage/dist/packem_shared/disk-storage-Bnldtwqx.js")}`;
    }
};
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
const __cjs_require$2 = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$module__$5b$external$5d$__$28$node$3a$module$2c$__cjs$29$__["createRequire"])(__TURBOPACK__import$2e$meta__.url);
const __cjs_getProcess$2 = typeof globalThis !== "undefined" && typeof globalThis.process !== "undefined" ? globalThis.process : process;
const __cjs_getBuiltinModule$2 = (module)=>{
    if (typeof __cjs_getProcess$2 !== "undefined" && __cjs_getProcess$2.versions && __cjs_getProcess$2.versions.node) {
        const [major, minor] = __cjs_getProcess$2.versions.node.split(".").map(Number);
        if (major > 22 || major === 22 && minor >= 3 || major === 20 && minor >= 16) {
            return __cjs_getProcess$2.getBuiltinModule(module);
        }
    }
    return (()=>{
        const e = new Error("Cannot find module as expression is too dynamic");
        e.code = 'MODULE_NOT_FOUND';
        throw e;
    })();
};
const { lstat, writeFile } = __cjs_getBuiltinModule$2("node:fs/promises");
const ensureFile = async (filePath)=>{
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$local$2d$meta$2d$storage$2d$CsuVst9V$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["a"])(filePath);
    try {
        const stat = await lstat(filePath);
        if (!stat.isFile()) {
            throw new Error(`Ensure path exists, expected 'file', got '${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$local$2d$meta$2d$storage$2d$CsuVst9V$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["g"])(stat)}'`);
        }
    } catch (error) {
        if (error.code === "ENOENT") {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$local$2d$meta$2d$storage$2d$CsuVst9V$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["e"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$path$2d$CR6YkPXX$2d$7R1$2d$9CMk$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["d"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$local$2d$meta$2d$storage$2d$CsuVst9V$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["t"])(filePath)));
            await writeFile(filePath, new Uint8Array());
            return;
        }
        throw error;
    }
};
class WalkError extends Error {
    /** File path of the root that's being walked. */ root;
    /**
   * Constructs a new instance.
   * @param cause The underlying error or reason for the walk failure.
   * @param root The root directory path where the walk operation started or encountered the error.
   */ constructor(cause, root){
        super(`${cause instanceof Error ? cause.message : cause} for path "${root}"`);
        this.cause = cause;
        this.root = root;
    }
    // eslint-disable-next-line class-methods-use-this
    get name() {
        return "WalkError";
    }
    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    set name(_name) {
        throw new Error("Cannot overwrite name of WalkError");
    }
}
const globToRegExp = (glob)=>{
    const reString = glob.replace(/\.\*/g, ".([^/]*)").replace(/\*\*/g, "(.*)").replace(/(?<!\.)\*(?!\*)/g, "([^/]*)").replace(/\?/g, "[^/]").replace(/\.(?!\*)/g, String.raw`\.`).replace(/\{/g, "(").replace(/\}/g, ")").replace(/,/g, "|").replace(/\[!(.*?)\]/g, "[^$1]");
    return new RegExp(`^${reString}$`);
};
const walkInclude = (path, extensions, match, skip)=>{
    if (Array.isArray(extensions) && extensions.length > 0 && !extensions.some((extension)=>path.endsWith(extension))) {
        return false;
    }
    if (match && !match.some((pattern)=>pattern.test(path))) {
        return false;
    }
    return !skip?.some((pattern)=>pattern.test(path));
};
const __cjs_require$1 = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$module__$5b$external$5d$__$28$node$3a$module$2c$__cjs$29$__["createRequire"])(__TURBOPACK__import$2e$meta__.url);
const __cjs_getProcess$1 = typeof globalThis !== "undefined" && typeof globalThis.process !== "undefined" ? globalThis.process : process;
const __cjs_getBuiltinModule$1 = (module)=>{
    if (typeof __cjs_getProcess$1 !== "undefined" && __cjs_getProcess$1.versions && __cjs_getProcess$1.versions.node) {
        const [major, minor] = __cjs_getProcess$1.versions.node.split(".").map(Number);
        if (major > 22 || major === 22 && minor >= 3 || major === 20 && minor >= 16) {
            return __cjs_getProcess$1.getBuiltinModule(module);
        }
    }
    return (()=>{
        const e = new Error("Cannot find module as expression is too dynamic");
        e.code = 'MODULE_NOT_FOUND';
        throw e;
    })();
};
const { readdir, realpath, stat } = __cjs_getBuiltinModule$1("node:fs/promises");
const _createWalkEntry = async (path)=>{
    const normalizePath = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$path$2d$CR6YkPXX$2d$7R1$2d$9CMk$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["n"])(path);
    const name = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$path$2d$CR6YkPXX$2d$7R1$2d$9CMk$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["b"])(normalizePath);
    const info = await stat(normalizePath);
    return {
        isDirectory: ()=>info.isDirectory(),
        isFile: ()=>info.isFile(),
        isSymbolicLink: ()=>info.isSymbolicLink(),
        name,
        path: normalizePath
    };
};
async function* walk(directory, { extensions, followSymlinks = false, includeDirs: includeDirectories = true, includeFiles = true, includeSymlinks = true, match, maxDepth = Number.POSITIVE_INFINITY, skip } = {}) {
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$local$2d$meta$2d$storage$2d$CsuVst9V$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["a"])(directory);
    if (maxDepth < 0) {
        return;
    }
    const mappedMatch = match ? match.map((pattern)=>typeof pattern === "string" ? globToRegExp(pattern) : pattern) : void 0;
    const mappedSkip = skip ? skip.map((pattern)=>typeof pattern === "string" ? globToRegExp(pattern) : pattern) : void 0;
    directory = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$path$2d$CR6YkPXX$2d$7R1$2d$9CMk$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["r"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$local$2d$meta$2d$storage$2d$CsuVst9V$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["t"])(directory));
    if (includeDirectories && walkInclude(directory, extensions, mappedMatch, mappedSkip)) {
        yield await _createWalkEntry(directory);
    }
    if (maxDepth < 1 || !walkInclude(directory, void 0, void 0, mappedSkip)) {
        return;
    }
    try {
        for await (const entry of (await readdir(directory, {
            withFileTypes: true
        }))){
            let path = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$path$2d$CR6YkPXX$2d$7R1$2d$9CMk$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["j"])(directory, entry.name);
            if (entry.isSymbolicLink()) {
                if (followSymlinks) {
                    path = await realpath(path);
                } else if (includeSymlinks && walkInclude(path, extensions, mappedMatch, mappedSkip)) {
                    yield {
                        isDirectory: entry.isDirectory,
                        isFile: entry.isFile,
                        isSymbolicLink: entry.isSymbolicLink,
                        name: entry.name,
                        path
                    };
                } else {
                    continue;
                }
            }
            if (entry.isSymbolicLink() || entry.isDirectory()) {
                yield* walk(path, {
                    extensions,
                    followSymlinks,
                    includeDirs: includeDirectories,
                    includeFiles,
                    includeSymlinks,
                    match: mappedMatch,
                    maxDepth: maxDepth - 1,
                    skip: mappedSkip
                });
            } else if (entry.isFile() && includeFiles && walkInclude(path, extensions, mappedMatch, mappedSkip)) {
                yield {
                    isDirectory: ()=>entry.isDirectory(),
                    isFile: ()=>entry.isFile(),
                    isSymbolicLink: ()=>entry.isSymbolicLink(),
                    name: entry.name,
                    path
                };
            }
        }
    } catch (error) {
        if (error instanceof WalkError) {
            throw error;
        }
        throw new WalkError(error, directory);
    }
}
const __cjs_require = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$module__$5b$external$5d$__$28$node$3a$module$2c$__cjs$29$__["createRequire"])(__TURBOPACK__import$2e$meta__.url);
const __cjs_getProcess = typeof globalThis !== "undefined" && typeof globalThis.process !== "undefined" ? globalThis.process : process;
const __cjs_getBuiltinModule = (module)=>{
    if (typeof __cjs_getProcess !== "undefined" && __cjs_getProcess.versions && __cjs_getProcess.versions.node) {
        const [major, minor] = __cjs_getProcess.versions.node.split(".").map(Number);
        if (major > 22 || major === 22 && minor >= 3 || major === 20 && minor >= 16) {
            return __cjs_getProcess.getBuiltinModule(module);
        }
    }
    return (()=>{
        const e = new Error("Cannot find module as expression is too dynamic");
        e.code = 'MODULE_NOT_FOUND';
        throw e;
    })();
};
const { cwd } = __cjs_getProcess;
const { mkdir, rename: rename$1, copyFile, unlink } = __cjs_getBuiltinModule("node:fs/promises");
__cjs_getBuiltinModule("node:fs");
class SameDirectoryError extends Error {
    constructor(source, destination){
        super(`Source directory "${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$path$2d$CR6YkPXX$2d$7R1$2d$9CMk$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["d"])(source)}" does not match destination directory "${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$path$2d$CR6YkPXX$2d$7R1$2d$9CMk$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["d"])(destination)}"`);
        this.name = "SameDirectoryError";
    }
}
const validateSameDirectory = (source, destination)=>{
    if (!source || !destination) {
        throw new Error("Source and destination paths must not be empty");
    }
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$path$2d$CR6YkPXX$2d$7R1$2d$9CMk$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["d"])(source) !== (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$path$2d$CR6YkPXX$2d$7R1$2d$9CMk$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["d"])(destination)) {
        throw new SameDirectoryError(source, destination);
    }
};
const internalMoveFile = async (sourcePath, destinationPath, { cwd: cwd2, directoryMode, overwrite, validateDirectory })=>{
    if (cwd2) {
        sourcePath = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$path$2d$CR6YkPXX$2d$7R1$2d$9CMk$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["r"])(cwd2, sourcePath);
        destinationPath = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$path$2d$CR6YkPXX$2d$7R1$2d$9CMk$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["r"])(cwd2, destinationPath);
    }
    if (validateDirectory) {
        validateSameDirectory(sourcePath, destinationPath);
    }
    if (!overwrite && await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$local$2d$meta$2d$storage$2d$CsuVst9V$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["i"])(destinationPath)) {
        throw new Error(`The destination file exists: ${destinationPath}`);
    }
    await mkdir((0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$path$2d$CR6YkPXX$2d$7R1$2d$9CMk$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["d"])(destinationPath), {
        mode: directoryMode,
        recursive: true
    });
    try {
        await rename$1(sourcePath, destinationPath);
    } catch (error) {
        if (error.code === "EXDEV") {
            await copyFile(sourcePath, destinationPath);
            await unlink(sourcePath);
        } else {
            throw error;
        }
    }
};
const move = async (sourcePath, destinationPath, options = {})=>{
    const internalOptions = {
        overwrite: true,
        validateDirectory: false,
        ...options,
        cwd: options.cwd ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$local$2d$meta$2d$storage$2d$CsuVst9V$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["t"])(options.cwd) : cwd()
    };
    await internalMoveFile(sourcePath, destinationPath, internalOptions);
};
var etag_1;
var hasRequiredEtag;
function requireEtag() {
    if (hasRequiredEtag) return etag_1;
    hasRequiredEtag = 1;
    /*!
	 * etag
	 * Copyright(c) 2014-2016 Douglas Christopher Wilson
	 * MIT Licensed
	 */ etag_1 = etag;
    var crypto = __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__["default"];
    var Stats = __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__["default"].Stats;
    var toString = Object.prototype.toString;
    function entitytag(entity) {
        if (entity.length === 0) {
            return '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"';
        }
        var hash = crypto.createHash("sha1").update(entity, "utf8").digest("base64").substring(0, 27);
        var len = typeof entity === "string" ? Buffer.byteLength(entity, "utf8") : entity.length;
        return '"' + len.toString(16) + "-" + hash + '"';
    }
    function etag(entity, options) {
        if (entity == null) {
            throw new TypeError("argument entity is required");
        }
        var isStats = isstats(entity);
        var weak = options && typeof options.weak === "boolean" ? options.weak : isStats;
        if (!isStats && typeof entity !== "string" && !Buffer.isBuffer(entity)) {
            throw new TypeError("argument entity must be string, Buffer, or fs.Stats");
        }
        var tag = isStats ? stattag(entity) : entitytag(entity);
        return weak ? "W/" + tag : tag;
    }
    function isstats(obj) {
        if (typeof Stats === "function" && obj instanceof Stats) {
            return true;
        }
        return obj && typeof obj === "object" && "ctime" in obj && toString.call(obj.ctime) === "[object Date]" && "mtime" in obj && toString.call(obj.mtime) === "[object Date]" && "ino" in obj && typeof obj.ino === "number" && "size" in obj && typeof obj.size === "number";
    }
    function stattag(stat) {
        var mtime = stat.mtime.getTime().toString(16);
        var size = stat.size.toString(16);
        return '"' + size + "-" + mtime + '"';
    }
    return etag_1;
}
var etagExports = requireEtag();
const etag = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$_commonjsHelpers$2d$B85MJLTf$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["g"])(etagExports);
class StreamChecksum extends __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$stream__$5b$external$5d$__$28$node$3a$stream$2c$__cjs$29$__["Transform"] {
    /**
   * Creates a new StreamChecksum transform stream.
   * @param checksum Expected checksum value to validate against
   * @param algorithm Hash algorithm to use (e.g., 'md5', 'sha256')
   * @param encoding Encoding for the checksum comparison (defaults to 'base64')
   */ constructor(checksum, algorithm, encoding = "base64"){
        super();
        this.checksum = checksum;
        this.algorithm = algorithm;
        this.encoding = encoding;
        this.hash = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["createHash"])(algorithm);
    }
    length = 0;
    digest = "";
    hash;
    /**
   * Gets the calculated digest value after the stream has finished processing.
   * @returns The digest value in the configured encoding, or empty string if not yet calculated
   */ get calculatedDigest() {
        return this.digest;
    }
    /**
   * Transform method that updates the hash with incoming data.
   * @param chunk Buffer chunk to process
   * @param _encoding Unused encoding parameter
   * @param done Callback to signal completion
   */ // eslint-disable-next-line no-underscore-dangle
    _transform(chunk, _encoding, done) {
        this.push(chunk);
        this.hash.update(chunk);
        this.length += chunk.length;
        done();
    }
    /**
   * Finalization method that validates the checksum.
   * @param callback Callback called with error if checksum validation fails
   */ // eslint-disable-next-line no-underscore-dangle
    _flush(callback) {
        this.digest = this.hash.digest(this.encoding);
        if (this.checksum && this.checksum !== this.digest) {
            callback(new Error("Checksum mismatch"));
        } else {
            callback();
        }
    }
}
const streamChecksum = (checksum, algorithm, encoding = "base64")=>algorithm ? new StreamChecksum(checksum, algorithm, encoding) : new __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$stream__$5b$external$5d$__$28$node$3a$stream$2c$__cjs$29$__["PassThrough"]();
class StreamLength extends __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$stream__$5b$external$5d$__$28$node$3a$stream$2c$__cjs$29$__["Transform"] {
    /**
   * Creates a new StreamLength transform stream.
   * @param limit Maximum number of bytes allowed (defaults to infinity)
   */ constructor(limit = Number.POSITIVE_INFINITY){
        super();
        this.limit = limit;
    }
    length = 0;
    /**
   * Transform method that counts bytes and enforces size limits.
   * @param chunk Buffer chunk to process
   * @param _encoding Unused encoding parameter
   * @param callback Callback called with error if limit exceeded
   */ // eslint-disable-next-line no-underscore-dangle
    _transform(chunk, _encoding, callback) {
        const expected = this.length + chunk.length;
        if (this.limit >= expected) {
            this.push(chunk);
            this.length = expected;
            callback();
        } else {
            callback(new Error("Stream length limit exceeded"));
        }
    }
}
class DiskStorage extends __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$storage$2d$qBIeShej$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["B"] {
    static name = "disk";
    checksumTypes = [
        "md5",
        "sha1"
    ];
    directory;
    meta;
    constructor(config){
        super(config);
        this.directory = config.directory;
        if (config.metaStorage) {
            this.meta = config.metaStorage;
        } else {
            const metaConfig = {
                ...config,
                ...config.metaStorageConfig,
                logger: this.logger
            };
            this.meta = new __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$local$2d$meta$2d$storage$2d$CsuVst9V$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["L"](metaConfig);
        }
        if (!config.fileNameValidation) {
            config.fileNameValidation = __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$storage$2d$qBIeShej$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["a"];
        }
        this.isReady = false;
        this.accessCheck().then(()=>{
            this.isReady = true;
        }).catch((error)=>{
            this.logger?.error("Storage access check failed: %O", error);
        });
    }
    /**
   * Normalizes errors with disk storage context.
   * @param error The error to normalize.
   * @returns Normalized HTTP error.
   */ normalizeError(error) {
        return super.normalizeError(error);
    }
    /**
   * Creates a new file upload and saves its metadata.
   * @param fileInit File initialization configuration.
   * @returns Promise resolving to the created file object.
   * @throws {Error} If validation fails or file already exists and is completed.
   * @remarks
   * Supports TTL (time-to-live) option in fileInit.
   * Creates the file on disk if it doesn't exist.
   * Returns existing file if it's already completed.
   */ async create(fileInit) {
        return this.instrumentOperation("create", async ()=>{
            const processedConfig = {
                ...fileInit
            };
            if (fileInit.ttl) {
                const ttlMs = typeof fileInit.ttl === "string" ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$storage$2d$qBIeShej$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["t"])(fileInit.ttl) : fileInit.ttl;
                if (ttlMs !== void 0) {
                    processedConfig.expiredAt = Date.now() + ttlMs;
                }
            }
            if (processedConfig.size !== void 0 && Number(processedConfig.size) < 0) {
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["throwErrorCode"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ERRORS"].REQUEST_ENTITY_TOO_LARGE, "Request entity too large");
            }
            const file = new __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$File$2d$Bb3P23dr$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"](processedConfig);
            try {
                const existing = await this.getMeta(file.id);
                if (existing.status === "completed") {
                    return existing;
                }
            } catch  {}
            file.name = this.namingFunction(file);
            if (file.size === void 0 || Number.isNaN(file.size)) {
                if (file.size === void 0) ;
                else {
                    file.size = this.maxUploadSize;
                }
            }
            await this.validate(file);
            const path = this.getFilePath(file.name);
            try {
                await ensureFile(path);
                file.bytesWritten = 0;
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["throwErrorCode"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ERRORS"].FILE_ERROR, message);
            }
            file.status = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$part$2d$match$2d$CW8Z1naC$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["g"])(file);
            await this.saveMeta(file);
            await this.onCreate(file);
            return file;
        });
    }
    /**
   * Writes data to a file upload.
   * @param part File part containing data to write, file query, or full file object.
   * @returns Promise resolving to the updated file object.
   * @throws {Error} If file is expired (ERRORS.GONE), locked (ERRORS.FILE_LOCKED), or conflicts occur (ERRORS.FILE_CONFLICT).
   * @remarks
   * Supports chunked uploads with start position.
   * Automatically detects file type from stream on first chunk if contentType is not set.
   * Validates checksum algorithms if provided.
   * Uses file locking to prevent concurrent writes.
   * Updates file status to "completed" when all bytes are written.
   */ async write(part) {
        return this.instrumentOperation("write", async ()=>{
            let file;
            const isFullFile = "contentType" in part && "metadata" in part && !("body" in part) && !("start" in part);
            if (isFullFile) {
                file = part;
            } else {
                file = await this.getMeta(part.id);
                await this.checkIfExpired(file);
            }
            if (file.status === "completed") {
                return file;
            }
            if (part.size !== void 0) {
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$update$2d$size$2d$CCGm6i1J$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["u"])(file, part.size);
            }
            if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$part$2d$match$2d$CW8Z1naC$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["p"])(part, file)) {
                return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["throwErrorCode"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ERRORS"].FILE_CONFLICT);
            }
            const path = this.getFilePath(file.name);
            await this.lock(path);
            try {
                const startPosition = part.start || 0;
                await ensureFile(path);
                if (file.bytesWritten === 0) {
                    file.bytesWritten = startPosition;
                }
                if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$has$2d$content$2d$CY66ehMK$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["h"])(part)) {
                    if (this.isUnsupportedChecksum(part.checksumAlgorithm)) {
                        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["throwErrorCode"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ERRORS"].UNSUPPORTED_CHECKSUM_ALGORITHM);
                    }
                    const isFirstChunk = part.start === 0 || part.start === void 0;
                    if (isFirstChunk && (file.bytesWritten === 0 || Number.isNaN(file.bytesWritten)) && (!file.contentType || file.contentType === "application/octet-stream")) {
                        try {
                            const { fileType, stream: detectedStream } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$part$2d$match$2d$CW8Z1naC$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["d"])(part.body);
                            if (fileType?.mime) {
                                file.contentType = fileType.mime;
                            }
                            part.body = detectedStream;
                        } catch  {}
                    }
                    const signalFromPart = part.signal;
                    const lazyWritePart = {
                        ...file,
                        ...part,
                        body: part.body
                    };
                    if (signalFromPart) {
                        lazyWritePart.signal = signalFromPart;
                    }
                    const [bytesWritten, errorCode] = await this.lazyWrite(lazyWritePart);
                    if (errorCode) {
                        await (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs$2f$promises__$5b$external$5d$__$28$node$3a$fs$2f$promises$2c$__cjs$29$__["truncate"])(path, file.bytesWritten);
                        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["throwErrorCode"])(errorCode);
                    }
                    const expectedBytesWritten = startPosition + (part.contentLength || 0);
                    file.bytesWritten = Math.max(file.bytesWritten || 0, expectedBytesWritten);
                    file.bytesWritten = Math.max(file.bytesWritten || 0, bytesWritten);
                    file.status = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$part$2d$match$2d$CW8Z1naC$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["g"])(file);
                    await this.saveMeta(file);
                } else {
                    await ensureFile(path);
                    file.bytesWritten = 0;
                }
                return file;
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["throwErrorCode"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ERRORS"].FILE_ERROR, message);
            } finally{
                await this.unlock(path);
            }
        });
    }
    /**
   * Gets an uploaded file by ID.
   * @param query File query containing the file ID to retrieve.
   * @param query.id File ID to retrieve.
   * @returns Promise resolving to the file data including content buffer.
   * @throws {Error} If the file cannot be found (ERRORS.FILE_NOT_FOUND) or has expired (ERRORS.GONE).
   * @remarks
   * Loads the entire file content into memory as a Buffer.
   * For large files, consider using getStream() instead.
   * Includes ETag (MD5 hash) for content verification.
   */ async get({ id }) {
        return this.instrumentOperation("get", async ()=>{
            const file = await this.checkIfExpired(await this.meta.get(id));
            const { bytesWritten, contentType, expiredAt, metadata, modifiedAt, name, originalName, size } = file;
            let content;
            try {
                content = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$local$2d$meta$2d$storage$2d$CsuVst9V$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["b"])(this.getFilePath(name), {
                    buffer: true
                });
            } catch (error) {
                const errorWithCode = error;
                if (errorWithCode.code === "ENOENT" || errorWithCode.code === "EPERM") {
                    const message = error instanceof Error ? error.message : errorWithCode.message || String(error);
                    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["throwErrorCode"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ERRORS"].FILE_NOT_FOUND, message);
                }
                throw error;
            }
            return {
                content,
                contentType,
                ETag: etag(content),
                expiredAt,
                id,
                metadata,
                modifiedAt,
                name,
                originalName,
                size: size || bytesWritten
            };
        });
    }
    /**
   * Gets an uploaded file as a readable stream for efficient large file handling.
   * @param query File query containing the file ID to stream.
   * @param query.id File ID to stream.
   * @returns Promise resolving to an object containing the stream, headers, and size.
   * @throws {UploadError} If the file cannot be found (ERRORS.FILE_NOT_FOUND) or has expired (ERRORS.GONE).
   * @remarks Creates a readable stream directly from the file system for efficient memory usage.
   */ async getStream({ id }) {
        return this.instrumentOperation("getStream", async ()=>{
            try {
                const file = await this.checkIfExpired(await this.meta.get(id));
                const { bytesWritten, contentType, expiredAt, modifiedAt, name, size } = file;
                const stream = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["createReadStream"])(this.getFilePath(name));
                return {
                    headers: {
                        "Content-Length": String(size || bytesWritten),
                        "Content-Type": contentType,
                        ...expiredAt && {
                            "X-Upload-Expires": expiredAt.toString()
                        },
                        ...modifiedAt && {
                            "Last-Modified": modifiedAt.toString()
                        }
                    },
                    size: size || bytesWritten,
                    stream
                };
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["throwErrorCode"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ERRORS"].FILE_NOT_FOUND, message);
            }
        });
    }
    /**
   * Deletes an upload and its metadata.
   * @param query File query containing the file ID to delete.
   * @param query.id File ID to delete.
   * @returns Promise resolving to the deleted file object with status: "deleted".
   * @throws {UploadError} If the file metadata cannot be found.
   */ async delete({ id }) {
        return this.instrumentOperation("delete", async ()=>{
            const file = await this.getMeta(id);
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$local$2d$meta$2d$storage$2d$CsuVst9V$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["r"])(this.getFilePath(file.name));
            await this.deleteMeta(id);
            const deletedFile = {
                ...file,
                status: "deleted"
            };
            await this.onDelete(deletedFile);
            return deletedFile;
        });
    }
    /**
   * Copies an upload file to a new location.
   * @param name Source file name/ID.
   * @param destination Destination file name/ID.
   * @returns Promise resolving to the copied file object.
   * @throws {UploadError} If the source file cannot be found.
   */ async copy(name, destination) {
        return this.instrumentOperation("copy", async ()=>{
            const sourceFile = await this.getMeta(name);
            await (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs$2f$promises__$5b$external$5d$__$28$node$3a$fs$2f$promises$2c$__cjs$29$__["copyFile"])(this.getFilePath(sourceFile.name), this.getFilePath(destination));
            return {
                ...sourceFile,
                name: destination
            };
        });
    }
    /**
   * Moves an upload file to a new location.
   * @param name Source file name/ID.
   * @param destination Destination file name/ID.
   * @returns Promise resolving to the moved file object.
   * @throws {Error} If the source file cannot be found.
   */ async move(name, destination) {
        return this.instrumentOperation("move", async ()=>{
            const sourceFile = await this.getMeta(name);
            const source = this.getFilePath(sourceFile.name);
            const destinationPath = this.getFilePath(destination);
            try {
                await move(source, destinationPath);
            } catch (error) {
                const errorWithCode = error;
                if (errorWithCode?.code === "EXDEV") {
                    await (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs$2f$promises__$5b$external$5d$__$28$node$3a$fs$2f$promises$2c$__cjs$29$__["copyFile"])(source, destinationPath);
                    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$local$2d$meta$2d$storage$2d$CsuVst9V$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["r"])(source);
                } else {
                    throw error;
                }
            }
            return {
                ...sourceFile,
                id: sourceFile.id,
                name: destination
            };
        });
    }
    /**
   * Retrieves a list of uploaded files.
   * @returns Promise resolving to an array of file metadata objects.
   * @remarks Walks the storage directory and returns all files, excluding metadata files.
   */ async list() {
        return this.instrumentOperation("list", async ()=>{
            const config = {
                followSymlinks: false,
                includeDirs: false,
                includeFiles: true,
                skip: [
                    "*.META$"
                ]
            };
            const uploads = [];
            const { directory } = this;
            for await (const founding of walk(directory, config)){
                const { suffix } = this.meta;
                const { path } = founding;
                if (!path.includes(suffix)) {
                    const { birthtime, ctime, mtime } = await (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs$2f$promises__$5b$external$5d$__$28$node$3a$fs$2f$promises$2c$__cjs$29$__["stat"])(path);
                    uploads.push({
                        createdAt: birthtime || ctime,
                        id: path.replace(directory, ""),
                        modifiedAt: mtime
                    });
                }
            }
            return uploads;
        });
    }
    /**
   * Returns path for the uploaded file
   * If filename is already an absolute path, returns it as-is.
   * Otherwise, joins it with the storage directory.
   */ getFilePath(filename) {
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$path$2d$CR6YkPXX$2d$7R1$2d$9CMk$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["i"])(filename)) {
            return filename;
        }
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$path$2d$CR6YkPXX$2d$7R1$2d$9CMk$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["j"])(this.directory, filename);
    }
    lazyWrite(part) {
        return new Promise((resolve, reject)=>{
            const destination = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["createWriteStream"])(this.getFilePath(part.name), {
                flags: "r+",
                start: part.start
            });
            const lengthChecker = new StreamLength(part.contentLength || part.size - part.start);
            const checksumChecker = streamChecksum(part.checksum, part.checksumAlgorithm);
            const keepPartial = !part.checksum;
            const { signal } = part;
            const cleanupStreams = ()=>{
                destination.close();
                lengthChecker.destroy();
                checksumChecker.destroy();
            };
            const failWithCode = (code)=>{
                cleanupStreams();
                resolve([
                    Number.NaN,
                    code
                ]);
            };
            lengthChecker.on("error", ()=>failWithCode(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ERRORS"].FILE_CONFLICT));
            checksumChecker.on("error", ()=>failWithCode(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ERRORS"].CHECKSUM_MISMATCH));
            part.body.on("aborted", ()=>failWithCode(keepPartial ? void 0 : __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ERRORS"].REQUEST_ABORTED));
            part.body.on("error", (error)=>{
                cleanupStreams();
                reject(error);
            });
            if (signal?.aborted) {
                return failWithCode(keepPartial ? void 0 : __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ERRORS"].REQUEST_ABORTED);
            }
            if (signal) {
                signal.addEventListener("abort", ()=>{
                    cleanupStreams();
                    destination.destroy();
                    lengthChecker.destroy();
                    checksumChecker.destroy();
                    part.body.destroy();
                    resolve([
                        Number.NaN,
                        keepPartial ? void 0 : __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ERRORS"].REQUEST_ABORTED
                    ]);
                });
            }
            (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$stream__$5b$external$5d$__$28$node$3a$stream$2c$__cjs$29$__["pipeline"])(part.body, lengthChecker, checksumChecker, destination, (error)=>{
                if (error) {
                    cleanupStreams();
                    if (signal && signal.aborted) {
                        return resolve([
                            Number.NaN,
                            keepPartial ? void 0 : __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ERRORS"].REQUEST_ABORTED
                        ]);
                    }
                    return resolve([
                        Number.NaN,
                        __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ERRORS"].FILE_ERROR
                    ]);
                }
                return resolve([
                    part.start + destination.bytesWritten
                ]);
            });
        });
    }
    async accessCheck() {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$local$2d$meta$2d$storage$2d$CsuVst9V$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["e"])(this.directory);
    }
}
;
}),
"[project]/packages/storage/dist/packem_shared/disk-storage-Bnldtwqx.js [app-route] (ecmascript) <export D as DiskStorage>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DiskStorage",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$disk$2d$storage$2d$Bnldtwqx$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["D"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$disk$2d$storage$2d$Bnldtwqx$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/disk-storage-Bnldtwqx.js [app-route] (ecmascript)");
}),
"[externals]/node:path [external] (node:path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:path", () => require("node:path"));

module.exports = mod;
}),
"[project]/packages/storage-client/examples/nextjs/lib/storage.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "storage",
    ()=>storage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$disk$2d$storage$2d$Bnldtwqx$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__D__as__DiskStorage$3e$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/disk-storage-Bnldtwqx.js [app-route] (ecmascript) <export D as DiskStorage>");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs$2f$promises__$5b$external$5d$__$28$node$3a$fs$2f$promises$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:fs/promises [external] (node:fs/promises, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:path [external] (node:path, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$os__$5b$external$5d$__$28$node$3a$os$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:os [external] (node:os, cjs)");
;
;
;
;
/**
 * Shared storage instance for file uploads.
 * Uses local disk storage for development.
 */ const uploadDirectory = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["join"])((0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$os__$5b$external$5d$__$28$node$3a$os$2c$__cjs$29$__["tmpdir"])(), "uploads");
// Ensure upload directory exists
(0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs$2f$promises__$5b$external$5d$__$28$node$3a$fs$2f$promises$2c$__cjs$29$__["mkdir"])(uploadDirectory, {
    recursive: true
}).catch((error)=>{
    console.error("Failed to create upload directory:", error);
});
const storage = new __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$disk$2d$storage$2d$Bnldtwqx$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__D__as__DiskStorage$3e$__["DiskStorage"]({
    directory: uploadDirectory,
    maxUploadSize: "100MB",
    logger: console
});
}),
"[project]/packages/storage-client/examples/nextjs/app/api/upload/multipart/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DELETE",
    ()=>DELETE,
    "GET",
    ()=>GET,
    "OPTIONS",
    ()=>OPTIONS,
    "POST",
    ()=>POST
]);
(()=>{
    const e = new Error("Cannot find module '@visulima/storage/handler/http/nextjs'");
    e.code = 'MODULE_NOT_FOUND';
    throw e;
})();
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2d$client$2f$examples$2f$nextjs$2f$lib$2f$storage$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage-client/examples/nextjs/lib/storage.ts [app-route] (ecmascript)");
;
;
const handler = createNextjsHandler({
    storage: __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2d$client$2f$examples$2f$nextjs$2f$lib$2f$storage$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["storage"],
    type: "multipart"
});
const POST = handler;
const DELETE = handler;
const GET = handler;
const OPTIONS = handler;
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__ae8215b9._.js.map