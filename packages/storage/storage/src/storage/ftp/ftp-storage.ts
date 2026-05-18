import { Readable, Writable } from "node:stream";

import { Client } from "basic-ftp";
import etag from "etag";

import { ERRORS, throwErrorCode } from "../../utils/errors";
import type MetaStorage from "../meta-storage";
import { BaseStorage } from "../storage";
import type { FileInit, FilePart, FileQuery, FileReturn } from "../utils/file";
import { getFileStatus, hasContent, partMatch, updateSize } from "../utils/file";
import { collectStream, posixDirname, trimSlashes } from "../utils/remote";
import FtpFile from "./ftp-file";
import FtpMetaStorage from "./ftp-meta-storage";
import type { FtpStorageOptions } from "./types";

// "File unavailable" / "no such file" reply codes: 550 (action not taken),
// 450 (file action not taken), 553 (file name not allowed). Some servers only
// surface the condition in the message text, so match that as a fallback.
const isNotFoundError = (error: unknown): boolean => {
    const code = (error as { code?: number })?.code;

    if (code === 550 || code === 450 || code === 553) {
        return true;
    }

    const message = error instanceof Error ? error.message : String(error);

    return /no such file|not exist|cannot find|file unavailable/i.test(message);
};

const downloadToBuffer = async (client: Client, path: string): Promise<Buffer> => {
    const chunks: Buffer[] = [];
    const sink = new Writable({
        write(chunk, _encoding, callback) {
            chunks.push(Buffer.from(chunk));
            callback();
        },
    });

    await client.downloadTo(sink, path);

    return Buffer.concat(chunks);
};

/**
 * FTP / FTPS storage backend (built on `basic-ftp`).
 *
 * Routes virtual keys onto remote paths under `rootFolderPath`. FTP has no
 * native metadata store, so upload metadata is kept as sidecar JSON on the
 * local disk (see `FtpMetaStorage`).
 *
 * A fresh FTP connection is opened and closed around every operation: an FTP
 * control connection is single-session, so the adapter does not pool
 * connections.
 *
 * **Limitations**:
 * - `write()` buffers the full part in memory before uploading (no remote append), so chunked uploads overwrite rather than append.
 * - `getReadUrl` / `getUploadUrl` are not supported — FTP has no signed-URL concept.
 */
class FtpStorage extends BaseStorage<FtpFile> {
    public static override readonly name: string = "ftp";

    public override checksumTypes: string[] = [];

    protected meta: MetaStorage<FtpFile>;

    private readonly connection: FtpStorageOptions["connection"];

    private readonly rootFolderPath: string;

    public constructor(config: FtpStorageOptions) {
        super(config);

        this.connection = config.connection;
        this.rootFolderPath = trimSlashes(config.rootFolderPath ?? "");
        this.meta = config.metaStorage ?? new FtpMetaStorage(config.metaStorageConfig);

        this.isReady = true;
    }

