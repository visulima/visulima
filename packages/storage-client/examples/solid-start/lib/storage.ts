import { DiskStorage } from "@visulima/storage";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Shared storage instance for file uploads.
 * Uses local disk storage for development.
 */
const uploadDirectory = join(tmpdir(), "uploads");

// Ensure upload directory exists
mkdir(uploadDirectory, { recursive: true }).catch((error) => {
    console.error("Failed to create upload directory:", error);
});

export const storage = new DiskStorage({
    directory: uploadDirectory,
    maxUploadSize: "100MB",
    logger: console,
});


