// eslint-disable-next-line import/no-extraneous-dependencies
import type { Server } from "@hapi/hapi";

import type { Route } from "./types";

const hapiRoutes = (app: Server): Route[] => {
    // @ts-expect-error
    // eslint-disable-next-line no-underscore-dangle
    const core = app._core as any;
    const coreRoutes = core.router.routes;
    const routes: Route[] = [];

    [...coreRoutes.keys()].forEach((method: string) => {
        coreRoutes.get(method).routes.forEach((route: any) => {
            routes.push({
                path: route.path,
                method: route.route.method.toUpperCase(),
                tags: [],
                file: "unknown",
            });
        });
    });

    return routes;
};

export default hapiRoutes;
