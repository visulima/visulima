import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { collectBinShadows } from "../../src/security/security";

const writePkg = (dir: string, name: string, bin: Record<string, string> | string): string => {
    const pkgDir = join(dir, "node_modules", name);

    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ bin, name, version: "1.0.0" }));

    return pkgDir;
};

describe(collectBinShadows, () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-bin-"));
    });

    afterEach(() => {
        if (existsSync(tmpDir)) {
            rmSync(tmpDir, { force: true, recursive: true });
        }
    });

    it("returns no conflicts when each bin belongs to a single package", () => {
        expect.assertions(1);

        writePkg(tmpDir, "alpha", { alpha: "./cli.js" });
        writePkg(tmpDir, "beta", { beta: "./cli.js" });

        expect(collectBinShadows(tmpDir, {})).toStrictEqual([]);
    });

    it("flags two packages exposing the same bin name", () => {
        expect.assertions(2);

        writePkg(tmpDir, "left", { tsc: "./left.js" });
        writePkg(tmpDir, "right", { tsc: "./right.js" });

        const conflicts = collectBinShadows(tmpDir, {});

        expect(conflicts).toHaveLength(1);
        expect(conflicts[0]!.packages.map((p) => p.name).sort()).toStrictEqual(["left", "right"]);
    });

    it("silences a conflict when allowBins['<bin>'] is true", () => {
        expect.assertions(1);

        writePkg(tmpDir, "left", { tsc: "./left.js" });
        writePkg(tmpDir, "right", { tsc: "./right.js" });

        expect(collectBinShadows(tmpDir, { tsc: true })).toStrictEqual([]);
    });

    it("silences a conflict only when every package has a 'pkg#bin' bless", () => {
        expect.assertions(2);

        writePkg(tmpDir, "left", { tsc: "./left.js" });
        writePkg(tmpDir, "right", { tsc: "./right.js" });

        expect(collectBinShadows(tmpDir, { "left#tsc": true })).toHaveLength(1);
        expect(collectBinShadows(tmpDir, { "left#tsc": true, "right#tsc": true })).toStrictEqual([]);
    });

    it("treats `bin: 'path'` shorthand as bin named after the package", () => {
        expect.assertions(1);

        writePkg(tmpDir, "shorty", "./cli.js");
        writePkg(tmpDir, "other", { shorty: "./bin.js" });

        const conflicts = collectBinShadows(tmpDir, {});

        expect(conflicts.map((c) => c.bin)).toStrictEqual(["shorty"]);
    });

    it("does not flag duplicate installs of the same canonical package", () => {
        expect.assertions(1);

        // Two copies of the same package at different paths (npm-style hoisting + nested copy).
        writePkg(tmpDir, "dup", { dup: "./cli.js" });
        const nestedDir = join(tmpDir, "node_modules", "parent", "node_modules", "dup");

        mkdirSync(nestedDir, { recursive: true });
        writeFileSync(join(nestedDir, "package.json"), JSON.stringify({ bin: { dup: "./cli.js" }, name: "dup", version: "1.0.0" }));

        const parentPkg = join(tmpDir, "node_modules", "parent");

        mkdirSync(parentPkg, { recursive: true });
        writeFileSync(join(parentPkg, "package.json"), JSON.stringify({ name: "parent", version: "1.0.0" }));

        expect(collectBinShadows(tmpDir, {})).toStrictEqual([]);
    });
});
