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
"[externals]/path [external] (path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("path", () => require("path"));

module.exports = mod;
}),
"[externals]/util [external] (util, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("util", () => require("util"));

module.exports = mod;
}),
"[project]/packages/storage/dist/packem_shared/headers-C9CQX79R.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "H",
    ()=>HeaderUtilities,
    "c",
    ()=>createHttpError,
    "h",
    ()=>httpErrorsExports
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$_commonjsHelpers$2d$B85MJLTf$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/_commonjsHelpers-B85MJLTf.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/path [external] (path, cjs)");
;
;
var httpErrors = {
    exports: {}
};
var depd_1;
var hasRequiredDepd;
function requireDepd() {
    if (hasRequiredDepd) return depd_1;
    hasRequiredDepd = 1;
    /*!
	 * depd
	 * Copyright(c) 2014-2018 Douglas Christopher Wilson
	 * MIT Licensed
	 */ var relative = __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].relative;
    depd_1 = depd;
    var basePath = process.cwd();
    function containsNamespace(str, namespace) {
        var vals = str.split(/[ ,]+/);
        var ns = String(namespace).toLowerCase();
        for(var i = 0; i < vals.length; i++){
            var val = vals[i];
            if (val && (val === "*" || val.toLowerCase() === ns)) {
                return true;
            }
        }
        return false;
    }
    function convertDataDescriptorToAccessor(obj, prop, message) {
        var descriptor = Object.getOwnPropertyDescriptor(obj, prop);
        var value = descriptor.value;
        descriptor.get = function getter() {
            return value;
        };
        if (descriptor.writable) {
            descriptor.set = function setter(val) {
                return value = val;
            };
        }
        delete descriptor.value;
        delete descriptor.writable;
        Object.defineProperty(obj, prop, descriptor);
        return descriptor;
    }
    function createArgumentsString(arity) {
        var str = "";
        for(var i = 0; i < arity; i++){
            str += ", arg" + i;
        }
        return str.substr(2);
    }
    function createStackString(stack) {
        var str = this.name + ": " + this.namespace;
        if (this.message) {
            str += " deprecated " + this.message;
        }
        for(var i = 0; i < stack.length; i++){
            str += "\n    at " + stack[i].toString();
        }
        return str;
    }
    function depd(namespace) {
        if (!namespace) {
            throw new TypeError("argument namespace is required");
        }
        var stack = getStack();
        var site = callSiteLocation(stack[1]);
        var file = site[0];
        function deprecate(message) {
            log.call(deprecate, message);
        }
        deprecate._file = file;
        deprecate._ignored = isignored(namespace);
        deprecate._namespace = namespace;
        deprecate._traced = istraced(namespace);
        deprecate._warned = /* @__PURE__ */ Object.create(null);
        deprecate.function = wrapfunction;
        deprecate.property = wrapproperty;
        return deprecate;
    }
    function eehaslisteners(emitter, type) {
        var count = typeof emitter.listenerCount !== "function" ? emitter.listeners(type).length : emitter.listenerCount(type);
        return count > 0;
    }
    function isignored(namespace) {
        if (process.noDeprecation) {
            return true;
        }
        var str = process.env.NO_DEPRECATION || "";
        return containsNamespace(str, namespace);
    }
    function istraced(namespace) {
        if (process.traceDeprecation) {
            return true;
        }
        var str = process.env.TRACE_DEPRECATION || "";
        return containsNamespace(str, namespace);
    }
    function log(message, site) {
        var haslisteners = eehaslisteners(process, "deprecation");
        if (!haslisteners && this._ignored) {
            return;
        }
        var caller;
        var callFile;
        var callSite;
        var depSite;
        var i = 0;
        var seen = false;
        var stack = getStack();
        var file = this._file;
        if (site) {
            depSite = site;
            callSite = callSiteLocation(stack[1]);
            callSite.name = depSite.name;
            file = callSite[0];
        } else {
            i = 2;
            depSite = callSiteLocation(stack[i]);
            callSite = depSite;
        }
        for(; i < stack.length; i++){
            caller = callSiteLocation(stack[i]);
            callFile = caller[0];
            if (callFile === file) {
                seen = true;
            } else if (callFile === this._file) {
                file = this._file;
            } else if (seen) {
                break;
            }
        }
        var key = caller ? depSite.join(":") + "__" + caller.join(":") : void 0;
        if (key !== void 0 && key in this._warned) {
            return;
        }
        this._warned[key] = true;
        var msg = message;
        if (!msg) {
            msg = callSite === depSite || !callSite.name ? defaultMessage(depSite) : defaultMessage(callSite);
        }
        if (haslisteners) {
            var err = DeprecationError(this._namespace, msg, stack.slice(i));
            process.emit("deprecation", err);
            return;
        }
        var format = process.stderr.isTTY ? formatColor : formatPlain;
        var output = format.call(this, msg, caller, stack.slice(i));
        process.stderr.write(output + "\n", "utf8");
    }
    function callSiteLocation(callSite) {
        var file = callSite.getFileName() || "<anonymous>";
        var line = callSite.getLineNumber();
        var colm = callSite.getColumnNumber();
        if (callSite.isEval()) {
            file = callSite.getEvalOrigin() + ", " + file;
        }
        var site = [
            file,
            line,
            colm
        ];
        site.callSite = callSite;
        site.name = callSite.getFunctionName();
        return site;
    }
    function defaultMessage(site) {
        var callSite = site.callSite;
        var funcName = site.name;
        if (!funcName) {
            funcName = "<anonymous@" + formatLocation(site) + ">";
        }
        var context = callSite.getThis();
        var typeName = context && callSite.getTypeName();
        if (typeName === "Object") {
            typeName = void 0;
        }
        if (typeName === "Function") {
            typeName = context.name || typeName;
        }
        return typeName && callSite.getMethodName() ? typeName + "." + funcName : funcName;
    }
    function formatPlain(msg, caller, stack) {
        var timestamp = /* @__PURE__ */ new Date().toUTCString();
        var formatted = timestamp + " " + this._namespace + " deprecated " + msg;
        if (this._traced) {
            for(var i = 0; i < stack.length; i++){
                formatted += "\n    at " + stack[i].toString();
            }
            return formatted;
        }
        if (caller) {
            formatted += " at " + formatLocation(caller);
        }
        return formatted;
    }
    function formatColor(msg, caller, stack) {
        var formatted = "\x1B[36;1m" + this._namespace + "\x1B[22;39m \x1B[33;1mdeprecated\x1B[22;39m \x1B[0m" + msg + "\x1B[39m";
        if (this._traced) {
            for(var i = 0; i < stack.length; i++){
                formatted += "\n    \x1B[36mat " + stack[i].toString() + "\x1B[39m";
            }
            return formatted;
        }
        if (caller) {
            formatted += " \x1B[36m" + formatLocation(caller) + "\x1B[39m";
        }
        return formatted;
    }
    function formatLocation(callSite) {
        return relative(basePath, callSite[0]) + ":" + callSite[1] + ":" + callSite[2];
    }
    function getStack() {
        var limit = Error.stackTraceLimit;
        var obj = {};
        var prep = Error.prepareStackTrace;
        Error.prepareStackTrace = prepareObjectStackTrace;
        Error.stackTraceLimit = Math.max(10, limit);
        Error.captureStackTrace(obj);
        var stack = obj.stack.slice(1);
        Error.prepareStackTrace = prep;
        Error.stackTraceLimit = limit;
        return stack;
    }
    function prepareObjectStackTrace(obj, stack) {
        return stack;
    }
    function wrapfunction(fn, message) {
        if (typeof fn !== "function") {
            throw new TypeError("argument fn must be a function");
        }
        var args = createArgumentsString(fn.length);
        var stack = getStack();
        var site = callSiteLocation(stack[1]);
        site.name = fn.name;
        var deprecatedfn = new Function("fn", "log", "deprecate", "message", "site", '"use strict"\nreturn function (' + args + ") {log.call(deprecate, message, site)\nreturn fn.apply(this, arguments)\n}")(fn, log, this, message, site);
        return deprecatedfn;
    }
    function wrapproperty(obj, prop, message) {
        if (!obj || typeof obj !== "object" && typeof obj !== "function") {
            throw new TypeError("argument obj must be object");
        }
        var descriptor = Object.getOwnPropertyDescriptor(obj, prop);
        if (!descriptor) {
            throw new TypeError("must call property on owner object");
        }
        if (!descriptor.configurable) {
            throw new TypeError("property must be configurable");
        }
        var deprecate = this;
        var stack = getStack();
        var site = callSiteLocation(stack[1]);
        site.name = prop;
        if ("value" in descriptor) {
            descriptor = convertDataDescriptorToAccessor(obj, prop);
        }
        var get = descriptor.get;
        var set = descriptor.set;
        if (typeof get === "function") {
            descriptor.get = function getter() {
                log.call(deprecate, message, site);
                return get.apply(this, arguments);
            };
        }
        if (typeof set === "function") {
            descriptor.set = function setter() {
                log.call(deprecate, message, site);
                return set.apply(this, arguments);
            };
        }
        Object.defineProperty(obj, prop, descriptor);
    }
    function DeprecationError(namespace, message, stack) {
        var error = new Error();
        var stackString;
        Object.defineProperty(error, "constructor", {
            value: DeprecationError
        });
        Object.defineProperty(error, "message", {
            configurable: true,
            enumerable: false,
            value: message,
            writable: true
        });
        Object.defineProperty(error, "name", {
            enumerable: false,
            configurable: true,
            value: "DeprecationError",
            writable: true
        });
        Object.defineProperty(error, "namespace", {
            configurable: true,
            enumerable: false,
            value: namespace,
            writable: true
        });
        Object.defineProperty(error, "stack", {
            configurable: true,
            enumerable: false,
            get: function() {
                if (stackString !== void 0) {
                    return stackString;
                }
                return stackString = createStackString.call(this, stack);
            },
            set: function setter(val) {
                stackString = val;
            }
        });
        return error;
    }
    return depd_1;
}
var setprototypeof;
var hasRequiredSetprototypeof;
function requireSetprototypeof() {
    if (hasRequiredSetprototypeof) return setprototypeof;
    hasRequiredSetprototypeof = 1;
    setprototypeof = Object.setPrototypeOf || (({
        __proto__: []
    }) instanceof Array ? setProtoOf : mixinProperties);
    function setProtoOf(obj, proto) {
        obj.__proto__ = proto;
        return obj;
    }
    function mixinProperties(obj, proto) {
        for(var prop in proto){
            if (!Object.prototype.hasOwnProperty.call(obj, prop)) {
                obj[prop] = proto[prop];
            }
        }
        return obj;
    }
    return setprototypeof;
}
var codes;
var hasRequiredCodes;
function requireCodes() {
    if (hasRequiredCodes) return codes;
    hasRequiredCodes = 1;
    codes = {
        "100": "Continue",
        "101": "Switching Protocols",
        "102": "Processing",
        "103": "Early Hints",
        "200": "OK",
        "201": "Created",
        "202": "Accepted",
        "203": "Non-Authoritative Information",
        "204": "No Content",
        "205": "Reset Content",
        "206": "Partial Content",
        "207": "Multi-Status",
        "208": "Already Reported",
        "226": "IM Used",
        "300": "Multiple Choices",
        "301": "Moved Permanently",
        "302": "Found",
        "303": "See Other",
        "304": "Not Modified",
        "305": "Use Proxy",
        "307": "Temporary Redirect",
        "308": "Permanent Redirect",
        "400": "Bad Request",
        "401": "Unauthorized",
        "402": "Payment Required",
        "403": "Forbidden",
        "404": "Not Found",
        "405": "Method Not Allowed",
        "406": "Not Acceptable",
        "407": "Proxy Authentication Required",
        "408": "Request Timeout",
        "409": "Conflict",
        "410": "Gone",
        "411": "Length Required",
        "412": "Precondition Failed",
        "413": "Payload Too Large",
        "414": "URI Too Long",
        "415": "Unsupported Media Type",
        "416": "Range Not Satisfiable",
        "417": "Expectation Failed",
        "418": "I'm a Teapot",
        "421": "Misdirected Request",
        "422": "Unprocessable Entity",
        "423": "Locked",
        "424": "Failed Dependency",
        "425": "Too Early",
        "426": "Upgrade Required",
        "428": "Precondition Required",
        "429": "Too Many Requests",
        "431": "Request Header Fields Too Large",
        "451": "Unavailable For Legal Reasons",
        "500": "Internal Server Error",
        "501": "Not Implemented",
        "502": "Bad Gateway",
        "503": "Service Unavailable",
        "504": "Gateway Timeout",
        "505": "HTTP Version Not Supported",
        "506": "Variant Also Negotiates",
        "507": "Insufficient Storage",
        "508": "Loop Detected",
        "509": "Bandwidth Limit Exceeded",
        "510": "Not Extended",
        "511": "Network Authentication Required"
    };
    return codes;
}
var statuses;
var hasRequiredStatuses;
function requireStatuses() {
    if (hasRequiredStatuses) return statuses;
    hasRequiredStatuses = 1;
    /*!
	 * statuses
	 * Copyright(c) 2014 Jonathan Ong
	 * Copyright(c) 2016 Douglas Christopher Wilson
	 * MIT Licensed
	 */ var codes = requireCodes();
    statuses = status;
    status.message = codes;
    status.code = createMessageToStatusCodeMap(codes);
    status.codes = createStatusCodeList(codes);
    status.redirect = {
        300: true,
        301: true,
        302: true,
        303: true,
        305: true,
        307: true,
        308: true
    };
    status.empty = {
        204: true,
        205: true,
        304: true
    };
    status.retry = {
        502: true,
        503: true,
        504: true
    };
    function createMessageToStatusCodeMap(codes2) {
        var map = {};
        Object.keys(codes2).forEach(function forEachCode(code) {
            var message = codes2[code];
            var status2 = Number(code);
            map[message.toLowerCase()] = status2;
        });
        return map;
    }
    function createStatusCodeList(codes2) {
        return Object.keys(codes2).map(function mapCode(code) {
            return Number(code);
        });
    }
    function getStatusCode(message) {
        var msg = message.toLowerCase();
        if (!Object.prototype.hasOwnProperty.call(status.code, msg)) {
            throw new Error('invalid status message: "' + message + '"');
        }
        return status.code[msg];
    }
    function getStatusMessage(code) {
        if (!Object.prototype.hasOwnProperty.call(status.message, code)) {
            throw new Error("invalid status code: " + code);
        }
        return status.message[code];
    }
    function status(code) {
        if (typeof code === "number") {
            return getStatusMessage(code);
        }
        if (typeof code !== "string") {
            throw new TypeError("code must be a number or string");
        }
        var n = parseInt(code, 10);
        if (!isNaN(n)) {
            return getStatusMessage(n);
        }
        return getStatusCode(code);
    }
    return statuses;
}
var inherits = {
    exports: {}
};
var inherits_browser = {
    exports: {}
};
var hasRequiredInherits_browser;
function requireInherits_browser() {
    if (hasRequiredInherits_browser) return inherits_browser.exports;
    hasRequiredInherits_browser = 1;
    if (typeof Object.create === "function") {
        inherits_browser.exports = function inherits(ctor, superCtor) {
            if (superCtor) {
                ctor.super_ = superCtor;
                ctor.prototype = Object.create(superCtor.prototype, {
                    constructor: {
                        value: ctor,
                        enumerable: false,
                        writable: true,
                        configurable: true
                    }
                });
            }
        };
    } else {
        inherits_browser.exports = function inherits(ctor, superCtor) {
            if (superCtor) {
                ctor.super_ = superCtor;
                var TempCtor = function() {};
                TempCtor.prototype = superCtor.prototype;
                ctor.prototype = new TempCtor();
                ctor.prototype.constructor = ctor;
            }
        };
    }
    return inherits_browser.exports;
}
var hasRequiredInherits;
function requireInherits() {
    if (hasRequiredInherits) return inherits.exports;
    hasRequiredInherits = 1;
    try {
        var util = __turbopack_context__.r("[externals]/util [external] (util, cjs)");
        if (typeof util.inherits !== "function") throw "";
        inherits.exports = util.inherits;
    } catch (e) {
        inherits.exports = requireInherits_browser();
    }
    return inherits.exports;
}
var toidentifier;
var hasRequiredToidentifier;
function requireToidentifier() {
    if (hasRequiredToidentifier) return toidentifier;
    hasRequiredToidentifier = 1;
    /*!
	 * toidentifier
	 * Copyright(c) 2016 Douglas Christopher Wilson
	 * MIT Licensed
	 */ toidentifier = toIdentifier;
    function toIdentifier(str) {
        return str.split(" ").map(function(token) {
            return token.slice(0, 1).toUpperCase() + token.slice(1);
        }).join("").replace(/[^ _0-9a-z]/gi, "");
    }
    return toidentifier;
}
var hasRequiredHttpErrors;
function requireHttpErrors() {
    if (hasRequiredHttpErrors) return httpErrors.exports;
    hasRequiredHttpErrors = 1;
    (function(module) {
        /*!
		 * http-errors
		 * Copyright(c) 2014 Jonathan Ong
		 * Copyright(c) 2016 Douglas Christopher Wilson
		 * MIT Licensed
		 */ var deprecate = requireDepd()("http-errors");
        var setPrototypeOf = requireSetprototypeof();
        var statuses = requireStatuses();
        var inherits = requireInherits();
        var toIdentifier = requireToidentifier();
        module.exports = createError;
        module.exports.HttpError = createHttpErrorConstructor();
        module.exports.isHttpError = createIsHttpErrorFunction(module.exports.HttpError);
        populateConstructorExports(module.exports, statuses.codes, module.exports.HttpError);
        function codeClass(status) {
            return Number(String(status).charAt(0) + "00");
        }
        function createError() {
            var err;
            var msg;
            var status = 500;
            var props = {};
            for(var i = 0; i < arguments.length; i++){
                var arg = arguments[i];
                var type = typeof arg;
                if (type === "object" && arg instanceof Error) {
                    err = arg;
                    status = err.status || err.statusCode || status;
                } else if (type === "number" && i === 0) {
                    status = arg;
                } else if (type === "string") {
                    msg = arg;
                } else if (type === "object") {
                    props = arg;
                } else {
                    throw new TypeError("argument #" + (i + 1) + " unsupported type " + type);
                }
            }
            if (typeof status === "number" && (status < 400 || status >= 600)) {
                deprecate("non-error status code; use only 4xx or 5xx status codes");
            }
            if (typeof status !== "number" || !statuses.message[status] && (status < 400 || status >= 600)) {
                status = 500;
            }
            var HttpError = createError[status] || createError[codeClass(status)];
            if (!err) {
                err = HttpError ? new HttpError(msg) : new Error(msg || statuses.message[status]);
                Error.captureStackTrace(err, createError);
            }
            if (!HttpError || !(err instanceof HttpError) || err.status !== status) {
                err.expose = status < 500;
                err.status = err.statusCode = status;
            }
            for(var key in props){
                if (key !== "status" && key !== "statusCode") {
                    err[key] = props[key];
                }
            }
            return err;
        }
        function createHttpErrorConstructor() {
            function HttpError() {
                throw new TypeError("cannot construct abstract class");
            }
            inherits(HttpError, Error);
            return HttpError;
        }
        function createClientErrorConstructor(HttpError, name, code) {
            var className = toClassName(name);
            function ClientError(message) {
                var msg = message != null ? message : statuses.message[code];
                var err = new Error(msg);
                Error.captureStackTrace(err, ClientError);
                setPrototypeOf(err, ClientError.prototype);
                Object.defineProperty(err, "message", {
                    enumerable: true,
                    configurable: true,
                    value: msg,
                    writable: true
                });
                Object.defineProperty(err, "name", {
                    enumerable: false,
                    configurable: true,
                    value: className,
                    writable: true
                });
                return err;
            }
            inherits(ClientError, HttpError);
            nameFunc(ClientError, className);
            ClientError.prototype.status = code;
            ClientError.prototype.statusCode = code;
            ClientError.prototype.expose = true;
            return ClientError;
        }
        function createIsHttpErrorFunction(HttpError) {
            return function isHttpError(val) {
                if (!val || typeof val !== "object") {
                    return false;
                }
                if (val instanceof HttpError) {
                    return true;
                }
                return val instanceof Error && typeof val.expose === "boolean" && typeof val.statusCode === "number" && val.status === val.statusCode;
            };
        }
        function createServerErrorConstructor(HttpError, name, code) {
            var className = toClassName(name);
            function ServerError(message) {
                var msg = message != null ? message : statuses.message[code];
                var err = new Error(msg);
                Error.captureStackTrace(err, ServerError);
                setPrototypeOf(err, ServerError.prototype);
                Object.defineProperty(err, "message", {
                    enumerable: true,
                    configurable: true,
                    value: msg,
                    writable: true
                });
                Object.defineProperty(err, "name", {
                    enumerable: false,
                    configurable: true,
                    value: className,
                    writable: true
                });
                return err;
            }
            inherits(ServerError, HttpError);
            nameFunc(ServerError, className);
            ServerError.prototype.status = code;
            ServerError.prototype.statusCode = code;
            ServerError.prototype.expose = false;
            return ServerError;
        }
        function nameFunc(func, name) {
            var desc = Object.getOwnPropertyDescriptor(func, "name");
            if (desc && desc.configurable) {
                desc.value = name;
                Object.defineProperty(func, "name", desc);
            }
        }
        function populateConstructorExports(exports$1, codes, HttpError) {
            codes.forEach(function forEachCode(code) {
                var CodeError;
                var name = toIdentifier(statuses.message[code]);
                switch(codeClass(code)){
                    case 400:
                        CodeError = createClientErrorConstructor(HttpError, name, code);
                        break;
                    case 500:
                        CodeError = createServerErrorConstructor(HttpError, name, code);
                        break;
                }
                if (CodeError) {
                    exports$1[code] = CodeError;
                    exports$1[name] = CodeError;
                }
            });
        }
        function toClassName(name) {
            return name.substr(-5) !== "Error" ? name + "Error" : name;
        }
    })(httpErrors);
    return httpErrors.exports;
}
var httpErrorsExports = requireHttpErrors();
const createHttpError = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$_commonjsHelpers$2d$B85MJLTf$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["g"])(httpErrorsExports);
function parseParams(input, delimiter = ";") {
    let parser = delimiter === ";" ? /(?:^|;)\s*([^=;\s]+)(\s*=\s*(?:"((?:[^"\\]|\\.)*)"|((?:[^;]|\\\;)+))?)?/g : /(?:^|,)\s*([^=,\s]+)(\s*=\s*(?:"((?:[^"\\]|\\.)*)"|((?:[^,]|\\\,)+))?)?/g;
    let params = [];
    let match;
    while((match = parser.exec(input)) !== null){
        let key = match[1].trim();
        let value;
        if (match[2]) {
            value = (match[3] || match[4] || "").replace(/\\(.)/g, "$1").trim();
        }
        params.push([
            key,
            value
        ]);
    }
    return params;
}
function quote(value) {
    if (value.includes('"') || value.includes(";") || value.includes(" ")) {
        return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
}
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
function isIterable(value) {
    return value != null && typeof value[Symbol.iterator] === "function";
}
function isValidDate(date) {
    return date instanceof Date && !isNaN(date.getTime());
}
function quoteEtag(tag) {
    return tag === "*" ? tag : /^(W\/)?".*"$/.test(tag) ? tag : `"${tag}"`;
}
function removeMilliseconds(time) {
    let timestamp = time instanceof Date ? time.getTime() : time;
    return Math.floor(timestamp / 1e3);
}
const imfFixdatePattern = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/;
function parseHttpDate(dateString) {
    if (!imfFixdatePattern.test(dateString)) {
        return null;
    }
    let timestamp = Date.parse(dateString);
    if (isNaN(timestamp)) {
        return null;
    }
    return timestamp;
}
class Accept {
    #map;
    constructor(init){
        this.#map = /* @__PURE__ */ new Map();
        if (init) {
            if (typeof init === "string") {
                for (let piece of init.split(/\s*,\s*/)){
                    let params = parseParams(piece);
                    if (params.length < 1) continue;
                    let mediaType = params[0][0];
                    let weight = 1;
                    for(let i = 1; i < params.length; i++){
                        let [key, value] = params[i];
                        if (key === "q") {
                            weight = Number(value);
                            break;
                        }
                    }
                    this.#map.set(mediaType.toLowerCase(), weight);
                }
            } else if (isIterable(init)) {
                for (let mediaType of init){
                    if (Array.isArray(mediaType)) {
                        this.#map.set(mediaType[0].toLowerCase(), mediaType[1]);
                    } else {
                        this.#map.set(mediaType.toLowerCase(), 1);
                    }
                }
            } else {
                for (let mediaType of Object.getOwnPropertyNames(init)){
                    this.#map.set(mediaType.toLowerCase(), init[mediaType]);
                }
            }
            this.#sort();
        }
    }
    #sort() {
        this.#map = new Map([
            ...this.#map
        ].sort((a, b)=>b[1] - a[1]));
    }
    /**
   * An array of all media types in the header.
   */ get mediaTypes() {
        return Array.from(this.#map.keys());
    }
    /**
   * An array of all weights (q values) in the header.
   */ get weights() {
        return Array.from(this.#map.values());
    }
    /**
   * The number of media types in the `Accept` header.
   */ get size() {
        return this.#map.size;
    }
    /**
   * Returns `true` if the header matches the given media type (i.e. it is "acceptable").
   * @param mediaType The media type to check.
   * @returns `true` if the media type is acceptable, `false` otherwise.
   */ accepts(mediaType) {
        return this.getWeight(mediaType) > 0;
    }
    /**
   * Gets the weight of a given media type. Also supports wildcards, so e.g. `text/*` will match `text/html`.
   * @param mediaType The media type to get the weight of.
   * @returns The weight of the media type.
   */ getWeight(mediaType) {
        let [type, subtype] = mediaType.toLowerCase().split("/");
        for (let [key, value] of this){
            let [t, s] = key.split("/");
            if ((t === type || t === "*" || type === "*") && (s === subtype || s === "*" || subtype === "*")) {
                return value;
            }
        }
        return 0;
    }
    /**
   * Returns the most preferred media type from the given list of media types.
   * @param mediaTypes The list of media types to choose from.
   * @returns The most preferred media type or `null` if none match.
   */ getPreferred(mediaTypes) {
        let sorted = mediaTypes.map((mediaType)=>[
                mediaType,
                this.getWeight(mediaType)
            ]).sort((a, b)=>b[1] - a[1]);
        let first = sorted[0];
        return first !== void 0 && first[1] > 0 ? first[0] : null;
    }
    /**
   * Returns the weight of a media type. If it is not in the header verbatim, this returns `null`.
   * @param mediaType The media type to get the weight of.
   * @returns The weight of the media type, or `null` if it is not in the header.
   */ get(mediaType) {
        return this.#map.get(mediaType.toLowerCase()) ?? null;
    }
    /**
   * Sets a media type with the given weight.
   * @param mediaType The media type to set.
   * @param weight The weight of the media type. Defaults to 1.
   */ set(mediaType, weight = 1) {
        this.#map.set(mediaType.toLowerCase(), weight);
        this.#sort();
    }
    /**
   * Removes the given media type from the header.
   * @param mediaType The media type to remove.
   */ delete(mediaType) {
        this.#map.delete(mediaType.toLowerCase());
    }
    /**
   * Checks if a media type is in the header.
   * @param mediaType The media type to check.
   * @returns `true` if the media type is in the header (verbatim), `false` otherwise.
   */ has(mediaType) {
        return this.#map.has(mediaType.toLowerCase());
    }
    /**
   * Removes all media types from the header.
   */ clear() {
        this.#map.clear();
    }
    entries() {
        return this.#map.entries();
    }
    [Symbol.iterator]() {
        return this.entries();
    }
    forEach(callback, thisArg) {
        for (let [mediaType, weight] of this){
            callback.call(thisArg, mediaType, weight, this);
        }
    }
    toString() {
        let pairs = [];
        for (let [mediaType, weight] of this.#map){
            pairs.push(`${mediaType}${weight === 1 ? "" : `;q=${weight}`}`);
        }
        return pairs.join(",");
    }
}
class AcceptEncoding {
    #map;
    constructor(init){
        this.#map = /* @__PURE__ */ new Map();
        if (init) {
            if (typeof init === "string") {
                for (let piece of init.split(/\s*,\s*/)){
                    let params = parseParams(piece);
                    if (params.length < 1) continue;
                    let encoding = params[0][0];
                    let weight = 1;
                    for(let i = 1; i < params.length; i++){
                        let [key, value] = params[i];
                        if (key === "q") {
                            weight = Number(value);
                            break;
                        }
                    }
                    this.#map.set(encoding.toLowerCase(), weight);
                }
            } else if (isIterable(init)) {
                for (let value of init){
                    if (Array.isArray(value)) {
                        this.#map.set(value[0].toLowerCase(), value[1]);
                    } else {
                        this.#map.set(value.toLowerCase(), 1);
                    }
                }
            } else {
                for (let encoding of Object.getOwnPropertyNames(init)){
                    this.#map.set(encoding.toLowerCase(), init[encoding]);
                }
            }
            this.#sort();
        }
    }
    #sort() {
        this.#map = new Map([
            ...this.#map
        ].sort((a, b)=>b[1] - a[1]));
    }
    /**
   * An array of all encodings in the header.
   */ get encodings() {
        return Array.from(this.#map.keys());
    }
    /**
   * An array of all weights (q values) in the header.
   */ get weights() {
        return Array.from(this.#map.values());
    }
    /**
   * The number of encodings in the header.
   */ get size() {
        return this.#map.size;
    }
    /**
   * Returns `true` if the header matches the given encoding (i.e. it is "acceptable").
   * @param encoding The encoding to check.
   * @returns `true` if the encoding is acceptable, `false` otherwise.
   */ accepts(encoding) {
        return encoding.toLowerCase() === "identity" || this.getWeight(encoding) > 0;
    }
    /**
   * Gets the weight an encoding. Performs wildcard matching so `*` matches all encodings.
   * @param encoding The encoding to get.
   * @returns The weight of the encoding, or `0` if it is not in the header.
   */ getWeight(encoding) {
        let lower = encoding.toLowerCase();
        for (let [enc, weight] of this){
            if (enc === lower || enc === "*" || lower === "*") {
                return weight;
            }
        }
        return 0;
    }
    /**
   * Returns the most preferred encoding from the given list of encodings.
   * @param encodings The encodings to choose from.
   * @returns The most preferred encoding or `null` if none match.
   */ getPreferred(encodings) {
        let sorted = encodings.map((encoding)=>[
                encoding,
                this.getWeight(encoding)
            ]).sort((a, b)=>b[1] - a[1]);
        let first = sorted[0];
        return first !== void 0 && first[1] > 0 ? first[0] : null;
    }
    /**
   * Gets the weight of an encoding. If it is not in the header verbatim, this returns `null`.
   * @param encoding The encoding to get.
   * @returns The weight of the encoding, or `null` if it is not in the header.
   */ get(encoding) {
        return this.#map.get(encoding.toLowerCase()) ?? null;
    }
    /**
   * Sets an encoding with the given weight.
   * @param encoding The encoding to set.
   * @param weight The weight of the encoding. Defaults to 1.
   */ set(encoding, weight = 1) {
        this.#map.set(encoding.toLowerCase(), weight);
        this.#sort();
    }
    /**
   * Removes the given encoding from the header.
   * @param encoding The encoding to remove.
   */ delete(encoding) {
        this.#map.delete(encoding.toLowerCase());
    }
    /**
   * Checks if the header contains a given encoding.
   * @param encoding The encoding to check.
   * @returns `true` if the encoding is in the header, `false` otherwise.
   */ has(encoding) {
        return this.#map.has(encoding.toLowerCase());
    }
    /**
   * Removes all encodings from the header.
   */ clear() {
        this.#map.clear();
    }
    entries() {
        return this.#map.entries();
    }
    [Symbol.iterator]() {
        return this.entries();
    }
    forEach(callback, thisArg) {
        for (let [encoding, weight] of this){
            callback.call(thisArg, encoding, weight, this);
        }
    }
    toString() {
        let pairs = [];
        for (let [encoding, weight] of this.#map){
            pairs.push(`${encoding}${weight === 1 ? "" : `;q=${weight}`}`);
        }
        return pairs.join(",");
    }
}
class AcceptLanguage {
    #map;
    constructor(init){
        this.#map = /* @__PURE__ */ new Map();
        if (init) {
            if (typeof init === "string") {
                for (let piece of init.split(/\s*,\s*/)){
                    let params = parseParams(piece);
                    if (params.length < 1) continue;
                    let language = params[0][0];
                    let weight = 1;
                    for(let i = 1; i < params.length; i++){
                        let [key, value] = params[i];
                        if (key === "q") {
                            weight = Number(value);
                            break;
                        }
                    }
                    this.#map.set(language.toLowerCase(), weight);
                }
            } else if (isIterable(init)) {
                for (let value of init){
                    if (Array.isArray(value)) {
                        this.#map.set(value[0].toLowerCase(), value[1]);
                    } else {
                        this.#map.set(value.toLowerCase(), 1);
                    }
                }
            } else {
                for (let language of Object.getOwnPropertyNames(init)){
                    this.#map.set(language.toLowerCase(), init[language]);
                }
            }
            this.#sort();
        }
    }
    #sort() {
        this.#map = new Map([
            ...this.#map
        ].sort((a, b)=>b[1] - a[1]));
    }
    /**
   * An array of all languages in the header.
   */ get languages() {
        return Array.from(this.#map.keys());
    }
    /**
   * An array of all weights (q values) in the header.
   */ get weights() {
        return Array.from(this.#map.values());
    }
    /**
   * The number of languages in the header.
   */ get size() {
        return this.#map.size;
    }
    /**
   * Returns `true` if the header matches the given language (i.e. it is "acceptable").
   * @param language The locale identifier of the language to check.
   * @returns `true` if the language is acceptable, `false` otherwise.
   */ accepts(language) {
        return this.getWeight(language) > 0;
    }
    /**
   * Gets the weight of a language with the given locale identifier. Performs wildcard and subtype
   * matching, so `en` matches `en-US` and `en-GB`, and `*` matches all languages.
   * @param language The locale identifier of the language to get.
   * @returns The weight of the language, or `0` if it is not in the header.
   */ getWeight(language) {
        let [base, subtype] = language.toLowerCase().split("-");
        for (let [key, value] of this){
            let [b, s] = key.split("-");
            if ((b === base || b === "*" || base === "*") && (s === subtype || s === void 0 || subtype === void 0)) {
                return value;
            }
        }
        return 0;
    }
    /**
   * Returns the most preferred language from the given list of languages.
   * @param languages The locale identifiers of the languages to choose from.
   * @returns The most preferred language or `null` if none match.
   */ getPreferred(languages) {
        let sorted = languages.map((language)=>[
                language,
                this.getWeight(language)
            ]).sort((a, b)=>b[1] - a[1]);
        let first = sorted[0];
        return first !== void 0 && first[1] > 0 ? first[0] : null;
    }
    /**
   * Gets the weight of a language with the given locale identifier. If it is not in the header
   * verbatim, this returns `null`.
   * @param language The locale identifier of the language to get.
   * @returns The weight of the language, or `null` if it is not in the header.
   */ get(language) {
        return this.#map.get(language.toLowerCase()) ?? null;
    }
    /**
   * Sets a language with the given weight.
   * @param language The locale identifier of the language to set.
   * @param weight The weight of the language. Defaults to 1.
   */ set(language, weight = 1) {
        this.#map.set(language.toLowerCase(), weight);
        this.#sort();
    }
    /**
   * Removes a language with the given locale identifier.
   * @param language The locale identifier of the language to remove.
   */ delete(language) {
        this.#map.delete(language.toLowerCase());
    }
    /**
   * Checks if the header contains a language with the given locale identifier.
   * @param language The locale identifier of the language to check.
   * @returns `true` if the language is in the header, `false` otherwise.
   */ has(language) {
        return this.#map.has(language.toLowerCase());
    }
    /**
   * Removes all languages from the header.
   */ clear() {
        this.#map.clear();
    }
    entries() {
        return this.#map.entries();
    }
    [Symbol.iterator]() {
        return this.entries();
    }
    forEach(callback, thisArg) {
        for (let [language, weight] of this){
            callback.call(thisArg, language, weight, this);
        }
    }
    toString() {
        let pairs = [];
        for (let [language, weight] of this.#map){
            pairs.push(`${language}${weight === 1 ? "" : `;q=${weight}`}`);
        }
        return pairs.join(",");
    }
}
class CacheControl {
    maxAge;
    maxStale;
    minFresh;
    sMaxage;
    noCache;
    noStore;
    noTransform;
    onlyIfCached;
    mustRevalidate;
    proxyRevalidate;
    mustUnderstand;
    private;
    public;
    immutable;
    staleWhileRevalidate;
    staleIfError;
    constructor(init){
        if (init) {
            if (typeof init === "string") {
                let params = parseParams(init, ",");
                if (params.length > 0) {
                    for (let [name, value] of params){
                        switch(name){
                            case "max-age":
                                this.maxAge = Number(value);
                                break;
                            case "max-stale":
                                this.maxStale = Number(value);
                                break;
                            case "min-fresh":
                                this.minFresh = Number(value);
                                break;
                            case "s-maxage":
                                this.sMaxage = Number(value);
                                break;
                            case "no-cache":
                                this.noCache = true;
                                break;
                            case "no-store":
                                this.noStore = true;
                                break;
                            case "no-transform":
                                this.noTransform = true;
                                break;
                            case "only-if-cached":
                                this.onlyIfCached = true;
                                break;
                            case "must-revalidate":
                                this.mustRevalidate = true;
                                break;
                            case "proxy-revalidate":
                                this.proxyRevalidate = true;
                                break;
                            case "must-understand":
                                this.mustUnderstand = true;
                                break;
                            case "private":
                                this.private = true;
                                break;
                            case "public":
                                this.public = true;
                                break;
                            case "immutable":
                                this.immutable = true;
                                break;
                            case "stale-while-revalidate":
                                this.staleWhileRevalidate = Number(value);
                                break;
                            case "stale-if-error":
                                this.staleIfError = Number(value);
                                break;
                        }
                    }
                }
            } else {
                this.maxAge = init.maxAge;
                this.maxStale = init.maxStale;
                this.minFresh = init.minFresh;
                this.sMaxage = init.sMaxage;
                this.noCache = init.noCache;
                this.noStore = init.noStore;
                this.noTransform = init.noTransform;
                this.onlyIfCached = init.onlyIfCached;
                this.mustRevalidate = init.mustRevalidate;
                this.proxyRevalidate = init.proxyRevalidate;
                this.mustUnderstand = init.mustUnderstand;
                this.private = init.private;
                this.public = init.public;
                this.immutable = init.immutable;
                this.staleWhileRevalidate = init.staleWhileRevalidate;
                this.staleIfError = init.staleIfError;
            }
        }
    }
    toString() {
        let parts = [];
        if (this.public) {
            parts.push("public");
        }
        if (this.private) {
            parts.push("private");
        }
        if (typeof this.maxAge === "number") {
            parts.push(`max-age=${this.maxAge}`);
        }
        if (typeof this.sMaxage === "number") {
            parts.push(`s-maxage=${this.sMaxage}`);
        }
        if (this.noCache) {
            parts.push("no-cache");
        }
        if (this.noStore) {
            parts.push("no-store");
        }
        if (this.noTransform) {
            parts.push("no-transform");
        }
        if (this.onlyIfCached) {
            parts.push("only-if-cached");
        }
        if (this.mustRevalidate) {
            parts.push("must-revalidate");
        }
        if (this.proxyRevalidate) {
            parts.push("proxy-revalidate");
        }
        if (this.mustUnderstand) {
            parts.push("must-understand");
        }
        if (this.immutable) {
            parts.push("immutable");
        }
        if (typeof this.staleWhileRevalidate === "number") {
            parts.push(`stale-while-revalidate=${this.staleWhileRevalidate}`);
        }
        if (typeof this.staleIfError === "number") {
            parts.push(`stale-if-error=${this.staleIfError}`);
        }
        if (typeof this.maxStale === "number") {
            parts.push(`max-stale=${this.maxStale}`);
        }
        if (typeof this.minFresh === "number") {
            parts.push(`min-fresh=${this.minFresh}`);
        }
        return parts.join(", ");
    }
}
class ContentDisposition {
    filename;
    filenameSplat;
    name;
    type;
    constructor(init){
        if (init) {
            if (typeof init === "string") {
                let params = parseParams(init);
                if (params.length > 0) {
                    this.type = params[0][0];
                    for (let [name, value] of params.slice(1)){
                        if (name === "filename") {
                            this.filename = value;
                        } else if (name === "filename*") {
                            this.filenameSplat = value;
                        } else if (name === "name") {
                            this.name = value;
                        }
                    }
                }
            } else {
                this.filename = init.filename;
                this.filenameSplat = init.filenameSplat;
                this.name = init.name;
                this.type = init.type;
            }
        }
    }
    /**
   * The preferred filename for the content, using the `filename*` parameter if present, falling back to the `filename` parameter.
   *
   * From [RFC 6266](https://tools.ietf.org/html/rfc6266):
   *
   * Many user agent implementations predating this specification do not understand the "filename*" parameter.
   * Therefore, when both "filename" and "filename*" are present in a single header field value, recipients SHOULD
   * pick "filename*" and ignore "filename". This way, senders can avoid special-casing specific user agents by
   * sending both the more expressive "filename*" parameter, and the "filename" parameter as fallback for legacy recipients.
   */ get preferredFilename() {
        let filenameSplat = this.filenameSplat;
        if (filenameSplat) {
            let decodedFilename = decodeFilenameSplat(filenameSplat);
            if (decodedFilename) return decodedFilename;
        }
        return this.filename;
    }
    toString() {
        if (!this.type) {
            return "";
        }
        let parts = [
            this.type
        ];
        if (this.name) {
            parts.push(`name=${quote(this.name)}`);
        }
        if (this.filename) {
            parts.push(`filename=${quote(this.filename)}`);
        }
        if (this.filenameSplat) {
            parts.push(`filename*=${quote(this.filenameSplat)}`);
        }
        return parts.join("; ");
    }
}
function decodeFilenameSplat(value) {
    let match = value.match(/^([\w-]+)'([^']*)'(.+)$/);
    if (!match) return null;
    let [, charset, , encodedFilename] = match;
    let decodedFilename = percentDecode(encodedFilename);
    try {
        let decoder = new TextDecoder(charset);
        let bytes = new Uint8Array(decodedFilename.split("").map((char)=>char.charCodeAt(0)));
        return decoder.decode(bytes);
    } catch (error) {
        console.warn(`Failed to decode filename from charset ${charset}:`, error);
        return decodedFilename;
    }
}
function percentDecode(value) {
    return value.replace(/\+/g, " ").replace(/%([0-9A-Fa-f]{2})/g, (_, hex)=>{
        return String.fromCharCode(parseInt(hex, 16));
    });
}
class ContentRange {
    unit = "";
    start = null;
    end = null;
    size;
    constructor(init){
        if (init) {
            if (typeof init === "string") {
                let match = init.match(/^(\w+)\s+(?:(\d+)-(\d+)|\*)\/((?:\d+|\*))$/);
                if (match) {
                    this.unit = match[1];
                    this.start = match[2] ? parseInt(match[2], 10) : null;
                    this.end = match[3] ? parseInt(match[3], 10) : null;
                    this.size = match[4] === "*" ? "*" : parseInt(match[4], 10);
                }
            } else {
                if (init.unit !== void 0) this.unit = init.unit;
                if (init.start !== void 0) this.start = init.start;
                if (init.end !== void 0) this.end = init.end;
                if (init.size !== void 0) this.size = init.size;
            }
        }
    }
    toString() {
        if (!this.unit || this.size === void 0) return "";
        let range = this.start !== null && this.end !== null ? `${this.start}-${this.end}` : "*";
        return `${this.unit} ${range}/${this.size}`;
    }
}
class ContentType {
    boundary;
    charset;
    mediaType;
    constructor(init){
        if (init) {
            if (typeof init === "string") {
                let params = parseParams(init);
                if (params.length > 0) {
                    this.mediaType = params[0][0];
                    for (let [name, value] of params.slice(1)){
                        if (name === "boundary") {
                            this.boundary = value;
                        } else if (name === "charset") {
                            this.charset = value;
                        }
                    }
                }
            } else {
                this.boundary = init.boundary;
                this.charset = init.charset;
                this.mediaType = init.mediaType;
            }
        }
    }
    toString() {
        if (!this.mediaType) {
            return "";
        }
        let parts = [
            this.mediaType
        ];
        if (this.charset) {
            parts.push(`charset=${quote(this.charset)}`);
        }
        if (this.boundary) {
            parts.push(`boundary=${quote(this.boundary)}`);
        }
        return parts.join("; ");
    }
}
class Cookie {
    #map;
    constructor(init){
        this.#map = /* @__PURE__ */ new Map();
        if (init) {
            if (typeof init === "string") {
                let params = parseParams(init);
                for (let [name, value] of params){
                    this.#map.set(name, value ?? "");
                }
            } else if (isIterable(init)) {
                for (let [name, value] of init){
                    this.#map.set(name, value);
                }
            } else {
                for (let name of Object.getOwnPropertyNames(init)){
                    this.#map.set(name, init[name]);
                }
            }
        }
    }
    /**
   * An array of the names of the cookies in the header.
   */ get names() {
        return Array.from(this.#map.keys());
    }
    /**
   * An array of the values of the cookies in the header.
   */ get values() {
        return Array.from(this.#map.values());
    }
    /**
   * The number of cookies in the header.
   */ get size() {
        return this.#map.size;
    }
    /**
   * Gets the value of a cookie with the given name from the header.
   * @param name The name of the cookie.
   * @returns The value of the cookie, or `null` if the cookie does not exist.
   */ get(name) {
        return this.#map.get(name) ?? null;
    }
    /**
   * Sets a cookie with the given name and value in the header.
   * @param name The name of the cookie.
   * @param value The value of the cookie.
   */ set(name, value) {
        this.#map.set(name, value);
    }
    /**
   * Removes a cookie with the given name from the header.
   * @param name The name of the cookie.
   */ delete(name) {
        this.#map.delete(name);
    }
    /**
   * True if a cookie with the given name exists in the header.
   * @param name The name of the cookie.
   * @returns True if a cookie with the given name exists in the header.
   */ has(name) {
        return this.#map.has(name);
    }
    /**
   * Removes all cookies from the header.
   */ clear() {
        this.#map.clear();
    }
    entries() {
        return this.#map.entries();
    }
    [Symbol.iterator]() {
        return this.entries();
    }
    forEach(callback, thisArg) {
        for (let [name, value] of this){
            callback.call(thisArg, name, value, this);
        }
    }
    toString() {
        let pairs = [];
        for (let [name, value] of this.#map){
            pairs.push(`${name}=${quote(value)}`);
        }
        return pairs.join("; ");
    }
}
class IfMatch {
    tags = [];
    constructor(init){
        if (init) {
            if (typeof init === "string") {
                this.tags.push(...init.split(/\s*,\s*/).map(quoteEtag));
            } else if (Array.isArray(init)) {
                this.tags.push(...init.map(quoteEtag));
            } else {
                this.tags.push(...init.tags.map(quoteEtag));
            }
        }
    }
    /**
   * Checks if the header contains the given entity tag.
   *
   * Note: This method checks only for exact matches and does not consider wildcards.
   *
   * @param tag The entity tag to check for.
   * @returns `true` if the tag is present in the header, `false` otherwise.
   */ has(tag) {
        return this.tags.includes(quoteEtag(tag));
    }
    /**
   * Checks if the precondition passes for the given entity tag.
   *
   * This method always returns `true` if the `If-Match` header is not present
   * since the precondition passes regardless of the entity tag being checked.
   *
   * Uses strong comparison as per RFC 9110, meaning weak entity tags (prefixed with `W/`)
   * will never match.
   *
   * @param tag The entity tag to check against.
   * @returns `true` if the precondition passes, `false` if it fails (should return 412).
   */ matches(tag) {
        if (this.tags.length === 0) {
            return true;
        }
        if (this.tags.includes("*")) {
            return true;
        }
        let normalizedTag = quoteEtag(tag);
        if (normalizedTag.startsWith("W/")) {
            return false;
        }
        for (let headerTag of this.tags){
            if (!headerTag.startsWith("W/") && headerTag === normalizedTag) {
                return true;
            }
        }
        return false;
    }
    toString() {
        return this.tags.join(", ");
    }
}
class IfNoneMatch {
    tags = [];
    constructor(init){
        if (init) {
            if (typeof init === "string") {
                this.tags.push(...init.split(/\s*,\s*/).map(quoteEtag));
            } else if (Array.isArray(init)) {
                this.tags.push(...init.map(quoteEtag));
            } else {
                this.tags.push(...init.tags.map(quoteEtag));
            }
        }
    }
    /**
   * Checks if the header contains the given entity tag.
   *
   * Note: This method checks only for exact matches and does not consider wildcards.
   *
   * @param tag The entity tag to check for.
   * @returns `true` if the tag is present in the header, `false` otherwise.
   */ has(tag) {
        return this.tags.includes(quoteEtag(tag));
    }
    /**
   * Checks if this header matches the given entity tag.
   *
   * @param tag The entity tag to check for.
   * @returns `true` if the tag is present in the header (or the header contains a wildcard), `false` otherwise.
   */ matches(tag) {
        return this.has(tag) || this.tags.includes("*");
    }
    toString() {
        return this.tags.join(", ");
    }
}
class IfRange {
    value = "";
    constructor(init){
        if (init) {
            if (typeof init === "string") {
                this.value = init;
            } else {
                this.value = init.toUTCString();
            }
        }
    }
    /**
   * Checks if the `If-Range` condition is satisfied for the current resource state.
   *
   * This method always returns `true` if the `If-Range` header is not present,
   * meaning the range request should proceed unconditionally.
   *
   * The `If-Range` header can contain either:
   * - An HTTP date (RFC 7231 IMF-fixdate format)
   * - An entity tag (ETag)
   *
   * When comparing ETags, only strong entity tags are matched as per RFC 7233.
   * Weak entity tags (prefixed with `W/`) are never considered a match.
   *
   * @param resource The current resource state to compare against
   * @returns `true` if the condition is satisfied, `false` otherwise
   *
   * @example
   * ```ts
   * let ifRange = new IfRange('Wed, 21 Oct 2015 07:28:00 GMT')
   * ifRange.matches({ lastModified: 1445412480000 }) // true if dates match
   * ifRange.matches({ lastModified: new Date('2015-10-21T07:28:00Z') }) // true
   *
   * let ifRange2 = new IfRange('"abc123"')
   * ifRange2.matches({ etag: '"abc123"' }) // true
   * ifRange2.matches({ etag: 'W/"abc123"' }) // false (weak ETag)
   * ```
   */ matches(resource) {
        if (!this.value) {
            return true;
        }
        let dateTimestamp = parseHttpDate(this.value);
        if (dateTimestamp !== null && resource.lastModified != null) {
            return removeMilliseconds(dateTimestamp) === removeMilliseconds(resource.lastModified);
        }
        if (resource.etag != null) {
            let normalizedTag = quoteEtag(this.value);
            let normalizedResourceTag = quoteEtag(resource.etag);
            if (normalizedTag.startsWith("W/") || normalizedResourceTag.startsWith("W/")) {
                return false;
            }
            return normalizedTag === normalizedResourceTag;
        }
        return false;
    }
    toString() {
        return this.value;
    }
}
class Range {
    unit = "";
    ranges = [];
    constructor(init){
        if (init) {
            if (typeof init === "string") {
                let match = init.match(/^(\w+)=(.+)$/);
                if (match) {
                    this.unit = match[1];
                    let rangeParts = match[2].split(",");
                    let hasInvalidPart = false;
                    for (let part of rangeParts){
                        let rangeMatch = part.trim().match(/^(\d*)-(\d*)$/);
                        if (!rangeMatch) {
                            hasInvalidPart = true;
                            continue;
                        }
                        let [, startStr, endStr] = rangeMatch;
                        if (!startStr && !endStr) {
                            hasInvalidPart = true;
                            continue;
                        }
                        let start = startStr ? parseInt(startStr, 10) : void 0;
                        let end = endStr ? parseInt(endStr, 10) : void 0;
                        if (start !== void 0 && end !== void 0 && start > end) {
                            hasInvalidPart = true;
                            continue;
                        }
                        this.ranges.push({
                            start,
                            end
                        });
                    }
                    if (hasInvalidPart) {
                        this.ranges = [];
                    }
                }
            } else {
                if (init.unit !== void 0) this.unit = init.unit;
                if (init.ranges !== void 0) this.ranges = init.ranges;
            }
        }
    }
    /**
   * Checks if this range can be satisfied for a resource of the given size.
   * Returns false if the range is malformed or all ranges are beyond the resource size.
   */ canSatisfy(resourceSize) {
        if (!this.unit || this.ranges.length === 0) return false;
        for (let range of this.ranges){
            if (range.start === void 0 && range.end === void 0) {
                return false;
            }
            if (range.start !== void 0 && range.end !== void 0 && range.start > range.end) {
                return false;
            }
        }
        for (let range of this.ranges){
            if (range.start === void 0) {
                return true;
            }
            if (range.start < resourceSize) {
                return true;
            }
        }
        return false;
    }
    /**
   * Normalizes the ranges for a resource of the given size.
   * Returns an array of ranges with resolved start and end values.
   * Returns an empty array if the range cannot be satisfied.
   */ normalize(resourceSize) {
        if (!this.canSatisfy(resourceSize)) {
            return [];
        }
        return this.ranges.map((range)=>{
            if (range.start !== void 0 && range.end !== void 0) {
                return {
                    start: range.start,
                    end: Math.min(range.end, resourceSize - 1)
                };
            } else if (range.start !== void 0) {
                return {
                    start: range.start,
                    end: resourceSize - 1
                };
            } else {
                let suffix = range.end;
                return {
                    start: Math.max(0, resourceSize - suffix),
                    end: resourceSize - 1
                };
            }
        });
    }
    toString() {
        if (!this.unit || this.ranges.length === 0) return "";
        let rangeParts = this.ranges.map((range)=>{
            if (range.start !== void 0 && range.end !== void 0) {
                return `${range.start}-${range.end}`;
            } else if (range.start !== void 0) {
                return `${range.start}-`;
            } else if (range.end !== void 0) {
                return `-${range.end}`;
            }
            return "";
        });
        return `${this.unit}=${rangeParts.join(",")}`;
    }
}
class SetCookie {
    domain;
    expires;
    httpOnly;
    maxAge;
    name;
    partitioned;
    path;
    sameSite;
    secure;
    value;
    constructor(init){
        if (init) {
            if (typeof init === "string") {
                let params = parseParams(init);
                if (params.length > 0) {
                    this.name = params[0][0];
                    this.value = params[0][1];
                    for (let [key, value] of params.slice(1)){
                        switch(key.toLowerCase()){
                            case "domain":
                                this.domain = value;
                                break;
                            case "expires":
                                {
                                    if (typeof value === "string") {
                                        let date = new Date(value);
                                        if (isValidDate(date)) {
                                            this.expires = date;
                                        }
                                    }
                                    break;
                                }
                            case "httponly":
                                this.httpOnly = true;
                                break;
                            case "max-age":
                                {
                                    if (typeof value === "string") {
                                        let v = parseInt(value, 10);
                                        if (!isNaN(v)) this.maxAge = v;
                                    }
                                    break;
                                }
                            case "partitioned":
                                this.partitioned = true;
                                break;
                            case "path":
                                this.path = value;
                                break;
                            case "samesite":
                                if (typeof value === "string" && /strict|lax|none/i.test(value)) {
                                    this.sameSite = capitalize(value);
                                }
                                break;
                            case "secure":
                                this.secure = true;
                                break;
                        }
                    }
                }
            } else {
                this.domain = init.domain;
                this.expires = init.expires;
                this.httpOnly = init.httpOnly;
                this.maxAge = init.maxAge;
                this.name = init.name;
                this.partitioned = init.partitioned;
                this.path = init.path;
                this.sameSite = init.sameSite;
                this.secure = init.secure;
                this.value = init.value;
            }
        }
    }
    toString() {
        if (!this.name) {
            return "";
        }
        let parts = [
            `${this.name}=${quote(this.value || "")}`
        ];
        if (this.domain) {
            parts.push(`Domain=${this.domain}`);
        }
        if (this.expires) {
            parts.push(`Expires=${this.expires.toUTCString()}`);
        }
        if (this.httpOnly) {
            parts.push("HttpOnly");
        }
        if (this.maxAge) {
            parts.push(`Max-Age=${this.maxAge}`);
        }
        if (this.partitioned) {
            parts.push("Partitioned");
        }
        if (this.path) {
            parts.push(`Path=${this.path}`);
        }
        if (this.sameSite) {
            parts.push(`SameSite=${this.sameSite}`);
        }
        if (this.secure) {
            parts.push("Secure");
        }
        return parts.join("; ");
    }
}
const HeaderWordCasingExceptions = {
    ct: "CT",
    etag: "ETag",
    te: "TE",
    www: "WWW",
    x: "X",
    xss: "XSS"
};
function canonicalHeaderName(name) {
    return name.toLowerCase().split("-").map((word)=>HeaderWordCasingExceptions[word] || word.charAt(0).toUpperCase() + word.slice(1)).join("-");
}
const CRLF = "\r\n";
const AcceptKey = "accept";
const AcceptEncodingKey = "accept-encoding";
const AcceptLanguageKey = "accept-language";
const AcceptRangesKey = "accept-ranges";
const AgeKey = "age";
const AllowKey = "allow";
const CacheControlKey = "cache-control";
const ConnectionKey = "connection";
const ContentDispositionKey = "content-disposition";
const ContentEncodingKey = "content-encoding";
const ContentLanguageKey = "content-language";
const ContentLengthKey = "content-length";
const ContentRangeKey = "content-range";
const ContentTypeKey = "content-type";
const CookieKey = "cookie";
const DateKey = "date";
const ETagKey = "etag";
const ExpiresKey = "expires";
const HostKey = "host";
const IfMatchKey = "if-match";
const IfModifiedSinceKey = "if-modified-since";
const IfNoneMatchKey = "if-none-match";
const IfRangeKey = "if-range";
const IfUnmodifiedSinceKey = "if-unmodified-since";
const LastModifiedKey = "last-modified";
const LocationKey = "location";
const RangeKey = "range";
const RefererKey = "referer";
const SetCookieKey = "set-cookie";
class SuperHeaders extends Headers {
    #map;
    #setCookies = [];
    constructor(init){
        super();
        this.#map = /* @__PURE__ */ new Map();
        if (init) {
            if (typeof init === "string") {
                let lines = init.split(CRLF);
                for (let line of lines){
                    let match = line.match(/^([^:]+):(.*)/);
                    if (match) {
                        this.append(match[1].trim(), match[2].trim());
                    }
                }
            } else if (isIterable(init)) {
                for (let [name, value] of init){
                    this.append(name, value);
                }
            } else if (typeof init === "object") {
                for (let name of Object.getOwnPropertyNames(init)){
                    let value = init[name];
                    let descriptor = Object.getOwnPropertyDescriptor(SuperHeaders.prototype, name);
                    if (descriptor?.set) {
                        descriptor.set.call(this, value);
                    } else {
                        this.set(name, value.toString());
                    }
                }
            }
        }
    }
    /**
   * Appends a new header value to the existing set of values for a header,
   * or adds the header if it does not already exist.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/append)
   */ append(name, value) {
        let key = name.toLowerCase();
        if (key === SetCookieKey) {
            this.#setCookies.push(value);
        } else {
            let existingValue = this.#map.get(key);
            this.#map.set(key, existingValue ? `${existingValue}, ${value}` : value);
        }
    }
    /**
   * Removes a header.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/delete)
   */ delete(name) {
        let key = name.toLowerCase();
        if (key === SetCookieKey) {
            this.#setCookies = [];
        } else {
            this.#map.delete(key);
        }
    }
    /**
   * Returns a string of all the values for a header, or `null` if the header does not exist.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/get)
   */ get(name) {
        let key = name.toLowerCase();
        if (key === SetCookieKey) {
            return this.getSetCookie().join(", ");
        } else {
            let value = this.#map.get(key);
            if (typeof value === "string") {
                return value;
            } else if (value != null) {
                let str = value.toString();
                return str === "" ? null : str;
            } else {
                return null;
            }
        }
    }
    /**
   * Returns an array of all values associated with the `Set-Cookie` header. This is
   * useful when building headers for a HTTP response since multiple `Set-Cookie` headers
   * must be sent on separate lines.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/getSetCookie)
   */ getSetCookie() {
        return this.#setCookies.map((v)=>typeof v === "string" ? v : v.toString());
    }
    /**
   * Returns `true` if the header is present in the list of headers.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/has)
   */ has(name) {
        let key = name.toLowerCase();
        return key === SetCookieKey ? this.#setCookies.length > 0 : this.get(key) != null;
    }
    /**
   * Sets a new value for the given header. If the header already exists, the new value
   * will replace the existing value.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/set)
   */ set(name, value) {
        let key = name.toLowerCase();
        if (key === SetCookieKey) {
            this.#setCookies = [
                value
            ];
        } else {
            this.#map.set(key, value);
        }
    }
    /**
   * Returns an iterator of all header keys (lowercase).
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/keys)
   */ *keys() {
        for (let [key] of this)yield key;
    }
    /**
   * Returns an iterator of all header values.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/values)
   */ *values() {
        for (let [, value] of this)yield value;
    }
    /**
   * Returns an iterator of all header key/value pairs.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/entries)
   */ *entries() {
        for (let [key] of this.#map){
            let str = this.get(key);
            if (str) yield [
                key,
                str
            ];
        }
        for (let value of this.getSetCookie()){
            yield [
                SetCookieKey,
                value
            ];
        }
    }
    [Symbol.iterator]() {
        return this.entries();
    }
    /**
   * Invokes the `callback` for each header key/value pair.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers/forEach)
   */ forEach(callback, thisArg) {
        for (let [key, value] of this){
            callback.call(thisArg, value, key, this);
        }
    }
    /**
   * Returns a string representation of the headers suitable for use in a HTTP message.
   */ toString() {
        let lines = [];
        for (let [key, value] of this){
            lines.push(`${canonicalHeaderName(key)}: ${value}`);
        }
        return lines.join(CRLF);
    }
    // Header-specific getters and setters
    /**
   * The `Accept` header is used by clients to indicate the media types that are acceptable
   * in the response.
   *
   * [MDN `Accept` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-5.3.2)
   */ get accept() {
        return this.#getHeaderValue(AcceptKey, Accept);
    }
    set accept(value) {
        this.#setHeaderValue(AcceptKey, Accept, value);
    }
    /**
   * The `Accept-Encoding` header contains information about the content encodings that the client
   * is willing to accept in the response.
   *
   * [MDN `Accept-Encoding` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Encoding)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-5.3.4)
   */ get acceptEncoding() {
        return this.#getHeaderValue(AcceptEncodingKey, AcceptEncoding);
    }
    set acceptEncoding(value) {
        this.#setHeaderValue(AcceptEncodingKey, AcceptEncoding, value);
    }
    /**
   * The `Accept-Language` header contains information about preferred natural language for the
   * response.
   *
   * [MDN `Accept-Language` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-5.3.5)
   */ get acceptLanguage() {
        return this.#getHeaderValue(AcceptLanguageKey, AcceptLanguage);
    }
    set acceptLanguage(value) {
        this.#setHeaderValue(AcceptLanguageKey, AcceptLanguage, value);
    }
    /**
   * The `Accept-Ranges` header indicates the server's acceptance of range requests.
   *
   * [MDN `Accept-Ranges` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Ranges)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7233#section-2.3)
   */ get acceptRanges() {
        return this.#getStringValue(AcceptRangesKey);
    }
    set acceptRanges(value) {
        this.#setStringValue(AcceptRangesKey, value);
    }
    /**
   * The `Age` header contains the time in seconds an object was in a proxy cache.
   *
   * [MDN `Age` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Age)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7234#section-5.1)
   */ get age() {
        return this.#getNumberValue(AgeKey);
    }
    set age(value) {
        this.#setNumberValue(AgeKey, value);
    }
    /**
   * The `Allow` header lists the HTTP methods that are supported by the resource.
   *
   * [MDN `Allow` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Allow)
   *
   * [HTTP/1.1 Specification](https://httpwg.org/specs/rfc9110.html#field.allow)
   */ get allow() {
        return this.#getStringValue(AllowKey);
    }
    set allow(value) {
        this.#setStringValue(AllowKey, Array.isArray(value) ? value.join(", ") : value);
    }
    /**
   * The `Cache-Control` header contains directives for caching mechanisms in both requests and responses.
   *
   * [MDN `Cache-Control` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7234#section-5.2)
   */ get cacheControl() {
        return this.#getHeaderValue(CacheControlKey, CacheControl);
    }
    set cacheControl(value) {
        this.#setHeaderValue(CacheControlKey, CacheControl, value);
    }
    /**
   * The `Connection` header controls whether the network connection stays open after the current
   * transaction finishes.
   *
   * [MDN `Connection` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Connection)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7230#section-6.1)
   */ get connection() {
        return this.#getStringValue(ConnectionKey);
    }
    set connection(value) {
        this.#setStringValue(ConnectionKey, value);
    }
    /**
   * The `Content-Disposition` header is a response-type header that describes how the payload is displayed.
   *
   * [MDN `Content-Disposition` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition)
   *
   * [RFC 6266](https://datatracker.ietf.org/doc/html/rfc6266)
   */ get contentDisposition() {
        return this.#getHeaderValue(ContentDispositionKey, ContentDisposition);
    }
    set contentDisposition(value) {
        this.#setHeaderValue(ContentDispositionKey, ContentDisposition, value);
    }
    /**
   * The `Content-Encoding` header specifies the encoding of the resource.
   *
   * Note: If multiple encodings have been used, this value may be a comma-separated list. However, most often this
   * header will only contain a single value.
   *
   * [MDN `Content-Encoding` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Encoding)
   *
   * [HTTP/1.1 Specification](https://httpwg.org/specs/rfc9110.html#field.content-encoding)
   */ get contentEncoding() {
        return this.#getStringValue(ContentEncodingKey);
    }
    set contentEncoding(value) {
        this.#setStringValue(ContentEncodingKey, Array.isArray(value) ? value.join(", ") : value);
    }
    /**
   * The `Content-Language` header describes the natural language(s) of the intended audience for the response content.
   *
   * Note: If the response content is intended for multiple audiences, this value may be a comma-separated list. However,
   * most often this header will only contain a single value.
   *
   * [MDN `Content-Language` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Language)
   *
   * [HTTP/1.1 Specification](https://httpwg.org/specs/rfc9110.html#field.content-language)
   */ get contentLanguage() {
        return this.#getStringValue(ContentLanguageKey);
    }
    set contentLanguage(value) {
        this.#setStringValue(ContentLanguageKey, Array.isArray(value) ? value.join(", ") : value);
    }
    /**
   * The `Content-Length` header indicates the size of the entity-body in bytes.
   *
   * [MDN `Content-Length` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Length)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7230#section-3.3.2)
   */ get contentLength() {
        return this.#getNumberValue(ContentLengthKey);
    }
    set contentLength(value) {
        this.#setNumberValue(ContentLengthKey, value);
    }
    /**
   * The `Content-Range` header indicates where the content of a response body
   * belongs in relation to a complete resource.
   *
   * [MDN `Content-Range` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Range)
   *
   * [HTTP/1.1 Specification](https://httpwg.org/specs/rfc9110.html#field.content-range)
   */ get contentRange() {
        return this.#getHeaderValue(ContentRangeKey, ContentRange);
    }
    set contentRange(value) {
        this.#setHeaderValue(ContentRangeKey, ContentRange, value);
    }
    /**
   * The `Content-Type` header indicates the media type of the resource.
   *
   * [MDN `Content-Type` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-3.1.1.5)
   */ get contentType() {
        return this.#getHeaderValue(ContentTypeKey, ContentType);
    }
    set contentType(value) {
        this.#setHeaderValue(ContentTypeKey, ContentType, value);
    }
    /**
   * The `Cookie` request header contains stored HTTP cookies previously sent by the server with
   * the `Set-Cookie` header.
   *
   * [MDN `Cookie` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cookie)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc6265#section-5.4)
   */ get cookie() {
        return this.#getHeaderValue(CookieKey, Cookie);
    }
    set cookie(value) {
        this.#setHeaderValue(CookieKey, Cookie, value);
    }
    /**
   * The `Date` header contains the date and time at which the message was sent.
   *
   * [MDN `Date` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Date)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-7.1.1.2)
   */ get date() {
        return this.#getDateValue(DateKey);
    }
    set date(value) {
        this.#setDateValue(DateKey, value);
    }
    /**
   * The `ETag` header provides a unique identifier for the current version of the resource.
   *
   * [MDN `ETag` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7232#section-2.3)
   */ get etag() {
        return this.#getStringValue(ETagKey);
    }
    set etag(value) {
        this.#setStringValue(ETagKey, typeof value === "string" ? quoteEtag(value) : value);
    }
    /**
   * The `Expires` header contains the date/time after which the response is considered stale.
   *
   * [MDN `Expires` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Expires)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7234#section-5.3)
   */ get expires() {
        return this.#getDateValue(ExpiresKey);
    }
    set expires(value) {
        this.#setDateValue(ExpiresKey, value);
    }
    /**
   * The `Host` header specifies the domain name of the server and (optionally) the TCP port number.
   *
   * [MDN `Host` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Host)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7230#section-5.4)
   */ get host() {
        return this.#getStringValue(HostKey);
    }
    set host(value) {
        this.#setStringValue(HostKey, value);
    }
    /**
   * The `If-Modified-Since` header makes a request conditional on the last modification date of the
   * requested resource.
   *
   * [MDN `If-Modified-Since` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Modified-Since)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7232#section-3.3)
   */ get ifModifiedSince() {
        return this.#getDateValue(IfModifiedSinceKey);
    }
    set ifModifiedSince(value) {
        this.#setDateValue(IfModifiedSinceKey, value);
    }
    /**
   * The `If-Match` header makes a request conditional on the presence of a matching ETag.
   *
   * [MDN `If-Match` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Match)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7232#section-3.1)
   */ get ifMatch() {
        return this.#getHeaderValue(IfMatchKey, IfMatch);
    }
    set ifMatch(value) {
        this.#setHeaderValue(IfMatchKey, IfMatch, value);
    }
    /**
   * The `If-None-Match` header makes a request conditional on the absence of a matching ETag.
   *
   * [MDN `If-None-Match` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-None-Match)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7232#section-3.2)
   */ get ifNoneMatch() {
        return this.#getHeaderValue(IfNoneMatchKey, IfNoneMatch);
    }
    set ifNoneMatch(value) {
        this.#setHeaderValue(IfNoneMatchKey, IfNoneMatch, value);
    }
    /**
   * The `If-Range` header makes a range request conditional on the resource state.
   * Can contain either an entity tag (ETag) or an HTTP date.
   *
   * [MDN `If-Range` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Range)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7233#section-3.2)
   */ get ifRange() {
        return this.#getHeaderValue(IfRangeKey, IfRange);
    }
    set ifRange(value) {
        this.#setHeaderValue(IfRangeKey, IfRange, value);
    }
    /**
   * The `If-Unmodified-Since` header makes a request conditional on the last modification date of the
   * requested resource.
   *
   * [MDN `If-Unmodified-Since` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Unmodified-Since)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7232#section-3.4)
   */ get ifUnmodifiedSince() {
        return this.#getDateValue(IfUnmodifiedSinceKey);
    }
    set ifUnmodifiedSince(value) {
        this.#setDateValue(IfUnmodifiedSinceKey, value);
    }
    /**
   * The `Last-Modified` header contains the date and time at which the resource was last modified.
   *
   * [MDN `Last-Modified` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Last-Modified)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7232#section-2.2)
   */ get lastModified() {
        return this.#getDateValue(LastModifiedKey);
    }
    set lastModified(value) {
        this.#setDateValue(LastModifiedKey, value);
    }
    /**
   * The `Location` header indicates the URL to redirect to.
   *
   * [MDN `Location` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Location)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-7.1.2)
   */ get location() {
        return this.#getStringValue(LocationKey);
    }
    set location(value) {
        this.#setStringValue(LocationKey, value);
    }
    /**
   * The `Range` header indicates the part of a resource that the client wants to receive.
   *
   * [MDN `Range` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Range)
   *
   * [HTTP/1.1 Specification](https://httpwg.org/specs/rfc9110.html#field.range)
   */ get range() {
        return this.#getHeaderValue(RangeKey, Range);
    }
    set range(value) {
        this.#setHeaderValue(RangeKey, Range, value);
    }
    /**
   * The `Referer` header contains the address of the previous web page from which a link to the
   * currently requested page was followed.
   *
   * [MDN `Referer` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referer)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-5.5.2)
   */ get referer() {
        return this.#getStringValue(RefererKey);
    }
    set referer(value) {
        this.#setStringValue(RefererKey, value);
    }
    /**
   * The `Set-Cookie` header is used to send cookies from the server to the user agent.
   *
   * [MDN `Set-Cookie` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)
   *
   * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc6265#section-4.1)
   */ get setCookie() {
        let setCookies = this.#setCookies;
        for(let i = 0; i < setCookies.length; ++i){
            if (typeof setCookies[i] === "string") {
                setCookies[i] = new SetCookie(setCookies[i]);
            }
        }
        return setCookies;
    }
    set setCookie(value) {
        if (value != null) {
            this.#setCookies = (Array.isArray(value) ? value : [
                value
            ]).map((v)=>typeof v === "string" ? v : new SetCookie(v));
        } else {
            this.#setCookies = [];
        }
    }
    // Helpers
    #getHeaderValue(key, ctor) {
        let value = this.#map.get(key);
        if (value !== void 0) {
            if (typeof value === "string") {
                let obj2 = new ctor(value);
                this.#map.set(key, obj2);
                return obj2;
            } else {
                return value;
            }
        }
        let obj = new ctor();
        this.#map.set(key, obj);
        return obj;
    }
    #setHeaderValue(key, ctor, value) {
        if (value != null) {
            this.#map.set(key, typeof value === "string" ? value : new ctor(value));
        } else {
            this.#map.delete(key);
        }
    }
    #getDateValue(key) {
        let value = this.#map.get(key);
        return value === void 0 ? null : new Date(value);
    }
    #setDateValue(key, value) {
        if (value != null) {
            this.#map.set(key, typeof value === "string" ? value : (typeof value === "number" ? new Date(value) : value).toUTCString());
        } else {
            this.#map.delete(key);
        }
    }
    #getNumberValue(key) {
        let value = this.#map.get(key);
        return value === void 0 ? null : parseInt(value, 10);
    }
    #setNumberValue(key, value) {
        if (value != null) {
            this.#map.set(key, typeof value === "string" ? value : value.toString());
        } else {
            this.#map.delete(key);
        }
    }
    #getStringValue(key) {
        let value = this.#map.get(key);
        return value === void 0 ? null : value;
    }
    #setStringValue(key, value) {
        if (value != null) {
            this.#map.set(key, value);
        } else {
            this.#map.delete(key);
        }
    }
}
const HeaderUtilities = {
    /**
   * Check if client accepts a specific media type based on Accept header.
   * @param acceptHeader HTTP Accept header value
   * @param mediaType Media type to check for acceptance
   * @returns True if the media type is accepted by the client
   */ acceptsMediaType (acceptHeader, mediaType) {
        const accept = this.parseAccept(acceptHeader);
        return accept ? accept.accepts(mediaType) : false;
    },
    /**
   * Create Cache-Control header value from options.
   * @param options Cache control directives configuration
   * @returns Cache-Control header value string
   */ createCacheControl (options) {
        const directives = [];
        if (options.public) {
            directives.push("public");
        }
        if (options.private) {
            directives.push("private");
        }
        if (options.noCache) {
            directives.push("no-cache");
        }
        if (options.noStore) {
            directives.push("no-store");
        }
        if (options.immutable) {
            directives.push("immutable");
        }
        if (options.mustRevalidate) {
            directives.push("must-revalidate");
        }
        if (options.proxyRevalidate) {
            directives.push("proxy-revalidate");
        }
        if (options.maxAge !== void 0) {
            directives.push(`max-age=${options.maxAge}`);
        }
        if (options.sMaxAge !== void 0) {
            directives.push(`s-maxage=${options.sMaxAge}`);
        }
        if (options.minFresh !== void 0) {
            directives.push(`min-fresh=${options.minFresh}`);
        }
        if (options.staleWhileRevalidate !== void 0) {
            directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
        }
        if (options.staleIfError !== void 0) {
            directives.push(`stale-if-error=${options.staleIfError}`);
        }
        return directives.join(", ");
    },
    /**
   * Create common cache control presets with predefined configurations.
   * @param preset Preset name ('no-cache', 'no-store', 'public', 'private', or 'immutable')
   * @returns Cache-Control header value string for the preset
   */ createCacheControlPreset (preset) {
        const presets = {
            immutable: {
                immutable: true,
                maxAge: 31536e3
            },
            // 1 year
            "no-cache": {
                noCache: true
            },
            "no-store": {
                noStore: true
            },
            private: {
                maxAge: 3600,
                private: true
            },
            // 1 hour default
            public: {
                maxAge: 3600,
                public: true
            }
        };
        return this.createCacheControl(presets[preset]);
    },
    /**
   * Create Content-Disposition header for file downloads with optional filename.
   * @param options
   * @param options.filename Filename for the download
   * @param options.filenameSplat Alternative filename format
   * @param options.type Disposition type ('inline' or 'attachment')
   * @returns Content-Disposition header value string
   */ createContentDisposition (options) {
        const disposition = new ContentDisposition({
            type: options.type,
            ...options.filename && {
                filename: options.filename
            },
            ...options.filenameSplat && {
                filenameSplat: options.filenameSplat
            }
        });
        return disposition.toString();
    },
    /**
   * Create Content-Type header value from structured data with optional charset and boundary.
   * @param options
   * @param options.boundary Multipart boundary string
   * @param options.charset Character encoding (e.g., 'utf8')
   * @param options.mediaType MIME media type (e.g., 'application/json')
   * @returns Content-Type header value string
   */ createContentType (options) {
        const contentType = new ContentType({
            mediaType: options.mediaType,
            ...options.charset && {
                charset: options.charset
            },
            ...options.boundary && {
                boundary: options.boundary
            }
        });
        return contentType.toString();
    },
    /**
   * Get content type with charset if not already present.
   * @param contentType Content-Type header value to ensure charset for
   * @param defaultCharset Default charset to use if not present (default: 'utf8')
   * @returns Content-Type header value with charset ensured
   */ ensureCharset (contentType, defaultCharset = "utf8") {
        const ct = this.parseContentType(contentType);
        if (!ct) {
            return contentType;
        }
        if (!ct.charset) {
            ct.charset = defaultCharset;
        }
        return ct.toString();
    },
    /**
   * Convert our Headers type to EnhancedHeaders from remix-run/headers.
   * @param headers Headers in array or object format
   * @returns SuperHeaders instance with converted header values
   */ fromHeaders (headers) {
        const enhanced = new SuperHeaders();
        if (Array.isArray(headers)) {
            headers.forEach(([name, value])=>{
                enhanced.set(name, Array.isArray(value) ? value.join(", ") : String(value));
            });
        } else {
            Object.entries(headers).forEach(([name, value])=>{
                enhanced.set(name, Array.isArray(value) ? value.join(", ") : String(value));
            });
        }
        return enhanced;
    },
    /**
   * Get preferred media type from Accept header based on quality factors and supported types.
   * @param acceptHeader HTTP Accept header value
   * @param supportedTypes Array of supported MIME types to match against
   * @returns Best matching media type or undefined if no match found
   */ getPreferredMediaType (acceptHeader, supportedTypes) {
        const accept = this.parseAccept(acceptHeader);
        if (!accept) {
            return void 0;
        }
        for (const type of supportedTypes){
            if (accept.accepts(type)) {
                return type;
            }
        }
        return void 0;
    },
    /**
   * Parse Accept header with quality factor support.
   * @param headerValue HTTP Accept header value to parse
   * @returns Accept instance or undefined if header is invalid or missing
   */ parseAccept (headerValue) {
        if (!headerValue) {
            return void 0;
        }
        try {
            return new Accept(headerValue);
        } catch  {
            return void 0;
        }
    },
    /**
   * Parse Content-Disposition header into structured object.
   * @param headerValue HTTP Content-Disposition header value to parse
   * @returns ContentDisposition instance or undefined if header is invalid or missing
   */ parseContentDisposition (headerValue) {
        if (!headerValue) {
            return void 0;
        }
        try {
            return new ContentDisposition(headerValue);
        } catch  {
            return void 0;
        }
    },
    /**
   * Parse Content-Type header with structured access to media type, charset, and boundary.
   * @param headerValue HTTP Content-Type header value to parse
   * @returns ContentType instance or undefined if header is invalid or missing
   */ parseContentType (headerValue) {
        if (!headerValue) {
            return void 0;
        }
        try {
            return new ContentType(headerValue);
        } catch  {
            return void 0;
        }
    }
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
"[externals]/node:events [external] (node:events, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:events", () => require("node:events"));

