/**
 * Parse, write, and validate change files at `&lt;changesDir>/*.md` (RFC §9).
 *
 * Pure functions only — no fs imports here; callers are expected to read
 * file content + path and pass them in. This keeps the parser fully testable
 * and unit-coverable without fixture mounting.
 *
 * Two frontmatter shapes are accepted (RFC §9):
 *
 * Simple — every package gets the same body as its changelog entry:
 *
 *   ---
 *   "@scope/pkg-a": minor
 *   "@scope/pkg-b": patch
 *   ---
 *   Body becomes changelog entry for both.
 *
 * Nested — single primary + cascade:
 *
 *   ---
 *   "@scope/pkg-a":
 *     bump: minor
 *     cascade:
 *       "@scope/pkg-*": patch
 *   ---
 *   Body for pkg-a; cascaded entries get a synthesized "Version bump from …" line.
 */

import { parse as parseYaml } from "yaml";

import { VisReleaseError } from "../errors";
import type { BumpLevel, ChangeFile, ChangeFileNested, ChangeFileSimple } from "../types";
import { BUMP_LEVELS } from "../types";

// ── Frontmatter split ────────────────────────────────────────────────

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

interface SplitResult {
    body: string;
    frontmatter: string;
}

const splitFrontmatter = (content: string): SplitResult | null => {
    const match = FRONTMATTER_RE.exec(content);

    if (!match) {
        return null;
    }

    return { body: (match[2] ?? "").trim(), frontmatter: match[1] ?? "" };
};

// ── Package-name validation (RFC §19.4) ─────────────────────────────

/** npm-compliant package name regex. */
const PACKAGE_NAME_RE = /^(?:@[a-z0-9-]+\/)?[\w.-]+$/i;
const MAX_PACKAGE_NAME_LENGTH = 214;

const isValidPackageName = (name: string): boolean => {
    if (name.length === 0 || name.length > MAX_PACKAGE_NAME_LENGTH) {
        return false;
    }

    if (name.startsWith(".") || name.startsWith("_") || name.startsWith("-")) {
        return false;
    }

    return PACKAGE_NAME_RE.test(name);
};

// ── Bump-level validation ───────────────────────────────────────────

const isBumpLevel = (value: unknown): value is BumpLevel => typeof value === "string" && (BUMP_LEVELS as ReadonlyArray<string>).includes(value);

// ── Inline metadata extraction ──────────────────────────────────────

/**
 * Recognise `pr: 42`, `commit: abc1234`, `author: \@user` lines in the body.
 * Lines must appear at the start of the body (before any prose) per bumpy's
 * convention. We're permissive: any of the three (or none) may be present,
 * order is irrelevant, lines may be wrapped in trailing comments.
 */
const META_LINE_RE = /^\s*(pr|commit|author)\s*:\s*(.+?)\s*$/i;

const extractMeta = (body: string): { meta: ChangeFile["meta"]; remainder: string } => {
    const lines = body.split(/\r?\n/);
    const meta: NonNullable<ChangeFile["meta"]> = {};
    let consumed = 0;

    for (const line of lines) {
        if (line.trim() === "") {
            consumed += 1;

            continue;
        }

        const match = META_LINE_RE.exec(line);

        if (!match) {
            break;
        }

        const [, keyRaw = "", value = ""] = match;
        const key = keyRaw.toLowerCase();

        switch (key) {
            case "author": {
                meta.author = value.startsWith("@") ? value : `@${value}`;

                break;
            }
            case "commit": {
                meta.commit = value;

                break;
            }
            case "pr": {
                const n = Number.parseInt(value, 10);

                if (!Number.isNaN(n) && n > 0) {
                    meta.pr = n;
                }

                break;
            }
            default: {
                break; // Unknown meta keys are ignored.
            }
        }

        consumed += 1;
    }

    const remainder = lines.slice(consumed).join("\n").trim();

    return { meta: Object.keys(meta).length > 0 ? meta : undefined, remainder };
};

// ── Payload classification ──────────────────────────────────────────

interface RawNested {
    bump: unknown;
    cascade?: unknown;
    releaseAs?: unknown;
}

const isRawNested = (value: unknown): value is RawNested => typeof value === "object" && value !== null && !Array.isArray(value) && "bump" in value;

