import type File from "./file";
import type { UploadEventType } from "./types";

/**
 * Determines the upload status of a file based on its current state.
 * @param file File object to check status for
 * @returns Upload event type: 'completed' if fully uploaded, 'part' if partially uploaded, 'created' if just started
 */
const getFileStatus = (file: File): UploadEventType => {
    // An empty upload isn't complete at create (no `createdAt` yet): only the write that stores its
    // empty object completes it, so a "completed" upload always has an object behind it.
    if (file.bytesWritten === file.size && (file.size !== 0 || file.createdAt !== undefined)) {
        return "completed";
    }

    return file.createdAt ? "part" : "created";
};

export default getFileStatus;
