/**
 * Agnostic router class
 * Adapted from lukeed/trouter library:
 * https://github.com/lukeed/trouter/blob/master/index.mjs
 */
import { parse } from "regexparam";

import type {
    FindResult, FunctionLike, HttpMethod, Nextable, RouteMatch,
} from "./types";

export type Route<H> = {
    method: HttpMethod | "";
    fns: (H | Router<H extends FunctionLike ? H : never>)[];
    isMiddleware: boolean;
} & (
    | {
        keys: string[] | false;
        pattern: RegExp;
    }
    | { matchAll: true }
);

export class Router<H extends FunctionLike> {
    public constructor(public base: string = "/", public routes: Route<Nextable<H>>[] = []) {}

    public add(method: HttpMethod | "", route: Nextable<H> | RouteMatch, ...fns: Nextable<H>[]): this {
        if (typeof route === "function") {
            fns.unshift(route);
            // eslint-disable-next-line no-param-reassign
            route = "";
        }

        if (route === "") {
            this.routes.push({
                matchAll: true,
                method,
                fns,
                isMiddleware: false,
            });
        } else {
            const { keys, pattern } = parse(route);

            this.routes.push({
                keys,
                pattern,
                method,
                fns,
                isMiddleware: false,
            });
        }

        return this;
    }

    public use(base: Nextable<H> | RouteMatch | Router<H>, ...fns: (Nextable<H> | Router<H>)[]): this {
        if (typeof base === "function" || base instanceof Router) {
            fns.unshift(base);
            // eslint-disable-next-line no-param-reassign
            base = "/";
        }
        // mount subrouter
        // eslint-disable-next-line no-param-reassign
        fns = fns.map((function_) => {
            if (function_ instanceof Router) {
                if (typeof base === "string") return function_.clone(base);
                throw new Error("Mounting a router to RegExp base is not supported");
            }
            return function_;
        });

        const { keys, pattern } = parse(base, true);

        this.routes.push({
            keys,
            pattern,
            method: "",
            fns,
            isMiddleware: true,
        });

        return this;
    }

    public clone(base?: string): Router<H> {
        return new Router<H>(base, [...this.routes]);
    }

    public static async exec<H extends FunctionLike>(fns: Nextable<H>[], ...arguments_: Parameters<H>): Promise<unknown> {
        let index = 0;

        // eslint-disable-next-line no-plusplus
        const next = () => (fns[++index] as FunctionLike)(...arguments_, next);

        return (fns[index] as FunctionLike)(...arguments_, next);
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    public find(method: HttpMethod, pathname: string): FindResult<H> {
        let middleOnly = true;

        const fns: Nextable<H>[] = [];
        const parameters: Record<string, string> = {};
        const isHead = method === "HEAD";

        // eslint-disable-next-line sonarjs/cognitive-complexity
        Object.values(this.routes).forEach((route) => {
            if (
                route.method !== method
                // matches any method
                && route.method !== ""
                // The HEAD method requests that the target resource transfer a representation of its state, as for a GET request...
                && !(isHead && route.method === "GET")
            ) {
                return;
            }

            let matched = false;

            if ("matchAll" in route) {
                matched = true;
            } else if (route.keys === false) {
                // routes.key is RegExp: https://github.com/lukeed/regexparam/blob/master/src/index.js#L2
                const matches = route.pattern.exec(pathname);

                if (matches === null) {
                    return;
                }

                // eslint-disable-next-line no-void
                if (matches.groups !== void 0) {
                    Object.keys(matches.groups).forEach((key) => {
                        // @ts-expect-error @TODO: fix this
                        parameters[key] = matches.groups[key] as string;
                    });
                }

                matched = true;
            } else if (route.keys.length > 0) {
                const matches = route.pattern.exec(pathname);

                if (matches === null) {
                    return;
                }

                for (let index = 0; index < route.keys.length;) {
                    const parameterKey = route.keys[index];

                    // @ts-expect-error @TODO: fix this
                    // eslint-disable-next-line no-plusplus
                    parameters[parameterKey] = matches[++index];
                }

                matched = true;
            } else if (route.pattern.test(pathname)) {
                matched = true;
            } // else not a match

            if (matched) {
                fns.push(
                    ...route.fns.flatMap((function_) => {
                        if (function_ instanceof Router) {
                            const { base } = function_;

                            let stripPathname = pathname.slice(base.length);

                            // fix stripped pathname, not sure why this happens
                            // eslint-disable-next-line eqeqeq
                            if (!stripPathname.startsWith("/")) {
                                stripPathname = `/${stripPathname}`;
                            }

                            // eslint-disable-next-line unicorn/no-array-callback-reference, unicorn/no-array-method-this-argument
                            const result = function_.find(method, stripPathname);

                            if (!result.middleOnly) {
                                middleOnly = false;
                            }

                            // merge params
                            Object.assign(parameters, result.params);

                            return result.fns;
                        }

                        return function_;
                    }),
                );
                if (!route.isMiddleware) middleOnly = false;
            }
        });

        return { fns, params: parameters, middleOnly };
    }
}
