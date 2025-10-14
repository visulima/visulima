/**
 * Adapted from lukeed/trouter library:
 * https://github.com/lukeed/trouter/blob/master/test/index
 */
import { describe, expect, it } from "vitest";

import type { FunctionLike, HttpMethod, Nextable, Route } from "../src";
import { Router } from "../src";

type AnyHandler = (...arguments_: any[]) => any;

const noop: AnyHandler = async () => {
    /** noop */
};

const testRoute = (rr: Route<any>, { route, ...match }: Partial<Route<any> & { route: string }>) => {
    // @ts-expect-error: pattern does not always exist

    const { pattern, ...r } = rr;

    expect(r, "~> has same route").toStrictEqual(match);

    if (route) {
        const testContext = new Router();

        testContext.routes = [rr];

        // eslint-disable-next-line unicorn/no-array-callback-reference, unicorn/no-array-method-this-argument
        expect(testContext.find(match.method as HttpMethod, route).fns.length, "~~> pattern satisfies route").toBeGreaterThan(0);
    }
};

describe("router", () => {
    it("internals", async () => {
        expect.assertions(4);

        const context = new Router<AnyHandler>();

        expect(context).instanceOf(Router, "creates new `Router` instance");
        expect(Array.isArray(context.routes), "~> has `routes` key (Array)").toBe(true);

        expect(context.add, "~> has `add` method").toBeTypeOf("function");

        expect(context.find, "~> has `find` method").toBeTypeOf("function");
    });

    it("add()", async () => {
        expect.assertions(9);

        const context = new Router<AnyHandler>();

        const out = context.add("GET", "/foo/:hello", noop);

        expect(out, "returns the Router instance (chainable)").toStrictEqual(context);
        expect(context.routes, "added \"GET /foo/:hello\" route successfully").toHaveLength(1);

        testRoute(context.routes[0] as Route<any>, {
            fns: [noop],
            isMiddleware: false,
            keys: ["hello"],
            method: "GET",
            route: "/foo/bar",
        });

        context.add("POST", "bar", noop);

        expect(context.routes, "added \"POST /bar\" route successfully (via alias)").toHaveLength(2);

        testRoute(context.routes[1] as Route<any>, {
            fns: [noop],
            isMiddleware: false,
            keys: [],
            method: "POST",
            route: "/bar",
        });

        context.add("PUT", /^\/foo\/(?<hello>\w+)\/?$/u, noop);

        expect(context.routes, String.raw`added "PUT /^[/]foo[/](?<hello>\w+)[/]?$/" route successfully`).toHaveLength(3);

        testRoute(context.routes[2] as Route<any>, {
            fns: [noop],
            isMiddleware: false,
            keys: false,
            method: "PUT",
        });
    });

    it("add() - multiple", async () => {
        expect.assertions(6);

        const context = new Router<AnyHandler>();

        context.add("PATCH", "/foo/:hello", noop, noop);

        expect(context.routes, "added \"SEARCH /foo/:hello\" route successfully").toHaveLength(1);

        testRoute(context.routes[0] as Route<any>, {
            fns: [noop, noop],
            isMiddleware: false,
            keys: ["hello"],
            method: "PATCH",
            route: "/foo/howdy",
        });

        context.add("PUT", "/bar", noop, noop, noop);

        expect(context.routes, "added \"PUT /bar\" route successfully (via alias)").toHaveLength(2);

        testRoute(context.routes[1] as Route<any>, {
            fns: [noop, noop, noop],
            isMiddleware: false,
            keys: [],
            method: "PUT",
            route: "/bar",
        });
    });

    it("use()", async () => {
        expect.assertions(10);

        const context = new Router<AnyHandler>();

        const out = context.use("/foo/:hello", noop);

        expect(out, "returns the Router instance (chainable)").toStrictEqual(context);
        expect(context.routes, "added \"ANY /foo/:hello\" route successfully").toHaveLength(1);

        testRoute(context.routes[0] as Route<any>, {
            fns: [noop],
            isMiddleware: true,
            keys: ["hello"],
            method: "",
            route: "/foo/bar",
        });

        context.use("/", noop, noop, noop);

        expect(context.routes, "added \"ANY /\" routes successfully").toHaveLength(2);

        testRoute(context.routes[1] as Route<any>, {
            fns: [noop, noop, noop],
            isMiddleware: true,
            keys: [],
            method: "",
            route: "/",
        });

        context.use("/foo/:world?", noop, noop, noop, noop);

        expect(context.routes, "added \"ANY /foo/:world?\" routes successfully").toHaveLength(3);

        testRoute(context.routes[2] as Route<any>, {
            fns: [noop, noop, noop, noop],
            isMiddleware: true,
            keys: ["world"],
            method: "",
            route: "/foo/hello",
        });
    });

    it("all()", async () => {
        expect.assertions(21);

        // eslint-disable-next-line no-plusplus,@typescript-eslint/naming-convention,no-underscore-dangle
        const function_: AnyHandler = (request: any) => request.chain++;
        const context = new Router<AnyHandler>().add("", "/greet/:name", function_);

        expect(context.routes, "added \"ALL /greet/:name\" route").toHaveLength(1);

        testRoute(context.routes[0] as Route<any>, {
            fns: [function_],
            isMiddleware: false,
            keys: ["name"],
            method: "", // ~> "ALL"
            route: "/greet/you",
        });

        const foo = context.find("HEAD", "/greet/Bob") as any;

        expect(foo.params.name, "~> \"params.name\" is expected").toBe("Bob");

        expect(foo.fns, "~~> \"handlers\" has 1 item").toHaveLength(1);

        foo.chain = 0;

        foo.fns.forEach((function__: (argument0: any) => any) => function__(foo));

        expect(foo.chain, "~~> handler executed successfully").toBe(1);

        const bar = context.find("GET", "/greet/Judy") as any;

        expect(bar.params.name, "~> \"params.name\" is expected").toBe("Judy");
        expect(bar.fns, "~~> \"handlers\" has 1 item").toHaveLength(1);

        bar.chain = 0;

        bar.fns.forEach((function__: (argument0: any) => any) => function__(bar));

        expect(bar.chain, "~~> handler executed successfully").toBe(1);

        const function2: AnyHandler = (request: any) => {
            // eslint-disable-next-line no-plusplus
            expect(request.chain++, "~> ran new HEAD after ALL handler").toBe(1);
            expect(request.params.name, "~~> still see \"params.name\" value").toBe("Rick");
            expect(request.params.person, "~~> receives \"params.person\" value").toBe("Rick");
        };

        context.add("HEAD", "/greet/:person", function2);

        expect(context.routes, "added \"HEAD /greet/:name\" route").toHaveLength(2);

        testRoute(context.routes[1] as Route<any>, {
            fns: [function2],
            isMiddleware: false,
            keys: ["person"],
            method: "HEAD", // ~> "ALL"
            route: "/greet/you",
        });

        const baz = context.find("HEAD", "/greet/Rick") as any;

        expect(baz.params.name, "~> \"params.name\" is expected").toBe("Rick");
        expect(baz.fns, "~~> \"handlers\" has 2 items").toHaveLength(2);

        baz.chain = 0;

        baz.fns.forEach((function__: (argument0: any) => any) => function__(baz));

        expect(baz.chain, "~~> handlers executed successfully").toBe(2);

        const bat = context.find("POST", "/greet/Morty") as any;

        expect(bat.params.name, "~> \"params.name\" is expected").toBe("Morty");
        expect(bat.fns, "~~> \"handlers\" has 1 item").toHaveLength(1);

        bat.chain = 0;

        bat.fns.forEach((function__: (argument0: any) => any) => function__(bat));

        expect(bat.chain, "~~> handler executed successfully").toBe(1);
    });

    it("find()", async () => {
        expect.assertions(9);

        const context = new Router<AnyHandler>();

        context.add(
            "GET",
            "/foo/:title",
            ((request) => {
                // eslint-disable-next-line no-plusplus
                expect(request.chain++, "~> 1st \"GET /foo/:title\" ran first").toBe(1);
                expect(request.params.title, "~> \"params.title\" is expected").toBe("bar");
            }) as AnyHandler,
            ((request) => {
                // eslint-disable-next-line no-plusplus
                expect(request.chain++, "~> 2nd \"GET /foo/:title\" ran second").toBe(2);
            }) as AnyHandler,
        );

        const out = context.find("GET", "/foo/bar") as any;

        expect(out, "returns an object").toBeTypeOf("object");
        expect(out.params, "~> has \"params\" key (object)").toBeTypeOf("object");
        expect(out.params.title, "~~> \"params.title\" value is correct").toBe("bar");

        expect(Array.isArray(out.fns), "~> has \"handlers\" key (array)").toBe(true);
        expect(out.fns, "~~> saved both handlers").toHaveLength(2);

        out.chain = 1;
        out.fns.forEach((function__: (argument0: any) => any) => function__(out));

        expect(out.chain, "~> executes the handler group sequentially").toBe(3);
    });

    it("find() - no match", async () => {
        expect.assertions(3);

        const context = new Router<AnyHandler>();
        const out = context.find("DELETE", "/nothing");

        expect(out, "returns an object").toBeTypeOf("object");
        expect(Object.keys(out.params), "~> \"params\" is empty").toHaveLength(0);
        expect(out.fns, "~> \"handlers\" is empty").toHaveLength(0);
    });

    it("find() - multiple", async () => {
        expect.assertions(1);

        expect.assertions(18);

        let isRoot = true;

        const context = new Router<AnyHandler>()
            .use("/foo", ((request) => {
                expect(true, "~> ran use(\"/foo\")\" route").toBe(true); // x2

                if (!isRoot) {
                    // eslint-disable-next-line vitest/no-conditional-expect
                    expect(request.params.title, "~~> saw \"param.title\" value").toBe("bar");
                }

                // eslint-disable-next-line no-plusplus
                expect(request.chain++, "~~> ran 1st").toBe(0);
            }) as AnyHandler)
            .add("GET", "/foo", ((request) => {
                expect(true, "~> ran \"GET /foo\" route").toBe(true);

                // eslint-disable-next-line no-plusplus
                expect(request.chain++, "~~> ran 2nd").toBe(1);
            }) as AnyHandler)
            .add("GET", "/foo/:title?", ((request) => {
                expect(true, "~> ran \"GET /foo/:title?\" route").toBe(true); // x2

                if (!isRoot) {
                    // eslint-disable-next-line vitest/no-conditional-expect
                    expect(request.params.title, "~~> saw \"params.title\" value").toBe("bar");
                }

                if (isRoot) {
                    // eslint-disable-next-line no-plusplus,vitest/no-conditional-expect
                    expect(request.chain++, "~~> ran 3rd").toBe(2);
                } else {
                    // eslint-disable-next-line no-plusplus,vitest/no-conditional-expect
                    expect(request.chain++, "~~> ran 2nd").toBe(1);
                }
            }) as AnyHandler)
            .add("GET", "/foo/*", ((request) => {
                expect(true, "~> ran \"GET /foo/*\" route").toBe(true);

                expect(request.params["*"], "~~> saw \"params[\"*\"]\" value").toBe("bar");
                expect(request.params.title, "~~> saw \"params.title\" value").toBe("bar");
                // eslint-disable-next-line no-plusplus
                expect(request.chain++, "~~> ran 3rd").toBe(2);
            }) as AnyHandler);

        const foo = context.find("GET", "/foo") as any;

        expect(foo.fns, "found 3 handlers").toHaveLength(3);

        foo.chain = 0;
        foo.fns.forEach((function__: (argument0: any) => any) => function__(foo));

        isRoot = false;
        const bar = context.find("GET", "/foo/bar") as any;

        expect(bar.fns, "found 3 handlers").toHaveLength(3);

        bar.chain = 0;
        bar.fns.forEach((function__: (argument0: any) => any) => function__(bar));
    });

    it("find() - HEAD", async () => {
        expect.assertions(5);

        const context = new Router<AnyHandler>()
            .add("", "/foo", ((request) => {
                // eslint-disable-next-line no-plusplus
                expect(request.chain++, "~> found \"ALL /foo\" route").toBe(0);
            }) as AnyHandler)
            .add("HEAD", "/foo", ((request) => {
                // eslint-disable-next-line no-plusplus
                expect(request.chain++, "~> found \"HEAD /foo\" route").toBe(1);
            }) as AnyHandler)
            .add("GET", "/foo", ((request) => {
                // eslint-disable-next-line no-plusplus
                expect(request.chain++, "~> also found \"GET /foo\" route").toBe(2);
            }) as AnyHandler)
            .add("GET", "/", async () => {
                expect(true, "should not run").toBe(true);
            });

        const out = context.find("HEAD", "/foo") as any;

        expect(out.fns, "found 3 handlers").toHaveLength(3);

        out.chain = 0;
        out.fns.forEach((function__: (argument0: any) => any) => function__(out));

        expect(out.chain, "ran handlers sequentially").toBe(3);
    });

    it("find() - order", async () => {
        expect.assertions(5);

        const context = new Router<AnyHandler>()
            .add("", "/foo", ((request) => {
                // eslint-disable-next-line no-plusplus
                expect(request.chain++, "~> ran \"ALL /foo\" 1st").toBe(0);
            }) as AnyHandler)
            .add("GET", "/foo", ((request) => {
                // eslint-disable-next-line no-plusplus
                expect(request.chain++, "~> ran \"GET /foo\" 2nd").toBe(1);
            }) as AnyHandler)
            .add("HEAD", "/foo", ((request) => {
                // eslint-disable-next-line no-plusplus
                expect(request.chain++, "~> ran \"HEAD /foo\" 3rd").toBe(2);
            }) as AnyHandler)
            .add("GET", "/", (() => {
                expect(true, "should not run").toBe(true);
            }) as AnyHandler);

        const out = context.find("HEAD", "/foo") as any;

        expect(out.fns, "found 3 handlers").toHaveLength(3);

        out.chain = 0;
        out.fns.forEach((function__: (argument0: any) => any) => function__(out));

        expect(out.chain, "ran handlers sequentially").toBe(3);
    });

    it("find() w/ all()", async () => {
        expect.assertions(18);

        const find = (x: Router<AnyHandler>, y: string) => x.find("GET", y);

        const context1 = new Router<AnyHandler>().add("", "api", noop);
        const context2 = new Router<AnyHandler>().add("", "api/:version", noop);
        const context3 = new Router<AnyHandler>().add("", "api/:version?", noop);
        const context4 = new Router<AnyHandler>().add("", "movies/:title.mp4", noop);

        expect(find(context1, "/api").fns, "~> exact match").toHaveLength(1);
        expect(find(context1, "/api/foo").fns, "~> does not match \"/api/foo\" - too long").toHaveLength(0);

        expect(find(context2, "/api").fns, "~> does not match \"/api\" only").toHaveLength(0);

        const foo1 = find(context2, "/api/v1");

        expect(foo1.fns, "~> does match \"/api/v1\" directly").toHaveLength(1);

        expect(foo1.params.version, "~> parses the \"version\" correctly").toBe("v1");

        const foo2 = find(context2, "/api/v1/users");

        expect(foo2.fns, "~> does not match \"/api/v1/users\" - too long").toHaveLength(0);
        expect(foo2.params.version, "~> cannot parse the \"version\" parameter (not a match)").toBeUndefined();

        expect(find(context3, "/api").fns, "~> does match \"/api\" because optional").toHaveLength(1);

        const bar1 = find(context3, "/api/v1");

        expect(bar1.fns, "~> does match \"/api/v1\" directly").toHaveLength(1);
        expect(bar1.params.version, "~> parses the \"version\" correctly").toBe("v1");

        const bar2 = find(context3, "/api/v1/users");

        expect(bar2.fns, "~> does match \"/api/v1/users\" - too long").toHaveLength(0);
        expect(bar2.params.version, "~> cannot parse the \"version\" parameter (not a match)").toBeUndefined();

        expect(find(context4, "/movies").fns, "~> does not match \"/movies\" directly").toHaveLength(0);
        expect(find(context4, "/movies/narnia").fns, "~> does not match \"/movies/narnia\" directly").toHaveLength(0);

        const baz1 = find(context4, "/movies/narnia.mp4");

        expect(baz1.fns, "~> does match \"/movies/narnia.mp4\" directly").toHaveLength(1);

        expect(baz1.params.title, "~> parses the \"title\" correctly").toBe("narnia");

        const baz2 = find(context4, "/movies/narnia.mp4/cast");

        expect(baz2.fns, "~> does match \"/movies/narnia.mp4/cast\" - too long").toHaveLength(0);
        expect(baz2.params.title, "~> cannot parse the \"title\" parameter (not a match)").toBeUndefined();
    });

    it("find() w/ use()", async () => {
        expect.assertions(18);

        const find = (x: Router<AnyHandler>, y: string) => x.find("GET", y);

        const context1 = new Router<AnyHandler>().use("api", noop);
        const context2 = new Router<AnyHandler>().use("api/:version", noop);
        const context3 = new Router<AnyHandler>().use("api/:version?", noop);
        const context4 = new Router<AnyHandler>().use("movies/:title.mp4", noop);

        expect(find(context1, "/api").fns, "~> exact match").toHaveLength(1);
        expect(find(context1, "/api/foo").fns, "~> loose match").toHaveLength(1);

        expect(find(context2, "/api").fns, "~> does not match \"/api\" only").toHaveLength(0);

        const foo1 = find(context2, "/api/v1");

        expect(foo1.fns, "~> does match \"/api/v1\" directly").toHaveLength(1);
        expect(foo1.params.version, "~> parses the \"version\" correctly").toBe("v1");

        const foo2 = find(context2, "/api/v1/users");

        expect(foo2.fns, "~> does match \"/api/v1/users\" loosely").toHaveLength(1);
        expect(foo2.params.version, "~> parses the \"version\" correctly").toBe("v1");

        expect(find(context3, "/api").fns, "~> does match \"/api\" because optional").toHaveLength(1);

        const bar1 = find(context3, "/api/v1");

        expect(bar1.fns, "~> does match \"/api/v1\" directly").toHaveLength(1);
        expect(bar1.params.version, "~> parses the \"version\" correctly").toBe("v1");

        const bar2 = find(context3, "/api/v1/users");

        expect(bar2.fns, "~> does match \"/api/v1/users\" loosely").toHaveLength(1);
        expect(bar2.params.version, "~> parses the \"version\" correctly").toBe("v1");

        expect(find(context4, "/movies").fns, "~> does not match \"/movies\" directly").toHaveLength(0);
        expect(find(context4, "/movies/narnia").fns, "~> does not match \"/movies/narnia\" directly").toHaveLength(0);

        const baz1 = find(context4, "/movies/narnia.mp4");

        expect(baz1.fns, "~> does match \"/movies/narnia.mp4\" directly").toHaveLength(1);
        expect(baz1.params.title, "~> parses the \"title\" correctly").toBe("narnia");

        const baz2 = find(context4, "/movies/narnia.mp4/cast");

        expect(baz2.fns, "~> does match \"/movies/narnia.mp4/cast\" loosely").toHaveLength(1);
        expect(baz2.params.title, "~> parses the \"title\" correctly").toBe("narnia");
    });

    it("find() - regex w/ named groups", async () => {
        expect.assertions(9);

        const context = new Router<AnyHandler>();

        context.add(
            "GET",
            /^\/foo\/(?<title>\w+)\/?$/u,
            ((request) => {
                // eslint-disable-next-line no-plusplus
                expect(request.chain++, String.raw`~> 1st "GET /^[/]foo[/](?<title>\w+)[/]?$/" ran first`).toBe(1);
                expect(request.params.title, "~> \"params.title\" is expected").toBe("bar");
            }) as AnyHandler,
            ((request) => {
                // eslint-disable-next-line no-plusplus
                expect(request.chain++, String.raw`~> 2nd "GET /^[/]foo[/](?<title>\w+)[/]?$/" ran second`).toBe(2);
            }) as AnyHandler,
        );

        const out = context.find("GET", "/foo/bar") as any;

        expect(out, "returns an object").toBeTypeOf("object");
        expect(out.params, "~> has \"params\" key (object)").toBeTypeOf("object");
        expect(out.params.title, "~~> \"params.title\" value is correct").toBe("bar");

        expect(Array.isArray(out.fns), "~> has \"handlers\" key (array)").toBe(true);
        expect(out.fns, "~~> saved both handlers").toHaveLength(2);

        out.chain = 1;
        out.fns.forEach((function__: (argument0: any) => any) => function__(out));

        expect(out.chain, "~> executes the handler group sequentially").toBe(3);
    });

    it("find() - multiple regex w/ named groups", async () => {
        expect.assertions(18);

        let isRoot = true;
        const context = new Router<AnyHandler>()
            .use("/foo", ((request) => {
                expect(true, "~> ran use(\"/foo\")\" route").toBe(true); // x2

                if (!isRoot) {
                    // eslint-disable-next-line vitest/no-conditional-expect
                    expect(request.params.title, "~~> saw \"params.title\" value").toBe("bar");
                }

                // eslint-disable-next-line no-plusplus
                expect(request.chain++, "~~> ran 1st").toBe(0);
            }) as AnyHandler)

            .add("GET", "/foo", ((request) => {
                expect(true, "~> ran \"GET /foo\" route").toBe(true);
                // eslint-disable-next-line no-plusplus
                expect(request.chain++, "~~> ran 2nd").toBe(1);
            }) as AnyHandler)
            // eslint-disable-next-line security/detect-unsafe-regex
            .add("GET", /^\/foo(?:\/(?<title>\w+))?\/?$/u, ((request) => {
                expect(true, String.raw`~> ran "GET /^[/]foo[/](?<title>\w+)?[/]?$/" route`).toBe(true); // x2

                if (!isRoot) {
                    // eslint-disable-next-line vitest/no-conditional-expect
                    expect(request.params.title, "~~> saw \"params.title\" value").toBe("bar");
                }

                if (isRoot) {
                    // eslint-disable-next-line no-plusplus,vitest/no-conditional-expect
                    expect(request.chain++, "~~> ran 3rd").toBe(2);
                } else {
                    // eslint-disable-next-line no-plusplus,vitest/no-conditional-expect
                    expect(request.chain++, "~~> ran 2nd").toBe(1);
                }
            }) as AnyHandler)
            .add("GET", /^\/foo\/(?<wild>.*)$/u, ((request) => {
                expect(true, "~> ran \"GET /^[/]foo[/](?<wild>.*)$/\" route").toBe(true);

                expect(request.params.wild, "~~> saw \"params.wild\" value").toBe("bar");
                expect(request.params.title, "~~> saw \"params.title\" value").toBe("bar");
                // eslint-disable-next-line no-plusplus
                expect(request.chain++, "~~> ran 3rd").toBe(2);
            }) as AnyHandler);

        const foo = context.find("GET", "/foo") as any;

        expect(foo.fns, "found 3 handlers").toHaveLength(3);

        foo.chain = 0;
        foo.fns.forEach((function__: (argument0: any) => any) => function__(foo));

        isRoot = false;
        const bar = context.find("GET", "/foo/bar") as any;

        expect(bar.fns, "found 3 handlers").toHaveLength(3);

        bar.chain = 0;
        bar.fns.forEach((function__: (argument0: any) => any) => function__(bar));
    });

    /**
     * Additional handling tailored to connect
     */

    it("constructor() with base", async () => {
        expect.assertions(2);

        expect(new Router().base, "assign base to / by default").toBe("/");
        expect(new Router("/foo").base, "assign base to provided value").toBe("/foo");
    });

    it("constructor() with routes", async () => {
        expect.assertions(2);

        expect(new Router().routes, "assign to empty route array by default").toStrictEqual([]);

        const routes: Route<Nextable<FunctionLike>>[] | undefined = [];

        expect(new Router(undefined, routes).routes, "assign routes if provided").toStrictEqual(routes);
    });

    it("clone()", async () => {
        expect.assertions(3);

        const context = new Router();

        context.routes = [noop, noop] as any[];

        expect(context.clone()).instanceOf(Router, "is a Router instance");
        expect(context.clone("/foo").base, "cloned with custom base").toBe("/foo");

        const contextRoutes = new Router("", [noop as unknown as Route<Nextable<FunctionLike>>]);

        expect(contextRoutes.clone().routes, "routes are deep cloned").toStrictEqual(contextRoutes.routes);
    });

    it("use() - default to / with no base", async () => {
        expect.assertions(2);

        const context = new Router();
        // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
        const function_ = () => {};

        context.use(function_);

        testRoute(context.routes[0] as Route<any>, {
            fns: [function_],
            isMiddleware: true,
            keys: [],
            method: "",

            route: "/some/wacky/route",
        });
    });

    it("use() - mount router", async () => {
        expect.assertions(5);

        const subContext = new Router();

        testRoute(new Router().use("/foo", subContext, noop).routes[0] as Route<any>, {
            fns: [subContext.clone("/foo"), noop],
            isMiddleware: true,
            keys: [],
            method: "",
        });

        testRoute(new Router().use("/", subContext, noop).routes[0] as Route<any>, {
            fns: [subContext, noop],
            isMiddleware: true,
            keys: [],
            method: "",
        });

        // nested mount
        const subContext2 = new Router().use("/bar", subContext);

        testRoute(new Router().use("/foo", subContext2, noop).routes[0] as Route<any>, {
            fns: [subContext2.clone("/foo"), noop],
            isMiddleware: true,
            keys: [],
            method: "",
        });

        testRoute(subContext2.routes[0] as Route<any>, {
            fns: [subContext.clone("/bar")],
            isMiddleware: true,
            keys: [],
            method: "",
        });

        // unsupported
        expect(() => new Router().use(/\/not\/supported/u, subContext), "throws unsupported message").toThrow(
            new Error("Mounting a router to RegExp base is not supported"),
        );
    });

    it("find() - w/ router with correct match", async () => {
        expect.assertions(8);

        const noop1 = async () => {};

        const noop2 = async () => {};

        const noop3 = async () => {};

        const noop4 = async () => {};

        const context = new Router<AnyHandler>()
            .add("GET", noop)
            .use("/foo", new Router<AnyHandler>().use("/", noop1).use("/bar", noop2, noop2).use("/quz", noop3), noop4);

        expect(context.find("GET", "/foo"), "matches exact base").toStrictEqual({
            fns: [noop, noop1, noop4],
            middleOnly: false,
            params: {},
        });

        expect(context.find("GET", "/quz"), "does not matches different base").toStrictEqual({
            fns: [noop],
            middleOnly: false,
            params: {},
        });

        expect(context.find("GET", "/foobar"), "does not matches different base (just-in-case case)").toStrictEqual({
            fns: [noop],
            middleOnly: false,
            params: {},
        });

        expect(context.find("GET", "/foo/bar"), "matches sub routes 1").toStrictEqual({
            fns: [noop, noop1, noop2, noop2, noop4],
            middleOnly: false,
            params: {},
        });

        expect(context.find("GET", "/foo/quz"), "matches sub routes 2").toStrictEqual({
            fns: [noop, noop1, noop3, noop4],
            middleOnly: false,
            params: {},
        });

        // with params
        expect(
            new Router().use("/:id", new Router().use("/bar", noop1), noop2).find("GET", "/foo/bar"),

            "with params",
        ).toStrictEqual({
            fns: [noop1, noop2],
            middleOnly: true,
            params: {
                id: "foo",
            },
        });

        expect(new Router().use("/:id", new Router().use("/:subId", noop1), noop2).find("GET", "/foo/bar"), "with params on both outer and sub").toStrictEqual({
            fns: [noop1, noop2],
            middleOnly: true,
            params: {
                id: "foo",
                subId: "bar",
            },
        });

        expect(new Router().use(noop).use(new Router().add("GET", noop1)).find("GET", "/"), "set root middleOnly to false if sub = false").toStrictEqual({
            fns: [noop, noop1],
            middleOnly: false,
            params: {},
        });
    });

    it("find() - w/ router nested multiple level", async () => {
        expect.assertions(3);

        const noop1 = async () => {};

        const noop2 = async () => {};

        const noop3 = async () => {};

        const noop4 = async () => {};

        const noop5 = async () => {};

        const context4 = new Router<AnyHandler>().use(noop5);
        const context3 = new Router<AnyHandler>().use(noop4).use("/:id", noop3);
        const context2 = new Router<AnyHandler>().use("/quz", noop2, context3).use(context4);
        const context = new Router<AnyHandler>().use("/foo", noop, context2, noop1);

        expect(context.find("GET", "/foo")).toStrictEqual({
            fns: [noop, noop5, noop1],
            middleOnly: true,
            params: {},
        });

        expect(context.find("GET", "/foo/quz")).toStrictEqual({
            fns: [noop, noop2, noop4, noop5, noop1],
            middleOnly: true,
            params: {},
        });

        expect(context.find("GET", "/foo/quz/bar")).toStrictEqual({
            fns: [noop, noop2, noop4, noop3, noop5, noop1],
            middleOnly: true,
            params: {
                id: "bar",
            },
        });
    });

    it("add() - matches all if no route", async () => {
        expect.assertions(4);

        const context = new Router();
        // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
        const function_ = () => {};

        context.add("GET", function_);

        testRoute(context.routes[0] as Route<any>, {
            fns: [function_],
            isMiddleware: false,
            matchAll: true,
            method: "GET",
            route: "/some/wacky/route",
        });

        const context2 = new Router();

        context2.add("POST", "", function_);

        testRoute(context2.routes[0] as Route<any>, {
            fns: [function_],
            isMiddleware: false,
            matchAll: true,
            method: "POST",
            route: "/some/wacky/route",
        });
    });

    it("exec() - execute handlers sequentially", async () => {
        expect.assertions(10);

        const rreq = {};
        const rres = {};

        let index = 0;

        const fns: Nextable<(argument0: Record<string, unknown>, argument1: Record<string, unknown>) => void>[] = [
            async (request, response, next) => {
                // eslint-disable-next-line no-plusplus
                expect(index++, "correct execution order").toBe(0);
                expect(request, "~~> passes all args").toStrictEqual(rreq);
                expect(response, "~~> passes all args").toStrictEqual(rres);
                expect(next, "~~> receives next function").toBeTypeOf("function");

                const value = await next();

                expect(value, "~~> resolves the next handler").toBe("bar");
                // eslint-disable-next-line no-plusplus
                expect(index++, "correct execution order").toBe(4);

                return "final";
            },
            async (_request, _response, next) => {
                // eslint-disable-next-line no-plusplus
                expect(index++, "correct execution order").toBe(1);

                await next();

                // eslint-disable-next-line no-plusplus
                expect(index++, "correct execution order").toBe(3);

                return "bar";
            },
            async () => {
                // eslint-disable-next-line no-plusplus
                expect(index++, "correct execution order").toBe(2);

                return "foo";
            },
            async () => {
                expect(false, "don't call me").toBe(true);
            },
        ];

        await expect(Router.exec(fns, rreq, rres), "~~> returns the final value").resolves.toBe("final");
    });

    describe("find() - returns middleOnly", () => {
        const context = new Router();
        // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
        const function_ = () => {};

        // eslint-disable-next-line vitest/require-hook
        context.add("", "/this/will/not/match", function_);
        // eslint-disable-next-line vitest/require-hook
        context.add("POST", "/bar", function_);
        // eslint-disable-next-line vitest/require-hook
        context.use("/", function_);
        // eslint-disable-next-line vitest/require-hook
        context.use("/foo", function_);

        it("should be true if only middles found", async () => {
            expect.assertions(1);

            expect(context.find("GET", "/bar").middleOnly).toBe(true);
        });

        it("should be false if at least one non-middle found", async () => {
            expect.assertions(1);

            expect(context.find("POST", "/bar").middleOnly).toBe(false);
        });
    });
});
