// `vis shim` — manage the opt-in, project-local PM shim dir (`.vis/shims`). Each
// shim is a tiny wrapper script that calls `vis __pm-shim <pm>` (the agreement
// check in dispatch.ts). Opt-in and project-local: never edits global shell
// profiles, never shims `node`.
//
// NOTE: chmodSync is used from node:fs directly — `toolbox.fs` (CerebroFs) has no
// chmod op. Everything else goes through the toolbox per the repo convention.
// eslint-disable-next-line no-restricted-imports -- CerebroFs has no chmod op; required for the +x wrapper scripts
import { chmodSync } from "node:fs";
import { createRequire } from "node:module";

import type { Toolbox } from "@visulima/cerebro";
import { dirname, join } from "@visulima/path";

// The PM binaries the shim dir intercepts. `node` and `vis` are NOT shimmed.
const SHIM_NAMES = ["npm", "npx", "pnpm", "pnpx", "yarn", "yarnpkg"] as const;

const isWindows = process.platform === "win32";

const shimDirectoryFor = (toolbox: Toolbox): string => join(toolbox.process.cwd, ".vis", "shims");

// Best-effort musl detection for Linux. Keep the platform/target logic below in
// sync with bin/resolve-binary.mjs (the launcher's copy) and the NAPI loader in
// index.js. Defaults to glibc on any uncertainty.
const isMusl = (): boolean => {
    const { report } = process;

    if (typeof report?.getReport !== "function") {
        return false;
    }

    const data = report.getReport() as { header?: { glibcVersionRuntime?: string }; sharedObjects?: string[] };

    if (Array.isArray(data.sharedObjects)) {
        return data.sharedObjects.some((object) => object.includes("libc.musl-") || object.includes("ld-musl-"));
    }

    return !data.header?.glibcVersionRuntime;
};

const STATIC_TARGETS: Record<string, string> = {
    "darwin:arm64": "darwin-arm64",
    "darwin:x64": "darwin-x64",
    "win32:arm64": "win32-arm64-msvc",
    "win32:x64": "win32-x64-msvc",
};

const nativeTarget = (): string | undefined => {
    const { arch, platform } = process;

    if (platform === "linux") {
        if (arch === "arm64" || arch === "x64") {
            return `linux-${arch}-${isMusl() ? "musl" : "gnu"}`;
        }

        return undefined;
    }

    return STATIC_TARGETS[`${platform}:${arch}`];
};

// Resolve the native CLI binary so the wrapper can exec it directly (no Node boot
// on the PM-guard hot path). Mirrors `resolveNativeBinary` in
// bin/resolve-binary.mjs: VIS_NATIVE_BIN override, then a local build next to the
// package, then the matching `@visulima/vis-binding-<target>` optional dep.
// Returns undefined when no binary is available (the wrapper falls back to Node).
const resolveNativeBinary = async (toolbox: Toolbox, packageRoot: string): Promise<string | undefined> => {
    const fileExists = async (candidate: string): Promise<boolean> =>
        toolbox.fs
            .stat(candidate)
            .then(() => true)
            .catch(() => false);

    const override = process.env.VIS_NATIVE_BIN;

    if (override !== undefined && override !== "" && (await fileExists(override))) {
        return override;
    }

    const exe = isWindows ? "vis-native-cli.exe" : "vis-native-cli";
    const local = join(packageRoot, exe);

    if (await fileExists(local)) {
        return local;
    }

    const target = nativeTarget();

    if (target === undefined) {
        return undefined;
    }

    try {
        return createRequire(import.meta.url).resolve(`@visulima/vis-binding-${target}/${exe}`);
    } catch {
        return undefined;
    }
};

