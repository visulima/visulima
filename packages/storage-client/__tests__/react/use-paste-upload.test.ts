import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { usePasteUpload } from "../../src/react/use-paste-upload";

describe(usePasteUpload, () => {
    it("should initialize with empty pasted files", () => {
        expect.assertions(1);

        const { result } = renderHook(() => usePasteUpload());

        expect(result.current.pastedFiles).toEqual([]);
    });

    it("should provide handlePaste function", () => {
        expect.assertions(2);

        const { result } = renderHook(() => usePasteUpload());

        expect(result.current.handlePaste).toBeDefined();
        expect(typeof result.current.handlePaste).toBe("function");
    });

    it("should handle paste event with files", async () => {
        const onFilesPasted = vi.fn();

        const { result } = renderHook(() =>
            usePasteUpload({
                onFilesPasted,
            }),
        );

        const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
        const clipboardData = {
            items: [
                {
                    getAsFile: () => file,
                    kind: "file",
                },
            ],
        };

        const pasteEvent = new ClipboardEvent("paste", {
            bubbles: true,
            cancelable: true,
        });

        Object.defineProperty(pasteEvent, "clipboardData", {
            value: clipboardData,
            writable: false,
        });

        result.current.handlePaste(pasteEvent as unknown as React.ClipboardEvent<HTMLElement>);

        await waitFor(() => {
            expect(result.current.pastedFiles).toHaveLength(1);
        });

        expect(onFilesPasted).toHaveBeenCalledWith([file]);
    });

    it("should filter files when filter function provided", async () => {
        const filter = vi.fn((file: File) => file.type === "image/jpeg");
        const onFilesPasted = vi.fn();

        const { result } = renderHook(() =>
            usePasteUpload({
                filter,
                onFilesPasted,
            }),
        );

        const file1 = new File(["test1"], "test1.jpg", { type: "image/jpeg" });
        const file2 = new File(["test2"], "test2.png", { type: "image/png" });

        const clipboardData = {
            items: [
                {
                    getAsFile: () => file1,
                    kind: "file",
                },
                {
                    getAsFile: () => file2,
                    kind: "file",
                },
            ],
        };

        const pasteEvent = new ClipboardEvent("paste", {
            bubbles: true,
            cancelable: true,
        });

        Object.defineProperty(pasteEvent, "clipboardData", {
            value: clipboardData,
            writable: false,
        });

        result.current.handlePaste(pasteEvent as unknown as React.ClipboardEvent<HTMLElement>);

        await waitFor(() => {
            expect(result.current.pastedFiles).toHaveLength(1);
        });

        expect(onFilesPasted).toHaveBeenCalledWith([file1]);
    });

    it("should reset pasted files", async () => {
        const { result } = renderHook(() => usePasteUpload());

        const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
        const clipboardData = {
            items: [
                {
                    getAsFile: () => file,
                    kind: "file",
                },
            ],
        };

        const pasteEvent = new ClipboardEvent("paste", {
            bubbles: true,
            cancelable: true,
        });

        Object.defineProperty(pasteEvent, "clipboardData", {
            value: clipboardData,
            writable: false,
        });

        result.current.handlePaste(pasteEvent as unknown as React.ClipboardEvent<HTMLElement>);

        await waitFor(() => {
            expect(result.current.pastedFiles).toHaveLength(1);
        });

        result.current.reset();

        await waitFor(() => {
            expect(result.current.pastedFiles).toEqual([]);
        });
    });
});
