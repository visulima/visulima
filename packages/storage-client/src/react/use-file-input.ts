import { useCallback, useEffect, useRef, useState } from "react";

export interface UseFileInputOptions {
    /** Accept file types (e.g., "image/*", ".pdf") */
    accept?: string;
    /** Whether to allow multiple file selection */
    multiple?: boolean;
    /** Callback when files are selected */
    onFilesSelected?: (files: File[]) => void;
}

export interface UseFileInputReturn {
    /** Currently selected files */
    files: File[];
    /** Handle drag leave event */
    handleDragLeave: (event: React.DragEvent<HTMLElement>) => void;
    /** Handle drag and drop events */
    handleDragOver: (event: React.DragEvent<HTMLElement>) => void;
    /** Handle drop event */
    handleDrop: (event: React.DragEvent<HTMLElement>) => void;
    /** Handle file input change event */
    handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    /** File input element ref */
    inputRef: React.RefObject<HTMLInputElement | null>;
    /** Open file dialog programmatically */
    openFileDialog: () => void;
    /** Reset selected files */
    reset: () => void;
}

/**
 * React hook for file input handling with drag & drop support.
 * @param options Configuration options
 * @returns File input functions and state
 */
export const useFileInput = (options: UseFileInputOptions = {}): UseFileInputReturn => {

    const [files, setFiles] = useState<File[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const dragCounterRef = useRef(0);

    const processFiles = useCallback(
        (fileList: FileList | null): void => {
            if (!fileList || fileList.length === 0) {
                return;
            }

            const fileArray = [...fileList];

            setFiles(fileArray);
            options?.onFilesSelected?.(fileArray);
        },
        [options?.onFilesSelected],
    );

    const handleFileChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>): void => {
            processFiles(event.target.files);
        },
        [processFiles],
    );

    const openFileDialog = useCallback((): void => {
        inputRef.current?.click();
    }, []);

    const handleDragOver = useCallback((event: React.DragEvent<HTMLElement>): void => {
        event.preventDefault();
        event.stopPropagation();
    }, []);

    const handleDragLeave = useCallback((event: React.DragEvent<HTMLElement>): void => {
        event.preventDefault();
        event.stopPropagation();

        dragCounterRef.current -= 1;

        if (dragCounterRef.current === 0) {
            // Remove drag over styling if needed
        }
    }, []);

    const handleDrop = useCallback(
        (event: React.DragEvent<HTMLElement>): void => {
            event.preventDefault();
            event.stopPropagation();

            dragCounterRef.current = 0;

            const droppedFiles = event.dataTransfer.files;

            if (droppedFiles.length > 0) {
                processFiles(droppedFiles);

                // Update input element if it exists
                if (inputRef.current) {
                    const dataTransfer = new DataTransfer();

                    for (const file of droppedFiles) {
                        dataTransfer.items.add(file);
                    }

                    inputRef.current.files = dataTransfer.files;
                }
            }
        },
        [processFiles],
    );

    const reset = useCallback((): void => {
        setFiles([]);

        if (inputRef.current) {
            inputRef.current.value = "";
        }
    }, []);

    // Set up drag enter counter
    useEffect(() => {
        const handleDragEnter = (event: DragEvent): void => {
            event.preventDefault();
            event.stopPropagation();
            dragCounterRef.current += 1;
        };

        document.addEventListener("dragenter", handleDragEnter);

        return () => {
            document.removeEventListener("dragenter", handleDragEnter);
        };
    }, []);

    return {
        files,
        handleDragLeave,
        handleDragOver,
        handleDrop,
        handleFileChange,
        inputRef,
        openFileDialog,
        reset,
    };
};
