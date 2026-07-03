import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDevToolbarHook } from "../../src/hooks/create-hook";
import type { DevToolbarApp } from "../../src/types/app";
import type { DevToolbarHook } from "../../src/types/hooks";
import type { TimelineEvent } from "../../src/types/timeline";

const makeApp = (overrides: Partial<DevToolbarApp> = {}): DevToolbarApp => {
    return {
        icon: "<svg/>",
        id: "test-app",
        name: "Test App",
        ...overrides,
    };
};

const makeEvent = (overrides: Partial<TimelineEvent> = {}): TimelineEvent => {
    return {
        id: "evt-1",
        time: Date.now(),
        title: "Test",
        ...overrides,
    };
};

describe(createDevToolbarHook, () => {
    let hook: DevToolbarHook;

    beforeEach(() => {
        hook = createDevToolbarHook();
    });

    describe("on / emit", () => {
        it("calls registered handler when event is emitted", () => {
            expect.hasAssertions();

            const handler = vi.fn();

            hook.on("devtools:init", handler);
            hook.emit("devtools:init");

            expect(handler).toHaveBeenCalledTimes(1);
        });

        it("passes arguments through to the handler", () => {
            expect.hasAssertions();

            const handler = vi.fn();
            const error = new Error("oops");

            hook.on("app:error", handler);
            hook.emit("app:error", error, "app-id");

            expect(handler).toHaveBeenCalledWith(error, "app-id");
        });

        it("calls all registered handlers for the same event", () => {
            expect.hasAssertions();

            const h1 = vi.fn();
            const h2 = vi.fn();

            hook.on("devtools:open", h1);
            hook.on("devtools:open", h2);
            hook.emit("devtools:open", "some-app");

            expect(h1).toHaveBeenCalledTimes(1);
            expect(h2).toHaveBeenCalledTimes(1);
        });

        it("does not call handlers registered for a different event", () => {
            expect.hasAssertions();

            const handler = vi.fn();

            hook.on("devtools:open", handler);
            hook.emit("devtools:init");

            expect(handler).not.toHaveBeenCalled();
        });

        it("is a no-op when no handlers are registered", () => {
            expect.hasAssertions();

            expect(() => {
                hook.emit("devtools:close");
            }).not.toThrow();
        });

        it("continues calling remaining handlers when one throws", () => {
            expect.hasAssertions();

            const throwing = vi.fn().mockImplementation(() => {
                throw new Error("handler error");
            });
            const safe = vi.fn();

            hook.on("devtools:close", throwing);
            hook.on("devtools:close", safe);
            hook.emit("devtools:close");

            expect(safe).toHaveBeenCalledTimes(1);
        });

        it("returns an unsubscribe function from on()", () => {
            expect.hasAssertions();

            const handler = vi.fn();
            const off = hook.on("devtools:init", handler);

            off();
            hook.emit("devtools:init");

            expect(handler).not.toHaveBeenCalled();
        });

        it("unsubscribe does not affect other handlers for the same event", () => {
            expect.hasAssertions();

            const h1 = vi.fn();
            const h2 = vi.fn();
            const off = hook.on("devtools:init", h1);

            hook.on("devtools:init", h2);
            off();
            hook.emit("devtools:init");

            expect(h1).not.toHaveBeenCalled();
            expect(h2).toHaveBeenCalledTimes(1);
        });
    });

    describe("off", () => {
        it("removes a specific handler", () => {
            expect.hasAssertions();

            const handler = vi.fn();

            hook.on("devtools:init", handler);
            hook.off("devtools:init", handler);
            hook.emit("devtools:init");

            expect(handler).not.toHaveBeenCalled();
        });

        it("removes all handlers for an event when no handler is specified", () => {
            expect.hasAssertions();

            const h1 = vi.fn();
            const h2 = vi.fn();

            hook.on("devtools:close", h1);
            hook.on("devtools:close", h2);
            hook.off("devtools:close");
            hook.emit("devtools:close");

            expect(h1).not.toHaveBeenCalled();
            expect(h2).not.toHaveBeenCalled();
        });

        it("is a no-op when event has no handlers", () => {
            expect.hasAssertions();

            expect(() => {
                hook.off("devtools:init");
            }).not.toThrow();
        });

        it("is a no-op when removing a handler that was never registered", () => {
            expect.hasAssertions();

            const handler = vi.fn();

            expect(() => {
                hook.off("devtools:init", handler);
            }).not.toThrow();
        });

        it("cleans up the handler set when the last handler is removed", () => {
            expect.hasAssertions();

            const handler = vi.fn();

            hook.on("devtools:init", handler);
            hook.off("devtools:init", handler);

            // Emitting should not throw and handler should not be called
            hook.emit("devtools:init");

            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe("once", () => {
        it("calls the handler exactly once", () => {
            expect.hasAssertions();

            const handler = vi.fn();

            hook.once("devtools:init", handler);
            hook.emit("devtools:init");
            hook.emit("devtools:init");

            expect(handler).toHaveBeenCalledTimes(1);
        });

        it("passes arguments to the once handler", () => {
            expect.hasAssertions();

            const handler = vi.fn();

            hook.once("devtools:open", handler);
            hook.emit("devtools:open", "my-app");

            expect(handler).toHaveBeenCalledWith("my-app");
        });

        it("auto-removes the once handler after first call", () => {
            expect.hasAssertions();

            const handler = vi.fn();

            hook.once("devtools:close", handler);
            hook.emit("devtools:close");
            hook.emit("devtools:close");

            expect(handler).toHaveBeenCalledTimes(1);
        });

        it("does not interfere with regular on() handlers on the same event", () => {
            expect.hasAssertions();

            const onceHandler = vi.fn();
            const regularHandler = vi.fn();

            hook.once("devtools:init", onceHandler);
            hook.on("devtools:init", regularHandler);
            hook.emit("devtools:init");
            hook.emit("devtools:init");

            expect(onceHandler).toHaveBeenCalledTimes(1);
            expect(regularHandler).toHaveBeenCalledTimes(2);
        });
    });

    describe("registerApp", () => {
        it("invokes the onRegisterApp callback when provided", () => {
            expect.hasAssertions();

            const callback = vi.fn();
            const hookWithCallback = createDevToolbarHook(callback);
            const app = makeApp();

            hookWithCallback.registerApp(app);

            expect(callback).toHaveBeenCalledWith(app);
        });

        it("does not throw when no onRegisterApp callback is provided", () => {
            expect.hasAssertions();

            const app = makeApp();

            expect(() => {
                hook.registerApp(app);
            }).not.toThrow();
        });
    });

    describe("addTimelineEvent", () => {
        it("invokes the onTimelineEvent callback when provided", () => {
            expect.hasAssertions();

            const callback = vi.fn();
            const hookWithCallback = createDevToolbarHook(undefined, callback);
            const event = makeEvent();

            hookWithCallback.addTimelineEvent("hmr", event);

            expect(callback).toHaveBeenCalledWith("hmr", event);
        });

        it("also emits the timeline:event hook event", () => {
            expect.hasAssertions();

            const listener = vi.fn();
            const event = makeEvent();

            hook.on("timeline:event", listener);
            hook.addTimelineEvent("hmr", event);

            expect(listener).toHaveBeenCalledWith(event);
        });

        it("does not throw when no onTimelineEvent callback is provided", () => {
            expect.hasAssertions();

            const event = makeEvent();

            expect(() => {
                hook.addTimelineEvent("custom", event);
            }).not.toThrow();
        });

        it("calls both the callback and the event listener", () => {
            expect.hasAssertions();

            const callback = vi.fn();
            const listener = vi.fn();
            const hookWithCallback = createDevToolbarHook(undefined, callback);
            const event = makeEvent();

            hookWithCallback.on("timeline:event", listener);
            hookWithCallback.addTimelineEvent("network", event);

            expect(callback).toHaveBeenCalledTimes(1);
            expect(listener).toHaveBeenCalledTimes(1);
        });
    });
});
