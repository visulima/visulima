// `vis shim` — manage the opt-in, project-local PM shim dir (`.vis/shims`). The
// shims are symlinks to the native launcher binary; when that binary is invoked
// under a PM name it runs the agreement check (see launcher/src/shim.rs). This is
// opt-in and project-local by design: it never edits global shell profiles and
// never shims `node` (node routing is ephemeral + run-scoped, a separate concern).
//
// NOTE: link/copy/symlink ops come from node:fs directly — `toolbox.fs`
// (CerebroFs) exposes only a small async subset and has no link op. Everything
// else goes through the toolbox per the repo convention.
// eslint-disable-next-line no-restricted-imports -- CerebroFs has no symlink/hardlink op; these are required and have no toolbox equivalent (documented in the header note)
import { copyFileSync, existsSync, linkSync, symlinkSync } from "node:fs";
import { createRequire } from "node:module";

import type { Toolbox } from "@visulima/cerebro";
import { join } from "@visulima/path";

// The PM binaries the shim dir intercepts — MUST match launcher/src/shim.rs's
// `ShimName`. `node` and `vis` are deliberately NOT shimmed.
const SHIM_NAMES = ["npm", "npx", "pnpm", "pnpx", "yarn", "yarnpkg"] as const;

const isWindows = process.platform === "win32";

/**
 * Create one shim that, when invoked, runs the launcher with argv0 = the shim name
 * (that's what the agreement check keys on). On Unix that's a symlink; on Windows,
 * where unprivileged symlinks fail and a `.cmd` wrapper wouldn't preserve argv0, we
 * hardlink the launcher to `&lt;name>.exe` (falling back to a copy across volumes) so
 * the invoked filename IS the PM name.
 */
const createShim = (launcher: string, shimDirectory: string, name: string): string => {
    const linkPath = join(shimDirectory, isWindows ? `${name}.exe` : name);

    if (isWindows) {
        try {
            linkSync(launcher, linkPath);
        } catch {
            copyFileSync(launcher, linkPath);
        }
    } else {
        symlinkSync(launcher, linkPath);
    }

    return linkPath;
};

/** The platform package suffix for `@visulima/vis-launcher-&lt;target>`. */
const platformTarget = (platform: string, arch: string): string | undefined => {
    if (platform === "win32") {
        return `win32-${arch}-msvc`;
    }

    if (platform === "darwin") {
        return `darwin-${arch}`;
    }

    if (platform === "linux") {
        const report = typeof process.report?.getReport === "function" ? process.report.getReport() : undefined;
        const isGlibc = Boolean(report && (report as { header?: { glibcVersionRuntime?: string } }).header?.glibcVersionRuntime);

        return `linux-${arch}-${isGlibc ? "gnu" : "musl"}`;
    }

    return undefined;
};

/**
 * Resolve the native launcher binary to symlink. `VIS_LAUNCHER_PATH` wins (dev +
 * tests); otherwise the per-platform optional package. `undefined` when neither is
 * available — the PM shim needs the native binary, so the caller errors clearly.
 */
const resolveLauncher = (toolbox: Toolbox): string | undefined => {
    const fromEnv = toolbox.process.env["VIS_LAUNCHER_PATH"];

    if (fromEnv !== undefined && fromEnv !== "") {
        return fromEnv;
    }

    const target = platformTarget(toolbox.process.platform, toolbox.process.arch);

    if (target === undefined) {
        return undefined;
    }

    try {
        const requireFromHere = createRequire(import.meta.url);
        const packageJson = requireFromHere.resolve(`@visulima/vis-launcher-${target}/package.json`);
        const binaryName = toolbox.process.platform === "win32" ? "vis.exe" : "vis";

        return join(packageJson.replace(/package\.json$/, ""), "bin", binaryName);
    } catch {
        return undefined;
    }
};

const shimDirectoryFor = (toolbox: Toolbox): string => join(toolbox.process.cwd, ".vis", "shims");

export const shimInstallExecute = async (toolbox: Toolbox): Promise<void> => {
    const launcher = resolveLauncher(toolbox);

    if (launcher === undefined) {
        toolbox.console.error(
            "vis shim install needs the native launcher binary, which isn't installed for this platform. "
            + "Install the platform package, or set VIS_LAUNCHER_PATH to the binary (dev).",
        );
        toolbox.process.exit(1);

        return;
    }

    const shimDirectory = shimDirectoryFor(toolbox);

    await toolbox.fs.mkdir(shimDirectory, { recursive: true });

    for (const name of SHIM_NAMES) {
        // Replace any existing entry (both extensions) so re-running install
        // repoints stale links.
        await toolbox.fs.rm(join(shimDirectory, name), { force: true });
        await toolbox.fs.rm(join(shimDirectory, `${name}.exe`), { force: true });
        createShim(launcher, shimDirectory, name);
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

    // existsSync follows symlinks, so a dangling link (launcher moved/removed) is
    // reported false — surface it rather than claim the guard is healthy.
    const dangling = SHIM_NAMES.filter((name) => !existsSync(join(shimDirectory, isWindows ? `${name}.exe` : name)));

    const onPath = (toolbox.process.env["PATH"] ?? "").split(/[:;]/).includes(shimDirectory);

    toolbox.console.log(`PM shims: installed in ${shimDirectory}`);

    if (dangling.length > 0) {
        toolbox.console.log(`WARNING: ${dangling.length} shim(s) point at a missing launcher (${dangling.join(", ")}). Re-run \`vis shim install\`.`);
    }

    toolbox.console.log(onPath ? "PATH: active (shim dir is on PATH)." : "PATH: NOT on PATH — the guard is inactive until you add it.");
};
