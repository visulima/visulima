/**
 * Detect which package manager a workspace uses (RFC §11.3).
 *
 * Resolution order (matches bumpy):
 *   1. `package.json#packageManager` field (Corepack hint) — if `pnpm@…`/`yarn@…`/`bun@…`/`npm@…`, take it.
 *   2. Lockfile presence:
 *      - bun.lock / bun.lockb → bun
 *      - pnpm-lock.yaml → pnpm
 *      - yarn.lock → yarn (Berry/v4 — verify via `.yarnrc.yml`)
 *      - package-lock.json or none → npm
 */

import { BunAdapter } from "./bun";
import type { CommandRunner, PackageManagerAdapter } from "./interface";
import { NpmAdapter } from "./npm";
import { PnpmAdapter } from "./pnpm";
import { YarnAdapter } from "./yarn";

export type PackageManagerId = "npm" | "pnpm" | "yarn" | "bun";

export const detectPackageManager = async (cwd: string, _runner: CommandRunner): Promise<PackageManagerId> => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");

    // 1. Corepack `packageManager` field.
    try {
        const root = JSON.parse(await fs.readFile(path.join(cwd, "package.json"), "utf8")) as {
            packageManager?: string;
        };

        if (typeof root.packageManager === "string") {
            const at = root.packageManager.indexOf("@");
            const name = (at > 0 ? root.packageManager.slice(0, at) : root.packageManager) as PackageManagerId;

            if (name === "pnpm" || name === "yarn" || name === "bun" || name === "npm") {
                return name;
            }
        }
    } catch {
        // ignore
    }

    // 2. Lockfile presence.
    const exists = async (p: string): Promise<boolean> => {
        try {
            await fs.access(path.join(cwd, p));

            return true;
        } catch {
            return false;
        }
    };

    if (await exists("bun.lock")) {
        return "bun";
    }

    if (await exists("bun.lockb")) {
        return "bun";
    }

    if (await exists("pnpm-lock.yaml")) {
        return "pnpm";
    }

    // A `pnpm-workspace.yaml` unambiguously marks a pnpm workspace even before a
    // lockfile exists (fresh/greenfield repos, test fixtures). Detecting pnpm here
    // means callers don't need a `packageManager` field just to be recognised —
    // which avoids triggering corepack version resolution/downloads for a pinned
    // version (a source of Windows-CI hangs when probing the PM).
    if (await exists("pnpm-workspace.yaml")) {
        return "pnpm";
    }

    if (await exists("yarn.lock")) {
        return "yarn";
    }

    return "npm";
};

export const createAdapter = (id: PackageManagerId, runner: CommandRunner): PackageManagerAdapter => {
    switch (id) {
        case "bun": {
            return new BunAdapter(runner);
        }
        case "pnpm": {
            return new PnpmAdapter(runner);
        }
        case "yarn": {
            return new YarnAdapter(runner);
        }
        default: {
            return new NpmAdapter(runner);
        }
    }
};
