import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { actionDigestForTaskHash, containsByTaskHash, retrieveByTaskHash, storeByTaskHash } from "../src/backends/hash-bridge";
import { HttpRemoteCache } from "../src/backends/http";

const createTemporaryDirectory = async (): Promise<string> => {
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(tmpdir(), `remote-cache-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

/**
 * Starts a minimal HTTP server that simulates the Turborepo remote cache protocol.
 */
const startMockServer = (handler: (request: IncomingMessage, response: ServerResponse) => void): Promise<{ server: Server; url: string }> =>
    new Promise((resolve) => {
        const server = createServer(handler);

        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            const port = typeof address === "object" && address ? address.port : 0;

            resolve({ server, url: `http://127.0.0.1:${port}` });
        });
    });

const closeServer = (server: Server): Promise<void> =>
    new Promise((resolve) => {
        server.close(() => {
            resolve();
        });
    });

const collectRequestBody = (request: IncomingMessage): Promise<Buffer> => {
    const chunks: Buffer[] = [];

    return new Promise((resolve) => {
        request.on("data", (chunk: Buffer) => chunks.push(chunk));
        request.on("end", () => {
            resolve(Buffer.concat(chunks));
        });
    });
};

/** sha256-derive the artifact path the HTTP backend uses for a given task hash. */
const artifactPath = (taskHash: string): string => {
    const sha = createHash("sha256").update(`vis-task:${taskHash}`).digest("hex");

    return `/v8/artifacts/${sha}`;
};

