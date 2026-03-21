import fs from "node:fs/promises";
import path from "node:path";

import type { Annotation } from "../types/annotations";

/** Base directory for annotation storage (relative to project root) */
export const STORE_DIR = ".devtoolbar";
export const ANNOTATIONS_FILE = "annotations.json";
export const SCREENSHOTS_DIR = "screenshots";

/**
 * Resolves absolute paths for the annotation store.
 */
export const resolvePaths = (root: string): { annotationsFile: string; base: string; screenshotsDir: string } => {
    const base = path.join(root, STORE_DIR);

    return {
        annotationsFile: path.join(base, ANNOTATIONS_FILE),
        base,
        screenshotsDir: path.join(base, SCREENSHOTS_DIR),
    };
};

/**
 * Validates that a resolved file path stays inside the store base directory.
 * Prevents directory traversal attacks.
 */
export const isPathInsideBase = (filepath: string, baseDir: string): boolean => {
    const resolvedPath = path.resolve(filepath);
    const resolvedBase = path.resolve(baseDir);

    return resolvedPath.startsWith(resolvedBase + path.sep) || resolvedPath === resolvedBase;
};

/**
 * Sanitizes an ID for use as a filename — strips path separators and
 * non-alphanumeric characters (except hyphens) to prevent traversal.
 */
export const sanitizeId = (id: string): string => id.replaceAll(/[^a-z0-9-]/gi, "");

/**
 * Ensures the store directories exist.
 */
export const ensureStoreDir = async (root: string): Promise<void> => {
    const { screenshotsDir } = resolvePaths(root);

    // recursive: true creates all parents, so a single call for the deepest dir suffices
    await fs.mkdir(screenshotsDir, { recursive: true });
};

/**
 * Simple async mutex to prevent concurrent read-modify-write races.
 */
let writeLock: Promise<void> = Promise.resolve();

export const withLock = async <T>(function_: () => Promise<T>): Promise<T> => {
    // Chain onto the existing lock so operations are serialized
    const release = writeLock;

    let resolve: () => void;

    writeLock = new Promise<void>((r) => {
        resolve = r;
    });

    await release;

    try {
        return await function_();
    } finally {
        resolve!();
    }
};

/**
 * Reads all annotations from disk.
 */
export const readAnnotations = async (root: string): Promise<Annotation[]> => {
    const { annotationsFile } = resolvePaths(root);

    try {
        const content = await fs.readFile(annotationsFile, "utf8");
        const parsed: unknown = JSON.parse(content);

        // Validate parsed result is an array
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed as Annotation[];
    } catch {
        return [];
    }
};

/**
 * Writes annotations to disk.
 */
export const writeAnnotations = async (root: string, annotations: Annotation[]): Promise<void> => {
    await ensureStoreDir(root);

    const { annotationsFile } = resolvePaths(root);

    await fs.writeFile(annotationsFile, JSON.stringify(annotations, undefined, 2), "utf8");
};

/**
 * Deletes a screenshot file from disk.
 * Validates the path stays inside the store directory to prevent traversal.
 */
export const deleteScreenshotFile = async (root: string, screenshotPath: string): Promise<void> => {
    // Validate path to prevent directory traversal
    if (!screenshotPath.startsWith(`${SCREENSHOTS_DIR}/`)) {
        return;
    }

    const { base } = resolvePaths(root);
    const filepath = path.join(base, screenshotPath);

    // Ensure resolved path stays inside the store directory
    if (!isPathInsideBase(filepath, base)) {
        return;
    }

    try {
        await fs.unlink(filepath);
    } catch {
        // File already deleted or never existed — ignore
    }
};
