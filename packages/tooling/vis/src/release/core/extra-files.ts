/**
 * Apply `extra-files` rules — bump version strings in arbitrary files
 * alongside `package.json`.
 *
 * Two rule shapes, discriminated by `type`:
 *
 *   1. **`type: "regex"` (default)** — `String.prototype.replace` against
 *      `new RegExp(rule.search, rule.flags ?? "g")`. The `rule.replace`
 *      template substitutes `{version}` literally before standard regex
 *      backreference expansion (`$1`, `$2`, `$&amp;`).
 *
 *   2. **`type: "annotation"`** — release-please parity. The operator
 *      drops an `x-release-please-version` marker comment in the target
 *      file; vis locates the semver-shaped substring on the marked line
 *      (or the next line if the marker sits on its own line) and
 *      replaces it with the new version. Far more ergonomic for the
 *      common case of "bump this version string here, no regex
 *      required".
 *
 * Failures fall into three buckets:
 *   - file absent → return a `warning` entry; don't throw (the file
 *     might be optional, or the rule might apply to a sibling
 *     workspace's path)
 *   - regex invalid → throw `CONFIG_INVALID` at validation time
 *   - regex matched zero times / annotation marker not found /
 *     marker present but no version on the marked line → `warning`
 *     (likely a stale rule)
 *
 * The orchestrator surfaces warnings via `plan.warnings`.
 */

import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

import { VisReleaseError } from "../errors";
import type { ExtraFileAnnotationRule, ExtraFileRegexRule, ExtraFileRule } from "../types";

export interface ExtraFileWrite {
    /** Absolute path the new content should be written to. */
    content: string;
    path: string;
    rule: ExtraFileRule;
}

export interface ExtraFileResult {
    warnings: string[];
    writes: ExtraFileWrite[];
}

/** Default marker for annotation-comment rules — release-please compatibility. */
export const DEFAULT_ANNOTATION_MARKER = "x-release-please-version";

/**
 * Type guards. The `type` field is optional on regex rules (legacy
 * configs in the wild predate the discriminator), so we can't blindly
 * `rule.type === "regex"` — undefined means regex.
 */
const isAnnotationRule = (rule: ExtraFileRule): rule is ExtraFileAnnotationRule => rule.type === "annotation";
const isRegexRule = (rule: ExtraFileRule): rule is ExtraFileRegexRule => !isAnnotationRule(rule);

/**
 * Validate a regex rule at config-load time. Returns a compiled RegExp
 * ready for the apply phase, or throws `CONFIG_INVALID` with the rule's
 * coordinates so the operator can fix the source.
 */
export const compileRule = (rule: ExtraFileRule, source: string): RegExp => {
    if (!isRegexRule(rule)) {
        throw new VisReleaseError({
            code: "CONFIG_INVALID",
            message: `extra-files rule at ${source} has type="${rule.type}" — compileRule is regex-only.`,
        });
    }

    try {
        return new RegExp(rule.search, rule.flags ?? "g");
    } catch (error) {
        throw new VisReleaseError({
            cause: error,
            code: "CONFIG_INVALID",
            message: `Invalid extra-files regex at ${source}.search: ${(error as Error).message}`,
        });
    }
};

/**
 * Pre-expand the user template's literal tokens. Standard regex
 * backreferences (`$1`, `$2`, `$&amp;`) are NOT expanded here; instead they are
 * handled by `String.prototype.replace`'s callback to keep capture-group
 * semantics intact even when the replace template is non-trivial.
 *
 * Tokens:
 *   - `{version}`     — new version literal
 *   - `{name}`        — package name (e.g. `@scope/foo`)
 *   - `{packageName}` — alias for `{name}` (release-please parity).
 */
const expandTemplate = (template: string, newVersion: string, packageName: string): string =>
    template
        .replaceAll("{version}", newVersion)
        .replaceAll("{name}", packageName)
        .replaceAll("{packageName}", packageName);

/**
 * Semver-shaped substring detector. Used by the annotation path to
 * locate the version on the marked line. Captures relaxed semver — the
 * standard `MAJOR.MINOR.PATCH` plus optional `-prerelease`/`+build`
 * suffixes. Anchorless on purpose: the version may sit inside a string
 * literal, a quoted attribute, an env value, etc.
 *
 * NOTE: a bare `1.2` will NOT match (we need 3 segments) — this avoids
 * accidentally replacing version-like substrings that aren't actually
 * the package version (e.g. node engines `"node": ">=14.0"`).
 *
 * NOTE 2: this matches the FIRST semver substring on the line. Files
 * with multiple version-shaped substrings (lockfiles, Dockerfiles
 * referencing both APP_VERSION and a base-image tag) should set
 * `anchor:` on the rule — see {@link ExtraFileAnnotationRule#anchor}.
 */
const SEMVER_REGEX = /\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?/;