describe(HttpRemoteCache, () => {
    let cacheDirectory: string;

    beforeEach(async () => {
        cacheDirectory = await createTemporaryDirectory();
    });

    afterEach(async () => {
        await rm(cacheDirectory, { force: true, recursive: true });
    });

    describe(containsByTaskHash, () => {
        it("returns true when artifact exists", async () => {
            expect.assertions(1);

            const expected = artifactPath("abc123");
            const { server, url } = await startMockServer((request, response) => {
                if (request.method === "HEAD" && request.url?.startsWith(expected)) {
                    response.writeHead(200);
                    response.end();
                } else {
                    response.writeHead(404);
                    response.end();
                }
            });

            try {
                const cache = new HttpRemoteCache({ url });
                const result = await containsByTaskHash(cache, "abc123");

                expect(result).toBe(true);
            } finally {
                await closeServer(server);
            }
        });

        it("returns false when artifact does not exist", async () => {
            expect.assertions(1);

            const { server, url } = await startMockServer((_request, response) => {
                response.writeHead(404);
                response.end();
            });

            try {
                const cache = new HttpRemoteCache({ url });
                const result = await containsByTaskHash(cache, "nonexistent");

                expect(result).toBe(false);
            } finally {
                await closeServer(server);
            }
        });

        it("returns false when reads are disabled", async () => {
            expect.assertions(1);

            const cache = new HttpRemoteCache({ mode: "write", url: "http://localhost:9999" });
            const result = await containsByTaskHash(cache, "abc123");

            expect(result).toBe(false);
        });

        it("returns false on network error", async () => {
            expect.assertions(1);

            const cache = new HttpRemoteCache({ timeout: 100, url: "http://127.0.0.1:1" });
            const result = await containsByTaskHash(cache, "abc123");

            expect(result).toBe(false);
        });

        it("includes teamId in query params", async () => {
            expect.assertions(1);

            let requestUrl = "";
            const { server, url } = await startMockServer((request, response) => {
                requestUrl = request.url ?? "";
                response.writeHead(200);
                response.end();
            });

            try {
                const cache = new HttpRemoteCache({ teamId: "my-team", url });

                await containsByTaskHash(cache, "abc123");

                expect(requestUrl).toContain("teamId=my-team");
            } finally {
                await closeServer(server);
            }
        });

        it("sends authorization header", async () => {
            expect.assertions(1);

            let authHeader = "";
            const { server, url } = await startMockServer((request, response) => {
                authHeader = request.headers.authorization ?? "";
                response.writeHead(200);
                response.end();
            });

            try {
                const cache = new HttpRemoteCache({ token: "my-token", url });

                await containsByTaskHash(cache, "abc123");

                expect(authHeader).toBe("Bearer my-token");
            } finally {
                await closeServer(server);
            }
        });
    });

    describe(storeByTaskHash, () => {
        it("returns false when writes are disabled", async () => {
            expect.assertions(1);

            const cache = new HttpRemoteCache({ mode: "read", url: "http://localhost:9999" });
            const result = await storeByTaskHash(cache, "abc123", cacheDirectory);

            expect(result).toBe(false);
        });

        it("returns false when cache entry is incomplete (no .commit)", async () => {
            expect.assertions(1);

            const entryDirectory = join(cacheDirectory, "abc123");

            await mkdir(entryDirectory, { recursive: true });
            await writeFile(join(entryDirectory, "code"), "0");

            const cache = new HttpRemoteCache({ url: "http://localhost:9999" });
            const result = await storeByTaskHash(cache, "abc123", cacheDirectory);

            expect(result).toBe(false);
        });

        it("uploads a valid cache entry", async () => {
            expect.assertions(3);

            const entryDirectory = join(cacheDirectory, "abc123");

            await mkdir(entryDirectory, { recursive: true });
            await writeFile(join(entryDirectory, ".commit"), "abc123");
            await writeFile(join(entryDirectory, "code"), "0");
            await writeFile(join(entryDirectory, "terminalOutput"), "Build done");

            let receivedMethod = "";
            let receivedBody: Buffer = Buffer.alloc(0);

            const { server, url } = await startMockServer((request, response) => {
                receivedMethod = request.method ?? "";

                collectRequestBody(request)
                    .then((body) => {
                        receivedBody = body;
                        response.writeHead(200);
                        response.end();

                        return undefined;
                    })
                    .catch(() => {
                        response.writeHead(500);
                        response.end();
                    });
            });

            try {
                const cache = new HttpRemoteCache({ url });
                const result = await storeByTaskHash(cache, "abc123", cacheDirectory);

                expect(result).toBe(true);
                expect(receivedMethod).toBe("PUT");
                expect(receivedBody.length).toBeGreaterThan(0);
            } finally {
                await closeServer(server);
            }
        });

        it("returns false when server returns error", async () => {
            expect.assertions(1);

            const entryDirectory = join(cacheDirectory, "abc123");

            await mkdir(entryDirectory, { recursive: true });
            await writeFile(join(entryDirectory, ".commit"), "abc123");

            const { server, url } = await startMockServer((_request, response) => {
                response.writeHead(500);
                response.end();
            });

            try {
                const cache = new HttpRemoteCache({ url });
                const result = await storeByTaskHash(cache, "abc123", cacheDirectory);

                expect(result).toBe(false);
            } finally {
                await closeServer(server);
            }
        });

        it("calls onUploadError callback on failure", async () => {
            expect.assertions(1);

            const entryDirectory = join(cacheDirectory, "ok-fail");

            await mkdir(entryDirectory, { recursive: true });
            await writeFile(join(entryDirectory, ".commit"), "ok-fail");

            const onUploadError = vi.fn<(hash: string, error: unknown) => void>();
            const cache = new HttpRemoteCache({
                onUploadError,
                timeout: 100,
                url: "http://127.0.0.1:1",
            });

            await storeByTaskHash(cache, "ok-fail", cacheDirectory);

            expect(onUploadError).toHaveBeenCalledTimes(1);
        });

        it("does not call onUploadError on success", async () => {
            expect.assertions(2);

            const entryDirectory = join(cacheDirectory, "ok-hash");

            await mkdir(entryDirectory, { recursive: true });
            await writeFile(join(entryDirectory, ".commit"), "ok-hash");

            const onUploadError = vi.fn<(hash: string, error: unknown) => void>();

            const { server, url } = await startMockServer((_request, response) => {
                collectRequestBody(_request)
                    .then(() => {
                        response.writeHead(200);
                        response.end();

                        return undefined;
                    })
                    .catch(() => {
                        response.writeHead(500);
                        response.end();
                    });
            });

            try {
                const cache = new HttpRemoteCache({ onUploadError, url });
                const result = await storeByTaskHash(cache, "ok-hash", cacheDirectory);

                expect(result).toBe(true);
                expect(onUploadError).not.toHaveBeenCalled();
            } finally {
                await closeServer(server);
            }
        });

        it("advertises compression via X-Artifact-Compression header", async () => {
            expect.assertions(2);

            const entryDirectory = join(cacheDirectory, "br-hash");

            await mkdir(entryDirectory, { recursive: true });
            await writeFile(join(entryDirectory, ".commit"), "br-hash");
            await writeFile(join(entryDirectory, "code"), "0");

            let receivedEncoding = "";

            const { server, url } = await startMockServer((request, response) => {
                receivedEncoding = String(request.headers["x-artifact-compression"] ?? "");

                collectRequestBody(request)
                    .then(() => {
                        response.writeHead(200);
                        response.end();

                        return undefined;
                    })
                    .catch(() => {
                        response.writeHead(500);
                        response.end();
                    });
            });

            try {
                const cache = new HttpRemoteCache({ compression: "brotli", url });
                const result = await storeByTaskHash(cache, "br-hash", cacheDirectory);

                expect(result).toBe(true);
                expect(receivedEncoding).toBe("brotli");
            } finally {
                await closeServer(server);
            }
        });

        it("uploads and round-trips a tarball", async () => {
            expect.assertions(2);

            const entryDirectory = join(cacheDirectory, "roundtrip");

            await mkdir(entryDirectory, { recursive: true });
            await writeFile(join(entryDirectory, ".commit"), "roundtrip");
            await writeFile(join(entryDirectory, "payload.txt"), "Lorem ipsum ".repeat(200));

            let storedBytes: Buffer = Buffer.alloc(0);

            const { server, url } = await startMockServer((request, response) => {
                if (request.method === "PUT") {
                    collectRequestBody(request)
                        .then((body) => {
                            storedBytes = body;
                            response.writeHead(200);
                            response.end();

                            return undefined;
                        })
                        .catch(() => {
                            response.writeHead(500);
                            response.end();
                        });
                } else {
                    response.writeHead(200, {
                        "Content-Length": String(storedBytes.length),
                        "Content-Type": "application/octet-stream",
                    });
                    response.end(storedBytes);
                }
            });

            try {
                const uploader = new HttpRemoteCache({ url });
                const downloadDirectory = join(cacheDirectory, "dl");

                await mkdir(downloadDirectory, { recursive: true });

                const stored = await storeByTaskHash(uploader, "roundtrip", cacheDirectory);
                const downloader = new HttpRemoteCache({ localCasRoot: downloadDirectory, url });
                const retrieved = await retrieveByTaskHash(downloader, "roundtrip", downloadDirectory);

                expect(stored).toBe(true);
                expect(retrieved).toBe(true);
            } finally {
                await closeServer(server);
            }
        });
    });

    describe(retrieveByTaskHash, () => {
        it("returns false when reads are disabled", async () => {
            expect.assertions(1);

            const cache = new HttpRemoteCache({ localCasRoot: cacheDirectory, mode: "write", url: "http://localhost:9999" });
            const result = await retrieveByTaskHash(cache, "abc123", cacheDirectory);

            expect(result).toBe(false);
        });

        it("returns false when artifact not found", async () => {
            expect.assertions(1);

            const { server, url } = await startMockServer((_request, response) => {
                response.writeHead(404);
                response.end();
            });

            try {
                const cache = new HttpRemoteCache({ localCasRoot: cacheDirectory, url });
                const result = await retrieveByTaskHash(cache, "notfound", cacheDirectory);

                expect(result).toBe(false);
            } finally {
                await closeServer(server);
            }
        });

        it("returns false on network error", async () => {
            expect.assertions(1);

            const cache = new HttpRemoteCache({ localCasRoot: cacheDirectory, timeout: 100, url: "http://127.0.0.1:1" });
            const result = await retrieveByTaskHash(cache, "abc123", cacheDirectory);

            expect(result).toBe(false);
        });

        it("downloads and extracts a valid artifact", async () => {
            expect.assertions(4);

            // Stage a real cache entry directory and tar.gz it.
            const sourceDirectory = join(cacheDirectory, "source-entry");

            await mkdir(sourceDirectory, { recursive: true });
            await writeFile(join(sourceDirectory, ".commit"), "retrieve-hash");
            await writeFile(join(sourceDirectory, "code"), "0");
            await writeFile(join(sourceDirectory, "terminalOutput"), "Build succeeded");

            const archivePath = join(cacheDirectory, "artifact.tar.gz");

            await new Promise<void>((resolve, reject) => {
                execFile("tar", ["-czf", archivePath, "-C", sourceDirectory, "."], (error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });

            const archiveContent = await readFile(archivePath);

            const { server, url } = await startMockServer((request, response) => {
                if (request.method === "GET") {
                    response.writeHead(200, {
                        "Content-Length": String(archiveContent.length),
                        "Content-Type": "application/octet-stream",
                    });
                    response.end(archiveContent);
                } else {
                    response.writeHead(404);
                    response.end();
                }
            });

            try {
                const downloadDirectory = join(cacheDirectory, "download-cache");

                await mkdir(downloadDirectory, { recursive: true });

                const cache = new HttpRemoteCache({ localCasRoot: downloadDirectory, url });
                const result = await retrieveByTaskHash(cache, "retrieve-hash", downloadDirectory);

                expect(result).toBe(true);

                const entryDirectory = join(downloadDirectory, "retrieve-hash");
                const commitFile = await readFile(join(entryDirectory, ".commit"), "utf8");

                expect(commitFile).toBe("retrieve-hash");

                const codeFile = await readFile(join(entryDirectory, "code"), "utf8");

                expect(codeFile).toBe("0");

                const outputFile = await readFile(join(entryDirectory, "terminalOutput"), "utf8");

                expect(outputFile).toBe("Build succeeded");
            } finally {
                await closeServer(server);
            }
        });
    });

    describe("uRL construction", () => {
        it("strips trailing slash from URL", async () => {
            expect.assertions(1);

            let requestUrl = "";
            const { server, url } = await startMockServer((request, response) => {
                requestUrl = request.url ?? "";
                response.writeHead(200);
                response.end();
            });

            try {
                const cache = new HttpRemoteCache({ url: `${url}/` });

                await containsByTaskHash(cache, "test-hash");

                expect(requestUrl).toBe(artifactPath("test-hash"));
            } finally {
                await closeServer(server);
            }
        });

        it("encodes teamId in URL", async () => {
            expect.assertions(1);

            let requestUrl = "";
            const { server, url } = await startMockServer((request, response) => {
                requestUrl = request.url ?? "";
                response.writeHead(200);
                response.end();
            });

            try {
                const cache = new HttpRemoteCache({ teamId: "team with spaces", url });

                await containsByTaskHash(cache, "test-hash");

                expect(requestUrl).toContain("teamId=team%20with%20spaces");
            } finally {
                await closeServer(server);
            }
        });
    });

    describe("hMAC signing", () => {
        it("rejects a construction with a too-short secret", () => {
            expect.assertions(1);
            expect(() => new HttpRemoteCache({ signing: { secret: "short" }, url: "http://localhost:9999" })).toThrow(/at least 16 characters/);
        });

        it("upload includes the X-Artifact-Signature header", async () => {
            expect.assertions(2);

            const entryDirectory = join(cacheDirectory, "sig-hash");

            await mkdir(entryDirectory, { recursive: true });
            await writeFile(join(entryDirectory, ".commit"), "sig-hash");

            let received = "";

            const { server, url } = await startMockServer((request, response) => {
                received = String(request.headers["x-artifact-signature"] ?? "");

                collectRequestBody(request)
                    .then(() => {
                        response.writeHead(200);
                        response.end();

                        return undefined;
                    })
                    .catch(() => {
                        response.writeHead(500);
                        response.end();
                    });
            });

            try {
                const cache = new HttpRemoteCache({ signing: { secret: "this-is-a-16+-char-secret" }, url });

                await storeByTaskHash(cache, "sig-hash", cacheDirectory);

                expect(received).toHaveLength(64); // HMAC-SHA256 hex digest length
                expect(/^[\da-f]+$/.test(received)).toBe(true);
            } finally {
                await closeServer(server);
            }
        });

        it("rejects a download whose body doesn't match the signature", async () => {
            expect.assertions(1);

            const sourceDirectory = join(cacheDirectory, "source");

            await mkdir(sourceDirectory, { recursive: true });
            await writeFile(join(sourceDirectory, ".commit"), "tampered");

            const archivePath = join(cacheDirectory, "tampered.tar.gz");

            await new Promise<void>((resolve, reject) => {
                execFile("tar", ["-czf", archivePath, "-C", sourceDirectory, "."], (error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });

            const archive = await readFile(archivePath);

            const { server, url } = await startMockServer((request, response) => {
                if (request.method === "GET") {
                    response.writeHead(200, {
                        "Content-Length": String(archive.length),
                        "Content-Type": "application/octet-stream",
                        "X-Artifact-Signature": "0".repeat(64), // deliberate mismatch
                    });
                    response.end(archive);
                } else {
                    response.writeHead(404);
                    response.end();
                }
            });

            try {
                const downloadDirectory = join(cacheDirectory, "download");

                await mkdir(downloadDirectory, { recursive: true });

                const cache = new HttpRemoteCache({
                    localCasRoot: downloadDirectory,
                    signing: { secret: "this-is-a-16+-char-secret", verifyOnDownload: true },
                    url,
                });

                const retrieved = await retrieveByTaskHash(cache, "tampered", downloadDirectory);

                expect(retrieved).toBe(false);
            } finally {
                await closeServer(server);
            }
        });

        it("round-trips a signed artifact (upload+download with matching secret)", async () => {
            expect.assertions(2);

            const secret = "this-is-a-16+-char-secret";
            const entryDirectory = join(cacheDirectory, "round");

            await mkdir(entryDirectory, { recursive: true });
            await writeFile(join(entryDirectory, ".commit"), "round");
            await writeFile(join(entryDirectory, "payload.txt"), "data");

            let storedBytes: Buffer = Buffer.alloc(0);
            let storedSignature = "";

            const { server, url } = await startMockServer((request, response) => {
                if (request.method === "PUT") {
                    storedSignature = String(request.headers["x-artifact-signature"] ?? "");

                    collectRequestBody(request)
                        .then((body) => {
                            storedBytes = body;
                            response.writeHead(200);
                            response.end();

                            return undefined;
                        })
                        .catch(() => {
                            response.writeHead(500);
                            response.end();
                        });
                } else {
                    response.writeHead(200, {
                        "Content-Length": String(storedBytes.length),
                        "Content-Type": "application/octet-stream",
                        "X-Artifact-Signature": storedSignature,
                    });
                    response.end(storedBytes);
                }
            });

            try {
                const uploader = new HttpRemoteCache({ signing: { secret }, url });
                const stored = await storeByTaskHash(uploader, "round", cacheDirectory);

                const downloadDirectory = join(cacheDirectory, "dl");

                await mkdir(downloadDirectory, { recursive: true });

                const downloader = new HttpRemoteCache({ localCasRoot: downloadDirectory, signing: { secret, verifyOnDownload: true }, url });
                const retrieved = await retrieveByTaskHash(downloader, "round", downloadDirectory);

                expect(stored).toBe(true);
                expect(retrieved).toBe(true);
            } finally {
                await closeServer(server);
            }
        });

        it("accepts an unsigned download when verifyOnDownload is false (lax mode)", async () => {
            expect.assertions(1);

            const secret = "this-is-a-16+-char-secret";

            const sourceDirectory = join(cacheDirectory, "lax-source");

            await mkdir(sourceDirectory, { recursive: true });
            await writeFile(join(sourceDirectory, ".commit"), "lax");

            const archivePath = join(cacheDirectory, "lax.tar.gz");

            await new Promise<void>((resolve, reject) => {
                execFile("tar", ["-czf", archivePath, "-C", sourceDirectory, "."], (error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });

            const archive = await readFile(archivePath);

            const { server, url } = await startMockServer((request, response) => {
                if (request.method === "GET") {
                    response.writeHead(200, {
                        "Content-Length": String(archive.length),
                        "Content-Type": "application/octet-stream",
                    });
                    response.end(archive);
                } else {
                    response.writeHead(404);
                    response.end();
                }
            });

            try {
                const downloadDirectory = join(cacheDirectory, "lax-dl");

                await mkdir(downloadDirectory, { recursive: true });

                const cache = new HttpRemoteCache({ localCasRoot: downloadDirectory, signing: { secret }, url });
                const retrieved = await retrieveByTaskHash(cache, "lax", downloadDirectory);

                expect(retrieved).toBe(true);
            } finally {
                await closeServer(server);
            }
        });

        it("rejects an unsigned download when verifyOnDownload is true (strict mode)", async () => {
            expect.assertions(1);

            const secret = "this-is-a-16+-char-secret";
            const sourceDirectory = join(cacheDirectory, "strict-source");

            await mkdir(sourceDirectory, { recursive: true });
            await writeFile(join(sourceDirectory, ".commit"), "strict");

            const archivePath = join(cacheDirectory, "strict.tar.gz");

            await new Promise<void>((resolve, reject) => {
                execFile("tar", ["-czf", archivePath, "-C", sourceDirectory, "."], (error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });

            const archive = await readFile(archivePath);

            const { server, url } = await startMockServer((request, response) => {
                if (request.method === "GET") {
                    response.writeHead(200, {
                        "Content-Length": String(archive.length),
                        "Content-Type": "application/octet-stream",
                    });
                    response.end(archive);
                } else {
                    response.writeHead(404);
                    response.end();
                }
            });

            try {
                const downloadDirectory = join(cacheDirectory, "strict-dl");

                await mkdir(downloadDirectory, { recursive: true });

                const cache = new HttpRemoteCache({
                    localCasRoot: downloadDirectory,
                    signing: { secret, verifyOnDownload: true },
                    url,
                });
                const retrieved = await retrieveByTaskHash(cache, "strict", downloadDirectory);

                expect(retrieved).toBe(false);
            } finally {
                await closeServer(server);
            }
        });
    });

    describe(actionDigestForTaskHash, () => {
        it("derives a stable sha256 digest from the task hash", () => {
            expect.assertions(3);

            const a = actionDigestForTaskHash("abc");
            const b = actionDigestForTaskHash("abc");
            const c = actionDigestForTaskHash("xyz");

            expect(a).toStrictEqual(b);
            expect(a.hash).toHaveLength(64);
            expect(a.hash).not.toBe(c.hash);
        });
    });
});
