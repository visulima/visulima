import type { Ref } from "vue";
import { onBeforeUnmount, onMounted, ref } from "vue";

export interface UsePasteUploadOptions {
    /** Filter function to determine which files to accept */
    filter?: (file: File) => boolean;
    /** Callback when files are pasted */
    onFilesPasted?: (files: File[]) => void;
}

export interface UsePasteUploadReturn {
    /** Handle paste event */
    handlePaste: (event: ClipboardEvent) => void;
    /** Files that were pasted */
    pastedFiles: Ref<File[]>;
    /** Reset pasted files */
    reset: () => void;
}

/**
 * Vue composable for handling paste uploads from clipboard.
 * @param options Configuration options
 * @returns Paste upload functions and state
 */
export const usePasteUpload = (options: UsePasteUploadOptions = {}): UsePasteUploadReturn => {
    const { filter, onFilesPasted } = options;

    const pastedFiles = ref<File[]>([]);

    const handlePaste = (event: ClipboardEvent): void => {
        const items = event.clipboardData?.items;

        if (!items) {
            return;
        }

        const files: File[] = [];

        for (const item of items) {
            // Check if item is a file
            if (item.kind === "file") {
                const file = item.getAsFile();

                if (file) {
                    // Apply filter if provided
                    if (filter && !filter(file)) {
                        continue;
                    }

                    files.push(file);
                }
            }
        }

        if (files.length > 0) {
            pastedFiles.value = files;
            onFilesPasted?.(files);
        }
    };

    const reset = (): void => {
        pastedFiles.value = [];
    };

    // Set up global paste listener if no element-specific handler is used
    onMounted(() => {
        const handleGlobalPaste = (event: ClipboardEvent): void => {
            const items = event.clipboardData?.items;

            if (!items) {
                return;
            }

            const files: File[] = [];

            for (const item of items) {
                if (item.kind === "file") {
                    const file = item.getAsFile();

                    if (file) {
                        if (filter && !filter(file)) {
                            continue;
                        }

                        files.push(file);
                    }
                }
            }

            if (files.length > 0) {
                pastedFiles.value = files;
                onFilesPasted?.(files);
            }
        };

        // Only add listener if we're not using element-specific paste handling
        // This is a fallback for when handlePaste is not attached to an element
        document.addEventListener("paste", handleGlobalPaste);

        onBeforeUnmount(() => {
            document.removeEventListener("paste", handleGlobalPaste);
        });
    });

    return {
        handlePaste,
        pastedFiles,
        reset,
    };
};
