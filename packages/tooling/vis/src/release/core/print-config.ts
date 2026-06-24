/**
 * `--printConfig` helper (port from nx release §7).
 *
 * If the active CLI invocation passed `--printConfig` (or
 * `--printConfig=debug`), print the resolved release configuration as
 * JSON and exit early. Lets users debug "why is vis release picking
 * THIS channel" without running a real version/publish.
 *
 * Default mode emits user-facing config only (the `release` block from
 * vis.config.ts merged with inline overrides + defaults). Debug mode
 * also includes runtime-resolved fields (active channel, detected
 * package manager, packages discovered, perPackageConfig map).
 */

import type { Toolbox } from "@visulima/cerebro";

import type { ReleaseGroupConfig } from "../types";
import { normaliseGroup } from "../types";
import type { OrchestratorContext } from "./orchestrator";

export interface PrintConfigOptions {
    printConfig?: boolean | string;
}

const isDebugMode = (value: unknown): boolean => value === "debug";

/**
 * Redact a `signing.key` value the same way the doctor F9 path does:
 *  - File-path-shaped keys (contain a slash OR end in a private-key
 *    extension like .pem/.gpg/.key/.asc/.p12/.pfx) → `(key: configured)`.
 *    The extension test catches cwd-local key files (e.g. `release.pem`)
 *    that would otherwise leak via the last-4 branch.
 *  - Short key ids (< 8 chars) → `(key: configured)`. The last-4 of a
 *    5-char id reveals 80% of the secret; not worth the operator hint.
 *  - Everything else → `…XXXX` (last-4 hex suffix; operators can confirm
 *    which key the daemon picked without leaking the full id).
 */
const redactSigningKey = (key: string): string => {
    if (/[\\/]/.test(key) || /\.(?:pem|gpg|key|asc|p12|pfx)$/i.test(key) || key.length < 8) {
        return "(key: configured)";
    }

    return `…${key.slice(-4)}`;
};

/**
 * Strip inline credentials and query/path tail from a URL so only the
 * `&lt;scheme>://&lt;host>` portion + a `…REDACTED…` marker survive. Webhook
 * URLs (Slack, Discord, generic) and `httpProxy` (which may carry inline
 * basic-auth like `http://user:pass@host`) flow through here before being
 * dumped to stdout.
 */
const redactUrl = (url: string): string => {
    try {
        const parsed = new URL(url);

        // Drop any inline `user[:pass]@` credentials.
        parsed.username = "";
        parsed.password = "";

        const tail = parsed.pathname !== "" && parsed.pathname !== "/" ? "/…REDACTED…" : "";

        return `${parsed.origin}${tail}`;
    } catch {
        // Non-parseable URL — fall back to a regex strip of inline auth.
        // Better to swallow detail than to leak the raw string.
        return url.replace(/(:\/\/)[^@/]+@/, "$1") || "[REDACTED]";
    }
};

/**
 * Redact every header value — header names are usually fine
 * (`Authorization`, `X-Api-Key`) but the values are the secret.
 */
const redactHeaders = (headers: Record<string, string> | undefined): Record<string, string> | undefined => {
    if (!headers) {
        return headers;
    }

    const out: Record<string, string> = {};

    for (const key of Object.keys(headers)) {
        out[key] = "[REDACTED]";
    }

    return out;
};

/**
 * Deep-clone the resolved config + redact every field that may carry a
 * credential / PII before it lands in stdout. Mirrors the doctor F9
 * redaction so the two debug surfaces stay consistent.
 */
const redactSecrets = (config: OrchestratorContext["config"]): OrchestratorContext["config"] => {
    // Structured clone preserves all serialisable values (arrays, plain
    // objects) and is a no-op for primitives. Anything non-cloneable in
    // the config tree is an upstream bug and surfaces loudly.
    const clone = structuredClone(config);

    if (clone.signing?.key) {
        clone.signing = { ...clone.signing, key: redactSigningKey(clone.signing.key) };
    }

    if (clone.httpProxy) {
        clone.httpProxy = redactUrl(clone.httpProxy);
    }

    if (clone.notifications) {
        const n = clone.notifications;
        const redactSlack = (s: { webhook: string }) => {
            return { ...s, webhook: redactUrl(s.webhook) };
        };
        const redactDiscord = (d: { webhook: string }) => {
            return { ...d, webhook: redactUrl(d.webhook) };
        };
        const redactWebhook = (w: { headers?: Record<string, string>; url: string }) => {
            return {
                ...w,
                headers: redactHeaders(w.headers),
                url: redactUrl(w.url),
            };
        };

        if (n.slack) {
            n.slack = Array.isArray(n.slack) ? n.slack.map((s) => redactSlack(s)) : redactSlack(n.slack);
        }

        if (n.discord) {
            n.discord = Array.isArray(n.discord) ? n.discord.map((d) => redactDiscord(d)) : redactDiscord(n.discord);
        }

        if (n.webhook) {
            n.webhook = Array.isArray(n.webhook) ? n.webhook.map((w) => redactWebhook(w)) : redactWebhook(n.webhook);
        }
    }

    return clone;
};

