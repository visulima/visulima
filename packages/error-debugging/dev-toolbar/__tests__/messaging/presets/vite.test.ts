// @vitest-environment jsdom
import type { ViteDevServer, WebSocketClient } from "vite";
import { describe, expect, it, vi } from "vitest";

import { createViteHMRClient } from "../../../src/messaging/presets/vite/client";
import { createViteHMRContext } from "../../../src/messaging/presets/vite/context";
import { createViteHMRServer } from "../../../src/messaging/presets/vite/server";
import type { MessageHandlers } from "../../../src/messaging/types";

const makeHandlers = (): MessageHandlers => new Map();

type WsHandler = (data: { data?: unknown; event: string }, client: WebSocketClient) => void;

describe("messaging/presets/vite", () => {
    describe(createViteHMRContext, () => {
        it("creates a channel exposing the message-channel surface", () => {
            expect.assertions(3);

            const context = createViteHMRContext(makeHandlers());
            const channel = context.createChannel();

            expect(channel.on).toBeInstanceOf(Function);
            expect(channel.send).toBeInstanceOf(Function);
            expect(channel.off).toBeInstanceOf(Function);
        });

        it("send goes through import.meta.hot without throwing", () => {
            expect.assertions(1);

            const channel = createViteHMRContext(makeHandlers()).createChannel();

            expect(() => { channel.send("dev-toolbar:ready"); }).not.toThrow();
        });
    });

    describe(createViteHMRClient, () => {
        it("creates a channel and its send path runs without throwing", () => {
            expect.assertions(2);

            const channel = createViteHMRClient(makeHandlers());

            expect(channel.send).toBeInstanceOf(Function);
            expect(() => { channel.send("dev-toolbar:rpc", { args: [], id: "1", method: "x" }); }).not.toThrow();
        });
    });

    describe(createViteHMRServer, () => {
        it("registers a websocket listener and dispatches incoming client messages to handlers", () => {
            expect.assertions(2);

            let wsHandler: WsHandler | undefined;
            const fakeServer = {
                ws: {
                    on: (event: string, handler: WsHandler) => {
                        if (event === "dev-toolbar:client") {
                            wsHandler = handler;
                        }
                    },
                    send: vi.fn(),
                },
            } as unknown as ViteDevServer;

            const handlers = makeHandlers();
            const channel = createViteHMRServer(fakeServer, handlers);

            const received = vi.fn();

            channel.on("dev-toolbar:ready", received);

            // Simulate an inbound websocket message from the client.
            wsHandler?.({ data: { foo: "bar" }, event: "dev-toolbar:ready" }, {} as WebSocketClient);

            expect(received).toHaveBeenCalledTimes(1);
            expect(received).toHaveBeenCalledWith({ foo: "bar" }, expect.objectContaining({ event: "dev-toolbar:ready" }));
        });

        it("send posts a custom websocket message namespaced with dev-toolbar:", () => {
            expect.assertions(1);

            const wsSend = vi.fn();
            const fakeServer = {
                ws: {
                    on: () => {},
                    send: wsSend,
                },
            } as unknown as ViteDevServer;

            const channel = createViteHMRServer(fakeServer, makeHandlers());

            channel.send("dev-toolbar:init");

            expect(wsSend).toHaveBeenCalledWith({
                data: [],
                event: "dev-toolbar:dev-toolbar:init",
                type: "custom",
            });
        });
    });
});
