export * from "./index-browser";

export { default as createNodeRouter } from "./connect/create-node-router";

export { onError, onNoMatch } from "./connect/handler";
export { default as corsMiddleware } from "./connect/middleware/cors-middleware";
export { default as httpHeaderNormalizerMiddleware } from "./connect/middleware/http-header-normalizer";
export { default as rateLimiterMiddleware } from "./connect/middleware/rate-limiter-middleware";

export { default as serializersMiddleware } from "./connect/middleware/serializers-middleware";
export { serialize, xmlTransformer, yamlTransformer } from "./serializers";

export type { Serializer, Serializers } from "./serializers";
export { default as swaggerHandler } from "./swagger/api/swagger-handler";
export { dateIn, dateOut } from "./zod";
export { EdgeRouter, NodeRouter, Router, createEdgeRouter, expressWrapper, sendJson, withZod } from "@visulima/connect";

export type {
    EdgeRequestHandler,
    ExpressRequestHandler,
    FindResult,
    FunctionLike,
    HandlerOptions,
    HttpMethod,
    NextHandler,
    Nextable,
    NodeRequestHandler,
    Route,
    RouteShortcutMethod,
    ValueOrPromise,
} from "@visulima/connect";

export {
    BadGateway,
    BadRequest,
    BandwidthLimitExceeded,
    Conflict,
    ExpectationFailed,
    FailedDependency,
    Forbidden,
    GatewayTimeout,
    Gone,
    HTTPVersionNotSupported,
    ImATeapot,
    InsufficientStorage,
    InternalServerError,
    LengthRequired,
    Locked,
    LoopDetected,
    MethodNotAllowed,
    MisdirectedRequest,
    NetworkAuthenticationRequire,
    NotAcceptable,
    NotExtended,
    NotFound,
    NotImplemented,
    PayloadTooLarge,
    PaymentRequired,
    PreconditionFailed,
    PreconditionRequired,
    ProxyAuthenticationRequired,
    RangeNotSatisfiable,
    RequestHeaderFieldsTooLarge,
    RequestTimeout,
    ServiceUnavailable,
    TooManyRequests,
    URITooLong,
    Unauthorized,
    UnavailableForLegalReasons,
    UnprocessableEntity,
    UnsupportedMediaType,
    UpgradeRequired,
    VariantAlsoNegotiates,
    default as createHttpError,
} from "http-errors";
