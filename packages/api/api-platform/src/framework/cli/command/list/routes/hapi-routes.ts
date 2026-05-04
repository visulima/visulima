import type { Server } from "@hapi/hapi";

import type { Route } from "./types";

interface HapiRouteEntry {
    path: string;
    route: { method: string };
}

interface HapiRouterRoutes {
    get: (method: string) => { routes: HapiRouteEntry[] };
    keys: () => Iterable<string>;
}

const hapiRoutes = (app: Server): Route[] => {
    // @ts-expect-error TS2339: Property '_core' does not exist on type 'Server'. Internal hapi API surface used to enumerate routes.
    // eslint-disable-next-line no-underscore-dangle
    const core = app._core as { router: { routes: HapiRouterRoutes } };
    const coreRoutes: HapiRouterRoutes = core.router.routes;
    const routes: Route[] = [];

    [...coreRoutes.keys()].forEach((method: string) => {
        coreRoutes.get(method).routes.forEach((route: HapiRouteEntry) => {
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
