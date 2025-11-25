import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { useAbortBatch } from "../../src/react/use-abort-batch";
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

describe(useAbortBatch, () => {
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

    it("should provide abortBatch function", () => {
        expect.assertions(2);

        const { result } = renderHookWithQueryClient(() =>
            useAbortBatch({
                endpoint: "/api/upload",
            }),
        );

        expect(result.current.abortBatch).toBeDefined();
        expect(typeof result.current.abortBatch).toBe("function");
    });

    it("should abort batch without throwing", () => {
        expect.assertions(1);

        const { result } = renderHookWithQueryClient(() =>
            useAbortBatch({
                endpoint: "/api/upload",
            }),
        );

        expect(() => {
            result.current.abortBatch("test-batch-id");
        }).not.toThrow();
    });
});
