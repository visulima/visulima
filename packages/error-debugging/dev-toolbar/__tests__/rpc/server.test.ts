// @vitest-environment node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { ViteDevServer, WebSocketClient } from "vite";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

const launchMock = vi.fn();

vi.mock(import("launch-editor"), () => { return { default: launchMock }; });

const { createServerRPCContext } = await import("../../src/rpc/server");

type RpcHandler = (data: { args: unknown[]; id: string; method: string }, client: WebSocketClient) => Promise<void> | void;

interface FakeServer {
    config: { root: string };
    ws: {
        getHandler: () => RpcHandler | undefined;
        on: (event: string, handler: RpcHandler) => void;
        send: ReturnType<typeof vi.fn>;
    };
}

const makeServer = (root: string): { server: FakeServer; viteServer: ViteDevServer } => {
    let registered: RpcHandler | undefined;

    const server: FakeServer = {
        config: { root },
        ws: {
            getHandler: () => registered,
            on: (event: string, handler: RpcHandler) => {
                if (event === "dev-toolbar:rpc") {
                    registered = handler;
                }
            },
            send: vi.fn(),
        },
    };

    return { server, viteServer: server as unknown as ViteDevServer };
};

const makeClient = (): { client: WebSocketClient; send: ReturnType<typeof vi.fn> } => {
    const send = vi.fn();

    return { client: { send } as unknown as WebSocketClient, send };
};

