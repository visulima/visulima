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
    UnorderedCollection,
    UnprocessableEntity,
    UnavailableForLegalReasons,
    UnsupportedMediaType,
    UpgradeRequired,
    URITooLong
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
export { createEdgeRouter, EdgeRouter, expressWrapper, NodeRouter, Router, withZod, sendJson } from "@visulima/connect";

export type {
    IRLWrapperBlackAndWhiteOptions,
    IRateLimiterStoreOptions,
    IRateLimiterStoreNoAutoExpiryOptions,
    IRateLimiterRes,
    IRateLimiterQueueOpts,
    IRateLimiterOptions,
    IRateLimiterMongoOptions,
    IRateLimiterMongoFunctionOptions,
    IRateLimiterClusterOptions,
    ICallbackReady,
} from "rate-limiter-flexible";

export {
    BurstyRateLimiter,
    RateLimiterAbstract,
    RateLimiterCluster,
    RateLimiterClusterMaster,
    RateLimiterClusterMasterPM2,
    RateLimiterStoreAbstract,
    RLWrapperBlackAndWhite,
    RateLimiterUnion,
    RateLimiterRes,
    RateLimiterRedis,
    RateLimiterQueue,
    RateLimiterPostgres,
    RateLimiterMySQL,
    RateLimiterMongo,
    RateLimiterMemory,
    RateLimiterMemcache,
} from "rate-limiter-flexible";

export { default as rateLimiterMiddleware } from "./middleware/rate-limiter-middleware";
export { default as corsMiddleware } from "./middleware/cors-middleware";

export { dateIn, dateOut } from "./zod";

export type { SimplePaginator } from "./pagination";
export { Paginator, paginate } from "./pagination";
