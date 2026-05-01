import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
    constants as zlibConstants,
    createBrotliCompress,
    createBrotliDecompress,
    createGunzip,
    createGzip,
} from "node:zlib";

import { join, resolve, sep } from "@visulima/path";
import type { TarFileInput } from "nanotar";
import { createTar as nanoCreateTar, parseTar as nanoParseTar } from "nanotar";

/**
 * Tar + gzip + brotli archive helpers used by the local cache and the
 * remote-cache backends. Implementations are JS-side via `nanotar`
 * — no shellout to `tar`, no platform-specific behavior, and entry
 * paths are validated before extraction so a malicious cache server
 * cannot ship a tarball that escapes the destination directory.
 */

/**
 * Brotli quality 4 hits a sweet spot for cache tarballs: ~15–20% smaller
 * than gzip on typical source/dist payloads at comparable throughput.
 * Higher qualities (8+) reach diminishing returns and noticeably slow
 * down cache writes; lower qualities (1–3) give up ratio for speed we
 * don't need on IO-bound workloads.
 */
export const BROTLI_COMPRESS_OPTIONS: { params: Record<number, number> } = {
    params: {
        [zlibConstants.BROTLI_PARAM_MODE]: zlibConstants.BROTLI_MODE_TEXT,
        [zlibConstants.BROTLI_PARAM_QUALITY]: 4,
    },
};

/**
 * Walk `sourceDirectory` recursively and turn it into the
 * `TarFileInput[]` shape `nanotar.createTar` expects. Entry names are
 * forward-slash-joined relative paths so the produced tarballs stay
 * portable across OSes (Windows readers expect `/`, not `\`).
 *
 * Symlinks are skipped on purpose — vis caches dist/ trees, where a
 * symlink usually points at something the cache does not own. Including
 * one would either break extraction (broken target) or leak bytes from
 * outside the source tree.
 */
const collectEntries = async (sourceDirectory: string): Promise<TarFileInput[]> => {
    const entries: TarFileInput[] = [];
    const root = resolve(sourceDirectory);

    const walk = async (absolute: string, relative: string): Promise<void> => {
        const items = await readdir(absolute, { withFileTypes: true });

        items.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

        for (const item of items) {
            const childAbsolute = join(absolute, item.name);
            const childRelative = relative === "" ? item.name : `${relative}/${item.name}`;

            if (item.isDirectory()) {
                // eslint-disable-next-line no-await-in-loop -- ordered traversal keeps tarball entries deterministic
                await walk(childAbsolute, childRelative);

                continue;
            }

            if (!item.isFile()) {
                continue;
            }

            // eslint-disable-next-line no-await-in-loop -- per-file IO; concurrency would only matter for huge trees, and even then nanotar buffers the whole result
            const [data, info] = await Promise.all([readFile(childAbsolute), stat(childAbsolute)]);

            entries.push({
                attrs: {
                    // eslint-disable-next-line no-bitwise -- POSIX file modes encode the rwx triplet in the low 12 bits; bitmask is the canonical extraction
                    mode: (info.mode & 0o7777).toString(8),
                    mtime: Math.floor(info.mtimeMs),
                },
                data,
                name: childRelative,
            });
        }
    };

    await walk(root, "");

    return entries;
};

/**
 * Reject any tar entry whose path would write outside `destinationDirectory`.
 * Catches absolute paths, parent traversals (`..`), and Windows drive
 * prefixes. Returns the resolved absolute write path on success, or
 * `null` to signal "skip this entry without aborting the extract".
 */
const safeJoinForExtract = (destinationDirectory: string, entryName: string): string | null => {
    if (entryName === "" || entryName === "." || entryName === "./") {
        return null;
    }

    if (entryName.startsWith("/") || entryName.startsWith("\\") || /^[a-z]:[\\/]/i.test(entryName)) {
        return null;
    }

    const resolvedDestination = resolve(destinationDirectory);
    const resolvedEntry = resolve(resolvedDestination, entryName);
    const prefix = resolvedDestination.endsWith(sep) ? resolvedDestination : `${resolvedDestination}${sep}`;

    if (resolvedEntry !== resolvedDestination && !resolvedEntry.startsWith(prefix)) {
        return null;
    }

    return resolvedEntry;
};

