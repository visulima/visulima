/**
 * Subcommand dispatch table for `vis pm <sub>`.
 *
 * The native (Rust) resolver handles per-PM mechanics for a small set of
 * subcommands (`cache`, `view/info`, `list/ls`, `pack`, plus the always-npm
 * group `deprecate/fund/ping/search/token`). Everything else falls through
 * to a bare `<pm> <sub> <args>` invocation, which silently mis-fires when:
 *
 *   - the subcommand was removed from a PM (pnpm 11 dropped `whoami`,
 *     `owner`, `ping`, `search`, `token`);
 *   - the PM never had it (`bun login`, `deno owner`, `yarn 1 plugin`);
 *   - the PM has it but under a different namespace (yarn berry's
 *     `yarn npm <sub>`, bun's `bun pm <sub>`).
 *
 * This module turns a `(pm, version, subcommand, args)` tuple into one of:
 *
 *   - `passthrough` — let the native resolver handle it (the right call
 *     for `cache`, `view`, `pack`, `install`, `add`, etc., which the
 *     native side already models, and for the npm-only group which the
 *     native side already routes to npm).
 *   - `rewrite` — execute a different command instead (e.g. `yarn npm
 *     whoami` for yarn berry, `npm whoami` for pnpm 11), optionally with
 *     a warning explaining the substitution.
 *   - `skip` — do not run anything; emit a warning and return exit 0.
 *     Used when there is no sensible fallback (e.g. `vis pm plugin list`
 *     under npm).
 *
 * Sources for the support matrix:
 *   - pnpm v11 CHANGELOG (commands removed: owner, ping, search, token,
 *     whoami; reimplemented natively: publish, login, logout, view,
 *     deprecate, dist-tag, version)
 *   - yarn berry CLI docs (registry ops live under `yarn npm <sub>`;
 *     `yarn npm tag` uses `remove`, not `rm`)
 *   - bun pm docs (whoami/cache/pack/ls live under `bun pm <sub>`)
 *   - deno CLI (no registry-auth surface; JSR uses browser OAuth)
 */

import { coerce, gte } from "semver";

import type { InstallerInfo } from "./pm-runner";

export type DispatchAction =
    | { args: string[]; bin: string; kind: "rewrite"; warning?: string }
    | { kind: "passthrough" }
    | { kind: "skip"; warning: string };

const isPnpm11Plus = (version: string): boolean => {
    const coerced = coerce(version);

    return coerced ? gte(coerced, "11.0.0") : false;
};

const isYarnBerry = (pm: Pick<InstallerInfo, "name" | "version">): boolean => pm.name === "yarn" && !pm.version.startsWith("1.");

const isYarn1 = (pm: Pick<InstallerInfo, "name" | "version">): boolean => pm.name === "yarn" && pm.version.startsWith("1.");

/**
 * yarn berry's `yarn npm tag` uses `remove` where npm/yarn1 use `rm`.
 * Rewrite the first arg only — leaves `add`/`list` untouched.
 */
const rewriteRmToRemove = (args: string[]): string[] => (args[0] === "rm" ? ["remove", ...args.slice(1)] : args);

/**
 * Determine how `vis pm <subcommand> <args>` should be executed for this PM.
 * Pure function — exported for unit testing. Aube is never passed in here;
 * callers short-circuit aube to its own resolver before consulting this.
 */
