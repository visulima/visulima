/**
 * Security helpers (RFC §19.4) — shell quoting, log redaction, markdown escape,
 * trust-gate evaluation for custom commands.
 *
 * All pure functions. Tested individually so the security-critical paths
 * have explicit coverage rather than relying on integration-test happenstance.
 */

import zeptomatch from "zeptomatch";

import { VisReleaseError } from "../errors";
import type { PerPackageReleaseConfig, VisReleaseConfig } from "../types";

// ── Package name validation (RFC §19.4) ───────────────────────────

/**
 * RFC §19.4 / npm package-name spec: lowercase ASCII letters, digits, dots,
 * underscores, hyphens; optional `@scope/` prefix; total length ≤ 214.
 *
 * Rejecting anything outside this set is the second trust gate for shell
 * interpolation (the first is `sq()`). Even the platform packages a NAPI
 * parent publishes get validated, on the assumption that a malicious
 * dependency could land a crafted directory under `npm/&lt;name>/`.
 */
const VALID_PACKAGE_NAME = /^(?:@[a-z0-9-]{1,39}\/)?[a-z0-9._-]{1,214}$/;

export const isValidPackageName = (name: string): boolean => {
    if (typeof name !== "string" || name.length === 0 || name.length > 214) {
        return false;
    }

    if (name.startsWith(".") || name.startsWith("_")) {
        return false;
    }

    return VALID_PACKAGE_NAME.test(name);
};

export const assertValidPackageName = (name: string): void => {
    if (!isValidPackageName(name)) {
        throw new VisReleaseError({
            code: "CONFIG_INVALID",
            message: `Invalid package name: ${JSON.stringify(name)}. Must match ^(@scope/)?[a-z0-9._-]+$ and be ≤ 214 chars (npm spec).`,
            packageName: typeof name === "string" ? name : undefined,
        });
    }
};

// ── sq(): POSIX single-quote shell escape ──────────────────────────

/**
 * Wrap a string in POSIX single quotes, escaping embedded single quotes.
 * Safe to interpolate into `sh -c &lt;cmd&gt;` lines without injection risk.
 * Port of bumpy's `sq()` helper (RFC §19.4).
 * @example
 *   sq("hello")        // returns "'hello'"
 *   sq("it's fine")    // returns "'it'\\''s fine'"
 *   sq("$(rm -rf /)")  // returns "'$(rm -rf /)'"
 */
export const sq = (value: string): string => `'${value.replaceAll("'", String.raw`'\''`)}'`;

// ── Custom-command trust gate ──────────────────────────────────────

/**
 * Decide whether a per-package custom command (`publishCommand`/`buildCommand`/
 * `checkPublished`) is allowed to execute. Root config commands are ALWAYS
 * trusted (the maintainer wrote them); per-package commands need the trust gate.
 *
 * Resolution (matches bumpy): `allowCustomCommands: false` (default) never
 * runs per-package commands; `true` runs for any package; an array of globs
 * acts as an allowlist (e.g. `["@scope/*"]`).
 */
export const isCustomCommandAllowed = (
    packageName: string,
    config: VisReleaseConfig,
): boolean => {
    const gate = config.allowCustomCommands;

    if (gate === undefined || gate === false) {
        return false;
    }

    if (gate === true) {
        return true;
    }

    if (Array.isArray(gate)) {
        return gate.some((pattern) => packageName === pattern || zeptomatch(pattern, packageName));
    }

    return false;
};

/**
 * Substitute `{{name}}` / `{{version}}` / `{{tag}}` / `{{registry}}`
 * tokens in a custom command. Substituted values are shell-quoted via
 * `sq()` so a package name containing `;` or `$` can't break out of
 * its argument slot. Returns a string ready to pass to `sh -c`.
 *
 * Per RFC §19.4: NO raw concatenation. NO `eval`. Undefined optional
 * tokens substitute to the empty string — operators wanting to make a
 * token required should fail their own command (e.g. `[ -n "{{tag}}" ]`).
 */
export const interpolateCommand = (
    template: string,
    tokens: { name: string; registry?: string; tag?: string; version: string },
): string =>
    template
        .replaceAll("{{name}}", sq(tokens.name))
        .replaceAll("{{version}}", sq(tokens.version))
        .replaceAll("{{tag}}", sq(tokens.tag ?? ""))
        .replaceAll("{{registry}}", sq(tokens.registry ?? ""));

