// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mutable options that the vi.mock factory closes over.
// Set per-test; reset in beforeEach.
const mockOptions = {
    apps: {
        a11y: false,
        inspector: false,
        moduleGraph: false,
        performance: false,
        seo: false,
        settings: false,
        tailwind: false,
        timeline: false,
        viteConfig: false,
    },
    requireUrlFlag: false,
    urlFlagName: "devtools",
};

// Static mock — factory reads the mutable mockOptions object, so per-test
// changes to its properties are picked up when the module is re-imported
// after vi.resetModules().
vi.mock(import("virtual:visulima-dev-toolbar-options"), () => {
    return { default: mockOptions };
});
vi.mock(import("virtual:visulima-dev-toolbar-path:toolbar/index.js"), () => {
    return {};
});
vi.mock(import("virtual:visulima-dev-toolbar-path:apps/more/index.js"), () => {
    return {
        default: { icon: "", id: "more", name: "More" },
    };
});

/** Reset between tests. */
const resetGlobals = () => {
    // eslint-disable-next-line no-underscore-dangle
    delete (globalThis as any).__VISULIMA_DEVTOOLS_INITIALIZED__;
    document.body.replaceChildren();
};

describe("overlay — initToolbar", () => {
    beforeEach(async () => {
        // Flush any pending async work from the previous test's initToolbar() chain.
        // setTimeout(0) runs after all pending microtasks have settled.
        // eslint-disable-next-line no-promise-executor-return
        await new Promise<void>((resolve) => setTimeout(resolve, 0));

        vi.resetModules();

        // Restore defaults
        mockOptions.requireUrlFlag = false;
        resetGlobals();
    });

    afterEach(() => {
        document.body.replaceChildren();
    });

    it("sets __VISULIMA_DEV_TOOLBAR_OPTIONS__ on the global object when the module loads", async () => {
        expect.hasAssertions();

        await import("../../src/client/overlay");

        // Wait for initToolbar() to finish so it does not bleed into the next test
        await vi.waitFor(() => {
            // eslint-disable-next-line no-underscore-dangle
            expect((globalThis as any).__VISULIMA_DEVTOOLS_INITIALIZED__).toBe(true);
        });

        // eslint-disable-next-line no-underscore-dangle
        expect((globalThis as any).__VISULIMA_DEV_TOOLBAR_OPTIONS__).toBeDefined();
    });

    it("sets __VISULIMA_DEVTOOLS_INITIALIZED__ to true after successful initialization", async () => {
        expect.hasAssertions();

        await import("../../src/client/overlay");

        await vi.waitFor(() => {
            // eslint-disable-next-line no-underscore-dangle
            expect((globalThis as any).__VISULIMA_DEVTOOLS_INITIALIZED__).toBe(true);
        });
    });

    it("does not add a toolbar when __VISULIMA_DEVTOOLS_INITIALIZED__ is already true", async () => {
        expect.hasAssertions();

        // Simulate a prior initialization
        // eslint-disable-next-line no-underscore-dangle
        (globalThis as any).__VISULIMA_DEVTOOLS_INITIALIZED__ = true;

        await import("../../src/client/overlay");

        // initToolbar() returns before any await when the flag is set — one tick drains it
        await Promise.resolve();

        expect(document.querySelectorAll("dev-toolbar")).toHaveLength(0);
    });

    it("skips initialization when requireUrlFlag is true and the flag is absent from the URL", async () => {
        expect.hasAssertions();

        // Mutate the shared options object — the factory closure picks up the
        // change when the module is re-imported after beforeEach's resetModules().
        mockOptions.requireUrlFlag = true;

        // jsdom's default URL has no query params, so the flag is absent.
        await import("../../src/client/overlay");

        // isUrlFlagPresent() returns before any await — one tick drains it
        await Promise.resolve();

        expect(document.querySelectorAll("dev-toolbar")).toHaveLength(0);
        // Flag must NOT be set so a later navigation to the flagged URL can still init
        // eslint-disable-next-line no-underscore-dangle
        expect((globalThis as any).__VISULIMA_DEVTOOLS_INITIALIZED__).toBeUndefined();
    });

    it("resets __VISULIMA_DEVTOOLS_INITIALIZED__ to false when initialization fails", async () => {
        expect.hasAssertions();

        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

        // Spy on document.body.append to throw — this triggers the catch block in
        // initToolbar() after the toolbar element has been created but before it
        // is connected to the DOM, exercising the error-recovery path.
        const appendSpy = vi.spyOn(document.body, "append").mockImplementationOnce(() => {
            throw new Error("DOM append failed");
        });

        await import("../../src/client/overlay");

        await vi.waitFor(() => {
            // eslint-disable-next-line no-underscore-dangle
            expect((globalThis as any).__VISULIMA_DEVTOOLS_INITIALIZED__).toBe(false);
        });

        expect(document.querySelectorAll("dev-toolbar")).toHaveLength(0);

        appendSpy.mockRestore();
        errorSpy.mockRestore();
    });
});