    public async create(config: FileInit): Promise<FtpFile> {
        return this.instrumentOperation("create", async () => {
            const file = new FtpFile(config);

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

    public async write(part: FilePart | FileQuery | FtpFile): Promise<FtpFile> {
        return this.instrumentOperation("write", async () => {
            let file: FtpFile;

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

                    // FTP has no remote append/seek primitive: a non-initial
                    // chunk would overwrite earlier bytes and silently lose
                    // data. Reject resumable/chunked writes outright.
                    if (part.start > 0) {
                        return throwErrorCode(ERRORS.METHOD_NOT_ALLOWED, "FTP storage does not support chunked or resumable uploads; send the file in a single request.");
                    }

                    const buffer = await collectStream(part.body);
                    const path = file.path ?? this.keyToPath(file.name || file.id);

                    await this.run(async (client) => {
                        await this.ensureRemoteDirectory(client, path);

                        await client.uploadFrom(Readable.from(buffer), path);
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
                    return await downloadToBuffer(client, path);
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

    public async delete({ id }: FileQuery): Promise<FtpFile> {
        return this.instrumentOperation("delete", async () => {
            const file = await this.getMeta(id);
            const path = file.path ?? this.keyToPath(file.name || id);

            await this.run(async (client) => {
                try {
                    await client.remove(path);
                } catch (error) {
                    if (!isNotFoundError(error)) {
                        throw error;
                    }
                }
            });

            await this.deleteMeta(id);

            const deletedFile = { ...file, status: "deleted" } as FtpFile;

            await this.onDelete(deletedFile);

            return deletedFile;
        });
    }

    public async copy(name: string, destination: string): Promise<FtpFile> {
        return this.instrumentOperation("copy", async () => {
            const sourceFile = await this.getMeta(name);
            const sourcePath = sourceFile.path ?? this.keyToPath(sourceFile.name || name);
            const targetPath = this.keyToPath(destination);

            await this.run(async (client) => {
                const buffer = await downloadToBuffer(client, sourcePath);

                await this.ensureRemoteDirectory(client, targetPath);
                await client.uploadFrom(Readable.from(buffer), targetPath);
            });

            const copiedFile = { ...sourceFile, id: destination, name: destination, path: targetPath } as FtpFile;

            await this.saveMeta(copiedFile);

            return copiedFile;
        });
    }

    public async move(name: string, destination: string): Promise<FtpFile> {
        return this.instrumentOperation("move", async () => {
            const sourceFile = await this.getMeta(name);
            const sourcePath = sourceFile.path ?? this.keyToPath(sourceFile.name || name);
            const targetPath = this.keyToPath(destination);

            await this.run(async (client) => {
                try {
                    await this.ensureRemoteDirectory(client, targetPath);
                    await client.rename(sourcePath, targetPath);
                } catch (renameError) {
                    try {
                        const buffer = await downloadToBuffer(client, sourcePath);

                        await this.ensureRemoteDirectory(client, targetPath);
                        await client.uploadFrom(Readable.from(buffer), targetPath);
                        await client.remove(sourcePath);
                    } catch (fallbackError) {
                        throw new AggregateError([renameError, fallbackError], `FTP move failed: rename and copy+delete fallback both failed for "${sourcePath}" → "${targetPath}"`);
                    }
                }
            });

            const movedFile = { ...sourceFile, id: destination, name: destination, path: targetPath } as FtpFile;

            await this.saveMeta(movedFile);

            try {
                await this.deleteMeta(name);
            } catch {
                // ignore
            }

            return movedFile;
        });
    }

    public override async list(): Promise<FtpFile[]> {
        return this.instrumentOperation("list", async () => {
            const root = this.keyToPath("");

            return this.run(async (client) => {
                const files: FtpFile[] = [];

                const walk = async (directory: string): Promise<void> => {
                    let entries: Awaited<ReturnType<Client["list"]>>;

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

                        if (entry.isDirectory) {
                            await walk(childPath);

                            continue;
                        }

                        if (!entry.isFile) {
                            continue;
                        }

                        const key = this.pathToKey(childPath);

                        if (!key) {
                            continue;
                        }

                        const file = new FtpFile({ contentType: "application/octet-stream", metadata: {}, originalName: entry.name });

                        file.id = key;
                        file.name = key;
                        file.path = childPath;
                        file.size = entry.size;

                        if (entry.modifiedAt) {
                            file.modifiedAt = entry.modifiedAt.toISOString();
                        }

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
            let file: FtpFile;

            try {
                file = await this.getMeta(id);
            } catch {
                return false;
            }

            const path = file.path ?? this.keyToPath(file.name || id);

            return this.run(async (client) => {
                try {
                    await client.size(path);

                    return true;
                } catch (error) {
                    if (isNotFoundError(error)) {
                        return false;
                    }

                    throw error;
                }
            });
        });
    }

    private async run<T>(function_: (client: Client) => Promise<T>): Promise<T> {
        const client = new Client();

        await client.access(this.connection);

        try {
            return await function_(client);
        } finally {
            client.close();
        }
    }

    // eslint-disable-next-line class-methods-use-this
    private async ensureRemoteDirectory(client: Client, path: string): Promise<void> {
        const directory = posixDirname(path);

        if (directory) {
            await client.ensureDir(directory);
            // ensureDir leaves the working directory at `directory`; reset to
            // root so the following absolute-path operation resolves correctly.
            await client.cd("/");
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

        return `/${parts.join("/")}`;
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

export default FtpStorage;
