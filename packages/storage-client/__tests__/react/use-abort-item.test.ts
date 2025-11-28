import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { useAbortItem } from "../../src/react/use-abort-item";
import { renderHookWithQueryClient } from "./test-utils";

// Mock XMLHttpRequest

class MockXMLHttpRequest {
    public readyState = 0;

    public status = 200;

    public statusText = "OK";

    public responseText = "";

    public response = "";

    public upload = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    };

    public open = vi.fn();

    public send = vi.fn();

    public setRequestHeader = vi.fn();

    public getResponseHeader = vi.fn(() => undefined);

    public addEventListener = vi.fn();

    public removeEventListener = vi.fn();

    public abort = vi.fn(() => {
        const handlers = this.eventListeners.get("abort");

        if (handlers) {
            handlers.forEach((handler) => handler(new Event("abort")));
        }
    });

    private eventListeners = new Map<string, Set<(event: Event) => void>>();
}

describe(useAbortItem, () => {
    let originalXHR: typeof XMLHttpRequest;

    beforeEach(() => {
        originalXHR = globalThis.XMLHttpRequest;
        // @ts-expect-error - Mock XMLHttpRequest
        globalThis.XMLHttpRequest = MockXMLHttpRequest;
        vi.clearAllMocks();
    });

    afterEach(() => {
        globalThis.XMLHttpRequest = originalXHR;
        vi.restoreAllMocks();
    });

    it("should provide abortItem function", () => {
        expect.assertions(1);

        const { result } = renderHookWithQueryClient(() =>
            useAbortItem({
                endpoint: "/api/upload",
            }),
        );

        expect(result.current.abortItem).toBeDefined();

        expectTypeOf(result.current.abortItem).toBeFunction();
    });

    it("should abort item without throwing", () => {
        expect.assertions(1);

        const { result } = renderHookWithQueryClient(() =>
            useAbortItem({
                endpoint: "/api/upload",
            }),
        );

        expect(() => {
            result.current.abortItem("test-item-id");
        }).not.toThrow();
    });
});
