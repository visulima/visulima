import type { Accessor } from "solid-js";
import { createSignal, onCleanup, onMount } from "solid-js";

export interface CreatePasteUploadOptions {
    filter?: (file: File) => boolean;
    onFilesPasted?: (files: File[]) => void;
}

export interface CreatePasteUploadReturn {
    handlePaste: (event: ClipboardEvent) => void;
    pastedFiles: Accessor<File[]>;
    reset: () => void;
}

export const createPasteUpload = (options: CreatePasteUploadOptions = {}): CreatePasteUploadReturn => {
    const { filter, onFilesPasted } = options;

    const [pastedFiles, setPastedFiles] = createSignal<File[]>([]);

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
            setPastedFiles(files);
            onFilesPasted?.(files);
        }
    };

    const reset = (): void => {
        setPastedFiles([]);
    };

    onMount(() => {
        document.addEventListener("paste", handlePaste);

        onCleanup(() => {
            document.removeEventListener("paste", handlePaste);
        });
    });

    return {
        handlePaste,
        pastedFiles,
        reset,
    };
};
