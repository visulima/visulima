import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, vi } from "vitest";

import FtpStorage from "../../src/storage/ftp/ftp-storage";
import SftpStorage from "../../src/storage/sftp/sftp-storage";
import { resetServer as resetFtp, server as ftpServer } from "../__helpers__/fakes/ftp";
import { resetServer as resetSftp, server as sftpServer } from "../__helpers__/fakes/sftp";
import { describeMatrix } from "../__helpers__/matrix";

vi.mock(import("basic-ftp"), async () => import("../__helpers__/fakes/ftp") as never);
vi.mock(import("ssh2-sftp-client"), async () => {
    const { Client } = await import("../__helpers__/fakes/sftp");

    return { default: Client } as never;
});

// Both servers keep files whole: an upload is written in one request, so chunked/resumable writes are refused.

describe("ftp storage matrix (server fake)", () => {
    describeMatrix({
        resumable: false,
        setup: async () => {
            resetFtp();

            const metaDirectory = await mkdtemp(join(tmpdir(), "ftp-matrix-"));

            return {
                cleanup: async () => rm(metaDirectory, { force: true, recursive: true }),
                createStorage: (options) =>
                    new FtpStorage({
                        connection: { host: "ftp.test" },
                        metaStorageConfig: { directory: metaDirectory },
                        retryConfig: { maxRetries: 0 },
                        rootFolderPath: "/uploads/",
                        ...options,
                    }),
                hasObject: (key) => ftpServer.files.has(`uploads/${key}`),
                putObject: (key, content) => {
                    ftpServer.files.set(`uploads/${key}`, { body: Buffer.from(content), modifiedAt: new Date() });
                },
            };
        },
    });
});

describe("sftp storage matrix (server fake)", () => {
    describeMatrix({
        resumable: false,
        setup: async () => {
            resetSftp();

            const metaDirectory = await mkdtemp(join(tmpdir(), "sftp-matrix-"));

            return {
                cleanup: async () => rm(metaDirectory, { force: true, recursive: true }),
                createStorage: (options) =>
                    new SftpStorage({
                        connection: { host: "sftp.test" },
                        metaStorageConfig: { directory: metaDirectory },
                        retryConfig: { maxRetries: 0 },
                        rootFolderPath: "uploads/",
                        ...options,
                    }),
                hasObject: (key) => sftpServer.files.has(`uploads/${key}`),
                putObject: (key, content) => {
                    sftpServer.files.set(`uploads/${key}`, { body: Buffer.from(content), modifyTime: Date.now() });
                },
            };
        },
    });
});
