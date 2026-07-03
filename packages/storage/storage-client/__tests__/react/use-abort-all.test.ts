import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { useAbortAll } from "../../src/react/use-abort-all";
import { MockXMLHttpRequest } from "../mock-xhr";
import { renderHookWithQueryClient } from "./test-utils";

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
        expect.assertions(1);

        const { result } = renderHookWithQueryClient(() =>
            useAbortAll({
                endpoint: "/api/upload",
            }),
        );

        expect(result.current.abortAll).toBeDefined();

        expectTypeOf(result.current.abortAll).toBeFunction();
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
