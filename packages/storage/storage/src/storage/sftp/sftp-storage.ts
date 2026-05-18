import etag from "etag";
import SftpClient from "ssh2-sftp-client";

import { ERRORS, throwErrorCode } from "../../utils/errors";
import type MetaStorage from "../meta-storage";
import { BaseStorage } from "../storage";
import type { FileInit, FilePart, FileQuery, FileReturn } from "../utils/file";
import { getFileStatus, hasContent, partMatch, updateSize } from "../utils/file";
import { collectStream, posixDirname, trimSlashes } from "../utils/remote";
import SftpFile from "./sftp-file";
import SftpMetaStorage from "./sftp-meta-storage";
import type { SftpStorageOptions } from "./types";

// SFTP "no such file": SSH_FX_NO_SUCH_FILE (2) or a libc ENOENT bubbled up by
// ssh2-sftp-client; some errors only carry the condition in the message.
const isNotFoundError = (error: unknown): boolean => {
    const code = (error as { code?: number | string })?.code;
    const message = error instanceof Error ? error.message : String(error);

    return code === 2 || code === "ENOENT" || /no such file|not exist|no such path/i.test(message);
};

/**
 * SFTP storage backend (built on `ssh2-sftp-client`).
 *
 * Routes virtual keys onto remote paths under `rootFolderPath`. SFTP has no
 * native metadata store, so upload metadata is kept as sidecar JSON on the
 * local disk (see `SftpMetaStorage`).
 *
 * A fresh SFTP connection is opened and closed around every operation: the
 * underlying SSH channel is not safe for concurrent use, so the adapter does
 * not pool connections.
 *
 * **Limitations**:
 * - `write()` buffers the full part in memory before uploading (no remote append), so chunked uploads overwrite rather than append.
 * - `getReadUrl` / `getUploadUrl` are not supported — SFTP has no signed-URL concept.
 */
class SftpStorage extends BaseStorage<SftpFile> {
    public static override readonly name: string = "sftp";

    public override checksumTypes: string[] = [];

    protected meta: MetaStorage<SftpFile>;

    private readonly connection: SftpStorageOptions["connection"];

    private readonly rootFolderPath: string;

    public constructor(config: SftpStorageOptions) {
        super(config);

        this.connection = config.connection;
        this.rootFolderPath = trimSlashes(config.rootFolderPath ?? "");
        this.meta = config.metaStorage ?? new SftpMetaStorage(config.metaStorageConfig);

        this.isReady = true;
    }

    public async create(config: FileInit): Promise<SftpFile> {
        return this.instrumentOperation("create", async () => {
            const file = new SftpFile(config);

            file.name = this.namingFunction(file);
            file.path = this.keyToPath(file.name);

            await this.validate(file);

            try {
                const existing = await this.getMeta(file.id);

                if (existing.status === "completed") {
                    return existing;
                }
            } catch {
                // new upload
            }

            file.bytesWritten = 0;
            file.status = getFileStatus(file);

            await this.saveMeta(file);
            await this.onCreate(file);

            return file;
        });
    }

    public async write(part: FilePart | FileQuery | SftpFile): Promise<SftpFile> {
        return this.instrumentOperation("write", async () => {
            let file: SftpFile;

            if ("contentType" in part && "metadata" in part && !("body" in part) && !("start" in part)) {
                file = part;
            } else {
                file = await this.getMeta(part.id);
                await this.checkIfExpired(file);
            }

            if (file.status === "completed") {
                return file;
            }

            if (part.size !== undefined) {
                updateSize(file, part.size);
            }

            if (!partMatch(part, file)) {
                return throwErrorCode(ERRORS.FILE_CONFLICT);
            }

            const lockToken = await this.lock(part.id);

            try {
                if (hasContent(part)) {
                    if (this.isUnsupportedChecksum(part.checksumAlgorithm)) {
                        return throwErrorCode(ERRORS.UNSUPPORTED_CHECKSUM_ALGORITHM);
                    }

                    // SFTP has no remote append/seek primitive here: a
                    // non-initial chunk would overwrite earlier bytes and
                    // silently lose data. Reject resumable/chunked writes.
                    if (part.start > 0) {
                        return throwErrorCode(ERRORS.METHOD_NOT_ALLOWED, "SFTP storage does not support chunked or resumable uploads; send the file in a single request.");
                    }

                    const buffer = await collectStream(part.body);
                    const path = file.path ?? this.keyToPath(file.name || file.id);

                    await this.run(async (client) => {
                        const directory = posixDirname(path);

                        if (directory) {
                            await client.mkdir(directory, true);
                        }

                        await client.put(buffer, path);
                    });

                    file.bytesWritten = buffer.length;
                    file.size = buffer.length;
                    file.path = path;
                    file.ETag = etag(buffer);
                }

                file.status = getFileStatus(file);

                await this.saveMeta(file);

                return file;
            } finally {
                await this.unlock(part.id, lockToken);
            }
        });
    }

    public async get({ id }: FileQuery): Promise<FileReturn> {
        return this.instrumentOperation("get", async () => {
            const file = await this.checkIfExpired(await this.getMeta(id));
            const path = file.path ?? this.keyToPath(file.name || id);

            const content = await this.run(async (client) => {
                try {
                    return (await client.get(path)) as Buffer;
                } catch (error) {
                    if (isNotFoundError(error)) {
                        return throwErrorCode(ERRORS.FILE_NOT_FOUND);
                    }

                    throw error;
                }
            });

            return {
                content,
                contentType: file.contentType,
                ETag: file.ETag ?? etag(content),
                expiredAt: file.expiredAt,
                id,
                metadata: file.metadata,
                modifiedAt: file.modifiedAt,
                name: file.name,
                originalName: file.originalName,
                size: file.size ?? content.length,
            };
        });
    }

