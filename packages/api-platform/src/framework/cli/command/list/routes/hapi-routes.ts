import type { Server } from "@hapi/hapi";

import type { Route } from "./types";

const hapiRoutes = (app: Server): Route[] => {
    // @ts-expect-error TS2339: Property '_core' does not exist on type 'Server'. Internal API.
    // eslint-disable-next-line no-underscore-dangle
    const core = app._core as any;
    const coreRoutes = core.router.routes;
    const routes: Route[] = [];

    [...coreRoutes.keys()].forEach((method: string) => {
        coreRoutes.get(method).routes.forEach((route: any) => {
            routes.push({
                file: "unknown",
                method: route.route.method.toUpperCase(),
                path: route.path,
                tags: [],
            });
        });
    });

    return routes;
};

export default hapiRoutes;
