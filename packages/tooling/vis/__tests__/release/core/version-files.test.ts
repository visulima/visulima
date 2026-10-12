import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    applyVersionFilesForRelease,
    assertSupportedVersionFiles,
    checkVersionFile,
    readManifestVersion,
    rewriteCargoVersion,
    rewriteTauriVersion,
} from "../../../src/release/core/version-files";
import { VisReleaseError } from "../../../src/release/errors";

/**
 * Coverage for built-in `versionFiles` — Cargo.toml and tauri.conf.json
 * version bumps that need no regex. The bar is that only the version
 * literal changes: comments, dependency requirements and formatting survive.
 */

describe("version-files: rewriteCargoVersion", () => {
    it("bumps [package].version and keeps everything else byte-for-byte", () => {
        expect.hasAssertions();

        const raw = [
            "# top comment",
            "[package]",
            "name = \"app\"",
            "version = \"0.1.0\" # keep this comment",
            "edition = \"2021\"",
            "",
            "[dependencies]",
            "serde = { version = \"1.0\" }",
            "",
        ].join("\n");

        const result = rewriteCargoVersion(raw, "0.2.0");

        expect(result.found).toBe(true);
        expect(result.content).toBe(raw.replace("version = \"0.1.0\"", "version = \"0.2.0\""));
    });

    it("never rewrites dependency versions, even when [package] comes later", () => {
        expect.hasAssertions();

        const raw = ["[dependencies]", "version = \"9.9.9\"", "", "[package]", "name = \"app\"", "version = \"0.1.0\"", ""].join("\n");
        const result = rewriteCargoVersion(raw, "0.2.0");

        expect(result.content).toContain("version = \"9.9.9\"");
        expect(result.content).toContain("version = \"0.2.0\"");
    });

    it("rewrites [workspace.package].version", () => {
        expect.hasAssertions();

        const raw = "[workspace]\nmembers = [\"a\"]\n\n[workspace.package]\nversion = \"1.0.0\"\n";
        const result = rewriteCargoVersion(raw, "1.1.0");

        expect(result.content).toBe("[workspace]\nmembers = [\"a\"]\n\n[workspace.package]\nversion = \"1.1.0\"\n");
    });

    it("leaves inherited versions alone", () => {
        expect.hasAssertions();

        const raw = "[package]\nname = \"a\"\nversion.workspace = true\n";
        const result = rewriteCargoVersion(raw, "2.0.0");

        expect(result.found).toBe(false);
        expect(result.content).toBeUndefined();
    });

    it("preserves CRLF line endings", () => {
        expect.hasAssertions();

        const raw = "[package]\r\nname = \"a\"\r\nversion = \"0.1.0\"\r\n";
        const result = rewriteCargoVersion(raw, "0.2.0");

        expect(result.content).toBe("[package]\r\nname = \"a\"\r\nversion = \"0.2.0\"\r\n");
    });

    it("reports not found when no version sits in a version table", () => {
        expect.hasAssertions();

        const result = rewriteCargoVersion("[dependencies]\nversion = \"1\"\n", "2.0.0");

        expect(result.found).toBe(false);
    });
});

describe("version-files: rewriteTauriVersion", () => {
    it("bumps the Tauri v2 top-level version and keeps formatting", () => {
        expect.hasAssertions();

        const raw = "{\n  \"productName\": \"app\",\n  \"version\": \"0.1.0\",\n  \"identifier\": \"dev.app\"\n}\n";
        const result = rewriteTauriVersion(raw, "0.2.0");

        expect(result.content).toBe("{\n  \"productName\": \"app\",\n  \"version\": \"0.2.0\",\n  \"identifier\": \"dev.app\"\n}\n");
    });

    it("bumps the Tauri v1 package.version", () => {
        expect.hasAssertions();

        const raw = "{\n  \"package\": {\n    \"productName\": \"app\",\n    \"version\": \"0.1.0\"\n  }\n}\n";
        const result = rewriteTauriVersion(raw, "0.2.0");

        expect(result.content).toBe("{\n  \"package\": {\n    \"productName\": \"app\",\n    \"version\": \"0.2.0\"\n  }\n}\n");
    });

    it("ignores a nested version key that is not the package version", () => {
        expect.hasAssertions();

        const raw = "{\n  \"plugins\": { \"updater\": { \"version\": \"5.0.0\" } },\n  \"version\": \"0.1.0\"\n}\n";
        const result = rewriteTauriVersion(raw, "0.2.0");

        expect(result.content).toContain("\"version\": \"5.0.0\"");
        expect(result.content).toContain("\"version\": \"0.2.0\"");
    });

    it("skips a version that is a path into package.json", () => {
        expect.hasAssertions();

        const result = rewriteTauriVersion("{ \"version\": \"../package.json\" }", "0.2.0");

        expect(result.delegated).toBe(true);
        expect(result.content).toBeUndefined();
    });

    it("does not treat a string inside an array as the version", () => {
        expect.hasAssertions();

        const raw = "{ \"tags\": [\"version\"], \"version\": \"0.1.0\" }";
        const result = rewriteTauriVersion(raw, "0.2.0");

        expect(result.content).toBe("{ \"tags\": [\"version\"], \"version\": \"0.2.0\" }");
    });
});

