// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { createBroadcastChannel } from "../../../src/messaging/presets/broadcast-channel/index";
import type { MessageHandlers } from "../../../src/messaging/types";

const makeHandlers = (): MessageHandlers => new Map();

describe("messaging/presets/broadcast-channel", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe(createBroadcastChannel, () => {
        it("delivers a posted message to a registered handler across two channels", async () => {
            expect.hasAssertions();

            const channelName = `vdt-test-${String(Date.now())}`;
            const receiverHandlers = makeHandlers();
            const receiver = createBroadcastChannel(channelName, receiverHandlers);
            const sender = createBroadcastChannel(channelName, makeHandlers());

            const handler = vi.fn();

            receiver.on("dev-toolbar:message", handler);

            sender.send("dev-toolbar:message", { hello: "world" });

            // BroadcastChannel delivery is async (macrotask), so poll the mock.
            await vi.waitFor(() => {
                if (handler.mock.calls.length === 0) {
                    throw new Error("not delivered yet");
                }
            });

            expect(handler).toHaveBeenCalledTimes(1);

            const [data] = handler.mock.calls[0] as [unknown];

            expect(data).toEqual([{ hello: "world" }]);
        });

        it("returns a working no-op channel when BroadcastChannel is unavailable", () => {
            expect.assertions(2);

            const original = globalThis.BroadcastChannel;

            // Simulate an environment without BroadcastChannel.
            (globalThis as Record<string, unknown>).BroadcastChannel = undefined;

            try {
                const channel = createBroadcastChannel("noop", makeHandlers());

                expect(channel.send).toBeInstanceOf(Function);
                // send is a no-op send function — calling it must not throw.
                expect(() => { channel.send("dev-toolbar:message", {}); }).not.toThrow();
            } finally {
                (globalThis as Record<string, unknown>).BroadcastChannel = original;
            }
        });
    });
});
