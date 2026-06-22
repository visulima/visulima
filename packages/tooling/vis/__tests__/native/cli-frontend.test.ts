import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { resolveNativeBinary } from "../../bin/resolve-binary.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const launcher = join(packageRoot, "bin", "vis.mjs");
const packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version as string;

// Built by `pnpm build:native:cli` locally, or distributed into the binding
// package in CI. When absent (e.g. a PR that didn't build native), skip rather
// than fail — the binary's pure legs are covered by the Rust integration tests.
const binary = resolveNativeBinary(packageRoot);

describe.skipIf(!binary)("vis CLI front-end (native binary + launcher)", () => {
    let temporaryDirectory: string;
    let delegateStub: string;
    let fallbackStub: string;

    beforeAll(() => {
        temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-cli-"));
        delegateStub = join(temporaryDirectory, "delegate.mjs");
        fallbackStub = join(temporaryDirectory, "fallback.mjs");

        writeFileSync(delegateStub, "console.log('DELEGATE:' + process.argv.slice(2).join(',')); process.exit(7);\n");
        writeFileSync(fallbackStub, "console.log('FALLBACK:' + process.argv.slice(2).join(',')); process.exit(5);\n");
    });

    afterAll(() => {
        rmSync(temporaryDirectory, { force: true, recursive: true });
    });

    it("routes a native command through the launcher to the binary", () => {
        expect.assertions(3);

        const result = spawnSync(process.execPath, [launcher, "__native-info"], {
            encoding: "utf8",
            env: { ...process.env, VIS_FALLBACK_ENTRY: fallbackStub, VIS_NATIVE_BIN: binary as string },
        });

        expect(result.status).toBe(0);
        expect(result.stdout).toContain("vis native front-end");
        // The launcher injects VIS_VERSION from package.json; the binary echoes it.
        expect(result.stdout).toContain(packageVersion);
    });

    it("routes --version natively, printing the injected package version", () => {
        expect.assertions(2);

        const result = spawnSync(process.execPath, [launcher, "--version"], {
            encoding: "utf8",
            env: { ...process.env, VIS_FALLBACK_ENTRY: fallbackStub, VIS_NATIVE_BIN: binary as string },
        });

        expect(result.status).toBe(0);
        // The launcher injects VIS_VERSION from package.json; nothing falls through.
        expect(result.stdout).toBe(`${packageVersion}\n`);
    });

    it("routes __pm-shim natively and rejects an unknown shim", () => {
        expect.assertions(2);

        const result = spawnSync(process.execPath, [launcher, "__pm-shim", "bogus", "install"], {
            encoding: "utf8",
            env: { ...process.env, VIS_FALLBACK_ENTRY: fallbackStub, VIS_NATIVE_BIN: binary as string },
        });

        expect(result.status).toBe(1);
        expect(result.stderr).toContain("is not a known package-manager shim");
    });

    it("delegates an unknown command from the binary to Node, forwarding argv and exit code", () => {
        expect.assertions(2);

        const result = spawnSync(binary as string, ["run", "build", "--flag"], {
            encoding: "utf8",
            env: { ...process.env, VIS_FALLBACK_ENTRY: delegateStub, VIS_NODE: process.execPath },
        });

        expect(result.stdout).toContain("DELEGATE:run,build,--flag");
        expect(result.status).toBe(7);
    });

    it("falls through to the in-process Node entry for non-native commands", () => {
        expect.assertions(2);

        const result = spawnSync(process.execPath, [launcher, "status", "--json"], {
            encoding: "utf8",
            env: { ...process.env, VIS_FALLBACK_ENTRY: fallbackStub, VIS_NATIVE_BIN: binary as string },
        });

        expect(result.stdout).toContain("FALLBACK:status,--json");
        expect(result.status).toBe(5);
    });
});
