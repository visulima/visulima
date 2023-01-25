// eslint-disable-next-line import/no-extraneous-dependencies
import type Koa from "koa";

import type { Route } from "./types";

const koaRoutes = (app: Koa): Route[] => {
    const routes: Route[] = [];

    app.middleware
        .filter((middlewareFunction) => (middlewareFunction as any).router)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        .flatMap((middlewareFunction) => (middlewareFunction as any).router.stack)
        .forEach((route) => {
            routes.push({
                path: route.path,
                method: route.methods.join("|").toUpperCase(),
                tags: [],
                file: "unknown",
            });
        });

    return routes;
};

export default koaRoutes;
