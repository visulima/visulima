import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveOutputs } from "../src/output-resolver";

const createTemporaryDirectory = async (): Promise<string> => {
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(tmpdir(), `output-resolver-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

describe(resolveOutputs, () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTemporaryDirectory();
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    it("returns an empty list when no outputs are declared", async () => {
        expect.assertions(1);

        await expect(resolveOutputs(workspaceRoot, [])).resolves.toStrictEqual([]);
    });

    it("expands directory globs to the concrete file list", async () => {
        expect.assertions(1);

        await mkdir(join(workspaceRoot, "dist/nested"), { recursive: true });
        await writeFile(join(workspaceRoot, "dist/a.js"), "a");
        await writeFile(join(workspaceRoot, "dist/nested/b.js"), "b");

        const resolved = await resolveOutputs(workspaceRoot, ["dist/**"]);

        // Sorted order means b-nested comes after a-root — check both.
        expect(resolved).toStrictEqual(["dist/a.js", "dist/nested/b.js"]);
    });

    it("excludes files matching a negative pattern", async () => {
        expect.assertions(1);

        await mkdir(join(workspaceRoot, "dist/cache"), { recursive: true });
        await writeFile(join(workspaceRoot, "dist/bundle.js"), "b");
        await writeFile(join(workspaceRoot, "dist/cache/tmp.bin"), "tmp");

        const resolved = await resolveOutputs(workspaceRoot, ["dist/**", "!dist/cache/**"]);

        expect(resolved).toStrictEqual(["dist/bundle.js"]);
    });

    it("materialises { auto: true } from autoWrites into workspace-relative paths", async () => {
        expect.assertions(1);

        await mkdir(join(workspaceRoot, "build"), { recursive: true });
        await writeFile(join(workspaceRoot, "build/out.js"), "x");

        const resolved = await resolveOutputs(workspaceRoot, [{ auto: true }], [join(workspaceRoot, "build/out.js")]);

        expect(resolved).toStrictEqual(["build/out.js"]);
    });

    it("drops auto write paths that fall outside the workspace root", async () => {
        expect.assertions(1);

        const outsidePath = "/tmp/somewhere-else/leak.txt";
        const insidePath = join(workspaceRoot, "build/ok.js");

        await mkdir(join(workspaceRoot, "build"), { recursive: true });
        await writeFile(insidePath, "x");

        const resolved = await resolveOutputs(workspaceRoot, [{ auto: true }], [outsidePath, insidePath]);

        // Paths outside `workspaceRoot` can't be portably restored on
        // another machine, so they must not leak into the archive.
        expect(resolved).toStrictEqual(["build/ok.js"]);
    });

    it("combines positive globs with auto writes and applies negatives to both", async () => {
        expect.assertions(1);

        await mkdir(join(workspaceRoot, "dist"), { recursive: true });
        await mkdir(join(workspaceRoot, "build"), { recursive: true });
        await writeFile(join(workspaceRoot, "dist/a.js"), "a");
        await writeFile(join(workspaceRoot, "dist/skip.log"), "log");
        await writeFile(join(workspaceRoot, "build/traced.js"), "t");

        const resolved = await resolveOutputs(workspaceRoot, ["dist/**", { auto: true }, "!**/*.log"], [join(workspaceRoot, "build/traced.js")]);

        expect(resolved).toStrictEqual(["build/traced.js", "dist/a.js"]);
    });

    it("treats { auto: true } without autoWrites as contributing nothing", async () => {
        expect.assertions(1);

        const resolved = await resolveOutputs(workspaceRoot, [{ auto: true }]);

        expect(resolved).toStrictEqual([]);
    });

    it("is stable across invocations for the same input tree (sorted output)", async () => {
        expect.assertions(1);

        await mkdir(join(workspaceRoot, "dist"), { recursive: true });
        await writeFile(join(workspaceRoot, "dist/z.js"), "z");
        await writeFile(join(workspaceRoot, "dist/a.js"), "a");
        await writeFile(join(workspaceRoot, "dist/m.js"), "m");

        const first = await resolveOutputs(workspaceRoot, ["dist/**"]);
        const second = await resolveOutputs(workspaceRoot, ["dist/**"]);

        // Same filesystem state → byte-identical result list → tarballs
        // are reproducible run-to-run.
        expect(first).toStrictEqual(second);
    });

    it("ignores empty-string entries and leading-`!` entries with no pattern", async () => {
        expect.assertions(1);

        await writeFile(join(workspaceRoot, "a.js"), "a");

        const resolved = await resolveOutputs(workspaceRoot, ["", "!", "a.js"]);

        expect(resolved).toStrictEqual(["a.js"]);
    });
});
