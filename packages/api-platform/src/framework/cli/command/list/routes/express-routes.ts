import type { Express } from "express";

import expressPathParser from "./express/express-path-parser";
import type { RouteMetaData } from "./express/types";
import type { Route } from "./types";

const expressRoutes = (app: Express): Route[] => {
    const routes: Route[] = [];

    expressPathParser(app).forEach((route: RouteMetaData) => {
        routes.push({
            file: "unknown",
            method: route.method.toUpperCase(),
            path: route.path,
            tags: [],
        });
    });

    return routes;
};

export default expressRoutes;
