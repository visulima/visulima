import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { useRetry } from "../../src/react/use-retry";
import { MockXMLHttpRequest, renderHookWithQueryClient } from "./test-utils";

describe(useRetry, () => {
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
        const { result } = renderHookWithQueryClient(() =>
            useRetry({
                endpoint: "/api/upload",
            }),
        );

        expect(result.current.retryItem).toBeDefined();

        expectTypeOf(result.current.retryItem).toBeFunction();
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
