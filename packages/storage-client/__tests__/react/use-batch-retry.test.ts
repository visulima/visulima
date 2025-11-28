import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { useBatchRetry } from "../../src/react/use-batch-retry";
import { MockXMLHttpRequest } from "../mock-xhr";
import { renderHookWithQueryClient } from "./test-utils";

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
        expect.assertions(1);

        const { result } = renderHookWithQueryClient(() =>
            useBatchRetry({
                endpoint: "/api/upload",
            }),
        );

        expect(result.current.retryBatch).toBeDefined();

        expectTypeOf(result.current.retryBatch).toBeFunction();
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