const writeTarEntries = async (entries: ReadonlyArray<{ attrs?: { mode?: string }; data?: Uint8Array; name: string }>, destinationDirectory: string): Promise<void> => {
    await mkdir(destinationDirectory, { recursive: true });

    for (const entry of entries) {
        if (entry.data === undefined) {
            continue;
        }

        const writePath = safeJoinForExtract(destinationDirectory, entry.name);

        if (writePath === null) {
            throw new Error(`[task-runner] refusing to extract tar entry with unsafe path: ${entry.name}`);
        }

        // eslint-disable-next-line no-await-in-loop -- entries write sequentially; the tarball is the unit of concurrency, not its members
        await mkdir(join(writePath, ".."), { recursive: true });

        const mode = entry.attrs?.mode === undefined ? undefined : Number.parseInt(entry.attrs.mode, 8);

        // eslint-disable-next-line no-await-in-loop -- see above
        await writeFile(writePath, entry.data, mode === undefined ? undefined : { mode });
    }
};

const compressBuffer = async (buffer: Uint8Array, transform: NodeJS.ReadWriteStream, outputPath: string): Promise<void> => {
    const { createWriteStream } = await import("node:fs");

    await pipeline(Readable.from(Buffer.from(buffer)), transform, createWriteStream(outputPath));
};

const decompressBuffer = async (sourcePath: string, transform: NodeJS.ReadWriteStream): Promise<Buffer> => {
    const { createReadStream } = await import("node:fs");
    const chunks: Buffer[] = [];

    await pipeline(createReadStream(sourcePath), transform, async (source) => {
        for await (const chunk of source) {
            chunks.push(chunk as Buffer);
        }
    });

    return Buffer.concat(chunks);
};

/** Plain tar: `sourceDirectory` → `outputPath`, no compression. */
export const createTar = async (sourceDirectory: string, outputPath: string): Promise<void> => {
    const entries = await collectEntries(sourceDirectory);
    const bytes = nanoCreateTar(entries);

    await writeFile(outputPath, bytes);
};

/** Plain tar extract into `destinationDirectory`, with path-traversal validation. */
export const extractTar = async (archivePath: string, destinationDirectory: string): Promise<void> => {
    const buffer = await readFile(archivePath);
    const entries = nanoParseTar(buffer);

    await writeTarEntries(entries, destinationDirectory);
};

/** tar + gzip. Used when Turborepo-protocol compatibility matters. */
export const createTarGz = async (sourceDirectory: string, outputPath: string): Promise<void> => {
    const entries = await collectEntries(sourceDirectory);
    const tarBytes = nanoCreateTar(entries);

    await compressBuffer(tarBytes, createGzip(), outputPath);
};

/** tar + gzip extract, with path-traversal validation. */
export const extractTarGz = async (archivePath: string, destinationDirectory: string): Promise<void> => {
    const tarBuffer = await decompressBuffer(archivePath, createGunzip());
    const entries = nanoParseTar(tarBuffer);

    await writeTarEntries(entries, destinationDirectory);
};

/**
 * tar + brotli. nanotar produces the tar bytes; node:zlib streams them
 * through the brotli encoder so we never hold both the tar and its
 * compressed form in memory at once.
 */
export const createTarBrotli = async (sourceDirectory: string, outputPath: string): Promise<void> => {
    const entries = await collectEntries(sourceDirectory);
    const tarBytes = nanoCreateTar(entries);

    await compressBuffer(tarBytes, createBrotliCompress(BROTLI_COMPRESS_OPTIONS), outputPath);
};

/** Inverse of {@link createTarBrotli}, with path-traversal validation. */
export const extractTarBrotli = async (archivePath: string, destinationDirectory: string): Promise<void> => {
    const tarBuffer = await decompressBuffer(archivePath, createBrotliDecompress());
    const entries = nanoParseTar(tarBuffer);

    await writeTarEntries(entries, destinationDirectory);
};
