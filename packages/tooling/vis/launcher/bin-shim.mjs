// vis bin resolver + fallback.
//
// Resolves the native launcher binary from the platform-specific optional
// dependency (`@visulima/vis-launcher-<target>`) and execs it, setting
// VIS_DIST_DIR so the binary finds the bundled JS CLI. If no binary is present
// (unsupported platform, or the optional dep was skipped — e.g. pnpm's ignored-
// builds policy), it FALLS BACK to running the JS CLI directly with Node. So
// `npm i @visulima/vis` always works; the native binary is a pure accelerator.
//
// NOTE: when the native binary IS present, the preferred packaging links it as
// the `vis` bin directly (no Node boot for this shim) — see design-rust-launcher.md
// "Packaging". This shim is the always-correct fallback path and the dev entry.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

/**
 * The platform package suffix, e.g. `darwin-arm64`, `linux-x64-gnu`, `win32-x64-msvc`.
 * @returns {string | undefined} The target suffix, or undefined on an unsupported platform.
 */
const platformTarget = () => {
    const { arch, platform } = process;

    if (platform === "win32") {
        return `win32-${arch}-msvc`;
    }

    if (platform === "darwin") {
        return `darwin-${arch}`;
    }

    if (platform === "linux") {
        // glibc vs musl — report.header.glibcVersionRuntime is absent on musl.
        const report = typeof process.report?.getReport === "function" ? process.report.getReport() : undefined;
        const isGlibc = Boolean(report && report.header && report.header.glibcVersionRuntime);

        return `linux-${arch}-${isGlibc ? "gnu" : "musl"}`;
    }

    return undefined;
};

/**
 * Absolute path to the native binary for this platform, or undefined if absent.
 * @returns {string | undefined} The binary path, or undefined when no platform package is installed.
 */
const resolveNativeBinary = () => {
    const target = platformTarget();

    if (target === undefined) {
        return undefined;
    }

    const binaryName = process.platform === "win32" ? "vis.exe" : "vis";

    try {
        // The platform package exposes its binary via package.json "bin"/"files";
        // resolve through its package.json so we don't hard-code its layout.
        const packageJson = require.resolve(`@visulima/vis-launcher-${target}/package.json`);

        return join(dirname(packageJson), "bin", binaryName);
    } catch {
        return undefined;
    }
};

const argv = process.argv.slice(2);
const distDirectory = process.env.VIS_DIST_DIR ?? join(here, "dist");
const native = resolveNativeBinary();

try {
    if (native === undefined) {
        // Fallback: no native binary — run the JS CLI directly.
        execFileSync(process.execPath, [join(distDirectory, "bin.js"), ...argv], { stdio: "inherit" });
    } else {
        // Native path: the binary handles static/native commands and spawns Node
        // for the rest. VIS_DIST_DIR tells it where the bundled JS CLI lives.
        execFileSync(native, argv, { env: { ...process.env, VIS_DIST_DIR: distDirectory }, stdio: "inherit" });
    }
} catch (error) {
    // execFileSync throws on non-zero exit; propagate the child's code. This is the
    // bin entry point, so exiting with the child's status is the correct behaviour.
    // eslint-disable-next-line unicorn/no-process-exit -- this file IS the CLI entry; mirror the child's exit code
    process.exit(typeof error.status === "number" ? error.status : 1);
}
