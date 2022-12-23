// eslint-disable-next-line import/no-extraneous-dependencies
import type { Express } from "express";

import expressPathParser from "./express/express-path-parser";
import type { RouteMetaData } from "./express/types";
import type { Route } from "./types";

const expressRoutes = (app: Express): Route[] => {
    const routes: Route[] = [];

    expressPathParser(app).forEach((route: RouteMetaData) => {
        routes.push({
            path: route.path,
            method: route.method.toUpperCase(),
            tags: [],
            file: "unknown",
        });
    });

    return routes;
};

export default expressRoutes;