/**
 * Locate the semver substring to replace on `line`. When `anchor` is
 * provided, the search starts AFTER the anchor's first occurrence on
 * the line — every semver substring before the anchor is ignored, so
 * a `package-lock.json` rule with `anchor: '"name": "@scope/foo"'`
 * skips nested-dep version strings until it finds the package's own
 * `"version"` line.
 *
 * Returns `undefined` when the anchor is set but absent, or when no
 * semver substring exists in the searched span.
 */
const findSemverOnLine = (
    line: string,
    anchor: string | undefined,
): { index: number; match: string } | undefined => {
    let searchStart = 0;

    if (anchor !== undefined) {
        const anchorIndex = line.indexOf(anchor);

        if (anchorIndex === -1) {
            return undefined;
        }

        searchStart = anchorIndex + anchor.length;
    }

    const slice = line.slice(searchStart);
    const m = SEMVER_REGEX.exec(slice);

    if (!m) {
        return undefined;
    }

    return { index: searchStart + m.index, match: m[0] };
};

/**
 * Run a single annotation-comment rule against the file's lines.
 * Returns the rewritten content + a flag indicating whether a
 * substitution happened. Two placements supported:
 *
 *   1. Inline — marker on the same line as the version:
 *      `export const VERSION = "0.1.0"; // x-release-please-version`
 *      → replace the semver substring on that same line.
 *
 *   2. Preceding-line — marker on the line just above the version:
 *      `# x-release-please-version`
 *      `ENV APP_VERSION="0.1.0"`
 *      → replace the semver substring on the next line.
 *
 * "Marker on its own line" is detected heuristically: the marker
 * substring lives in a line whose non-marker, non-comment content is
 * empty (so `# x-release-please-version` or `// x-release-please-
 * version` qualifies but `ENV X="1" # x-release-please-version` does
 * not — the latter is inline).
 *
 * Multiple occurrences of the marker in one file are all rewritten in
 * a single pass.
 */
const applyAnnotationRule = (
    rule: ExtraFileAnnotationRule,
    raw: string,
    newVersion: string,
    label: string,
    absolutePath: string,
): { content?: string; warnings: string[] } => {
    const marker = rule.marker ?? DEFAULT_ANNOTATION_MARKER;
    const warnings: string[] = [];
    const lines = raw.split("\n");
    let anyMatched = false;
    let anyReplacedVersion = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;

        if (!line.includes(marker)) {
            continue;
        }

        anyMatched = true;

        // Is the marker on its own line (preceding-line placement) or
        // inline with the version? Heuristic: strip everything from the
        // first comment-leader (`#`, `//`, `/*`, `--`, `<!--`) onwards
        // and check if the remainder is whitespace. If so, the marker
        // is on its own line.
        const beforeMarker = line.slice(0, line.indexOf(marker));
        const trimmedBefore = beforeMarker.replace(/^\s*(?:#|\/\/|\/\*|--|<!--)\s*$/, "").trim();
        const isOwnLine = trimmedBefore === "";

        if (isOwnLine) {
            // Preceding-line placement — replace the semver substring on
            // the NEXT line.
            const targetIndex = i + 1;
            const targetLine = lines[targetIndex];

            if (targetLine === undefined) {
                warnings.push(
                    `extra-files: ${label}[${rule.path}] annotation marker on the last line of ${absolutePath} (no following line to update).`,
                );
                continue;
            }

            const located = findSemverOnLine(targetLine, rule.anchor);

            if (!located) {
                warnings.push(
                    rule.anchor === undefined
                        ? `extra-files: ${label}[${rule.path}] annotation marker at ${absolutePath}:${i + 1} but no semver-shaped substring on the following line.`
                        : `extra-files: ${label}[${rule.path}] annotation marker at ${absolutePath}:${i + 1} but anchor "${rule.anchor}" / no semver-shaped substring after it on the following line.`,
                );
                continue;
            }

            lines[targetIndex] = targetLine.slice(0, located.index) + newVersion + targetLine.slice(located.index + located.match.length);
            anyReplacedVersion = true;
        } else {
            // Inline placement — replace the semver substring on the
            // SAME line as the marker. Care must be taken to not replace
            // the marker comment itself (it doesn't contain a semver,
            // but a custom marker could).
            const located = findSemverOnLine(line, rule.anchor);

            if (!located) {
                warnings.push(
                    rule.anchor === undefined
                        ? `extra-files: ${label}[${rule.path}] annotation marker at ${absolutePath}:${i + 1} but no semver-shaped substring on the marked line.`
                        : `extra-files: ${label}[${rule.path}] annotation marker at ${absolutePath}:${i + 1} but anchor "${rule.anchor}" / no semver-shaped substring after it on the marked line.`,
                );
                continue;
            }

            lines[i] = line.slice(0, located.index) + newVersion + line.slice(located.index + located.match.length);
            anyReplacedVersion = true;
        }
    }

    if (!anyMatched) {
        warnings.push(
            `extra-files: ${label}[${rule.path}] annotation marker "${marker}" not found in ${absolutePath}; rule may be stale.`,
        );

        return { warnings };
    }

    if (!anyReplacedVersion) {
        // Marker present but every occurrence had no semver to update —
        // the warnings array already records the per-line details.
        return { warnings };
    }

    return { content: lines.join("\n"), warnings };
};

/**
 * Apply a list of rules to one file. The file is read once; each rule
 * runs against the running result so multiple rules on the same file
 * compose. Missing files surface as a warning (one per missing path,
 * not one per missed rule).
 */
const applyRulesToFile = async (
    absolutePath: string,
    rules: ExtraFileRule[],
    newVersion: string,
    packageName: string,
    label: string,
): Promise<{ content?: string; warnings: string[] }> => {
    let raw: string;

    try {
        raw = await readFile(absolutePath, "utf8");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return { warnings: [`extra-files: ${label} → ${absolutePath} does not exist; skipping ${rules.length} rule(s).`] };
        }

        return { warnings: [`extra-files: ${label} → could not read ${absolutePath}: ${(error as Error).message}`] };
    }

    let content = raw;
    const warnings: string[] = [];

    for (const rule of rules) {
        if (isAnnotationRule(rule)) {
            const result = applyAnnotationRule(rule, content, newVersion, label, absolutePath);

            warnings.push(...result.warnings);

            if (result.content !== undefined) {
                content = result.content;
            }

            continue;
        }

        // Regex path (default for legacy rules without an explicit type).
        const regex = compileRule(rule, `${label}[${rule.path}]`);
        const substitute = rule.replace === undefined ? newVersion : expandTemplate(rule.replace, newVersion, packageName);

        let matched = false;
        const next = content.replace(regex, (match, ...args) => {
            matched = true;

            // When the user provided an explicit `replace`, run the
            // template through regex's standard expansion. Without a
            // template, drop the entire match in favour of the version
            // literal.
            if (rule.replace === undefined) {
                return substitute;
            }

            // Reconstruct the args contract for replace callback: keep
            // captured groups available via $n, but evaluate {version}
            // once up-front so the substitute string can be passed to
            // String.replace via the simpler signature.
            return substitute.replaceAll(/\$([&$1-9])/g, (_, key: string) => {
                if (key === "&") {
                    return match;
                }

                if (key === "$") {
                    return "$";
                }

                const groupIndex = Number.parseInt(key, 10) - 1;
                const group = args[groupIndex];

                return typeof group === "string" ? group : "";
            });
        });

        if (!matched) {
            warnings.push(`extra-files: ${label}[${rule.path}] regex /${rule.search}/${rule.flags ?? "g"} matched nothing in ${absolutePath}; rule may be stale.`);
            continue;
        }

        content = next;
    }

    if (content === raw) {
        return { warnings };
    }

    return { content, warnings };
};

