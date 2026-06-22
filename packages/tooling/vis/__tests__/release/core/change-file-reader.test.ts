import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readChangeFiles } from "../../../src/release/core/change-file-reader";
import { VisReleaseError } from "../../../src/release/errors";

describe(readChangeFiles, () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "vis-cfr-"));
    });

    afterEach(async () => {
        const fs = await import("node:fs/promises");

        await fs.rm(cwd, { force: true, recursive: true });
    });

    it("returns empty (with no warning) when changes dir doesn't exist", async () => {
        expect.hasAssertions();

        const result = await readChangeFiles({ changesDir: ".vis/release", cwd });

        expect(result.files).toStrictEqual([]);
        expect(result.warnings).toStrictEqual([]);
    });

    it("reads + parses every .md file in the changes dir", async () => {
        expect.hasAssertions();

        mkdirSync(join(cwd, ".vis", "release"), { recursive: true });
        writeFileSync(join(cwd, ".vis", "release", "first.md"), `---\npkg-a: minor\n---\nA\n`);
        writeFileSync(join(cwd, ".vis", "release", "second.md"), `---\npkg-b: patch\n---\nB\n`);

        const result = await readChangeFiles({ changesDir: ".vis/release", cwd });

        expect(result.files).toHaveLength(2);
        expect(result.files.map((f) => f.id).sort()).toStrictEqual(["first", "second"]);
    });

    it("skips README.md", async () => {
        expect.hasAssertions();

        mkdirSync(join(cwd, ".vis", "release"), { recursive: true });
        writeFileSync(join(cwd, ".vis", "release", "README.md"), "# Change files");
        writeFileSync(join(cwd, ".vis", "release", "real.md"), `---\npkg-a: minor\n---\nA\n`);

        const result = await readChangeFiles({ changesDir: ".vis/release", cwd });

        expect(result.files).toHaveLength(1);
        expect(result.files[0]?.id).toBe("real");
    });

    it("skips non-.md files", async () => {
        expect.hasAssertions();

        mkdirSync(join(cwd, ".vis", "release"), { recursive: true });
        writeFileSync(join(cwd, ".vis", "release", "config.json"), "{}");
        writeFileSync(join(cwd, ".vis", "release", "real.md"), `---\npkg-a: minor\n---\nA\n`);

        const result = await readChangeFiles({ changesDir: ".vis/release", cwd });

        expect(result.files).toHaveLength(1);
    });

    it("respects custom changesDir option", async () => {
        expect.hasAssertions();

        mkdirSync(join(cwd, ".bumpy"), { recursive: true });
        writeFileSync(join(cwd, ".bumpy", "x.md"), `---\npkg-a: minor\n---\nA\n`);

        const result = await readChangeFiles({ changesDir: ".bumpy", cwd });

        expect(result.files).toHaveLength(1);
    });

    it("propagates parse errors as VisReleaseError", async () => {
        expect.hasAssertions();

        mkdirSync(join(cwd, ".vis", "release"), { recursive: true });
        writeFileSync(join(cwd, ".vis", "release", "bad.md"), "no frontmatter at all");

        await expect(readChangeFiles({ changesDir: ".vis/release", cwd })).rejects.toThrow(VisReleaseError);
    });

    it("rejects changesDir that escapes the workspace via ../ (RFC §19.4)", async () => {
        expect.hasAssertions();
        await expect(readChangeFiles({ changesDir: "../../etc", cwd })).rejects.toThrow(VisReleaseError);
    });

    it("rejects absolute changesDir outside the workspace", async () => {
        expect.hasAssertions();
        await expect(readChangeFiles({ changesDir: "/etc", cwd })).rejects.toThrow(VisReleaseError);
    });
});
