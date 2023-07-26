import type Koa from "koa";

import type { Route } from "./types";

const koaRoutes = (app: Koa): Route[] => {
    const routes: Route[] = [];

    app.middleware
        .filter((middlewareFunction) => (middlewareFunction as any).router)

        .flatMap((middlewareFunction) => (middlewareFunction as any).router.stack)
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