const parseNested = (
    primary: string,
    raw: RawNested,
    file: string,
): ChangeFileNested => {
    if (!isBumpLevel(raw.bump)) {
        throw new VisReleaseError({
            code: "BUMP_FILE_INVALID",
            file,
            message: `Invalid bump level for "${primary}": ${JSON.stringify(raw.bump)}. Expected one of: ${BUMP_LEVELS.join(", ")}`,
            packageName: primary,
        });
    }

    const result: ChangeFileNested = { bump: raw.bump, package: primary };

    if (raw.releaseAs !== undefined) {
        if (typeof raw.releaseAs !== "string" || !/^\d+\.\d+\.\d+(?:[-+].*)?$/.test(raw.releaseAs)) {
            throw new VisReleaseError({
                code: "BUMP_FILE_INVALID",
                file,
                message: `Invalid releaseAs for "${primary}": ${JSON.stringify(raw.releaseAs)}. Expected a semver string like "2.0.0" or "2.0.0-rc.1".`,
                packageName: primary,
            });
        }

        result.releaseAs = raw.releaseAs;
    }

    if (raw.cascade !== undefined) {
        if (typeof raw.cascade !== "object" || raw.cascade === null || Array.isArray(raw.cascade)) {
            throw new VisReleaseError({
                code: "BUMP_FILE_INVALID",
                file,
                message: `Cascade block for "${primary}" must be an object mapping package globs to bump levels.`,
                packageName: primary,
            });
        }

        const cascade: Record<string, BumpLevel> = {};

        for (const [glob, level] of Object.entries(raw.cascade as Record<string, unknown>)) {
            if (!isBumpLevel(level)) {
                throw new VisReleaseError({
                    code: "BUMP_FILE_INVALID",
                    file,
                    message: `Invalid cascade bump level for "${glob}": ${JSON.stringify(level)}.`,
                    packageName: primary,
                });
            }

            cascade[glob] = level;
        }

        result.cascade = cascade;
    }

    return result;
};

// ── Filename → id ───────────────────────────────────────────────────

const filenameToId = (path: string): string => {
    const base = path.replaceAll(/^.*[/\\]/g, "");

    return base.replace(/\.md$/i, "");
};

// ── Public API ──────────────────────────────────────────────────────

/**
 * Parse a single change file's content + path into a `ChangeFile` object.
 * Throws `VisReleaseError("BUMP_FILE_INVALID")` on any structural problem.
 * @param content — the raw file content (UTF-8)
 * @param file — path used in error messages and for deriving the `id` slug
 */
export const parseChangeFile = (content: string, file: string): ChangeFile => {
    const split = splitFrontmatter(content);

    if (!split) {
        throw new VisReleaseError({
            code: "BUMP_FILE_INVALID",
            file,
            message: "Change file is missing YAML frontmatter (expected `---` delimiters).",
        });
    }

    let raw: unknown;

    try {
        raw = parseYaml(split.frontmatter, { schema: "core", strict: true });
    } catch (error) {
        throw new VisReleaseError({
            cause: error,
            code: "BUMP_FILE_INVALID",
            file,
            message: `YAML parse failed: ${(error as Error).message}`,
        });
    }

    // YAML null is acceptable: it's what you get from a fully-blank
    // frontmatter block between `---` delimiters — the empty-change-file
    // case. Coerce to {} so the empty-entries branch below handles it.
    if (raw === null || raw === undefined) {
        return {
            body: split.body.trim(),
            id: filenameToId(file),
            path: file,
            payload: { bumps: {} },
        };
    }

    if (typeof raw !== "object" || Array.isArray(raw)) {
        throw new VisReleaseError({
            code: "BUMP_FILE_INVALID",
            file,
            message: "Frontmatter must be a YAML object mapping package names to bump levels.",
        });
    }

    const entries = Object.entries(raw as Record<string, unknown>);

    if (entries.length === 0) {
        // Empty frontmatter is a deliberate signal: the author wants to
        // record that this PR was considered for release but should not
        // produce a version bump (changesets-style "empty changeset").
        // Useful for docs-only changes that satisfy a CI gate requiring
        // at least one change file per PR.
        return {
            body: split.body.trim(),
            id: filenameToId(file),
            path: file,
            payload: { bumps: {} },
        };
    }

    // Package-name validation
    for (const [key] of entries) {
        if (!isValidPackageName(key)) {
            throw new VisReleaseError({
                code: "BUMP_FILE_INVALID",
                file,
                message: `Invalid package name: ${JSON.stringify(key)}.`,
                packageName: key,
            });
        }
    }

    // Discriminate simple vs nested. If exactly one entry and the value is a
    // nested-shape object, treat as nested. Otherwise simple.
    let payload: ChangeFileSimple | ChangeFileNested;

    if (entries.length === 1 && isRawNested(entries[0]![1])) {
        const [name, rawEntry] = entries[0]!;

        payload = parseNested(name, rawEntry as RawNested, file);
    } else {
        const bumps: Record<string, BumpLevel> = {};

        for (const [name, level] of entries) {
            if (isRawNested(level)) {
                throw new VisReleaseError({
                    code: "BUMP_FILE_INVALID",
                    file,
                    message: `Mixed simple + nested entries are not allowed. Package "${name}" uses the nested shape but the file has multiple top-level entries.`,
                    packageName: name,
                });
            }

            if (!isBumpLevel(level)) {
                throw new VisReleaseError({
                    code: "BUMP_FILE_INVALID",
                    file,
                    message: `Invalid bump level for "${name}": ${JSON.stringify(level)}. Expected one of: ${BUMP_LEVELS.join(", ")}`,
                    packageName: name,
                });
            }

            bumps[name] = level;
        }

        payload = { bumps };
    }

    const { meta, remainder } = extractMeta(split.body);

    return {
        body: remainder,
        id: filenameToId(file),
        meta,
        path: file,
        payload,
    };
};

