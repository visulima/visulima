import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import getFileSource, { clearFileSourceCache } from "../get-file-source";

describe("getFileSource", () => {
    let directory: string;

    beforeEach(async () => {
        clearFileSourceCache();
        directory = await mkdtemp(join(tmpdir(), "get-file-source-"));
    });

    afterEach(async () => {
        clearFileSourceCache();
        vi.restoreAllMocks();
        await rm(directory, { force: true, recursive: true });
    });

    it("reads a plain absolute filesystem path", async () => {
        const file = join(directory, "absolute.js");

        await writeFile(file, "const x = 1;\n", "utf8");

        await expect(getFileSource(file)).resolves.toBe("const x = 1;\n");
    });

    it("reads a file: URL", async () => {
        const file = join(directory, "url.ts");

        await writeFile(file, "export const y = 2;\n", "utf8");

        await expect(getFileSource(pathToFileURL(file).href)).resolves.toBe("export const y = 2;\n");
    });

    it("returns undefined for a missing file", async () => {
        await expect(getFileSource(join(directory, "does-not-exist.js"))).resolves.toBeUndefined();
    });

    it("returns undefined for relative paths", async () => {
        await expect(getFileSource("./relative.js")).resolves.toBeUndefined();
        await expect(getFileSource("node:internal/foo")).resolves.toBeUndefined();
    });

    it("does NOT fetch http(s) URLs by default (SSRF guard)", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");

        await expect(getFileSource("http://169.254.169.254/latest/meta-data")).resolves.toBeUndefined();
        await expect(getFileSource("https://example.com/source.js")).resolves.toBeUndefined();
        await expect(getFileSource("data:text/plain,hello")).resolves.toBeUndefined();

        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("fetches http(s) URLs only when allowRemote is enabled", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response("remote-source", { status: 200 }),
        );

        await expect(getFileSource("https://example.com/source.js", { allowRemote: true })).resolves.toBe("remote-source");
        expect(fetchSpy).toHaveBeenCalledWith("https://example.com/source.js");
    });

    it("returns undefined when a remote fetch is not ok", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 404 }));

        await expect(getFileSource("https://example.com/missing.js", { allowRemote: true })).resolves.toBeUndefined();
    });

    it("caches disk reads (second call does not hit the filesystem)", async () => {
        const file = join(directory, "cached.js");

        await writeFile(file, "first", "utf8");

        await expect(getFileSource(file)).resolves.toBe("first");

        // Change the file on disk; a cached read should still return the old value.
        await writeFile(file, "second", "utf8");

        await expect(getFileSource(file)).resolves.toBe("first");

        clearFileSourceCache();

        await expect(getFileSource(file)).resolves.toBe("second");
    });

    it("evicts the least-recently-used entry past the cache cap", async () => {
        // Cap is 50. Write 51 files; the first one read must have been evicted.
        const files: string[] = [];

        for (let index = 0; index < 51; index += 1) {
            const file = join(directory, `file-${index}.js`);

            // eslint-disable-next-line no-await-in-loop
            await writeFile(file, `v${index}`, "utf8");
            files.push(file);
        }

        for (const file of files) {
            // eslint-disable-next-line no-await-in-loop
            await getFileSource(file);
        }

        // Overwrite the first file; if it was evicted, re-reading sees the new value.
        await writeFile(files[0] as string, "rewritten", "utf8");

        await expect(getFileSource(files[0] as string)).resolves.toBe("rewritten");
    });
});
