import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { useAbortAll } from "../../src/react/use-abort-all";
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

describe(useAbortAll, () => {
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

    it("should provide abortAll function", () => {
        expect.assertions(2);

        const { result } = renderHookWithQueryClient(() =>
            useAbortAll({
                endpoint: "/api/upload",
            }),
        );

        expect(result.current.abortAll).toBeDefined();
        expect(typeof result.current.abortAll).toBe("function");
    });

    it("should abort all uploads without throwing", () => {
        expect.assertions(1);

        const { result } = renderHookWithQueryClient(() =>
            useAbortAll({
                endpoint: "/api/upload",
            }),
        );

        expect(() => {
            result.current.abortAll();
        }).not.toThrow();
    });
});
