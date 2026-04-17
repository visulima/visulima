import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RemoteCache } from "../src/remote-cache";

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

describe(RemoteCache, () => {
    let cacheDirectory: string;

    beforeEach(async () => {
        cacheDirectory = await createTemporaryDirectory();
    });

    afterEach(async () => {
        await rm(cacheDirectory, { force: true, recursive: true });
    });

    describe("exists", () => {
        it("should return true when artifact exists", async () => {
            expect.assertions(1);

            const { server, url } = await startMockServer((request, response) => {
                if (request.method === "HEAD" && request.url?.includes("/v8/artifacts/abc123")) {
                    response.writeHead(200);
                    response.end();
                } else {
                    response.writeHead(404);
                    response.end();
                }
            });

            try {
                const cache = new RemoteCache({ url });
                const result = await cache.exists("abc123");

                expect(result).toBe(true);
            } finally {
                await closeServer(server);
            }
        });

        it("should return false when artifact does not exist", async () => {
            expect.assertions(1);

            const { server, url } = await startMockServer((_request, response) => {
                response.writeHead(404);
                response.end();
            });

            try {
                const cache = new RemoteCache({ url });
                const result = await cache.exists("nonexistent");

                expect(result).toBe(false);
            } finally {
                await closeServer(server);
            }
        });

        it("should return false when reads are disabled", async () => {
            expect.assertions(1);

            const cache = new RemoteCache({ read: false, url: "http://localhost:9999" });
            const result = await cache.exists("abc123");

            expect(result).toBe(false);
        });

        it("should return false on network error", async () => {
            expect.assertions(1);

            const cache = new RemoteCache({ timeout: 100, url: "http://127.0.0.1:1" });
            const result = await cache.exists("abc123");

            expect(result).toBe(false);
        });

        it("should include teamId in query params", async () => {
            expect.assertions(1);

            let requestUrl = "";
            const { server, url } = await startMockServer((request, response) => {
                requestUrl = request.url ?? "";
                response.writeHead(200);
                response.end();
            });

            try {
                const cache = new RemoteCache({ teamId: "my-team", url });

                await cache.exists("abc123");

                expect(requestUrl).toContain("teamId=my-team");
            } finally {
                await closeServer(server);
            }
        });

        it("should send authorization header", async () => {
            expect.assertions(1);

            let authHeader = "";
            const { server, url } = await startMockServer((request, response) => {
                authHeader = request.headers.authorization ?? "";
                response.writeHead(200);
                response.end();
            });

            try {
                const cache = new RemoteCache({ token: "my-token", url });

                await cache.exists("abc123");

                expect(authHeader).toBe("Bearer my-token");
            } finally {
                await closeServer(server);
            }
        });
    });

    describe("store", () => {
        it("should return false when writes are disabled", async () => {
            expect.assertions(1);

            const cache = new RemoteCache({ url: "http://localhost:9999", write: false });
            const result = await cache.store("abc123", cacheDirectory);

            expect(result).toBe(false);
        });

        it("should return false when cache entry is incomplete (no .commit)", async () => {
            expect.assertions(1);

            const entryDirectory = join(cacheDirectory, "abc123");

            await mkdir(entryDirectory, { recursive: true });
            await writeFile(join(entryDirectory, "code"), "0");

            const cache = new RemoteCache({ url: "http://localhost:9999" });
            const result = await cache.store("abc123", cacheDirectory);

            expect(result).toBe(false);
        });

        it("should upload a valid cache entry", async () => {
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
                const cache = new RemoteCache({ url });
                const result = await cache.store("abc123", cacheDirectory);

                expect(result).toBe(true);
                expect(receivedMethod).toBe("PUT");
                expect(receivedBody.length).toBeGreaterThan(0);
            } finally {
                await closeServer(server);
            }
        });

        it("should return false when server returns error", async () => {
            expect.assertions(1);

            const entryDirectory = join(cacheDirectory, "abc123");

            await mkdir(entryDirectory, { recursive: true });
            await writeFile(join(entryDirectory, ".commit"), "abc123");

            const { server, url } = await startMockServer((_request, response) => {
                response.writeHead(500);
                response.end();
            });

            try {
                const cache = new RemoteCache({ url });
                const result = await cache.store("abc123", cacheDirectory);

                expect(result).toBe(false);
            } finally {
                await closeServer(server);
            }
        });

        it("should call onUploadError callback on failure", async () => {
            expect.assertions(1);

            const onUploadError = vi.fn<(hash: string, error: unknown) => void>();
            const cache = new RemoteCache({
                onUploadError,
                timeout: 100,
                url: "http://127.0.0.1:1",
            });

            // No .commit file, so store will fail
            const entryDirectory = join(cacheDirectory, "fail-hash");

            await mkdir(entryDirectory, { recursive: true });

            await cache.store("fail-hash", cacheDirectory);

            expect(onUploadError).toHaveBeenCalledExactlyOnceWith("fail-hash", expect.any(Error));
        });

        it("should not call onUploadError on success", async () => {
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
                const cache = new RemoteCache({ onUploadError, url });
                const result = await cache.store("ok-hash", cacheDirectory);

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
                const cache = new RemoteCache({ compression: "brotli", url });
                const result = await cache.store("br-hash", cacheDirectory);

                expect(result).toBe(true);
                expect(receivedEncoding).toBe("brotli");
            } finally {
                await closeServer(server);
            }
        });

        it("uploads and round-trips a brotli-compressed artifact", async () => {
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
                const uploader = new RemoteCache({ compression: "brotli", url });
                const downloadDirectory = join(cacheDirectory, "dl");

                await mkdir(downloadDirectory, { recursive: true });

                const stored = await uploader.store("roundtrip", cacheDirectory);
                const downloader = new RemoteCache({ compression: "brotli", url });
                const retrieved = await downloader.retrieve("roundtrip", downloadDirectory);

                expect(stored).toBe(true);
                expect(retrieved).toBe(true);
            } finally {
                await closeServer(server);
            }
        });
    });

    describe("retrieve", () => {
        it("should return false when reads are disabled", async () => {
            expect.assertions(1);

            const cache = new RemoteCache({ read: false, url: "http://localhost:9999" });
            const result = await cache.retrieve("abc123", cacheDirectory);

            expect(result).toBe(false);
        });

        it("should return false when artifact not found", async () => {
            expect.assertions(1);

            const { server, url } = await startMockServer((_request, response) => {
                response.writeHead(404);
                response.end();
            });

            try {
                const cache = new RemoteCache({ url });
                const result = await cache.retrieve("notfound", cacheDirectory);

                expect(result).toBe(false);
            } finally {
                await closeServer(server);
            }
        });

        it("should return false on network error", async () => {
            expect.assertions(1);

            const cache = new RemoteCache({ timeout: 100, url: "http://127.0.0.1:1" });
            const result = await cache.retrieve("abc123", cacheDirectory);

            expect(result).toBe(false);
        });

        it("should download and extract a valid artifact", async () => {
            expect.assertions(4);

            // Create a source directory with cache entry content
            const sourceDirectory = join(cacheDirectory, "source-entry");

            await mkdir(sourceDirectory, { recursive: true });
            await writeFile(join(sourceDirectory, ".commit"), "retrieve-hash");
            await writeFile(join(sourceDirectory, "code"), "0");
            await writeFile(join(sourceDirectory, "terminalOutput"), "Build succeeded");

            // Create a tar.gz of the source directory
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

            // Serve the archive
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
                // Use a separate download dir so we don't conflict with source
                const downloadDirectory = join(cacheDirectory, "download-cache");

                await mkdir(downloadDirectory, { recursive: true });

                const cache = new RemoteCache({ url });
                const result = await cache.retrieve("retrieve-hash", downloadDirectory);

                expect(result).toBe(true);

                // Verify the extracted content
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
        it("should strip trailing slash from URL", async () => {
            expect.assertions(1);

            let requestUrl = "";
            const { server, url } = await startMockServer((request, response) => {
                requestUrl = request.url ?? "";
                response.writeHead(200);
                response.end();
            });

            try {
                const cache = new RemoteCache({ url: `${url}/` });

                await cache.exists("test-hash");

                expect(requestUrl).toBe("/v8/artifacts/test-hash");
            } finally {
                await closeServer(server);
            }
        });

        it("should encode teamId in URL", async () => {
            expect.assertions(1);

            let requestUrl = "";
            const { server, url } = await startMockServer((request, response) => {
                requestUrl = request.url ?? "";
                response.writeHead(200);
                response.end();
            });

            try {
                const cache = new RemoteCache({ teamId: "team with spaces", url });

                await cache.exists("test-hash");

                expect(requestUrl).toContain("teamId=team%20with%20spaces");
            } finally {
                await closeServer(server);
            }
        });
    });

    describe("HMAC signing", () => {
        it("rejects a construction with a too-short secret", () => {
            expect.assertions(1);
            expect(() => new RemoteCache({ signing: { secret: "short" }, url: "http://localhost:9999" })).toThrow(/at least 16 characters/);
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
                const cache = new RemoteCache({ signing: { secret: "this-is-a-16+-char-secret" }, url });

                await cache.store("sig-hash", cacheDirectory);

                expect(received).toHaveLength(64); // HMAC-SHA256 hex digest length
                expect(/^[\da-f]+$/.test(received)).toBe(true);
            } finally {
                await closeServer(server);
            }
        });

        it("rejects a download whose body doesn't match the signature", async () => {
            expect.assertions(1);

            // Store a real artifact so we can hand its bytes back from a
            // server that lies about the signature.
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
                const cache = new RemoteCache({
                    signing: { secret: "this-is-a-16+-char-secret", verifyOnDownload: true },
                    url,
                });

                const downloadDirectory = join(cacheDirectory, "download");

                await mkdir(downloadDirectory, { recursive: true });

                const retrieved = await cache.retrieve("tampered", downloadDirectory);

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
                const uploader = new RemoteCache({ signing: { secret }, url });
                const stored = await uploader.store("round", cacheDirectory);

                const downloader = new RemoteCache({ signing: { secret, verifyOnDownload: true }, url });
                const downloadDirectory = join(cacheDirectory, "dl");

                await mkdir(downloadDirectory, { recursive: true });

                const retrieved = await downloader.retrieve("round", downloadDirectory);

                expect(stored).toBe(true);
                expect(retrieved).toBe(true);
            } finally {
                await closeServer(server);
            }
        });

        it("accepts an unsigned download when verifyOnDownload is false (lax mode)", async () => {
            expect.assertions(1);

            const secret = "this-is-a-16+-char-secret";

            // Stage a real archive so the server can hand back the bytes.
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
                    // Intentionally omit X-Artifact-Signature — lax
                    // mode treats this as a legacy entry and accepts.
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
                const cache = new RemoteCache({ signing: { secret }, url });
                const downloadDirectory = join(cacheDirectory, "lax-dl");

                await mkdir(downloadDirectory, { recursive: true });

                const retrieved = await cache.retrieve("lax", downloadDirectory);

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
                    // No signature header — strict mode must refuse.
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
                const cache = new RemoteCache({ signing: { secret, verifyOnDownload: true }, url });
                const downloadDirectory = join(cacheDirectory, "strict-dl");

                await mkdir(downloadDirectory, { recursive: true });

                const retrieved = await cache.retrieve("strict", downloadDirectory);

                expect(retrieved).toBe(false);
            } finally {
                await closeServer(server);
            }
        });
    });
});
