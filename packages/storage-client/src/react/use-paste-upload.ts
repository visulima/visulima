import { useCallback, useEffect, useState } from "react";

export interface UsePasteUploadOptions {
    /** Callback when files are pasted */
    onFilesPasted?: (files: File[]) => void;
    /** Filter function to determine which files to accept */
    filter?: (file: File) => boolean;
}

export interface UsePasteUploadReturn {
    /** Handle paste event */
    handlePaste: (event: React.ClipboardEvent<HTMLElement>) => void;
    /** Files that were pasted */
    pastedFiles: File[];
    /** Reset pasted files */
    reset: () => void;
}

/**
 * React hook for handling paste uploads from clipboard.
 * @param options Configuration options
 * @returns Paste upload functions and state
 */
export const usePasteUpload = (options: UsePasteUploadOptions = {}): UsePasteUploadReturn => {
    const { onFilesPasted, filter } = options;

    const [pastedFiles, setPastedFiles] = useState<File[]>([]);

    const handlePaste = useCallback(
        (event: React.ClipboardEvent<HTMLElement>): void => {
            const items = event.clipboardData.items;
            const files: File[] = [];

            for (let i = 0; i < items.length; i++) {
                const item = items[i];

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
                setPastedFiles(files);
                onFilesPasted?.(files);
            }
        },
        [filter, onFilesPasted],
    );

    const reset = useCallback((): void => {
        setPastedFiles([]);
    }, []);

    // Set up global paste listener if no element-specific handler is used
    useEffect(() => {
        const handleGlobalPaste = (event: ClipboardEvent): void => {
            const items = event.clipboardData?.items;

            if (!items) {
                return;
            }

            const files: File[] = [];

            for (let i = 0; i < items.length; i++) {
                const item = items[i];

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

        // Only add listener if we're not using element-specific paste handling
        // This is a fallback for when handlePaste is not attached to an element
        document.addEventListener("paste", handleGlobalPaste);

        return () => {
            document.removeEventListener("paste", handleGlobalPaste);
        };
    }, [filter, onFilesPasted]);

    return {
        handlePaste,
        pastedFiles,
        reset,
    };
};

