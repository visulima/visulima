import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { checkPackageManagerIntegrity, checkProjectEnvironment } from "../../src/runtime/env-consistency";

const HEX = (length: number): string => "a".repeat(length);

describe(checkPackageManagerIntegrity, () => {
    it("accepts a pin without an integrity suffix", () => {
        expect.assertions(1);

        expect(checkPackageManagerIntegrity("pnpm@10.18.0")).toBeUndefined();
    });

    it.each([
        ["sha512", 128],
        ["sha256", 64],
        ["sha1", 40],
    ])("accepts a well-formed %s digest", (algorithm, length) => {
        expect.assertions(1);

        expect(checkPackageManagerIntegrity(`pnpm@10.18.0+${algorithm}.${HEX(length)}`)).toBeUndefined();
    });

    it.each([
        ["an empty suffix", "pnpm@10.18.0+"],
        ["no dot separator", `pnpm@10.18.0+sha512${HEX(128)}`],
        ["an unknown algorithm", `pnpm@10.18.0+md5.${HEX(32)}`],
        ["a digest of the wrong length for sha512", `pnpm@10.18.0+sha512.${HEX(64)}`],
        ["non-hex characters", `pnpm@10.18.0+sha512.${"z".repeat(128)}`],
        ["uppercase hex, which corepack will not match", `pnpm@10.18.0+sha512.${"A".repeat(128)}`],
    ])("flags %s", (_label, field) => {
        expect.assertions(1);

        expect(checkPackageManagerIntegrity(field)).toContain("malformed integrity suffix");
    });
});

describe(checkProjectEnvironment, () => {
    let tmpDir: string;

    const writePackage = (pkg: Record<string, unknown>): void => {
        writeFileSync(join(tmpDir, "package.json"), JSON.stringify(pkg));
    };

    const warnings = (): string[] =>
        checkProjectEnvironment(tmpDir)
            .filter((d) => d.status === "warn")
            .map((d) => d.message);

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-env-consistency-"));
    });

    afterEach(() => {
        rmSync(tmpDir, { force: true, recursive: true });
    });

    it("reports skip when nothing is declared", () => {
        expect.assertions(1);

        expect(checkProjectEnvironment(tmpDir)).toStrictEqual([
            { id: "env-declarations", message: "No Node.js or package-manager declarations to cross-check.", status: "skip" },
        ]);
    });

    it("reports ok when every Node.js declaration shares a version", () => {
        expect.assertions(2);

        writeFileSync(join(tmpDir, ".nvmrc"), "v20\n");
        writePackage({ devEngines: { runtime: { name: "node", version: "^20.0.0" } }, engines: { node: ">=18" } });

        const diagnostics = checkProjectEnvironment(tmpDir);

        expect(diagnostics.map((d) => d.status)).toStrictEqual(["ok"]);
        expect(diagnostics[0]!.message).toContain("3 checked");
    });

    it("flags .nvmrc 20 against devEngines.runtime 22 and leaves the compatible engines range alone", () => {
        expect.assertions(2);

        writeFileSync(join(tmpDir, ".nvmrc"), "20");
        writePackage({ devEngines: { runtime: { name: "node", version: "22" } }, engines: { node: ">=18" } });

        const messages = warnings();

        expect(messages).toHaveLength(1);
        expect(messages[0]).toMatch(/\.nvmrc.*devEngines\.runtime/);
    });

    it("flags .nvmrc and .node-version disagreeing, which the toolchain merge would hide", () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, ".nvmrc"), "20");
        writeFileSync(join(tmpDir, ".node-version"), "22");

        expect(warnings()).toHaveLength(1);
    });

    it("ignores non-semver aliases such as lts/* because they cannot be compared", () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, ".nvmrc"), "lts/*");
        writePackage({ engines: { node: "^22" } });

        expect(checkProjectEnvironment(tmpDir).map((d) => d.status)).toStrictEqual(["ok"]);
    });

    it("flags packageManager pnpm@9 against devEngines.packageManager pnpm@^10", () => {
        expect.assertions(2);

        writePackage({
            devEngines: { packageManager: { name: "pnpm", version: "^10.0.0" } },
            packageManager: "pnpm@9.15.0",
        });

        const messages = warnings();

        expect(messages).toHaveLength(1);
        expect(messages[0]).toContain("packageManager");
    });

    it("flags a different package manager name even when devEngines gives no version", () => {
        expect.assertions(1);

        writePackage({
            devEngines: { packageManager: { name: "npm" } },
            packageManager: "pnpm@10.18.0",
        });

        expect(warnings()).toHaveLength(1);
    });

    it("treats a devEngines array as alternatives, so one matching entry is enough", () => {
        expect.assertions(1);

        writePackage({
            devEngines: { packageManager: [{ name: "npm" }, { name: "pnpm", version: "10" }] },
            packageManager: "pnpm@10.18.0",
        });

        expect(warnings()).toHaveLength(0);
    });

    it("warns about a malformed packageManager integrity hash without treating it as a conflict", () => {
        expect.assertions(2);

        writePackage({ packageManager: `pnpm@10.18.0+sha512.${HEX(64)}` });

        const diagnostics = checkProjectEnvironment(tmpDir);

        expect(diagnostics.map((d) => d.id)).toStrictEqual(["env-integrity"]);
        expect(diagnostics[0]!.message).toContain("malformed integrity suffix");
    });
});
