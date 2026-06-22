import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    buildEnterFile,
    deletePreMode,
    preModeFilePath,
    readPreMode,
    writePreMode,
} from "../../../src/release/core/pre-mode";
import { VisReleaseError } from "../../../src/release/errors";

const CHANGES_DIR = ".vis/release";

describe("pre-mode: file I/O round-trip", () => {
    let cwd: string;

    beforeEach(async () => {
        cwd = await mkdtemp(join(tmpdir(), "vis-pre-mode-"));
    });

    afterEach(async () => {
        await rm(cwd, { force: true, recursive: true });
    });

    it("returns undefined when pre.json is absent", async () => {
        expect.hasAssertions();
        await expect(readPreMode(cwd, CHANGES_DIR)).resolves.toBeUndefined();
    });

    it("writes a file readable by readPreMode", async () => {
        expect.hasAssertions();

        const file = buildEnterFile("alpha", [
            { name: "@scope/a", version: "1.2.0" },
            { name: "@scope/b", version: "0.5.0" },
        ]);

        const path = await writePreMode(cwd, CHANGES_DIR, file);
        const read = await readPreMode(cwd, CHANGES_DIR);

        expect(path).toBe(preModeFilePath(cwd, CHANGES_DIR));
        expect(read).toMatchObject({
            initialVersions: { "@scope/a": "1.2.0", "@scope/b": "0.5.0" },
            mode: "pre",
            tag: "alpha",
            version: 1,
        });
    });

    it("deletePreMode returns true when a file was removed", async () => {
        expect.hasAssertions();

        const file = buildEnterFile("alpha", []);

        await writePreMode(cwd, CHANGES_DIR, file);

        await expect(deletePreMode(cwd, CHANGES_DIR)).resolves.toBe(true);
        await expect(readPreMode(cwd, CHANGES_DIR)).resolves.toBeUndefined();
    });

    it("deletePreMode returns false when there's nothing to delete", async () => {
        expect.hasAssertions();
        await expect(deletePreMode(cwd, CHANGES_DIR)).resolves.toBe(false);
    });
});

describe("pre-mode: corrupt file errors", () => {
    let cwd: string;

    beforeEach(async () => {
        cwd = await mkdtemp(join(tmpdir(), "vis-pre-mode-"));
        await mkdir(join(cwd, CHANGES_DIR), { recursive: true });
    });

    afterEach(async () => {
        await rm(cwd, { force: true, recursive: true });
    });

    it("throws STATE_FILE_CORRUPT on malformed JSON", async () => {
        expect.hasAssertions();

        await writeFile(preModeFilePath(cwd, CHANGES_DIR), "{ malformed");

        await expect(readPreMode(cwd, CHANGES_DIR)).rejects.toMatchObject({
            code: "STATE_FILE_CORRUPT",
        });
    });

    it("throws on unknown schema version", async () => {
        expect.hasAssertions();

        await writeFile(
            preModeFilePath(cwd, CHANGES_DIR),
            JSON.stringify({ initialVersions: {}, mode: "pre", tag: "alpha", version: 99 }),
        );

        await expect(readPreMode(cwd, CHANGES_DIR)).rejects.toBeInstanceOf(VisReleaseError);
    });

    it("throws on invalid mode value", async () => {
        expect.hasAssertions();

        await writeFile(
            preModeFilePath(cwd, CHANGES_DIR),
            JSON.stringify({ initialVersions: {}, mode: "bogus", tag: "alpha", version: 1 }),
        );

        await expect(readPreMode(cwd, CHANGES_DIR)).rejects.toMatchObject({
            code: "STATE_FILE_CORRUPT",
        });
    });

    it("throws on missing tag", async () => {
        expect.hasAssertions();

        await writeFile(
            preModeFilePath(cwd, CHANGES_DIR),
            JSON.stringify({ initialVersions: {}, mode: "pre", version: 1 }),
        );

        await expect(readPreMode(cwd, CHANGES_DIR)).rejects.toMatchObject({
            code: "STATE_FILE_CORRUPT",
        });
    });
});

describe("pre-mode: buildEnterFile", () => {
    it("snapshots every package's current version", () => {
        expect.hasAssertions();

        const file = buildEnterFile("rc", [
            { name: "@a/one", version: "0.5.0" },
            { name: "@a/two", version: "1.0.0" },
        ]);

        expect(file.tag).toBe("rc");
        expect(file.mode).toBe("pre");
        expect(file.initialVersions).toStrictEqual({ "@a/one": "0.5.0", "@a/two": "1.0.0" });
        expect(file.version).toBe(1);
        expect(Date.parse(file.enteredAt)).not.toBeNaN();
    });
});
