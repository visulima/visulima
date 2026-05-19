import { readFileSync } from "node:fs";

import type { App } from "firebase-admin/app";
import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

import { ERRORS, throwErrorCode } from "../../utils/errors";
import type MetaStorage from "../meta-storage";
import { BaseStorage } from "../storage";
import type { OperationOptions } from "../types";
import type { FileInit, FilePart, FileQuery, FileReturn } from "../utils/file";
import { getFileStatus, hasContent, partMatch, updateSize } from "../utils/file";
import FirebaseFile from "./firebase-file";
import FirebaseMetaStorage from "./firebase-meta-storage";
import type { FirebaseBucket, FirebaseStorageOptions } from "./types";

const DEFAULT_URL_EXPIRES_IN = 3600;

const collectStream = async (stream: AsyncIterable<Uint8Array | Buffer>): Promise<Buffer> => {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
};

/**
 * Detects whether the supplied `app` escape hatch is already a
 * `@google-cloud/storage` `Bucket` (firebase-admin returns one) rather than a
 * firebase `App`. A Bucket exposes `.file()` and `.getFiles()` functions.
 */
const isBucket = (value: unknown): value is FirebaseBucket =>
    typeof value === "object" &&
    value !== null &&
    typeof (value as FirebaseBucket).file === "function" &&
    typeof (value as FirebaseBucket).getFiles === "function";

/**
 * Firebase Storage backend.
 *
 * Firebase Storage is a Google Cloud Storage bucket under the hood; this
 * adapter resolves a `firebase-admin` app, obtains its `@google-cloud/storage`
 * `Bucket`, and drives single-shot uploads through it. The part stream is
 * buffered and uploaded in one `file.save()` call. Use `getUploadUrl` for
 * direct-from-client large transfers.
 * @example
 * ```ts
 * import { FirebaseStorage } from "@visulima/storage/provider/firebase";
 *
 * const storage = new FirebaseStorage({
 *   bucket: "my-project.appspot.com",
 *   projectId: process.env.FIREBASE_PROJECT_ID,
 *   credentials: {
 *     clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
 *     privateKey: process.env.FIREBASE_PRIVATE_KEY,
 *   },
 * });
 * ```
 * @remarks
 * - ⚠️ Per-operation `signal`/`timeout` are best-effort: the underlying SDK does not support request cancellation, so an in-flight call may complete server-side even after abort. `retries` is honored.
 */
class FirebaseStorage extends BaseStorage<FirebaseFile> {
    public static override readonly name: string = "firebase";

    public override checksumTypes: string[] = [];

    protected meta: MetaStorage<FirebaseFile>;

    private readonly bucket: FirebaseBucket;

    private readonly bucketName: string;

    private readonly defaultUrlExpiresIn: number;

    private readonly publicBaseUrl?: string;

    public constructor(config: FirebaseStorageOptions) {
        super(config);

        this.defaultUrlExpiresIn = config.defaultUrlExpiresIn ?? DEFAULT_URL_EXPIRES_IN;
        this.publicBaseUrl = config.publicBaseUrl?.replace(/\/+$/, "");

        if (config.app && isBucket(config.app)) {
            this.bucket = config.app;
            this.bucketName = config.app.name ?? "";
        } else {
            const bucketName = config.bucket ?? process.env.FIREBASE_STORAGE_BUCKET;

            if (!bucketName) {
                throw new Error("Firebase storage: `bucket` is required (or set FIREBASE_STORAGE_BUCKET).");
            }

            this.bucketName = bucketName;

            const app = (config.app as App | undefined) ?? FirebaseStorage.resolveApp(config, bucketName);

            this.bucket = getStorage(app).bucket(bucketName) as unknown as FirebaseBucket;
        }

        this.meta = config.metaStorage ?? new FirebaseMetaStorage(config.metaStorageConfig);

        this.isReady = true;
    }

    public override get raw(): FirebaseBucket {
        return this.bucket;
    }

    public async create(config: FileInit, _options?: OperationOptions): Promise<FirebaseFile> {
        return this.instrumentOperation("create", async () => {
            const file = new FirebaseFile(config);

            file.name = this.namingFunction(file);
            file.bucket = this.bucketName;
            file.path = file.name;

            await this.validate(file);

            try {
                const existing = await this.getMeta(file.id);

                if (existing.bytesWritten >= 0) {
                    return existing;
                }
            } catch {
                // ignore — new upload
            }

            file.bytesWritten = 0;
            file.status = getFileStatus(file);

            await this.saveMeta(file);
            await this.onCreate(file);

            return file;
        });
    }

