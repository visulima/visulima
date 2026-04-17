import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import type { ViteDevServer } from "vite";
import { normalizePath } from "vite";

export interface StaticAsset {
    /** Last-modified timestamp (ms since epoch) */
    mtime: number;
    /** Public URL path (e.g. "/images/logo.png") */
    publicPath: string;
    /** File size in bytes */
    size: number;
    /** Asset type category */
    type: "audio" | "font" | "image" | "other" | "text" | "video";
}

const IMAGE_EXTS = new Set(["apng", "avif", "bmp", "gif", "ico", "jpeg", "jpg", "png", "svg", "tiff", "webp"]);
const VIDEO_EXTS = new Set(["avi", "mkv", "mov", "mp4", "ogv", "webm"]);
const AUDIO_EXTS = new Set(["aac", "flac", "m4a", "mp3", "ogg", "opus", "wav"]);
const FONT_EXTS = new Set(["eot", "otf", "ttf", "woff", "woff2"]);
const TEXT_EXTS = new Set(["css", "csv", "html", "js", "json", "md", "txt", "xml"]);

/** Hard cap to prevent memory exhaustion on huge public directories */
const MAX_ASSETS = 5000;

const classifyExtension = (extension: string): StaticAsset["type"] => {
    const lowercaseExtension = extension.toLowerCase();

    if (IMAGE_EXTS.has(lowercaseExtension)) {
        return "image";
    }

    if (VIDEO_EXTS.has(lowercaseExtension)) {
        return "video";
    }

    if (AUDIO_EXTS.has(lowercaseExtension)) {
        return "audio";
    }

    if (FONT_EXTS.has(lowercaseExtension)) {
        return "font";
    }

    if (TEXT_EXTS.has(lowercaseExtension)) {
        return "text";
    }

    return "other";
};

// Simple semaphore to bound concurrent filesystem operations and avoid EMFILE errors
const createSemaphore = (limit: number) => {
    let running = 0;
    const queue: (() => void)[] = [];

    const acquire = (): Promise<void> =>
        new Promise((resolve) => {
            if (running < limit) {
                running += 1;
                resolve();
            } else {
                queue.push(() => {
                    running += 1;
                    resolve();
                });
            }
        });

    const release = (): void => {
        running -= 1;
        queue.shift()?.();
    };

    return { acquire, release };
};

const walkDirectory = async (
    directory: string,
    resolvedPublicDirectory: string,
    semaphore: ReturnType<typeof createSemaphore>,
    collected: StaticAsset[],
): Promise<void> => {
    if (collected.length >= MAX_ASSETS) {
        return;
    }

    let entries: Dirent[];

    await semaphore.acquire();

    try {
        entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
        return;
    } finally {
        semaphore.release();
    }

    await Promise.all(
        entries.map(async (entry) => {
            if (collected.length >= MAX_ASSETS) {
                return;
            }

            const fullPath = path.join(directory, entry.name);

            if (entry.isDirectory()) {
                await walkDirectory(fullPath, resolvedPublicDirectory, semaphore, collected);
            } else if (entry.isFile() || entry.isSymbolicLink()) {
                // Use lstat to avoid silently following symlinks
                await semaphore.acquire();

                try {
                    const lstat = await fs.lstat(fullPath);

                    if (lstat.isSymbolicLink()) {
                        // Resolve and verify the symlink target stays inside publicDir
                        let realPath: string;

                        try {
                            realPath = await fs.realpath(fullPath);
                        } catch {
                            return; // broken symlink — skip
                        }

                        if (!realPath.startsWith(resolvedPublicDirectory + path.sep) && realPath !== resolvedPublicDirectory) {
                            return; // escape attempt — skip
                        }

                        // Safe symlink — stat the real target for size/mtime
                        const stat = await fs.stat(fullPath);
                        const relativePath = path.relative(resolvedPublicDirectory, fullPath);
                        const publicPath = `/${normalizePath(relativePath)}`;
                        const extension = path.extname(entry.name).slice(1);

                        if (collected.length < MAX_ASSETS) {
                            collected.push({ mtime: stat.mtimeMs, publicPath, size: stat.size, type: classifyExtension(extension) });
                        }
                    } else if (lstat.isFile()) {
                        const relativePath = path.relative(resolvedPublicDirectory, fullPath);
                        const publicPath = `/${normalizePath(relativePath)}`;
                        const extension = path.extname(entry.name).slice(1);

                        if (collected.length < MAX_ASSETS) {
                            collected.push({ mtime: lstat.mtimeMs, publicPath, size: lstat.size, type: classifyExtension(extension) });
                        }
                    }
                    // Ignore other special file types (sockets, FIFOs, devices)
                } catch {
                    // skip unreadable files
                } finally {
                    semaphore.release();
                }
            }
        }),
    );
};

/**
 * Walk the Vite publicDir and return serializable asset descriptors.
 * Results are capped at MAX_ASSETS (5000) to prevent memory exhaustion.
 */
export const getStaticAssets = async (server: ViteDevServer): Promise<StaticAsset[]> => {
    const { publicDir } = server.config;

    if (!publicDir) {
        return [];
    }

    // Resolve the real path of publicDir once so symlink checks are consistent
    let resolvedPublicDirectory: string;

    try {
        resolvedPublicDirectory = await fs.realpath(publicDir);
    } catch {
        // publicDir doesn't exist or is inaccessible
        return [];
    }

    const collected: StaticAsset[] = [];
    const semaphore = createSemaphore(20);

    await walkDirectory(resolvedPublicDirectory, resolvedPublicDirectory, semaphore, collected);

    // Sort alphabetically by public path
    collected.sort((a, b) => a.publicPath.localeCompare(b.publicPath));

    return collected;
};
