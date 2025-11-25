import { onDestroy, onMount } from "svelte";
import type { Readable, Writable } from "svelte/store";
import { writable } from "svelte/store";

export interface CreatePasteUploadOptions {
    filter?: (file: File) => boolean;
    onFilesPasted?: (files: File[]) => void;
}

export interface CreatePasteUploadReturn {
    handlePaste: (event: ClipboardEvent) => void;
    pastedFiles: Readable<File[]>;
    reset: () => void;
}

export const createPasteUpload = (options: CreatePasteUploadOptions = {}): CreatePasteUploadReturn => {
    const { filter, onFilesPasted } = options;

    const pastedFiles: Writable<File[]> = writable([]);

    const handlePaste = (event: ClipboardEvent): void => {
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
            pastedFiles.set(files);
            onFilesPasted?.(files);
        }
    };

    const reset = (): void => {
        pastedFiles.set([]);
    };

    onMount(() => {
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
                pastedFiles.set(files);
                onFilesPasted?.(files);
            }
        };

        document.addEventListener("paste", handleGlobalPaste);

        onDestroy(() => {
            document.removeEventListener("paste", handleGlobalPaste);
        });
    });

    return {
        handlePaste,
        pastedFiles,
        reset,
    };
};

