import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { useAbortBatch } from "../../src/react/use-abort-batch";
import { MockXMLHttpRequest } from "../mock-xhr";
import { renderHookWithQueryClient } from "./test-utils";

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
        expect.assertions(1);

        const { result } = renderHookWithQueryClient(() =>
            useAbortBatch({
                endpoint: "/api/upload",
            }),
        );

        expect(result.current.abortBatch).toBeDefined();

        expectTypeOf(result.current.abortBatch).toBeFunction();
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
