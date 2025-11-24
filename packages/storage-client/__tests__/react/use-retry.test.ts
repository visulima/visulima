import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRetry } from "../../src/react/use-retry";
import { renderHookWithQueryClient } from "./test-utils";

// Mock XMLHttpRequest
class MockXMLHttpRequest {
    public readyState = 0;

    public status = 200;

    public statusText = "OK";

    public responseText = "";

    public response = "";

    private eventListeners = new Map<string, Set<(event: Event) => void>>();

    public upload = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    };

    public open = vi.fn();

    public send = vi.fn();

    public setRequestHeader = vi.fn();

    public getResponseHeader = vi.fn(() => null);

    public addEventListener = vi.fn();

    public removeEventListener = vi.fn();

    public abort = vi.fn();
}

describe("useRetry", () => {
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

    it("should provide retryItem function", () => {
        expect.assertions(1);

        const { result } = renderHookWithQueryClient(() =>
            useRetry({
                endpoint: "/api/upload",
            }),
        );

        expect(typeof result.current.retryItem).toBe("function");
    });

    it("should retry item without throwing", () => {
        expect.assertions(1);

        const { result } = renderHookWithQueryClient(() =>
            useRetry({
                endpoint: "/api/upload",
            }),
        );

        expect(() => {
            result.current.retryItem("test-item-id");
        }).not.toThrow();
    });
});

