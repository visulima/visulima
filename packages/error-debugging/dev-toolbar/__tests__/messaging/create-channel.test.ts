import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMessageChannel, handleMessage } from "../../src/messaging/create-channel";
import type { MessageEnvelope, MessageHandlers } from "../../src/messaging/types";

type TestEvents = {
    "data:update": (payload: { value: number }) => void;
    "user:login": (userId: string) => void;
    "user:logout": () => void;
};

const makeHandlers = (): MessageHandlers => new Map();

describe("createMessageChannel", () => {
    let handlers: MessageHandlers;
    let sendFn: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        handlers = makeHandlers();
        sendFn = vi.fn();
    });

    const makeChannel = () => createMessageChannel<TestEvents>(handlers, sendFn);

    describe("on / send", () => {
        it("registers a handler that is stored in the handlers map", () => {
            const channel = makeChannel();
            const handler = vi.fn();

            channel.on("user:login", handler);

            expect(handlers.has("user:login")).toBe(true);
        });

        it("send() invokes the sendFn with the event name and arguments", () => {
            const channel = makeChannel();

            channel.send("user:login", "alice");

            expect(sendFn).toHaveBeenCalledWith("user:login", "alice");
        });

        it("send() passes multiple arguments to sendFn", () => {
            const channel = makeChannel();

            channel.send("data:update", { value: 42 });

            expect(sendFn).toHaveBeenCalledWith("data:update", { value: 42 });
        });

        it("on() returns an unsubscribe function", () => {
            const channel = makeChannel();
            const handler = vi.fn();
            const off = channel.on("user:login", handler);

            expect(typeof off).toBe("function");
        });

        it("unsubscribe function removes the handler", () => {
            const channel = makeChannel();
            const handler = vi.fn();
            const off = channel.on("user:login", handler);

            off();

            expect(handlers.has("user:login")).toBe(false);
        });

        it("unsubscribe does not affect other handlers on the same event", () => {
            const channel = makeChannel();
            const h1 = vi.fn();
            const h2 = vi.fn();
            const off = channel.on("user:login", h1);

            channel.on("user:login", h2);
            off();

            expect(handlers.get("user:login")?.size).toBe(1);
        });

        it("multiple handlers can be registered for the same event", () => {
            const channel = makeChannel();

            channel.on("user:login", vi.fn());
            channel.on("user:login", vi.fn());

            expect(handlers.get("user:login")?.size).toBe(2);
        });
    });

    describe("off", () => {
        it("removes a specific handler for an event", () => {
            const channel = makeChannel();
            const handler = vi.fn();

            channel.on("user:login", handler);
            channel.off("user:login", handler);

            expect(handlers.has("user:login")).toBe(false);
        });

        it("removes all handlers when no handler argument is passed", () => {
            const channel = makeChannel();

            channel.on("user:login", vi.fn());
            channel.on("user:login", vi.fn());
            channel.off("user:login");

            expect(handlers.has("user:login")).toBe(false);
        });

        it("is a no-op when the event has no registered handlers", () => {
            const channel = makeChannel();

            expect(() => channel.off("user:login")).not.toThrow();
        });

        it("does not remove the entry when the handler set is still non-empty", () => {
            const channel = makeChannel();
            const h1 = vi.fn();
            const h2 = vi.fn();

            channel.on("user:login", h1);
            channel.on("user:login", h2);
            channel.off("user:login", h1);

            expect(handlers.has("user:login")).toBe(true);
            expect(handlers.get("user:login")?.size).toBe(1);
        });
    });

    describe("once", () => {
        it("calls handleMessage for a once-registered event exactly once", () => {
            const channel = makeChannel();
            const handler = vi.fn();

            channel.once("user:login", handler);

            // Simulate receiving the message via handleMessage
            handleMessage(handlers, { event: "user:login", data: "bob" });
            handleMessage(handlers, { event: "user:login", data: "carol" });

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith("bob", expect.objectContaining({ event: "user:login" }));
        });

        it("auto-removes the once handler after the first invocation", () => {
            const channel = makeChannel();
            const handler = vi.fn();

            channel.once("user:logout", handler);
            handleMessage(handlers, { event: "user:logout" });

            expect(handlers.has("user:logout")).toBe(false);
        });

        it("does not interfere with regular on() handlers", () => {
            const channel = makeChannel();
            const onceHandler = vi.fn();
            const regularHandler = vi.fn();

            channel.once("user:login", onceHandler);
            channel.on("user:login", regularHandler);
            handleMessage(handlers, { event: "user:login", data: "dave" });
            handleMessage(handlers, { event: "user:login", data: "eve" });

            expect(onceHandler).toHaveBeenCalledTimes(1);
            expect(regularHandler).toHaveBeenCalledTimes(2);
        });
    });
});

describe("handleMessage", () => {
    let handlers: MessageHandlers;

    beforeEach(() => {
        handlers = makeHandlers();
    });

    it("calls all registered handlers for the event", () => {
        const h1 = vi.fn();
        const h2 = vi.fn();

        handlers.set("ping", new Set([h1, h2]));

        const envelope: MessageEnvelope = { event: "ping", data: "pong" };

        handleMessage(handlers, envelope);

        expect(h1).toHaveBeenCalledWith("pong", envelope);
        expect(h2).toHaveBeenCalledWith("pong", envelope);
    });

    it("passes data and the full envelope to each handler", () => {
        const handler = vi.fn();
        const envelope: MessageEnvelope = { data: { x: 1 }, event: "update", id: "req-1", timestamp: 123 };

        handlers.set("update", new Set([handler]));
        handleMessage(handlers, envelope);

        expect(handler).toHaveBeenCalledWith({ x: 1 }, envelope);
    });

    it("is a no-op when no handlers are registered for the event", () => {
        const envelope: MessageEnvelope = { event: "unknown" };

        expect(() => handleMessage(handlers, envelope)).not.toThrow();
    });

    it("is a no-op when handler set is empty", () => {
        handlers.set("empty", new Set());

        const envelope: MessageEnvelope = { event: "empty" };

        expect(() => handleMessage(handlers, envelope)).not.toThrow();
    });

    it("continues calling remaining handlers when one throws", () => {
        const throwing = vi.fn().mockImplementation(() => {
            throw new Error("handler error");
        });
        const safe = vi.fn();

        handlers.set("error-event", new Set([throwing, safe]));
        handleMessage(handlers, { event: "error-event" });

        expect(safe).toHaveBeenCalledOnce();
    });

    it("handles undefined data gracefully", () => {
        const handler = vi.fn();
        const envelope: MessageEnvelope = { event: "no-data" };

        handlers.set("no-data", new Set([handler]));
        handleMessage(handlers, envelope);

        expect(handler).toHaveBeenCalledWith(undefined, envelope);
    });
});