/**
 * Normalise a `fixed` / `linked` array (mixed legacy `string[]` and new
 * `ReleaseGroupConfig` object shape post wave-4 grouped-changelog work)
 * into a consistent object form for `--print-config` output. Keeps the
 * dump readable and unambiguous regardless of which shape the operator
 * wrote in `vis.config.ts`.
 */
const normaliseGroupsForPrint = (groups: ReleaseGroupConfig[] | undefined): ReturnType<typeof normaliseGroup>[] | undefined => {
    if (!groups) {
        return groups;
    }

    return groups.map((g) => normaliseGroup(g));
};

/**
 * Returns true if --printConfig was requested AND the resolved config
 * was printed (caller should exit early). Returns false otherwise so the
 * normal command flow can proceed.
 */
export const printConfigIfRequested = <O extends PrintConfigOptions & Record<string, unknown>>(
    options: O,
    context: OrchestratorContext,
    // Kept on the signature so callers don't have to drop it; we intentionally write to stdout directly for clean JSON output.
    _logger: Toolbox<Console, O>["logger"],
): boolean => {
    const value = options.printConfig;

    if (value === undefined || value === false || value === "") {
        return false;
    }

    const debug = isDebugMode(value);

    // Deep-clone + redact every credential-bearing field BEFORE we
    // shape the output object. Mirrors doctor F9 so the two debug
    // surfaces never diverge on what counts as a secret.
    const config = redactSecrets(context.config);

    // Redact the configured author email — it's PII when this output gets
    // captured in a CI log. Name is kept (it's published in commits anyway).
    const safeGitUser = config.gitUser ? { ...config.gitUser, email: config.gitUser.email ? "[REDACTED]" : config.gitUser.email } : config.gitUser;

    const out: Record<string, unknown> = {
        access: config.access,
        aggregateRelease: config.aggregateRelease,
        allowCustomCommands: config.allowCustomCommands,
        // Always: user-facing config
        baseBranch: config.baseBranch,
        bumpDevDependencies: config.bumpDevDependencies,
        bumpMinorPreMajor: config.bumpMinorPreMajor,
        bumpPatchForMinorPreMajor: config.bumpPatchForMinorPreMajor,
        changelog: config.changelog,
        changesDir: config.changesDir,
        channels: config.channels,
        defaultManaged: config.defaultManaged,
        detectCatalogChanges: config.detectCatalogChanges,
        // Mixed legacy + new shape — normalise so `fixed` / `linked` always
        // appear as `{ packages, changelog, name? }` objects regardless of
        // which form the operator wrote (changesets #1059 parity wave-4).
        fixed: normaliseGroupsForPrint(config.fixed),
        floatingMajorTag: config.floatingMajorTag,
        githubHost: config.githubHost,
        gitlabHost: config.gitlabHost,
        gitUser: safeGitUser,
        httpProxy: config.httpProxy,
        ignore: config.ignore,
        include: config.include,
        linked: normaliseGroupsForPrint(config.linked),
        notifications: config.notifications,
        postPublishCommand: config.postPublishCommand,
        postVersionCommand: config.postVersionCommand,
        prePublishCommand: config.prePublishCommand,
        preVersionCommand: config.preVersionCommand,
        privatePackages: config.privatePackages,
        provider: config.provider,
        // `publish` already serialises addReleases + releaseAssets nested
        // inside its blob — don't duplicate them at the top level (and the
        // old top-level `addReleases` was always undefined, since it only
        // exists under PublishConfig).
        publish: config.publish,
        releaseNoteTemplate: config.releaseNoteTemplate,
        releaseTagPattern: config.releaseTagPattern,
        signing: config.signing,
        snapshot: config.snapshot,
        successWalk: config.successWalk,
        updateInternalDependencies: config.updateInternalDependencies,
        versionPr: config.versionPr,
    };

    if (debug) {
        out["__resolved__"] = {
            branch: context.branch,
            channel: context.channel,
            cwd: context.cwd,
            packageCount: context.packages.length,
            packageManager: context.pm.id,
            packageNames: context.packages.map((p) => p.name).sort(),
            perPackageConfigKeys: [...context.perPackageConfig.keys()].sort(),
        };
    }

    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);

    return true;
};

/** Cerebro option spec — drop into any release command's `options` array. */
export const printConfigOption = {
    description: "Print the resolved release config (with `=debug` for runtime-resolved fields) and exit",
    name: "print-config",
    type: String,
} as const;
