import type File from "./file";

/**
 * Updates a file's size, but only if the new size is smaller than the current size.
 * This prevents accidental size increases that could indicate data corruption.
 * @param file File object to update
 * @param size New size value
 * @returns The updated file object
 */
const updateSize = (file: File, size: number): File => {
    if (size < (file.size as number)) {
        file.size = size;
    }

    return file;
};

export default updateSize;