// Body of the wrapper for `name`. When the native CLI binary is available it is
// exec'd directly (zero Node boot); otherwise — and as a runtime fallback if the
// binary later goes missing — it runs the Node launcher with `__pm-shim`. Paths
// are resolved at install time so the wrapper is self-contained.
const wrapperBody = (node: string, launcher: string, binary: string | undefined, name: string): string => {
    if (isWindows) {
        if (binary === undefined) {
            return `@echo off\r\n"${node}" "${launcher}" __pm-shim ${name} %*\r\n`;
        }

        return `@echo off\r\nif exist "${binary}" (\r\n  "${binary}" __pm-shim ${name} %*\r\n  exit /b %errorlevel%\r\n)\r\n"${node}" "${launcher}" __pm-shim ${name} %*\r\n`;
    }

    if (binary === undefined) {
        return `#!/bin/sh\nexec "${node}" "${launcher}" __pm-shim ${name} "$@"\n`;
    }

    return `#!/bin/sh\n[ -x "${binary}" ] && exec "${binary}" __pm-shim ${name} "$@"\nexec "${node}" "${launcher}" __pm-shim ${name} "$@"\n`;
};

export const shimInstallExecute = async (toolbox: Toolbox): Promise<void> => {
    // The wrapper prefers the native binary and falls back to `<node> <launcher>
    // __pm-shim <name>`. These are runtime facts of the current process (not
    // injectable IO): the global `process.argv[1]` is vis's entry (bin/vis.mjs,
    // the launcher) — NOT `toolbox.process.argv`, which is cerebro's parsed-args
    // snapshot — and `process.execPath` is the node running us.
    const launcher = process.argv[1];

    if (launcher === undefined) {
        toolbox.console.error("vis shim install: could not resolve the vis entry path.");
        toolbox.process.exit(1);

        return;
    }

    const node = process.execPath;
    const shimDirectory = shimDirectoryFor(toolbox);

    // <packageRoot>/{bin,dist}/<entry> -> <packageRoot>. Used to locate a local
    // CLI binary build; the binding-package lookup is independent of this.
    const binary = await resolveNativeBinary(toolbox, dirname(dirname(launcher)));

    await toolbox.fs.mkdir(shimDirectory, { recursive: true });

    for (const name of SHIM_NAMES) {
        const file = join(shimDirectory, isWindows ? `${name}.cmd` : name);

        await toolbox.fs.writeFile(file, wrapperBody(node, launcher, binary, name));

        if (!isWindows) {
            chmodSync(file, 0o755);
        }
    }

    toolbox.console.log(`Installed ${String(SHIM_NAMES.length)} PM shims in ${shimDirectory}`);
    toolbox.console.log("");
    toolbox.console.log("Add the shim dir to PATH (project-local) to activate the PM guard, e.g. in .envrc:");
    toolbox.console.log(`  export PATH="${shimDirectory}:$PATH"`);
    toolbox.console.log("Remove with `vis shim uninstall`.");
};

export const shimUninstallExecute = async (toolbox: Toolbox): Promise<void> => {
    const shimDirectory = shimDirectoryFor(toolbox);

    await toolbox.fs.rm(shimDirectory, { force: true, recursive: true });

    toolbox.console.log(`Removed ${shimDirectory}.`);
    toolbox.console.log("If you added it to PATH (e.g. .envrc), remove that line too.");
};

export const shimStatusExecute = async (toolbox: Toolbox): Promise<void> => {
    const shimDirectory = shimDirectoryFor(toolbox);

    const installed = await toolbox.fs
        .stat(shimDirectory)
        .then((entry) => entry.isDirectory())
        .catch(() => false);

    if (!installed) {
        toolbox.console.log("PM shims: not installed. Run `vis shim install`.");

        return;
    }

    const missing: string[] = [];

    for (const name of SHIM_NAMES) {
        const file = join(shimDirectory, isWindows ? `${name}.cmd` : name);

        const present = await toolbox.fs
            .stat(file)
            .then(() => true)
            .catch(() => false);

        if (!present) {
            missing.push(name);
        }
    }

    const onPath = (toolbox.process.env["PATH"] ?? "").split(isWindows ? ";" : ":").includes(shimDirectory);

    toolbox.console.log(`PM shims: installed in ${shimDirectory}`);

    if (missing.length > 0) {
        toolbox.console.log(`WARNING: ${String(missing.length)} shim(s) missing (${missing.join(", ")}). Re-run \`vis shim install\`.`);
    }

    toolbox.console.log(onPath ? "PATH: active (shim dir is on PATH)." : "PATH: NOT on PATH — the guard is inactive until you add it.");
};
