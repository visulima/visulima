import type { Server } from "@hapi/hapi";
// eslint-disable-next-line e18e/ban-dependencies -- type-only import; express is a supported integration target for the route-listing CLI
import type { Express } from "express";
import type { FastifyInstance } from "fastify";
import type Koa from "koa";

import expressRoutes from "./routes/express-routes";
import fastifyRoutes from "./routes/fastify-routes";
import hapiRoutes from "./routes/hapi-routes";
import koaRoutes from "./routes/koa-routes";
import apiRouteFileParser from "./routes/next/api-route-file-parser";
import collectApiRouteFiles from "./routes/next/collect-api-route-files";
import type { Route } from "./routes/types";

export type FrameworkName = "express" | "fastify" | "hapi" | "koa" | "next" | "unknown";
export const getRoutes = async (
    appOrPath: Express | FastifyInstance | Koa | Server | string,
    frameworkName: FrameworkName,
    verbose: boolean,
): Promise<Route[] | null> => {
    if (frameworkName === "express") {
        return expressRoutes(appOrPath as Express);
    }

    if (frameworkName === "koa") {
        return koaRoutes(appOrPath as Koa);
    }

    if (frameworkName === "hapi") {
        return hapiRoutes(appOrPath as Server);
    }

    if (frameworkName === "fastify") {
        return fastifyRoutes(appOrPath as FastifyInstance);
    }

    if (frameworkName === "next") {
        const apiRouteFiles = await collectApiRouteFiles(appOrPath as string);

        if (apiRouteFiles.length === 0) {
            throw new Error(`No API routes found, in "${appOrPath as string}".`);
        }

        return apiRouteFiles.flatMap((apiRouteFile) => apiRouteFileParser(apiRouteFile, appOrPath as string, verbose));
    }

    // eslint-disable-next-line unicorn/no-null -- public API contract: callers expect null for unknown framework
    return null;
};