// ── OIDC / npm / GH token redaction ────────────────────────────────

// Specific patterns are applied BEFORE the generic Bearer rule so a token like
// `Bearer ghp_…` redacts only the secret and leaves the Bearer prefix intact.
// The Bearer rule (last) skips `Bearer [REDACTED]` via the negative lookahead.
const TOKEN_PATTERNS: ReadonlyArray<RegExp> = [
    /\bnpm_[A-Za-z0-9]{20,}/g,
    /\bghp_[A-Za-z0-9]{20,}/g,
    /\bgho_[A-Za-z0-9]{20,}/g,
    /\bghs_[A-Za-z0-9]{20,}/g,
    /\bghu_[A-Za-z0-9]{20,}/g,
    // GitHub fine-grained PATs — much longer suffix than classic ghp_.
    // Length ≥ 70 covers the documented format; the regex is permissive
    // on the upper bound to survive any future format extension.
    /\bgithub_pat_\w{70,}/g,
    /\bglpat-[\w-]{20,}/g, // GitLab personal access tokens
    // AWS access keys (AKIA / ASIA) — broadly used in CI for ECR /
    // S3-backed registries; appears in environments where multi-language
    // publishing exists.
    /\bAKIA[0-9A-Z]{16}\b/g,
    /\bASIA[0-9A-Z]{16}\b/g,
    // Cargo + PyPI tokens
    /\bcio[A-Za-z0-9]{40,}/g, // crates.io
    /\bpypi-AgEIcHlwaS5vcmcCJ[\w-]+/g, // PyPI tokens have a stable prefix
    /ACTIONS_ID_TOKEN_REQUEST_TOKEN=\S+/g,
    /\b_authToken=\S+/g,
    // npmrc-style HTTP Basic auth header (base64-encoded user:password)
    /\bBasic\s+[A-Za-z0-9+/=]{16,}/g,
    // npm OTP values — `--otp=123456`, `--otp 123456`, or npm's EOTP error
    // payload (`one-time password: 123456`). The numeric form is intentional
    // (npm OTPs are 6-digit TOTPs) so we don't over-redact unrelated text.
    /--otp[= ]\d{6,}/g,
    /\bone[- ]time password:?\s*\d{6,}/gi,
    /\bEOTP\s+\d{6,}/g,
    /Bearer (?!\[REDACTED\])[^\s"']+/g,
];

/**
 * Redact OIDC / npm / GH / GH-Actions tokens from arbitrary log content.
 * Replaces the matched span with `[REDACTED]`. Applied uniformly in every
 * log mode including --verbose / --debug (RFC §19.4).
 */
export const redactTokens = (text: string): string => {
    let out = text;

    for (const pattern of TOKEN_PATTERNS) {
        out = out.replaceAll(pattern, "[REDACTED]");
    }

    return out;
};

// ── Markdown escape for user-supplied content in PR comments ──────

const MARKDOWN_ESCAPE_MAP: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
};

/**
 * Escape user-supplied text before embedding in PR-comment markdown.
 * - `&lt;`/`>` → HTML entities (prevents inline-HTML injection)
 * - backticks → escaped `\``
 * - `&amp;` → `&amp;`
 *
 * Intentionally NOT escaping `*`/`_`/`#`/`-` — those are valid Markdown that
 * users may genuinely want in change-file bodies and PR descriptions.
 */
export const escapeMarkdown = (text: string): string => {
    let out = text.replaceAll(/[<>&]/g, (c) => MARKDOWN_ESCAPE_MAP[c] ?? c);

    out = out.replaceAll("`", "\\`");

    return out;
};

// ── Resolve effective per-package custom commands ─────────────────

export interface ResolvedCustomCommands {
    buildCommand?: string;
    checkPublished?: string;
    publishCommand?: string | string[];
}

/**
 * Return the per-package custom commands ONLY if the trust gate allows them.
 * If gating denies, returns an empty object (callers fall through to default
 * pack-then-publish path).
 */
export const resolveCustomCommands = (
    packageName: string,
    perPkg: PerPackageReleaseConfig,
    config: VisReleaseConfig,
): ResolvedCustomCommands => {
    if (!isCustomCommandAllowed(packageName, config)) {
        return {};
    }

    return {
        buildCommand: perPkg.buildCommand,
        checkPublished: perPkg.checkPublished,
        publishCommand: perPkg.publishCommand,
    };
};
