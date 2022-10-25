/**
 * Adapted from lukeed/trouter library:
 * https://github.com/lukeed/trouter/blob/master/test/index
 */
import { describe, expect, it } from "vitest";

import type { HttpMethod, Nextable, Route } from "../src";
import { Router } from "../src";

type AnyHandler = (...arguments_: any[]) => any;

const noop: AnyHandler = async () => {
    /** noop */
};

const testRoute = (rr: Route<any>, { route, ...match }: Partial<Route<any> & { route: string }>) => {
    // @ts-expect-error: pattern does not always exist
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { pattern, ...r } = rr;

    expect(r, "~> has same route").toStrictEqual(match);

    if (route) {
        const testContext = new Router();

        testContext.routes = [rr];

        // eslint-disable-next-line unicorn/no-array-callback-reference, unicorn/no-array-method-this-argument
        expect(testContext.find(match.method as HttpMethod, route).fns.length > 0, "~~> pattern satisfies route").toBeTruthy();
    }
};

describe("Router", async () => {
    it("internals", async () => {
        const context = new Router<AnyHandler>();

        expect(context).instanceOf(Router, "creates new `Router` instance");
        expect(Array.isArray(context.routes), "~> has `routes` key (Array)").toBeTruthy();
        expect(context.add, "~> has `add` method").toBeTypeOf("function");
        expect(context.find, "~> has `find` method").toBeTypeOf("function");
    });

    it("add()", async () => {
        const context = new Router<AnyHandler>();

        // eslint-disable-next-line radar/no-duplicate-string
        const out = context.add("GET", "/foo/:hello", noop);

        expect(out, "returns the Router instance (chainable)").toStrictEqual(context);
        expect(context.routes.length, 'added "GET /foo/:hello" route successfully').toStrictEqual(1);

        testRoute(context.routes[0] as Route<any>, {
            fns: [noop],
            method: "GET",
            isMiddleware: false,
            keys: ["hello"],
            route: "/foo/bar",
        });

        context.add("POST", "bar", noop);

        expect(context.routes.length, 'added "POST /bar" route successfully (via alias)').toStrictEqual(2);

        testRoute(context.routes[1] as Route<any>, {
            fns: [noop],
            keys: [],
            method: "POST",
            isMiddleware: false,
            route: "/bar",
        });

        context.add("PUT", /^\/foo\/(?<hello>\w+)\/?$/, noop);

        expect(context.routes.length, 'added "PUT /^[/]foo[/](?<hello>\\w+)[/]?$/" route successfully').toStrictEqual(3);

        testRoute(context.routes[2] as Route<any>, {
            fns: [noop],
            keys: false,
            method: "PUT",
            isMiddleware: false,
        });
    });

    it("add() - multiple", async () => {
        const context = new Router<AnyHandler>();

        context.add("PATCH", "/foo/:hello", noop, noop);

        expect(context.routes.length, 'added "SEARCH /foo/:hello" route successfully').toStrictEqual(1);

        testRoute(context.routes[0] as Route<any>, {
            fns: [noop, noop],
            keys: ["hello"],
            method: "PATCH",
            route: "/foo/howdy",
            isMiddleware: false,
        });

        context.add("PUT", "/bar", noop, noop, noop);

        expect(context.routes.length, 'added "PUT /bar" route successfully (via alias)').toStrictEqual(2);

        testRoute(context.routes[1] as Route<any>, {
            fns: [noop, noop, noop],
            keys: [],
            method: "PUT",
            route: "/bar",
            isMiddleware: false,
        });
    });

    it("use()", async () => {
        const context = new Router<AnyHandler>();

        const out = context.use("/foo/:hello", noop);

        expect(out, "returns the Router instance (chainable)").toStrictEqual(context);
        expect(context.routes.length, 'added "ANY /foo/:hello" route successfully').toStrictEqual(1);

        testRoute(context.routes[0] as Route<any>, {
            method: "",
            keys: ["hello"],
            route: "/foo/bar",
            fns: [noop],
            isMiddleware: true,
        });

        context.use("/", noop, noop, noop);

        expect(context.routes.length, 'added "ANY /" routes successfully').toStrictEqual(2);

        testRoute(context.routes[1] as Route<any>, {
            keys: [],
            method: "",
            route: "/",
            fns: [noop, noop, noop],
            isMiddleware: true,
        });

        context.use("/foo/:world?", noop, noop, noop, noop);

        expect(context.routes.length, 'added "ANY /foo/:world?" routes successfully').toStrictEqual(3);

        testRoute(context.routes[2] as Route<any>, {
            keys: ["world"],
            method: "",
            route: "/foo/hello",
            fns: [noop, noop, noop, noop],
            isMiddleware: true,
        });
    });

    it("all()", async () => {
        // eslint-disable-next-line no-plusplus,@typescript-eslint/naming-convention,unicorn/consistent-function-scoping,no-underscore-dangle
        const function_: AnyHandler = (request: any) => request.chain++;
        const context = new Router<AnyHandler>().add("", "/greet/:name", function_);

        expect(context.routes.length, 'added "ALL /greet/:name" route').toStrictEqual(1);

        testRoute(context.routes[0] as Route<any>, {
            method: "", // ~> "ALL"
            keys: ["name"],
            route: "/greet/you",
            fns: [function_],
            isMiddleware: false,
        });

        const foo = context.find("HEAD", "/greet/Bob") as any;

        // eslint-disable-next-line radar/no-duplicate-string
        expect(foo.params.name, '~> "params.name" is expected').toStrictEqual("Bob");
        // eslint-disable-next-line radar/no-duplicate-string
        expect(foo.fns.length, '~~> "handlers" has 1 item').toStrictEqual(1);

        foo.chain = 0;
        // eslint-disable-next-line @typescript-eslint/no-shadow
        foo.fns.forEach((function__: (argument0: any) => any) => function__(foo));

        // eslint-disable-next-line radar/no-duplicate-string
        expect(foo.chain, "~~> handler executed successfully").toStrictEqual(1);

        const bar = context.find("GET", "/greet/Judy") as any;

        expect(bar.params.name, '~> "params.name" is expected').toStrictEqual("Judy");
        expect(bar.fns.length, '~~> "handlers" has 1 item').toStrictEqual(1);

        bar.chain = 0;
        // eslint-disable-next-line @typescript-eslint/no-shadow
        bar.fns.forEach((function__: (argument0: any) => any) => function__(bar));

        expect(bar.chain, "~~> handler executed successfully").toStrictEqual(1);

        const function2: AnyHandler = (request: any) => {
            // eslint-disable-next-line no-plusplus
            expect(request.chain++, "~> ran new HEAD after ALL handler").toStrictEqual(1);
            expect(request.params.name, '~~> still see "params.name" value').toStrictEqual("Rick");
            expect(request.params.person, '~~> receives "params.person" value').toStrictEqual("Rick");
        };
        context.add("HEAD", "/greet/:person", function2);

        expect(context.routes.length, 'added "HEAD /greet/:name" route').toStrictEqual(2);

        testRoute(context.routes[1] as Route<any>, {
            method: "HEAD", // ~> "ALL"
            keys: ["person"],
            route: "/greet/you",
            fns: [function2],
            isMiddleware: false,
        });

        const baz = context.find("HEAD", "/greet/Rick") as any;

        expect(baz.params.name, '~> "params.name" is expected').toStrictEqual("Rick");
        expect(baz.fns.length, '~~> "handlers" has 2 items').toStrictEqual(2);

        baz.chain = 0;
        // eslint-disable-next-line @typescript-eslint/no-shadow
        baz.fns.forEach((function__: (argument0: any) => any) => function__(baz));

        expect(baz.chain, "~~> handlers executed successfully").toStrictEqual(2);

        const bat = context.find("POST", "/greet/Morty") as any;

        expect(bat.params.name, '~> "params.name" is expected').toStrictEqual("Morty");
        expect(bat.fns.length, '~~> "handlers" has 1 item').toStrictEqual(1);

        bat.chain = 0;
        // eslint-disable-next-line @typescript-eslint/no-shadow
        bat.fns.forEach((function__: (argument0: any) => any) => function__(bat));

        expect(bat.chain, "~~> handler executed successfully").toStrictEqual(1);
    });

    it("find()", async () => {
        expect.assertions(9);

        const context = new Router<AnyHandler>();

        context.add(
            "GET",
            "/foo/:title",
            ((request) => {
                // eslint-disable-next-line no-plusplus
                expect(request.chain++, '~> 1st "GET /foo/:title" ran first').toStrictEqual(1);
                expect(request.params.title, '~> "params.title" is expected').toStrictEqual("bar");
            }) as AnyHandler,
            ((request) => {
                // eslint-disable-next-line no-plusplus
                expect(request.chain++, '~> 2nd "GET /foo/:title" ran second').toStrictEqual(2);
            }) as AnyHandler,
        );

        const out = context.find("GET", "/foo/bar") as any;

        // eslint-disable-next-line radar/no-duplicate-string
        expect(out, "returns an object").toBeTypeOf("object");
        expect(out.params, '~> has "params" key (object)').toBeTypeOf("object");
        expect(out.params.title, '~~> "params.title" value is correct').toStrictEqual("bar");

        expect(Array.isArray(out.fns), '~> has "handlers" key (array)').toBeTruthy();
        expect(out.fns.length, "~~> saved both handlers").toStrictEqual(2);

        out.chain = 1;
        out.fns.forEach((function__: (argument0: any) => any) => function__(out));

        expect(out.chain, "~> executes the handler group sequentially").toStrictEqual(3);
    });

    it("find() - no match", async () => {
        const context = new Router<AnyHandler>();
        const out = context.find("DELETE", "/nothing");

        expect(out, "returns an object").toBeTypeOf("object");
        expect(Object.keys(out.params).length, '~> "params" is empty').toStrictEqual(0);
        expect(out.fns.length, '~> "handlers" is empty').toStrictEqual(0);
    });

    it("find() - multiple", async () => {
        expect.assertions(18);

        let isRoot = true;

        const context = new Router<AnyHandler>()
            .use("/foo", ((request) => {
                expect(true, '~> ran use("/foo")" route').toBeTruthy(); // x2

                if (!isRoot) {
                    expect(request.params.title, '~~> saw "param.title" value').toStrictEqual("bar");
                }

                // eslint-disable-next-line no-plusplus
                expect(request.chain++, "~~> ran 1st").toStrictEqual(0);
            }) as AnyHandler)
            .add("GET", "/foo", ((request) => {
                expect(true, '~> ran "GET /foo" route').toBeTruthy();

                // eslint-disable-next-line no-plusplus,radar/no-duplicate-string
                expect(request.chain++, "~~> ran 2nd").toStrictEqual(1);
            }) as AnyHandler)
            .add("GET", "/foo/:title?", ((request) => {
                expect(true, '~> ran "GET /foo/:title?" route').toBeTruthy(); // x2

                if (!isRoot) {
                    // eslint-disable-next-line radar/no-duplicate-string
                    expect(request.params.title, '~~> saw "params.title" value').toStrictEqual("bar");
                }

                if (isRoot) {
                    // eslint-disable-next-line radar/no-duplicate-string,no-plusplus
                    expect(request.chain++, "~~> ran 3rd").toStrictEqual(2);
                } else {
                    // eslint-disable-next-line no-plusplus
                    expect(request.chain++, "~~> ran 2nd").toStrictEqual(1);
                }
            }) as AnyHandler)
            .add("GET", "/foo/*", ((request) => {
                expect(true, '~> ran "GET /foo/*" route').toBeTruthy();

                expect(request.params.wild, '~~> saw "params.wild" value').toStrictEqual("bar");
                expect(request.params.title, '~~> saw "params.title" value').toStrictEqual("bar");
                // eslint-disable-next-line no-plusplus
                expect(request.chain++, "~~> ran 3rd").toStrictEqual(2);
            }) as AnyHandler);

        const foo = context.find("GET", "/foo") as any;
        // eslint-disable-next-line radar/no-duplicate-string
        expect(foo.fns.length, "found 3 handlers").toStrictEqual(3);

        foo.chain = 0;
        foo.fns.forEach((function__: (argument0: any) => any) => function__(foo));

        isRoot = false;
        const bar = context.find("GET", "/foo/bar") as any;
        expect(bar.fns.length, "found 3 handlers").toStrictEqual(3);

        bar.chain = 0;
        bar.fns.forEach((function__: (argument0: any) => any) => function__(bar));
    });

    it("find() - HEAD", async () => {
        expect.assertions(5);

        const context = new Router<AnyHandler>()
            .add("", "/foo", ((request) => {
                // eslint-disable-next-line no-plusplus
                expect(request.chain++, '~> found "ALL /foo" route').toStrictEqual(0);
            }) as AnyHandler)
            .add("HEAD", "/foo", ((request) => {
                // eslint-disable-next-line no-plusplus
                expect(request.chain++, '~> found "HEAD /foo" route').toStrictEqual(1);
            }) as AnyHandler)
            .add("GET", "/foo", ((request) => {
                // eslint-disable-next-line no-plusplus
                expect(request.chain++, '~> also found "GET /foo" route').toStrictEqual(2);
            }) as AnyHandler)
            .add("GET", "/", async () => {
                expect(true, "should not run").toBeTruthy();
            });

        const out = context.find("HEAD", "/foo") as any;
        expect(out.fns.length, "found 3 handlers").toStrictEqual(3);

        out.chain = 0;
        out.fns.forEach((function__: (argument0: any) => any) => function__(out));
        expect(out.chain, "ran handlers sequentially").toStrictEqual(3);
    });

    it("find() - order", async () => {
        expect.assertions(5);
        const context = new Router<AnyHandler>()
            .add("", "/foo", ((request) => {
                // eslint-disable-next-line no-plusplus
                expect(request.chain++, '~> ran "ALL /foo" 1st').toStrictEqual(0);
            }) as AnyHandler)
            .add("GET", "/foo", ((request) => {
                // eslint-disable-next-line no-plusplus
                expect(request.chain++, '~> ran "GET /foo" 2nd').toStrictEqual(1);
            }) as AnyHandler)
            .add("HEAD", "/foo", ((request) => {
                // eslint-disable-next-line no-plusplus
                expect(request.chain++, '~> ran "HEAD /foo" 3rd').toStrictEqual(2);
            }) as AnyHandler)
            .add("GET", "/", (() => {
                expect(true, "should not run").toBeTruthy();
            }) as AnyHandler);

        const out = context.find("HEAD", "/foo") as any;
        expect(out.fns.length, "found 3 handlers").toStrictEqual(3);

        out.chain = 0;
        out.fns.forEach((function__: (argument0: any) => any) => function__(out));
        expect(out.chain, "ran handlers sequentially").toStrictEqual(3);
    });

    it("find() w/ all()", async () => {
        // eslint-disable-next-line @typescript-eslint/no-shadow,unicorn/consistent-function-scoping
        const noop = () => {
            /** noop */
        };
        // eslint-disable-next-line unicorn/consistent-function-scoping
        const find = (x: Router<AnyHandler>, y: string) => x.find("GET", y);

        const context1 = new Router<AnyHandler>().add("", "api", noop);
        const context2 = new Router<AnyHandler>().add("", "api/:version", noop);
        const context3 = new Router<AnyHandler>().add("", "api/:version?", noop);
        const context4 = new Router<AnyHandler>().add("", "movies/:title.mp4", noop);

        // eslint-disable-next-line radar/no-duplicate-string
        expect(find(context1, "/api").fns.length, "~> exact match").toStrictEqual(1);
        expect(find(context1, "/api/foo").fns.length, '~> does not match "/api/foo" - too long').toStrictEqual(0);

        expect(find(context2, "/api").fns.length, '~> does not match "/api" only').toStrictEqual(0);

        // eslint-disable-next-line radar/no-duplicate-string
        const foo1 = find(context2, "/api/v1");
        // eslint-disable-next-line radar/no-duplicate-string
        expect(foo1.fns.length, '~> does match "/api/v1" directly').toStrictEqual(1);
        // eslint-disable-next-line radar/no-duplicate-string
        expect(foo1.params.version, '~> parses the "version" correctly').toStrictEqual("v1");

        // eslint-disable-next-line radar/no-duplicate-string
        const foo2 = find(context2, "/api/v1/users");
        expect(foo2.fns.length, '~> does not match "/api/v1/users" - too long').toStrictEqual(0);
        expect(foo2.params.version, '~> cannot parse the "version" parameter (not a match)').toBeUndefined();

        expect(find(context3, "/api").fns.length, '~> does match "/api" because optional').toStrictEqual(1);

        const bar1 = find(context3, "/api/v1");
        expect(bar1.fns.length, '~> does match "/api/v1" directly').toStrictEqual(1);
        expect(bar1.params.version, '~> parses the "version" correctly').toStrictEqual("v1");

        const bar2 = find(context3, "/api/v1/users");
        expect(bar2.fns.length, '~> does match "/api/v1/users" - too long').toStrictEqual(0);
        expect(bar2.params.version, '~> cannot parse the "version" parameter (not a match)').toBeUndefined();

        expect(find(context4, "/movies").fns.length, '~> does not match "/movies" directly').toStrictEqual(0);
        expect(find(context4, "/movies/narnia").fns.length, '~> does not match "/movies/narnia" directly').toStrictEqual(0);

        const baz1 = find(context4, "/movies/narnia.mp4");
        expect(baz1.fns.length, '~> does match "/movies/narnia.mp4" directly').toStrictEqual(1);
        // eslint-disable-next-line radar/no-duplicate-string
        expect(baz1.params.title, '~> parses the "title" correctly').toStrictEqual("narnia");

        const baz2 = find(context4, "/movies/narnia.mp4/cast");
        expect(baz2.fns.length, '~> does match "/movies/narnia.mp4/cast" - too long').toStrictEqual(0);
        expect(baz2.params.title, '~> cannot parse the "title" parameter (not a match)').toBeUndefined();
    });

    it("find() w/ use()", async () => {
        // eslint-disable-next-line unicorn/consistent-function-scoping,@typescript-eslint/no-shadow
        const noop = () => {
            /** noop */
        };
        // eslint-disable-next-line unicorn/consistent-function-scoping
        const find = (x: Router<AnyHandler>, y: string) => x.find("GET", y);

        const context1 = new Router<AnyHandler>().use("api", noop);
        const context2 = new Router<AnyHandler>().use("api/:version", noop);
        const context3 = new Router<AnyHandler>().use("api/:version?", noop);
        const context4 = new Router<AnyHandler>().use("movies/:title.mp4", noop);

        expect(find(context1, "/api").fns.length, "~> exact match").toStrictEqual(1);
        expect(find(context1, "/api/foo").fns.length, "~> loose match").toStrictEqual(1);

        expect(find(context2, "/api").fns.length, '~> does not match "/api" only').toStrictEqual(0);

        const foo1 = find(context2, "/api/v1");
        expect(foo1.fns.length, '~> does match "/api/v1" directly').toStrictEqual(1);
        expect(foo1.params.version, '~> parses the "version" correctly').toStrictEqual("v1");

        const foo2 = find(context2, "/api/v1/users");
        expect(foo2.fns.length, '~> does match "/api/v1/users" loosely').toStrictEqual(1);
        expect(foo2.params.version, '~> parses the "version" correctly').toStrictEqual("v1");

        expect(find(context3, "/api").fns.length, '~> does match "/api" because optional').toStrictEqual(1);

        const bar1 = find(context3, "/api/v1");
        expect(bar1.fns.length, '~> does match "/api/v1" directly').toStrictEqual(1);
        expect(bar1.params.version, '~> parses the "version" correctly').toStrictEqual("v1");

        const bar2 = find(context3, "/api/v1/users");
        expect(bar2.fns.length, '~> does match "/api/v1/users" loosely').toStrictEqual(1);
        expect(bar2.params.version, '~> parses the "version" correctly').toStrictEqual("v1");

        expect(find(context4, "/movies").fns.length, '~> does not match "/movies" directly').toStrictEqual(0);
        expect(find(context4, "/movies/narnia").fns.length, '~> does not match "/movies/narnia" directly').toStrictEqual(0);

        const baz1 = find(context4, "/movies/narnia.mp4");
        expect(baz1.fns.length, '~> does match "/movies/narnia.mp4" directly').toStrictEqual(1);
        expect(baz1.params.title, '~> parses the "title" correctly').toStrictEqual("narnia");

        const baz2 = find(context4, "/movies/narnia.mp4/cast");
        expect(baz2.fns.length, '~> does match "/movies/narnia.mp4/cast" loosely').toStrictEqual(1);
        expect(baz2.params.title, '~> parses the "title" correctly').toStrictEqual("narnia");
    });

    it("find() - regex w/ named groups", async () => {
        expect.assertions(9);
        const context = new Router<AnyHandler>();

        context.add(
            "GET",
            /^\/foo\/(?<title>\w+)\/?$/,
            ((request) => {
                // eslint-disable-next-line no-plusplus
                expect(request.chain++, '~> 1st "GET /^[/]foo[/](?<title>\\w+)[/]?$/" ran first').toStrictEqual(1);
                expect(request.params.title, '~> "params.title" is expected').toStrictEqual("bar");
            }) as AnyHandler,
            ((request) => {
                // eslint-disable-next-line no-plusplus
                expect(request.chain++, '~> 2nd "GET /^[/]foo[/](?<title>\\w+)[/]?$/" ran second').toStrictEqual(2);
            }) as AnyHandler,
        );

        const out = context.find("GET", "/foo/bar") as any;

        expect(out, "returns an object").toBeTypeOf("object");
        expect(out.params, '~> has "params" key (object)').toBeTypeOf("object");
        expect(out.params.title, '~~> "params.title" value is correct').toStrictEqual("bar");

        expect(Array.isArray(out.fns), '~> has "handlers" key (array)').toBeTruthy();
        expect(out.fns.length, "~~> saved both handlers").toStrictEqual(2);

        out.chain = 1;
        out.fns.forEach((function__: (argument0: any) => any) => function__(out));
        expect(out.chain, "~> executes the handler group sequentially").toStrictEqual(3);
    });

    it("find() - multiple regex w/ named groups", async () => {
        expect.assertions(18);

        let isRoot = true;
        const context = new Router<AnyHandler>()
            .use("/foo", ((request) => {
                expect(true, '~> ran use("/foo")" route').toBeTruthy(); // x2

                if (!isRoot) {
                    expect(request.params.title, '~~> saw "params.title" value').toStrictEqual("bar");
                }

                // eslint-disable-next-line no-plusplus
                expect(request.chain++, "~~> ran 1st").toStrictEqual(0);
            }) as AnyHandler)
            // eslint-disable-next-line radar/no-identical-functions
            .add("GET", "/foo", ((request) => {
                expect(true, '~> ran "GET /foo" route').toBeTruthy();
                // eslint-disable-next-line no-plusplus
                expect(request.chain++, "~~> ran 2nd").toStrictEqual(1);
            }) as AnyHandler)
            .add("GET", /^\/foo(?:\/(?<title>\w+))?\/?$/, ((request) => {
                expect(true, '~> ran "GET /^[/]foo[/](?<title>\\w+)?[/]?$/" route').toBeTruthy(); // x2

                if (!isRoot) {
                    expect(request.params.title, '~~> saw "params.title" value').toStrictEqual("bar");
                }

                if (isRoot) {
                    // eslint-disable-next-line no-plusplus
                    expect(request.chain++, "~~> ran 3rd").toStrictEqual(2);
                } else {
                    // eslint-disable-next-line no-plusplus
                    expect(request.chain++, "~~> ran 2nd").toStrictEqual(1);
                }
            }) as AnyHandler)
            .add("GET", /^\/foo\/(?<wild>.*)$/, ((request) => {
                expect(true, '~> ran "GET /^[/]foo[/](?<wild>.*)$/" route').toBeTruthy();

                expect(request.params.wild, '~~> saw "params.wild" value').toStrictEqual("bar");
                expect(request.params.title, '~~> saw "params.title" value').toStrictEqual("bar");
                // eslint-disable-next-line no-plusplus
                expect(request.chain++, "~~> ran 3rd").toStrictEqual(2);
            }) as AnyHandler);

        const foo = context.find("GET", "/foo") as any;

        expect(foo.fns.length, "found 3 handlers").toStrictEqual(3);

        foo.chain = 0;
        foo.fns.forEach((function__: (argument0: any) => any) => function__(foo));

        isRoot = false;
        const bar = context.find("GET", "/foo/bar") as any;
        expect(bar.fns.length, "found 3 handlers").toStrictEqual(3);

        bar.chain = 0;
        bar.fns.forEach((function__: (argument0: any) => any) => function__(bar));
    });

    /**
     * Additional handling tailored to connect
     */

    it("constructor() with base", async () => {
        expect(new Router().base, "assign base to / by default").toStrictEqual("/");
        expect(new Router("/foo").base, "assign base to provided value").toStrictEqual("/foo");
    });

    it("constructor() with routes", async () => {
        expect(new Router().routes, "assign to empty route array by default").toStrictEqual([]);

        const routes: any[] | undefined = [];

        expect(new Router(undefined, routes).routes, "assign routes if provided").toStrictEqual(routes);
    });

    it("clone()", async () => {
        const context = new Router();
        context.routes = [noop, noop] as any[];

        expect(context.clone()).instanceOf(Router, "is a Router instance");
        expect(context.clone("/foo").base, "cloned with custom base").toStrictEqual("/foo");

        const contextRoutes = new Router("", [noop as any]);

        expect(contextRoutes.clone().routes, "routes are deep cloned").toStrictEqual(contextRoutes.routes);
    });

    it("use() - default to / with no base", async () => {
        expect.assertions(2);

        const context = new Router();
        // eslint-disable-next-line @typescript-eslint/naming-convention,unicorn/consistent-function-scoping,no-underscore-dangle
        const function_ = () => {};

        context.use(function_);

        testRoute(context.routes[0] as Route<any>, {
            keys: [],
            fns: [function_],
            isMiddleware: true,
            method: "",
            // eslint-disable-next-line radar/no-duplicate-string
            route: "/some/wacky/route",
        });
    });

    it("use() - mount router", async () => {
        const subContext = new Router();

        testRoute(new Router().use("/foo", subContext, noop).routes[0] as Route<any>, {
            keys: [],
            fns: [subContext.clone("/foo"), noop],
            isMiddleware: true,
            method: "",
        });

        testRoute(new Router().use("/", subContext, noop).routes[0] as Route<any>, {
            keys: [],
            fns: [subContext, noop],
            isMiddleware: true,
            method: "",
        });

        // nested mount
        const subContext2 = new Router().use("/bar", subContext);

        testRoute(new Router().use("/foo", subContext2, noop).routes[0] as Route<any>, {
            keys: [],
            fns: [subContext2.clone("/foo"), noop],
            isMiddleware: true,
            method: "",
        });

        testRoute(subContext2.routes[0] as Route<any>, {
            keys: [],
            fns: [subContext.clone("/bar")],
            isMiddleware: true,
            method: "",
        });

        // unsupported
        expect(() => new Router().use(/\/not\/supported/, subContext), "throws unsupported message").toThrowError(
            new Error("Mounting a router to RegExp base is not supported"),
        );
    });

    it("find() - w/ router with correct match", async () => {
        // eslint-disable-next-line unicorn/consistent-function-scoping
        const noop1 = async () => {};
        // eslint-disable-next-line unicorn/consistent-function-scoping
        const noop2 = async () => {};
        // eslint-disable-next-line unicorn/consistent-function-scoping
        const noop3 = async () => {};
        // eslint-disable-next-line unicorn/consistent-function-scoping
        const noop4 = async () => {};

        const context = new Router<AnyHandler>()
            .add("GET", noop)
            .use("/foo", new Router<AnyHandler>().use("/", noop1).use("/bar", noop2, noop2).use("/quz", noop3), noop4);
        expect(context.find("GET", "/foo"), "matches exact base").toStrictEqual({
            middleOnly: false,
            params: {},
            fns: [noop, noop1, noop4],
        });

        expect(context.find("GET", "/quz"), "does not matches different base").toStrictEqual({
            middleOnly: false,
            params: {},
            fns: [noop],
        });

        expect(context.find("GET", "/foobar"), "does not matches different base (just-in-case case)").toStrictEqual({
            middleOnly: false,
            params: {},
            fns: [noop],
        });

        expect(context.find("GET", "/foo/bar"), "matches sub routes 1").toStrictEqual({
            middleOnly: false,
            params: {},
            fns: [noop, noop1, noop2, noop2, noop4],
        });

        expect(context.find("GET", "/foo/quz"), "matches sub routes 2").toStrictEqual({
            middleOnly: false,
            params: {},
            fns: [noop, noop1, noop3, noop4],
        });

        // with params
        expect(
            new Router().use("/:id", new Router().use("/bar", noop1), noop2).find("GET", "/foo/bar"),

            "with params",
        ).toStrictEqual({
            middleOnly: true,
            params: {
                id: "foo",
            },
            fns: [noop1, noop2],
        });

        expect(new Router().use("/:id", new Router().use("/:subId", noop1), noop2).find("GET", "/foo/bar"), "with params on both outer and sub").toStrictEqual({
            middleOnly: true,
            params: {
                id: "foo",
                subId: "bar",
            },
            fns: [noop1, noop2],
        });

        expect(new Router().use(noop).use(new Router().add("GET", noop1)).find("GET", "/"), "set root middleOnly to false if sub = false").toStrictEqual({
            middleOnly: false,
            params: {},
            fns: [noop, noop1],
        });
    });

    it("find() - w/ router nested multiple level", async () => {
        // eslint-disable-next-line unicorn/consistent-function-scoping
        const noop1 = async () => {};
        // eslint-disable-next-line unicorn/consistent-function-scoping
        const noop2 = async () => {};
        // eslint-disable-next-line unicorn/consistent-function-scoping
        const noop3 = async () => {};
        // eslint-disable-next-line unicorn/consistent-function-scoping
        const noop4 = async () => {};
        // eslint-disable-next-line unicorn/consistent-function-scoping
        const noop5 = async () => {};

        const context4 = new Router<AnyHandler>().use(noop5);
        const context3 = new Router<AnyHandler>().use(noop4).use("/:id", noop3);
        const context2 = new Router<AnyHandler>().use("/quz", noop2, context3).use(context4);
        const context = new Router<AnyHandler>().use("/foo", noop, context2, noop1);

        expect(context.find("GET", "/foo")).toEqual({
            middleOnly: true,
            params: {},
            fns: [noop, noop5, noop1],
        });

        expect(context.find("GET", "/foo/quz")).toEqual({
            middleOnly: true,
            params: {},
            fns: [noop, noop2, noop4, noop5, noop1],
        });

        expect(context.find("GET", "/foo/quz/bar")).toEqual({
            middleOnly: true,
            params: {
                id: "bar",
            },
            fns: [noop, noop2, noop4, noop3, noop5, noop1],
        });
    });

    it("add() - matches all if no route", async () => {
        expect.assertions(4);

        const context = new Router();
        // eslint-disable-next-line @typescript-eslint/naming-convention,unicorn/consistent-function-scoping,no-underscore-dangle
        const function_ = () => {};

        context.add("GET", function_);

        testRoute(context.routes[0] as Route<any>, {
            route: "/some/wacky/route",
            fns: [function_],
            matchAll: true,
            isMiddleware: false,
            method: "GET",
        });

        const context2 = new Router();

        context2.add("POST", "", function_);

        testRoute(context2.routes[0] as Route<any>, {
            route: "/some/wacky/route",
            fns: [function_],
            matchAll: true,
            isMiddleware: false,
            method: "POST",
        });
    });

    it("exec() - execute handlers sequentially", async () => {
        expect.assertions(10);

        const rreq = {};
        const rres = {};

        let index = 0;

        const fns: Nextable<(argument0: Record<string, unknown>, argument1: Record<string, unknown>) => void>[] = [
            async (request, response, next) => {
                // eslint-disable-next-line no-plusplus,radar/no-duplicate-string
                expect(index++, "correct execution order").toStrictEqual(0);
                expect(request, "~~> passes all args").toStrictEqual(rreq);
                expect(response, "~~> passes all args").toStrictEqual(rres);
                expect(next, "~~> receives next function").toBeTypeOf("function");

                const value = await next();

                expect(value, "~~> resolves the next handler").toStrictEqual("bar");
                // eslint-disable-next-line no-plusplus
                expect(index++, "correct execution order").toStrictEqual(4);

                return "final";
            },
            async (_request, _response, next) => {
                // eslint-disable-next-line no-plusplus
                expect(index++, "correct execution order").toStrictEqual(1);

                await next();
                // eslint-disable-next-line no-plusplus
                expect(index++, "correct execution order").toStrictEqual(3);

                return "bar";
            },
            async () => {
                // eslint-disable-next-line no-plusplus
                expect(index++, "correct execution order").toStrictEqual(2);

                return "foo";
            },
            async () => {
                expect(false, "don't call me").toBeTruthy();
            },
        ];

        expect(await Router.exec(fns, rreq, rres), "~~> returns the final value").toStrictEqual("final");
    });

    it("find() - returns middleOnly", async () => {
        const context = new Router();
        // eslint-disable-next-line @typescript-eslint/naming-convention,unicorn/consistent-function-scoping,no-underscore-dangle
        const function_ = () => {};

        context.add("", "/this/will/not/match", function_);
        context.add("POST", "/bar", function_);
        context.use("/", function_);
        context.use("/foo", function_);

        await it("= true if only middles found", async () => {
            expect(context.find("GET", "/bar").middleOnly).toBeTruthy();
        });

        await it("= false if at least one non-middle found", async () => {
            expect(context.find("POST", "/bar").middleOnly).toBeFalsy();
        });
    });
});
