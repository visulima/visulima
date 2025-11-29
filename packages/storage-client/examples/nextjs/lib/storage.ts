import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DiskStorage } from "@visulima/storage";

/**
 * Shared storage instance for file uploads.
 * Uses local disk storage for development.
 */
const uploadDirectory = join(tmpdir(), "uploads");

// Ensure upload directory exists
try {
    mkdirSync(uploadDirectory, { recursive: true });
} catch (error) {
    console.error("Failed to create upload directory:", error);
}

export const storage = new DiskStorage({
    directory: uploadDirectory,
    logger: console,
    maxUploadSize: "100MB",
});
