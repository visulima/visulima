import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { VisConfig } from "../../../src/config/types";
import type { PolicyInput } from "../../../src/security/policies";
import { evaluateInstallScriptsPolicy } from "../../../src/security/policies/install-scripts";

const writePkg = (root: string, name: string, scripts: Record<string, string>): void => {
    const dir = join(root, "node_modules", name);

    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name, scripts, version: "1.0.0" }));
};

describe(evaluateInstallScriptsPolicy, () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-policy-scripts-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    const buildInput = (): PolicyInput => {
        return {
            offline: false,
            packageManager: "pnpm",
            packages: [{ isDev: false, name: "fake", version: "1.0.0" }],
            workspaceRoot,
        };
    };

    it("returns no decisions when neither allow nor strict is set", () => {
        expect.assertions(1);

        writePkg(workspaceRoot, "esbuild", { install: "node-gyp rebuild" });
        const config: VisConfig = { security: { policies: { installScripts: {} } } };

        expect(evaluateInstallScriptsPolicy(buildInput(), config)).toStrictEqual([]);
    });

    it("warns about unapproved scripts when strict is false", () => {
        expect.assertions(2);

        writePkg(workspaceRoot, "esbuild", { install: "node-gyp rebuild" });
        const config: VisConfig = {
            security: { policies: { installScripts: { allow: { lodash: true } } } },
        };
        const decisions = evaluateInstallScriptsPolicy(buildInput(), config);

        expect(decisions).toHaveLength(1);
        expect(decisions[0]?.severity).toBe("warn");
    });

    it("blocks unapproved scripts when strict is true", () => {
        expect.assertions(2);

        writePkg(workspaceRoot, "esbuild", { postinstall: "node ./build.js" });
        const config: VisConfig = {
            security: { policies: { installScripts: { strict: true } } },
        };
        const decisions = evaluateInstallScriptsPolicy(buildInput(), config);

        expect(decisions).toHaveLength(1);
        expect(decisions[0]?.severity).toBe("block");
    });

    it("respects the allow map", () => {
        expect.assertions(1);

        writePkg(workspaceRoot, "esbuild", { install: "node ./build.js" });
        const config: VisConfig = {
            security: { policies: { installScripts: { allow: { esbuild: true }, strict: true } } },
        };

        expect(evaluateInstallScriptsPolicy(buildInput(), config)).toStrictEqual([]);
    });
});
