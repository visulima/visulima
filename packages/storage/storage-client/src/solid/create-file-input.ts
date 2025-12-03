import type { Accessor } from "solid-js";
import { createMemo, createSignal, onCleanup, onMount } from "solid-js";

export interface CreateFileInputOptions {
    accept?: string;
    multiple?: boolean;
    onFilesSelected?: (files: File[]) => void;
}

export interface CreateFileInputReturn {
    files: Accessor<File[]>;
    handleDragLeave: (event: DragEvent) => void;
    handleDragOver: (event: DragEvent) => void;
    handleDrop: (event: DragEvent) => void;
    handleFileChange: (event: Event) => void;
    inputRef: { current: HTMLInputElement | undefined };
    isDragging: Accessor<boolean>;
    openFileDialog: () => void;
    reset: () => void;
}

export const createFileInput = (options: CreateFileInputOptions = {}): CreateFileInputReturn => {
    const [files, setFiles] = createSignal<File[]>([]);
    const inputRef = { current: undefined as HTMLInputElement | undefined };
    const [dragCounter, setDragCounter] = createSignal(0);
    const isDragging = createMemo(() => dragCounter() > 0);

    const processFiles = (fileList: FileList | null): void => {
        if (!fileList || fileList.length === 0) {
            return;
        }

        const fileArray = [...fileList];

        setFiles(fileArray);
        options?.onFilesSelected?.(fileArray);
    };

    const handleFileChange = (event: Event): void => {
        const target = event.target as HTMLInputElement;

        processFiles(target.files);
    };

    const openFileDialog = (): void => {
        inputRef.current?.click();
    };

    const handleDragOver = (event: DragEvent): void => {
        event.preventDefault();
        event.stopPropagation();
    };

    const handleDragLeave = (event: DragEvent): void => {
        event.preventDefault();
        event.stopPropagation();

        setDragCounter((previous) => {
            const newValue = previous - 1;

            if (newValue === 0) {
                // Remove drag over styling if needed
            }

            return newValue;
        });
    };

    const handleDrop = (event: DragEvent): void => {
        event.preventDefault();
        event.stopPropagation();

        setDragCounter(0);

        const droppedFiles = event.dataTransfer?.files;

        if (droppedFiles && droppedFiles.length > 0) {
            processFiles(droppedFiles);

            if (inputRef.current) {
                const dataTransfer = new DataTransfer();

                for (const file of droppedFiles) {
                    dataTransfer.items.add(file);
                }

                inputRef.current.files = dataTransfer.files;
            }
        }
    };

    const reset = (): void => {
        setFiles([]);

        if (inputRef.current) {
            inputRef.current.value = "";
        }
    };

    onMount(() => {
        const handleDragEnter = (event: DragEvent): void => {
            event.preventDefault();
            event.stopPropagation();
            setDragCounter((previous) => previous + 1);
        };

        document.addEventListener("dragenter", handleDragEnter);

        onCleanup(() => {
            document.removeEventListener("dragenter", handleDragEnter);
        });
    });

    return {
        files,
        handleDragLeave,
        handleDragOver,
        handleDrop,
        handleFileChange,
        inputRef,
        isDragging,
        openFileDialog,
        reset,
    };
};
