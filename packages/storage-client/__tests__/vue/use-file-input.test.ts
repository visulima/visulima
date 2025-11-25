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
        expect.assertions(10);

        const { result } = withQueryClient(() => useFileInput());

        expect(result.handleFileChange).toBeDefined();
        expect(typeof result.handleFileChange).toBe("function");
        expect(result.handleDragOver).toBeDefined();
        expect(typeof result.handleDragOver).toBe("function");
        expect(result.handleDragLeave).toBeDefined();
        expect(typeof result.handleDragLeave).toBe("function");
        expect(result.handleDrop).toBeDefined();
        expect(typeof result.handleDrop).toBe("function");
        expect(result.openFileDialog).toBeDefined();
        expect(typeof result.openFileDialog).toBe("function");
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