    public async delete({ id }: FileQuery): Promise<SftpFile> {
        return this.instrumentOperation("delete", async () => {
            const file = await this.getMeta(id);
            const path = file.path ?? this.keyToPath(file.name || id);

            await this.run(async (client) => {
                try {
                    await client.delete(path);
                } catch (error) {
                    if (!isNotFoundError(error)) {
                        throw error;
                    }
                }
            });

            await this.deleteMeta(id);

            const deletedFile = { ...file, status: "deleted" } as SftpFile;

            await this.onDelete(deletedFile);

            return deletedFile;
        });
    }

    public async copy(name: string, destination: string): Promise<SftpFile> {
        return this.instrumentOperation("copy", async () => {
            const sourceFile = await this.getMeta(name);
            const sourcePath = sourceFile.path ?? this.keyToPath(sourceFile.name || name);
            const targetPath = this.keyToPath(destination);

            await this.run(async (client) => {
                const buffer = (await client.get(sourcePath)) as Buffer;
                const directory = posixDirname(targetPath);

                if (directory) {
                    await client.mkdir(directory, true);
                }

                await client.put(buffer, targetPath);
            });

            const copiedFile = { ...sourceFile, id: destination, name: destination, path: targetPath } as SftpFile;

            await this.saveMeta(copiedFile);

            return copiedFile;
        });
    }

    public async move(name: string, destination: string): Promise<SftpFile> {
        return this.instrumentOperation("move", async () => {
            const sourceFile = await this.getMeta(name);
            const sourcePath = sourceFile.path ?? this.keyToPath(sourceFile.name || name);
            const targetPath = this.keyToPath(destination);

            await this.run(async (client) => {
                const directory = posixDirname(targetPath);

                if (directory) {
                    await client.mkdir(directory, true);
                }

                try {
                    await client.rename(sourcePath, targetPath);
                } catch (renameError) {
                    try {
                        const buffer = (await client.get(sourcePath)) as Buffer;

                        await client.put(buffer, targetPath);
                        await client.delete(sourcePath);
                    } catch (fallbackError) {
                        throw new AggregateError([renameError, fallbackError], `SFTP move failed: rename and copy+delete fallback both failed for "${sourcePath}" → "${targetPath}"`);
                    }
                }
            });

            const movedFile = { ...sourceFile, id: destination, name: destination, path: targetPath } as SftpFile;

            await this.saveMeta(movedFile);

            try {
                await this.deleteMeta(name);
            } catch {
                // ignore
            }

            return movedFile;
        });
    }

    public override async list(): Promise<SftpFile[]> {
        return this.instrumentOperation("list", async () => {
            const root = this.keyToPath("");

            return this.run(async (client) => {
                const files: SftpFile[] = [];

                const walk = async (directory: string): Promise<void> => {
                    let entries: Awaited<ReturnType<SftpClient["list"]>>;

                    try {
                        entries = await client.list(directory || ".");
                    } catch (error) {
                        if (isNotFoundError(error)) {
                            return;
                        }

                        throw error;
                    }

                    for (const entry of entries) {
                        const childPath = directory ? `${directory}/${entry.name}` : entry.name;

                        if (entry.type === "d") {
                            await walk(childPath);

                            continue;
                        }

                        if (entry.type !== "-") {
                            continue;
                        }

                        const key = this.pathToKey(childPath);

                        if (!key) {
                            continue;
                        }

                        const file = new SftpFile({ contentType: "application/octet-stream", metadata: {}, originalName: entry.name });

                        file.id = key;
                        file.name = key;
                        file.path = childPath;
                        file.size = entry.size;
                        file.modifiedAt = new Date(entry.modifyTime).toISOString();

                        files.push(file);
                    }
                };

                await walk(root);

                return files;
            });
        });
    }

    public override async exists({ id }: FileQuery): Promise<boolean> {
        return this.instrumentOperation("exists", async () => {
            let file: SftpFile;

            try {
                file = await this.getMeta(id);
            } catch {
                return false;
            }

            const path = file.path ?? this.keyToPath(file.name || id);

            return this.run(async (client) => {
                const type = await client.exists(path);

                // "-" regular file, "l" symlink (to a file). "d" means a
                // directory occupies the path, which is not our object.
                return type === "-" || type === "l";
            });
        });
    }

    private async run<T>(function_: (client: SftpClient) => Promise<T>): Promise<T> {
        const client = new SftpClient();

        await client.connect(this.connection);

        try {
            return await function_(client);
        } finally {
            await client.end();
        }
    }

    private keyToPath(key: string): string {
        const inner = trimSlashes(key);

        if (inner) {
            BaseStorage.assertSafeId(inner);
        }

        const parts: string[] = [];

        if (this.rootFolderPath) {
            parts.push(this.rootFolderPath);
        }

        if (inner) {
            parts.push(inner);
        }

        if (parts.length === 0) {
            return "";
        }

        return this.rootFolderPath.startsWith("/") ? `/${parts.join("/")}` : parts.join("/");
    }

    private pathToKey(path: string): string {
        const inner = trimSlashes(path);

        if (!this.rootFolderPath) {
            return inner;
        }

        if (inner === this.rootFolderPath) {
            return "";
        }

        const prefix = `${this.rootFolderPath}/`;

        return inner.startsWith(prefix) ? inner.slice(prefix.length) : inner;
    }
}

export default SftpStorage;