describe("version-files: applyVersionFilesForRelease", () => {
    let packageDir: string;

    beforeEach(async () => {
        packageDir = await mkdtemp(join(tmpdir(), "vis-version-files-"));
        await mkdir(join(packageDir, "src-tauri"), { recursive: true });
    });

    afterEach(async () => {
        await rm(packageDir, { force: true, recursive: true });
    });

    it("produces writes for Cargo.toml and tauri.conf.json", async () => {
        expect.hasAssertions();

        await writeFile(join(packageDir, "src-tauri", "Cargo.toml"), "[package]\nname = \"app\"\nversion = \"0.1.0\"\n");
        await writeFile(join(packageDir, "src-tauri", "tauri.conf.json"), "{ \"version\": \"0.1.0\" }\n");

        const result = await applyVersionFilesForRelease(packageDir, ["src-tauri/Cargo.toml", "src-tauri/tauri.conf.json"], "0.2.0", "app");

        expect(result.warnings).toStrictEqual([]);
        expect(result.writes.map((write) => write.content)).toStrictEqual(["[package]\nname = \"app\"\nversion = \"0.2.0\"\n", "{ \"version\": \"0.2.0\" }\n"]);
    });

    it("warns instead of throwing when a configured file is missing", async () => {
        expect.hasAssertions();

        const result = await applyVersionFilesForRelease(packageDir, ["src-tauri/Cargo.toml"], "0.2.0", "app");

        expect(result.writes).toStrictEqual([]);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain("does not exist");
    });

    it("rejects an unsupported basename with CONFIG_INVALID", async () => {
        expect.hasAssertions();

        await expect(applyVersionFilesForRelease(packageDir, ["pyproject.toml"], "0.2.0", "app")).rejects.toMatchObject({
            code: "CONFIG_INVALID",
        });
        await expect(applyVersionFilesForRelease(packageDir, ["pyproject.toml"], "0.2.0", "app")).rejects.toBeInstanceOf(VisReleaseError);
    });

    it("does not write when the file already holds the new version", async () => {
        expect.hasAssertions();

        const raw = "[package]\nname = \"app\"\nversion = \"0.2.0\"\n";

        await writeFile(join(packageDir, "Cargo.toml"), raw);

        const result = await applyVersionFilesForRelease(packageDir, ["Cargo.toml"], "0.2.0", "app");

        expect(result.writes).toStrictEqual([]);
        expect(result.warnings).toStrictEqual([]);
        await expect(readFile(join(packageDir, "Cargo.toml"), "utf8")).resolves.toBe(raw);
    });
});

describe("version-files: readManifestVersion", () => {
    it("reads Cargo.toml [package].version", async () => {
        expect.hasAssertions();

        await expect(readManifestVersion("Cargo.toml", "[package]\nname = \"a\"\nversion = \"3.4.5\"\n")).resolves.toStrictEqual({ version: "3.4.5" });
    });

    it("reads a Tauri v2 version and flags a delegated one", async () => {
        expect.hasAssertions();

        await expect(readManifestVersion("tauri.conf.json", "{ \"version\": \"1.0.0\" }")).resolves.toStrictEqual({ version: "1.0.0" });
        await expect(readManifestVersion("tauri.conf.json", "{ \"version\": \"../package.json\" }")).resolves.toStrictEqual({ delegated: true });
    });

    it("returns undefined for an unsupported basename", async () => {
        expect.hasAssertions();

        await expect(readManifestVersion("pyproject.toml", "[project]\nversion = \"1.0.0\"")).resolves.toBeUndefined();
    });
});

