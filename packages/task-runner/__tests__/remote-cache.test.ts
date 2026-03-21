import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { execFile } from "node:child_process";

import { RemoteCache } from "../src/remote-cache";

const createTmpDir = async (): Promise<string> => {
    const dir = join(tmpdir(), `remote-cache-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(dir, { recursive: true });

    return dir;
};

/**
 * Starts a minimal HTTP server that simulates the Turborepo remote cache protocol.
 */
const startMockServer = (
    handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<{ server: Server; url: string }> => {
    return new Promise((resolve) => {
        const server = createServer(handler);

        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            const port = typeof address === "object" && address ? address.port : 0;

            resolve({ server, url: `http://127.0.0.1:${port}` });
        });
    });
};

const closeServer = (server: Server): Promise<void> => {
    return new Promise((resolve) => {
        server.close(() => resolve());
    });
};

describe("RemoteCache", () => {
    let cacheDir: string;

    beforeEach(async () => {
        cacheDir = await createTmpDir();
    });

    afterEach(async () => {
        await rm(cacheDir, { recursive: true, force: true });
    });

    describe("exists", () => {
        it("should return true when artifact exists", async () => {
            const { server, url } = await startMockServer((req, res) => {
                if (req.method === "HEAD" && req.url?.includes("/v8/artifacts/abc123")) {
                    res.writeHead(200);
                    res.end();
                } else {
                    res.writeHead(404);
                    res.end();
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
            const { server, url } = await startMockServer((_req, res) => {
                res.writeHead(404);
                res.end();
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
            const cache = new RemoteCache({ url: "http://localhost:9999", read: false });
            const result = await cache.exists("abc123");

            expect(result).toBe(false);
        });

        it("should return false on network error", async () => {
            const cache = new RemoteCache({ url: "http://127.0.0.1:1", timeout: 100 });
            const result = await cache.exists("abc123");

            expect(result).toBe(false);
        });

        it("should include teamId in query params", async () => {
            let requestUrl = "";
            const { server, url } = await startMockServer((req, res) => {
                requestUrl = req.url ?? "";
                res.writeHead(200);
                res.end();
            });

            try {
                const cache = new RemoteCache({ url, teamId: "my-team" });

                await cache.exists("abc123");

                expect(requestUrl).toContain("teamId=my-team");
            } finally {
                await closeServer(server);
            }
        });

        it("should send authorization header", async () => {
            let authHeader = "";
            const { server, url } = await startMockServer((req, res) => {
                authHeader = req.headers.authorization ?? "";
                res.writeHead(200);
                res.end();
            });

            try {
                const cache = new RemoteCache({ url, token: "my-token" });

                await cache.exists("abc123");

                expect(authHeader).toBe("Bearer my-token");
            } finally {
                await closeServer(server);
            }
        });
    });

    describe("store", () => {
        it("should return false when writes are disabled", async () => {
            const cache = new RemoteCache({ url: "http://localhost:9999", write: false });
            const result = await cache.store("abc123", cacheDir);

            expect(result).toBe(false);
        });

        it("should return false when cache entry is incomplete (no .commit)", async () => {
            const entryDir = join(cacheDir, "abc123");

            await mkdir(entryDir, { recursive: true });
            await writeFile(join(entryDir, "code"), "0");

            const cache = new RemoteCache({ url: "http://localhost:9999" });
            const result = await cache.store("abc123", cacheDir);

            expect(result).toBe(false);
        });

        it("should upload a valid cache entry", async () => {
            const entryDir = join(cacheDir, "abc123");

            await mkdir(entryDir, { recursive: true });
            await writeFile(join(entryDir, ".commit"), "abc123");
            await writeFile(join(entryDir, "code"), "0");
            await writeFile(join(entryDir, "terminalOutput"), "Build done");

            let receivedMethod = "";
            let receivedBody = Buffer.alloc(0);

            const { server, url } = await startMockServer((req, res) => {
                receivedMethod = req.method ?? "";

                const chunks: Buffer[] = [];

                req.on("data", (chunk: Buffer) => chunks.push(chunk));
                req.on("end", () => {
                    receivedBody = Buffer.concat(chunks);
                    res.writeHead(200);
                    res.end();
                });
            });

            try {
                const cache = new RemoteCache({ url });
                const result = await cache.store("abc123", cacheDir);

                expect(result).toBe(true);
                expect(receivedMethod).toBe("PUT");
                expect(receivedBody.length).toBeGreaterThan(0);
            } finally {
                await closeServer(server);
            }
        });

        it("should return false when server returns error", async () => {
            const entryDir = join(cacheDir, "abc123");

            await mkdir(entryDir, { recursive: true });
            await writeFile(join(entryDir, ".commit"), "abc123");

            const { server, url } = await startMockServer((_req, res) => {
                res.writeHead(500);
                res.end();
            });

            try {
                const cache = new RemoteCache({ url });
                const result = await cache.store("abc123", cacheDir);

                expect(result).toBe(false);
            } finally {
                await closeServer(server);
            }
        });

        it("should call onUploadError callback on failure", async () => {
            const onUploadError = vi.fn();
            const cache = new RemoteCache({
                url: "http://127.0.0.1:1",
                timeout: 100,
                onUploadError,
            });

            // No .commit file, so store will fail
            const entryDir = join(cacheDir, "fail-hash");

            await mkdir(entryDir, { recursive: true });

            await cache.store("fail-hash", cacheDir);

            expect(onUploadError).toHaveBeenCalledOnce();
            expect(onUploadError).toHaveBeenCalledWith("fail-hash", expect.any(Error));
        });

        it("should not call onUploadError on success", async () => {
            const entryDir = join(cacheDir, "ok-hash");

            await mkdir(entryDir, { recursive: true });
            await writeFile(join(entryDir, ".commit"), "ok-hash");

            const onUploadError = vi.fn();

            const { server, url } = await startMockServer((_req, res) => {
                const chunks: Buffer[] = [];

                _req.on("data", (chunk: Buffer) => chunks.push(chunk));
                _req.on("end", () => {
                    res.writeHead(200);
                    res.end();
                });
            });

            try {
                const cache = new RemoteCache({ url, onUploadError });
                const result = await cache.store("ok-hash", cacheDir);

                expect(result).toBe(true);
                expect(onUploadError).not.toHaveBeenCalled();
            } finally {
                await closeServer(server);
            }
        });
    });

    describe("retrieve", () => {
        it("should return false when reads are disabled", async () => {
            const cache = new RemoteCache({ url: "http://localhost:9999", read: false });
            const result = await cache.retrieve("abc123", cacheDir);

            expect(result).toBe(false);
        });

        it("should return false when artifact not found", async () => {
            const { server, url } = await startMockServer((_req, res) => {
                res.writeHead(404);
                res.end();
            });

            try {
                const cache = new RemoteCache({ url });
                const result = await cache.retrieve("notfound", cacheDir);

                expect(result).toBe(false);
            } finally {
                await closeServer(server);
            }
        });

        it("should return false on network error", async () => {
            const cache = new RemoteCache({ url: "http://127.0.0.1:1", timeout: 100 });
            const result = await cache.retrieve("abc123", cacheDir);

            expect(result).toBe(false);
        });

        it("should download and extract a valid artifact", async () => {
            // Create a source directory with cache entry content
            const sourceDir = join(cacheDir, "source-entry");

            await mkdir(sourceDir, { recursive: true });
            await writeFile(join(sourceDir, ".commit"), "retrieve-hash");
            await writeFile(join(sourceDir, "code"), "0");
            await writeFile(join(sourceDir, "terminalOutput"), "Build succeeded");

            // Create a tar.gz of the source directory
            const archivePath = join(cacheDir, "artifact.tar.gz");

            await new Promise<void>((resolve, reject) => {
                execFile("tar", ["-czf", archivePath, "-C", sourceDir, "."], (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });

            const archiveContent = await readFile(archivePath);

            // Serve the archive
            const { server, url } = await startMockServer((req, res) => {
                if (req.method === "GET") {
                    res.writeHead(200, {
                        "Content-Type": "application/octet-stream",
                        "Content-Length": String(archiveContent.length),
                    });
                    res.end(archiveContent);
                } else {
                    res.writeHead(404);
                    res.end();
                }
            });

            try {
                // Use a separate download dir so we don't conflict with source
                const downloadDir = join(cacheDir, "download-cache");

                await mkdir(downloadDir, { recursive: true });

                const cache = new RemoteCache({ url });
                const result = await cache.retrieve("retrieve-hash", downloadDir);

                expect(result).toBe(true);

                // Verify the extracted content
                const entryDir = join(downloadDir, "retrieve-hash");
                const commitFile = await readFile(join(entryDir, ".commit"), "utf-8");

                expect(commitFile).toBe("retrieve-hash");

                const codeFile = await readFile(join(entryDir, "code"), "utf-8");

                expect(codeFile).toBe("0");

                const outputFile = await readFile(join(entryDir, "terminalOutput"), "utf-8");

                expect(outputFile).toBe("Build succeeded");
            } finally {
                await closeServer(server);
            }
        });
    });

    describe("URL construction", () => {
        it("should strip trailing slash from URL", async () => {
            let requestUrl = "";
            const { server, url } = await startMockServer((req, res) => {
                requestUrl = req.url ?? "";
                res.writeHead(200);
                res.end();
            });

            try {
                const cache = new RemoteCache({ url: url + "/" });

                await cache.exists("test-hash");

                expect(requestUrl).toBe("/v8/artifacts/test-hash");
            } finally {
                await closeServer(server);
            }
        });

        it("should encode teamId in URL", async () => {
            let requestUrl = "";
            const { server, url } = await startMockServer((req, res) => {
                requestUrl = req.url ?? "";
                res.writeHead(200);
                res.end();
            });

            try {
                const cache = new RemoteCache({ url, teamId: "team with spaces" });

                await cache.exists("test-hash");

                expect(requestUrl).toContain("teamId=team%20with%20spaces");
            } finally {
                await closeServer(server);
            }
        });
    });
});
