export * from "./index-browser";

export {
    default as createHttpError,
    BadRequest,
    Forbidden,
    BadGateway,
    BandwidthLimitExceeded,
    Conflict,
    ExpectationFailed,
    FailedDependency,
    GatewayTimeout,
    Gone,
    HTTPVersionNotSupported,
    ImATeapot,
    InsufficientStorage,
    InternalServerError,
    VariantAlsoNegotiates,
    ProxyAuthenticationRequired,
    NetworkAuthenticationRequire,
    LengthRequired,
    LoopDetected,
    Locked,
    MethodNotAllowed,
    MisdirectedRequest,
    NotAcceptable,
    NotExtended,
    NotFound,
    NotImplemented,
    PayloadTooLarge,
    RequestHeaderFieldsTooLarge,
    PaymentRequired,
    PreconditionFailed,
    PreconditionRequired,
    RangeNotSatisfiable,
    RequestTimeout,
    ServiceUnavailable,
    TooManyRequests,
    Unauthorized,
    UnprocessableEntity,
    UnavailableForLegalReasons,
    UnsupportedMediaType,
    UpgradeRequired,
    URITooLong,
} from "http-errors";

export { default as createNodeRouter } from "./connect/create-node-router";
export { onError, onNoMatch } from "./connect/handler";
export type {
    EdgeRequestHandler,
    ExpressRequestHandler,
    NodeRequestHandler,
    Route,
    HandlerOptions,
    NextHandler,
    FunctionLike,
    Nextable,
    ValueOrPromise,
    FindResult,
    RouteShortcutMethod,
    HttpMethod,
} from "@visulima/connect";
export {
    createEdgeRouter, EdgeRouter, expressWrapper, NodeRouter, Router, withZod, sendJson,
} from "@visulima/connect";

export type { Serializers, Serializer } from "./serializers";
export { serialize, yamlTransformer, xmlTransformer } from "./serializers";

export { default as rateLimiterMiddleware } from "./connect/middleware/rate-limiter-middleware";
export { default as corsMiddleware } from "./connect/middleware/cors-middleware";
export { default as serializersMiddleware } from "./connect/middleware/serializers-middleware";
export { default as httpHeaderNormalizerMiddleware } from "./connect/middleware/http-header-normalizer";

export { default as swaggerHandler } from "./swagger/api/swagger-handler";

export { dateIn, dateOut } from "./zod";
