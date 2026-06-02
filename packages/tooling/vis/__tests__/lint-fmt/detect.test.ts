import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AdapterId, ToolAdapter } from "../../src/lint-fmt/config-types";
import { declaredVersion, detectAdapters, findFirstConfig, readRootPackageJson } from "../../src/lint-fmt/detect";

let workspaceRoot: string;

const stubAdapter = (id: AdapterId, declaredName: string, configCandidates: string[]): ToolAdapter => {
    return {
        argsCheck: () => [],
        argsFix: () => [],
        bin: () => [],
        cacheKey: () => "",
        detect: (root, packageJson) => {
            const declared = declaredVersion(packageJson, declaredName);
            const configFile = findFirstConfig(root, configCandidates);

            if (!declared && !configFile) {
                return undefined;
            }

            return { adapter: id, configFile, declared: Boolean(declared), declaredVersion: declared, root };
        },
        extensions: [],
        id,
        kind: "lint",
        parse: () => [],
    };
};

describe("declaredVersion", () => {
    it("walks every dep field", () => {
        expect.assertions(4);

        expect(declaredVersion({ dependencies: { eslint: "^9.0.0" } }, "eslint")).toBe("^9.0.0");
        expect(declaredVersion({ devDependencies: { eslint: "^9.0.0" } }, "eslint")).toBe("^9.0.0");
        expect(declaredVersion({ peerDependencies: { eslint: "^9.0.0" } }, "eslint")).toBe("^9.0.0");
        expect(declaredVersion({}, "eslint")).toBeUndefined();
    });
});

describe("findFirstConfig", () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-detect-config-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("returns the first matching candidate path", () => {
        expect.assertions(1);

        writeFileSync(join(workspaceRoot, "eslint.config.js"), "");
        const path = findFirstConfig(workspaceRoot, ["eslint.config.ts", "eslint.config.js"]);

        expect(path).toBe(join(workspaceRoot, "eslint.config.js"));
    });

    it("returns undefined when no candidate exists", () => {
        expect.assertions(1);

        expect(findFirstConfig(workspaceRoot, ["eslint.config.js"])).toBeUndefined();
    });
});

describe("readRootPackageJson", () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-detect-pkg-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("returns the parsed package.json", () => {
        expect.assertions(1);

        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ devDependencies: { eslint: "^9.0.0" } }));

        expect(readRootPackageJson(workspaceRoot)).toStrictEqual({ devDependencies: { eslint: "^9.0.0" } });
    });

    it("returns {} when package.json is missing", () => {
        expect.assertions(1);

        expect(readRootPackageJson(workspaceRoot)).toStrictEqual({});
    });

    it("returns {} when package.json is unparseable", () => {
        expect.assertions(1);

        writeFileSync(join(workspaceRoot, "package.json"), "{ not json");

        expect(readRootPackageJson(workspaceRoot)).toStrictEqual({});
    });
});

describe("detectAdapters", () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-detect-adapters-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("returns adapters whose detect() opted in", () => {
        expect.assertions(2);

        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ devDependencies: { eslint: "^9.0.0" } }));
        mkdirSync(join(workspaceRoot, "src"), { recursive: true });

        const adapters = [
            stubAdapter("eslint", "eslint", ["eslint.config.js"]),
            stubAdapter("prettier", "prettier", [".prettierrc"]),
        ];

        const detected = detectAdapters(workspaceRoot, adapters);

        expect(detected.has("eslint")).toBe(true);
        expect(detected.has("prettier")).toBe(false);
    });
});
