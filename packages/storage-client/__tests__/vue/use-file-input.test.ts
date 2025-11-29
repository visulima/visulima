import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { useFileInput } from "../../src/vue/use-file-input";
import { withQueryClient } from "./test-utils";

describe(useFileInput, () => {
    it("should initialize with empty files", () => {
        expect.assertions(1);

        const { result } = withQueryClient(() => useFileInput());

        expect(result.files.value).toStrictEqual([]);
    });

    it("should provide file handling functions", () => {
        expect.assertions(5);

        const { result } = withQueryClient(() => useFileInput());

        expect(result.handleFileChange).toBeDefined();

        expectTypeOf(result.handleFileChange).toBeFunction();

        expect(result.handleDragOver).toBeDefined();

        expectTypeOf(result.handleDragOver).toBeFunction();

        expect(result.handleDragLeave).toBeDefined();

        expectTypeOf(result.handleDragLeave).toBeFunction();

        expect(result.handleDrop).toBeDefined();

        expectTypeOf(result.handleDrop).toBeFunction();

        expect(result.openFileDialog).toBeDefined();

        expectTypeOf(result.openFileDialog).toBeFunction();
    });

    it("should handle file selection", () => {
        expect.assertions(2);

        const onFilesSelected = vi.fn();

        const { result } = withQueryClient(() =>
            useFileInput({
                onFilesSelected,
            }),
        );

        const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
        const dataTransfer = new DataTransfer();

        dataTransfer.items.add(file);

        const input = document.createElement("input");

        input.type = "file";
        input.files = dataTransfer.files;

        const event = new Event("change", { bubbles: true });

        Object.defineProperty(event, "target", {
            value: input,
            writable: false,
        });

        result.handleFileChange(event);

        expect(result.files.value).toHaveLength(1);
        expect(onFilesSelected).toHaveBeenCalledWith([file]);
    });
});
