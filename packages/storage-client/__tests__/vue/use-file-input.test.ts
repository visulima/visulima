import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { useFileInput } from "../../src/vue/use-file-input";
import { withQueryClient } from "./test-utils";

describe(useFileInput, () => {
    it("should initialize with empty files", () => {
        expect.assertions(1);

        const { result } = withQueryClient(() => useFileInput());

        expect(result.files.value).toEqual([]);
    });

    it("should provide file handling functions", () => {
        expect.assertions(5);

        const { result } = withQueryClient(() => useFileInput());

        expectTypeOf(result.handleFileChange).toBeFunction();
        expectTypeOf(result.handleDragOver).toBeFunction();
        expectTypeOf(result.handleDragLeave).toBeFunction();
        expectTypeOf(result.handleDrop).toBeFunction();
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
