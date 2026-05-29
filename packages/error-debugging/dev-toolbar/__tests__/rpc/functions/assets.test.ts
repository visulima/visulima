// @vitest-environment node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { ViteDevServer } from "vite";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from "vitest";

import type { StaticAsset } from "../../../src/rpc/functions/assets";
import { getStaticAssets } from "../../../src/rpc/functions/assets";

const makeServer = (publicDir: string | false): ViteDevServer => ({ config: { publicDir } }) as unknown as ViteDevServer;

const byPath = (assets: StaticAsset[], publicPath: string): StaticAsset | undefined => assets.find((a) => a.publicPath === publicPath);

describe("rpc/functions/assets", () => {
    let tmpDir: string;
    let publicDir: string;

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vdt-assets-test-"));
        publicDir = path.join(tmpDir, "public");
        await fs.mkdir(publicDir, { recursive: true });
    });

    afterEach(async () => {
        await fs.rm(tmpDir, { force: true, recursive: true });
    });

    describe(getStaticAssets, () => {
        it("returns empty array when publicDir is falsy", async () => {
            expect.assertions(1);

            const result = await getStaticAssets(makeServer(false));

            expect(result).toEqual([]);
        });

        it("returns empty array when publicDir does not exist", async () => {
            expect.assertions(1);

            const result = await getStaticAssets(makeServer(path.join(tmpDir, "does-not-exist")));

            expect(result).toEqual([]);
        });

        it("returns empty array for an empty public dir", async () => {
            expect.assertions(1);

            const result = await getStaticAssets(makeServer(publicDir));

            expect(result).toEqual([]);
        });

        it("classifies extensions across every asset category", async () => {
            expect.assertions(7);

            await fs.writeFile(path.join(publicDir, "logo.PNG"), "x");
            await fs.writeFile(path.join(publicDir, "clip.mp4"), "x");
            await fs.writeFile(path.join(publicDir, "sound.mp3"), "x");
            await fs.writeFile(path.join(publicDir, "body.woff2"), "x");
            await fs.writeFile(path.join(publicDir, "style.css"), "x");
            await fs.writeFile(path.join(publicDir, "data.bin"), "x");
            await fs.writeFile(path.join(publicDir, "noext"), "x");

            const result = await getStaticAssets(makeServer(publicDir));

            // Uppercase extension is normalised to lowercase before classification.
            expect(byPath(result, "/logo.PNG")?.type).toBe("image");
            expect(byPath(result, "/clip.mp4")?.type).toBe("video");
            expect(byPath(result, "/sound.mp3")?.type).toBe("audio");
            expect(byPath(result, "/body.woff2")?.type).toBe("font");
            expect(byPath(result, "/style.css")?.type).toBe("text");
            expect(byPath(result, "/data.bin")?.type).toBe("other");
            // File without an extension also falls through to "other".
            expect(byPath(result, "/noext")?.type).toBe("other");
        });

        it("recurses into subdirectories and produces forward-slash public paths", async () => {
            expect.assertions(3);

            await fs.mkdir(path.join(publicDir, "images", "icons"), { recursive: true });
            await fs.writeFile(path.join(publicDir, "images", "icons", "star.svg"), "x");

            const result = await getStaticAssets(makeServer(publicDir));

            expect(result).toHaveLength(1);
            expect(result[0]?.publicPath).toBe("/images/icons/star.svg");
            expect(result[0]?.type).toBe("image");
        });

        it("sorts results alphabetically by public path and exposes size and mtime", async () => {
            expect.assertions(3);

            await fs.writeFile(path.join(publicDir, "zeta.txt"), "hello");
            await fs.writeFile(path.join(publicDir, "alpha.txt"), "x");

            const result = await getStaticAssets(makeServer(publicDir));

            expect(result.map((a) => a.publicPath)).toEqual(["/alpha.txt", "/zeta.txt"]);
            expect(byPath(result, "/zeta.txt")?.size).toBe(5);
            expect(byPath(result, "/alpha.txt")?.size).toBe(1);

            expectTypeOf(byPath(result, "/alpha.txt")?.mtime).toBeNumber();
        });

        it("includes a symlink whose target stays inside publicDir", async () => {
            expect.assertions(2);

            const target = path.join(publicDir, "real.png");

            await fs.writeFile(target, "x");
            await fs.symlink(target, path.join(publicDir, "link.png"));

            const result = await getStaticAssets(makeServer(publicDir));

            expect(byPath(result, "/link.png")).toBeDefined();
            expect(byPath(result, "/link.png")?.type).toBe("image");
        });

        it("skips a symlink that escapes publicDir", async () => {
            expect.assertions(2);

            // Target lives outside publicDir (in tmpDir directly).
            const outsideTarget = path.join(tmpDir, "secret.txt");

            await fs.writeFile(outsideTarget, "secret");
            await fs.symlink(outsideTarget, path.join(publicDir, "escape.txt"));

            const result = await getStaticAssets(makeServer(publicDir));

            expect(byPath(result, "/escape.txt")).toBeUndefined();
            expect(result).toEqual([]);
        });

        it("processes more files than the concurrency limit (exercises the semaphore queue)", async () => {
            expect.assertions(2);

            // The internal semaphore caps concurrency at 20, so >20 files forces the
            // queue/drain path. We use 30 files to be safely above the limit.
            const count = 30;

            await Promise.all(Array.from({ length: count }, (_, index) => fs.writeFile(path.join(publicDir, `file-${String(index)}.txt`), "x")));

            const result = await getStaticAssets(makeServer(publicDir));

            expect(result).toHaveLength(count);
            expect(result.every((asset) => asset.type === "text")).toBe(true);
        });

        it("skips a broken symlink with no resolvable target", async () => {
            expect.assertions(1);

            await fs.symlink(path.join(publicDir, "missing-target.png"), path.join(publicDir, "broken.png"));

            const result = await getStaticAssets(makeServer(publicDir));

            expect(byPath(result, "/broken.png")).toBeUndefined();
        });
    });
});
