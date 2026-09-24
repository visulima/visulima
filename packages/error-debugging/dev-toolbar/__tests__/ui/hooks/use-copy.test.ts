// @vitest-environment jsdom
import "../../setup";

import { act, cleanup, renderHook, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCopy } from "../../../src/ui/hooks/use-copy";

const writeText = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
    writeText.mockReset();
    writeText.mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe(useCopy, () => {
    it("writes the text to the clipboard", async () => {
        expect.hasAssertions();

        const { result } = renderHook(() => useCopy());

        await act(() => {
            result.current.copy("hello");
        });

        await waitFor(() => {
            expect(writeText).toHaveBeenCalledWith("hello");
        });
    });

    it("raises the flag once the write resolves", async () => {
        expect.hasAssertions();

        const { result } = renderHook(() => useCopy());

        expect(result.current.copied).toBe(false);

        await act(() => {
            result.current.copy("hello");
        });

        await waitFor(() => {
            expect(result.current.copied).toBe(true);
        });
    });

    it("leaves the flag down when the write is rejected", async () => {
        expect.hasAssertions();

        writeText.mockRejectedValue(new Error("not allowed"));

        const { result } = renderHook(() => useCopy());

        await act(() => {
            result.current.copy("hello");
        });

        await waitFor(() => {
            expect(writeText).toHaveBeenCalledWith("hello");
        });

        expect(result.current.copied).toBe(false);
    });

    it("lowers the flag again after the flash", async () => {
        expect.hasAssertions();

        vi.useFakeTimers({ shouldAdvanceTime: true });

        const { result } = renderHook(() => useCopy());

        await act(() => {
            result.current.copy("hello");
        });

        await waitFor(() => {
            expect(result.current.copied).toBe(true);
        });

        await act(() => {
            vi.advanceTimersByTime(1500);
        });

        expect(result.current.copied).toBe(false);
    });

    it("clears the pending reset on unmount", async () => {
        expect.hasAssertions();

        // `copy` clears a previous timer too, so only the calls made *after*
        // unmount prove the cleanup ran — a plain toHaveBeenCalled() passes
        // even with the effect deleted.
        const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
        const { result, unmount } = renderHook(() => useCopy());

        await act(() => {
            result.current.copy("hello");
        });

        await waitFor(() => {
            expect(result.current.copied).toBe(true);
        });

        const callsBeforeUnmount = clearTimeoutSpy.mock.calls.length;

        unmount();

        expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThan(callsBeforeUnmount);
    });
});
