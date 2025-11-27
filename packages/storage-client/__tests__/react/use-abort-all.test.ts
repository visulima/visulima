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

    public upload = {
        addEventListener: vi.fn<[string, (event: ProgressEvent) => void], void>(),
        removeEventListener: vi.fn<[string, (event: ProgressEvent) => void], void>(),
    };

    public open = vi.fn<[string, string | URL, boolean?, string?, string?], void>();

    public send = vi.fn<[Document | XMLHttpRequestBodyInit | null?], void>();

    public setRequestHeader = vi.fn<[string, string], void>();

    public getResponseHeader = vi.fn<[string], string | null>(() => undefined);

    public addEventListener = vi.fn<[string, (event: Event) => void], void>();

    public removeEventListener = vi.fn<[string, (event: Event) => void], void>();

    public abort = vi.fn<[], void>();

    private _eventListeners = new Map<string, Set<(event: Event) => void>>();
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
