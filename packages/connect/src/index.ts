export { default as expressWrapper } from "./adapter/express";
export type { ExpressRequestHandler } from "./adapter/express";

export { default as withZod } from "./adapter/with-zod";
export { EdgeRouter, createEdgeRouter } from "./edge";

export type { RequestHandler as EdgeRequestHandler } from "./edge";
// @deprecated Use `createNodeRouter` instead
export { createRouter } from "./node";

export { NodeRouter, createRouter as createNodeRouter } from "./node";

export type { RequestHandler as NodeRequestHandler } from "./node";
export { Router } from "./router";

export type { Route } from "./router";

export type { FindResult, FunctionLike, HandlerOptions, HttpMethod, NextHandler, Nextable, RouteShortcutMethod, ValueOrPromise } from "./types";

export { default as sendJson } from "./utils/send-json";
