import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyViteClientOverride, detectViteClientOverride } from "../../src/preflight/vite-client-override";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../test-helpers";

const VITE_CLIENT = "@voidzero-dev/vite-task-client";

let tmp: string;

const writePackageJson = (contents: object): void => {
    writeFileSync(join(tmp, "package.json"), JSON.stringify(contents, undefined, 4));
};

const readPackageJson = (): Record<string, unknown> => JSON.parse(readFileSync(join(tmp, "package.json"), "utf8")) as Record<string, unknown>;

describe(detectViteClientOverride, () => {
    beforeEach(() => {
        tmp = createTemporaryDirectory("vis-vite-override-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(tmp);
    });

    it("reports not-present when the vite client is absent", () => {
        expect.assertions(2);

        writePackageJson({ dependencies: { "left-pad": "1.0.0" } });

        const state = detectViteClientOverride(tmp);

        expect(state.present).toBe(false);
        expect(state.alreadyOverridden).toBe(false);
    });

    it("detects the client in any dependency field", () => {
        expect.assertions(1);

        writePackageJson({ devDependencies: { [VITE_CLIENT]: "^1.0.0" } });

        expect(detectViteClientOverride(tmp).present).toBe(true);
    });

    it("detects the client when installed under node_modules", () => {
        expect.assertions(1);

        writePackageJson({});
        mkdirSync(join(tmp, "node_modules", "@voidzero-dev", "vite-task-client"), { recursive: true });

        expect(detectViteClientOverride(tmp).present).toBe(true);
    });

    it("treats an existing override as already-overridden", () => {
        expect.assertions(1);

        writePackageJson({
            dependencies: { [VITE_CLIENT]: "^1.0.0" },
            pnpm: { overrides: { [VITE_CLIENT]: "npm:@visulima/task-runner-client@^1" } },
        });

        expect(detectViteClientOverride(tmp).alreadyOverridden).toBe(true);
    });

    it("flags a prior decline via the marker file", () => {
        expect.assertions(1);

        writePackageJson({ dependencies: { [VITE_CLIENT]: "^1.0.0" } });
        mkdirSync(join(tmp, ".vis"), { recursive: true });
        writeFileSync(join(tmp, ".vis", ".vite-client-override-declined"), "");

        expect(detectViteClientOverride(tmp).declined).toBe(true);
    });

    it("detects the client declared only in a sub-package manifest", () => {
        expect.assertions(2);

        // Root has nothing; a discovered project manifest carries the dep.
        writePackageJson({ name: "root", private: true });

        const state = detectViteClientOverride(tmp, [{ dependencies: { "left-pad": "1.0.0" } }, { devDependencies: { [VITE_CLIENT]: "^1.0.0" } }]);

        expect(state.present).toBe(true);
        expect(state.alreadyOverridden).toBe(false);
    });

    it("treats an override in pnpm-workspace.yaml as already-overridden", () => {
        expect.assertions(1);

        writePackageJson({ dependencies: { [VITE_CLIENT]: "^1.0.0" } });
        writeFileSync(join(tmp, "pnpm-workspace.yaml"), `packages:\n  - "packages/*"\noverrides:\n  "${VITE_CLIENT}": "npm:@visulima/task-runner-client@^1"\n`);

        expect(detectViteClientOverride(tmp).alreadyOverridden).toBe(true);
    });
});

describe(applyViteClientOverride, () => {
    beforeEach(() => {
        tmp = createTemporaryDirectory("vis-vite-override-apply-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(tmp);
    });

    it("writes to pnpm-workspace.yaml when it exists, preserving other keys", () => {
        expect.assertions(3);

        writePackageJson({ dependencies: { [VITE_CLIENT]: "^1.0.0" } });
        writeFileSync(join(tmp, "pnpm-workspace.yaml"), `packages:\n  - "packages/*"\n`);

        const written = applyViteClientOverride(tmp, "pnpm");

        expect(written).toStrictEqual({ file: "pnpm-workspace.yaml", installCommand: "pnpm install" });

        const yaml = readFileSync(join(tmp, "pnpm-workspace.yaml"), "utf8");

        // Existing `packages:` survives and the override is added. The
        // yaml lib quotes the special-char key/value, so assert on the
        // substrings rather than an exact (quote-sensitive) line.
        expect(yaml).toContain("packages/*");
        expect(yaml).toMatch(/overrides:.*vite-task-client.*npm:@visulima\/task-runner-client@\^1/s);
    });

    it("falls back to package.json pnpm.overrides when no workspace yaml exists", () => {
        expect.assertions(2);

        writePackageJson({ dependencies: { [VITE_CLIENT]: "^1.0.0" } });

        const written = applyViteClientOverride(tmp, "pnpm");

        expect(written).toStrictEqual({ file: "package.json", installCommand: "pnpm install" });
        expect((readPackageJson().pnpm as { overrides: Record<string, string> }).overrides[VITE_CLIENT]).toBe("npm:@visulima/task-runner-client@^1");
    });

    it("writes top-level overrides for npm", () => {
        expect.assertions(2);

        writePackageJson({ dependencies: { [VITE_CLIENT]: "^1.0.0" } });

        const written = applyViteClientOverride(tmp, "npm");

        expect(written?.file).toBe("package.json");
        expect((readPackageJson().overrides as Record<string, string>)[VITE_CLIENT]).toBe("npm:@visulima/task-runner-client@^1");
    });

    it("writes resolutions for yarn", () => {
        expect.assertions(1);

        writePackageJson({ dependencies: { [VITE_CLIENT]: "^1.0.0" } });
        applyViteClientOverride(tmp, "yarn");

        expect((readPackageJson().resolutions as Record<string, string>)[VITE_CLIENT]).toBe("npm:@visulima/task-runner-client@^1");
    });
});
