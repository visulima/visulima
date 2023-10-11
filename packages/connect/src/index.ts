export type { ExpressRequestHandler } from "./adapter/express";
export { default as expressWrapper } from "./adapter/express";
export { default as withZod } from "./adapter/with-zod";
export type { RequestHandler as EdgeRequestHandler } from "./edge";
export { createEdgeRouter, EdgeRouter } from "./edge";
// @deprecated Use `createNodeRouter` instead
export type { RequestHandler as NodeRequestHandler } from "./node";
export { createRouter } from "./node";
export { createRouter as createNodeRouter, NodeRouter } from "./node";
export type { Route } from "./router";
export { Router } from "./router";
export type { FindResult, FunctionLike, HandlerOptions, HttpMethod, Nextable, NextHandler, RouteShortcutMethod, ValueOrPromise } from "./types";
export { default as sendJson } from "./utils/send-json";
