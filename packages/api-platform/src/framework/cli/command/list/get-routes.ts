import type { Server } from "@hapi/hapi";
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
            throw new Error(`No API routes found, in "${appOrPath}".`);
        }

        return apiRouteFiles.flatMap((apiRouteFile) => apiRouteFileParser(apiRouteFile, appOrPath as string, verbose));
    }

    return null;
};