export const dispatchSubcommand = (
    pm: Pick<InstallerInfo, "name" | "version">,
    subcommand: string,
    args: string[],
): DispatchAction => {
    switch (subcommand) {
        case "audit": {
            // yarn berry: registry-side audit is `yarn npm audit`; bare
            // `yarn audit` doesn't exist in berry. Every other PM has a
            // top-level `audit` (npm, pnpm, yarn1, bun, deno).
            if (isYarnBerry(pm)) {
                return { args: ["npm", "audit", ...args], bin: "yarn", kind: "rewrite" };
            }

            return { kind: "passthrough" };
        }

        case "config": {
            // yarn berry uses `config unset` instead of `config delete`.
            // bun has no config CLI; deno has no registry-config CLI.
            if (isYarnBerry(pm)) {
                const [sub, ...rest] = args;

                if (sub === "delete") {
                    return {
                        args: ["config", "unset", ...rest],
                        bin: "yarn",
                        kind: "rewrite",
                        warning: "yarn berry uses `config unset`, not `config delete`.",
                    };
                }

                return { kind: "passthrough" };
            }

            if (pm.name === "bun") {
                return { kind: "skip", warning: "bun has no `config` CLI. Edit bunfig.toml or .npmrc directly." };
            }

            if (pm.name === "deno") {
                return { kind: "skip", warning: "deno has no registry-config CLI. Edit deno.json directly." };
            }

            return { kind: "passthrough" };
        }

        case "dist-tag": {
            // yarn 1 spells it `yarn tag` and accepts `add`/`rm`/`list`
            // verbatim (no `remove` translation). yarn berry uses
            // `yarn npm tag` and requires `remove` instead of `rm`.
            if (isYarn1(pm)) {
                return {
                    args: ["tag", ...args],
                    bin: "yarn",
                    kind: "rewrite",
                    warning: "yarn 1 has no `dist-tag`; using `yarn tag`.",
                };
            }

            if (isYarnBerry(pm)) {
                return { args: ["npm", "tag", ...rewriteRmToRemove(args)], bin: "yarn", kind: "rewrite" };
            }

            if (pm.name === "bun" || pm.name === "deno") {
                return { kind: "skip", warning: `${pm.name} has no \`dist-tag\`. Use \`npm dist-tag\` instead.` };
            }

            return { kind: "passthrough" };
        }

        case "login":
        case "logout": {
            if (isYarnBerry(pm)) {
                return { args: ["npm", subcommand, ...args], bin: "yarn", kind: "rewrite" };
            }

            if (pm.name === "bun") {
                return {
                    args: [subcommand, ...args],
                    bin: "npm",
                    kind: "rewrite",
                    warning: `bun has no \`${subcommand}\`; falling back to \`npm ${subcommand}\` (writes ~/.npmrc, which bun reads).`,
                };
            }

            if (pm.name === "deno") {
                return { kind: "skip", warning: `deno has no \`${subcommand}\`. JSR uses browser OAuth via \`deno publish\`.` };
            }

            return { kind: "passthrough" };
        }

        case "owner": {
            if (pm.name === "pnpm" && isPnpm11Plus(pm.version)) {
                return {
                    args: ["owner", ...args],
                    bin: "npm",
                    kind: "rewrite",
                    warning: "pnpm 11 removed `owner`; falling back to `npm owner`.",
                };
            }

            if (isYarnBerry(pm)) {
                return {
                    args: ["owner", ...args],
                    bin: "npm",
                    kind: "rewrite",
                    warning: "yarn berry has no `owner` (not in `yarn npm`); falling back to `npm owner`.",
                };
            }

            if (pm.name === "bun") {
                return {
                    args: ["owner", ...args],
                    bin: "npm",
                    kind: "rewrite",
                    warning: "bun has no `owner`; falling back to `npm owner`.",
                };
            }

            if (pm.name === "deno") {
                return { kind: "skip", warning: "deno has no `owner`. JSR uses scope-member roles via the web UI." };
            }

            return { kind: "passthrough" };
        }

        case "ping": {
            // pnpm 11 removed `ping`. The native resolver's npm-only list
            // already routes ping to npm for everyone — but pre-v11 pnpm
            // re-implemented ping on top of npm. Keep behaviour parity by
            // handling the v11 case explicitly here; everyone else falls
            // through to the native resolver's npm dispatch.
            if (pm.name === "pnpm" && isPnpm11Plus(pm.version)) {
                return {
                    args: ["ping", ...args],
                    bin: "npm",
                    kind: "rewrite",
                    warning: "pnpm 11 removed `ping`; falling back to `npm ping`.",
                };
            }

            return { kind: "passthrough" };
        }

        case "plugin": {
            // yarn berry is the only PM with a plugin subcommand. For
            // everyone else there is no useful npm fallback — emit a
            // warning and skip cleanly.
            if (isYarnBerry(pm)) {
                return { kind: "passthrough" };
            }

            return { kind: "skip", warning: `${pm.name} does not support yarn-style plugins. Skipping (no-op).` };
        }

        case "prune": {
            if (isYarn1(pm)) {
                return { kind: "skip", warning: "yarn 1 has no `prune`. Use `yarn install --production` for a prod-only tree." };
            }

            if (isYarnBerry(pm)) {
                return { kind: "skip", warning: "yarn berry has no `prune`. Use `yarn workspaces focus --production` instead." };
            }

            if (pm.name === "bun" || pm.name === "deno") {
                return { kind: "skip", warning: `${pm.name} has no \`prune\`. Pruning happens automatically on install.` };
            }

            return { kind: "passthrough" };
        }

        case "publish": {
            if (isYarnBerry(pm)) {
                return { args: ["npm", "publish", ...args], bin: "yarn", kind: "rewrite" };
            }

            return { kind: "passthrough" };
        }

        case "rebuild": {
            if (isYarn1(pm)) {
                return { kind: "skip", warning: "yarn 1 has no `rebuild`. Re-install instead." };
            }

            if (pm.name === "bun") {
                return { kind: "skip", warning: "bun has no `rebuild`. Use `bun install --force` instead." };
            }

            if (pm.name === "deno") {
                return { kind: "skip", warning: "deno has no `rebuild`." };
            }

            return { kind: "passthrough" };
        }

        case "search": {
            if (pm.name === "pnpm" && isPnpm11Plus(pm.version)) {
                return {
                    args: ["search", ...args],
                    bin: "npm",
                    kind: "rewrite",
                    warning: "pnpm 11 removed `search`; falling back to `npm search`.",
                };
            }

            // yarn berry has interactive search via the `interactive-tools`
            // plugin (`yarn search`); keep passthrough so users can opt in.
            return { kind: "passthrough" };
        }

        case "token": {
            if (pm.name === "pnpm" && isPnpm11Plus(pm.version)) {
                return {
                    args: ["token", ...args],
                    bin: "npm",
                    kind: "rewrite",
                    warning: "pnpm 11 removed `token`; falling back to `npm token`.",
                };
            }

            return { kind: "passthrough" };
        }

        case "whoami": {
            if (pm.name === "pnpm" && isPnpm11Plus(pm.version)) {
                return {
                    args: ["whoami", ...args],
                    bin: "npm",
                    kind: "rewrite",
                    warning: "pnpm 11 removed `whoami`; falling back to `npm whoami`.",
                };
            }

            if (isYarnBerry(pm)) {
                return { args: ["npm", "whoami", ...args], bin: "yarn", kind: "rewrite" };
            }

            if (pm.name === "bun") {
                return { args: ["pm", "whoami", ...args], bin: "bun", kind: "rewrite" };
            }

            if (pm.name === "deno") {
                return { kind: "skip", warning: "deno has no `whoami`. JSR uses browser auth." };
            }

            return { kind: "passthrough" };
        }

        default: {
            return { kind: "passthrough" };
        }
    }
};
