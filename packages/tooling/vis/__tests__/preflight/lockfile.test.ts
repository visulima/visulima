import { mkdirSync, utimesSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkLockfileFreshness, runLockfilePreflight } from "../../src/preflight/lockfile";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../test-helpers";

let tmp: string;

const writeFile = (relative: string, contents: string, mtimeSecondsAgo = 0): string => {
    const absolute = join(tmp, relative);

    mkdirSync(join(absolute, ".."), { recursive: true });
    writeFileSync(absolute, contents);

    if (mtimeSecondsAgo > 0) {
        const t = (Date.now() - mtimeSecondsAgo * 1000) / 1000;

        utimesSync(absolute, t, t);
    }

    return absolute;
};

describe("lockfile", () => {
    beforeEach(() => {
        tmp = createTemporaryDirectory("vis-preflight-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(tmp);
    });

    describe(checkLockfileFreshness, () => {
        it("should return checked=false when no lockfile is present", () => {
            expect.assertions(1);

            expect(checkLockfileFreshness(tmp)).toStrictEqual({ checked: false });
        });

        it("should report missing-install when the lockfile exists but no install marker does", () => {
            expect.assertions(3);

            writeFile("pnpm-lock.yaml", "lockfileVersion: 9.0\n");

            const result = checkLockfileFreshness(tmp);

            expect(result.failure).toBe("missing-install");
            expect(result.detail?.packageManager).toBe("pnpm");
            expect(result.message).toContain("pnpm install");
        });

        it("should pass when the install marker is fresher than the lockfile", () => {
            expect.assertions(2);

            writeFile("pnpm-lock.yaml", "lockfileVersion: 9.0\n", 60);
            writeFile("node_modules/.modules.yaml", "registry: https://registry\n");

            const result = checkLockfileFreshness(tmp);

            expect(result.failure).toBeUndefined();
            expect(result.checked).toBe(true);
        });

        it("should report stale-install when the lockfile is fresher than the install marker", () => {
            expect.assertions(3);

            writeFile("node_modules/.modules.yaml", "registry: https://registry\n", 120);
            writeFile("pnpm-lock.yaml", "lockfileVersion: 9.0\n");

            const result = checkLockfileFreshness(tmp);

            expect(result.failure).toBe("stale-install");
            expect(result.detail?.marker).toBe("node_modules/.modules.yaml");
            expect(result.message).toContain("pnpm install");
        });

        it("should pick the freshest of multiple install markers", () => {
            expect.assertions(2);

            writeFile("yarn.lock", "# yarn lockfile\n", 60);
            writeFile("node_modules/.yarn-integrity", "{}", 600);
            writeFile("node_modules/.yarn-state.yml", "version: 1\n");

            const result = checkLockfileFreshness(tmp);

            expect(result.failure).toBeUndefined();
            expect(result.detail?.marker).toBe("node_modules/.yarn-state.yml");
        });

        it("should detect npm by package-lock.json (TTY recommends plain npm install)", () => {
            expect.assertions(2);

            writeFile("package-lock.json", "{}\n");

            const result = checkLockfileFreshness(tmp);

            expect(result.detail?.packageManager).toBe("npm");
            expect(result.message).toContain("npm install");
        });

        it("should detect npm by npm-shrinkwrap.json and prefer it over package-lock.json", () => {
            expect.assertions(2);

            writeFile("package-lock.json", "{}\n");
            writeFile("npm-shrinkwrap.json", "{}\n");

            const result = checkLockfileFreshness(tmp);

            expect(result.detail?.packageManager).toBe("npm");
            expect(result.detail?.lockfilePath).toBe("npm-shrinkwrap.json");
        });

        it("should recommend `npm ci` when running in CI", () => {
            expect.assertions(1);

            writeFile("package-lock.json", "{}\n");

            const result = checkLockfileFreshness(tmp, { inCi: true });

            expect(result.message).toContain("npm ci");
        });

        it("should detect bun by bun.lockb", () => {
            expect.assertions(2);

            writeFile("bun.lockb", "");

            const result = checkLockfileFreshness(tmp);

            expect(result.detail?.packageManager).toBe("bun");
            expect(result.message).toContain("bun install");
        });

        it("should detect bun by the bun.lock text format (bun 1.2+)", () => {
            expect.assertions(2);

            writeFile("bun.lock", "{}\n");

            const result = checkLockfileFreshness(tmp);

            expect(result.detail?.packageManager).toBe("bun");
            // detail paths are workspace-root-relative (no leading absolute prefix).
            expect(result.detail?.lockfilePath).toBe("bun.lock");
        });

        it("should detect aube by aube-lock.yaml and recommend `aube install` in TTY", () => {
            expect.assertions(3);

            writeFile("aube-lock.yaml", "lockfileVersion: '9.0'\n");

            const result = checkLockfileFreshness(tmp);

            expect(result.detail?.packageManager).toBe("aube");
            expect(result.detail?.lockfilePath).toBe("aube-lock.yaml");
            expect(result.message).toContain("aube install");
        });

        it("should recommend `aube ci` when running in CI", () => {
            expect.assertions(1);

            writeFile("aube-lock.yaml", "lockfileVersion: '9.0'\n");

            const result = checkLockfileFreshness(tmp, { inCi: true });

            expect(result.message).toContain("aube ci");
        });

        it("should recognise the aube install marker (.aube-state)", () => {
            expect.assertions(2);

            writeFile("aube-lock.yaml", "lockfileVersion: '9.0'\n", 60);
            writeFile("node_modules/.aube-state", "{}\n");

            const result = checkLockfileFreshness(tmp);

            expect(result.failure).toBeUndefined();
            expect(result.detail?.marker).toBe("node_modules/.aube-state");
        });
    });

    describe(runLockfilePreflight, () => {
        it("should be a no-op when skip is set", () => {
            expect.assertions(2);

            writeFile("pnpm-lock.yaml", "lockfileVersion: 9.0\n");

            const warn = vi.fn();
            const result = runLockfilePreflight(tmp, false, { warn }, { skip: true });

            expect(result.shouldContinue).toBe(true);
            expect(warn).not.toHaveBeenCalled();
        });

        it("should warn but continue in TTY (non-CI) on drift", () => {
            expect.assertions(2);

            writeFile("node_modules/.modules.yaml", "registry: x\n", 120);
            writeFile("pnpm-lock.yaml", "lockfileVersion: 9.0\n");

            const warn = vi.fn();
            const result = runLockfilePreflight(tmp, false, { warn });

            expect(result.shouldContinue).toBe(true);
            expect(warn).toHaveBeenCalledTimes(1);
        });

        it("should stop and surface formattedMessage (without logging) in CI on drift", () => {
            expect.assertions(3);

            writeFile("node_modules/.modules.yaml", "registry: x\n", 120);
            writeFile("pnpm-lock.yaml", "lockfileVersion: 9.0\n");

            const warn = vi.fn();
            const result = runLockfilePreflight(tmp, true, { warn });

            // CI contract: helper stays quiet, caller throws with `formattedMessage`
            // — guarantees the user sees the detail exactly once.
            expect(result.shouldContinue).toBe(false);
            expect(result.formattedMessage).toContain("preflight:");
            expect(warn).not.toHaveBeenCalled();
        });

        it("should downgrade CI failures to warnings when ciAsWarning is set", () => {
            expect.assertions(2);

            writeFile("node_modules/.modules.yaml", "registry: x\n", 120);
            writeFile("pnpm-lock.yaml", "lockfileVersion: 9.0\n");

            const warn = vi.fn();
            const result = runLockfilePreflight(tmp, true, { warn }, { ciAsWarning: true });

            expect(result.shouldContinue).toBe(true);
            expect(warn).toHaveBeenCalledTimes(1);
        });

        it("should silently continue when no lockfile is present", () => {
            expect.assertions(2);

            const warn = vi.fn();
            const result = runLockfilePreflight(tmp, true, { warn });

            expect(result.shouldContinue).toBe(true);
            expect(warn).not.toHaveBeenCalled();
        });
    });
});