    public async write(part: FilePart | FileQuery | FirebaseFile, options?: OperationOptions): Promise<FirebaseFile> {
        return this.instrumentOperation("write", async () => {
            let file: FirebaseFile;

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
                throw new Error("File part does not match");
            }

            const lockToken = await this.lock(part.id);

            try {
                if (hasContent(part)) {
                    if (this.isUnsupportedChecksum(part.checksumAlgorithm)) {
                        throw new Error("Unsupported checksum algorithm");
                    }

                    const buffer = await collectStream(part.body);
                    const path = file.path ?? file.name;

                    await this.runOperation(options, () =>
                        this.bucket.file(path).save(buffer, {
                            contentType: file.contentType,
                            resumable: false,
                        }),
                    );

                    file.bytesWritten = buffer.length;
                    file.size = buffer.length;
                    file.path = path;
                }

                file.status = getFileStatus(file);

                if (file.status === "completed") {
                    await this.internalOnComplete(file);
                }

                await this.saveMeta(file);

                return file;
            } finally {
                await this.unlock(part.id, lockToken);
            }
        });
    }

    public async delete({ id }: FileQuery, options?: OperationOptions): Promise<FirebaseFile> {
        return this.instrumentOperation("delete", async () => {
            let file: FirebaseFile | undefined;

            try {
                file = await this.getMeta(id);
            } catch {
                // No metadata — fall back to direct delete by id.
            }

            const path = file?.path ?? file?.name ?? id;

            await this.runOperation(options, () => this.bucket.file(path).delete({ ignoreNotFound: true }));

            if (file) {
                file.status = "deleted";

                await this.deleteMeta(file.id);
                await this.onDelete(file);

                return file;
            }

            return Object.assign(new FirebaseFile({ contentType: "application/octet-stream", metadata: {}, originalName: id }), {
                bucket: this.bucketName,
                id,
                name: id,
                path,
                status: "deleted" as const,
            });
        });
    }

    public override async exists({ id }: FileQuery, options?: OperationOptions): Promise<boolean> {
        return this.instrumentOperation("exists", async () => {
            let path = id;

            try {
                const meta = await this.getMeta(id);

                path = meta.path ?? id;
            } catch {
                // direct path lookup
            }

            try {
                const [exists] = await this.runOperation(options, () => this.bucket.file(path).exists());

                return exists;
            } catch {
                return false;
            }
        });
    }

    public async get({ id }: FileQuery, options?: OperationOptions): Promise<FileReturn> {
        return this.instrumentOperation("get", async () => {
            let path = id;
            let stored: FirebaseFile | undefined;

            try {
                stored = await this.checkIfExpired(await this.getMeta(id));
                path = stored.path ?? stored.name ?? id;
            } catch {
                // No metadata — treat `id` as a bucket-relative path.
            }

            const gcsFile = this.bucket.file(path);
            const [content] = await this.runOperation(options, () => gcsFile.download());

            let metadata: Awaited<ReturnType<typeof gcsFile.getMetadata>>[0] = {};

            try {
                [metadata] = await this.runOperation(options, () => gcsFile.getMetadata());
            } catch {
                // metadata is best-effort
            }

            return {
                content,
                contentType: stored?.contentType ?? metadata.contentType ?? "application/octet-stream",
                ETag: stored?.ETag ?? metadata.etag,
                expiredAt: stored?.expiredAt,
                id,
                metadata: stored?.metadata ?? {},
                modifiedAt: stored?.modifiedAt ?? metadata.updated,
                name: stored?.name ?? path,
                originalName: stored?.originalName ?? path,
                size: stored?.size ?? (metadata.size === undefined ? content.length : Number(metadata.size)),
            };
        });
    }

    public async copy(name: string, destination: string, options?: OperationOptions & { storageClass?: string }): Promise<FirebaseFile> {
        return this.instrumentOperation("copy", async () => {
            const meta = await this.getMetaSafe(name);
            const source = meta?.path ?? name;

            await this.runOperation(options, () => this.bucket.file(source).copy(this.bucket.file(destination)));

            const file = new FirebaseFile({
                contentType: "application/octet-stream",
                metadata: {},
                originalName: destination,
            });

            file.id = destination;
            file.name = destination;
            file.path = destination;
            file.bucket = this.bucketName;

            return file;
        });
    }

    public async move(name: string, destination: string, options?: OperationOptions): Promise<FirebaseFile> {
        return this.instrumentOperation("move", async () => {
            const meta = await this.getMetaSafe(name);
            const source = meta?.path ?? name;

            await this.runOperation(options, () => this.bucket.file(source).move(destination));

            const file = new FirebaseFile({
                contentType: "application/octet-stream",
                metadata: {},
                originalName: destination,
            });

            file.id = destination;
            file.name = destination;
            file.path = destination;
            file.bucket = this.bucketName;

            try {
                await this.deleteMeta(name);
            } catch {
                // ignore
            }

            return file;
        });
    }

    public override async list(limit = 1000, options?: OperationOptions): Promise<FirebaseFile[]> {
        return this.instrumentOperation(
            "list",
            async () => {
                const [files] = await this.runOperation(options, () => this.bucket.getFiles({ maxResults: limit }));

                return (files ?? []).map((entry) => {
                    const file = new FirebaseFile({
                        contentType: "application/octet-stream",
                        metadata: {},
                        originalName: entry.name,
                    });

                    file.id = entry.name;
                    file.name = entry.name;
                    file.path = entry.name;
                    file.bucket = this.bucketName;

                    return file;
                });
            },
            { limit },
        );
    }

    public override async getReadUrl(
        key: string,
        options?: { expiresIn?: number; responseContentDisposition?: string; responseContentType?: string },
    ): Promise<string> {
        if (this.publicBaseUrl) {
            return `${this.publicBaseUrl}/${key}`;
        }

        const expiresIn = options?.expiresIn ?? this.defaultUrlExpiresIn;

        try {
            const [url] = await this.bucket.file(key).getSignedUrl({
                action: "read",
                expires: Date.now() + expiresIn * 1000,
            });

            return url;
        } catch (error: unknown) {
            return throwErrorCode(ERRORS.METHOD_NOT_ALLOWED, error instanceof Error ? error.message : "Firebase: getSignedUrl failed");
        }
    }

    public override async getUploadUrl(key: string, options?: { contentLength?: number; contentType?: string; expiresIn?: number }): Promise<string> {
        const expiresIn = options?.expiresIn ?? this.defaultUrlExpiresIn;

        try {
            const [url] = await this.bucket.file(key).getSignedUrl({
                action: "write",
                contentType: options?.contentType,
                expires: Date.now() + expiresIn * 1000,
            });

            return url;
        } catch (error: unknown) {
            return throwErrorCode(ERRORS.METHOD_NOT_ALLOWED, error instanceof Error ? error.message : "Firebase: getSignedUrl failed");
        }
    }

    private static resolveApp(config: FirebaseStorageOptions, bucketName: string): App {
        const { appName } = config;

        const existing = getApps();

        const found = appName ? existing.find((app) => app.name === appName) : existing[0];

        if (found) {
            return appName ? getApp(appName) : getApp();
        }

        const projectId = config.projectId ?? process.env.FIREBASE_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT;

        let clientEmail = config.credentials?.clientEmail ?? process.env.FIREBASE_CLIENT_EMAIL;
        let privateKey = config.credentials?.privateKey ?? process.env.FIREBASE_PRIVATE_KEY;

        const serviceAccountPath = config.serviceAccountPath ?? process.env.GOOGLE_APPLICATION_CREDENTIALS;

        if ((!clientEmail || !privateKey) && serviceAccountPath) {
            const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8")) as {
                client_email?: string;
                private_key?: string;
                project_id?: string;
            };

            clientEmail ??= serviceAccount.client_email;
            privateKey ??= serviceAccount.private_key;
        }

        if (!clientEmail || !privateKey) {
            throw new Error(
                "Firebase storage: service-account credentials are required. Provide `credentials` " +
                    "({ clientEmail, privateKey }), `serviceAccountPath`, or set FIREBASE_CLIENT_EMAIL / " +
                    "FIREBASE_PRIVATE_KEY / GOOGLE_APPLICATION_CREDENTIALS.",
            );
        }

        return initializeApp(
            {
                credential: cert({
                    clientEmail,
                    privateKey: privateKey.replaceAll(String.raw`\n`, "\n"),
                    projectId,
                }),
                projectId,
                storageBucket: bucketName,
            },
            appName,
        );
    }

    private async getMetaSafe(id: string): Promise<FirebaseFile | undefined> {
        try {
            return await this.getMeta(id);
        } catch {
            return undefined;
        }
    }

    private internalOnComplete = (file: FirebaseFile): Promise<void> => this.deleteMeta(file.id);
}

export default FirebaseStorage;
