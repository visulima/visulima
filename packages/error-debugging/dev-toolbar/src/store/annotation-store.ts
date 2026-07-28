import fs from "node:fs/promises";
import path from "node:path";

import type { Annotation, ThreadMessage } from "../types/annotations";

/** Base directory for annotation storage (relative to project root) */
export const STORE_DIR = ".devtoolbar";
export const ANNOTATIONS_FILE = "annotations.json";
export const SCREENSHOTS_DIR = "screenshots";

/**
 * Upper bounds guarding against unbounded growth of annotation/thread data
 * ingested from client-supplied (WebSocket RPC) or on-disk JSON. Without these,
 * a malicious or buggy client could grow `annotations.json` without limit (DoS).
 */
/** Maximum number of annotations retained in the store. */
export const MAX_ANNOTATIONS = 1000;
/** Maximum number of thread messages retained per annotation. */
export const MAX_THREAD_MESSAGES = 500;
/** Maximum length (characters) of any free-text string field. */
export const MAX_TEXT_FIELD_LENGTH = 100_000;
/** Maximum decoded byte size of a single screenshot written to disk. */
export const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024;

/**
 * Truncates a string field to {@link MAX_TEXT_FIELD_LENGTH} to bound per-field
 * size. Non-string values are returned unchanged.
 */
// eslint-disable-next-line func-style -- a generic arrow (`<T,>`) is parsed as JSX by this package's Babel transform, and Prettier strips the disambiguating comma; a function declaration is the only generic form that survives both.
export function clampTextField<T>(value: T): T {
    return typeof value === "string" && value.length > MAX_TEXT_FIELD_LENGTH ? (value.slice(0, MAX_TEXT_FIELD_LENGTH) as T) : value;
}

/**
 * Appends a message to an annotation's conversation thread, applying the same
 * DoS guards on both write paths (RPC + MCP): bounds thread growth to
 * {@link MAX_THREAD_MESSAGES} and clamps message text via {@link clampTextField}.
 * Generates the id/timestamp server-side. Throws once the thread limit is hit.
 */
export const appendThreadMessage = (annotation: Annotation, message: Omit<ThreadMessage, "id" | "timestamp">): ThreadMessage => {
    if (!annotation.thread) {
        annotation.thread = [];
    }

    // Bound thread growth from client-supplied data (DoS guard).
    if (annotation.thread.length >= MAX_THREAD_MESSAGES) {
        throw new Error(`Thread message limit reached (${MAX_THREAD_MESSAGES}) for this annotation.`);
    }

    const entry: ThreadMessage = {
        ...message,
        content: clampTextField(message.content),
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
    };

    annotation.thread.push(entry);

    return entry;
};

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

/** Directory-based cross-process lock (mkdir is atomic on all platforms). */
export const LOCK_DIR = "annotations.lock";
/** A lock older than this is treated as abandoned by a crashed process. */
const LOCK_STALE_MS = 10_000;
/** Delay between lock-acquisition retries. */
const LOCK_RETRY_MS = 50;
/** Give up waiting for the lock after this long and proceed unlocked (degraded). */
const LOCK_MAX_WAIT_MS = 5000;

const sleep = async (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

/**
 * Acquires a cross-process advisory lock in the store directory so the Vite dev
 * server and the separate MCP process cannot interleave read-modify-write
 * cycles on annotations.json. Falls back to proceeding unlocked after
 * {@link LOCK_MAX_WAIT_MS} rather than hanging. Returns a release function.
 */
const acquireFileLock = async (root: string): Promise<() => Promise<void>> => {
    const { base } = resolvePaths(root);
    const lockPath = path.join(base, LOCK_DIR);

    await fs.mkdir(base, { recursive: true });

    const deadline = Date.now() + LOCK_MAX_WAIT_MS;
    let owned = false;

    /* eslint-disable no-await-in-loop -- lock acquisition is inherently sequential: each retry must await the prior attempt before deciding the next. */
    for (;;) {
        try {
            await fs.mkdir(lockPath);
            owned = true;

            break;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
                throw error;
            }

            // Reclaim a stale lock left by a crashed process.
            try {
                const stat = await fs.stat(lockPath);

                if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
                    await fs.rm(lockPath, { force: true, recursive: true });

                    continue;
                }
            } catch {
                // Lock vanished between mkdir and stat — retry immediately.
                continue;
            }

            if (Date.now() > deadline) {
                // Proceed unlocked rather than blocking the dev workflow.
                break;
            }

            await sleep(LOCK_RETRY_MS);
        }
    }
    /* eslint-enable no-await-in-loop */

    return async () => {
        if (owned) {
            await fs.rm(lockPath, { force: true, recursive: true });
        }
    };
};

/**
 * Simple async mutex to prevent concurrent read-modify-write races.
 *
 * Pass `root` to additionally take a cross-process file lock, serializing the
 * dev server against the separate MCP process which shares the same store.
 */
let writeLock: Promise<void> = Promise.resolve();

export const withLock = async <T>(function_: () => Promise<T>, root?: string): Promise<T> => {
    // Chain onto the existing lock so operations are serialized
    const release = writeLock;

    let resolve: () => void;

    writeLock = new Promise<void>((r) => {
        resolve = r;
    });

    await release;

    let releaseFileLock: (() => Promise<void>) | undefined;

    try {
        if (root !== undefined) {
            releaseFileLock = await acquireFileLock(root);
        }

        return await function_();
    } finally {
        if (releaseFileLock) {
            await releaseFileLock();
        }

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

        // Bound on-disk data: a tampered/oversized file must not load unbounded
        // annotations or per-annotation threads into memory.
        return (parsed as Annotation[]).slice(0, MAX_ANNOTATIONS).map((annotation) => {
            if (Array.isArray(annotation?.thread) && annotation.thread.length > MAX_THREAD_MESSAGES) {
                return { ...annotation, thread: annotation.thread.slice(0, MAX_THREAD_MESSAGES) };
            }

            return annotation;
        });
    } catch {
        return [];
    }
};

/**
 * Writes annotations to disk.
 */
export const writeAnnotations = async (root: string, annotations: Annotation[]): Promise<void> => {
    await ensureStoreDir(root);

    const { annotationsFile, base } = resolvePaths(root);

    // Write to a unique temp file then atomically rename into place, so a
    // concurrent reader (including the separate MCP process) never observes a
    // truncated/torn file and cannot swallow a partial read into an empty array.
    const temporaryFile = path.join(base, `${ANNOTATIONS_FILE}.${crypto.randomUUID()}.tmp`);

    try {
        await fs.writeFile(temporaryFile, JSON.stringify(annotations, undefined, 2), "utf8");
        await fs.rename(temporaryFile, annotationsFile);
    } catch (error) {
        await fs.rm(temporaryFile, { force: true });

        throw error;
    }
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
