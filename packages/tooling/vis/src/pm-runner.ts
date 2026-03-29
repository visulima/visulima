/**
 * Shared helper for executing package manager commands via native bindings.
 * Provides the bridge between command handlers and the Rust NAPI addon.
 */

import { spawnSync } from "node:child_process";

import { findPackageManagerSync, getPackageManagerVersion } from "@visulima/package";

import type { ResolvedCommand } from "./native-binding";
import { loadNativeBindings } from "./native-binding";

interface PmInfo {
    name: "bun" | "npm" | "pnpm" | "yarn";
    version: string;
}

const detectPm = (cwd: string): PmInfo => {
    const native = loadNativeBindings();

    if (native) {
        const detected = native.detectPackageManager(cwd);

        return { name: detected.name as PmInfo["name"], version: detected.version };
    }

    // Fallback to @visulima/package
    const { packageManager } = findPackageManagerSync(cwd);

    return {
        name: packageManager as PmInfo["name"],
        version: getPackageManagerVersion(cwd, packageManager) ?? "latest",
    };
};

const runPmCommand = (resolved: ResolvedCommand, cwd: string, interactive: boolean, logger: Console): number => {
    for (const warning of resolved.warnings) {
        logger.warn(`warning: ${warning}`);
    }

    if (interactive) {
        const native = loadNativeBindings();

        if (native) {
            return native.execPmCommandInteractive(resolved.bin, resolved.args, cwd);
        }

        // Fallback: spawnSync with inherited stdio
        const result = spawnSync(resolved.bin, resolved.args, {
            cwd,
            stdio: "inherit",
        });

        return result.status ?? 1;
    }

    const native = loadNativeBindings();

    if (native) {
        const result = native.execPmCommand(resolved.bin, resolved.args, cwd);

        if (result.stdout) {
            process.stdout.write(result.stdout);
        }

        if (result.stderr) {
            process.stderr.write(result.stderr);
        }

        return result.code;
    }

    // Fallback
    const result = spawnSync(resolved.bin, resolved.args, { cwd, stdio: "inherit" });

    return result.status ?? 1;
};

const runInteractive = (resolved: ResolvedCommand, cwd: string, logger: Console): number => runPmCommand(resolved, cwd, true, logger);

export type { PmInfo };
export { detectPm, runInteractive, runPmCommand };
