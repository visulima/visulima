import "isomorphic-fetch";

import {
    describe, expect, it, vi,
} from "vitest";

import { Router } from "../src";
import { createEdgeRouter, EdgeRouter, getPathname } from "../src/edge";

type AnyHandler = (...arguments_: any[]) => any;

const noop: AnyHandler = async () => {
    /** noop */
};

const METHODS = ["GET", "HEAD", "PATCH", "DELETE", "POST", "PUT"];

const testUrl = "http://localhost/foo/bar";
const badFunction = () => {
    // throw new Error("bad function");
};

describe("edge", () => {
    it("internals", () => {
        const context = new EdgeRouter();

        expect(context).instanceof(EdgeRouter, "creates new `EdgeRouter` instance");
        // @ts-expect-error: internal
        expect(context.router).instanceof(Router, "~> has a `Router` instance");

        expect(context.all).toBeTypeOf("function");

        METHODS.forEach((method) => {
            expect(context[method.toLowerCase()], `~> has \`${method}\` method`).toBeTypeOf("function");
        });
    });

    it("createEdgeRouter() returns an instance", async () => {
        expect(createEdgeRouter()).instanceOf(EdgeRouter);
    });

    it("add()", async () => {
        expect.assertions(2);
        const context = new EdgeRouter();
        // @ts-expect-error: private property
        vi.spyOn(context.router, "add").mockImplementation((...values) => {
            expect(values, "call router.add()").toStrictEqual(["GET", "/", noop]);
        });
        // @ts-expect-error: private property
        const returned = context.add("GET", "/", noop);

        expect(returned, "returned itself").toStrictEqual(context);
    });

    it("use()", async () => {
        it("it defaults to / if base is not provided", async () => {
            const context = new EdgeRouter();

            // @ts-expect-error: private field
            const useSpy = vi.spyOn(context.router, "use");

            context.use(noop);

            expect(useSpy).toStrictEqual([["/", noop]]);
        });

        it("it call this.router.use() with fn", async () => {
            const context = new EdgeRouter();

            // @ts-expect-error: private field
            const useSpy = vi.spyOn(context.router, "use");

            context.use("/test", noop, noop);

            expect(useSpy).toStrictEqual([["/test", noop, noop]]);
        });

        it("it call this.router.use() with fn.router", async () => {
            const context = new EdgeRouter();
            const context2 = new EdgeRouter();

            // @ts-expect-error: private field
            const useSpy = vi.spyOn(context.router, "use");

            context.use("/test", context2, context2);

            // @ts-expect-error: private field
            expect(useSpy.calls).toStrictEqual([["/test", context2.router, context2.router]]);
        });
    });

    it("clone()", () => {
        const context = new EdgeRouter();
        // @ts-expect-error: private property
        context.router.routes = [noop, noop] as any[];

        expect(context.clone(), "is a NodeRouter instance").instanceOf(EdgeRouter);
        expect(context, "not the same identity").not.toStrictEqual(context.clone());

        expect(
            // @ts-expect-error: private property
            context.router.routes,
            "routes are deep cloned",
        ).toStrictEqual(
            // @ts-expect-error: private property
            context.clone().router.routes,
        );
    });

    it("run() - runs req and evt through fns and return last value", async () => {
        expect.assertions(7);

        const context = createEdgeRouter();
        const request = { url: testUrl, method: "POST" } as Request;
        const event = {};

        context.use("/", (reqq, evtt, next) => {
            // eslint-disable-next-line radar/no-duplicate-string
            expect(reqq, "passes along req").toStrictEqual(request);
            // eslint-disable-next-line radar/no-duplicate-string
            expect(evtt, "passes along evt").toStrictEqual(event);

            return next();
        });

        // eslint-disable-next-line radar/no-duplicate-string
        context.use("/not/match", badFunction);
        context.get("/", badFunction);
        context.get("/foo/bar", badFunction);
        // eslint-disable-next-line radar/no-identical-functions
        context.post("/foo/bar", async (reqq, evtt, next) => {
            expect(reqq, "passes along req").toStrictEqual(request);
            expect(evtt, "passes along evt").toStrictEqual(event);

            return next();
        });
        context.use("/foo", (reqq, evtt) => {
            expect(reqq, "passes along req").toStrictEqual(request);
            expect(evtt, "passes along evt").toStrictEqual(event);

            return "ok";
        });
        expect(await context.run(request, event)).toStrictEqual("ok");
    });

    it("run() - propagates error", async () => {
        // eslint-disable-next-line radar/no-duplicate-string
        const request = { url: "http://localhost/", method: "GET" } as Request;
        const event = {};
        const error = new Error("💥");

        await expect(() => createEdgeRouter()
            .use((_, __, next) => {
                next();
            })
            .use(() => {
                throw error;
            })
            .run(request, event)).rejects.toThrowError(error);

        await expect(() => createEdgeRouter()
            .use((_, __, next) => next())
            .use(async () => {
                throw error;
            })
            .run(request, event)).rejects.toThrowError(error);

        await expect(() => createEdgeRouter()
            .use((_, __, next) => next())
            .use(async (_, __, next) => {
                await next();
            })
        // eslint-disable-next-line compat/compat
            .use(() => Promise.reject(error))
            .run(request, event)).rejects.toThrowError(error);
    });

    it("run() - returns if no fns", async () => {
        const request = { url: testUrl, method: "GET" } as Request;
        const event = {};
        const context = createEdgeRouter();

        context.get("/foo", badFunction);
        context.post("/foo/bar", badFunction);
        context.use("/bar", badFunction);

        expect(context.run(request, event)).resolves.toBeUndefined();
    });

    it("handler() - basic", async () => {
        expect(createEdgeRouter().handler(), "returns a function").toBeTypeOf("function");
    });

    it("handler() - handles incoming and returns value (sync)", async () => {
        expect.assertions(4);
        const response = new Response("");
        const request = { method: "GET", url: "http://localhost/" } as Request;

        let index = 0;

        // eslint-disable-next-line unicorn/prevent-abbreviations
        const res = await createEdgeRouter()
            .use((_request, _event, next) => {
                // eslint-disable-next-line no-plusplus
                expect(++index).toStrictEqual(1);

                return next();
            })
            .use((_request, _event, next) => {
                // eslint-disable-next-line no-plusplus
                expect(++index).toStrictEqual(2);

                return next();
            })
            .post(badFunction)
            .get("/not/match", badFunction)
            .get(() => {
                // eslint-disable-next-line no-plusplus
                expect(++index).toStrictEqual(3);

                return response;
            })
            .handler()(request, {});

        expect(res, "resolve with response (sync)").toStrictEqual(response);
    });

    it("handler() - handles incoming and returns value (async)", async () => {
        expect.assertions(4);
        const response = new Response("");
        const request = { method: "GET", url: "http://localhost/" } as Request;

        let index = 0;

        // eslint-disable-next-line unicorn/prevent-abbreviations
        const res = await createEdgeRouter()
            .use(async (_request, _event, next) => {
                // eslint-disable-next-line no-plusplus
                expect(++index).toStrictEqual(1);

                // eslint-disable-next-line @typescript-eslint/return-await
                return await next();
            })
            // eslint-disable-next-line radar/no-identical-functions
            .use((_request, _event, next) => {
                // eslint-disable-next-line no-plusplus
                expect(++index).toStrictEqual(2);

                return next();
            })
            .post(badFunction)
            .get("/not/match", badFunction)
            // eslint-disable-next-line radar/no-identical-functions
            .get(async () => {
                // eslint-disable-next-line no-plusplus
                expect(++index).toStrictEqual(3);

                return response;
            })
            .handler()(request, {});

        expect(res, "resolve with response (async)").toStrictEqual(response);
    });

    it("handler() - calls onError if error thrown (sync)", async () => {
        expect.assertions(3 * 3);
        const error = new Error("💥");
        const consoleSpy = vi.spyOn(globalThis.console, "error").mockImplementation(() => {});

        const baseFunction = (_request: Request, _event: unknown, next: any) => next();

        let index = 0;
        const testResponse = async (response: Response) => {
            expect(response.status, "set 500 status code").toStrictEqual(500);
            // eslint-disable-next-line radar/no-duplicate-string
            expect(await response.text()).toStrictEqual("Internal Server Error");
            expect(consoleSpy.mock.calls[index], `called console.error ${index}`).toStrictEqual([error]);
            index += 1;
        };

        const request = { method: "GET", url: "http://localhost/" } as Request;

        await createEdgeRouter()
            .use(baseFunction)
            .use(() => {
                throw error;
            })
            .get(badFunction)
            .handler()(request, {})
            .then(testResponse);

        await createEdgeRouter()
            .use(baseFunction)
            .use((_request, _event, next) => {
                next();
            })
            .get(() => {
                throw error;
            })
            .handler()(request, {})
            .then(testResponse);

        await createEdgeRouter()
            .use(baseFunction)
            .get(() => {
                // non error throw
                // eslint-disable-next-line @typescript-eslint/no-throw-literal
                throw "";
            })
            .handler()(request, {})
            // eslint-disable-next-line promise/always-return
            .then(async (response: Response) => {
                expect(response.status, `called console.error ${index}`).toStrictEqual(500);
                expect(await response.text()).toStrictEqual("Internal Server Error");
                expect(consoleSpy.mock.calls[index], 'called console.error with ""').toStrictEqual([""]);
            });
    });

    it("handler() - calls onError if error thrown (async)", async () => {
        expect.assertions(2 * 3);
        const error = new Error("💥");
        const consoleSpy = vi.spyOn(globalThis.console, "error").mockImplementation(() => {});

        let index = 0;

        const testResponse = async (response: Response) => {
            expect(response.status, "set 500 status code").toStrictEqual(500);
            expect(await response.text(), "Internal Server Error");
            expect(consoleSpy.mock.calls[index], `called console.error ${index}`).toStrictEqual([error]);

            index += 1;
        };

        const request = { method: "GET", url: "http://localhost/" } as Request;

        const baseFunction = (_request: Request, _event: unknown, next: any) => next();

        await createEdgeRouter()
            .use(baseFunction)
            .use(async () => {
                throw error;
            })
            .get(badFunction)
            .handler()(request, {})
            .then(testResponse);
        await createEdgeRouter()
            .use(baseFunction)
            .get(() => {
                throw error;
            })
            .handler()(request, {})
            .then(testResponse);
    });

    it("handler() - calls custom onError", async () => {
        expect.assertions(1);

        await createEdgeRouter({
            onError(error) {
                expect((error as Error).message).toStrictEqual("💥");
            },
        })
            .get(() => {
                throw new Error("💥");
            })
            .handler()({ method: "GET", url: "http://localhost/" } as Request, {});
    });

    it("handler() - calls onNoMatch if no fns matched", async () => {
        expect.assertions(2);
        const request = { url: testUrl, method: "GET" } as Request;
        const response: Response = await createEdgeRouter().get("/foo").post("/foo/bar").handler()(request, {});

        expect(response.status).toStrictEqual(404);
        expect(await response.text()).toStrictEqual("Route GET http://localhost/foo/bar not found");
    });

    it("handler() - calls onNoMatch if only middle fns found", async () => {
        expect.assertions(2);

        const request = { url: testUrl, method: "GET" } as Request;
        const response: Response = await createEdgeRouter().use("", badFunction).use("/foo", badFunction).handler()(request, {});

        expect(response.status).toStrictEqual(404);
        expect(await response.text()).toStrictEqual("Route GET http://localhost/foo/bar not found");
    });

    it("handler() - calls onNoMatch if no fns matched (HEAD)", async () => {
        expect.assertions(2);
        const request = { url: testUrl, method: "HEAD" } as Request;
        const response: Response = await createEdgeRouter().get("/foo").post("/foo/bar").handler()(request, {});

        expect(response.status).toStrictEqual(404);
        expect(await response.text()).toStrictEqual("");
    });

    it("handler() - calls custom onNoMatch if not found", async () => {
        expect.assertions(1);

        await createEdgeRouter({
            onNoMatch() {
                expect(true, "onNoMatch called").toBeTruthy();
            },
        }).handler()({ url: testUrl, method: "GET" } as Request, {} as any);
    });

    it("handler() - calls onError if custom onNoMatch throws", async () => {
        expect.assertions(2);

        await createEdgeRouter({
            onNoMatch() {
                expect(true, "onNoMatch called").toBeTruthy();

                throw new Error("💥");
            },
            onError(error) {
                expect((error as Error).message, "💥");
            },
        }).handler()({ url: testUrl, method: "GET" } as Request, {} as never);
    });

    it("prepareRequest() - attach params", async () => {
        const request = {} as Request & { params?: Record<string, string> };

        const context2 = createEdgeRouter().get("/hello/:name");
        // @ts-expect-error: internal
        // eslint-disable-next-line radar/no-duplicate-string
        context2.prepareRequest(request, context2.router.find("GET", "/hello/world"));
        expect(request.params, "params are attached").toStrictEqual({ name: "world" });

        const requestWithParameters = {
            params: { age: "20" },
        };
        // @ts-expect-error: internal
        context2.prepareRequest(
            requestWithParameters as unknown as Request,
            // @ts-expect-error: internal
            context2.router.find("GET", "/hello/world"),
        );
        expect(requestWithParameters.params, "params are merged").toStrictEqual({ name: "world", age: "20" });

        const requestWithParameters2 = {
            params: { name: "sunshine" },
        };
        // @ts-expect-error: internal
        context2.prepareRequest(
            requestWithParameters2 as unknown as Request,
            // @ts-expect-error: internal
            context2.router.find("GET", "/hello/world"),
        );
        expect(requestWithParameters2.params, "params are merged (existing takes precedence)").toStrictEqual({ name: "sunshine" });
    });

    it("getPathname() - returns pathname correctly", async () => {
        expect(getPathname({ url: "http://google.com/foo/bar" } as Request)).toStrictEqual("/foo/bar");
        expect(getPathname({ url: "http://google.com/foo/bar?q=quz" } as Request)).toStrictEqual("/foo/bar");
        expect(
            getPathname({
                url: "http://google.com/do/not/use/me",
                // eslint-disable-next-line compat/compat
                nextUrl: new URL("http://google.com/foo/bar?q=quz"),
            } as unknown as Request),
            "get pathname using req.nextUrl",
        ).toStrictEqual("/foo/bar");
    });
});
