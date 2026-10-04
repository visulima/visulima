import { createHash, randomUUID } from "node:crypto";
import { open, rename, stat, unlink, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";

import { ensureDir, readFile, remove, walk, writeFile } from "@visulima/fs";
import { join, normalize } from "@visulima/path";

import { ERRORS, throwErrorCode } from "../../utils/errors";
import MetaStorage, { isMetaNotFound, setMetaVersion } from "../meta-storage";
import type { LocalMetaStorageOptions } from "../meta-storage-options";
import type { File } from "../utils/file";
import { parseMetadata, stringifyMetadata } from "../utils/file/metadata";

export type { LocalMetaStorageOptions } from "../meta-storage-options";

/** A lock file older than this belongs to a crashed process and is taken over. */
const LOCK_STALE_MS = 10_000;

const LOCK_RETRY_DELAY_MS = 5;

const LOCK_ATTEMPTS = 2000;

/** The version of a metafile is the hash of its content. */
const hashContent = (content: string): string => createHash("sha256").update(content).digest("hex");

/**
 * Writes the metafile through a temporary file and a rename, so a concurrent reader never
 * sees it half-written, and attaches the new version to `file`.
 */
const writeMeta = async (path: string, file: File): Promise<void> => {
    const transformedMetadata = { ...file } as unknown as Omit<File, "metadata"> & { metadata?: string };

    if (transformedMetadata.metadata) {
        transformedMetadata.metadata = stringifyMetadata(file.metadata);
    }

    const content = JSON.stringify(transformedMetadata);
    const temporaryPath = `${path}.${randomUUID()}.tmp`;

    await writeFile(temporaryPath, content, { recursive: true });

    // Windows refuses to replace a file another handle is reading; that clears up quickly.
    for (let attempt = 1; ; attempt += 1) {
        try {
            await rename(temporaryPath, path);
            break;
        } catch (error) {
            const { code } = error as { code?: string };

            if ((code !== "EPERM" && code !== "EBUSY") || attempt >= 20) {
                await unlink(temporaryPath).catch(() => undefined);

                throw error;
            }

            await sleep(LOCK_RETRY_DELAY_MS * attempt);
        }
    }

    setMetaVersion(file, hashContent(content));
};

/**
 * Stores upload metafiles on local disk
 */
class LocalMetaStorage<T extends File = File> extends MetaStorage<T> {
    public override readonly supportsConditionalSave: boolean = true;

    public readonly directory: string;

    public constructor(config?: LocalMetaStorageOptions) {
        super(config);

        this.directory = normalize(config?.directory || join(tmpdir(), "Upload_meta"));

        this.accessCheck().catch((error) => {
            this.logger?.error("Metadata storage access check failed: %O", error);
        });
    }

    /**
     * Returns metafile path.
     * @param id upload id
     * @throws {UploadError} If the id resolves to a path outside the meta directory (e.g. via `..` traversal or absolute paths).
     */
    public getMetaPath = (id: string): string => {
        const resolved = normalize(`${this.directory}/${this.prefix}${id}${this.suffix}`);
        const baseWithSeparator = this.directory.endsWith("/") ? this.directory : `${this.directory}/`;

        if (!resolved.startsWith(baseWithSeparator)) {
            return throwErrorCode(ERRORS.INVALID_FILE_NAME, `Invalid id: "${id}" resolves outside the meta directory`);
        }

        return resolved;
    };

    /**
     * Returns upload id from metafile path.
     * @internal
     */
    public getIdFromPath = (metaFilePath: string): string => metaFilePath.slice(`${this.directory}/${this.prefix}`.length, -this.suffix.length);

    public override async save(id: string, file: T): Promise<T> {
        await this.accessCheck();

        const path = this.getMetaPath(id);

        await this.withFileLock(path, async () => writeMeta(path, file));

        return file;
    }

    public override async saveIfVersion(id: string, file: T, version: string): Promise<T | undefined> {
        await this.accessCheck();

        const path = this.getMetaPath(id);

        // The lock file makes compare-and-write atomic across processes sharing the directory.
        return this.withFileLock(path, async () => {
            const current = await readFile(path).catch(() => undefined);

            if (current === undefined || hashContent(current) !== version) {
                return undefined;
            }

            await writeMeta(path, file);

            return file;
        });
    }

    public override async touch(id: string, file: T): Promise<T> {
        const time = new Date();

        await utimes(this.getMetaPath(id), time, time);

        return file;
    }

    public override async get(id: string): Promise<T> {
        try {
            const json = await readFile(this.getMetaPath(id));

            if (json === undefined) {
                throw throwErrorCode(ERRORS.FILE_NOT_FOUND);
            }

            const file = JSON.parse(json) as T;

            if (file.metadata && typeof file.metadata === "string") {
                file.metadata = parseMetadata(file.metadata);
            }

            setMetaVersion(file, hashContent(json));

            return file;
        } catch (error) {
            const errorWithCode = error as { code?: string };
            const isSyntaxError = error instanceof SyntaxError;

            // Handle file not found errors (ENOENT code) or JSON parsing errors (corrupted metadata)
            if (errorWithCode.code === "ENOENT" || isSyntaxError) {
                throw throwErrorCode(ERRORS.FILE_NOT_FOUND);
            }

            throw error;
        }
    }

    public override async list(): Promise<T[]> {
        await this.accessCheck();

        // walk() yields native separators (backslashes on Windows); the ids use forward slashes.
        const toPosix = (value: string): string => value.replaceAll("\\", "/");
        const base = `${toPosix(this.directory).replace(/\/$/, "")}/${this.prefix}`;
        const files: T[] = [];

        for await (const { path } of walk(this.directory, { followSymlinks: false, includeDirs: false, includeFiles: true })) {
            const posixPath = toPosix(path);

            if (posixPath.startsWith(base) && posixPath.endsWith(this.suffix)) {
                try {
                    files.push(await this.get(posixPath.slice(base.length, -this.suffix.length)));
                } catch (error) {
                    // Deleted since the walk saw it.
                    if (!isMetaNotFound(error)) {
                        throw error;
                    }
                }
            }
        }

        return files;
    }

    public override async delete(id: string): Promise<void> {
        await remove(this.getMetaPath(id));
    }

    /**
     * Runs `function_` while holding the `.lock` file next to `path`, created exclusively so only
     * one process at a time can hold it.
     */
    // eslint-disable-next-line class-methods-use-this
    private async withFileLock<R>(path: string, function_: () => Promise<R>): Promise<R> {
        const lockPath = `${path}.lock`;

        for (let attempt = 1; ; attempt += 1) {
            try {
                const handle = await open(lockPath, "wx");

                await handle.close();
                break;
            } catch (error) {
                if ((error as { code?: string }).code !== "EEXIST") {
                    throw error;
                }

                const lock = await stat(lockPath).catch(() => undefined);

                if (lock !== undefined && Date.now() - lock.mtimeMs > LOCK_STALE_MS) {
                    await unlink(lockPath).catch(() => undefined);
                } else if (attempt >= LOCK_ATTEMPTS) {
                    throw new Error(`Metafile ${path} is locked`, { cause: error });
                } else {
                    await sleep(LOCK_RETRY_DELAY_MS);
                }
            }
        }

        try {
            return await function_();
        } finally {
            await unlink(lockPath).catch(() => undefined);
        }
    }

    private async accessCheck(): Promise<void> {
        await ensureDir(this.directory);
    }
}

export default LocalMetaStorage;
