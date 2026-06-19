// `vis shim` — manage the opt-in, project-local PM shim dir (`.vis/shims`). Each
// shim is a tiny wrapper script that calls `vis __pm-shim <pm>` (the agreement
// check in dispatch.ts). Opt-in and project-local: never edits global shell
// profiles, never shims `node`.
//
// NOTE: chmodSync is used from node:fs directly — `toolbox.fs` (CerebroFs) has no
// chmod op. Everything else goes through the toolbox per the repo convention.
// eslint-disable-next-line no-restricted-imports -- CerebroFs has no chmod op; required for the +x wrapper scripts
import { chmodSync } from "node:fs";

import type { Toolbox } from "@visulima/cerebro";
import { join } from "@visulima/path";

// The PM binaries the shim dir intercepts. `node` and `vis` are NOT shimmed.
const SHIM_NAMES = ["npm", "npx", "pnpm", "pnpx", "yarn", "yarnpkg"] as const;

const isWindows = process.platform === "win32";

const shimDirectoryFor = (toolbox: Toolbox): string => join(toolbox.process.cwd, ".vis", "shims");

/**
 * Body of the wrapper for `name`: invokes `&lt;node> &lt;bin.js> __pm-shim &lt;name> &lt;args>`.
 * `node`/`bin.js` are resolved at install time so the wrapper is self-contained.
 */
const wrapperBody = (node: string, binJs: string, name: string): string => {
    if (isWindows) {
        return `@echo off\r\n"${node}" "${binJs}" __pm-shim ${name} %*\r\n`;
    }

    return `#!/bin/sh\nexec "${node}" "${binJs}" __pm-shim ${name} "$@"\n`;
};

export const shimInstallExecute = async (toolbox: Toolbox): Promise<void> => {
    // The wrapper invokes `<node> <vis-entry> __pm-shim <name>`. These are runtime
    // facts of the current process (not injectable IO): the global `process.argv[1]`
    // is vis's entry (dist/bin.js) — NOT `toolbox.process.argv`, which is cerebro's
    // parsed-args snapshot — and `process.execPath` is the node running us.
    const binJs = process.argv[1];

    if (binJs === undefined) {
        toolbox.console.error("vis shim install: could not resolve the vis entry path.");
        toolbox.process.exit(1);

        return;
    }

    const node = process.execPath;
    const shimDirectory = shimDirectoryFor(toolbox);

    await toolbox.fs.mkdir(shimDirectory, { recursive: true });

    for (const name of SHIM_NAMES) {
        const file = join(shimDirectory, isWindows ? `${name}.cmd` : name);

        await toolbox.fs.writeFile(file, wrapperBody(node, binJs, name));

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
