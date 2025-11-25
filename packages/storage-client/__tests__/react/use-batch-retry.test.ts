import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { useBatchRetry } from "../../src/react/use-batch-retry";
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

describe(useBatchRetry, () => {
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

    it("should provide retryBatch function", () => {
        expect.assertions(2);

        const { result } = renderHookWithQueryClient(() =>
            useBatchRetry({
                endpoint: "/api/upload",
            }),
        );

        expect(result.current.retryBatch).toBeDefined();
        expect(typeof result.current.retryBatch).toBe("function");
    });

    it("should retry batch without throwing", () => {
        expect.assertions(1);

        const { result } = renderHookWithQueryClient(() =>
            useBatchRetry({
                endpoint: "/api/upload",
            }),
        );

        expect(() => {
            result.current.retryBatch("test-batch-id");
        }).not.toThrow();
    });
});