describe("version-files: readManifestVersion inheritance", () => {
    it("falls back to [workspace.package] when [package].version is inherited", async () => {
        expect.hasAssertions();

        const raw = "[package]\nname = \"root\"\nversion.workspace = true\n\n[workspace.package]\nversion = \"1.0.0\"\n";

        await expect(readManifestVersion("Cargo.toml", raw)).resolves.toStrictEqual({ version: "1.0.0" });
    });

    it("bumps and reads back the same table for an inherited root crate", async () => {
        expect.hasAssertions();

        const raw = "[package]\nname = \"root\"\nversion.workspace = true\n\n[workspace.package]\nversion = \"1.0.0\"\n";
        const bumped = rewriteCargoVersion(raw, "1.1.0").content!;

        await expect(readManifestVersion("Cargo.toml", bumped)).resolves.toStrictEqual({ version: "1.1.0" });
    });
});

describe("version-files: checkVersionFile", () => {
    let packageDir: string;

    beforeEach(async () => {
        packageDir = await mkdtemp(join(tmpdir(), "vis-version-check-"));
    });

    afterEach(async () => {
        await rm(packageDir, { force: true, recursive: true });
    });

    const check = (entry: string, packageVersion = "0.2.0") => checkVersionFile({ entry, packageDir, packageName: "app", packageVersion });

    it("passes when the manifest matches package.json", async () => {
        expect.hasAssertions();

        await writeFile(join(packageDir, "Cargo.toml"), "[package]\nname = \"app\"\nversion = \"0.2.0\"\n");

        await expect(check("Cargo.toml")).resolves.toMatchObject({ severity: "info", status: "pass" });
    });

    it("fails on drift and names both versions", async () => {
        expect.hasAssertions();

        await writeFile(join(packageDir, "tauri.conf.json"), "{ \"version\": \"0.1.0\" }");

        const result = await check("tauri.conf.json");

        expect(result).toMatchObject({ severity: "warn", status: "fail" });
        expect(result.message).toContain("0.1.0");
        expect(result.message).toContain("0.2.0");
    });

    it("passes for a delegated Tauri version", async () => {
        expect.hasAssertions();

        await writeFile(join(packageDir, "tauri.conf.json"), "{ \"version\": \"../package.json\" }");

        await expect(check("tauri.conf.json")).resolves.toMatchObject({ status: "pass" });
    });

    it("fails for an unsupported basename without throwing", async () => {
        expect.hasAssertions();

        await expect(check("pyproject.toml")).resolves.toMatchObject({ status: "fail" });
    });

    it("fails for a missing file without throwing", async () => {
        expect.hasAssertions();

        const result = await check("Cargo.toml");

        expect(result).toMatchObject({ status: "fail" });
        expect(result.message).toContain("doesn't exist");
    });

    it("fails with the parse error for malformed TOML instead of throwing", async () => {
        expect.hasAssertions();

        await writeFile(join(packageDir, "Cargo.toml"), "[package\nversion = \"0.2.0\"\n");

        const result = await check("Cargo.toml");

        expect(result).toMatchObject({ status: "fail" });
        expect(result.message).toContain("could not parse");
    });
});

describe("version-files: assertSupportedVersionFiles", () => {
    it("accepts supported basenames in any directory", () => {
        expect.hasAssertions();

        expect(() => { assertSupportedVersionFiles("app", ["src-tauri/Cargo.toml", "src-tauri/tauri.conf.json"]); }).not.toThrow();
    });

    it("throws CONFIG_INVALID naming the package and entry", () => {
        expect.hasAssertions();

        expect(() => { assertSupportedVersionFiles("app", ["pyproject.toml"]); }).toThrow(expect.objectContaining({ code: "CONFIG_INVALID" }));
        expect(() => { assertSupportedVersionFiles("app", ["pyproject.toml"]); }).toThrow(/pyproject\.toml.*app/);
    });
});

describe("version-files: overlap with extraFiles", () => {
    let packageDir: string;

    beforeEach(async () => {
        packageDir = await mkdtemp(join(tmpdir(), "vis-version-overlap-"));
    });

    afterEach(async () => {
        await rm(packageDir, { force: true, recursive: true });
    });

    it("keeps an extraFiles edit when versionFiles rewrites the same path", async () => {
        expect.hasAssertions();

        await writeFile(join(packageDir, "Cargo.toml"), "[package]\nname = \"app\"\nversion = \"0.1.0\"\ndescription = \"old\"\n");

        // Simulate the extraFiles output for the same path: it changed the description.
        const pending = new Map([[join(packageDir, "Cargo.toml"), "[package]\nname = \"app\"\nversion = \"0.1.0\"\ndescription = \"new\"\n"]]);
        const result = await applyVersionFilesForRelease(packageDir, ["Cargo.toml"], "0.2.0", "app", pending);

        expect(result.writes).toStrictEqual([
            { content: "[package]\nname = \"app\"\nversion = \"0.2.0\"\ndescription = \"new\"\n", path: join(packageDir, "Cargo.toml") },
        ]);
    });
});
