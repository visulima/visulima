import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRetry } from "../../src/react/use-retry";
import { MockXMLHttpRequest, renderHookWithQueryClient } from "./test-utils";

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

