import type File from "./file";
import type { UploadEventType } from "./types";

/**
 * Determines the upload status of a file based on its current state.
 * @param file File object to check status for
 * @returns Upload event type: 'completed' if fully uploaded, 'part' if partially uploaded, 'created' if just started
 */
const getFileStatus = (file: File): UploadEventType => {
    if (file.bytesWritten === file.size) {
        return "completed";
    }

    return file.createdAt ? "part" : "created";
};

export default getFileStatus;
