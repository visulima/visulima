// eslint-disable-next-line e18e/ban-dependencies -- type-only import; express is a supported integration target for the route-listing CLI
import type { Express, Router } from "express";

import type { Layer, Parameter, Route, RouteMetaData } from "./types";

const PARAM_NAME_REGEX = /[A-Za-z0-9_]+/y;

/**
 * Extracts the path parameters declared in an Express 5 route path string.
 *
 * Express 5 (path-to-regexp v8) syntax: `:name` named parameters, `*name`
 * wildcards, and `{ ... }` groups whose entire contents are optional.
 * @param routePath The declared route path string
 * @returns The path parameters with their required flag
 */
const extractParameters = (routePath: string): Parameter[] => {
    const parameters: Parameter[] = [];
    let depth = 0;

    for (let index = 0; index < routePath.length; index += 1) {
        const char = routePath[index];

        if (char === "{") {
            depth += 1;
        } else if (char === "}") {
            depth = Math.max(0, depth - 1);
        } else if (char === ":" || char === "*") {
            PARAM_NAME_REGEX.lastIndex = index + 1;

            const match = PARAM_NAME_REGEX.exec(routePath);

            if (match && match.index === index + 1) {
                parameters.push({ in: "path", name: match[0], required: depth === 0 });
                index = PARAM_NAME_REGEX.lastIndex - 1;
            }
        }
    }

    return parameters;
};

/**
 * Renders an Express 5 route path (string | RegExp | array) as a display string.
 * @param routePath The declared route path
 * @returns The path rendered as a string
 */
const renderPath = (routePath: Route["path"]): string => {
    if (typeof routePath === "string") {
        return routePath;
    }

    if (Array.isArray(routePath)) {
        return routePath.map((entry) => (typeof entry === "string" ? entry : entry.toString())).join(",");
    }

    return routePath.toString();
};

/**
 * Parses a route layer. Route layers are the leafs of an Express router tree.
 * @param layer The route layer holding the per-method handler stack and metadata
 * @returns A RouteMetaData object holding the metadata for a given route
 */
const parseRouteLayer = (layer: Layer & { route: Route }): RouteMetaData => {
    const { route } = layer;
    const lastRequestHandler = route.stack.at(-1) as Layer;

    const withMetadata = route.stack.filter((element) => (element.handle as Route | undefined)?.metadata !== undefined);

    if (withMetadata.length > 1) {
        throw new Error("Only one metadata middleware is allowed per route");
    }

    const path = typeof route.path === "string" ? route.path.replaceAll(/\/{2,}/gu, "/") : renderPath(route.path);
    const pathParameters = typeof route.path === "string" ? extractParameters(route.path) : [];

    if (withMetadata.length === 0) {
        return { method: lastRequestHandler.method as string, path, pathParams: pathParameters };
    }

    return {
        metadata: ((withMetadata[0] as Layer).handle as Route).metadata,
        method: lastRequestHandler.method as string,
        path,
        pathParams: pathParameters,
    };
};

/**
 * Recursive traversal of an Express 5 (router@2) layer tree.
 *
 * Express 5 no longer stores the declared mount path of `app.use(path, router)`
 * layers on the built layer (it lives only inside opaque path-to-regexp matcher
 * closures), so mounted-router prefixes cannot be reconstructed and are omitted
 * from the listed path.
 * @param routes The array of routes to add to
 * @param layer The current layer of the router tree
 */
const traverse = (routes: RouteMetaData[], layer: Layer): void => {
    if (layer.route) {
        if (layer.route.stack.length === 0) {
            return;
        }

        routes.push(parseRouteLayer(layer as Layer & { route: Route }));

        return;
    }

    const childStack = (layer.handle as (Router & { stack?: Layer[] }) | undefined)?.stack;

    if (childStack !== undefined) {
        for (const child of childStack) {
            traverse(routes, child);
        }
    }
};

/**
 * Parses an Express 5 app and generates a list of routes with metadata.
 *
 * Can parse:
 * - Nested routers and complex Express projects
 * - Optional parameters e.g. `/test{/:id}`
 * - Wildcards e.g. `/files/*splat`
 * - Regex routes e.g. `/\/abc|\/xyz/u`
 * - Array of paths e.g. `app.get(["/abc", "/xyz"])`
 *
 * Mounted-router prefixes (`app.use("/base", router)`) are not recoverable in
 * Express 5 and are therefore omitted from the reported path.
 * @param app The Express app reference. Must be used after all routes have been attached
 * @returns List of routes for this Express app with the meta-data that has been picked up
 */
const expressPathParser = (app: Express): RouteMetaData[] => {
    // eslint-disable-next-line no-underscore-dangle, @typescript-eslint/no-unsafe-assignment -- express's internal _router is the legacy private accessor used as fallback for older versions; both sides are typed as `any` by upstream express types
    const router: Router = (app as Express & { _router?: Router })._router ?? (app.router as unknown as Router);
    const routes: RouteMetaData[] = [];

    for (const layer of (router as Router & { stack: Layer[] }).stack) {
        traverse(routes, layer as unknown as Layer);
    }

    return routes;
};

export default expressPathParser;
