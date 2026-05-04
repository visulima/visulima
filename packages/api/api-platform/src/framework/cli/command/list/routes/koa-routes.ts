import type Koa from "koa";

import type { Route } from "./types";

interface KoaRouterStackEntry {
    methods: string[];
    path: string;
}

interface KoaRouterMiddleware {
    router?: { stack: KoaRouterStackEntry[] };
}

const koaRoutes = (app: Koa): Route[] => {
    const routes: Route[] = [];

    app.middleware
        .filter((middlewareFunction) => (middlewareFunction as KoaRouterMiddleware).router)

        .flatMap((middlewareFunction) => ((middlewareFunction as KoaRouterMiddleware).router as { stack: KoaRouterStackEntry[] }).stack)
        .forEach((route) => {
            routes.push({
                file: "unknown",
                method: route.methods.join("|").toUpperCase(),
                path: route.path,
                tags: [],
            });
        });

    return routes;
};

export default koaRoutes;
