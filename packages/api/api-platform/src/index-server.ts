/* eslint-disable import/exports-last, import/first, unicorn/prefer-export-from, prefer-destructuring -- http-errors is a CJS module whose named error classes are properties of its default function. Re-exporting via `export ... from "http-errors"` produces an ESM bundle Node rejects with "Named export not found", and destructuring with `export const { X } = createHttpError` trips TS9019 under --isolatedDeclarations. Read each class off the default import with an explicit type annotation so packem emits a CJS-compatible shape. */
export { default as createNodeRouter } from "./connect/create-node-router";
export { onError, onNoMatch } from "./connect/handler";
export { default as corsMiddleware } from "./connect/middleware/cors-middleware";
export { default as httpHeaderNormalizerMiddleware } from "./connect/middleware/http-header-normalizer";
export type { RateLimiterMiddlewareOptions } from "./connect/middleware/rate-limiter-middleware";
export { default as rateLimiterMiddleware } from "./connect/middleware/rate-limiter-middleware";
export { default as serializersMiddleware } from "./connect/middleware/serializers-middleware";
export { default as jsonapiErrorHandler } from "./error-handler/jsonapi-error-handler";
export { default as problemErrorHandler } from "./error-handler/problem-error-handler";
export type { ApiFormat, ErrorHandler, ErrorHandlers } from "./error-handler/types";
export * from "./index-browser";
export type { Serializer, Serializers } from "./serializers";
export { serialize, xmlTransformer, yamlTransformer } from "./serializers";
export { default as swaggerHandler } from "./swagger/api/swagger-handler";
export { dateIn, dateOut } from "./zod";
export type {
    EdgeRequestHandler,
    ExpressRequestHandler,
    FindResult,
    FunctionLike,
    HandlerOptions,
    HttpMethod,
    Nextable,
    NextHandler,
    NodeRequestHandler,
    Route,
    RouteShortcutMethod,
    ValueOrPromise,
} from "@visulima/connect";
export { createEdgeRouter, EdgeRouter, expressWrapper, NodeRouter, Router, sendJson, withZod } from "@visulima/connect";
// http-errors is a CJS module that attaches its named error classes as properties of the
// default `createHttpError` function. Re-exporting those names directly via `export … from
// "http-errors"` produces an ESM bundle that Node refuses to load with "Named export not
// found". Read each class off the default import so packem emits a CJS-compatible shape.
import createHttpError from "http-errors";

export const BadGateway: typeof createHttpError.BadGateway = createHttpError.BadGateway;
export const BadRequest: typeof createHttpError.BadRequest = createHttpError.BadRequest;
export const BandwidthLimitExceeded: typeof createHttpError.BandwidthLimitExceeded = createHttpError.BandwidthLimitExceeded;
export const Conflict: typeof createHttpError.Conflict = createHttpError.Conflict;
export const ExpectationFailed: typeof createHttpError.ExpectationFailed = createHttpError.ExpectationFailed;
export const FailedDependency: typeof createHttpError.FailedDependency = createHttpError.FailedDependency;
export const Forbidden: typeof createHttpError.Forbidden = createHttpError.Forbidden;
export const GatewayTimeout: typeof createHttpError.GatewayTimeout = createHttpError.GatewayTimeout;
export const Gone: typeof createHttpError.Gone = createHttpError.Gone;
export const HTTPVersionNotSupported: typeof createHttpError.HTTPVersionNotSupported = createHttpError.HTTPVersionNotSupported;
export const ImATeapot: typeof createHttpError.ImATeapot = createHttpError.ImATeapot;
export const InsufficientStorage: typeof createHttpError.InsufficientStorage = createHttpError.InsufficientStorage;
export const InternalServerError: typeof createHttpError.InternalServerError = createHttpError.InternalServerError;
export const LengthRequired: typeof createHttpError.LengthRequired = createHttpError.LengthRequired;
export const Locked: typeof createHttpError.Locked = createHttpError.Locked;
export const LoopDetected: typeof createHttpError.LoopDetected = createHttpError.LoopDetected;
export const MethodNotAllowed: typeof createHttpError.MethodNotAllowed = createHttpError.MethodNotAllowed;
export const MisdirectedRequest: typeof createHttpError.MisdirectedRequest = createHttpError.MisdirectedRequest;
// `@types/http-errors` declares `NetworkAuthenticationRequire` (typo) while runtime
// http-errors exposes `NetworkAuthenticationRequired`. Match the type name for API
// compatibility but read from the actual runtime property so the value isn't undefined.
export const NetworkAuthenticationRequire: typeof createHttpError.NetworkAuthenticationRequire = (
    createHttpError as unknown as { NetworkAuthenticationRequired: typeof createHttpError.NetworkAuthenticationRequire }
).NetworkAuthenticationRequired;
export const NotAcceptable: typeof createHttpError.NotAcceptable = createHttpError.NotAcceptable;
export const NotExtended: typeof createHttpError.NotExtended = createHttpError.NotExtended;
export const NotFound: typeof createHttpError.NotFound = createHttpError.NotFound;
export const NotImplemented: typeof createHttpError.NotImplemented = createHttpError.NotImplemented;
export const PayloadTooLarge: typeof createHttpError.PayloadTooLarge = createHttpError.PayloadTooLarge;
export const PaymentRequired: typeof createHttpError.PaymentRequired = createHttpError.PaymentRequired;
export const PreconditionFailed: typeof createHttpError.PreconditionFailed = createHttpError.PreconditionFailed;
export const PreconditionRequired: typeof createHttpError.PreconditionRequired = createHttpError.PreconditionRequired;
export const ProxyAuthenticationRequired: typeof createHttpError.ProxyAuthenticationRequired = createHttpError.ProxyAuthenticationRequired;
export const RangeNotSatisfiable: typeof createHttpError.RangeNotSatisfiable = createHttpError.RangeNotSatisfiable;
export const RequestHeaderFieldsTooLarge: typeof createHttpError.RequestHeaderFieldsTooLarge = createHttpError.RequestHeaderFieldsTooLarge;
export const RequestTimeout: typeof createHttpError.RequestTimeout = createHttpError.RequestTimeout;
export const ServiceUnavailable: typeof createHttpError.ServiceUnavailable = createHttpError.ServiceUnavailable;
export const TooManyRequests: typeof createHttpError.TooManyRequests = createHttpError.TooManyRequests;
export const Unauthorized: typeof createHttpError.Unauthorized = createHttpError.Unauthorized;
export const UnavailableForLegalReasons: typeof createHttpError.UnavailableForLegalReasons = createHttpError.UnavailableForLegalReasons;
export const UnprocessableEntity: typeof createHttpError.UnprocessableEntity = createHttpError.UnprocessableEntity;
export const UnsupportedMediaType: typeof createHttpError.UnsupportedMediaType = createHttpError.UnsupportedMediaType;
export const UpgradeRequired: typeof createHttpError.UpgradeRequired = createHttpError.UpgradeRequired;
export const URITooLong: typeof createHttpError.URITooLong = createHttpError.URITooLong;
export const VariantAlsoNegotiates: typeof createHttpError.VariantAlsoNegotiates = createHttpError.VariantAlsoNegotiates;

export { createHttpError };
