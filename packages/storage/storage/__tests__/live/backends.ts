import { createHmac, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

import { CreateBucketCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { BlobServiceClient } from "@azure/storage-blob";
import { StorageClient } from "@supabase/storage-js";
import { Client as FtpClient } from "basic-ftp";
import { instance } from "gaxios";
import PocketBase from "pocketbase";
import SftpClient from "ssh2-sftp-client";
import { vi } from "vitest";

import S3Storage from "../../src/storage/aws/s3-storage";
import AwsLightStorage from "../../src/storage/aws-light/aws-light-storage";
import AzureStorage from "../../src/storage/azure/azure-storage";
import FtpStorage from "../../src/storage/ftp/ftp-storage";
import GCStorage from "../../src/storage/gcs/gcs-storage";
import PocketBaseStorage from "../../src/storage/pocketbase/pocketbase-storage";
import SftpStorage from "../../src/storage/sftp/sftp-storage";
import { BaseStorage } from "../../src/storage/storage";
import SupabaseStorage from "../../src/storage/supabase/supabase-storage";
import WebdavStorage from "../../src/storage/webdav/webdav-storage";
import type { MatrixBackend, MatrixProvider, MatrixStorageOptions } from "../__helpers__/matrix";
import type { StorageContractScenario } from "../__helpers__/storage-contract";

/** Live tests run only with LIVE_TESTS=1, against the services of docker-compose.live.yml. */
export const LIVE = process.env.LIVE_TESTS === "1";

const env = (name: string, fallback: string): string => process.env[name] ?? fallback;

// The defaults match docker-compose.live.yml.
export const S3 = {
    accessKeyId: env("LIVE_S3_ACCESS_KEY", "live-access-key"),
    endpoint: env("LIVE_S3_ENDPOINT", "http://127.0.0.1:9000"),
    region: env("LIVE_S3_REGION", "us-east-1"),
    secretAccessKey: env("LIVE_S3_SECRET_KEY", "live-secret-key"),
};
// SeaweedFS takes the same credentials as MinIO.
const SEAWEEDFS = { ...S3, endpoint: env("LIVE_SEAWEEDFS_ENDPOINT", "http://127.0.0.1:8333") };

/** Connection settings of an S3-compatible service. */
export type S3Config = typeof S3;
// Azurite's documented development account; not a secret.
const AZURITE_ACCOUNT_KEY = ["Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq", "K1SZFPTOtr", "KBHBeksoGMGw=="].join("/");

export const AZURE_CONNECTION_STRING = env(
    "LIVE_AZURE_CONNECTION_STRING",
    `DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=${AZURITE_ACCOUNT_KEY};BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;`,
);
const FTP_HOME = env("LIVE_FTP_HOME", "/home/live");
const GCS_ENDPOINT = env("LIVE_GCS_ENDPOINT", "http://127.0.0.1:4443");
const SFTP = {
    host: env("LIVE_SFTP_HOST", "127.0.0.1"),
    password: env("LIVE_SFTP_PASSWORD", "live-password"),
    port: Number(env("LIVE_SFTP_PORT", "2222")),
    username: env("LIVE_SFTP_USER", "live"),
};
const FTP = {
    host: env("LIVE_FTP_HOST", "127.0.0.1"),
    password: env("LIVE_FTP_PASSWORD", "live-password"),
    port: Number(env("LIVE_FTP_PORT", "2121")),
    user: env("LIVE_FTP_USER", "live"),
};
const WEBDAV = {
    password: env("LIVE_WEBDAV_PASSWORD", "live-password"),
    url: env("LIVE_WEBDAV_URL", "http://127.0.0.1:8081/dav"),
    username: env("LIVE_WEBDAV_USER", "live"),
};
const POCKETBASE = {
    adminEmail: env("LIVE_POCKETBASE_EMAIL", "live@example.com"),
    adminPassword: env("LIVE_POCKETBASE_PASSWORD", "live-password"),
    url: env("LIVE_POCKETBASE_URL", "http://127.0.0.1:8090"),
};
const SUPABASE_URL = env("LIVE_SUPABASE_URL", "http://127.0.0.1:5000");

/** A service_role JWT for the storage-api server, signed with its AUTH_JWT_SECRET. */
const supabaseServiceKey = (): string => {
    const encode = (value: object): string => Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, role: "service_role" })}`;
    const secret = env("LIVE_SUPABASE_JWT_SECRET", "live-jwt-secret-at-least-32-characters-long");

    return `${unsigned}.${createHmac("sha256", secret).update(unsigned).digest("base64url")}`;
};

/** A backend of a real service: what the matrix needs, plus failure injection for the storage contract. */
export interface LiveBackend extends MatrixBackend {
    /** Makes every call to the service fail, or work again. */
    failBackend: (failing: boolean) => void;
}

export interface LiveProvider extends Pick<MatrixProvider, "customNamePurgeGap" | "minChunkSize" | "resumable"> {
    /** Contract scenarios the service can't run, with the reason. */
    contractSkips?: Partial<Record<StorageContractScenario, string>>;
    /** A backend over a fresh bucket, container or directory, so tests never see each other's objects. */
    setup: () => Promise<LiveBackend>;
}

const unique = (): string => `live-${randomUUID().slice(0, 8)}`;

const failWith = (failing: boolean, target: object, method: string): void => {
    // eslint-disable-next-line sonarjs/no-selector-parameter -- the contract switches failures on and off
    if (failing) {
        vi.spyOn(target as Record<string, () => unknown>, method).mockRejectedValue(new Error("service down"));
    } else {
        vi.restoreAllMocks();
    }
};

/** A global fetch that fails every request while failing, for adapters that call `fetch` directly. */
const failFetch = (failing: boolean): void => {
    // eslint-disable-next-line sonarjs/no-selector-parameter -- the contract switches failures on and off
    if (failing) {
        vi.stubGlobal("fetch", async () => {
            throw new Error("service down");
        });
    } else {
        vi.unstubAllGlobals();
    }
};

export const s3Client = (config: S3Config): S3Client =>
    new S3Client({ credentials: config, endpoint: config.endpoint, forcePathStyle: true, region: config.region });

/** A fresh bucket on the S3 service, and probes for its objects. */
export const s3Bucket = async (config: S3Config): Promise<Pick<LiveBackend, "hasObject" | "putObject"> & { bucket: string }> => {
    const client = s3Client(config);
    const bucket = unique();

    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    return {
        bucket,
        hasObject: async (key) =>
            client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })).then(
                () => true,
                (error: { name?: string }) => {
                    if (error.name === "NotFound") {
                        return false;
                    }

                    throw error;
                },
            ),
        putObject: async (key, content) => {
            await client.send(new PutObjectCommand({ Body: content, Bucket: bucket, Key: key }));
        },
    };
};

/** A temp directory for the local meta store of FTP and SFTP, which keep no metadata remotely. */
const metaDirectory = async (): Promise<{ cleanup: () => Promise<void>; directory: string }> => {
    const directory = await mkdtemp(join(tmpdir(), "storage-live-"));

    return { cleanup: async () => rm(directory, { force: true, recursive: true }), directory };
};

// The contract ages an upload by faking the clock, so its requests are signed hours off and an S3
// service refuses them (RequestTimeTooSkewed). The matrix checks expiry against these services by
// ageing the upload's record instead.
const SIGNED_WITH_FAKE_CLOCK = "requests signed with a faked clock are refused as skewed";

/** S3Storage and AwsLightStorage over an S3-compatible service. */
const s3Providers = (service: string, config: S3Config): Record<string, LiveProvider> => {
    return {
        [`aws-light (${service})`]: {
            contractSkips: { "expired upload": SIGNED_WITH_FAKE_CLOCK, "failing meta store": SIGNED_WITH_FAKE_CLOCK, purge: SIGNED_WITH_FAKE_CLOCK },
            customNamePurgeGap: "AwsLightMetaStorage can't list its records; purge looks uploads up by object key",
            minChunkSize: 5 * 1024 * 1024,
            resumable: true,
            setup: async () => {
                const { bucket, hasObject, putObject } = await s3Bucket(config);

                return {
                    createStorage: (options: MatrixStorageOptions) => new AwsLightStorage({ ...config, bucket, retryConfig: { maxRetries: 0 }, ...options }),
                    failBackend: failFetch,
                    hasObject,
                    putObject,
                };
            },
        },
        [`s3 (${service})`]: {
            contractSkips: { "expired upload": SIGNED_WITH_FAKE_CLOCK, purge: SIGNED_WITH_FAKE_CLOCK },
            customNamePurgeGap: "S3MetaStorage can't list its records; purge looks uploads up by object key",
            minChunkSize: 5 * 1024 * 1024,
            resumable: true,
            setup: async () => {
                const { bucket, hasObject, putObject } = await s3Bucket(config);

                return {
                    createStorage: (options: MatrixStorageOptions) =>
                        new S3Storage({
                            bucket,
                            credentials: config,
                            endpoint: config.endpoint,
                            forcePathStyle: true,
                            region: config.region,
                            retryConfig: { maxRetries: 0 },
                            ...options,
                        }),
                    failBackend: (failing) => {
                        failWith(failing, S3Client.prototype, "send");
                    },
                    hasObject,
                    putObject,
                };
            },
        },
    };
};

export const LIVE_PROVIDERS: Record<string, LiveProvider> = {
    ...s3Providers("MinIO", S3),
    ...s3Providers("SeaweedFS", SEAWEEDFS),
    "azure (Azurite)": {
        resumable: true,
        setup: async () => {
            const containerName = unique();
            const container = BlobServiceClient.fromConnectionString(AZURE_CONNECTION_STRING).getContainerClient(containerName);

            await container.create();

            return {
                createStorage: (options: MatrixStorageOptions) =>
                    new AzureStorage({ connectionString: AZURE_CONNECTION_STRING, containerName, retryConfig: { maxRetries: 0 }, ...options }),
                failBackend: (failing) => {
                    failWith(failing, BaseStorage.prototype, "runOperation");
                },
                hasObject: async (key) => container.getBlobClient(key).exists(),
                putObject: async (key, content) => {
                    await container.getBlockBlobClient(key).upload(content, content.length);
                },
            };
        },
    },
    "ftp (vsftpd)": {
        resumable: false,
        setup: async () => {
            // The adapter addresses absolute paths, and vsftpd does not chroot the user into its home.
            const root = `${FTP_HOME}/${unique()}`;
            const meta = await metaDirectory();
            const withClient = async <T>(work: (client: FtpClient) => Promise<T>): Promise<T> => {
                const client = new FtpClient();

                try {
                    await client.access(FTP);

                    return await work(client);
                } finally {
                    client.close();
                }
            };

            return {
                cleanup: meta.cleanup,
                createStorage: (options: MatrixStorageOptions) =>
                    new FtpStorage({
                        connection: FTP,
                        metaStorageConfig: { directory: meta.directory },
                        retryConfig: { maxRetries: 0 },
                        rootFolderPath: `${root}/`,
                        ...options,
                    }),
                failBackend: (failing) => {
                    failWith(failing, FtpClient.prototype, "access");
                },
                hasObject: async (key) =>
                    withClient(async (client) =>
                        client.size(`${root}/${key}`).then(
                            () => true,
                            () => false,
                        ),
                    ),
                putObject: async (key, content) => {
                    await withClient(async (client) => {
                        await client.ensureDir(`${root}/${key.split("/").slice(0, -1).join("/")}`);
                        await client.uploadFrom(Readable.from([Buffer.from(content)]), `${root}/${key}`);
                    });
                },
            };
        },
    },
    "gcs (fake-gcs-server)": {
        contractSkips: {
            // fake-gcs-server answers the resumable-session status query (`Content-Range: bytes */N`) with
            // 200 and an off-by-one Range, where GCS answers 308; the GCS fake covers resume instead.
            "resume across processes": "fake-gcs-server does not emulate the resumable session status query",
        },
        customNamePurgeGap: "GCSMetaStorage can't list its records; purge looks uploads up by object name",
        resumable: true,
        setup: async () => {
            const bucket = unique();
            const created = await fetch(`${GCS_ENDPOINT}/storage/v1/b?project=live`, { body: JSON.stringify({ name: bucket }), method: "POST" });

            if (!created.ok) {
                throw new Error(`Creating the GCS bucket failed: ${String(created.status)}`);
            }

            const object = `${GCS_ENDPOINT}/storage/v1/b/${bucket}/o`;

            return {
                createStorage: (options: MatrixStorageOptions) =>
                    new GCStorage({
                        // An API key keeps google-auth-library from looking for real credentials.
                        apiKey: "live",
                        bucket,
                        projectId: "live",
                        retryOptions: { retry: 0 },
                        storageAPI: `${GCS_ENDPOINT}/storage/v1/b`,
                        uploadAPI: `${GCS_ENDPOINT}/upload/storage/v1/b`,
                        ...options,
                    }),
                failBackend: (failing) => {
                    instance.defaults = failing
                        ? {
                              fetchImplementation: async () => {
                                  throw new Error("service down");
                              },
                          }
                        : {};
                },
                hasObject: async (key) => fetch(`${object}/${encodeURIComponent(key)}`).then(({ ok }) => ok),
                putObject: async (key, content) => {
                    await fetch(`${GCS_ENDPOINT}/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(key)}`, {
                        body: content,
                        method: "POST",
                    });
                },
            };
        },
    },
    "pocketbase (PocketBase 0.40)": {
        resumable: false,
        setup: async () => {
            // A fresh collection per test, holding one record (key + file) per object.
            const admin = new PocketBase(POCKETBASE.url);
            const collection = unique().replace("-", "_");

            await admin.collection("_superusers").authWithPassword(POCKETBASE.adminEmail, POCKETBASE.adminPassword);
            await admin.collections.create({
                fields: [
                    { name: "key", required: true, type: "text" },
                    { maxSelect: 1, maxSize: 64 * 1024 * 1024, name: "file", type: "file" },
                ],
                name: collection,
                type: "base",
            });

            const meta = await metaDirectory();

            return {
                cleanup: async () => {
                    await admin.collections.delete(collection);
                    await meta.cleanup();
                },
                createStorage: (options: MatrixStorageOptions) =>
                    new PocketBaseStorage({
                        ...POCKETBASE,
                        collection,
                        metaStorageConfig: { directory: meta.directory },
                        retryConfig: { maxRetries: 0 },
                        ...options,
                    }),
                failBackend: failFetch,
                hasObject: async (key) =>
                    admin
                        .collection(collection)
                        .getFirstListItem(admin.filter("key = {:key}", { key }))
                        .then(
                            () => true,
                            (error: { status?: number }) => {
                                if (error.status === 404) {
                                    return false;
                                }

                                throw error;
                            },
                        ),
                putObject: async (key, content) => {
                    const form = new FormData();

                    form.append("key", key);
                    form.append("file", new Blob([content], { type: "text/plain" }), "object.txt");
                    await admin.collection(collection).create(form);
                },
            };
        },
    },
    "sftp (OpenSSH)": {
        resumable: false,
        setup: async () => {
            const root = `upload/${unique()}`;
            const meta = await metaDirectory();
            const withClient = async <T>(work: (client: SftpClient) => Promise<T>): Promise<T> => {
                const client = new SftpClient();

                await client.connect(SFTP);

                try {
                    return await work(client);
                } finally {
                    await client.end();
                }
            };

            return {
                cleanup: meta.cleanup,
                createStorage: (options: MatrixStorageOptions) =>
                    new SftpStorage({
                        connection: SFTP,
                        metaStorageConfig: { directory: meta.directory },
                        retryConfig: { maxRetries: 0 },
                        rootFolderPath: `${root}/`,
                        ...options,
                    }),
                failBackend: (failing) => {
                    failWith(failing, SftpClient.prototype, "connect");
                },
                hasObject: async (key) => withClient(async (client) => (await client.exists(`${root}/${key}`)) === "-"),
                putObject: async (key, content) => {
                    await withClient(async (client) => {
                        await client.mkdir(`${root}/${key.split("/").slice(0, -1).join("/")}`, true);
                        await client.put(Buffer.from(content), `${root}/${key}`);
                    });
                },
            };
        },
    },
    "supabase (storage-api)": {
        resumable: false,
        setup: async () => {
            const state = { failing: false };
            // The standalone storage-api serves at its root, not under /storage/v1 like a project URL.
            const client = new StorageClient(SUPABASE_URL, { Authorization: `Bearer ${supabaseServiceKey()}` }, async (input, init) => {
                if (state.failing) {
                    throw new Error("service down");
                }

                return fetch(input, init);
            });
            const bucket = unique();
            const created = await client.createBucket(bucket);

            if (created.error) {
                throw created.error;
            }

            const meta = await metaDirectory();

            return {
                cleanup: async () => {
                    await client.emptyBucket(bucket);
                    await client.deleteBucket(bucket);
                    await meta.cleanup();
                },
                createStorage: (options: MatrixStorageOptions) =>
                    new SupabaseStorage({ bucket, client, metaStorageConfig: { directory: meta.directory }, retryConfig: { maxRetries: 0 }, ...options }),
                failBackend: (failing) => {
                    state.failing = failing;
                },
                hasObject: async (key) => {
                    const { data, error } = await client.from(bucket).exists(key);

                    // storage-api answers a HEAD of a missing object with 400 (and no body to say 404).
                    if (error && ![400, 404].includes((error as { status?: number }).status ?? 0)) {
                        throw error;
                    }

                    return data;
                },
                putObject: async (key, content) => {
                    const { error } = await client.from(bucket).upload(key, content, { contentType: "text/plain" });

                    if (error) {
                        throw error;
                    }
                },
            };
        },
    },
    "webdav (Apache mod_dav)": {
        resumable: false,
        setup: async () => {
            const root = unique();
            const meta = await metaDirectory();
            const auth = { Authorization: `Basic ${Buffer.from(`${WEBDAV.username}:${WEBDAV.password}`).toString("base64")}` };
            const url = (key: string): string =>
                `${WEBDAV.url}/${root}/${key
                    .split("/")
                    .map((segment) => encodeURIComponent(segment))
                    .join("/")}`;

            return {
                cleanup: async () => {
                    await fetch(`${WEBDAV.url}/${root}/`, { headers: auth, method: "DELETE" });
                    await meta.cleanup();
                },
                // mod_dav evaluates the ETag predicates, so the adapter can send them.
                createStorage: (options: MatrixStorageOptions) =>
                    new WebdavStorage({
                        ...WEBDAV,
                        conditional: true,
                        metaStorageConfig: { directory: meta.directory },
                        retryConfig: { maxRetries: 0 },
                        rootFolderPath: root,
                        ...options,
                    }),
                failBackend: failFetch,
                hasObject: async (key) => fetch(url(key), { headers: auth, method: "HEAD" }).then(({ ok }) => ok),
                putObject: async (key, content) => {
                    let collection = `${WEBDAV.url}/${root}`;

                    for (const segment of ["", ...key.split("/").slice(0, -1)]) {
                        collection += segment ? `/${segment}` : "";
                        await fetch(`${collection}/`, { headers: auth, method: "MKCOL" });
                    }

                    await fetch(url(key), { body: content, headers: auth, method: "PUT" });
                },
            };
        },
    },
};
