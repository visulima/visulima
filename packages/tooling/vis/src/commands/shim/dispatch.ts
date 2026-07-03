// PM-shim dispatch — the agreement check the `.vis/shims/<pm>` wrappers run when a
// package manager is invoked under that shim. Ported from the dropped Rust
// launcher's shim module; invoked via the lean `vis __pm-shim <name> [args]` path
// in bin.ts (no full CLI boot).
//
// Behaviour (matches the launcher): invoked as `pnpm`, check the project's pinned
// PM and either run it (match / transparent verb / runner shim / no pin), refuse
// (top-level mismatch), or fall through (nested — a running PM spawned us).
//
// node:fs / node:child_process are used directly (no toolbox in this lean path).

import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

import { dirname, join } from "@visulima/path";

// This module is the PM-shim CLI dispatch entry — exiting with the child's status
// (or 1 on refusal) is the correct termination path.
/* eslint-disable unicorn/no-process-exit -- CLI dispatch entry; mirrors the child's exit code */

type Pm = "npm" | "pnpm" | "yarn";

/** PM-shim names → their PM. `npx`/`pnpx` are runner shims (always transparent). */
const SHIM_NAMES: Record<string, { pm: Pm; runner: boolean }> = {
    npm: { pm: "npm", runner: false },
    npx: { pm: "npm", runner: true },
    pnpm: { pm: "pnpm", runner: false },
    pnpx: { pm: "pnpm", runner: true },
    yarn: { pm: "yarn", runner: false },
    yarnpkg: { pm: "yarn", runner: false },
};

// Verbs that bypass the agreement check (corepack's allowlist shape): `npm create
// vite` must work in a pnpm repo. Matched against the first positional token.
const TRANSPARENT_VERBS = new Set(["create", "dlx", "exec", "init"]);

const isFile = (path: string): boolean => {
    try {
        return statSync(path).isFile();
    } catch {
        return false;
    }
};

/** Map a `packageManager` value / lockfile to a Pm, or undefined. */
const pmFromName = (name: string): Pm | undefined => (name === "npm" || name === "pnpm" || name === "yarn" ? name : undefined);

/**
 * The project's pinned PM: the `packageManager` field (authoritative, works before
 * a lockfile) then lockfile detection. `undefined` = no pin (no opinion). Mirrors
 * the launcher's `pm::pinned` — deliberately NOT defaulting to npm.
 */
const pinnedPm = (cwd: string): Pm | undefined => {
    const lockfiles: [string, Pm][] = [
        ["pnpm-lock.yaml", "pnpm"],
        ["yarn.lock", "yarn"],
        ["package-lock.json", "npm"],
        ["npm-shrinkwrap.json", "npm"],
    ];

    let directory = cwd;

    for (;;) {
        const manifest = join(directory, "package.json");

        if (isFile(manifest)) {
            try {
                const spec = (JSON.parse(readFileSync(manifest, "utf8")) as { packageManager?: string }).packageManager;

                if (typeof spec === "string" && spec.length > 0) {
                    const pinned = pmFromName(spec.split("@")[0] as string);

                    if (pinned !== undefined) {
                        return pinned;
                    }
                }
            } catch {
                // unreadable/invalid package.json — fall through to lockfile detection
            }
        }

        for (const [file, pm] of lockfiles) {
            if (isFile(join(directory, file))) {
                return pm;
            }
        }

        const parent = dirname(directory);

        if (parent === directory) {
            return undefined;
        }

        directory = parent;
    }
};

/** `npm_config_user_agent`/`npm_execpath` present ⇒ a running PM spawned us (nested). */
const isNested = (): boolean => process.env["npm_config_user_agent"] !== undefined || process.env["npm_execpath"] !== undefined;

/**
 * Pure agreement decision (unit-tested): `dispatch` the invoked PM on match,
 * transparent verb, runner shim, or no pin; `refuse` only a top-level mismatch.
 * Unknown shim names `dispatch` (the caller errors separately).
 */
export const decideShim = (invoked: string, pinned: Pm | undefined, firstVerb: string | undefined, nested: boolean): "dispatch" | "refuse" => {
    const entry = SHIM_NAMES[invoked];

    if (entry === undefined) {
        return "dispatch";
    }

    const transparent = entry.runner || (firstVerb !== undefined && TRANSPARENT_VERBS.has(firstVerb));
    const mismatch = pinned !== undefined && entry.pm !== pinned;

    return mismatch && !transparent && !nested ? "refuse" : "dispatch";
};

/** Find the real PM on PATH, skipping any `.vis/shims` dir (the recursion guard). */
const findRealPm = (name: string): string | undefined => {
    const candidates = process.platform === "win32" ? [`${name}.cmd`, `${name}.exe`, name] : [name];

    for (const directory of (process.env["PATH"] ?? "").split(process.platform === "win32" ? ";" : ":")) {
        if (directory === "" || directory.replace(/[/\\]+$/u, "").endsWith(join(".vis", "shims"))) {
            continue;
        }

        for (const candidate of candidates) {
            const full = join(directory, candidate);

            if (isFile(full)) {
                return full;
            }
        }
    }

    return undefined;
};

/**
 * Run the shim agreement flow for `invoked` (a PM shim name) with `args`. Execs the
 * real PM (or falls through), or refuses + exits 1 on a top-level mismatch. Never
 * returns on success (the child's exit code is propagated).
 */
export const dispatchShim = (invoked: string, args: string[]): void => {
    const entry = SHIM_NAMES[invoked];

    if (entry === undefined) {
        process.stderr.write(`vis: ${invoked} is not a known package-manager shim.\n`);
        process.exit(1);
    }

    const pinned = pinnedPm(process.cwd());

    if (decideShim(invoked, pinned, args[0], isNested()) === "refuse") {
        process.stderr.write(
            `vis: this project uses ${String(pinned)}, but \`${invoked}\` was run. Use \`${String(pinned)}\` instead, or run \`vis shim uninstall\` to disable the PM guard.\n`,
        );
        process.exit(1);
    }

    const real = findRealPm(invoked);

    if (real === undefined) {
        process.stderr.write(`vis: \`${invoked}\` was not found on PATH (outside the shim dir).\n`);
        process.exit(1);
    }

    const result = spawnSync(real, args, { stdio: "inherit" });

    process.exit(result.status ?? (result.signal === null ? 0 : 1));
};
