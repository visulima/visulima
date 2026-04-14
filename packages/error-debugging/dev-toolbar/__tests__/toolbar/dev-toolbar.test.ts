// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock CSS-dependent stylesheet module to avoid CSSStyleSheet.replaceSync issues in jsdom
vi.mock(import("../../src/toolbar/stylesheet"), () => {
    return {
        default: undefined,
        sharedToolbarStylesheet: undefined,
    };
});

// Mock the hooks to avoid global state side effects
vi.mock(import("../../src/hooks/index"), () => {
    return {
        getGlobalHook: vi.fn(() => {
            return { emit: vi.fn() };
        }),
        setupGlobalHook: vi.fn(() => {
            return { emit: vi.fn() };
        }),
    };
});

// Mock settings to avoid localStorage dependencies
vi.mock(import("../../src/toolbar/settings"), () => {
    return {
        loadSettings: vi.fn(() => {
            return { defaultVisible: false };
        }),
        updateSettings: vi.fn(),
    };
});

// Mock RPC client
vi.mock(import("../../src/rpc/client"), () => {
    return {
        createClientRPCContext: vi.fn(() => {
            return { callServer: vi.fn() };
        }),
    };
});

// Mock timeline store
vi.mock(import("../../src/timeline/index"), () => {
    return {
        getTimelineStore: vi.fn(() => {
            return { addEvent: vi.fn() };
        }),
    };
});

// Mock JSX components to avoid full Preact render pipeline in unit tests
vi.mock(import("../../src/toolbar/components/index"), () => {
    return {
        ToolbarContainer: vi.fn(() => null),
    };
});

// Import the module to trigger customElements.define("dev-toolbar", DevToolbar)
await import("../../src/toolbar/index");

describe("devToolbar custom element — disconnectedCallback", () => {
    beforeEach(() => {
        document.body.replaceChildren();
    });

    afterEach(() => {
        document.body.replaceChildren();
    });

    it("does not throw when removed before init() is called", () => {
        expect.hasAssertions();

        const toolbar = document.createElement("dev-toolbar");

        document.body.append(toolbar);

        expect(() => {
            toolbar.remove();
        }).not.toThrow();
        expect(toolbar.isConnected).toBe(false);
    });

    it("allows a new instance to connect after the previous one is removed", () => {
        expect.hasAssertions();

        const first = document.createElement("dev-toolbar");

        document.body.append(first);
        first.remove();

        const second = document.createElement("dev-toolbar");

        document.body.append(second);

        expect(second.isConnected).toBe(true);
        expect(document.querySelectorAll("dev-toolbar")).toHaveLength(1);
    });
});

describe("devToolbar custom element — singleton guard", () => {
    beforeEach(() => {
        document.body.replaceChildren();
    });

    afterEach(() => {
        document.body.replaceChildren();
    });

    it("allows the first instance to remain in the DOM", () => {
        expect.hasAssertions();

        const toolbar = document.createElement("dev-toolbar");

        document.body.append(toolbar);

        expect(document.querySelectorAll("dev-toolbar")).toHaveLength(1);
        expect(toolbar.isConnected).toBe(true);
    });

    it("removes a second instance when appended after the first", () => {
        expect.hasAssertions();

        const first = document.createElement("dev-toolbar");
        const second = document.createElement("dev-toolbar");

        document.body.append(first);
        document.body.append(second);

        expect(document.querySelectorAll("dev-toolbar")).toHaveLength(1);
        expect(first.isConnected).toBe(true);
        expect(second.isConnected).toBe(false);
    });

    it("emits a warning when removing a duplicate", () => {
        expect.hasAssertions();

        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

        const first = document.createElement("dev-toolbar");
        const second = document.createElement("dev-toolbar");

        document.body.append(first);
        document.body.append(second);

        expect(warnSpy).toHaveBeenCalledExactlyOnceWith("[dev-toolbar] Only one instance is allowed. Removing duplicate.");

        warnSpy.mockRestore();
    });

    it("does not emit a warning for the first (and only) instance", () => {
        expect.hasAssertions();

        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

        document.body.append(document.createElement("dev-toolbar"));

        expect(warnSpy).not.toHaveBeenCalled();

        warnSpy.mockRestore();
    });

    it("keeps the first instance when three are appended", () => {
        expect.hasAssertions();

        const first = document.createElement("dev-toolbar");
        const second = document.createElement("dev-toolbar");
        const third = document.createElement("dev-toolbar");

        document.body.append(first);
        document.body.append(second);
        document.body.append(third);

        expect(document.querySelectorAll("dev-toolbar")).toHaveLength(1);
        expect(first.isConnected).toBe(true);
        expect(second.isConnected).toBe(false);
        expect(third.isConnected).toBe(false);
    });
});