/**
 * Resolve and apply both workspace-level and per-package rules.
 * @param cwd workspace root
 * @param packageDir package directory (rules under `perPackageRules` resolve relative to this)
 * @param newVersion the package's new version
 * @param packageName the package's name — substituted as `{name}` /
 * `{packageName}` in any rule's `replace` template
 * @param workspaceRules `release.publish.extraFiles` (paths relative to cwd)
 * @param perPackageRules `release.packages.&lt;name>.extraFiles` (paths relative to packageDir)
 */
export const applyExtraFilesForRelease = async (
    cwd: string,
    packageDir: string,
    newVersion: string,
    packageName: string,
    workspaceRules: ExtraFileRule[] = [],
    perPackageRules: ExtraFileRule[] = [],
): Promise<ExtraFileResult> => {
    const writes: ExtraFileWrite[] = [];
    const warnings: string[] = [];

    // Group rules by resolved absolute path so we read each file once.
    const byPath = new Map<string, { label: string; rules: ExtraFileRule[] }>();

    for (const rule of workspaceRules) {
        const abs = isAbsolute(rule.path) ? rule.path : join(cwd, rule.path);
        const slot = byPath.get(abs) ?? { label: "workspace", rules: [] };

        slot.rules.push(rule);
        byPath.set(abs, slot);
    }

    for (const rule of perPackageRules) {
        const abs = isAbsolute(rule.path) ? rule.path : join(packageDir, rule.path);
        const slot = byPath.get(abs) ?? { label: "per-package", rules: [] };

        slot.rules.push(rule);
        byPath.set(abs, slot);
    }

    for (const [absolutePath, slot] of byPath) {
        // Use a representative rule for the warning attribution (the
        // first one). All rules for the path are listed via the label
        // when collisions matter.
        const firstRule = slot.rules[0]!;
        const result = await applyRulesToFile(absolutePath, slot.rules, newVersion, packageName, slot.label);

        warnings.push(...result.warnings);

        if (result.content !== undefined) {
            writes.push({ content: result.content, path: absolutePath, rule: firstRule });
        }
    }

    return { warnings, writes };
};
