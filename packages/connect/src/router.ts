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
    public static async exec<FL extends FunctionLike>(fns: (Nextable<FL> | undefined)[], ...arguments_: Parameters<FL>): Promise<any> {
        let index = 0;

        const next = () => {
            // eslint-disable-next-line no-plusplus,@typescript-eslint/naming-convention,no-underscore-dangle
            const function_ = fns[++index];

            if (function_ === undefined) {
                return Promise.resolve();
            }

            return function_(...arguments_, next);
        };

        // eslint-disable-next-line security/detect-object-injection
        return (fns[index] as FunctionLike)(...arguments_, next);
    }

    public constructor(
        public base = "/",
        public routes: Route<Nextable<H>>[] = [],
    ) {}

    public add(method: HttpMethod | "", route: Nextable<H> | RouteMatch, ...fns: Nextable<H>[]): this {
        if (typeof route === "function") {
            fns.unshift(route);
            // eslint-disable-next-line no-param-reassign
            route = "";
        }

        if (route === "") {
            this.routes.push({
                fns,
                isMiddleware: false,
                matchAll: true,
                method,
            });
        } else {
            const { keys, pattern } = parse(route);

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

    // eslint-disable-next-line sonarjs/cognitive-complexity
    public find(method: HttpMethod, pathname: string): FindResult<H> {
        let middleOnly = true;

        const fns: Nextable<H>[] = [];
        const parameters: Record<string, string> = {};
        const isHead = method === "HEAD";

        // eslint-disable-next-line no-loops/no-loops
        for (const route of this.routes) {
            if (
                route.method !== method
                // matches any method
                && route.method !== ""
                // The HEAD method requests that the target resource transfer a representation of its state, as for a GET request...
                && !(isHead && route.method === "GET")
            ) {
                continue;
            }

            let matched = false;

            if ("matchAll" in route) {
                matched = true;
            } else if (route.keys === false) {
                // routes.key is RegExp: https://github.com/lukeed/regexparam/blob/master/src/index.js#L2
                const matches = route.pattern.exec(pathname);

                if (matches === null) {
                    continue;
                }

                // eslint-disable-next-line no-void
                if (matches.groups !== void 0) {
                    Object.keys(matches.groups).forEach((key) => {
                        // @ts-expect-error @TODO: fix this
                        // eslint-disable-next-line security/detect-object-injection
                        parameters[key] = matches.groups[key] as string;
                    });
                }

                matched = true;
            } else if (route.keys.length > 0) {
                const matches = route.pattern.exec(pathname);

                if (matches === null) {
                    continue;
                }

                // eslint-disable-next-line no-loops/no-loops
                for (let index = 0; index < route.keys.length;) {
                    // eslint-disable-next-line security/detect-object-injection
                    const parameterKey = route.keys[index];

                    // @ts-expect-error @TODO: fix this
                    // eslint-disable-next-line no-plusplus,security/detect-object-injection
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

                if (!route.isMiddleware) {
                    middleOnly = false;
                }
            }
        }

        return { fns, middleOnly, params: parameters };
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
                if (typeof base === "string") {
                    return function_.clone(base);
                }

                throw new Error("Mounting a router to RegExp base is not supported");
            }

            return function_;
        });

        const { keys, pattern } = parse(base, true);

        this.routes.push({
            fns,
            isMiddleware: true,
            keys,
            method: "",
            pattern,
        });

        return this;
    }
}
