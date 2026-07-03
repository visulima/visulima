// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { createClientRPCContext } from "../../src/rpc/client";

// NOTE: In the Vitest runtime `import.meta.hot` is a real HMR stub, but each
// module owns its OWN hot instance, so a test cannot intercept the source
// module's `import.meta.hot.on`/`send` to drive the response/error/timeout
// paths or fire server-initiated client calls. Those branches are only
// reachable against a live Vite dev server and are intentionally left
// uncovered here. We cover the parts that are observable from the public API.

describe("rpc/client", () => {
    describe(createClientRPCContext, () => {
        it("returns a context exposing callServer and registerFunction", () => {
            expect.assertions(2);

            const context = createClientRPCContext();

            expect(context.callServer).toBeInstanceOf(Function);
            expect(context.registerFunction).toBeInstanceOf(Function);
        });

        it("constructs with no-op default client functions without throwing", () => {
            expect.assertions(1);

            expect(() => createClientRPCContext()).not.toThrow();
        });

        it("merges custom client functions over the defaults", () => {
            expect.assertions(1);

            const onConfigChange = vi.fn();

            expect(() => createClientRPCContext({ onConfigChange })).not.toThrow();
        });

        it("registerFunction accepts a replacement handler without throwing", () => {
            expect.assertions(1);

            const context = createClientRPCContext();

            expect(() => {
                context.registerFunction("onConfigChange", vi.fn());
                context.registerFunction("onHMRUpdate", vi.fn());
                context.registerFunction("onModuleUpdate", vi.fn());
            }).not.toThrow();
        });
    });
});
