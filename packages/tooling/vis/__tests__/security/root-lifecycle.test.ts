import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runRootLifecycleScripts } from "../../src/security/security";

describe(runRootLifecycleScripts, () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-root-lc-"));
    });

    afterEach(() => {
        if (existsSync(tmpDir)) {
            rmSync(tmpDir, { force: true, recursive: true });
        }
    });

    it("is a no-op when there is no package.json", () => {
        expect.assertions(1);

        expect(() => {
            runRootLifecycleScripts(tmpDir);
        }).not.toThrow();
    });

    it("runs declared prepare + prepublish hooks", () => {
        expect.assertions(2);

        const prepareMarker = join(tmpDir, "prepare.marker");
        const prepublishMarker = join(tmpDir, "prepublish.marker");
        const makeScript = (path: string): string => `node -e "require('node:fs').writeFileSync(process.argv[1], 'ok')" ${path}`;

        writeFileSync(
            join(tmpDir, "package.json"),
            JSON.stringify({
                name: "root",
                scripts: {
                    prepare: makeScript(prepareMarker),
                    prepublish: makeScript(prepublishMarker),
                },
                version: "1.0.0",
            }),
        );

        runRootLifecycleScripts(tmpDir);

        expect(readFileSync(prepareMarker, "utf8")).toBe("ok");
        expect(readFileSync(prepublishMarker, "utf8")).toBe("ok");
    });

    it("respects the custom hooks list (only runs requested hooks)", () => {
        expect.assertions(2);

        const prepareMarker = join(tmpDir, "prepare.marker");
        const prepublishMarker = join(tmpDir, "prepublish.marker");
        const makeScript = (path: string): string => `node -e "require('node:fs').writeFileSync(process.argv[1], 'ok')" ${path}`;

        writeFileSync(
            join(tmpDir, "package.json"),
            JSON.stringify({
                name: "root",
                scripts: {
                    prepare: makeScript(prepareMarker),
                    prepublish: makeScript(prepublishMarker),
                },
                version: "1.0.0",
            }),
        );

        runRootLifecycleScripts(tmpDir, ["prepare"]);

        expect(existsSync(prepareMarker)).toBe(true);
        expect(existsSync(prepublishMarker)).toBe(false);
    });
});
