import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { useFileInput } from "../../src/react/use-file-input";

describe(useFileInput, () => {
    it("should initialize with empty files", () => {
        expect.assertions(1);

        const { result } = renderHook(() => useFileInput());

        expect(result.current.files).toStrictEqual([]);
    });

    it("should provide inputRef", () => {
        expect.assertions(1);

        const { result } = renderHook(() => useFileInput());

        expect(result.current.inputRef).toBeDefined();
    });

    it("should provide file handling functions", () => {
        expect.assertions(5);

        const { result } = renderHook(() => useFileInput());

        expect(result.current.handleFileChange).toBeDefined();

        expectTypeOf(result.current.handleFileChange).toBeFunction();

        expect(result.current.handleDragOver).toBeDefined();

        expectTypeOf(result.current.handleDragOver).toBeFunction();

        expect(result.current.handleDragLeave).toBeDefined();

        expectTypeOf(result.current.handleDragLeave).toBeFunction();

        expect(result.current.handleDrop).toBeDefined();

        expectTypeOf(result.current.handleDrop).toBeFunction();

        expect(result.current.openFileDialog).toBeDefined();

        expectTypeOf(result.current.openFileDialog).toBeFunction();
    });

    it("should handle file selection", async () => {
        expect.assertions(3);

        const onFilesSelected = vi.fn();

        const { result } = renderHook(() =>
            useFileInput({
                onFilesSelected,
            }),
        );

        const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

        // Create a mock FileList
        const fileList = {
            0: file,
            item: (index: number) => index === 0 ? file : null,
            length: 1,
            * [Symbol.iterator]() {
                yield file;
            },
        } as unknown as FileList;

        const input = document.createElement("input");

        input.type = "file";
        Object.defineProperty(input, "files", {
            value: fileList,
            writable: false,
        });

        const event = new Event("change", { bubbles: true });

        Object.defineProperty(event, "target", {
            value: input,
            writable: false,
        });

        result.current.handleFileChange(event as unknown as React.ChangeEvent<HTMLInputElement>);

        await waitFor(() => {
            expect(result.current.files).toHaveLength(1);
        });

        expect(onFilesSelected).toHaveBeenCalledWith([file]);
    });

    it("should handle drag and drop", async () => {
        expect.assertions(3);

        const onFilesSelected = vi.fn();

        const { result } = renderHook(() =>
            useFileInput({
                onFilesSelected,
            }),
        );

        const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

        // Create a mock FileList for dataTransfer
        const fileList = {
            0: file,
            item: (index: number) => index === 0 ? file : null,
            length: 1,
            * [Symbol.iterator]() {
                yield file;
            },
        } as unknown as FileList;

        const dataTransfer = {
            files: fileList,
        };

        const dropEvent = new DragEvent("drop", {
            bubbles: true,
            cancelable: true,
        });

        Object.defineProperty(dropEvent, "dataTransfer", {
            value: dataTransfer,
            writable: false,
        });

        result.current.handleDrop(dropEvent as unknown as React.DragEvent<HTMLElement>);

        await waitFor(() => {
            expect(result.current.files).toHaveLength(1);
        });

        expect(onFilesSelected).toHaveBeenCalledWith([file]);
    });

    it("should reset files", async () => {
        expect.assertions(4);

        const { result } = renderHook(() => useFileInput());

        const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

        // Create a mock FileList
        const fileList = {
            0: file,
            item: (index: number) => index === 0 ? file : null,
            length: 1,
            * [Symbol.iterator]() {
                yield file;
            },
        } as unknown as FileList;

        const input = document.createElement("input");

        input.type = "file";
        Object.defineProperty(input, "files", {
            value: fileList,
            writable: false,
        });

        const event = new Event("change", { bubbles: true });

        Object.defineProperty(event, "target", {
            value: input,
            writable: false,
        });

        result.current.handleFileChange(event as unknown as React.ChangeEvent<HTMLInputElement>);

        await waitFor(() => {
            expect(result.current.files).toHaveLength(1);
        });

        result.current.reset();

        await waitFor(() => {
            expect(result.current.files).toStrictEqual([]);
        });
    });

    it("should prevent default on drag over", () => {
        expect.assertions(1);

        const { result } = renderHook(() => useFileInput());

        const dragEvent = new DragEvent("dragover", {
            bubbles: true,
            cancelable: true,
        });

        const preventDefaultSpy = vi.spyOn(dragEvent, "preventDefault");

        result.current.handleDragOver(dragEvent as unknown as React.DragEvent<HTMLElement>);

        expect(preventDefaultSpy).toHaveBeenCalledWith();
    });
});
