import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

import { CreateBucketCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { BlobServiceClient } from "@azure/storage-blob";
import { Client as FtpClient } from "basic-ftp";
import { instance } from "gaxios";
import SftpClient from "ssh2-sftp-client";
import { vi } from "vitest";

import S3Storage from "../../src/storage/aws/s3-storage";
import AwsLightStorage from "../../src/storage/aws-light/aws-light-storage";
import AzureStorage from "../../src/storage/azure/azure-storage";
import FtpStorage from "../../src/storage/ftp/ftp-storage";
import GCStorage from "../../src/storage/gcs/gcs-storage";
import SftpStorage from "../../src/storage/sftp/sftp-storage";
import { BaseStorage } from "../../src/storage/storage";
import type { MatrixBackend, MatrixProvider, MatrixStorageOptions } from "../__helpers__/matrix";

/** Live tests run only with LIVE_TESTS=1, against the services of docker-compose.live.yml. */
export const LIVE = process.env.LIVE_TESTS === "1";

const env = (name: string, fallback: string): string => process.env[name] ?? fallback;

// The defaults match docker-compose.live.yml.
const S3 = {
    accessKeyId: env("LIVE_S3_ACCESS_KEY", "live-access-key"),
    endpoint: env("LIVE_S3_ENDPOINT", "http://127.0.0.1:9000"),
    region: env("LIVE_S3_REGION", "us-east-1"),
    secretAccessKey: env("LIVE_S3_SECRET_KEY", "live-secret-key"),
};
// Azurite's documented development account; not a secret.
const AZURITE_ACCOUNT_KEY = ["Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq", "K1SZFPTOtr", "KBHBeksoGMGw=="].join("/");
const AZURE_CONNECTION_STRING = env(
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

/** A backend of a real service: what the matrix needs, plus failure injection for the storage contract. */
export interface LiveBackend extends MatrixBackend {
    /** Makes every call to the service fail, or work again. */
    failBackend: (failing: boolean) => void;
}

export interface LiveProvider extends Pick<MatrixProvider, "customNamePurgeGap" | "minChunkSize" | "resumable"> {
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

const s3Client = (): S3Client => new S3Client({ credentials: S3, endpoint: S3.endpoint, forcePathStyle: true, region: S3.region });

/** A fresh bucket on the S3 service, and probes for its objects. */
const s3Bucket = async (): Promise<Pick<LiveBackend, "hasObject" | "putObject"> & { bucket: string }> => {
    const client = s3Client();
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

export const LIVE_PROVIDERS: Record<string, LiveProvider> = {
    "aws-light (MinIO)": {
        customNamePurgeGap: "AwsLightMetaStorage can't list its records; purge looks uploads up by object key",
        minChunkSize: 5 * 1024 * 1024,
        resumable: true,
        setup: async () => {
            const { bucket, hasObject, putObject } = await s3Bucket();
            const realFetch = globalThis.fetch;

            return {
                createStorage: (options: MatrixStorageOptions) => new AwsLightStorage({ ...S3, bucket, retryConfig: { maxRetries: 0 }, ...options }),
                failBackend: (failing) => {
                    vi.stubGlobal(
                        "fetch",
                        failing
                            ? async () => {
                                  throw new Error("service down");
                              }
                            : realFetch,
                    );
                },
                hasObject,
                putObject,
            };
        },
    },
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
    "s3 (MinIO)": {
        customNamePurgeGap: "S3MetaStorage can't list its records; purge looks uploads up by object key",
        minChunkSize: 5 * 1024 * 1024,
        resumable: true,
        setup: async () => {
            const { bucket, hasObject, putObject } = await s3Bucket();

            return {
                createStorage: (options: MatrixStorageOptions) =>
                    new S3Storage({
                        bucket,
                        credentials: S3,
                        endpoint: S3.endpoint,
                        forcePathStyle: true,
                        region: S3.region,
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
};
