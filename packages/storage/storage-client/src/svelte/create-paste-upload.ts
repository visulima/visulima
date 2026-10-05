import { onMount } from "svelte";
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

    // A paste inside the element reaches both its handler and the document listener; handle it once.
    let lastPaste: ClipboardEvent | undefined;

    const handlePaste = (event: ClipboardEvent): void => {
        const items = event.clipboardData?.items;

        if (!items || event === lastPaste) {
            return;
        }

        lastPaste = event;

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
        document.addEventListener("paste", handlePaste);

        // onDestroy cannot be registered from inside onMount; its returned cleanup runs on destroy.
        return () => {
            document.removeEventListener("paste", handlePaste);
        };
    });

    return {
        handlePaste,
        pastedFiles,
        reset,
    };
};
