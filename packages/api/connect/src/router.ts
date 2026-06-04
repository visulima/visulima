/**
 * Agnostic router class
 * Adapted from lukeed/trouter library:
 * https://github.com/lukeed/trouter/blob/master/index.mjs
 */
import { parse } from "regexparam";

import type { FindResult, FunctionLike, HttpMethod, Nextable, RouteMatch } from "./types";

export type Route<H> = {
    fns: (H | Router<H extends FunctionLike ? H : never>)[];
    isMiddleware: boolean;
    method: HttpMethod | "";
} & (
    | {
        keys: string[] | false;
        pattern: RegExp;
    }
    | { matchAll: true }
);

export class Router<H extends FunctionLike> {
    public static exec<FL extends FunctionLike>(fns: (Nextable<FL> | undefined)[], ...arguments_: Parameters<FL>): Promise<unknown> {
        let index = 0;

        const next = () => {
            index += 1;
            const currentFunction = fns[index];

            if (currentFunction === undefined) {
                return Promise.resolve();
            }

            return currentFunction(...arguments_, next) as Promise<unknown>;
        };

        const first = fns[index];

        if (first === undefined) {
            return Promise.resolve();
        }

        return first(...arguments_, next) as Promise<unknown>;
    }

    private static extractRegExpParams(matches: RegExpExecArray): Record<string, string> {
        const result: Record<string, string> = {};

        if (matches.groups === undefined) {
            return result;
        }

        for (const key of Object.keys(matches.groups)) {
            result[key] = matches.groups[key] as string;
        }

        return result;
    }

    private static extractKeyedParams(matches: RegExpExecArray, keys: string[]): Record<string, string> {
        const result: Record<string, string> = {};

        for (const [index, parameterKey] of keys.entries()) {
            result[parameterKey] = matches[index + 1] as string;
        }

        return result;
    }

    private static isMethodMatch(routeMethod: HttpMethod | "", method: HttpMethod, isHead: boolean): boolean {
        return routeMethod === method || routeMethod === "" || (isHead && routeMethod === "GET");
    }

    private static matchRoute<H>(route: Route<H>, pathname: string): { matched: false } | { matched: true; params: Record<string, string> } {
        if ("matchAll" in route) {
            return { matched: true, params: {} };
        }

        if (route.keys === false) {
            // routes.key is RegExp: https://github.com/lukeed/regexparam/blob/master/src/index.js#L2
            const matches = route.pattern.exec(pathname);

            if (matches === null) {
                return { matched: false };
            }

            return { matched: true, params: Router.extractRegExpParams(matches) };
        }

        if (route.keys.length > 0) {
            const matches = route.pattern.exec(pathname);

            if (matches === null) {
                return { matched: false };
            }

            return { matched: true, params: Router.extractKeyedParams(matches, route.keys) };
        }

        if (route.pattern.test(pathname)) {
            return { matched: true, params: {} };
        }

        return { matched: false };
    }

    private static resolveRouteFns<H extends FunctionLike>(
        routeFns: (Nextable<H> | Router<H>)[],
        method: HttpMethod,
        pathname: string,
        onSubResult: (params: Record<string, string>, middleOnly: boolean) => void,
    ): Nextable<H>[] {
        return routeFns.flatMap((function_): Nextable<H>[] => {
            if (function_ instanceof Router) {
                const { base } = function_;

                let stripPathname = pathname.slice(base.length);

                // fix stripped pathname, not sure why this happens

                if (!stripPathname.startsWith("/")) {
                    stripPathname = `/${stripPathname}`;
                }

                // unicorn rules false-positive: Router.find is not Array.prototype.find
                // eslint-disable-next-line unicorn/no-array-callback-reference, unicorn/no-array-method-this-argument
                const result = function_.find(method, stripPathname);

                onSubResult(result.params, result.middleOnly);

                return result.fns;
            }

            return [function_];
        });
    }

    public constructor(
        public base = "/",
        public routes: Route<Nextable<H>>[] = [],
    ) {}

    public add(method: HttpMethod | "", route: Nextable<H> | RouteMatch, ...fns: Nextable<H>[]): this {
        let resolvedRoute: RouteMatch;

        if (typeof route === "function") {
            fns.unshift(route);
            resolvedRoute = "";
        } else {
            resolvedRoute = route;
        }

        if (resolvedRoute === "") {
            this.routes.push({
                fns,
                isMiddleware: false,
                matchAll: true,
                method,
            });
        } else {
            const { keys, pattern } = parse(resolvedRoute);

            this.routes.push({
                fns,
                isMiddleware: false,
                keys,
                method,
                pattern,
            });
        }

        return this;
    }

    public clone(base?: string): Router<H> {
        return new Router<H>(base, [...this.routes]);
    }

    public find(method: HttpMethod, pathname: string): FindResult<H> {
        let middleOnly = true;

        const fns: Nextable<H>[] = [];
        const parameters: Record<string, string> = {};
        const isHead = method === "HEAD";

        for (let routeIndex = 0; routeIndex < this.routes.length; routeIndex += 1) {
            const route = this.routes[routeIndex] as Route<Nextable<H>>;

            if (!Router.isMethodMatch(route.method, method, isHead)) {
                continue;
            }

            const matchResult = Router.matchRoute(route, pathname);

            if (!matchResult.matched) {
                continue;
            }

            Object.assign(parameters, matchResult.params);

            fns.push(
                ...Router.resolveRouteFns(route.fns, method, pathname, (subParams, subMiddleOnly) => {
                    Object.assign(parameters, subParams);

                    if (!subMiddleOnly) {
                        middleOnly = false;
                    }
                }),
            );

            if (!route.isMiddleware) {
                middleOnly = false;
            }
        }

        return { fns, middleOnly, params: parameters };
    }

    public use(base: Nextable<H> | RouteMatch | Router<H>, ...fns: (Nextable<H> | Router<H>)[]): this {
        let resolvedBase: RouteMatch;

        if (typeof base === "function" || base instanceof Router) {
            fns.unshift(base);
            resolvedBase = "/";
        } else {
            resolvedBase = base;
        }

        // mount subrouter
        const resolvedFns = fns.map((function_): Nextable<H> | Router<H> => {
            if (function_ instanceof Router) {
                if (typeof resolvedBase === "string") {
                    return function_.clone(resolvedBase);
                }

                throw new Error("Mounting a router to RegExp base is not supported");
            }

            return function_;
        });

        const { keys, pattern } = parse(resolvedBase, true);

        this.routes.push({
            fns: resolvedFns,
            isMiddleware: true,
            keys,
            method: "",
            pattern,
        });

        return this;
    }
}