// ── Serialisation (writing back) ────────────────────────────────────

/**
 * Render a `ChangeFile` payload to a `&lt;changesDir>/&lt;id>.md` file body.
 * Used by `vis release add` and `vis release generate`.
 *
 * Does NOT include inline `pr:`/`commit:`/`author:` lines (those are emitted
 * separately when the user opts in via the GitHub formatter).
 */
export const formatChangeFile = (payload: ChangeFileSimple | ChangeFileNested, body: string): string => {
    let frontmatter: string;

    if ("bumps" in payload) {
        const lines = Object.entries(payload.bumps).map(([name, level]) => `${quoteIfNeeded(name)}: ${level}`);

        // Explicit `{}` so the file parses to an empty object rather
        // than YAML null when no bumps are present (empty-change-file).
        frontmatter = lines.length > 0 ? lines.join("\n") : "{}";
    } else {
        const lines: string[] = [`${quoteIfNeeded(payload.package)}:`, `  bump: ${payload.bump}`];

        if (payload.releaseAs) {
            lines.push(`  releaseAs: ${payload.releaseAs}`);
        }

        if (payload.cascade) {
            lines.push("  cascade:");

            for (const [glob, level] of Object.entries(payload.cascade)) {
                lines.push(`    ${quoteIfNeeded(glob)}: ${level}`);
            }
        }

        frontmatter = lines.join("\n");
    }

    return `---\n${frontmatter}\n---\n${body.trim() === "" ? "" : `${body.trim()}\n`}`;
};

/** Quote a YAML key if it starts with `@` or contains characters that need quoting. */
const quoteIfNeeded = (key: string): string => (/^[a-z0-9-]/.test(key) ? key : `"${key}"`);

// ── Combination utilities ───────────────────────────────────────────

/**
 * Collect all explicit (direct) bumps from a list of change files into
 * `Map&lt;packageName, max bump level&gt;`. Multiple files mentioning the same
 * package max-merge their levels. `none` is preserved (the package is
 * acknowledged but contributes no direct bump — cascading rules still apply).
 */
export const collectExplicitBumps = (files: ChangeFile[]): Map<string, BumpLevel> => {
    const out = new Map<string, BumpLevel>();
    // Ranking inline to avoid a circular import with `types.ts`.
    const rank = (l: BumpLevel): number => (l === "major" ? 3 : l === "minor" ? 2 : l === "patch" ? 1 : 0);

    const upsert = (name: string, level: BumpLevel): void => {
        const existing = out.get(name);

        if (existing === undefined || rank(level) > rank(existing)) {
            out.set(name, level);
        }
    };

    for (const file of files) {
        if ("bumps" in file.payload) {
            for (const [name, level] of Object.entries(file.payload.bumps)) {
                upsert(name, level);
            }
        } else {
            upsert(file.payload.package, file.payload.bump);
        }
    }

    return out;
};

/**
 * Find every `ChangeFile` that explicitly bumps a given package.
 * Used to attach change-file bodies to the changelog entry for a release.
 */
export const findChangeFilesFor = (packageName: string, files: ChangeFile[]): ChangeFile[] => files.filter((file) => {
    if ("bumps" in file.payload) {
        return Object.hasOwn(file.payload.bumps, packageName);
    }

    return file.payload.package === packageName;
});
