import { onDestroy, onMount } from "svelte";
import type { Readable, Writable } from "svelte/store";
import { writable } from "svelte/store";

export interface CreateFileInputOptions {
    accept?: string;
    multiple?: boolean;
    onFilesSelected?: (files: File[]) => void;
}

export interface CreateFileInputReturn {
    files: Readable<File[]>;
    handleDragLeave: (event: DragEvent) => void;
    handleDragOver: (event: DragEvent) => void;
    handleDrop: (event: DragEvent) => void;
    handleFileChange: (event: Event) => void;
    inputRef: { current: HTMLInputElement | undefined };
    openFileDialog: () => void;
    reset: () => void;
}

export const createFileInput = (options: CreateFileInputOptions = {}): CreateFileInputReturn => {
    const { accept: _accept, multiple: _multiple = false, onFilesSelected } = options;

    const files: Writable<File[]> = writable([]);
    const inputRef = { current: undefined as HTMLInputElement | undefined };
    const dragCounter = writable(0);

    const processFiles = (fileList: FileList | null): void => {
        if (!fileList || fileList.length === 0) {
            return;
        }

        const fileArray = [...fileList];

        files.set(fileArray);
        onFilesSelected?.(fileArray);
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

        dragCounter.update((previous) => previous - 1);
    };

    const handleDrop = (event: DragEvent): void => {
        event.preventDefault();
        event.stopPropagation();

        dragCounter.set(0);

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
        files.set([]);

        if (inputRef.current) {
            inputRef.current.value = "";
        }
    };

    onMount(() => {
        const handleDragEnter = (event: DragEvent): void => {
            event.preventDefault();
            event.stopPropagation();
            dragCounter.update((previous) => previous + 1);
        };

        document.addEventListener("dragenter", handleDragEnter);

        onDestroy(() => {
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
        openFileDialog,
        reset,
    };
};
