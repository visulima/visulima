// Platform resolution for the native `vis` CLI binary. Shared by the launcher
// (`bin/vis.mjs`) and the integration tests so there is a single source of truth
// for where the binary lives and how the platform -> binding-package target slug
// is computed (mirroring the NAPI loader matrix in `index.js`).

import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);

// Best-effort musl detection for Linux. Defaults to glibc on any uncertainty.
const isMusl = () => {
    const report = typeof process.report?.getReport === "function" ? process.report.getReport() : undefined;

    if (report && Array.isArray(report.sharedObjects)) {
        return report.sharedObjects.some((object) => object.includes("libc.musl-") || object.includes("ld-musl-"));
    }

    // Default to glibc on uncertainty (no report). musl is identified by the
    // absence of glibcVersionRuntime; matches handler.ts's copy.
    return report ? !report.header?.glibcVersionRuntime : false;
};

// Static platform+arch -> target slug table for the non-Linux targets (Linux is
// libc-dependent, so it is resolved separately).
const STATIC_TARGETS = {
    "darwin:arm64": "darwin-arm64",
    "darwin:x64": "darwin-x64",
    "win32:arm64": "win32-arm64-msvc",
    "win32:x64": "win32-x64-msvc",
};

// Compute the binding-package target slug for the current platform, or undefined
// for platforms with no published binary.
const nativeTarget = () => {
    const { arch, platform } = process;

    if (platform === "linux") {
        const libc = isMusl() ? "musl" : "gnu";

        if (arch === "arm64" || arch === "x64") {
            return `linux-${arch}-${libc}`;
        }

        return undefined;
    }

    return STATIC_TARGETS[`${platform}:${arch}`];
};

// Resolve the platform-specific `vis` binary, or undefined if none is available
// (e.g. the optional binding package was not installed for this platform).
// Resolution order, most specific first:
//   1. VIS_NATIVE_BIN env override (dev / CI / tests).
//   2. A binary placed next to the package (local `build:native:cli` output).
//   3. The matching `@visulima/vis-binding-<target>` optional dependency.
const resolveNativeBinary = (packageRoot) => {
    const override = process.env.VIS_NATIVE_BIN;

    if (override && existsSync(override)) {
        return override;
    }

    const exe = process.platform === "win32" ? "vis-native-cli.exe" : "vis-native-cli";
    const local = join(packageRoot, exe);

    if (existsSync(local)) {
        return local;
    }

    const target = nativeTarget();

    if (target === undefined) {
        return undefined;
    }

    try {
        return require.resolve(`@visulima/vis-binding-${target}/${exe}`);
    } catch {
        return undefined;
    }
};

export { nativeTarget, resolveNativeBinary };
