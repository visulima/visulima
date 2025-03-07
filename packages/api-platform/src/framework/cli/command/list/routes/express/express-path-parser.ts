import type { Express, Router } from "express";

import pathRegexParser from "./path-regex-parser";
import type { Key, Layer, Parameter, Route, RouteMetaData } from "./types";

/**
 * Parses a route object. Route objects are the leafs of an express router tree
 *
 * @param layer The layer of this route object - represents the stack of middleware and other metadata
 * @param keys The full set of keys for this particular route
 * @param basePath The base path as it was initial declared for this route
 * @returns A ExpressPath object holding the metadata for a given route
 */
const parseRouteLayer = (layer: Required<Layer>, keys: Key[], basePath: string): RouteMetaData => {
    const lastRequestHandler = layer.route.stack.at(-1) as Layer;
    const pathParameters: Parameter[] = keys.map((key) => {
        return { in: "path", name: key.name, required: !key.optional };
    });

    const filtered = layer.route.stack.filter((element) => (element.handle as Route).metadata);

    if (filtered.length > 1) {
        throw new Error("Only one metadata middleware is allowed per route");
    }

    const path = (basePath + layer.route.path).replaceAll(/\/{2,}/gu, "/");

    if (filtered.length === 0) {
        return { method: lastRequestHandler.method, path, pathParams: pathParameters };
    }

    return {
        metadata: ((filtered[0] as Layer).handle as Route).metadata,
        method: lastRequestHandler.method,
        path,
        pathParams: pathParameters,
    };
};

/**
 * Recursive traversal method for the express router and middleware tree.
 *
 * @param routes The array of routes to add to
 * @param path The current path segment that we have traversed so far
 * @param layer The current 'layer' of the router tree
 * @param keys The keys for the parameter's in the current path branch of the traversal
 * @returns void - base case saves result to internal object
 */
const traverse = (routes: RouteMetaData[], path: string, layer: Layer, keys: Key[]): void => {
    // eslint-disable-next-line no-param-reassign
    keys = [...keys, ...layer.keys];

    if (layer.name === "router" && layer.handle?.stack !== undefined) {
        for (const l of layer.handle.stack) {
            // eslint-disable-next-line no-param-reassign
            path = path || "";

            traverse(routes, `${path}/${pathRegexParser(layer.regexp, layer.keys)}`, l as Layer, keys);
        }
    }

    if (!layer.route || layer.route.stack.length === 0) {
        return;
    }

    routes.push(parseRouteLayer(layer as Required<Layer>, keys, path));
};

// @TODO use this to parse the express swagger

/**
 * Parses an Express app and generates list of routes with metadata.
 *
 * Can Parse:
 *  - Nested Routers and Complex Express Projects
 *  - Optional parameters e.g. /:name?
 *  - Complex Matching routes e.g. /ma*tch, /ex(ab)?mple
 *  - Regex routes e.g. /\/abc|\/xyz/
 *  - Array of paths e.g. app.get(['/abc', '/xyz']) -> /abc,xyz/
 *
 * @param app The Express app reference. Must be used after all routes have been attached
 *
 * @returns List of routes for this express app with meta-data that has been picked up
 */
const expressPathParser = (app: Express): RouteMetaData[] => {
    // eslint-disable-next-line no-underscore-dangle
    const router: Router = app._router || app.router;
    const routes: RouteMetaData[] = [];

    for (const layer of router.stack) {
        // @TODO: revisit this type assertion
        traverse(routes, "", layer as unknown as Layer, []);
    }

    return routes;
};

export default expressPathParser;