module.exports = mod;
}),
"[externals]/node:url [external] (node:url, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:url", () => require("node:url"));

module.exports = mod;
}),
"[project]/packages/storage/dist/packem_shared/base-handler-core-AWhpn4ts.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "B",
    ()=>BaseHandlerCore,
    "a",
    ()=>getHeader,
    "b",
    ()=>getRequestStream,
    "c",
    ()=>getBaseUrl,
    "d",
    ()=>getRealPath,
    "g",
    ()=>getIdFromRequest,
    "p",
    ()=>pick,
    "r",
    ()=>readBody,
    "s",
    ()=>setHeaders,
    "u",
    ()=>uuidRegex
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$events__$5b$external$5d$__$28$node$3a$events$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:events [external] (node:events, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$url__$5b$external$5d$__$28$node$3a$url$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:url [external] (node:url, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mime$40$4$2e$1$2e$0$2f$node_modules$2f$mime$2f$dist$2f$src$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mime@4.1.0/node_modules/mime/dist/src/index.js [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/ERRORS-DKaR93nv.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/headers-C9CQX79R.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$stream__$5b$external$5d$__$28$node$3a$stream$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:stream [external] (node:stream, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$type$2d$is$40$2$2e$0$2e$1$2f$node_modules$2f$type$2d$is$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/type-is@2.0.1/node_modules/type-is/index.js [app-route] (ecmascript)");
;
;
;
;
;
;
;
const getLastOne = (value)=>value.at(-1);
const extractForwarded = (request)=>{
    let proto = "";
    let host = "";
    const header = getHeader(request, "forwarded");
    if (header) {
        const kvPairs = header.split(";");
        kvPairs.forEach((kv)=>{
            const [token, value] = kv.split("=");
            if (token === "proto") {
                proto = value;
            }
            if (token === "host") {
                host = value;
            }
        });
    }
    return {
        host,
        proto
    };
};
const readBody = (request, encoding = "utf8", limit)=>new Promise((resolve, reject)=>{
        let body = "";
        request.setEncoding(encoding);
        request.on("data", (chunk)=>{
            if (body.length + chunk.length > limit) {
                return reject(new Error("Request body length limit exceeded"));
            }
            body += chunk;
        });
        request.once("end", ()=>resolve(body));
    });
const getHeader = (request, name, all = false)=>{
    const raw = request.headers?.[name.toLowerCase()];
    if (!raw || raw.length === 0) {
        return "";
    }
    return all ? raw.toString().trim() : getLastOne(Array.isArray(raw) ? raw : raw.split(",")).trim();
};
const appendHeader = (response, name, value)=>{
    const s = [
        response.getHeader(name),
        value
    ].flat().filter(Boolean).toString();
    response.setHeader(name, s);
};
const setHeaders = (response, headers = {})=>{
    const keys = Object.keys(headers);
    if (keys.length > 0) {
        appendHeader(response, "Access-Control-Expose-Headers", keys);
    }
    keys.forEach((key)=>{
        if ([
            "link",
            "location"
        ].includes(key.toLowerCase())) {
            response.setHeader(key, encodeURI(headers[key].toString()));
        } else {
            response.setHeader(key, headers[key]);
        }
    });
};
const extractHost = (request)=>getHeader(request, "host") || getHeader(request, "x-forwarded-host");
const extractProto = (request)=>getHeader(request, "x-forwarded-proto").toLowerCase();
const getBaseUrl = (request)=>{
    let { host, proto } = extractForwarded(request);
    host ||= extractHost(request);
    proto ||= extractProto(request);
    if (!host) {
        return "";
    }
    return proto ? `${proto}://${host}` : `//${host}`;
};
const getRealPath = (request)=>{
    let realPath = (request.originalUrl || request.url || "").split("?")[0];
    if (!realPath) {
        throw new TypeError("Invalid request URL");
    }
    if (!realPath.startsWith("/")) {
        realPath = `/${realPath}`;
    }
    if (realPath.startsWith("http")) {
        const url = new URL(realPath);
        realPath = url.pathname;
    }
    return realPath;
};
const uuidRegex = /(?:[\dA-Z]+-){2}[\dA-Z]+/i;
const getIdFromRequest = (request)=>{
    const realPath = getRealPath(request);
    const segments = realPath.split("/").filter(Boolean);
    if (segments.length === 0) {
        throw new Error("Invalid request URL");
    }
    for(let index = segments.length - 1; index >= 0; index--){
        const segment = segments[index];
        if (!segment) {
            continue;
        }
        const cleanSegment = segment.replace(/\.[^/.]+$/, "");
        const commonPathNames2 = [
            "files",
            "metadata",
            "upload",
            "download",
            "http-rest",
            "http-rest-chunked"
        ];
        if (commonPathNames2.includes(cleanSegment.toLowerCase())) {
            continue;
        }
        if (uuidRegex.test(cleanSegment)) {
            return cleanSegment;
        }
    }
    const lastSegment = segments[segments.length - 1];
    if (!lastSegment) {
        throw new Error("Invalid request URL");
    }
    const cleanLastSegment = lastSegment.replace(/\.[^/.]+$/, "");
    const commonPathNames = [
        "files",
        "metadata",
        "upload",
        "download",
        "http-rest",
        "http-rest-chunked"
    ];
    if (commonPathNames.includes(cleanLastSegment.toLowerCase())) {
        throw new Error("Invalid request URL");
    }
    if (cleanLastSegment.length < 8) {
        throw new Error("Invalid request URL");
    }
    if (segments.length > 1) {
        return cleanLastSegment;
    }
    throw new Error("Invalid request URL");
};
const getRequestStream = (request)=>{
    if ("body" in request && request.body && typeof request.body.getReader === "function") {
        return __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$stream__$5b$external$5d$__$28$node$3a$stream$2c$__cjs$29$__["Readable"].fromWeb(request.body);
    }
    if ("body" in request && request.body && request.body instanceof Uint8Array) {
        return __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$stream__$5b$external$5d$__$28$node$3a$stream$2c$__cjs$29$__["Readable"].from(Buffer.from(request.body));
    }
    if (request instanceof __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$stream__$5b$external$5d$__$28$node$3a$stream$2c$__cjs$29$__["Readable"]) {
        return request;
    }
    return __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$stream__$5b$external$5d$__$28$node$3a$stream$2c$__cjs$29$__["Readable"].from(new Uint8Array(0));
};
const pick = (object, whitelist)=>{
    const result = {};
    whitelist.forEach((key)=>{
        result[key] = object[key];
    });
    return result;
};
class BaseHandlerCore extends __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$events__$5b$external$5d$__$28$node$3a$events$2c$__cjs$29$__["EventEmitter"] {
    /**
   * Response body type for the handler.
   */ responseType = "json";
    /**
   * Storage instance for file operations.
   */ storage;
    /**
   * Optional media transformer for image/video processing.
   */ mediaTransformer;
    /**
   * Whether to disable termination for finished uploads.
   */ disableTerminationForFinishedUploads;
    /**
   * Logger instance for debugging and error reporting.
   */ logger;
    /**
   * Gets the logger instance.
   * @returns Logger instance or undefined.
   */ get loggerInstance() {
        return this.logger;
    }
    /**
   * Internal error responses configuration.
   */ internalErrorResponses = {};
    /**
   * Gets the error responses configuration.
   * @returns Error responses configuration.
   */ get errorResponses() {
        return this.internalErrorResponses;
    }
    constructor({ disableTerminationForFinishedUploads, mediaTransformer, storage }){
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
   */ set errorResponses(value) {
        this.assembleErrors(value);
    }
    /**
   * Assemble error responses by merging defaults with custom overrides.
   * @param customErrors Custom error responses to override defaults
   */ assembleErrors = (customErrors = {})=>{
        this.internalErrorResponses = {
            ...__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorMap"],
            ...this.internalErrorResponses,
            ...this.storage.errorResponses,
            ...customErrors
        };
    };
    /**
   * Parses HTTP Range header and returns start/end byte positions for partial content requests.
   * @param rangeHeader HTTP Range header value (e.g., "bytes=0-1023").
   * @param fileSize Total size of the file in bytes.
   * @returns Object with start and end positions, or undefined if range is invalid.
   */ // eslint-disable-next-line class-methods-use-this
    parseRangeHeader(rangeHeader, fileSize) {
        if (!rangeHeader || !rangeHeader.startsWith("bytes=")) {
            return void 0;
        }
        const ranges = rangeHeader.slice(6).split(",");
        if (ranges.length !== 1) {
            return void 0;
        }
        const range = ranges[0]?.trim();
        if (!range) {
            return void 0;
        }
        const parts = range.split("-");
        if (parts.length !== 2) {
            return void 0;
        }
        const [startString, endString] = parts;
        let start;
        let end;
        if (startString && endString) {
            start = Number.parseInt(startString, 10);
            end = Number.parseInt(endString, 10);
        } else if (startString && !endString) {
            start = Number.parseInt(startString, 10);
            end = fileSize - 1;
        } else if (!startString && endString) {
            const suffixLength = Number.parseInt(endString, 10);
            start = Math.max(0, fileSize - suffixLength);
            end = fileSize - 1;
        } else {
            return void 0;
        }
        if (Number.isNaN(start) || Number.isNaN(end) || start >= fileSize || end >= fileSize || start > end) {
            return void 0;
        }
        return {
            end,
            start
        };
    }
    /**
   * Build file URL from request and file data.
   * Platform-agnostic version that accepts URL string.
   * @param requestUrl Request URL string
   * @param file File object containing ID and content type
   * @returns Constructed file URL with extension based on content type
   */ buildFileUrlFromString(requestUrl, file) {
        const url = new URL(requestUrl, "http://localhost");
        const { pathname } = url;
        const query = Object.fromEntries(url.searchParams.entries());
        const relative = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$url__$5b$external$5d$__$28$node$3a$url$2c$__cjs$29$__["format"])({
            pathname: `${pathname}/${file.id}`,
            query
        });
        return `${this.storage.config.useRelativeLocation ? relative : getBaseUrl({}) + relative}.${__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mime$40$4$2e$1$2e$0$2f$node_modules$2f$mime$2f$dist$2f$src$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"].getExtension(file.contentType)}`;
    }
    /**
   * Negotiates content type based on Accept header and supported formats.
   * Platform-agnostic version that accepts header string.
   * @param acceptHeader Accept header value
   * @param supportedTypes Array of supported MIME types to match against
   * @returns Best matching content type or undefined if no match found
   */ // eslint-disable-next-line class-methods-use-this
    negotiateContentType(acceptHeader, supportedTypes) {
        if (!acceptHeader) {
            return void 0;
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["H"].getPreferredMediaType(acceptHeader, supportedTypes);
    }
    /**
   * Check for undefined ID or path errors and throw appropriate HTTP errors.
   * @param error The error to check
   */ checkForUndefinedIdOrPath(error) {
        if (error instanceof Error && [
            "Id is undefined",
            "Invalid request URL",
            "Path is undefined"
        ].includes(error.message)) {
            throw error;
        }
    }
}
;
}),
"[project]/packages/storage/dist/packem_shared/base-handler-fetch-DkAUTzhr.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "B",
    ()=>BaseHandlerFetch
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/headers-C9CQX79R.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/ERRORS-DKaR93nv.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$base$2d$handler$2d$core$2d$AWhpn4ts$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/base-handler-core-AWhpn4ts.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$validator$2d$InvzeyVl$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/validator-InvzeyVl.js [app-route] (ecmascript)");
;
;
;
;
class BaseHandlerFetch extends __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$base$2d$handler$2d$core$2d$AWhpn4ts$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["B"] {
    /**
   * Limiting enabled HTTP method handler.
   */ static methods = [
        "delete",
        "get",
        "head",
        "options",
        "patch",
        "post",
        "put"
    ];
    /**
   * Map of registered HTTP method handlers.
   */ registeredHandlers = /* @__PURE__ */ new Map();
    constructor(options){
        super(options);
        this.compose();
    }
    /**
   * Gets the registered handlers map.
   * @returns Map of registered handlers.
   */ get handlers() {
        return this.registeredHandlers;
    }
    /**
   * Handles Web API Fetch requests (for Hono, Cloudflare Workers, etc.).
   * @param request Web API Request object.
   * @returns Promise resolving to Web API Response.
   */ async fetch(request) {
        this.logger?.debug("[fetch request]: %s %s", request.method, request.url);
        const handler = this.registeredHandlers.get(request.method || "GET");
        if (!handler) {
            return this.createErrorResponse({
                UploadErrorCode: __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ERRORS"].METHOD_NOT_ALLOWED
            });
        }
        if (!this.storage.isReady) {
            return this.createErrorResponse({
                UploadErrorCode: __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ERRORS"].STORAGE_ERROR
            });
        }
        try {
            const file = await handler.call(this, request);
            return this.handleFetchResponse(request, file);
        } catch (error) {
            const errorObject = error instanceof Error ? error : new Error(String(error));
            const uError = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$base$2d$handler$2d$core$2d$AWhpn4ts$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["p"])(errorObject, [
                "name",
                ...Object.getOwnPropertyNames(errorObject)
            ]);
            const errorEvent = {
                ...uError,
                request: {
                    headers: Object.fromEntries(request.headers.entries()),
                    method: request.method,
                    url: request.url
                }
            };
            if (this.listenerCount("error") > 0) {
                this.emit("error", errorEvent);
            }
            this.logger?.error("[fetch error]: %O", errorEvent);
            return this.createErrorResponse(errorObject);
        }
    }
    /**
   * Handle the response from handlers for fetch requests and convert to Web API Response.
   * @param request Web API Request object
   * @param file Response file or list from handler
   * @returns Promise resolving to Web API Response object
   */ async handleFetchResponse(request, file) {
        if (request.method === "HEAD" || request.method === "OPTIONS") {
            const { headers: headers2, statusCode: statusCode2 } = file;
            return new Response(void 0, {
                headers: this.convertHeaders({
                    ...headers2,
                    "Access-Control-Expose-Headers": "location,upload-expires,upload-offset,upload-length,upload-metadata,upload-defer-length,tus-resumable,tus-extension,tus-max-size,tus-version,tus-checksum-algorithm,cache-control"
                }),
                status: statusCode2
            });
        }
        if (request.method === "GET") {
            const { headers: headers2, statusCode: statusCode2 } = file;
            let body = "";
            if (file.content !== void 0) {
                body = new Uint8Array(file.content);
            } else if (typeof file === "object" && "data" in file) {
                body = JSON.stringify(file.data);
            }
            return new Response(body, {
                headers: this.convertHeaders({
                    ...headers2,
                    "Access-Control-Expose-Headers": "location,upload-expires,upload-offset,upload-length,upload-metadata,upload-defer-length,tus-resumable,tus-extension,tus-max-size,tus-version,tus-checksum-algorithm,cache-control"
                }),
                status: statusCode2
            });
        }
        const { headers, statusCode, ...basicFile } = file;
        if (basicFile.status !== void 0 && this.listenerCount(basicFile.status) > 0) {
            this.emit(basicFile.status, {
                ...basicFile,
                request: {
                    headers: Object.fromEntries(request.headers.entries()),
                    method: request.method,
                    url: request.url
                }
            });
        }
        if (basicFile.status === "completed") {
            const responseFile = file;
            if (responseFile.headers === void 0) {
                responseFile.headers = {};
            }
            if (responseFile.statusCode === void 0) {
                responseFile.statusCode = 200;
            }
            try {
                await this.storage.onComplete(basicFile, responseFile);
            } catch (error) {
                this.logger?.error("[onComplete error]: %O", error);
                throw error;
            }
            const { headers: responseFileHeaders2, statusCode: responseFileStatusCode, ...fileData } = responseFile;
            const cleanFileData = {
                ...fileData
            };
            if ("content" in cleanFileData) {
                delete cleanFileData.content;
            }
            if ("stream" in cleanFileData) {
                delete cleanFileData.stream;
            }
            return this.createResponse({
                body: cleanFileData,
                headers: responseFileHeaders2 || headers,
                statusCode: responseFileStatusCode || statusCode || 200
            });
        }
        const allHeaders = {
            ...headers,
            ...file.headers
        };
        const convertedHeaders = this.convertHeaders({
            ...allHeaders,
            "Access-Control-Expose-Headers": "location,upload-expires,upload-offset,upload-length,upload-metadata,upload-defer-length,tus-resumable,tus-extension,tus-max-size,tus-version,tus-checksum-algorithm,cache-control",
            ...basicFile.hash === void 0 ? {} : {
                [`X-Range-${basicFile.hash?.algorithm.toUpperCase()}`]: basicFile.hash?.value
            }
        });
        const responseFileHeaders = file.headers || {};
        if (responseFileHeaders.Location && !convertedHeaders.location && !convertedHeaders.Location) {
            convertedHeaders.location = String(responseFileHeaders.Location);
        } else if (responseFileHeaders.location && !convertedHeaders.location && !convertedHeaders.Location) {
            convertedHeaders.location = String(responseFileHeaders.location);
        } else if (headers.Location && !convertedHeaders.location && !convertedHeaders.Location) {
            convertedHeaders.location = String(headers.Location);
        } else if (headers.location && !convertedHeaders.location && !convertedHeaders.Location) {
            convertedHeaders.location = String(headers.location);
        }
        let responseBody;
        if (statusCode >= 200 && statusCode < 300) {
            responseBody = Object.keys(basicFile).length > 0 ? {
                ...basicFile
            } : {};
            if ("content" in responseBody) {
                delete responseBody.content;
            }
            if ("stream" in responseBody) {
                delete responseBody.stream;
            }
            if (Object.keys(responseBody).length === 0) {
                responseBody = {};
            }
        }
        return this.createResponse({
            body: responseBody,
            headers: convertedHeaders,
            statusCode: statusCode || 200
        });
    }
    /**
   * Convert headers to Web API Headers format by flattening arrays and converting to strings.
   * @param headers Headers object with potentially array values
   * @returns Headers object with all values as strings
   */ // eslint-disable-next-line class-methods-use-this
    convertHeaders(headers) {
        const result = {};
        for (const [key, value] of Object.entries(headers)){
            result[key] = Array.isArray(value) ? value.join(", ") : String(value);
        }
        return result;
    }
    /**
   * Create Web API Response from UploadResponse object.
   * @param uploadResponse Upload response containing body, headers, and status code
   * @returns Web API Response object
   */ createResponse(uploadResponse) {
        const { body, headers = {}, statusCode } = uploadResponse;
        let responseBody;
        if (statusCode === 204) {
            responseBody = null;
        } else if (typeof body === "string") {
            responseBody = body;
        } else if (body instanceof Buffer) {
            responseBody = body;
        } else if (body && typeof body === "object") {
            responseBody = JSON.stringify(body);
            if (!headers["Content-Type"]) {
                headers["Content-Type"] = __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["H"].createContentType({
                    charset: "utf8",
                    mediaType: "application/json"
                });
            }
        } else if (body === void 0 && statusCode >= 200 && statusCode < 300) {
            responseBody = "{}";
            if (!headers["Content-Type"]) {
                headers["Content-Type"] = __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["H"].createContentType({
                    charset: "utf8",
                    mediaType: "application/json"
                });
            }
        }
        return new Response(responseBody, {
            headers: this.convertHeaders(headers),
            status: statusCode
        });
    }
    /**
   * Create error Response from Error object with appropriate status code and message.
   * @param error Error object to convert to HTTP error response
   * @returns Web API Response object with error details
   */ async createErrorResponse(error) {
        let httpError;
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isUploadError"])(error)) {
            httpError = this.internalErrorResponses[error.UploadErrorCode];
        } else if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$validator$2d$InvzeyVl$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["i"])(error) && !__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["h"].isHttpError(error)) {
            httpError = this.storage.normalizeError(error);
        } else {
            httpError = {
                ...error,
                code: error.code || error.name,
                headers: error.headers || {},
                message: error.message,
                name: error.name,
                statusCode: error.statusCode || 500
            };
        }
        await this.storage.onError(httpError);
        let errorResponse;
        if (httpError.body) {
            if (typeof httpError.body === "object" && httpError.body !== null) {
                errorResponse = {
                    body: httpError.body,
                    headers: httpError.headers,
                    statusCode: httpError.statusCode
                };
            } else {
                errorResponse = {
                    body: {
                        error: {
                            code: httpError.code || httpError.name || "Error",
                            message: httpError.body || httpError.message || "Unknown error",
                            name: httpError.name || "Error"
                        }
                    },
                    headers: httpError.headers,
                    statusCode: httpError.statusCode || 500
                };
            }
        } else {
            errorResponse = {
                body: {
                    error: {
                        code: httpError.code || httpError.name || "Error",
                        message: httpError.message || "Unknown error",
                        name: httpError.name || "Error"
                    }
                },
                headers: httpError.headers,
                statusCode: httpError.statusCode || 500
            };
        }
        return this.createResponse(errorResponse);
    }
    /**
   * Build file URL from request and file data.
   * @param request Web API Request object
   * @param file File object containing ID and content type
   * @returns Constructed file URL with extension based on content type
   */ buildFileUrl(request, file) {
        return this.buildFileUrlFromString(request.url, file);
    }
    /**
   * Negotiates content type based on Accept header and supported formats.
   * @param request Web API Request object containing Accept header.
   * @param supportedTypes Array of supported MIME types to match against.
   * @returns Best matching content type or undefined if no match found.
   */ negotiateContentType(request, supportedTypes) {
        return super.negotiateContentType(request.headers.get("accept") || void 0, supportedTypes);
    }
}
;
}),
"[project]/packages/storage/dist/packem_shared/multipart-base-Bw0JgeCS.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "M",
    ()=>MultipartBase
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/headers-C9CQX79R.js [app-route] (ecmascript)");
;
class MultipartBase {
    /**
   * Storage instance for file operations.
   */ get storage() {
        throw new Error("storage must be implemented");
    }
    /**
   * Build file URL from request URL and file data.
   * @param _requestUrl Request URL string
   * @param _file File object containing ID and content type
   * @returns Constructed file URL with extension based on content type
   */ buildFileUrl(_requestUrl, _file) {
        throw new Error("buildFileUrl must be implemented");
    }
    /**
   * Handle multipart POST (upload file).
   * @param filePart File part from multipart parser
   * @param filePart.bytes File bytes data
   * @param filePart.filename Original filename
   * @param filePart.mediaType Content type
   * @param filePart.size File size in bytes
   * @param metadataParts All parts from multipart parser (for extracting metadata)
   * @param requestUrl Request URL for Location header
   * @returns Promise resolving to ResponseFile with upload result
   */ async handlePost(filePart, metadataParts, requestUrl) {
        const config = {
            contentType: filePart.mediaType || "application/octet-stream",
            metadata: {},
            originalName: filePart.filename,
            size: filePart.size
        };
        for (const part of metadataParts){
            if (!part.isFile && part.name) {
                let data = {};
                if (part.name === "metadata" && part.text) {
                    try {
                        data = JSON.parse(part.text);
                    } catch  {}
                } else if (part.name) {
                    data = {
                        [part.name]: part.text
                    };
                }
                Object.assign(config.metadata, data);
            }
        }
        const file = await this.storage.create(config);
        const stream = this.createStreamFromBytes(filePart.bytes);
        await this.storage.write({
            body: stream,
            contentLength: filePart.size,
            id: file.id,
            start: 0
        });
        const completedFile = await this.storage.write({
            body: this.createEmptyStream(),
            contentLength: 0,
            id: file.id,
            start: filePart.size
        });
        let finalFile = completedFile;
        if (Object.keys(config.metadata).length > 0) {
            const mergedMetadata = {
                ...completedFile.metadata,
                ...config.metadata
            };
            const updatedFile = await this.storage.update({
                id: completedFile.id
            }, {
                metadata: mergedMetadata
            });
            finalFile = {
                ...updatedFile,
                status: completedFile.status
            };
        }
        const locationUrl = this.buildFileUrl(requestUrl, finalFile);
        return {
            ...finalFile,
            headers: {
                Location: locationUrl,
                ...finalFile.expiredAt === void 0 ? {} : {
                    "X-Upload-Expires": finalFile.expiredAt.toString()
                },
                ...finalFile.ETag === void 0 ? {} : {
                    ETag: finalFile.ETag
                }
            },
            statusCode: 200
        };
    }
    /**
   * Handle DELETE (delete file).
   * @param id File ID from URL
   * @returns Promise resolving to ResponseFile with deletion result
   */ async handleDelete(id) {
        const file = await this.storage.delete({
            id
        });
        if (file.status === void 0) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(404, "File not found");
        }
        return {
            ...file,
            headers: {},
            statusCode: 204
        };
    }
}
;
}),
"[project]/packages/storage/dist/packem_shared/Multipart-D3eg40wT.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Multipart
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$stream__$5b$external$5d$__$28$node$3a$stream$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:stream [external] (node:stream, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$remix$2d$run$2b$multipart$2d$parser$40$0$2e$13$2e$0$2f$node_modules$2f40$remix$2d$run$2f$multipart$2d$parser$2f$dist$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@remix-run+multipart-parser@0.13.0/node_modules/@remix-run/multipart-parser/dist/index.js [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$remix$2d$run$2b$multipart$2d$parser$40$0$2e$13$2e$0$2f$node_modules$2f40$remix$2d$run$2f$multipart$2d$parser$2f$dist$2f$lib$2f$multipart$2d$request$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@remix-run+multipart-parser@0.13.0/node_modules/@remix-run/multipart-parser/dist/lib/multipart-request.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$remix$2d$run$2b$multipart$2d$parser$40$0$2e$13$2e$0$2f$node_modules$2f40$remix$2d$run$2f$multipart$2d$parser$2f$dist$2f$lib$2f$multipart$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@remix-run+multipart-parser@0.13.0/node_modules/@remix-run/multipart-parser/dist/lib/multipart.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/headers-C9CQX79R.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$validator$2d$InvzeyVl$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/validator-InvzeyVl.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$base$2d$handler$2d$fetch$2d$DkAUTzhr$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/base-handler-fetch-DkAUTzhr.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$multipart$2d$base$2d$Bw0JgeCS$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/multipart-base-Bw0JgeCS.js [app-route] (ecmascript)");
;
;
;
;
;
;
const RE_MIME = /^multipart\/.+|application\/x-www-form-urlencoded$/i;
const getIdFromRequestUrl = (url)=>{
    try {
        const urlObject = new URL(url);
        const pathParts = urlObject.pathname.split("/").filter(Boolean);
        return pathParts[pathParts.length - 1] || void 0;
    } catch  {
        return void 0;
    }
};
class Multipart extends __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$base$2d$handler$2d$fetch$2d$DkAUTzhr$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["B"] {
    /**
   * Limiting enabled http method handler
   */ static methods = [
        "delete",
        "download",
        "get",
        "options",
        "post"
    ];
    multipartBase;
    /**
   * Maximum file size allowed for multipart uploads
   */ maxFileSize;
    /**
   * Maximum header size allowed for multipart parser
   */ maxHeaderSize;
    constructor(options){
        super(options);
        this.maxFileSize = options.maxFileSize ?? Math.min(this.storage.maxUploadSize, 1024 * 1024 * 1024);
        this.maxHeaderSize = options.maxHeaderSize ?? 64 * 1024;
        const multipartInstance = this;
        this.multipartBase = new class extends __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$multipart$2d$base$2d$Bw0JgeCS$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["M"] {
            get storage() {
                return multipartInstance.storage;
            }
            get maxFileSize() {
                return multipartInstance.maxFileSize;
            }
            get maxHeaderSize() {
                return multipartInstance.maxHeaderSize;
            }
            buildFileUrl(requestUrl, file) {
                return multipartInstance.buildFileUrl({
                    url: requestUrl
                }, file);
            }
            createStreamFromBytes(bytes) {
                if (bytes instanceof Uint8Array) {
                    return __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$stream__$5b$external$5d$__$28$node$3a$stream$2c$__cjs$29$__["Readable"].from(Buffer.from(bytes));
                }
                if (bytes instanceof ArrayBuffer) {
                    return __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$stream__$5b$external$5d$__$28$node$3a$stream$2c$__cjs$29$__["Readable"].from(Buffer.from(bytes));
                }
                return __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$stream__$5b$external$5d$__$28$node$3a$stream$2c$__cjs$29$__["Readable"].from(new Uint8Array(0));
            }
            createEmptyStream() {
                return __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$stream__$5b$external$5d$__$28$node$3a$stream$2c$__cjs$29$__["Readable"].from(new Uint8Array(0));
            }
        }();
    }
    /**
   * Compose and register HTTP method handlers.
   */ compose() {
        this.registeredHandlers.set("POST", this.post.bind(this));
        this.registeredHandlers.set("DELETE", this.delete.bind(this));
        this.registeredHandlers.set("GET", this.get.bind(this));
        this.registeredHandlers.set("OPTIONS", this.options.bind(this));
        this.logger?.debug("Registered handler: %s", [
            ...this.registeredHandlers.keys()
        ].join(", "));
    }
    /**
   * Handles multipart/form-data POST requests for file uploads.
   * @param request Web API Request containing multipart data.
   * @returns Promise resolving to ResponseFile with upload result.
   */ async post(request) {
        const contentType = request.headers.get("content-type") || "";
        if (!RE_MIME.test(contentType.split(";")[0])) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(400, "Invalid content-type");
        }
        try {
            const parts = [];
            for await (const part of (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$remix$2d$run$2b$multipart$2d$parser$40$0$2e$13$2e$0$2f$node_modules$2f40$remix$2d$run$2f$multipart$2d$parser$2f$dist$2f$lib$2f$multipart$2d$request$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["parseMultipartRequest"])(request, {
                maxFileSize: this.maxFileSize,
                maxHeaderSize: this.maxHeaderSize
            })){
                parts.push(part);
            }
            const filePart = parts.find((part)=>part.isFile);
            if (!filePart) {
                throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(400, "No file found in multipart request");
            }
            const requestUrl = request.url;
            return this.multipartBase.handlePost(filePart, parts, requestUrl);
        } catch (error) {
            if (error instanceof __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$remix$2d$run$2b$multipart$2d$parser$40$0$2e$13$2e$0$2f$node_modules$2f40$remix$2d$run$2f$multipart$2d$parser$2f$dist$2f$lib$2f$multipart$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["MaxFileSizeExceededError"]) {
                throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(413, "File size limit exceeded");
            }
            if (error instanceof __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$remix$2d$run$2b$multipart$2d$parser$40$0$2e$13$2e$0$2f$node_modules$2f40$remix$2d$run$2f$multipart$2d$parser$2f$dist$2f$lib$2f$multipart$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["MultipartParseError"]) {
                throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(400, "Invalid multipart request");
            }
            if (error instanceof __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$validator$2d$InvzeyVl$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["V"] && error.statusCode) {
                throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(error.statusCode, error.message || error.body || "Validation failed");
            }
            throw error;
        }
    }
    /**
   * Delete an uploaded file.
   * @param request Web API Request with file ID
   * @returns Promise resolving to ResponseFile with deletion result
   */ async delete(request) {
        const id = getIdFromRequestUrl(request.url);
        if (!id) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(404, "File not found");
        }
        try {
            return this.multipartBase.handleDelete(id);
        } catch (error) {
            const errorWithCode = error;
            if (errorWithCode.code === "ENOENT") {
                throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(404, "File not found");
            }
            throw error;
        }
    }
    /**
   * Handle OPTIONS requests with CORS headers.
   * @param _request Web API Request (unused)
   * @returns Promise resolving to ResponseFile with CORS headers
   */ async options(_request) {
        const child = this.constructor;
        return {
            headers: {
                "Access-Control-Allow-Methods": (child.methods || Multipart.methods).map((method)=>method.toUpperCase()).join(", ")
            },
            statusCode: 204
        };
    }
    /**
   * Retrieves a file or list of files based on the request path.
   * Delegates to BaseHandlerFetch.fetch() method.
   * @param request Web API Request
   * @returns Promise resolving to Web API Response
   */ async get(request) {
        throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(500, "GET requests should be handled via fetch() method");
    }
}
;
}),
"[project]/packages/storage/dist/packem_shared/response-builder-BtnRiBUI.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "a",
    ()=>buildFileHeaders,
    "b",
    ()=>buildResponseFile,
    "c",
    ()=>buildChunkedUploadHeaders,
    "d",
    ()=>buildFileMetadataHeaders,
    "e",
    ()=>convertHeadersToString
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mime$40$4$2e$1$2e$0$2f$node_modules$2f$mime$2f$dist$2f$src$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mime@4.1.0/node_modules/mime/dist/src/index.js [app-route] (ecmascript) <locals>");
;
const buildResponseFile = (file, headers = {}, statusCode = 200)=>({
        ...file,
        headers,
        statusCode
    });
