import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { ModuleOptions } from "../../../src/adapter/nuxt/module";
import nuxtModule from "../../../src/adapter/nuxt/module";
import MemoryStorage from "../../../src/storage/memory/memory-storage";
import type { Send } from "../../__helpers__/handler/flows";
import { MULTIPART_FLOW_ASSERTIONS, multipartFlow, REST_FLOW_ASSERTIONS, restFlow, TUS_FLOW_ASSERTIONS, tusFlow } from "../../__helpers__/handler/flows";

// Only the module definition is under test: hand it back as written so `setup` can be called directly.
vi.mock(import('@nuxt/kit'), () => {
    return { defineNuxtModule: (definition: unknown) => definition };
});

type RequestHook = (event: { node: { req: IncomingMessage; res: ServerResponse } }) => Promise<void>;

interface SetupResult {
    nitroConfig: { routeRules: Record<string, unknown> };
    requestHook: RequestHook;
}

/** Runs the module's setup against a minimal Nuxt and returns the Nitro config it built and its request hook. */
const setup = async (options: ModuleOptions): Promise<SetupResult> => {
    const hooks = new Map<string, (argument: unknown) => void>();
    let requestHook: RequestHook | undefined;

    await (nuxtModule as { setup: (options: ModuleOptions, nuxt: unknown) => Promise<void> }).setup(options, {
        hook: (name: string, callback: (argument: unknown) => void) => hooks.set(name, callback),
    });

    const nitroConfig = { routeRules: {} };

    hooks.get("nitro:config")?.(nitroConfig);
    hooks.get("nitro:init")?.({
        hooks: {
            hook: (name: string, callback: RequestHook) => {
                if (name === "request") {
                    requestHook = callback;
                }
            },
        },
    });

    return { nitroConfig, requestHook: requestHook as RequestHook };
};

/** Serves the request hook; whatever it leaves unanswered falls through to a 418 so routing is observable. */
const serve = async (requestHook: RequestHook): Promise<{ send: Send; server: Server }> => {
    const server = createServer((request, response) => {
        void requestHook({ node: { req: request, res: response } }).then(() => {
            if (!response.headersSent) {
                response.writeHead(418).end("not handled");
            }
        });
    });

    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", resolve);
    });

    const { port } = server.address() as AddressInfo;

    return { send: async (path, init) => fetch(`http://127.0.0.1:${String(port)}${path}`, init), server };
};

const close = async (server: Server): Promise<void> => {
    await new Promise((resolve) => {
        server.close(resolve);
    });
};

describe("nuxt module", () => {
    it("should require a storage instance", async () => {
        expect.assertions(1);

        await expect(setup({} as ModuleOptions)).rejects.toThrow("Storage instance is required");
    });

    describe("default options", () => {
        let send: Send;
        let server: Server;
        let nitroConfig: SetupResult["nitroConfig"];

        beforeAll(async () => {
            const result = await setup({ basePath: "/api/upload", storage: new MemoryStorage() });

            nitroConfig = result.nitroConfig;
            ({ send, server } = await serve(result.requestHook));
        });

        afterAll(async () => {
            await close(server);
        });

        it("should add CORS route rules for every enabled handler", () => {
            expect.assertions(1);

            expect(nitroConfig.routeRules).toStrictEqual({
                "/api/upload/multipart/**": { cors: true },
                "/api/upload/rest/**": { cors: true },
                "/api/upload/tus/**": { cors: true },
            });
        });

        it("should run the REST flow through the request hook", async () => {
            expect.assertions(REST_FLOW_ASSERTIONS);

            await restFlow(send, "/api/upload/rest");
        });

        it("should run the TUS flow through the request hook", async () => {
            expect.assertions(TUS_FLOW_ASSERTIONS);

            await tusFlow(send, "/api/upload/tus");
        });

        it("should run the multipart flow through the request hook", async () => {
            expect.assertions(MULTIPART_FLOW_ASSERTIONS);

            await multipartFlow(send, "/api/upload/multipart");
        });

        it("should route a mount path with a query string", async () => {
            expect.assertions(1);

            const response = await send("/api/upload/rest?limit=1", { method: "OPTIONS" });

            expect(response.status).toBe(204);
        });

        it.each(["/api/upload/restricted", "/api/upload/tusk/abc", "/api/upload/multipart-old", "/api/upload", "/other"])(
            "should leave %s to the rest of the app",
            async (path) => {
                expect.assertions(1);

                const response = await send(path, { method: "OPTIONS" });

                expect(response.status).toBe(418);
            },
        );

        it("should send the default CORS headers", async () => {
            expect.assertions(4);

            // A GET: the handlers' own preflight answers set Allow-Headers/-Methods themselves.
            const response = await send("/api/upload/rest/missing-file-id", { headers: { origin: "https://app.example" } });

            expect(response.headers.get("access-control-allow-origin")).toBe("*");
            expect(response.headers.get("access-control-allow-methods")).toContain("PATCH");
            expect(response.headers.get("access-control-allow-headers")).toContain("Upload-Offset");
            expect(response.headers.get("vary")).toBeNull();
        });
    });

    describe("cors and handler toggles", () => {
        let send: Send;
        let server: Server;
        let nitroConfig: SetupResult["nitroConfig"];

        beforeAll(async () => {
            const result = await setup({
                basePath: "/cors",
                cors: { origin: ["https://a.example", "https://b.example"] },
                multipart: false,
                storage: new MemoryStorage(),
                tus: false,
            });

            nitroConfig = result.nitroConfig;
            ({ send, server } = await serve(result.requestHook));
        });

        afterAll(async () => {
            await close(server);
        });

        it("should only register enabled handlers", async () => {
            expect.assertions(2);

            expect(Object.keys(nitroConfig.routeRules)).toStrictEqual(["/cors/rest/**"]);

            const tus = await send("/cors/tus", { method: "OPTIONS" });

            expect(tus.status).toBe(418);
        });

        it("should echo an allowed origin and vary on it", async () => {
            expect.assertions(2);

            const response = await send("/cors/rest", { headers: { origin: "https://b.example" }, method: "OPTIONS" });

            expect(response.headers.get("access-control-allow-origin")).toBe("https://b.example");
            expect(response.headers.get("vary")).toBe("Origin");
        });

        it("should not allow an origin outside the list but still vary on it", async () => {
            expect.assertions(2);

            const response = await send("/cors/rest", { headers: { origin: "https://evil.example" }, method: "OPTIONS" });

            expect(response.headers.get("access-control-allow-origin")).toBeNull();
            expect(response.headers.get("vary")).toBe("Origin");
        });

        it("should send no methods or headers when they are not configured", async () => {
            expect.assertions(1);

            const response = await send("/cors/rest", { headers: { origin: "https://a.example" }, method: "GET" });

            // The REST handler sets its own Allow-Methods only on OPTIONS, so none comes from the module here.
            expect(response.headers.get("access-control-allow-methods")).toBeNull();
        });
    });

    it("should send a single configured origin as is", async () => {
        expect.assertions(1);

        const { requestHook } = await setup({ basePath: "/single", cors: { origin: "https://only.example" }, storage: new MemoryStorage() });
        const { send, server } = await serve(requestHook);

        const response = await send("/single/rest", { method: "OPTIONS" });

        expect(response.headers.get("access-control-allow-origin")).toBe("https://only.example");

        await close(server);
    });
});
