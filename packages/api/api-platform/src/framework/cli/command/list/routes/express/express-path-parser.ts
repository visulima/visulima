// eslint-disable-next-line e18e/ban-dependencies -- type-only import; express is a supported integration target for the route-listing CLI
import type { Express, Router } from "express";

import type { Layer, Parameter, Route, RouteMetaData } from "./types";

const PARAM_NAME_REGEX = /\w+/y;

/**
 * The declared mount path of an `app.use("/base", router)` layer is not stored
 * anywhere on a built Express 5 (router@2) layer — it lives only inside opaque
 * path-to-regexp matcher closures. {@link installRouteCapture} stamps it onto
 * the layer at registration time under this symbol so the tree can be walked
 * back into full paths.
 */
const DECLARED_PATH = Symbol("api-platform.declaredPath");

type DeclaredPath = RegExp | string | (RegExp | string)[];

const isPathArgument = (value: unknown): value is DeclaredPath =>
    typeof value === "string"
    || value instanceof RegExp
    || (Array.isArray(value) && value.every((entry) => typeof entry === "string" || entry instanceof RegExp));

/**
 * Patches `Router.prototype.use` so every mounted layer records the path it was
 * declared with. Must be called before any routes are registered (the built app
 * no longer exposes this information in Express 5). Idempotent.
 * @param routerConstructor The `express.Router` constructor of the app under inspection
 */
const installRouteCapture = (routerConstructor: typeof Router): void => {
    const prototype = routerConstructor.prototype as Record<PropertyKey, unknown> & { use: (...arguments_: unknown[]) => unknown };

    if (prototype[DECLARED_PATH] === true) {
        return;
    }

    const originalUse = prototype.use;

    prototype.use = function patchedUse(this: { stack: Layer[] }, ...arguments_: unknown[]) {
        const before = this.stack.length;
        const result = originalUse.apply(this, arguments_);
        const [path] = arguments_;

        if (isPathArgument(path)) {
            for (let index = before; index < this.stack.length; index += 1) {
                const layer = this.stack[index] as (Layer & Record<PropertyKey, unknown>) | undefined;

                if (layer) {
                    layer[DECLARED_PATH] = path;
                }
            }
        }

        return result;
    };

    prototype[DECLARED_PATH] = true;
};

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
    let index = 0;

    while (index < routePath.length) {
        const char = routePath[index];

        switch (char) {
            case "*":
            case ":": {
                PARAM_NAME_REGEX.lastIndex = index + 1;

                const match = PARAM_NAME_REGEX.exec(routePath);

                if (match?.index === index + 1) {
                    parameters.push({ in: "path", name: match[0], required: depth === 0 });
                    index = PARAM_NAME_REGEX.lastIndex;

                    continue;
                }

                break;
            }
            case "{": {
                depth += 1;

                break;
            }
            case "}": {
                depth = Math.max(0, depth - 1);

                break;
            }
            default: {
                break;
            }
        }

        index += 1;
    }

    return parameters;
};

/**
 * Renders an Express 5 path segment (string | RegExp | array) as a display string.
 * @param path The declared path segment
 * @returns The segment rendered as a string
 */
const renderPath = (path: DeclaredPath): string => {
    if (typeof path === "string") {
        return path;
    }

    if (Array.isArray(path)) {
        return path
            .map((entry): string => {
                if (typeof entry === "string") {
                    return entry;
                }

                return entry.toString();
            })
            .join(",");
    }

    return path.toString();
};

const normalizePath = (path: string): string => {
    const collapsed = path.replaceAll(/\/{2,}/gu, "/");

    return collapsed.length > 1 && collapsed.endsWith("/") ? collapsed.slice(0, -1) : collapsed;
};

/**
 * Parses a route layer. Route layers are the leafs of an Express router tree.
 * @param layer The route layer holding the per-method handler stack and metadata
 * @param basePath The accumulated mount path from the parent routers
 * @param baseParameters The accumulated path parameters from the parent routers
 * @returns A RouteMetaData object holding the metadata for a given route
 */
const parseRouteLayer = (layer: Layer & { route: Route }, basePath: string, baseParameters: Parameter[]): RouteMetaData => {
    const { route } = layer;
    const lastRequestHandler = route.stack.at(-1) as Layer;

    const withMetadata = route.stack.filter((element) => (element.handle as Route | undefined)?.metadata !== undefined);

    if (withMetadata.length > 1) {
        throw new Error("Only one metadata middleware is allowed per route");
    }

    const path = normalizePath(`${basePath}/${renderPath(route.path)}`);
    const pathParameters = [...baseParameters, ...typeof route.path === "string" ? extractParameters(route.path) : []];

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
 * Mounted-router prefixes are recovered from the path captured by
 * {@link installRouteCapture} at registration time, since Express 5 no longer
 * retains them on the built layer.
 * @param routes The array of routes to add to
 * @param layer The current layer of the router tree
 * @param basePath The accumulated mount path so far
 * @param baseParameters The accumulated path parameters so far
 */
const traverse = (routes: RouteMetaData[], layer: Layer, basePath: string, baseParameters: Parameter[]): void => {
    if (layer.route) {
        if (layer.route.stack.length === 0) {
            return;
        }

        routes.push(parseRouteLayer(layer as Layer & { route: Route }, basePath, baseParameters));

        return;
    }

    const childStack = (layer.handle as (Router & { stack?: Layer[] }) | undefined)?.stack;

    if (childStack === undefined) {
        return;
    }

    const declaredPath = (layer as Layer & Record<PropertyKey, unknown>)[DECLARED_PATH] as DeclaredPath | undefined;
    const segment = declaredPath === undefined ? "" : renderPath(declaredPath);
    const nextBasePath = normalizePath(`${basePath}/${segment}`);
    const nextParameters
        = typeof declaredPath === "string" ? [...baseParameters, ...extractParameters(declaredPath)] : baseParameters;

    for (const child of childStack) {
        traverse(routes, child, nextBasePath, nextParameters);
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
 * Mounted-router prefixes are reconstructed from {@link installRouteCapture},
 * which must have been installed before the app's routes were registered.
 * @param app The Express app reference. Must be used after all routes have been attached
 * @returns List of routes for this Express app with the meta-data that has been picked up
 */
const expressPathParser = (app: Express): RouteMetaData[] => {
    // eslint-disable-next-line no-underscore-dangle, @typescript-eslint/no-unsafe-assignment -- express's internal _router is the legacy private accessor used as fallback for older versions; both sides are typed as `any` by upstream express types
    const router: Router = (app as Express & { _router?: Router })._router ?? app.router;
    const routes: RouteMetaData[] = [];

    for (const layer of (router as Router & { stack: Layer[] }).stack) {
        traverse(routes, layer, "", []);
    }

    return routes;
};

export { installRouteCapture };

export default expressPathParser;