const buildFileHeaders = (file, locationUrl, additionalHeaders = {})=>{
    return {
        Location: locationUrl,
        ...file.expiredAt === void 0 ? {} : {
            "X-Upload-Expires": file.expiredAt.toString()
        },
        ...file.ETag === void 0 ? {} : {
            ETag: file.ETag
        },
        ...additionalHeaders
    };
};
const buildChunkedUploadHeaders = (file, isComplete)=>{
    const metadata = file.metadata || {};
    const headers = {
        "x-chunked-upload": "true",
        "x-upload-complete": isComplete ? "true" : "false",
        "x-upload-offset": String(file.bytesWritten || 0)
    };
    if (Array.isArray(metadata._chunks) && metadata._chunks.length > 0) {
        headers["x-received-chunks"] = JSON.stringify(metadata._chunks);
    }
    return headers;
};
const buildFileMetadataHeaders = (file)=>{
    return {
        "Content-Length": String(file.size || 0),
        "Content-Type": file.contentType,
        ...file.expiredAt === void 0 ? {} : {
            "X-Upload-Expires": file.expiredAt.toString()
        },
        ...file.modifiedAt === void 0 ? {} : {
            "Last-Modified": file.modifiedAt.toString()
        },
        ...file.ETag === void 0 ? {} : {
            ETag: file.ETag
        }
    };
};
const convertHeadersToString = (headers)=>{
    const result = {};
    for (const [key, value] of Object.entries(headers)){
        result[key] = Array.isArray(value) ? value.join(", ") : String(value);
    }
    return result;
};
;
}),
"[project]/packages/storage/dist/packem_shared/rest-base-CdRaPXKr.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "R",
    ()=>RestBase
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/headers-C9CQX79R.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/ERRORS-DKaR93nv.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$response$2d$builder$2d$BtnRiBUI$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/response-builder-BtnRiBUI.js [app-route] (ecmascript)");
;
;
;
const isUploadComplete = (chunks, totalSize)=>{
    if (chunks.length === 0) {
        return false;
    }
    const sorted = [
        ...chunks
    ].toSorted((a, b)=>a.offset - b.offset);
    const firstChunk = sorted[0];
    if (!firstChunk || firstChunk.offset !== 0) {
        return false;
    }
    let currentEnd = firstChunk.length;
    for(let i = 1; i < sorted.length; i += 1){
        const chunk = sorted[i];
        if (!chunk) {
            continue;
        }
        if (chunk.offset > currentEnd) {
            return false;
        }
        currentEnd = Math.max(currentEnd, chunk.offset + chunk.length);
    }
    return currentEnd >= totalSize;
};
const validateChunk = (chunkOffset, chunkLength, totalSize, maxChunkSize)=>{
    if (Number.isNaN(chunkOffset) || chunkOffset < 0) {
        throw new Error("Chunk offset must be a valid non-negative number");
    }
    if (chunkLength <= 0) {
        throw new Error("Chunk length must be greater than 0");
    }
    if (chunkLength > maxChunkSize) {
        throw new Error(`Chunk size exceeds maximum allowed size of ${maxChunkSize} bytes`);
    }
    if (chunkOffset + chunkLength > totalSize) {
        throw new Error(`Chunk exceeds file size. Offset: ${chunkOffset}, Size: ${chunkLength}, Total: ${totalSize}`);
    }
};
const trackChunk = (chunks, chunkInfo)=>{
    const existingChunk = chunks.find((chunk)=>chunk.offset === chunkInfo.offset && chunk.length === chunkInfo.length);
    if (!existingChunk) {
        return [
            ...chunks,
            chunkInfo
        ];
    }
    if (chunkInfo.checksum && existingChunk.checksum !== chunkInfo.checksum) {
        return chunks.map((chunk)=>chunk.offset === chunkInfo.offset ? {
                ...chunk,
                checksum: chunkInfo.checksum
            } : chunk);
    }
    return chunks;
};
const isChunkedUpload = (file)=>{
    const metadata = file.metadata || {};
    return metadata._chunkedUpload === true;
};
const getTotalSize = (file)=>{
    const metadata = file.metadata || {};
    const isChunkedUpload2 = metadata._chunkedUpload === true;
    if (isChunkedUpload2 && typeof metadata._totalSize === "number") {
        return metadata._totalSize;
    }
    return void 0;
};
class RestBase {
    /**
   * Storage instance for file operations.
   */ get storage() {
        throw new Error("storage must be implemented");
    }
    /**
   * Build file URL from request URL and file data.
   * @param requestUrl Request URL string
   * @param file File object containing ID and content type
   * @returns Constructed file URL with extension based on content type
   */ buildFileUrl(requestUrl, file) {
        throw new Error("buildFileUrl must be implemented");
    }
    /**
   * Handle batch file deletion.
   * @param ids Array of file IDs to delete
   * @returns Promise resolving to ResponseList with deletion results
   */ async deleteBatch(ids) {
        const result = await this.storage.deleteBatch(ids);
        if (result.successfulCount === 0 && result.failedCount > 0) {
            const failedIds = result.failed.map((errorItem)=>errorItem.id).join(", ");
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(404, `Failed to delete files: ${failedIds}`);
        }
        return {
            data: result.successful,
            headers: result.failedCount > 0 ? {
                "X-Delete-Errors": JSON.stringify(result.failed),
                "X-Delete-Failed": String(result.failedCount),
                "X-Delete-Successful": String(result.successfulCount)
            } : {
                "X-Delete-Successful": String(result.successfulCount)
            },
            statusCode: result.successfulCount === ids.length ? 204 : 207
        };
    }
    /**
   * Handle single file deletion.
   * @param id File ID to delete
   * @returns Promise resolving to ResponseFile with deletion result
   */ async deleteSingle(id) {
        const file = await this.storage.delete({
            id
        });
        if (file.status === void 0) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(404, "File not found");
        }
        return {
            ...file,
            headers: {},
            statusCode: 204
        };
    }
    /**
   * Handle file creation (POST).
   * @param config File initialization config
   * @param isChunkedUpload Whether this is a chunked upload initialization
   * @param requestUrl Request URL for Location header
   * @param bodyStream Request body stream (for non-chunked uploads)
   * @param contentLength Content length (for non-chunked uploads)
   * @returns Promise resolving to ResponseFile with upload result
   */ async handlePost(config, isChunkedUpload2, requestUrl, bodyStream, contentLength) {
        if (isChunkedUpload2 && config.size > 0 && config.size > this.storage.maxUploadSize) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(413, `File size exceeds maximum allowed size of ${this.storage.maxUploadSize} bytes`);
        }
        const file = await this.storage.create(config);
        if (isChunkedUpload2) {
            const locationUrl2 = this.buildFileUrl(requestUrl, file);
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$response$2d$builder$2d$BtnRiBUI$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["b"])(file, {
                ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$response$2d$builder$2d$BtnRiBUI$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["a"])(file, locationUrl2),
                "X-Chunked-Upload": "true",
                "X-Upload-ID": file.id
            }, 201);
        }
        const completedFile = await this.storage.write({
            body: bodyStream,
            contentLength,
            id: file.id,
            start: 0
        });
        const locationUrl = this.buildFileUrl(requestUrl, completedFile);
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$response$2d$builder$2d$BtnRiBUI$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["b"])(completedFile, (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$response$2d$builder$2d$BtnRiBUI$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["a"])(completedFile, locationUrl), 201);
    }
    /**
   * Handle file update or creation (PUT).
   * @param id File ID from URL
   * @param config File initialization config (for new files)
   * @param requestUrl Request URL for Location header
   * @param bodyStream Request body stream
   * @param contentLength Content length
   * @param metadata Optional metadata to merge (for updates)
   * @returns Promise resolving to ResponseFile with upload result
   */ async handlePut(id, config, requestUrl, bodyStream, contentLength, metadata) {
        let file;
        let isUpdate = false;
        try {
            await this.storage.getMeta(id);
            isUpdate = true;
            if (metadata) {
                await this.storage.update({
                    id
                }, {
                    metadata
                });
            }
            file = await this.storage.write({
                body: bodyStream,
                contentLength,
                id,
                start: 0
            });
        } catch (error) {
            const errorWithCode = error;
            if (errorWithCode.UploadErrorCode === __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ERRORS"].FILE_NOT_FOUND || errorWithCode.code === "ENOENT") {
                try {
                    const newFile = await this.storage.create(config);
                    file = await this.storage.write({
                        body: bodyStream,
                        contentLength,
                        id: newFile.id,
                        start: 0
                    });
                } catch (createError) {
                    throw createError;
                }
            } else {
                throw error;
            }
        }
        const locationUrl = this.buildFileUrl(requestUrl, file);
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$response$2d$builder$2d$BtnRiBUI$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["b"])(file, (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$response$2d$builder$2d$BtnRiBUI$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["a"])(file, locationUrl), isUpdate ? 200 : 201);
    }
    /**
   * Handle chunked upload chunk (PATCH).
   * @param id File ID from URL
   * @param chunkOffset Chunk offset in bytes
   * @param contentLength Chunk content length
   * @param chunkChecksum Optional chunk checksum
   * @param requestUrl Request URL for Location header
   * @param bodyStream Request body stream
   * @returns Promise resolving to ResponseFile with upload progress
   */ async handlePatch(id, chunkOffset, contentLength, chunkChecksum, requestUrl, bodyStream) {
        let file = await this.storage.getMeta(id);
        const metadata = file.metadata || {};
        const isChunkedUploadFile = isChunkedUpload(file);
        if (isChunkedUploadFile) {
            const totalSize2 = getTotalSize(file);
            if (totalSize2 && file.size !== totalSize2) {
                file = {
                    ...file,
                    size: totalSize2
                };
            }
        }
        const totalSize = typeof metadata._totalSize === "number" ? metadata._totalSize : file.size || 0;
        if (!isChunkedUploadFile) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(400, "File is not a chunked upload. Use POST or PUT for full file uploads.");
        }
        const MAX_CHUNK_SIZE = 100 * 1024 * 1024;
        try {
            validateChunk(chunkOffset, contentLength, totalSize, MAX_CHUNK_SIZE);
        } catch (error) {
            if (error instanceof Error && error.message.includes("exceeds maximum")) {
                throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(413, error.message);
            }
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(400, error instanceof Error ? error.message : String(error));
        }
        if (file.status === "completed") {
            const locationUrl2 = this.buildFileUrl(requestUrl, file);
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$response$2d$builder$2d$BtnRiBUI$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["b"])(file, {
                ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$response$2d$builder$2d$BtnRiBUI$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["a"])(file, locationUrl2),
                "X-Upload-Complete": "true"
            }, 200);
        }
        const existingChunks = Array.isArray(metadata._chunks) ? metadata._chunks : [];
        const chunkInfo = {
            checksum: chunkChecksum,
            length: contentLength,
            offset: chunkOffset
        };
        const chunks = trackChunk(existingChunks, chunkInfo);
        const updatedMetadata = {
            ...metadata,
            _chunks: chunks
        };
        await this.storage.update({
            id
        }, {
            metadata: updatedMetadata
        });
        const updatedFile = await this.storage.write({
            body: bodyStream,
            contentLength,
            id,
            start: chunkOffset
        });
        let isComplete = updatedFile.bytesWritten >= totalSize;
        if (isChunkedUploadFile) {
            const isChunksComplete = isUploadComplete(chunks, totalSize);
            isComplete = isChunksComplete;
            if (updatedFile.status === "completed" && !isComplete) {
                await this.storage.update({
                    id
                }, {
                    status: "part"
                });
                updatedFile.status = "part";
            }
        }
        const finalFile = isComplete && updatedFile.bytesWritten !== totalSize ? {
            ...updatedFile,
            bytesWritten: totalSize
        } : updatedFile;
        const locationUrl = this.buildFileUrl(requestUrl, finalFile);
        const headers = {
            ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$response$2d$builder$2d$BtnRiBUI$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["a"])(finalFile, locationUrl),
            ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$response$2d$builder$2d$BtnRiBUI$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(finalFile, isComplete),
            "x-upload-offset": String(finalFile.bytesWritten || 0)
        };
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$response$2d$builder$2d$BtnRiBUI$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["b"])(finalFile, headers, isComplete ? 200 : 202);
    }
    /**
   * Handle file metadata retrieval (HEAD).
   * @param id File ID from URL
   * @returns Promise resolving to ResponseFile with metadata headers
   */ async handleHead(id) {
        let file = await this.storage.getMeta(id);
        const isChunkedUploadFile = isChunkedUpload(file);
        if (isChunkedUploadFile) {
            const totalSize = getTotalSize(file);
            if (totalSize && file.size !== totalSize) {
                file = {
                    ...file,
                    size: totalSize
                };
            }
        }
        const headers = {
            ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$response$2d$builder$2d$BtnRiBUI$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["d"])(file)
        };
        if (isChunkedUploadFile) {
            const metadata = file.metadata || {};
            const totalSize = getTotalSize(file) || file.size || 0;
            const chunks = Array.isArray(metadata._chunks) ? metadata._chunks : [];
            const isComplete = isUploadComplete(chunks, totalSize);
            Object.assign(headers, (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$response$2d$builder$2d$BtnRiBUI$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(file, isComplete));
        }
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$response$2d$builder$2d$BtnRiBUI$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["b"])(file, headers, 200);
    }
    /**
   * Handle OPTIONS request with REST API capabilities.
   * @param methods Array of supported HTTP methods
   * @param maxUploadSize Maximum upload size
   * @returns ResponseFile with CORS headers
   */ handleOptions(methods, maxUploadSize) {
        const headers = {
            "Access-Control-Allow-Headers": "Authorization, Content-Type, Content-Length, Content-Disposition, X-File-Metadata, X-Chunked-Upload, X-Total-Size, X-Chunk-Offset, X-Chunk-Checksum",
            "Access-Control-Allow-Methods": methods.map((method)=>method.toUpperCase()).join(", "),
            "Access-Control-Max-Age": 86400,
            "X-Max-Upload-Size": String(maxUploadSize)
        };
        return {
            headers,
            statusCode: 204
        };
    }
}
;
}),
"[project]/packages/storage/dist/packem_shared/Rest-DxBjOMcM.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>RestFetch
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/headers-C9CQX79R.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/ERRORS-DKaR93nv.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$base$2d$handler$2d$core$2d$AWhpn4ts$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/base-handler-core-AWhpn4ts.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$base$2d$handler$2d$fetch$2d$DkAUTzhr$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/base-handler-fetch-DkAUTzhr.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$rest$2d$base$2d$CdRaPXKr$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/rest-base-CdRaPXKr.js [app-route] (ecmascript)");
;
;
;
;
;
class RestFetch extends __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$base$2d$handler$2d$fetch$2d$DkAUTzhr$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["B"] {
    /**
   * Limiting enabled http method handler
   */ static methods = [
        "delete",
        "download",
        "get",
        "head",
        "options",
        "patch",
        "post",
        "put"
    ];
    restBase;
    constructor(options){
        super(options);
        const restInstance = this;
        this.restBase = new class extends __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$rest$2d$base$2d$CdRaPXKr$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["R"] {
            get storage() {
                return restInstance.storage;
            }
            buildFileUrl(requestUrl, file) {
                return restInstance.buildFileUrl({
                    url: requestUrl
                }, file);
            }
        }();
    }
    /**
   * Compose and register HTTP method handlers.
   */ compose() {
        this.registeredHandlers.set("POST", this.post.bind(this));
        this.registeredHandlers.set("PUT", this.put.bind(this));
        this.registeredHandlers.set("PATCH", this.patch.bind(this));
        this.registeredHandlers.set("DELETE", this.delete.bind(this));
        this.registeredHandlers.set("HEAD", this.head.bind(this));
        this.registeredHandlers.set("GET", this.get.bind(this));
        this.registeredHandlers.set("OPTIONS", this.options.bind(this));
        this.logger?.debug("Registered handler: %s", [
            ...this.registeredHandlers.keys()
        ].join(", "));
    }
    /**
   * Creates a new file via POST request with raw binary data.
   * Supports both full file uploads and chunked upload initialization.
   * @param request Web API Request with file data.
   * @returns Promise resolving to ResponseFile with upload result.
   */ async post(request) {
        const isChunkedUpload = request.headers.get("x-chunked-upload") === "true";
        const contentLengthHeader = request.headers.get("content-length");
        const contentLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : 0;
        if (!isChunkedUpload) {
            if (!contentLengthHeader || Number.isNaN(contentLength) || contentLength === 0) {
                throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(400, "Content-Length is required and must be greater than 0");
            }
            if (request.body === null) {
                throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(400, "Request body is required");
            }
        }
        if (contentLength > this.storage.maxUploadSize) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(413, `File size exceeds maximum allowed size of ${this.storage.maxUploadSize} bytes`);
        }
        const contentType = request.headers.get("content-type") || "application/octet-stream";
        const config = extractFileInitFromRequest(request, contentLength, contentType);
        const requestUrl = request.url;
        const bodyStream = request.body ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$base$2d$handler$2d$core$2d$AWhpn4ts$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["b"])(request) : void 0;
        return this.restBase.handlePost(config, isChunkedUpload, requestUrl, bodyStream, contentLength);
    }
    /**
   * Create or update a file via PUT request.
   * Requires file ID in the URL path.
   * @param request Web API Request with file ID and data
   * @returns Promise resolving to ResponseFile with upload result
   */ async put(request) {
        const id = getIdFromRequestUrl(request.url);
        if (!id) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(400, "File ID is required in URL path");
        }
        if (request.body === null) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(400, "Request body is required");
        }
        const contentLengthHeader = request.headers.get("content-length");
        const contentLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : 0;
        if (contentLength === 0) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(400, "Content-Length is required and must be greater than 0");
        }
        if (contentLength > this.storage.maxUploadSize) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(413, `File size exceeds maximum allowed size of ${this.storage.maxUploadSize} bytes`);
        }
        const contentType = request.headers.get("content-type") || "application/octet-stream";
        const metadataHeader = request.headers.get("x-file-metadata");
        let metadata;
        if (metadataHeader) {
            try {
                metadata = JSON.parse(metadataHeader);
            } catch  {}
        }
        let originalName;
        const contentDisposition = request.headers.get("content-disposition");
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch && filenameMatch[1]) {
                originalName = filenameMatch[1].replaceAll(/['"]/g, "");
            }
        }
        const config = {
            contentType,
            metadata: metadata || {},
            originalName,
            size: contentLength
        };
        const requestUrl = request.url;
        const bodyStream = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$base$2d$handler$2d$core$2d$AWhpn4ts$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["b"])(request);
        return this.restBase.handlePut(id, config, requestUrl, bodyStream, contentLength, metadata);
    }
    /**
   * Delete an uploaded file or multiple files.
   * Supports single file (ID in URL) or batch delete (via ?ids=id1,id2 or JSON body).
   * @param request Web API Request with file ID(s)
   * @returns Promise resolving to ResponseFile (single) or ResponseList (batch) with deletion result
   */ async delete(request) {
        const url = new URL(request.url);
        const idsParameter = url.searchParams.get("ids");
        if (idsParameter) {
            const ids = idsParameter.split(",").map((id2)=>id2.trim()).filter(Boolean);
            if (ids.length === 0) {
                throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(400, "No file IDs provided");
            }
            return this.restBase.deleteBatch(ids);
        }
        const contentType = request.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            try {
                const body = await request.text();
                const parsed = JSON.parse(body);
                if (Array.isArray(parsed)) {
                    if (parsed.length === 0) {
                        throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(400, "No file IDs provided");
                    }
                    return this.restBase.deleteBatch(parsed);
                }
                if (typeof parsed === "object" && parsed !== null && "ids" in parsed && Array.isArray(parsed.ids)) {
                    const idsArray = parsed.ids;
                    if (idsArray.length === 0) {
                        throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(400, "No file IDs provided");
                    }
                    return this.restBase.deleteBatch(idsArray);
                }
            } catch (error) {
                if (error.statusCode === 400) {
                    throw error;
                }
            }
        }
        const id = getIdFromRequestUrl(request.url);
        if (!id) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(404, "File not found");
        }
        try {
            return this.restBase.deleteSingle(id);
        } catch (error) {
            const errorWithCode = error;
            if (errorWithCode.UploadErrorCode === __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ERRORS"].FILE_NOT_FOUND || errorWithCode.code === "ENOENT") {
                throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(404, "File not found");
            }
            throw error;
        }
    }
    /**
   * Uploads a chunk via PATCH request for chunked uploads.
   * Headers required: X-Chunk-Offset (byte offset), Content-Length (chunk size).
   * Optional: X-Chunk-Checksum (SHA256 checksum for validation).
   * @param request Web API Request with chunk data.
   * @returns Promise resolving to ResponseFile with upload progress.
   */ async patch(request) {
        const id = getIdFromRequestUrl(request.url);
        if (!id) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(404, "File not found");
        }
        if (request.body === null) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(400, "Request body is required");
        }
        const contentLengthHeader = request.headers.get("content-length");
        const contentLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : 0;
        if (contentLength === 0) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(400, "Content-Length is required and must be greater than 0");
        }
        const chunkOffsetHeader = request.headers.get("x-chunk-offset");
        const chunkOffset = chunkOffsetHeader ? Number.parseInt(chunkOffsetHeader, 10) : void 0;
        if (chunkOffset === void 0) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(400, "X-Chunk-Offset header is required");
        }
        const chunkChecksum = request.headers.get("x-chunk-checksum") || void 0;
        const requestUrl = request.url;
        const bodyStream = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$base$2d$handler$2d$core$2d$AWhpn4ts$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["b"])(request);
        return this.restBase.handlePatch(id, chunkOffset, contentLength, chunkChecksum, requestUrl, bodyStream);
    }
    /**
   * Get file metadata via HEAD request.
   * For chunked uploads, also returns upload progress information.
   * @param request Web API Request with file ID
   * @returns Promise resolving to ResponseFile with metadata headers
   */ async head(request) {
        const id = getIdFromRequestUrl(request.url);
        if (!id) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(404, "File not found");
        }
        try {
            return this.restBase.handleHead(id);
        } catch (error) {
            const errorWithCode = error;
            if (errorWithCode.UploadErrorCode === __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$ERRORS$2d$DKaR93nv$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ERRORS"].FILE_NOT_FOUND || errorWithCode.code === "ENOENT") {
                throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(404, "File not found");
            }
            throw error;
        }
    }
    /**
   * Handle OPTIONS requests with REST API capabilities.
   * @param request Web API Request
   * @returns Promise resolving to ResponseFile with CORS headers
   */ async options(request) {
        return this.restBase.handleOptions(RestFetch.methods, this.storage.maxUploadSize);
    }
    /**
   * Retrieves a file or list of files based on the request path.
   * Delegates to BaseHandlerFetch.fetch() method.
   * @param request Web API Request
   * @returns Promise resolving to Web API Response
   */ async get(request) {
        throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(500, "GET requests should be handled via fetch() method");
    }
}
const extractFileInitFromRequest = (request, contentLength, contentType)=>{
    const totalSizeHeader = request.headers.get("x-total-size");
    const totalSize = totalSizeHeader ? Number.parseInt(totalSizeHeader, 10) : contentLength;
    const metadataHeader = request.headers.get("x-file-metadata");
    let metadata = {};
    if (metadataHeader) {
        try {
            metadata = JSON.parse(metadataHeader);
        } catch  {}
    }
    let originalName;
    const contentDisposition = request.headers.get("content-disposition");
    if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
            originalName = filenameMatch[1].replaceAll(/['"]/g, "");
        }
    }
    return {
        contentType,
        metadata,
        originalName,
        size: totalSize
    };
};
const getIdFromRequestUrl = (url)=>{
    try {
        const urlObject = new URL(url);
        const pathParts = urlObject.pathname.split("/").filter(Boolean);
        const lastPart = pathParts[pathParts.length - 1];
        if (!lastPart) {
            return void 0;
        }
        const id = lastPart.replace(/\.[^.]+$/, "");
        return id || void 0;
    } catch  {
        return void 0;
    }
};
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
"[project]/packages/storage/dist/packem_shared/TUS_RESUMABLE-E8ESjr80.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "TUS_RESUMABLE",
    ()=>TUS_RESUMABLE,
    "TUS_VERSION",
    ()=>TUS_VERSION,
    "TusBase",
    ()=>TusBase,
    "parseMetadata",
    ()=>parseMetadata,
    "serializeMetadata",
    ()=>serializeMetadata
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/headers-C9CQX79R.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$Metadata$2d$v9haqHC6$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/Metadata-v9haqHC6.js [app-route] (ecmascript)");
;
;
const TUS_RESUMABLE_VERSION = "1.0.0";
const TUS_VERSION_VERSION = "1.0.0";
const parseMetadata = (encoded = "")=>{
    const kvPairs = encoded.split(",").map((kv)=>kv.split(" "));
    const metadata = Object.create(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$Metadata$2d$v9haqHC6$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Metadata"].prototype);
    Object.values(kvPairs).forEach(([key, value])=>{
        if (key) {
            metadata[key] = value ? Buffer.from(value, "base64").toString() : "";
        }
    });
    return metadata;
};
const serializeMetadata = (object)=>{
    if (!object || Object.keys(object).length === 0) {
        return "";
    }
    return Object.entries(object).map(([key, value])=>{
        if (value === void 0) {
            return key;
        }
        return `${key} ${Buffer.from(String(value)).toString("base64")}`;
    }).toString();
};
class TusBase {
    /**
   * Storage instance for file operations.
   */ get storage() {
        throw new Error("storage must be implemented");
    }
    /**
   * Build file URL from request URL and file data.
   * @param requestUrl Request URL string
   * @param file File object containing ID
   * @returns Constructed file URL for TUS protocol
   */ buildFileUrl(requestUrl, file) {
        throw new Error("buildFileUrl must be implemented");
    }
    /**
   * Handle OPTIONS request with TUS protocol capabilities.
   * @param methods Array of supported HTTP methods
   * @returns ResponseFile with TUS headers
   */ handleOptions(methods) {
        const headers = {
            "Access-Control-Allow-Headers": "Authorization, Content-Type, Location, Tus-Extension, Tus-Max-Size, Tus-Resumable, Tus-Version, Upload-Concat, Upload-Defer-Length, Upload-Length, Upload-Metadata, Upload-Offset, X-HTTP-Method-Override, X-Requested-With",
            "Access-Control-Allow-Methods": methods.map((method)=>method.toUpperCase()).join(", "),
            "Access-Control-Max-Age": 86400,
            "Tus-Checksum-Algorithm": this.storage.checksumTypes.join(","),
            "Tus-Extension": this.storage.tusExtension.toString(),
            "Tus-Max-Size": this.storage.maxUploadSize,
            "Tus-Version": TUS_VERSION_VERSION
        };
        return {
            headers,
            statusCode: 204
        };
    }
    /**
   * Handle TUS POST (create upload).
   * @param uploadLength Upload length header value
   * @param uploadDeferLength Upload defer length header value
   * @param uploadConcat Upload concat header value
   * @param metadataHeader Upload metadata header value
   * @param requestUrl Request URL for Location header
   * @param bodyStream Request body stream (for creation-with-upload)
   * @param contentLength Content length (for creation-with-upload)
   * @param contentType Content type (for creation-with-upload)
   * @returns Promise resolving to ResponseFile with upload result
   */ async handlePost(uploadLength, uploadDeferLength, uploadConcat, metadataHeader, requestUrl, bodyStream, contentLength, contentType) {
        if (uploadDeferLength !== void 0) {
            if (!this.storage.tusExtension.includes("creation-defer-length")) {
                throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(501, "creation-defer-length extension is not (yet) supported.");
            }
            if (uploadLength === void 0) {
                const metadata2 = metadataHeader ? parseMetadata(metadataHeader) : {};
                const config2 = {
                    metadata: metadata2
                };
                let file2 = await this.storage.create(config2);
                if (contentType === "application/offset+octet-stream" && contentLength > 0) {
                    file2 = await this.storage.write({
                        ...file2,
                        body: bodyStream,
                        contentLength,
                        start: 0
                    });
                }
                let headers2 = {};
                if (this.storage.tusExtension.includes("expiration") && typeof file2.expiredAt === "number" && file2.size === void 0) {
                    headers2 = {
                        "Upload-Expires": new Date(file2.expiredAt).toUTCString()
                    };
                }
                const locationUrl2 = this.buildFileUrl(requestUrl, file2);
                headers2 = {
                    ...headers2,
                    ...this.buildHeaders(file2, {
                        Location: locationUrl2
                    })
                };
                if (!headers2.Location) {
                    headers2.Location = locationUrl2;
                }
                if (file2.bytesWritten > 0) {
                    headers2["Upload-Offset"] = file2.bytesWritten.toString();
                }
                headers2["Upload-Defer-Length"] = "1";
                const statusCode2 = file2.bytesWritten > 0 ? 200 : 201;
                return {
                    ...file2,
                    headers: headers2,
                    statusCode: statusCode2
                };
            }
        }
        if (uploadConcat) {
            if (!this.storage.tusExtension.includes("concatenation")) {
                throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(501, "Concatenation extension is not (yet) supported. Disable parallel upload in the tus client.");
            }
            const parsedMetadata = metadataHeader ? parseMetadata(metadataHeader) : {};
            if (uploadConcat === "partial") {
                const config2 = {
                    metadata: {
                        ...parsedMetadata,
                        uploadConcat: "partial"
                    },
                    size: uploadLength
                };
                let file2 = await this.storage.create(config2);
                if (contentType === "application/offset+octet-stream" && contentLength > 0) {
                    file2 = await this.storage.write({
                        ...file2,
                        body: bodyStream,
                        contentLength,
                        start: 0
                    });
                }
                let headers2 = {};
                if (this.storage.tusExtension.includes("expiration") && typeof file2.expiredAt === "number" && file2.bytesWritten !== (file2.size ?? 0)) {
                    headers2 = {
                        "Upload-Expires": new Date(file2.expiredAt).toUTCString()
                    };
                }
                const locationUrl2 = this.buildFileUrl(requestUrl, file2);
                headers2 = {
                    ...headers2,
                    ...this.buildHeaders(file2, {
                        Location: locationUrl2
                    })
                };
                if (!headers2.Location) {
                    headers2.Location = locationUrl2;
                }
                if (file2.bytesWritten > 0) {
                    headers2["Upload-Offset"] = file2.bytesWritten.toString();
                }
                headers2["Upload-Concat"] = "partial";
                const statusCode2 = file2.bytesWritten > 0 ? 200 : 201;
                return {
                    ...file2,
                    headers: headers2,
                    statusCode: statusCode2
                };
            }
            if (uploadConcat.startsWith("final;")) {
                const partialIds = uploadConcat.slice(6).trim().split(/\s+/).filter(Boolean);
                if (partialIds.length === 0) {
                    throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(400, "Upload-Concat final must include at least one partial upload ID");
                }
                let totalSize = 0;
                const partialFiles = [];
                for (const partialId of partialIds){
                    try {
                        const partialFile = await this.storage.getMeta(partialId);
                        await this.storage.checkIfExpired(partialFile);
                        if (partialFile.metadata?.uploadConcat !== "partial") {
                            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(400, `Upload ${partialId} is not a partial upload`);
                        }
                        if (partialFile.status !== "completed" || partialFile.size === void 0) {
                            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(409, `Partial upload ${partialId} is not completed`);
                        }
                        partialFiles.push(partialFile);
                        totalSize += partialFile.size;
                    } catch (error) {
                        const errorWithCode = error;
                        if (errorWithCode.statusCode === 404 || errorWithCode.statusCode === 410) {
                            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(409, `Partial upload ${partialId} not found or expired`);
                        }
                        throw error;
                    }
                }
                const config2 = {
                    metadata: {
                        ...parsedMetadata,
                        partialIds,
                        uploadConcat: `final;${partialIds.join(" ")}`
                    },
                    size: totalSize
                };
                const file2 = await this.storage.create(config2);
                await this.concatenateFiles(file2, partialFiles);
                const locationUrl2 = this.buildFileUrl(requestUrl, file2);
                const headers2 = {
                    ...this.buildHeaders(file2, {
                        Location: locationUrl2
                    }),
                    "Upload-Concat": uploadConcat
                };
                return {
                    ...file2,
                    headers: headers2,
                    statusCode: 201
                };
            }
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(400, "Invalid Upload-Concat header format");
        }
        if (uploadLength === void 0 && uploadDeferLength === void 0) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(400, "Either upload-length or upload-defer-length must be specified.");
        }
        if (uploadLength !== void 0 && Number.isNaN(Number(uploadLength))) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(400, "Invalid upload-length");
        }
        const metadata = metadataHeader ? parseMetadata(metadataHeader) : {};
        const config = {
            metadata,
            size: uploadLength
        };
        let file = await this.storage.create(config);
        if (contentType === "application/offset+octet-stream" && contentLength > 0) {
            file = await this.storage.write({
                ...file,
                body: bodyStream,
                contentLength,
                start: 0
            });
        }
        let headers = {};
        if (this.storage.tusExtension.includes("expiration") && typeof file.expiredAt === "number" && file.bytesWritten !== Number.parseInt(uploadLength, 10)) {
            headers = {
                "Upload-Expires": new Date(file.expiredAt).toUTCString()
            };
        }
        const locationUrl = this.buildFileUrl(requestUrl, file);
        headers = {
            ...headers,
            ...this.buildHeaders(file, {
                Location: locationUrl
            })
        };
        if (!headers.Location) {
            headers.Location = locationUrl;
        }
        if (file.bytesWritten > 0) {
            headers["Upload-Offset"] = file.bytesWritten.toString();
        }
        const statusCode = file.bytesWritten > 0 ? 200 : 201;
        return {
            ...file,
            headers,
            statusCode
        };
    }
    /**
   * Handle TUS PATCH (write chunk).
   * @param id File ID from URL
   * @param uploadOffset Upload offset header value
   * @param uploadLength Optional upload length header value (for defer-length)
   * @param metadataHeader Optional upload metadata header value
   * @param checksum Optional checksum
   * @param checksumAlgorithm Optional checksum algorithm
   * @param requestUrl Request URL for Location header
   * @param bodyStream Request body stream
   * @param contentLength Content length
   * @returns Promise resolving to ResponseFile with upload progress
   */ async handlePatch(id, uploadOffset, uploadLength, metadataHeader, checksum, checksumAlgorithm, requestUrl, bodyStream, contentLength) {
        const metadata = metadataHeader ? parseMetadata(metadataHeader) : void 0;
        if (metadata) {
            try {
                await this.storage.update({
                    id
                }, {
                    id,
                    metadata
                });
            } catch (error) {
                const errorWithCode = error;
                if (errorWithCode.UploadErrorCode === "FILE_NOT_FOUND") {
                    throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(410, "Upload expired");
                }
                throw error;
            }
        }
        let currentFile;
        try {
            currentFile = await this.storage.getMeta(id);
            await this.storage.checkIfExpired(currentFile);
        } catch (error) {
            const errorWithCode = error;
            if (errorWithCode.UploadErrorCode === "GONE" || errorWithCode.UploadErrorCode === "FILE_NOT_FOUND") {
                throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(410, "Upload expired");
            }
            throw error;
        }
        const uploadConcatValue = currentFile.metadata?.uploadConcat;
        if (typeof uploadConcatValue === "string" && uploadConcatValue.startsWith("final;")) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(403, "Cannot PATCH a final concatenation upload");
        }
        let file = await this.storage.write({
            body: bodyStream,
            checksum,
            checksumAlgorithm,
            contentLength,
            id,
            start: uploadOffset
        });
        if (uploadLength !== void 0) {
            if (!this.storage.tusExtension.includes("creation-defer-length")) {
                throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(501, "creation-defer-length extension is not (yet) supported.");
            }
            if (file.size !== void 0 && !Number.isNaN(file.size)) {
                throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(412, "Upload-Length has already been set for this upload");
            }
            const size = Number.parseInt(uploadLength, 10);
            if (Number.isNaN(size)) {
                throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(400, "Invalid Upload-Length value");
            }
            if (size < file.bytesWritten) {
                throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(400, "Upload-Length is smaller than the current offset");
            }
            file = await this.storage.update({
                id
            }, {
                size
            });
            if (file.bytesWritten === file.size) {
                file.status = "completed";
            }
        }
        return {
            ...file,
            headers: this.buildHeaders(file, {
                "Upload-Offset": file.bytesWritten
            }),
            statusCode: file.status === "completed" ? 200 : 204
        };
    }
    /**
   * Handle TUS HEAD (get upload status).
   * @param id File ID from URL
   * @returns Promise resolving to ResponseFile with upload status headers
   */ async handleHead(id) {
        const file = await this.storage.getMeta(id);
        await this.storage.checkIfExpired(file);
        const headers = {
            ...typeof file.size === "number" && !Number.isNaN(file.size) ? {
                "Upload-Length": file.size
            } : {
                "Upload-Defer-Length": "1"
            },
            ...this.buildHeaders(file, {
                "Cache-Control": __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["H"].createCacheControlPreset("no-store"),
                "Upload-Metadata": serializeMetadata(file.metadata),
                "Upload-Offset": file.bytesWritten
            })
        };
        const uploadConcatValue = file.metadata?.uploadConcat;
        if (typeof uploadConcatValue === "string") {
            headers["Upload-Concat"] = uploadConcatValue;
        }
        return {
            headers,
            statusCode: 200
        };
    }
    /**
   * Handle TUS GET (get upload metadata).
   * @param id File ID from URL
   * @returns Promise resolving to ResponseFile with file metadata as JSON
   */ async handleGet(id) {
        const file = await this.storage.getMeta(id);
        return {
            ...file,
            body: file,
            // Return file metadata as JSON
            headers: this.buildHeaders(file, {
                "Content-Type": __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["H"].createContentType({
                    mediaType: "application/json"
                })
            }),
            statusCode: 200
        };
    }
    /**
   * Handle TUS DELETE (terminate upload).
   * @param id File ID from URL
   * @returns Promise resolving to ResponseFile with deletion confirmation
   */ async handleDelete(id) {
        if (this.disableTerminationForFinishedUploads) {
            const file2 = await this.storage.getMeta(id);
            if (file2.status === "completed") {
                throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(400, "Termination of finished uploads is disabled");
            }
        }
        const file = await this.storage.delete({
            id
        });
        if (file.status === void 0) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(404, "File not found");
        }
        return {
            ...file,
            headers: this.buildHeaders(file),
            statusCode: 204
        };
    }
    /**
   * Build TUS protocol headers including required Tus-Resumable and optional Upload-Expires.
   * @param file Upload file object with metadata
   * @param headers Additional headers to include
   * @returns Headers object with TUS protocol headers
   */ buildHeaders(file, headers = {}) {
        headers["Tus-Resumable"] = TUS_RESUMABLE_VERSION;
        if (this.storage.tusExtension.includes("expiration") && file.expiredAt !== void 0) {
            headers["Upload-Expires"] = new Date(file.expiredAt).toUTCString();
        }
        return headers;
    }
    /**
   * Extract checksum algorithm and value from Upload-Checksum header.
   * @param checksumHeader Upload-Checksum header value
   * @returns Object containing checksum algorithm and value
   */ extractChecksum(checksumHeader) {
        if (!checksumHeader) {
            return {
                checksum: void 0,
                checksumAlgorithm: void 0
            };
        }
        const [checksumAlgorithm, checksum] = checksumHeader.split(/\s+/).filter(Boolean);
        return {
            checksum,
            checksumAlgorithm
        };
    }
    /**
   * Validate Tus-Resumable header value.
   * @param tusResumable Tus-Resumable header value
   * @throws {Error} 412 if version doesn't match or header is missing
   */ validateTusResumableHeader(tusResumable) {
        if (!tusResumable) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(412, "Missing Tus-Resumable header");
        }
        if (tusResumable !== TUS_RESUMABLE_VERSION) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(412, `Unsupported TUS version: ${tusResumable}. Server supports: ${TUS_RESUMABLE_VERSION}`);
        }
    }
    /**
   * Concatenate partial uploads into a final upload.
   * @param finalFile Final file that will contain concatenated content
   * @param partialFiles Array of partial upload files to concatenate
   * @returns Promise resolving when concatenation is complete
   */ async concatenateFiles(finalFile, partialFiles) {
        let offset = 0;
        for (const partialFile of partialFiles){
            const { size, stream } = await this.storage.getStream({
                id: partialFile.id
            });
            if (size === void 0) {
                throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(500, "Partial upload size is undefined");
            }
            const updatedFile = await this.storage.write({
                ...finalFile,
                body: stream,
                contentLength: size,
                start: offset
            });
            Object.assign(finalFile, updatedFile);
            offset += size;
        }
        if (finalFile.size !== void 0 && finalFile.bytesWritten !== finalFile.size) {
            await this.storage.update({
                id: finalFile.id
            }, {
                bytesWritten: finalFile.size
            });
        }
    }
}
const TUS_RESUMABLE = TUS_RESUMABLE_VERSION;
const TUS_VERSION = TUS_VERSION_VERSION;
;
}),
"[project]/packages/storage/dist/packem_shared/Tus-BnhzcQUB.js [app-route] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Tus
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/headers-C9CQX79R.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$base$2d$handler$2d$fetch$2d$DkAUTzhr$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/base-handler-fetch-DkAUTzhr.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$TUS_RESUMABLE$2d$E8ESjr80$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/TUS_RESUMABLE-E8ESjr80.js [app-route] (ecmascript)");
;
;
;
;
class Tus extends __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$base$2d$handler$2d$fetch$2d$DkAUTzhr$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["B"] {
    /**
   * Limiting enabled http method handler
   */ static methods = [
        "delete",
        "download",
        "get",
        "head",
        "options",
        "patch",
        "post"
    ];
    tusBase;
    disableTerminationForFinishedUploads = false;
    constructor(options){
        super(options);
        this.disableTerminationForFinishedUploads = options.disableTerminationForFinishedUploads ?? false;
        const tusInstance = this;
        this.tusBase = new class extends __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$TUS_RESUMABLE$2d$E8ESjr80$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["TusBase"] {
            get storage() {
                return tusInstance.storage;
            }
            get disableTerminationForFinishedUploads() {
                return tusInstance.disableTerminationForFinishedUploads;
            }
            buildFileUrl(requestUrl, file) {
                return tusInstance.buildFileUrlForTus(requestUrl, file);
            }
        }();
    }
    /**
   * Handle OPTIONS requests with TUS protocol capabilities.
   * @returns Promise resolving to ResponseFile with TUS headers
   */ async options() {
        return this.tusBase.handleOptions(Tus.methods);
    }
    /**
   * Creates a new TUS upload and optionally starts uploading data.
   * @param request Web API Request with TUS headers.
   * @returns Promise resolving to ResponseFile with upload location and offset.
   */ async post(request) {
        const tusResumable = request.headers.get("tus-resumable");
        this.tusBase.validateTusResumableHeader(tusResumable || void 0);
        const uploadLength = request.headers.get("upload-length") || void 0;
        const uploadDeferLength = request.headers.get("upload-defer-length") || void 0;
        const uploadConcat = request.headers.get("upload-concat") || void 0;
        const metadataHeader = request.headers.get("upload-metadata") || void 0;
        const contentType = request.headers.get("content-type") || "";
        const contentLengthHeader = request.headers.get("content-length");
        const contentLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : 0;
        const requestUrl = request.url;
        const bodyStream = request.body;
        return this.tusBase.handlePost(uploadLength, uploadDeferLength, uploadConcat, metadataHeader, requestUrl, bodyStream, contentLength, contentType);
    }
    /**
   * Write a chunk of data to an existing TUS upload.
   * @param request Web API Request with chunk data and TUS headers
   * @returns Promise resolving to ResponseFile with updated offset
   */ async patch(request) {
        const tusResumable = request.headers.get("tus-resumable");
        this.tusBase.validateTusResumableHeader(tusResumable || void 0);
        const id = getIdFromRequestUrl(request.url);
        if (!id) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(404, "File not found");
        }
        const uploadOffsetHeader = request.headers.get("upload-offset");
        if (!uploadOffsetHeader) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(412, "Missing Upload-Offset header");
        }
        const contentType = request.headers.get("content-type");
        if (!contentType) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(412, "Content-Type header required");
        }
        if (contentType !== "application/offset+octet-stream") {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(415, "Unsupported Media Type");
        }
        const uploadOffset = Number.parseInt(uploadOffsetHeader, 10);
        const uploadLength = request.headers.get("upload-length") || void 0;
        const metadataHeader = request.headers.get("upload-metadata") || void 0;
        const contentLengthHeader = request.headers.get("content-length");
        const contentLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : 0;
        const checksumHeader = request.headers.get("upload-checksum") || void 0;
        const { checksum, checksumAlgorithm } = this.tusBase.extractChecksum(checksumHeader);
        const requestUrl = request.url;
        const bodyStream = request.body;
        try {
            return this.tusBase.handlePatch(id, uploadOffset, uploadLength, metadataHeader, checksum, checksumAlgorithm, requestUrl, bodyStream, contentLength);
        } catch (error) {
            const errorWithCode = error;
            if (errorWithCode.UploadErrorCode === "GONE" || errorWithCode.UploadErrorCode === "FILE_NOT_FOUND") {
                throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(410, "Upload expired");
            }
            throw error;
        }
    }
    /**
   * Get current upload offset and metadata for TUS resumable uploads.
   * @param request Web API Request with upload ID
   * @returns Promise resolving to ResponseFile with upload-offset and metadata headers
   */ async head(request) {
        const tusResumable = request.headers.get("tus-resumable");
        this.tusBase.validateTusResumableHeader(tusResumable || void 0);
        const id = getIdFromRequestUrl(request.url);
        if (!id) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(404, "File not found");
        }
        try {
            return this.tusBase.handleHead(id);
        } catch (error) {
            const errorWithCode = error;
            if (errorWithCode.UploadErrorCode === "GONE" || errorWithCode.UploadErrorCode === "FILE_NOT_FOUND") {
                throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(410, "Upload expired");
            }
            throw error;
        }
    }
    /**
   * Get TUS upload metadata and current status.
   * @param request Web API Request with upload ID
   * @returns Promise resolving to ResponseFile with file metadata as JSON
   */ async get(request) {
        const tusResumable = request.headers.get("tus-resumable");
        this.tusBase.validateTusResumableHeader(tusResumable || void 0);
        const id = getIdFromRequestUrl(request.url);
        if (!id) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(404, "File not found");
        }
        try {
            return this.tusBase.handleGet(id);
        } catch (error) {
            const errorWithCode = error;
            if (errorWithCode.UploadErrorCode === "GONE") {
                throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(410, "Upload expired");
            }
            throw error;
        }
    }
    /**
   * Delete a TUS upload and its associated data.
   * @param request Web API Request with upload ID
   * @returns Promise resolving to ResponseFile with deletion confirmation
   */ async delete(request) {
        const tusResumable = request.headers.get("tus-resumable");
        this.tusBase.validateTusResumableHeader(tusResumable || void 0);
        const id = getIdFromRequestUrl(request.url);
        if (!id) {
            throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(404, "File not found");
        }
        try {
            return this.tusBase.handleDelete(id);
        } catch (error) {
            const errorWithCode = error;
            if (errorWithCode.code === "ENOENT") {
                throw (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$headers$2d$C9CQX79R$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["c"])(404, "File not found");
            }
            throw error;
        }
    }
    /**
   * Compose and register HTTP method handlers.
   */ compose() {
        this.registeredHandlers.set("POST", this.post.bind(this));
        this.registeredHandlers.set("PATCH", this.patch.bind(this));
        this.registeredHandlers.set("HEAD", this.head.bind(this));
        this.registeredHandlers.set("GET", this.get.bind(this));
        this.registeredHandlers.set("DELETE", this.delete.bind(this));
        this.registeredHandlers.set("OPTIONS", this.options.bind(this));
        this.logger?.debug("Registered handler: %s", [
            ...this.registeredHandlers.keys()
        ].join(", "));
    }
    /**
   * Build file URL for TUS uploads (without file extension).
   * @param requestUrl Request URL string
   * @param file File object containing ID
   * @returns Constructed file URL for TUS protocol
   */ buildFileUrlForTus(requestUrl, file) {
        const url = new URL(requestUrl);
        const { pathname } = url;
        Object.fromEntries(url.searchParams.entries());
        const relative = `${pathname}/${file.id}${url.search}`;
        return `${this.storage.config.useRelativeLocation ? relative : url.origin + relative}`;
    }
}
const getIdFromRequestUrl = (url)=>{
    try {
        const urlObject = new URL(url);
        const pathParts = urlObject.pathname.split("/").filter(Boolean);
        const lastPart = pathParts[pathParts.length - 1];
        return lastPart || void 0;
    } catch  {
        return void 0;
    }
};
;
}),
"[project]/packages/storage/dist/handler/http/nextjs/index.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createNextjsHandler",
    ()=>createNextjsHandler
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$Multipart$2d$D3eg40wT$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/Multipart-D3eg40wT.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$Rest$2d$DxBjOMcM$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/Rest-DxBjOMcM.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$Tus$2d$BnhzcQUB$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/storage/dist/packem_shared/Tus-BnhzcQUB.js [app-route] (ecmascript) <locals>");
;
;
;
const waitForStorage = async (storage)=>{
    if (storage.isReady) {
        return;
    }
    const maxWait = 5e3;
    const startTime = Date.now();
    while(!storage.isReady && Date.now() - startTime < maxWait){
        await new Promise((resolve)=>{
            setTimeout(()=>{
                resolve();
            }, 100);
        });
    }
    if (!storage.isReady) {
        throw new Error("Storage initialization timeout");
    }
};
const createNextjsHandler = (config)=>{
    let handler;
    switch(config.type){
        case "multipart":
            {
                handler = new __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$Multipart$2d$D3eg40wT$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"](config);
                break;
            }
        case "rest":
            {
                handler = new __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$Rest$2d$DxBjOMcM$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"](config);
                break;
            }
        case "tus":
            {
                handler = new __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$packem_shared$2f$Tus$2d$BnhzcQUB$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"](config);
                break;
            }
        default:
            {
                throw new Error(`Unknown handler type: ${String(config.type ?? "unknown")}`);
            }
    }
    const nextjsHandler = async (request)=>{
        try {
            await waitForStorage(handler.storage);
            return await handler.fetch(request);
        } catch (error) {
            const errorObject = error;
            const statusCode = errorObject.statusCode || (errorObject.status ? Number.parseInt(errorObject.status, 10) : void 0) || 500;
            return Response.json({
                error: errorObject.message || "Request failed"
            }, {
                status: statusCode
            });
        }
    };
    return nextjsHandler;
};
;
}),
"[externals]/node:fs [external] (node:fs, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:fs", () => require("node:fs"));

module.exports = mod;
}),
"[externals]/node:fs/promises [external] (node:fs/promises, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:fs/promises", () => require("node:fs/promises"));

module.exports = mod;
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
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$handler$2f$http$2f$nextjs$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage/dist/handler/http/nextjs/index.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2d$client$2f$examples$2f$nextjs$2f$lib$2f$storage$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage-client/examples/nextjs/lib/storage.ts [app-route] (ecmascript)");
;
;
const handler = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2f$dist$2f$handler$2f$http$2f$nextjs$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createNextjsHandler"])({
    storage: __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2d$client$2f$examples$2f$nextjs$2f$lib$2f$storage$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["storage"],
    type: "multipart"
});
const POST = handler;
const DELETE = handler;
const GET = handler;
const OPTIONS = handler;
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__98875a9a._.js.map