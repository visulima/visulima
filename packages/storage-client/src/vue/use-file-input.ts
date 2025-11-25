import type { Ref } from "vue";
import { onBeforeUnmount, onMounted, ref } from "vue";

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
    files: Ref<File[]>;
    /** Handle drag leave event */
    handleDragLeave: (event: DragEvent) => void;
    /** Handle drag and drop events */
    handleDragOver: (event: DragEvent) => void;
    /** Handle drop event */
    handleDrop: (event: DragEvent) => void;
    /** Handle file input change event */
    handleFileChange: (event: Event) => void;
    /** File input element ref */
    inputRef: Ref<HTMLInputElement | undefined>;
    /** Open file dialog programmatically */
    openFileDialog: () => void;
    /** Reset selected files */
    reset: () => void;
}

/**
 * Vue composable for file input handling with drag & drop support.
 * @param options Configuration options
 * @returns File input functions and state
 */
export const useFileInput = (options: UseFileInputOptions = {}): UseFileInputReturn => {
    const { accept: _accept, multiple: _multiple = false, onFilesSelected } = options;

    const files = ref<File[]>([]);
    const inputRef = ref<HTMLInputElement | undefined>(undefined);
    const dragCounter = ref(0);

    const processFiles = (fileList: FileList | null): void => {
        if (!fileList || fileList.length === 0) {
            return;
        }

        const fileArray = [...fileList];

        files.value = fileArray;
        onFilesSelected?.(fileArray);
    };

    const handleFileChange = (event: Event): void => {
        const target = event.target as HTMLInputElement;

        processFiles(target.files);
    };

    const openFileDialog = (): void => {
        inputRef.value?.click();
    };

    const handleDragOver = (event: DragEvent): void => {
        event.preventDefault();
        event.stopPropagation();
    };

    const handleDragLeave = (event: DragEvent): void => {
        event.preventDefault();
        event.stopPropagation();

        dragCounter.value -= 1;

        if (dragCounter.value === 0) {
            // Remove drag over styling if needed
        }
    };

    const handleDrop = (event: DragEvent): void => {
        event.preventDefault();
        event.stopPropagation();

        dragCounter.value = 0;

        const droppedFiles = event.dataTransfer?.files;

        if (droppedFiles && droppedFiles.length > 0) {
            processFiles(droppedFiles);

            // Update input element if it exists
            if (inputRef.value) {
                const dataTransfer = new DataTransfer();

                for (const file of droppedFiles) {
                    dataTransfer.items.add(file);
                }

                inputRef.value.files = dataTransfer.files;
            }
        }
    };

    const reset = (): void => {
        files.value = [];

        if (inputRef.value) {
            inputRef.value.value = "";
        }
    };

    // Set up drag enter counter
    onMounted(() => {
        const handleDragEnter = (event: DragEvent): void => {
            event.preventDefault();
            event.stopPropagation();
            dragCounter.value += 1;
        };

        document.addEventListener("dragenter", handleDragEnter);

        onBeforeUnmount(() => {
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
