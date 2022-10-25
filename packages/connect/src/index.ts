export type { RequestHandler as EdgeRequestHandler } from "./edge";
export { createEdgeRouter, EdgeRouter } from "./edge";
export type { ExpressRequestHandler } from "./adapter/express";
export { default as expressWrapper } from "./adapter/express";

export type { RequestHandler } from "./node";
export { createRouter, NodeRouter } from "./node";

export type { Route } from "./router";
export { Router } from "./router";

export { default as withZod } from "./adapter/with-zod";

export type {
    HandlerOptions, NextHandler, FunctionLike, Nextable, ValueOrPromise, FindResult, RouteShortcutMethod, HttpMethod,
} from "./types";

export { default as sendJson } from "./utils/send-json";
