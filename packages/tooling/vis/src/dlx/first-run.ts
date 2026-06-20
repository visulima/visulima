/**
 * First-run info gate for `visx` / `vx` / `vis dlx`.
 *
 * The first time a package is executed (or whenever its resolved version
 * changes, or a new high/critical security alert appears), show an info panel
 * — install footprint, security score + alerts, declared permissions, and a
 * changelog — and ask the user to confirm before downloading and running it.
 *
 * The gate is deliberately invisible on the fast path: it does no network work
 * and never blocks when output is non-interactive (CI, piped), when `--yes`
 * is passed, or when the package was already approved with no new alerts.
 */

import { isInteractive } from "../util/interactive";
import { promptYesNo } from "../util/prompt";
import { getSeenEntry, markSeen, readDlxSeen, shouldReprompt } from "./first-run-state";
import type { PackageInfo } from "./package-info";
import { gatherPackageInfo } from "./package-info";
import { renderFirstRunPanel } from "./render-panel";

export interface FirstRunGateOptions {
    /** Force the panel even when the package was already approved. */
    forceInfo?: boolean;
    /** Test seam: pretend we are (not) running in CI. */
    isCi?: boolean;
    /** Test seam: pretend stdin is (not) a TTY. */
    isTty?: boolean;
    /** Skip the gate entirely (no panel). */
    noInfo?: boolean;
    now?: number;
    /** Offline mode — gather from cache only, skip network enrichment. */
    offline?: boolean;
    /** Where to write the panel. Defaults to stdout. */
    output?: (chunk: string) => void;
    /** The raw package argument as typed: `pkg`, `pkg@version`, `@scope/pkg@tag`. */
    pkg: string;
    /** Test seam for the y/N prompt. */
    readline?: (question: string) => Promise<string>;
    /** Socket.dev API token, when configured. */
    socketToken?: string;
    workspaceRoot?: string;
    /** Auto-approve without prompting (e.g. `--yes`). */
    yes?: boolean;
}

export interface FirstRunGateResult {
    /** False only when the user explicitly declined the prompt. */
    proceed: boolean;
}

/**
 * Split a package argument into its name and version spec.
 * @param argument A package argument such as `react`, `react@18`, or `@scope/x@tag`.
 * @returns The parsed `name` and optional version `spec`.
 */
export const parsePackageSpec = (argument: string): { name: string; spec?: string } => {
    if (argument.startsWith("@")) {
        const separator = argument.indexOf("@", 1);

        return separator === -1 ? { name: argument } : { name: argument.slice(0, separator), spec: argument.slice(separator + 1) };
    }

    const separator = argument.indexOf("@");

    return separator <= 0 ? { name: argument } : { name: argument.slice(0, separator), spec: argument.slice(separator + 1) };
};

/**
 * Whether `pkg` is a plain registry spec (`name`, `name@version`, `@scope/x@tag`).
 * The gate only understands registry packages — git URLs, tarball/file paths,
 * and `npm:`/`github:` aliases are parsed differently by the underlying runner,
 * so we skip the panel for them rather than describe the wrong thing.
 * @param pkg The raw package argument passed to `dlx`.
 * @returns `true` when `pkg` is a bare registry spec the gate can describe.
 */
export const isRegistrySpec = (pkg: string): boolean => {
    if (pkg === "" || pkg.startsWith(".") || pkg.startsWith("/") || pkg.startsWith("~")) {
        return false;
    }

    // A protocol/alias prefix (git+https:, file:, npm:, github:, https:, workspace:) — anything with a
    // colon before the optional scoped "@" — is not a bare registry name.
    const withoutScope = pkg.startsWith("@") ? pkg.slice(1) : pkg;

    return !withoutScope.includes(":");
};

/** Overall wall-clock budget for enrichment before we proceed regardless. */
const GATHER_BUDGET_MS = 6000;

const defaultWrite = (chunk: string): void => {
    process.stdout.write(chunk);
};

/**
 * Show the first-run info panel for an unseen registry package and gate on the
 * user's approval. Self-skips on the fast path (CI / non-TTY / `--yes` /
 * `--no-info` / non-registry spec / already-approved).
 * @param options Gate inputs (target package, flags, tokens, workspace root).
 * @returns `{ proceed }` — `false` only when the user explicitly declined.
 */
export const maybeGateFirstRun = async (options: FirstRunGateOptions): Promise<FirstRunGateResult> => {
    const { forceInfo = false, noInfo = false, offline = false, pkg, socketToken, workspaceRoot, yes = false } = options;

    if (noInfo || !isRegistrySpec(pkg)) {
        return { proceed: true };
    }

    const now = options.now ?? Date.now();
    const autoYes = yes || !isInteractive({ isCi: options.isCi, isTty: options.isTty });
    const write = options.output ?? defaultWrite;

    // Fast path: nothing to prompt for and no reason to force the panel — skip
    // all network work so scripted/CI `visx` stays as quick as raw npx.
    if (autoYes && !forceInfo) {
        return { proceed: true };
    }

    const { name, spec } = parsePackageSpec(pkg);

    // Enforce the budget as a hard wall-clock cap: not all enrichment work
    // (e.g. some Socket paths) is wired to the abort signal, so race the gather
    // against the timeout rather than only signalling it.
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const budget = new Promise<PackageInfo | undefined>((resolve) => {
        timeout = setTimeout(() => {
            controller.abort();
            resolve(undefined);
        }, GATHER_BUDGET_MS);
    });

    const info = await Promise.race([
        gatherPackageInfo({ name, now, offline, signal: controller.signal, socketToken, spec, workspaceRoot }).catch(() => undefined),
        budget,
    ]);

    if (timeout) {
        clearTimeout(timeout);
    }

    // Could not resolve the package — don't block; let the real runner report it.
    if (!info) {
        return { proceed: true };
    }

    const seen = getSeenEntry(readDlxSeen(), info.name, info.version);

    if (!forceInfo && !shouldReprompt(seen, info.security.highSeverityKeys)) {
        return { proceed: true };
    }

    for (const line of renderFirstRunPanel(info)) {
        write(`${line}\n`);
    }

    if (autoYes) {
        // forced panel under --yes / non-interactive: record approval, proceed.
        markSeen(info.name, info.version, info.security.highSeverityKeys, now);

        return { proceed: true };
    }

    const proceed = await promptYesNo("? Ok to proceed? (y/N) ", options.readline);

    if (proceed) {
        markSeen(info.name, info.version, info.security.highSeverityKeys, now);
    }

    return { proceed };
};