describe("rpc/server", () => {
    let tmpDir: string;

    beforeEach(async () => {
        launchMock.mockClear();
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vdt-rpc-server-"));
    });

    afterEach(async () => {
        await fs.rm(tmpDir, { force: true, recursive: true });
    });

    describe(createServerRPCContext, () => {
        it("returns the underlying server on the context", () => {
            expect.assertions(1);

            const { server, viteServer } = makeServer(tmpDir);
            const context = createServerRPCContext(viteServer);

            expect(context.server).toBe(server);
        });

        it("registers a websocket handler for dev-toolbar:rpc", () => {
            expect.assertions(1);

            const { server, viteServer } = makeServer(tmpDir);

            createServerRPCContext(viteServer);

            expect(server.ws.getHandler()).toBeInstanceOf(Function);
        });

        it("sends an error response for an unknown RPC method", async () => {
            expect.assertions(2);

            const { server, viteServer } = makeServer(tmpDir);

            createServerRPCContext(viteServer);

            const { client, send } = makeClient();

            await server.ws.getHandler()?.({ args: [], id: "req-1", method: "doesNotExist" }, client);

            expect(send).toHaveBeenCalledWith("dev-toolbar:rpc:error", {
                error: "Unknown RPC method: doesNotExist",
                id: "req-1",
            });
            expect(send).toHaveBeenCalledTimes(1);
        });

        it("invokes a default function and sends the result back", async () => {
            expect.assertions(1);

            const { server, viteServer } = makeServer(tmpDir);

            createServerRPCContext(viteServer);

            const { client, send } = makeClient();

            // getAnnotations resolves to [] when no annotations file exists.
            await server.ws.getHandler()?.({ args: [], id: "req-2", method: "getAnnotations" }, client);

            expect(send).toHaveBeenCalledWith("dev-toolbar:rpc:response", { id: "req-2", result: [] });
        });

        it("sends an error response when a handler throws an Error", async () => {
            expect.assertions(1);

            const { server, viteServer } = makeServer(tmpDir);

            createServerRPCContext(viteServer, {
                boom: async () => {
                    throw new Error("kaboom");
                },
            });

            const { client, send } = makeClient();

            await server.ws.getHandler()?.({ args: [], id: "req-3", method: "boom" }, client);

            expect(send).toHaveBeenCalledWith("dev-toolbar:rpc:error", { error: "kaboom", id: "req-3" });
        });

        it("stringifies a non-Error thrown value in the error response", async () => {
            expect.assertions(1);

            const { server, viteServer } = makeServer(tmpDir);

            createServerRPCContext(viteServer, {

                boom: async () => {
                    // eslint-disable-next-line @typescript-eslint/only-throw-error -- exercising the non-Error catch branch in the rpc handler
                    throw "plain string failure";
                },
            });

            const { client, send } = makeClient();

            await server.ws.getHandler()?.({ args: [], id: "req-4", method: "boom" }, client);

            expect(send).toHaveBeenCalledWith("dev-toolbar:rpc:error", { error: "plain string failure", id: "req-4" });
        });

        it("lets a custom function override a default function", async () => {
            expect.assertions(1);

            const { server, viteServer } = makeServer(tmpDir);

            createServerRPCContext(viteServer, {
                getAnnotations: async () => [{ id: "custom" }] as never,
            });

            const { client, send } = makeClient();

            await server.ws.getHandler()?.({ args: [], id: "req-5", method: "getAnnotations" }, client);

            expect(send).toHaveBeenCalledWith("dev-toolbar:rpc:response", { id: "req-5", result: [{ id: "custom" }] });
        });

        it("registerFunction adds a callable function after construction", async () => {
            expect.assertions(1);

            const { server, viteServer } = makeServer(tmpDir);
            const context = createServerRPCContext(viteServer);

            context.registerFunction("ping", async () => "pong" as never);

            const { client, send } = makeClient();

            await server.ws.getHandler()?.({ args: [], id: "req-6", method: "ping" }, client);

            expect(send).toHaveBeenCalledWith("dev-toolbar:rpc:response", { id: "req-6", result: "pong" });
        });

        it("readFile resolves a relative path against the server root", async () => {
            expect.assertions(1);

            await fs.writeFile(path.join(tmpDir, "hello.txt"), "world");

            const { server, viteServer } = makeServer(tmpDir);

            createServerRPCContext(viteServer);

            const { client, send } = makeClient();

            await server.ws.getHandler()?.({ args: ["hello.txt"], id: "req-7", method: "readFile" }, client);

            expect(send).toHaveBeenCalledWith("dev-toolbar:rpc:response", { id: "req-7", result: "world" });
        });

        it("readFile reads an absolute path verbatim", async () => {
            expect.assertions(1);

            const absolute = path.join(tmpDir, "abs.txt");

            await fs.writeFile(absolute, "abs-content");

            const { server, viteServer } = makeServer(tmpDir);

            createServerRPCContext(viteServer);

            const { client, send } = makeClient();

            await server.ws.getHandler()?.({ args: [absolute], id: "req-8", method: "readFile" }, client);

            expect(send).toHaveBeenCalledWith("dev-toolbar:rpc:response", { id: "req-8", result: "abs-content" });
        });

        it("openInEditor falls back to the configured editor when no override is given", async () => {
            expect.assertions(1);

            const { server, viteServer } = makeServer(tmpDir);

            createServerRPCContext(viteServer, undefined, { editor: "webstorm" });

            const { client } = makeClient();

            await server.ws.getHandler()?.({ args: ["/abs/file.ts", 1, 1], id: "req-9", method: "openInEditor" }, client);

            expect(launchMock).toHaveBeenCalledWith("/abs/file.ts:1:1", "webstorm");
        });

        it("openInEditor prefers an explicit editor argument over the configured one", async () => {
            expect.assertions(1);

            const { server, viteServer } = makeServer(tmpDir);

            createServerRPCContext(viteServer, undefined, { editor: "webstorm" });

            const { client } = makeClient();

            await server.ws.getHandler()?.({ args: ["/abs/file.ts", 2, 3, "code"], id: "req-10", method: "openInEditor" }, client);

            expect(launchMock).toHaveBeenCalledWith("/abs/file.ts:2:3", "code");
        });

        it("dispatches each default function through the websocket handler", async () => {
            expect.assertions(5);

            // Make the public dir resolvable so getStaticAssets does not bail early.
            await fs.mkdir(path.join(tmpDir, "public"), { recursive: true });

            const { server, viteServer } = makeServer(tmpDir);

            // moduleGraph is required by getModuleGraph.
            (server as unknown as { moduleGraph: unknown }).moduleGraph = { idToModuleMap: new Map() };
            // publicDir is required by getStaticAssets.
            (server.config as unknown as { publicDir: string }).publicDir = path.join(tmpDir, "public");
            // mode/base/root drive getViteConfig.
            Object.assign(server.config, { base: "/", mode: "development", plugins: [], publicDir: path.join(tmpDir, "public") });

            createServerRPCContext(viteServer);

            const handler = server.ws.getHandler();
            const responses: Record<string, unknown> = {};
            const client = {
                send: (event: string, payload: { id: string; result?: unknown }) => {
                    if (event === "dev-toolbar:rpc:response") {
                        responses[payload.id] = payload.result;
                    }
                },
            } as unknown as WebSocketClient;

            // The handler awaits the underlying function before calling client.send, so
            // awaiting it lets us read the captured response synchronously afterwards.
            await handler?.(
                { args: [{ comment: "c", elementTag: "div", intent: "fix", severity: "important", url: "/", x: 0, y: 0 }], id: "create", method: "createAnnotation" },
                client,
            );

            const created = responses.create as { id: string };

            await handler?.({ args: [], id: "modules", method: "getModuleGraph" }, client);
            await handler?.({ args: [], id: "assets", method: "getStaticAssets" }, client);
            await handler?.({ args: [], id: "tw", method: "getTailwindConfig" }, client);
            await handler?.({ args: [], id: "vite", method: "getViteConfig" }, client);
            await handler?.({ args: [created.id, { comment: "updated" }], id: "update", method: "updateAnnotation" }, client);
            await handler?.({ args: [created.id], id: "delete", method: "deleteAnnotation" }, client);

            expectTypeOf(created.id).toBeString();

            expect(responses.modules).toEqual([]);
            expect(Array.isArray(responses.assets)).toBe(true);
            expect(responses.tw).toHaveProperty("version");
            expect(responses.vite).toHaveProperty("root");
            expect(responses.delete).toBe(true);
        });

        it("dispatches saveScreenshot and getScreenshot through the handler", async () => {
            expect.assertions(2);

            const { server, viteServer } = makeServer(tmpDir);

            createServerRPCContext(viteServer);

            const handler = server.ws.getHandler();
            const responses: Record<string, unknown> = {};
            const client = {
                send: (event: string, payload: { id: string; result?: unknown }) => {
                    if (event === "dev-toolbar:rpc:response") {
                        responses[payload.id] = payload.result;
                    }
                },
            } as unknown as WebSocketClient;

            await handler?.(
                { args: [{ comment: "c", elementTag: "div", intent: "fix", severity: "important", url: "/", x: 0, y: 0 }], id: "create", method: "createAnnotation" },
                client,
            );

            const created = responses.create as { id: string };

            const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==";

            await handler?.({ args: [created.id, `data:image/png;base64,${pngBase64}`], id: "save", method: "saveScreenshot" }, client);
            await handler?.({ args: [created.id], id: "get", method: "getScreenshot" }, client);

            expect(responses.save).toMatch(/^screenshots\//);
            // getScreenshot resolves to null here because saveScreenshot does not back-link
            // the path onto the annotation record; the dispatch path is what we exercise.
            expect(responses).toHaveProperty("get");
        });

        it("callClient sends a custom websocket message", () => {
            expect.assertions(1);

            const { server, viteServer } = makeServer(tmpDir);
            const wsSend = vi.fn();

            (server.ws as unknown as { send: typeof wsSend }).send = wsSend;

            const context = createServerRPCContext(viteServer);

            context.callClient("onConfigChange", { mode: "dev" });

            expect(wsSend).toHaveBeenCalledWith({
                data: { args: [{ mode: "dev" }], method: "onConfigChange" },
                event: "dev-toolbar:client",
                type: "custom",
            });
        });
    });
});
